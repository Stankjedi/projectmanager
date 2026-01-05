import * as crypto from 'crypto';
import { MARKERS } from '../markdownMarkers.js';
import { extractBetweenMarkers } from './markerOps.js';

/**
 * 개선 항목의 고유 ID를 생성합니다.
 *
 * @description 제목과 설명의 내용을 기반으로 MD5 해시를 생성하여
 * 12자리의 고유 식별자를 만듭니다. 동일한 내용은 항상 동일한 ID를 생성합니다.
 *
 * @param title - 개선 항목 제목
 * @param description - 개선 항목 설명
 * @returns 12자리 16진수 해시 문자열
 *
 * @example
 * ```typescript
 * const id = generateImprovementId('테스트 추가', '단위 테스트를 추가합니다.');
 * // id: 'a1b2c3d4e5f6'
 * ```
 */
export function generateImprovementId(title: string, description: string): string {
  const content = `${title}:${description}`.toLowerCase().trim();
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return hash.substring(0, 12);
}

const EXPLICIT_IMPROVEMENT_ID_REGEX = /^[a-z][a-z0-9-]*-\d{3}$/;

/**
 * 선택된 텍스트에서 명시적인 개선 항목 ID를 추출합니다.
 *
 * @description 레포지토리에서 사용하는 개선 항목 ID 형식(`<kebab-case>-<3 digits>`)을
 * 다양한 선택 패턴에서 안정적으로 추출하기 위한 순수 함수입니다.
 *
 * 지원 패턴:
 * - 마크다운 테이블 행: `**ID**`를 포함하고, 백틱 코드 스팬으로 ID가 표기된 경우
 * - 프롬프트 문장: `Linked Improvement ID:` 라인에 백틱 코드 스팬으로 ID가 표기된 경우
 * - 일반 폴백: 텍스트 내 백틱 코드 스팬 중 첫 번째로 ID 형식과 일치하는 토큰
 *
 * @param text - 검색할 텍스트(선택 영역)
 * @returns 추출된 개선 항목 ID 또는 찾지 못하면 null
 */
export function extractImprovementIdFromText(text: string): string | null {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // 1) Table row format (contains **ID** and a backticked value)
  for (const line of lines) {
    if (!line.includes('**ID**')) continue;
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const token = match[1].trim();
      if (EXPLICIT_IMPROVEMENT_ID_REGEX.test(token)) return token;
    }
  }

  // 2) Linked ID format in English prompts
  for (const line of lines) {
    if (!line.includes('Linked Improvement ID:')) continue;
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const token = match[1].trim();
      if (EXPLICIT_IMPROVEMENT_ID_REGEX.test(token)) return token;
    }
  }

  // 3) Generic fallback: first backticked token matching the explicit format
  for (const match of normalized.matchAll(/`([^`]+)`/g)) {
    const token = match[1].trim();
    if (EXPLICIT_IMPROVEMENT_ID_REGEX.test(token)) return token;
  }

  return null;
}

/**
 * 파싱된 개선 항목 인터페이스
 *
 * @description 마크다운에서 파싱된 개선 항목의 구조를 정의합니다.
 */
export interface ParsedImprovementItem {
  /** 항목의 고유 ID (내용 기반 해시) */
  id: string;
  /** 우선순위 (P1: 긴급, P2: 중요, P3: 개선, OPT: 최적화) */
  priority: 'P1' | 'P2' | 'P3' | 'OPT';
  /** 항목 제목 */
  title: string;
  /** 항목 상세 설명 */
  description: string;
  /** 적용 완료 여부 */
  applied: boolean;
  /** 원본 마크다운 텍스트 */
  rawContent: string;
}

function normalizeMarkdownText(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isAppliedImprovement(rawContent: string): boolean {
  const lower = rawContent.toLowerCase();
  return (
    rawContent.includes(MARKERS.APPLIED_MARKER) ||
    rawContent.includes('✅') ||
    lower.includes('[완료]') ||
    lower.includes('[적용됨]')
  );
}

function isImprovementHashId(value: string): boolean {
  return /^[0-9a-f]{12}$/i.test(value.trim());
}

function isLikelyImprovementIdLine(line: string): boolean {
  const normalized = line.replace(/\*\*/g, '').toLowerCase();
  if (!normalized.includes('id')) return false;

  if (normalized.includes('항목')) return true;
  if (normalized.includes('item')) return true;

  const trimmed = normalized.trim();
  const maybeBlockquote = trimmed.startsWith('>') ? trimmed.slice(1).trim() : trimmed;
  return maybeBlockquote.startsWith('id');
}

function tryExtractImprovementIdFromLine(line: string): string | null {
  const normalized = line.replace(/\*\*/g, '').toLowerCase();
  if (!normalized.includes('id')) return null;

  const codeSpanMatch = line.match(/`([^`]+)`/);
  if (codeSpanMatch && isImprovementHashId(codeSpanMatch[1])) {
    return codeSpanMatch[1].toLowerCase();
  }

  const rawMatch = line.match(/([0-9a-f]{12})/i);
  if (rawMatch && isImprovementHashId(rawMatch[1])) {
    return rawMatch[1].toLowerCase();
  }

  return null;
}

