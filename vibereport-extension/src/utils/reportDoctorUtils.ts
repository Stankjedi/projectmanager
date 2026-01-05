/**
 * Report Doctor Utilities
 *
 * @description Pure validator/repair helpers for ensuring marker integrity and
 * basic markdown table sanity in managed report sections.
 */

import { MARKERS } from './markdownMarkers.js';
import { findMarkerRange } from './markerUtils.js';
import { EXECUTION_CHECKLIST_HEADING_REGEX } from './promptChecklistUtils.js';
import { isSensitivePath } from './sensitiveFilesUtils.js';

export type ReportDocumentType = 'evaluation' | 'improvement' | 'prompt';

export type ReportDoctorIssueCode =
  | 'MISSING_START_MARKER'
  | 'MISSING_END_MARKER'
  | 'MISORDERED_MARKERS'
  | 'DUPLICATE_START_MARKER'
  | 'DUPLICATE_END_MARKER'
  | 'TABLE_COLUMN_MISMATCH'
  | 'DOCS_VERSION_MISMATCH'
  | 'SENSITIVE_FILES_PRESENT'
  | 'PROMPT_CONTAINS_HANGUL'
  | 'PROMPT_MISSING_TITLE'
  | 'PROMPT_CHECKLIST_SECTION_MISSING'
  | 'PROMPT_MISSING_CHECKLIST'
  | 'PROMPT_CHECKLIST_ITEM_SECTION_MISSING'
  | 'PROMPT_FINAL_COMPLETION_SECTION_MISSING'
  | 'PROMPT_FINAL_COMPLETION_NOT_LAST'
  | 'PROMPT_FINAL_COMPLETION_MESSAGE_MISSING';

export interface ReportDoctorIssue {
  code: ReportDoctorIssueCode;
  sectionId: string;
  message: string;
}

interface ManagedSectionDefinition {
  id: string;
  startMarker: string;
  endMarker: string;
  validateTables: boolean;
}

const EVALUATION_SECTIONS: ManagedSectionDefinition[] = [
  {
    id: 'tldr',
    startMarker: MARKERS.TLDR_START,
    endMarker: MARKERS.TLDR_END,
    validateTables: true,
  },
  {
    id: 'risk-summary',
    startMarker: MARKERS.RISK_SUMMARY_START,
    endMarker: MARKERS.RISK_SUMMARY_END,
    validateTables: true,
  },
  {
    id: 'overview',
    startMarker: MARKERS.OVERVIEW_START,
    endMarker: MARKERS.OVERVIEW_END,
    validateTables: true,
  },
  {
    id: 'structure',
    startMarker: '<!-- AUTO-STRUCTURE-START -->',
    endMarker: '<!-- AUTO-STRUCTURE-END -->',
    validateTables: false,
  },
  {
    id: 'score',
    startMarker: MARKERS.SCORE_START,
    endMarker: MARKERS.SCORE_END,
    validateTables: true,
  },
  {
    id: 'score-mapping',
    startMarker: MARKERS.SCORE_MAPPING_START,
    endMarker: MARKERS.SCORE_MAPPING_END,
    validateTables: true,
  },
  {
    id: 'detail',
    startMarker: '<!-- AUTO-DETAIL-START -->',
    endMarker: '<!-- AUTO-DETAIL-END -->',
    validateTables: false,
  },
  {
    id: 'summary',
    startMarker: MARKERS.SUMMARY_START,
    endMarker: MARKERS.SUMMARY_END,
    validateTables: false,
  },
  {
    id: 'trend',
    startMarker: MARKERS.TREND_START,
    endMarker: MARKERS.TREND_END,
    validateTables: true,
  },
];

