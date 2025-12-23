import type { AppliedImprovement, VibeReportConfig } from '../../models/types.js';
import { SnapshotService } from '../../services/snapshotService.js';
import { EXECUTION_CHECKLIST_BLOCK_REGEX } from '../../utils/promptChecklistUtils.js';
import type { UpdateReportsWorkflowDeps } from '../updateReportsWorkflow.js';

export async function inferAppliedImprovementsFromPrompt(args: {
  rootPath: string;
  config: VibeReportConfig;
  deps: UpdateReportsWorkflowDeps;
}): Promise<AppliedImprovement[]> {
  const { rootPath, config, deps } = args;
  const paths = deps.reportService.getReportPaths(rootPath, config);

  let content: string;
  try {
    content = await deps.fs.readFile(paths.prompt, 'utf-8');
  } catch {
    return [];
  }

  const checklistMatch = content.match(EXECUTION_CHECKLIST_BLOCK_REGEX);
  if (!checklistMatch) {
    return [];
  }

  const checklist = checklistMatch[0];
  const applied: AppliedImprovement[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  // | # | Prompt ID | Title | Priority | Status |
  const rowPattern =
    /\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;

  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(checklist)) !== null) {
    const promptId = match[1].trim();
    const title = match[2].trim();
    const statusCell = match[4].trim();

    const normalized = statusCell.replace(/\s+/g, '').toLowerCase();
    const hasDoneIcon = /✅|☑|✔/.test(statusCell);
    const hasKoreanDoneEscape = normalized.includes('\\uc644\\ub8cc');
    const hasKoreanPartialEscape = normalized.includes('\\ubd80\\ubd84\\uc644\\ub8cc');
    const hasKoreanNotDoneEscape = normalized.includes('\\ubbf8\\uc644\\ub8cc');
    const isPartial =
      hasKoreanPartialEscape ||
      normalized.includes('부분완료') || normalized.includes('부분완') || normalized.includes('partial');
    const isKoreanDone =
      (normalized.includes('완료') || hasKoreanDoneEscape) &&
      !(normalized.includes('미완료') || hasKoreanNotDoneEscape) &&
      !isPartial;
    const isEnglishDone =
      (normalized.includes('done') || normalized.includes('complete') || normalized.includes('completed')) &&
      !normalized.includes('notdone') &&
      !normalized.includes('incomplete') &&
      !isPartial;

    const isDone = !isPartial && (hasDoneIcon || isKoreanDone || isEnglishDone);
    if (!isDone) {
      continue;
    }

    const idFromTitle = title.match(/`([^`]+)`/);
    const improvementId = (idFromTitle ? idFromTitle[1].trim() : promptId) || promptId;

    const titleKey = title.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seenIds.has(improvementId) || seenTitles.has(titleKey)) {
      continue;
    }
    seenIds.add(improvementId);
    seenTitles.add(titleKey);

    applied.push({
      id: improvementId,
      title,
      appliedAt: deps.now().toISOString(),
      sessionId: SnapshotService.generateSessionId(),
    });
  }

  return applied;
}

export function mergeAppliedImprovements(
  existing: AppliedImprovement[],
  inferred: AppliedImprovement[]
): AppliedImprovement[] {
  if (!inferred.length) {
    return existing;
  }

  const merged = [...existing];
  const existingIds = new Set(existing.map(i => i.id));
  const existingTitles = new Set(existing.map(i => i.title.toLowerCase()));

  for (const item of inferred) {
    const titleKey = item.title.toLowerCase();
    if (existingIds.has(item.id) || existingTitles.has(titleKey)) {
      continue;
    }
    merged.push(item);
  }

  return merged;
}