function extractImprovementIdAndCleanBody(bodyLines: string[]): {
  id: string | null;
  body: string;
} {
  for (let index = 0; index < bodyLines.length; index++) {
    const line = bodyLines[index];
    if (!isLikelyImprovementIdLine(line)) continue;

    const id = tryExtractImprovementIdFromLine(line);

    const cleanedLines = bodyLines.filter((_, i) => i !== index);
    return { id, body: cleanedLines.join('\n').trim() };
  }

  return { id: null, body: bodyLines.join('\n').trim() };
}

type ImprovementPriority = 'P1' | 'P2' | 'P3';

function parsePriorityItemHeaderLine(
  line: string
): { priority: ImprovementPriority; title: string } | null {
  const trimmed = line.trim();

  const headingMatch = trimmed.match(/^#{2,4}\s*\[?(P[123])(?:-\d+)?\]?\s*(.+)$/i);
  if (headingMatch) {
    return {
      priority: headingMatch[1].toUpperCase() as ImprovementPriority,
      title: headingMatch[2].trim(),
    };
  }

  const bulletMatch = trimmed.match(/^-+\s*\[?(P[123])(?:-\d+)?\]?\s*(.+)$/i);
  if (bulletMatch) {
    return {
      priority: bulletMatch[1].toUpperCase() as ImprovementPriority,
      title: bulletMatch[2].trim(),
    };
  }

  return null;
}

function parseOptimizationItemHeaderLine(line: string): { title: string } | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^#{2,4}\s*[🚀⚙️]\s*([^\n(]+?)\s*\(OPT-\d+\)[^\n]*$/i);
  if (!match) return null;
  return { title: match[1].trim() };
}

function isHorizontalRuleLine(line: string): boolean {
  return line.trim() === '---';
}

function isHeadingLine(line: string): boolean {
  return /^#{2,4}\s+/.test(line.trim());
}

function parseImprovementItemsFromText(source: string): ParsedImprovementItem[] {
  const lines = source.split('\n');
  const items: ParsedImprovementItem[] = [];

  let i = 0;
  while (i < lines.length) {
    const headerLine = lines[i];
    const priorityHeader = parsePriorityItemHeaderLine(headerLine);
    const optHeader = parseOptimizationItemHeaderLine(headerLine);

    if (!priorityHeader && !optHeader) {
      i++;
      continue;
    }

    const startIndex = i;
    i++;

    while (i < lines.length) {
      const nextLine = lines[i];
      if (parsePriorityItemHeaderLine(nextLine) || parseOptimizationItemHeaderLine(nextLine)) {
        break;
      }

      if (isHorizontalRuleLine(nextLine)) {
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') {
          j++;
        }
        if (j < lines.length && isHeadingLine(lines[j])) {
          break;
        }
      }

      i++;
    }

    const rawContent = lines.slice(startIndex, i).join('\n').trim();
    const { id: explicitId, body } = extractImprovementIdAndCleanBody(
      lines.slice(startIndex + 1, i)
    );
    const applied = isAppliedImprovement(rawContent);

    if (priorityHeader) {
      const id = explicitId ?? generateImprovementId(priorityHeader.title, body);
      items.push({
        id,
        priority: priorityHeader.priority,
        title: priorityHeader.title,
        description: body,
        applied,
        rawContent,
      });
      continue;
    }

    if (optHeader) {
      const id = explicitId ?? generateImprovementId(optHeader.title, body);
      items.push({
        id,
        priority: 'OPT',
        title: optHeader.title,
        description: body,
        applied,
        rawContent,
      });
      continue;
    }
  }

  return items;
}