const IMPROVEMENT_SECTIONS: ManagedSectionDefinition[] = [
  {
    id: 'overview',
    startMarker: MARKERS.OVERVIEW_START,
    endMarker: MARKERS.OVERVIEW_END,
    validateTables: true,
  },
  {
    id: 'error-exploration',
    startMarker: MARKERS.ERROR_EXPLORATION_START,
    endMarker: MARKERS.ERROR_EXPLORATION_END,
    validateTables: false,
  },
  {
    id: 'summary',
    startMarker: MARKERS.SUMMARY_START,
    endMarker: MARKERS.SUMMARY_END,
    validateTables: false,
  },
  {
    id: 'improvement-list',
    startMarker: MARKERS.IMPROVEMENT_LIST_START,
    endMarker: MARKERS.IMPROVEMENT_LIST_END,
    validateTables: false,
  },
  {
    id: 'optimization',
    startMarker: MARKERS.OPTIMIZATION_START,
    endMarker: MARKERS.OPTIMIZATION_END,
    validateTables: false,
  },
  {
    id: 'feature-list',
    startMarker: MARKERS.FEATURE_LIST_START,
    endMarker: MARKERS.FEATURE_LIST_END,
    validateTables: false,
  },
];

function getManagedSections(type: ReportDocumentType): ManagedSectionDefinition[] {
  if (type === 'evaluation') return EVALUATION_SECTIONS;
  if (type === 'improvement') return IMPROVEMENT_SECTIONS;
  return [];
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

function detectNewline(content: string): '\n' | '\r\n' {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function parseMarkdownTableColumnCount(line: string): number | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  if (!trimmed.includes('|')) return null;

  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = withoutEdges.split('|').map(c => c.trim());
  const count = cells.length;
  return Number.isFinite(count) && count > 0 ? count : null;
}

function parseMarkdownTableRowCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  if (!trimmed.includes('|')) return null;

  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return withoutEdges.split('|').map(c => c.trim());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findSensitiveFiles(fileList: string[]): string[] {
  const sensitiveFiles: string[] = [];

  for (const filePath of fileList) {
    const normalized = filePath.replace(/\\/g, '/');
    if (!isSensitivePath(normalized)) continue;

    sensitiveFiles.push(normalized);
    if (sensitiveFiles.length >= 20) break;
  }

  return sensitiveFiles;
}

export function validateDocsVersionSync(args: {
  packageVersion: string;
  readmeContent: string;
  extReadmeContent?: string;
  changelogContent: string;
}): ReportDoctorIssue[] {
  const issues: ReportDoctorIssue[] = [];

  if (!args.packageVersion) {
    issues.push({
      code: 'DOCS_VERSION_MISMATCH',
      sectionId: 'docs',
      message: 'package.json is missing a valid version string.',
    });
    return issues;
  }

  const changelogMatch = args.changelogContent.match(/^##\s*\[(\d+\.\d+\.\d+)\]/m);
  if (!changelogMatch) {
    issues.push({
      code: 'DOCS_VERSION_MISMATCH',
      sectionId: 'docs',
      message: 'CHANGELOG.md is missing a top version heading like "## [x.y.z]".',
    });
  } else if (changelogMatch[1] !== args.packageVersion) {
    issues.push({
      code: 'DOCS_VERSION_MISMATCH',
      sectionId: 'docs',
      message: `CHANGELOG.md top version (${changelogMatch[1]}) does not match package.json (${args.packageVersion}).`,
    });
  }

  issues.push(
    ...validateReadmeVersionSync({
      fileLabel: 'README.md',
      content: args.readmeContent,
      packageVersion: args.packageVersion,
      checkBadge: false,
    })
  );

  if (typeof args.extReadmeContent === 'string') {
    issues.push(
      ...validateReadmeVersionSync({
        fileLabel: 'vibereport-extension/README.md',
        content: args.extReadmeContent,
        packageVersion: args.packageVersion,
        checkBadge: true,
      })
    );
  }

  return issues;
}

function validateReadmeVersionSync(args: {
  fileLabel: string;
  content: string;
  packageVersion: string;
  checkBadge: boolean;
}): ReportDoctorIssue[] {
  const issues: ReportDoctorIssue[] = [];

  const versionMatch = args.content.match(/(\d+\.\d+\.\d+)/);
  if (!versionMatch) {
    issues.push({
      code: 'DOCS_VERSION_MISMATCH',
      sectionId: 'docs',
      message: `${args.fileLabel} is missing a version string like "x.y.z".`,
    });
  } else if (versionMatch[1] !== args.packageVersion) {
    issues.push({
      code: 'DOCS_VERSION_MISMATCH',
      sectionId: 'docs',
      message: `${args.fileLabel} version (${versionMatch[1]}) does not match package.json (${args.packageVersion}).`,
    });
  }

  const vsixVersions = Array.from(
    new Set(
      Array.from(
        args.content.matchAll(/vibereport-(\d+\.\d+\.\d+)\.vsix/g),
        match => match[1]
      )
    )
  );
  const vsixDrift = vsixVersions.filter(v => v !== args.packageVersion);
  if (vsixDrift.length > 0) {
    issues.push({
      code: 'DOCS_VERSION_MISMATCH',
      sectionId: 'docs',
      message: `${args.fileLabel} VSIX example version drift: found ${vsixDrift.join(', ')} (expected ${args.packageVersion}).`,
    });
  }

  const releaseUrlRegex =
    /releases\/download\/v(\d+\.\d+\.\d+)\/vibereport-(\d+\.\d+\.\d+)\.vsix/g;
  const releaseMismatches: string[] = [];
  for (const match of args.content.matchAll(releaseUrlRegex)) {
    const urlVersion = match[1];
    const fileVersion = match[2];
    if (urlVersion !== args.packageVersion || fileVersion !== args.packageVersion) {
      releaseMismatches.push(
        `v${urlVersion}/vibereport-${fileVersion}.vsix (expected v${args.packageVersion}/vibereport-${args.packageVersion}.vsix)`
      );
    }
  }
  if (releaseMismatches.length > 0) {
    issues.push({
      code: 'DOCS_VERSION_MISMATCH',
      sectionId: 'docs',
      message: `${args.fileLabel} release URL drift: ${releaseMismatches[0]}${releaseMismatches.length > 1 ? ` (+${releaseMismatches.length - 1} more)` : ''}.`,
    });
  }

  if (args.checkBadge) {
    const badgeMatch = args.content.match(
      /img\.shields\.io\/badge\/version-(\d+\.\d+\.\d+)-brightgreen/i
    );
    if (badgeMatch) {
      const badgeVersion = badgeMatch[1];
      if (badgeVersion !== args.packageVersion) {
        issues.push({
          code: 'DOCS_VERSION_MISMATCH',
          sectionId: 'docs',
          message: `${args.fileLabel} version badge (${badgeVersion}) does not match package.json (${args.packageVersion}).`,
        });
      }
    }
  }

  return issues;
}

export function fixDocsVersionSync(args: {
  packageVersion: string;
  readmeContent: string;
  changelogContent: string;
}): {
  readmeContent: string;
  changelogContent: string;
  changed: { readme: boolean; changelog: boolean };
} {
  const readmeNewline = detectNewline(args.readmeContent);
  const changelogNewline = detectNewline(args.changelogContent);

  const normalizedReadme = normalizeNewlines(args.readmeContent);
  const normalizedChangelog = normalizeNewlines(args.changelogContent);

  const fixedChangelog = normalizedChangelog.replace(
    /^##\s*\[(\d+\.\d+\.\d+)\]/m,
    `## [${args.packageVersion}]`
  );

  let fixedReadme = normalizedReadme.replace(/(\d+\.\d+\.\d+)/, args.packageVersion);
  fixedReadme = fixedReadme.replace(
    /vibereport-(\d+\.\d+\.\d+)\.vsix/g,
    `vibereport-${args.packageVersion}.vsix`
  );

  // If versioned release URLs exist, keep both the URL version and VSIX filename in sync.
  fixedReadme = fixedReadme.replace(
    /releases\/download\/v(\d+\.\d+\.\d+)\/vibereport-(\d+\.\d+\.\d+)\.vsix/g,
    `releases/download/v${args.packageVersion}/vibereport-${args.packageVersion}.vsix`
  );

  fixedReadme = fixedReadme.replace(
    /(img\.shields\.io\/badge\/version-)(\d+\.\d+\.\d+)(-brightgreen)/gi,
    (_match, prefix: string, _version: string, suffix: string) =>
      `${prefix}${args.packageVersion}${suffix}`
  );

  const finalReadme =
    readmeNewline === '\r\n' ? fixedReadme.replace(/\n/g, '\r\n') : fixedReadme;
  const finalChangelog =
    changelogNewline === '\r\n'
      ? fixedChangelog.replace(/\n/g, '\r\n')
      : fixedChangelog;

  return {
    readmeContent: finalReadme,
    changelogContent: finalChangelog,
    changed: {
      readme: finalReadme !== args.readmeContent,
      changelog: finalChangelog !== args.changelogContent,
    },
  };
}

function validatePromptMarkdown(content: string): ReportDoctorIssue[] {
  const issues: ReportDoctorIssue[] = [];
  const normalized = normalizeNewlines(content);

  if (/[\uAC00-\uD7A3]/.test(normalized)) {
    issues.push({
      code: 'PROMPT_CONTAINS_HANGUL',
      sectionId: 'prompt',
      message: 'Prompt.md contains Hangul characters; it must be English-only.',
    });
  }

  const lines = normalized.split('\n');
  const firstNonEmpty = lines.find(line => line.trim() !== '');
  if (!firstNonEmpty || !firstNonEmpty.startsWith('# ')) {
    issues.push({
      code: 'PROMPT_MISSING_TITLE',
      sectionId: 'prompt',
      message: 'Missing top-level title (must start with "# ").',
    });
  }

  const checklistIndex = lines.findIndex(line =>
    EXECUTION_CHECKLIST_HEADING_REGEX.test(line.trim())
  );

  const checklistPromptIds: string[] = [];
  if (checklistIndex === -1) {
    issues.push({
      code: 'PROMPT_CHECKLIST_SECTION_MISSING',
      sectionId: 'prompt',
      message: 'Missing "## Execution Checklist" section.',
    });
  } else {
    let endIndex = lines.length;
    for (let i = checklistIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '---' || lines[i].trim().startsWith('## ')) {
        endIndex = i;
        break;
      }
    }

    for (const line of lines.slice(checklistIndex + 1, endIndex)) {
      const cells = parseMarkdownTableRowCells(line);
      if (!cells || cells.length < 2) continue;

      const maybeId = cells[1];
      if (/^(PROMPT-\d{3}|OPT-\d+)$/i.test(maybeId)) {
        checklistPromptIds.push(maybeId);
      }
    }

    const uniqueIds = [...new Set(checklistPromptIds)];
    if (uniqueIds.length === 0) {
      issues.push({
        code: 'PROMPT_MISSING_CHECKLIST',
        sectionId: 'prompt',
        message:
          'Execution Checklist table is missing prompt IDs (e.g., PROMPT-001, OPT-1).',
      });
    } else {
      for (const id of uniqueIds) {
        const sectionRegex = new RegExp(
          `^###\\s*\\[${escapeRegExp(id)}\\]`,
          'm'
        );
        if (!sectionRegex.test(normalized)) {
          issues.push({
            code: 'PROMPT_CHECKLIST_ITEM_SECTION_MISSING',
            sectionId: 'prompt',
            message: `Missing prompt section heading for checklist ID: ${id}`,
          });
        }
      }
    }
  }

  const finalCompletionHeadingRegex = /^##\s*Final Completion\b/;
  const finalCompletionIndex = lines.findIndex(line =>
    finalCompletionHeadingRegex.test(line.trim())
  );

  if (finalCompletionIndex === -1) {
    issues.push({
      code: 'PROMPT_FINAL_COMPLETION_SECTION_MISSING',
      sectionId: 'prompt',
      message: 'Missing "## Final Completion" section.',
    });
  } else {
    const h2Indices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('## ')) h2Indices.push(i);
    }

    const lastH2Index = h2Indices.length > 0 ? h2Indices[h2Indices.length - 1] : -1;
    if (lastH2Index !== -1 && lastH2Index !== finalCompletionIndex) {
      issues.push({
        code: 'PROMPT_FINAL_COMPLETION_NOT_LAST',
        sectionId: 'prompt',
        message: '"## Final Completion" must be the last level-2 section in Prompt.md.',
      });
    }

    const requiredMessage =
      'ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.';
    const afterFinal = lines.slice(finalCompletionIndex + 1).join('\n');
    if (!afterFinal.includes(requiredMessage)) {
      issues.push({
        code: 'PROMPT_FINAL_COMPLETION_MESSAGE_MISSING',
        sectionId: 'prompt',
        message: 'Missing required final completion message string.',
      });
    }
  }

  return issues;
}