/**
 * 마크다운 내용에서 개선 항목 목록을 파싱합니다.
 *
 * @description `### [P1] 제목` 또는 `- [P1] 제목` 형식의 개선 항목을 파싱하여
 * 구조화된 배열로 반환합니다. 적용 완료 마커가 있는 항목은 `applied: true`로 표시됩니다.
 *
 * @param content - 파싱할 마크다운 문자열
 * @returns 파싱된 개선 항목 배열
 *
 * @example
 * ```typescript
 * const content = `
 * ### [P2] 테스트 추가
 *
 * 단위 테스트를 추가합니다.
 * `;
 * const items = parseImprovementItems(content);
 * // items: [{ id: '...', priority: 'P2', title: '테스트 추가', ... }]
 * ```
 */
export function parseImprovementItems(content: string): ParsedImprovementItem[] {
  const normalized = normalizeMarkdownText(content);

  const blocks: string[] = [];
  const improvementListBlock = extractBetweenMarkers(
    normalized,
    MARKERS.IMPROVEMENT_LIST_START,
    MARKERS.IMPROVEMENT_LIST_END
  );
  if (improvementListBlock !== null) blocks.push(improvementListBlock);

  const optimizationBlock = extractBetweenMarkers(
    normalized,
    MARKERS.OPTIMIZATION_START,
    MARKERS.OPTIMIZATION_END
  );
  if (optimizationBlock !== null) blocks.push(optimizationBlock);

  const source = blocks.length > 0 ? blocks.join('\n\n') : normalized;
  return parseImprovementItemsFromText(source);
}

/**
 * 적용된 항목을 필터링하여 미적용 개선 항목만 포함하는 보고서를 생성합니다.
 *
 * @description 개선 보고서에서 이미 적용된 항목들을 제거하고,
 * 우선순위별로 그룹화된 미적용 항목만 포함하는 마크다운 문자열을 반환합니다.
 *
 * @param content - 원본 개선 보고서 마크다운 내용
 * @param appliedIds - 적용 완료된 항목 ID들의 Set
 * @returns 미적용 항목만 포함된 마크다운 문자열
 *
 * @example
 * ```typescript
 * const appliedIds = new Set(['abc123', 'def456']);
 * const filtered = filterAppliedImprovements(reportContent, appliedIds);
 * ```
 */
export function filterAppliedImprovements(content: string, appliedIds: Set<string>): string {
  const items = parseImprovementItems(content);

  // 적용되지 않은 항목만 필터링
  const pendingItems = items.filter(item => !appliedIds.has(item.id) && !item.applied);

  if (pendingItems.length === 0) {
    return '모든 개선 항목이 적용되었습니다! 🎉';
  }

  // 우선순위별 그룹화
  const byPriority: Record<string, ParsedImprovementItem[]> = {
    P1: [],
    P2: [],
    P3: [],
    OPT: [],
  };

  for (const item of pendingItems) {
    if (byPriority[item.priority]) {
      byPriority[item.priority].push(item);
    }
  }

  const lines: string[] = [];

  for (const priority of ['P1', 'P2', 'P3', 'OPT'] as const) {
    const priorityItems = byPriority[priority];
    if (priorityItems.length > 0) {
      lines.push(`\n## ${getPriorityLabel(priority)} (${priorityItems.length}개)`);
      lines.push('');

      for (const item of priorityItems) {
        lines.push(`### [${priority}] ${item.title}`);
        lines.push('');
        lines.push(item.description);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * 개선 항목을 AI 에이전트에 붙여넣기 가능한 프롬프트 형식으로 포맷합니다.
 *
 * @description 개선 항목의 제목, 설명, 우선순위, ID를 포함한
 * 복사-붙여넣기 가능한 프롬프트 문자열을 생성합니다.
 *
 * @param item - 파싱된 개선 항목 객체
 * @returns AI 에이전트용 프롬프트 문자열
 *
 * @example
 * ```typescript
 * const item: ParsedImprovementItem = { ... };
 * const prompt = formatImprovementAsPrompt(item);
 * // Copilot Chat에 붙여넣기 가능한 형식
 * ```
 */
export function formatImprovementAsPrompt(item: ParsedImprovementItem): string {
  return `## ${item.title}

${item.description}

---
우선순위: ${item.priority}
항목 ID: ${item.id}

위 개선 사항을 현재 프로젝트에 적용해주세요.`;
}

function getPriorityLabel(priority: 'P1' | 'P2' | 'P3' | 'OPT'): string {
  switch (priority) {
    case 'P1':
      return '🔴 긴급 (P1)';
    case 'P2':
      return '🟡 중요 (P2)';
    case 'P3':
      return '🟢 개선 (P3)';
    case 'OPT':
      return '🚀 최적화 (OPT)';
  }
}