function validateTableGroups(
  lines: string[],
  sectionId: string
): ReportDoctorIssue[] {
  const issues: ReportDoctorIssue[] = [];

  let i = 0;
  while (i < lines.length) {
    const colCount = parseMarkdownTableColumnCount(lines[i]);
    if (colCount === null) {
      i++;
      continue;
    }

    const expected = colCount;
    let j = i + 1;
    while (j < lines.length) {
      const nextCount = parseMarkdownTableColumnCount(lines[j]);
      if (nextCount === null) break;
      if (nextCount !== expected) {
        issues.push({
          code: 'TABLE_COLUMN_MISMATCH',
          sectionId,
          message: `Table column mismatch (expected ${expected}, got ${nextCount}).`,
        });
        break;
      }
      j++;
    }

    i = j + 1;
  }

  return issues;
}

function validateMarkerPair(
  content: string,
  section: ManagedSectionDefinition
): ReportDoctorIssue[] {
  const issues: ReportDoctorIssue[] = [];
  const startCount = countOccurrences(content, section.startMarker);
  const endCount = countOccurrences(content, section.endMarker);

  if (startCount === 0) {
    issues.push({
      code: 'MISSING_START_MARKER',
      sectionId: section.id,
      message: `Missing start marker: ${section.startMarker}`,
    });
  }

  if (endCount === 0) {
    issues.push({
      code: 'MISSING_END_MARKER',
      sectionId: section.id,
      message: `Missing end marker: ${section.endMarker}`,
    });
  }

  if (startCount > 1) {
    issues.push({
      code: 'DUPLICATE_START_MARKER',
      sectionId: section.id,
      message: `Duplicate start marker: ${section.startMarker}`,
    });
  }

  if (endCount > 1) {
    issues.push({
      code: 'DUPLICATE_END_MARKER',
      sectionId: section.id,
      message: `Duplicate end marker: ${section.endMarker}`,
    });
  }

  const startIndex = content.indexOf(section.startMarker);
  if (startIndex !== -1) {
    const endAfterStart = content.indexOf(
      section.endMarker,
      startIndex + section.startMarker.length
    );
    if (endAfterStart === -1 && endCount > 0) {
      issues.push({
        code: 'MISORDERED_MARKERS',
        sectionId: section.id,
        message: `Markers are misordered: ${section.startMarker} / ${section.endMarker}`,
      });
    }
  }

  return issues;
}

function extractManagedContentLines(
  content: string,
  startMarker: string,
  endMarker: string
): string[] | null {
  const lines = content.split('\n');
  const range = findMarkerRange(lines, startMarker, endMarker);
  if (!range) return null;
  return lines.slice(range.start + 1, range.end);
}

export function validateReportMarkdown(
  content: string,
  type: ReportDocumentType
): ReportDoctorIssue[] {
  const normalized = normalizeNewlines(content);
  if (type === 'prompt') {
    return validatePromptMarkdown(normalized);
  }
  const sections = getManagedSections(type);

  const issues: ReportDoctorIssue[] = [];
  for (const section of sections) {
    const markerIssues = validateMarkerPair(normalized, section);
    issues.push(...markerIssues);

    if (section.validateTables) {
      const blockLines = extractManagedContentLines(
        normalized,
        section.startMarker,
        section.endMarker
      );
      if (blockLines) {
        issues.push(...validateTableGroups(blockLines, section.id));
      }
    }
  }

  return issues;
}

function extractMarkerBlockFromTemplate(
  template: string,
  startMarker: string,
  endMarker: string
): string | null {
  const normalized = normalizeNewlines(template);
  const lines = normalized.split('\n');
  const range = findMarkerRange(lines, startMarker, endMarker);
  if (!range) return null;
  return lines.slice(range.start, range.end + 1).join('\n');
}

function removeMarkerLines(
  lines: string[],
  startMarker: string,
  endMarker: string
): { lines: string[]; removedBeforeIndex: (index: number) => number } {
  const markerLineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startMarker) || lines[i].includes(endMarker)) {
      markerLineIndices.push(i);
    }
  }

  const removedBeforeIndex = (index: number): number =>
    markerLineIndices.filter(i => i < index).length;

  const filtered = lines.filter(
    l => !l.includes(startMarker) && !l.includes(endMarker)
  );
  return { lines: filtered, removedBeforeIndex };
}

function replaceSpan(
  lines: string[],
  start: number,
  end: number,
  replacementLines: string[]
): string[] {
  const next = [...lines];
  next.splice(start, end - start + 1, ...replacementLines);
  return next;
}

function findLineIndicesContaining(lines: string[], needle: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) indices.push(i);
  }
  return indices;
}

export function repairReportMarkdown(args: {
  content: string;
  template: string;
  type: ReportDocumentType;
}): {
  content: string;
  changed: boolean;
  issuesBefore: ReportDoctorIssue[];
  issuesAfter: ReportDoctorIssue[];
} {
  const newline = detectNewline(args.content);
  const originalNormalized = normalizeNewlines(args.content);
  const templateNormalized = normalizeNewlines(args.template);

  const issuesBefore = validateReportMarkdown(originalNormalized, args.type);
  const sections = getManagedSections(args.type);

  if (originalNormalized.trim() === '') {
    const issuesAfter = validateReportMarkdown(templateNormalized, args.type);
    return {
      content: templateNormalized.replace(/\n/g, newline),
      changed: templateNormalized !== originalNormalized,
      issuesBefore,
      issuesAfter,
    };
  }

  const sectionsWithIssues = new Set(
    issuesBefore.map(issue => issue.sectionId)
  );

  let lines = originalNormalized.split('\n');
  for (const section of sections) {
    if (!sectionsWithIssues.has(section.id)) continue;

    const templateBlock = extractMarkerBlockFromTemplate(
      templateNormalized,
      section.startMarker,
      section.endMarker
    );
    if (!templateBlock) continue;

    const replacementLines = templateBlock.split('\n');

    const startIndices = findLineIndicesContaining(lines, section.startMarker);
    const endIndices = findLineIndicesContaining(lines, section.endMarker);

    const firstStart = startIndices.length > 0 ? startIndices[0] : -1;
    const endAfterStart = endIndices.filter(i => i > firstStart);
    const lastEndAfterStart =
      endAfterStart.length > 0 ? Math.max(...endAfterStart) : -1;

    if (firstStart !== -1 && lastEndAfterStart !== -1) {
      // Replace the widest span from first start to last end after it.
      lines = replaceSpan(lines, firstStart, lastEndAfterStart, replacementLines);
      continue;
    }

    // No valid span -> remove stray marker lines and insert a fresh block.
    const insertionIndexOriginal = (() => {
      const all = [...startIndices, ...endIndices].sort((a, b) => a - b);
      return all.length > 0 ? all[0] : lines.length;
    })();

    const cleaned = removeMarkerLines(lines, section.startMarker, section.endMarker);
    const insertionIndex =
      insertionIndexOriginal - cleaned.removedBeforeIndex(insertionIndexOriginal);

    lines = [
      ...cleaned.lines.slice(0, insertionIndex),
      ...(insertionIndex > 0 && cleaned.lines[insertionIndex - 1].trim() !== ''
        ? ['']
        : []),
      ...replacementLines,
      ...(insertionIndex < cleaned.lines.length && replacementLines.at(-1)?.trim() !== ''
        ? ['']
        : []),
      ...cleaned.lines.slice(insertionIndex),
    ];
  }

  const repairedNormalized = lines.join('\n');
  const issuesAfter = validateReportMarkdown(repairedNormalized, args.type);

  return {
    content: repairedNormalized.replace(/\n/g, newline),
    changed: repairedNormalized !== originalNormalized,
    issuesBefore,
    issuesAfter,
  };
}
