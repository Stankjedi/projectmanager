/**
 * Markdown Utilities
 * 
 * @description 마크다운 섹션 파싱, 삽입, 수정을 위한 유틸리티 함수들을 제공합니다.
 * 보고서 파일의 마커 기반 섹션 관리, 개선 항목 파싱, 점수 테이블 생성 등의 기능을 포함합니다.
 * 
 * @module markdownUtils
 */

import * as crypto from 'crypto';
import type { ProjectEvaluationScores, EvaluationScore, ScoreGrade, EvaluationCategory } from '../models/types.js';
import { EVALUATION_CATEGORY_LABELS } from '../models/types.js';

/**
 * 보고서 섹션 구분을 위한 마커 상수
 * 
 * @description 마크다운 파일 내에서 자동 업데이트 영역을 구분하기 위한 HTML 주석 마커입니다.
 * 
 * @example
 * ```markdown
 * <!-- AUTO-SUMMARY-START -->
 * 이 영역은 자동으로 업데이트됩니다.
 * <!-- AUTO-SUMMARY-END -->
 * ```
 */
export const MARKERS = {
  /** 세션 로그 시작 마커 */
  SESSION_LOG_START: '<!-- AUTO-SESSION-LOG-START -->',
  /** 세션 로그 종료 마커 */
  SESSION_LOG_END: '<!-- AUTO-SESSION-LOG-END -->',
  /** 요약 섹션 시작 마커 */
  SUMMARY_START: '<!-- AUTO-SUMMARY-START -->',
  /** 요약 섹션 종료 마커 */
  SUMMARY_END: '<!-- AUTO-SUMMARY-END -->',
  /** 개선 항목 목록 시작 마커 */
  IMPROVEMENT_LIST_START: '<!-- AUTO-IMPROVEMENT-LIST-START -->',
  /** 개선 항목 목록 종료 마커 */
  IMPROVEMENT_LIST_END: '<!-- AUTO-IMPROVEMENT-LIST-END -->',
  /** 기능 추가 목록 시작 마커 */
  FEATURE_LIST_START: '<!-- AUTO-FEATURE-LIST-START -->',
  /** 기능 추가 목록 종료 마커 */
  FEATURE_LIST_END: '<!-- AUTO-FEATURE-LIST-END -->',
  /** 최적화 항목 시작 마커 */
  OPTIMIZATION_START: '<!-- AUTO-OPTIMIZATION-START -->',
  /** 최적화 항목 종료 마커 */
  OPTIMIZATION_END: '<!-- AUTO-OPTIMIZATION-END -->',
  /** 점수 섹션 시작 마커 */
  SCORE_START: '<!-- AUTO-SCORE-START -->',
  /** 점수 섹션 종료 마커 */
  SCORE_END: '<!-- AUTO-SCORE-END -->',
  /** 프로젝트 개요 시작 마커 */
  OVERVIEW_START: '<!-- AUTO-OVERVIEW-START -->',
  /** 프로젝트 개요 종료 마커 */
  OVERVIEW_END: '<!-- AUTO-OVERVIEW-END -->',
  /** 적용 완료된 항목 표시 마커 */
  APPLIED_MARKER: '<!-- APPLIED -->',
} as const;

/**
 * 마커 사이의 내용을 추출합니다.
 * 
 * @description 시작 마커와 종료 마커 사이에 있는 텍스트 내용을 추출합니다.
 * 마커가 없거나 순서가 잘못된 경우 null을 반환합니다.
 * 
 * @param content - 검색할 전체 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @returns 마커 사이의 내용 (trim 적용) 또는 마커가 없으면 null
 * 
 * @example
 * ```typescript
 * const content = '<!-- START -->Hello World<!-- END -->';
 * const result = extractBetweenMarkers(content, '<!-- START -->', '<!-- END -->');
 * // result: 'Hello World'
 * ```
 */
export function extractBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string
): string | null {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return null;
  }

  return content.substring(
    startIndex + startMarker.length,
    endIndex
  ).trim();
}

/**
 * 마커 사이의 내용을 새로운 내용으로 교체합니다.
 * 
 * @description 시작 마커와 종료 마커 사이의 기존 내용을 새 내용으로 완전히 교체합니다.
 * 마커가 없으면 파일 끝에 마커와 함께 내용을 추가합니다.
 * 
 * @param content - 원본 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @param newContent - 교체할 새 내용
 * @returns 마커 사이 내용이 교체된 문자열
 * 
 * @example
 * ```typescript
 * const content = '<!-- START -->Old<!-- END -->';
 * const result = replaceBetweenMarkers(content, '<!-- START -->', '<!-- END -->', 'New');
 * // result: '<!-- START -->\nNew\n<!-- END -->'
 * ```
 */
export function replaceBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    // 마커가 없으면 내용 끝에 마커와 함께 추가
    return content + '\n\n' + startMarker + '\n' + newContent + '\n' + endMarker;
  }

  const before = content.substring(0, startIndex + startMarker.length);
  const after = content.substring(endIndex);

  return before + '\n' + newContent + '\n' + after;
}

/**
 * 마커 사이에 내용을 추가합니다 (기존 내용 뒤에 append).
 * 
 * @description 시작 마커와 종료 마커 사이의 기존 내용 뒤에 새 내용을 추가합니다.
 * 마커가 없으면 새로 생성합니다.
 * 
 * @param content - 원본 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @param newContent - 추가할 새 내용
 * @returns 내용이 추가된 문자열
 * 
 * @example
 * ```typescript
 * const content = '<!-- START -->First<!-- END -->';
 * const result = appendBetweenMarkers(content, '<!-- START -->', '<!-- END -->', 'Second');
 * // result: '<!-- START -->\nFirst\n\nSecond\n<!-- END -->'
 * ```
 */
export function appendBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const existing = extractBetweenMarkers(content, startMarker, endMarker);
  
  if (existing === null) {
    // 마커가 없으면 새로 생성
    return content + '\n\n' + startMarker + '\n' + newContent + '\n' + endMarker;
  }

  const combined = existing + '\n\n' + newContent;
  return replaceBetweenMarkers(content, startMarker, endMarker, combined);
}

/**
 * 마커 사이에 내용을 앞에 추가합니다 (기존 내용 앞에 prepend).
 * 
 * @description 시작 마커와 종료 마커 사이의 기존 내용 앞에 새 내용을 추가합니다.
 * 새 세션 로그를 맨 위에 추가할 때 유용합니다.
 * 
 * @param content - 원본 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @param newContent - 앞에 추가할 새 내용
 * @returns 내용이 앞에 추가된 문자열
 * 
 * @example
 * ```typescript
 * const content = '<!-- START -->Old Entry<!-- END -->';
 * const result = prependBetweenMarkers(content, '<!-- START -->', '<!-- END -->', 'New Entry');
 * // result: '<!-- START -->\nNew Entry\n\nOld Entry\n<!-- END -->'
 * ```
 */
export function prependBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const existing = extractBetweenMarkers(content, startMarker, endMarker);
  
  if (existing === null) {
    return content + '\n\n' + startMarker + '\n' + newContent + '\n' + endMarker;
  }

  const combined = newContent + '\n\n' + existing;
  return replaceBetweenMarkers(content, startMarker, endMarker, combined);
}

/**
 * 세션 로그 엔트리를 생성합니다.
 * 
 * @description 타임스탬프, 사용자 프롬프트, 변경사항, AI 응답을 포함한
 * 마크다운 형식의 세션 로그 엔트리를 생성합니다.
 * 
 * @param timestamp - ISO 8601 형식의 타임스탬프
 * @param userPrompt - 사용자가 입력한 요약 또는 프롬프트
 * @param changesSummary - 변경사항 요약 문자열
 * @param aiContent - AI 분석 결과 내용
 * @returns 마크다운 형식의 세션 로그 엔트리
 * 
 * @example
 * ```typescript
 * const entry = createSessionLogEntry(
 *   '2025-01-01T12:00:00Z',
 *   '보고서 업데이트',
 *   '새 파일 2개 추가',
 *   '코드 품질이 향상되었습니다.'
 * );
 * ```
 */
export function createSessionLogEntry(
  timestamp: string,
  userPrompt: string,
  changesSummary: string,
  aiContent: string
): string {
  const date = new Date(timestamp);
  const formattedDate = formatDateTimeKorean(date);

  return `### 📋 [${formattedDate}] 세션

**사용자 요약:**
> ${userPrompt}

**변경 사항:**
${changesSummary}

**분석 결과:**
${aiContent}

---`;
}

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

/**
 * 파싱된 개선 항목 인터페이스
 * 
 * @description 마크다운에서 파싱된 개선 항목의 구조를 정의합니다.
 */
export interface ParsedImprovementItem {
  /** 항목의 고유 ID (내용 기반 해시) */
  id: string;
  /** 우선순위 (P1: 긴급, P2: 중요, P3: 개선) */
  priority: 'P1' | 'P2' | 'P3';
  /** 항목 제목 */
  title: string;
  /** 항목 상세 설명 */
  description: string;
  /** 적용 완료 여부 */
  applied: boolean;
  /** 원본 마크다운 텍스트 */
  rawContent: string;
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
  const items: ParsedImprovementItem[] = [];
  
  // 패턴: ### [P1] 제목 또는 - [P1] 제목
  const itemPattern = /(?:###|-)\s*\[?(P[123])\]?\s*([^\n]+)\n([\s\S]*?)(?=(?:###|-)\s*\[?P[123]\]?|$)/gi;
  
  let match;
  while ((match = itemPattern.exec(content)) !== null) {
    const priority = match[1].toUpperCase() as 'P1' | 'P2' | 'P3';
    const title = match[2].trim();
    const description = match[3].trim();
    const rawContent = match[0];
    
    // 적용됨 마커 확인
    const applied = rawContent.includes(MARKERS.APPLIED_MARKER) || 
                   rawContent.includes('✅') ||
                   rawContent.toLowerCase().includes('[완료]') ||
                   rawContent.toLowerCase().includes('[적용됨]');
    
    const id = generateImprovementId(title, description);
    
    items.push({
      id,
      priority,
      title,
      description,
      applied,
      rawContent,
    });
  }

  return items;
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
export function filterAppliedImprovements(
  content: string,
  appliedIds: Set<string>
): string {
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
  };

  for (const item of pendingItems) {
    byPriority[item.priority].push(item);
  }

  const lines: string[] = [];
  
  for (const priority of ['P1', 'P2', 'P3'] as const) {
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

/**
 * 우선순위 코드를 한국어 라벨로 변환합니다.
 * 
 * @param priority - P1, P2, P3 중 하나
 * @returns 이모지와 한글이 포함된 우선순위 라벨
 */
function getPriorityLabel(priority: 'P1' | 'P2' | 'P3'): string {
  switch (priority) {
    case 'P1':
      return '🔴 긴급 (P1)';
    case 'P2':
      return '🟡 중요 (P2)';
    case 'P3':
      return '🟢 개선 (P3)';
  }
}

/**
 * Date 객체를 한국어 형식의 날짜/시간 문자열로 포맷합니다.
 * 
 * @description 시스템 로컬 시간을 사용하여 'YYYY-MM-DD HH:mm' 형식으로 변환합니다.
 * 
 * @param date - 포맷할 Date 객체
 * @returns 'YYYY-MM-DD HH:mm' 형식의 문자열
 * 
 * @example
 * ```typescript
 * const formatted = formatDateTimeKorean(new Date());
 * // formatted: '2025-01-01 14:30'
 * ```
 */
export function formatDateTimeKorean(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * ISO 8601 타임스탬프를 상대적 시간 표현으로 변환합니다.
 * 
 * @description '방금 전', 'N분 전', 'N시간 전', 'N일 전' 형식으로 변환합니다.
 * 7일 이상인 경우 절대 날짜/시간을 반환합니다.
 * 
 * @param timestamp - ISO 8601 형식의 타임스탬프 문자열
 * @returns 상대적 시간 표현 문자열
 * 
 * @example
 * ```typescript
 * formatRelativeTime('2025-01-01T12:00:00Z');
 * // '2시간 전' 또는 '3일 전' 등
 * ```
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return '방금 전';
  } else if (diffMins < 60) {
    return `${diffMins}분 전`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전`;
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return formatDateTimeKorean(date);
  }
}

/**
 * 마크다운 문자열에서 코드 블록을 추출합니다.
 * 
 * @description 백틱 3개로 감싸진 코드 블록을 모두 찾아서
 * 언어와 코드 내용을 포함하는 배열로 반환합니다.
 * 
 * @param content - 파싱할 마크다운 문자열
 * @returns 언어와 코드를 포함하는 객체 배열
 * 
 * @example
 * ```typescript
 * const blocks = extractCodeBlocks('```typescript\nconst x = 1;\n```');
 * // blocks: [{ language: 'typescript', code: 'const x = 1;' }]
 * ```
 */
export function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const pattern = /```(\w*)\n([\s\S]*?)```/g;
  
  let match;
  while ((match = pattern.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  return blocks;
}

/**
 * 마크다운 문자열에서 모든 헤더를 추출합니다.
 * 
 * @description #으로 시작하는 모든 마크다운 헤더를 찾아서
 * 레벨, 텍스트, 라인 번호를 포함하는 배열로 반환합니다.
 * 
 * @param content - 파싱할 마크다운 문자열
 * @returns 헤더 정보 객체 배열 (레벨 1-6, 텍스트, 라인 번호)
 * 
 * @example
 * ```typescript
 * const headers = extractHeaders('# Title\n## Subtitle');
 * // headers: [
 * //   { level: 1, text: 'Title', line: 1 },
 * //   { level: 2, text: 'Subtitle', line: 2 }
 * // ]
 * ```
 */
export function extractHeaders(content: string): Array<{ level: number; text: string; line: number }> {
  const headers: Array<{ level: number; text: string; line: number }> = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headers.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return headers;
}

/**
 * 특정 헤더부터 다음 동일/상위 레벨 헤더까지의 섹션을 추출합니다.
 * 
 * @description 지정된 헤더 텍스트와 레벨을 가진 섹션을 찾아서
 * 해당 헤더부터 다음 동일 또는 상위 레벨 헤더 직전까지의 내용을 반환합니다.
 * 
 * @param content - 검색할 마크다운 문자열
 * @param headerText - 찾을 헤더 텍스트
 * @param headerLevel - 헤더 레벨 (1-6)
 * @returns 추출된 섹션 내용 또는 찾지 못한 경우 null
 * 
 * @example
 * ```typescript
 * const section = extractSection(content, '설치 방법', 2);
 * // ## 설치 방법 부터 다음 ## 헤더 전까지의 내용
 * ```
 */
export function extractSection(
  content: string,
  headerText: string,
  headerLevel: number
): string | null {
  const lines = content.split('\n');
  const headerPattern = new RegExp(`^#{${headerLevel}}\\s+${escapeRegex(headerText)}\\s*$`);
  
  let startLine = -1;
  let endLine = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i])) {
      startLine = i;
      continue;
    }
    
    if (startLine !== -1) {
      // 동일하거나 상위 레벨의 헤더를 찾으면 종료
      const nextHeaderMatch = lines[i].match(/^(#{1,6})\s+/);
      if (nextHeaderMatch && nextHeaderMatch[1].length <= headerLevel) {
        endLine = i;
        break;
      }
    }
  }

  if (startLine === -1) {
    return null;
  }

  return lines.slice(startLine, endLine).join('\n').trim();
}

/**
 * 정규식에서 특수 문자를 이스케이프합니다.
 * 
 * @param str - 이스케이프할 문자열
 * @returns 정규식 안전한 문자열
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 마크다운 테이블을 생성합니다.
 * 
 * @description 헤더 배열과 행 데이터 배열을 받아서
 * 파이프로 구분된 마크다운 테이블 문자열을 생성합니다.
 * 
 * @param headers - 테이블 헤더 문자열 배열
 * @param rows - 각 행의 셀 데이터 배열의 배열
 * @returns 마크다운 테이블 문자열
 * 
 * @example
 * ```typescript
 * const table = createMarkdownTable(
 *   ['이름', '나이'],
 *   [['홍길동', '30'], ['김철수', '25']]
 * );
 * // | 이름 | 나이 |
 * // | --- | --- |
 * // | 홍길동 | 30 |
 * // | 김철수 | 25 |
 * ```
 */
export function createMarkdownTable(
  headers: string[],
  rows: string[][]
): string {
  const headerRow = '| ' + headers.join(' | ') + ' |';
  const separator = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const dataRows = rows.map(row => '| ' + row.join(' | ') + ' |');

  return [headerRow, separator, ...dataRows].join('\n');
}

/**
 * 마크다운 체크리스트를 생성합니다.
 * 
 * @description 텍스트와 체크 상태를 가진 아이템 배열을 받아서
 * GitHub Flavored Markdown 체크리스트 형식으로 변환합니다.
 * 
 * @param items - 텍스트와 체크 상태를 가진 아이템 배열
 * @returns 마크다운 체크리스트 문자열
 * 
 * @example
 * ```typescript
 * const checklist = createChecklist([
 *   { text: '완료된 작업', checked: true },
 *   { text: '미완료 작업', checked: false }
 * ]);
 * // - [x] 완료된 작업
 * // - [ ] 미완료 작업
 * ```
 */
export function createChecklist(items: Array<{ text: string; checked: boolean }>): string {
  return items
    .map(item => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}

/**
 * HTML details/summary 태그를 사용한 접기 가능한 섹션을 생성합니다.
 * 
 * @description GitHub에서 지원하는 접기 가능한 섹션 HTML을 생성합니다.
 * 기본적으로 접힌 상태로 표시되며, 클릭하여 펼칠 수 있습니다.
 * 
 * @param summary - 접힌 상태에서 표시될 제목
 * @param content - 펼쳤을 때 표시될 내용
 * @returns HTML details 요소 문자열
 * 
 * @example
 * ```typescript
 * const collapsible = createCollapsible('자세한 내용', '여기에 상세 정보...');
 * // <details>
 * // <summary>자세한 내용</summary>
 * // 여기에 상세 정보...
 * // </details>
 * ```
 */
export function createCollapsible(summary: string, content: string): string {
  return `<details>
<summary>${summary}</summary>

${content}

</details>`;
}

// ===== 점수 평가 관련 유틸리티 =====

/**
 * 숫자 점수를 학점 등급으로 변환합니다.
 * 
 * @description 100점 만점 기준으로 A+부터 F까지의 등급을 반환합니다.
 * - A+: 97-100, A: 93-96, A-: 90-92
 * - B+: 87-89, B: 83-86, B-: 80-82
 * - C+: 77-79, C: 73-76, C-: 70-72
 * - D+: 67-69, D: 63-66, D-: 60-62
 * - F: 0-59
 * 
 * @param score - 0-100 사이의 점수
 * @returns 등급 문자열 (A+, A, A-, B+, ..., F)
 * 
 * @example
 * ```typescript
 * scoreToGrade(95); // 'A'
 * scoreToGrade(85); // 'B'
 * scoreToGrade(55); // 'F'
 * ```
 */
export function scoreToGrade(score: number): ScoreGrade {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

/**
 * 점수 변화량을 화살표와 함께 포맷합니다.
 * 
 * @description 양수면 ⬆️ +N, 음수면 ⬇️ -N, 0이거나 undefined면 '-'를 반환합니다.
 * 
 * @param change - 이전 대비 변화량 (양수/음수/undefined)
 * @returns 화살표와 숫자가 포함된 문자열
 * 
 * @example
 * ```typescript
 * formatScoreChange(5);  // '⬆️ +5'
 * formatScoreChange(-3); // '⬇️ -3'
 * formatScoreChange(0);  // '-'
 * ```
 */
export function formatScoreChange(change: number | undefined): string {
  if (change === undefined || change === 0) return '-';
  if (change > 0) return `⬆️ +${change}`;
  return `⬇️ ${change}`;
}

/**
 * 등급에 따른 색상 이모지를 반환합니다.
 * 
 * @description A등급은 녹색, B등급은 파란색, C등급은 노란색,
 * D등급은 주황색, F등급은 빨간색 원을 반환합니다.
 * 
 * @param grade - 학점 등급 (A+, A, A-, B+, ..., F)
 * @returns 색상 원 이모지 (🟢, 🔵, 🟡, 🟠, 🔴)
 * 
 * @example
 * ```typescript
 * gradeEmoji('A');  // '🟢'
 * gradeEmoji('B+'); // '🔵'
 * gradeEmoji('F');  // '🔴'
 * ```
 */
export function gradeEmoji(grade: ScoreGrade): string {
  if (grade.startsWith('A')) return '🟢';
  if (grade.startsWith('B')) return '🔵';
  if (grade.startsWith('C')) return '🟡';
  if (grade.startsWith('D')) return '🟠';
  return '🔴';
}

/**
 * 프로젝트 평가 점수를 마크다운 테이블로 포맷합니다.
 * 
 * @description 10개 카테고리(코드 품질, 아키텍처, 보안 등)의 점수와
 * 총점 평균을 포함하는 마크다운 테이블을 생성합니다.
 * 언어 설정에 따라 한국어 또는 영어 라벨을 사용합니다.
 * 
 * @param scores - 프로젝트 평가 점수 객체
 * @param language - 출력 언어 ('ko' | 'en')
 * @returns 마크다운 테이블 문자열
 * 
 * @example
 * ```typescript
 * const table = formatScoreTable(scores, 'ko');
 * // | 항목 | 점수 (100점 만점) | 등급 | 변화 |
 * // | --- | --- | --- | --- |
 * // | **코드 품질** | 85 | 🔵 B | ⬆️ +5 |
 * // ...
 * ```
 */
export function formatScoreTable(
  scores: ProjectEvaluationScores,
  language: 'ko' | 'en'
): string {
  const categories: EvaluationCategory[] = [
    'codeQuality',
    'architecture',
    'security',
    'performance',
    'testCoverage',
    'errorHandling',
    'documentation',
    'scalability',
    'maintainability',
    'productionReadiness',
  ];

  const headers = language === 'ko'
    ? ['항목', '점수 (100점 만점)', '등급', '변화']
    : ['Category', 'Score (out of 100)', 'Grade', 'Change'];

  const rows: string[][] = categories.map(cat => {
    const score = scores[cat];
    const label = EVALUATION_CATEGORY_LABELS[cat][language];
    const emoji = gradeEmoji(score.grade);
    return [
      `**${label}**`,
      String(score.score),
      `${emoji} ${score.grade}`,
      formatScoreChange(score.change),
    ];
  });

  // 총점 행 추가
  const total = scores.totalAverage;
  const totalLabel = language === 'ko' ? '**총점 평균**' : '**Total Average**';
  const totalEmoji = gradeEmoji(total.grade);
  rows.push([
    totalLabel,
    `**${total.score}**`,
    `${totalEmoji} **${total.grade}**`,
    formatScoreChange(total.change),
  ]);

  return createMarkdownTable(headers, rows);
}

/**
 * 여러 카테고리 점수의 평균을 계산합니다.
 * 
 * @description 유효한 점수(0 이상)들의 평균을 계산하고,
 * 이전 점수가 있으면 변화량도 함께 계산합니다.
 * 
 * @param scores - 평가 점수 객체 배열
 * @returns 평균 점수, 등급, 변화량을 포함하는 객체
 * 
 * @example
 * ```typescript
 * const avg = calculateAverageScore([
 *   { score: 80, grade: 'B-' },
 *   { score: 90, grade: 'A-' }
 * ]);
 * // avg: { score: 85, grade: 'B', change: undefined }
 * ```
 */
export function calculateAverageScore(scores: EvaluationScore[]): EvaluationScore {
  const validScores = scores.filter(s => s.score >= 0);
  if (validScores.length === 0) {
    return { score: 0, grade: 'F' };
  }

  const avg = Math.round(
    validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length
  );

  // 이전 점수가 있으면 변화량 계산
  const prevScores = validScores.filter(s => s.previousScore !== undefined);
  let change: number | undefined;
  if (prevScores.length > 0) {
    const prevAvg = Math.round(
      prevScores.reduce((sum, s) => sum + (s.previousScore || 0), 0) / prevScores.length
    );
    change = avg - prevAvg;
  }

  return {
    score: avg,
    grade: scoreToGrade(avg),
    change,
  };
}

/**
 * 모든 카테고리가 0점인 기본 점수 객체를 생성합니다.
 * 
 * @description 10개 평가 카테고리와 총점 평균 모두 0점/F등급으로 초기화된
 * ProjectEvaluationScores 객체를 반환합니다. 초기화 또는 파싱 실패 시 사용됩니다.
 * 
 * @returns 기본값으로 초기화된 평가 점수 객체
 * 
 * @example
 * ```typescript
 * const defaultScores = createDefaultScores();
 * // 모든 카테고리가 { score: 0, grade: 'F' }
 * ```
 */
export function createDefaultScores(): ProjectEvaluationScores {
  const defaultScore: EvaluationScore = { score: 0, grade: 'F' };
  return {
    codeQuality: { ...defaultScore },
    architecture: { ...defaultScore },
    security: { ...defaultScore },
    performance: { ...defaultScore },
    testCoverage: { ...defaultScore },
    errorHandling: { ...defaultScore },
    documentation: { ...defaultScore },
    scalability: { ...defaultScore },
    maintainability: { ...defaultScore },
    productionReadiness: { ...defaultScore },
    totalAverage: { ...defaultScore },
  };
}

/**
 * AI 응답에서 평가 점수를 파싱합니다.
 * 
 * @description AI가 생성한 텍스트에서 점수 정보를 추출합니다.
 * JSON 코드 블록 또는 마크다운 테이블 형식을 지원합니다.
 * 파싱에 실패하면 null을 반환합니다.
 * 
 * @param content - AI 응답 텍스트
 * @returns 파싱된 점수 객체 또는 파싱 실패 시 null
 * 
 * @example
 * ```typescript
 * // JSON 블록에서 파싱
 * const content = '```json\n{"evaluationScores": {...}}\n```';
 * const scores = parseScoresFromAIResponse(content);
 * 
 * // 또는 마크다운 테이블에서 파싱
 * const tableContent = '| 코드 품질 | 85 | B |';
 * const scores = parseScoresFromAIResponse(tableContent);
 * ```
 */
export function parseScoresFromAIResponse(content: string): ProjectEvaluationScores | null {
  // JSON 블록 파싱 시도
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.evaluationScores) {
        return validateAndNormalizeScores(parsed.evaluationScores);
      }
    } catch {
      // JSON 파싱 실패, 테이블 파싱 시도
    }
  }

  // 마크다운 테이블 파싱 시도
  const tablePattern = /\|\s*\*?\*?(.+?)\*?\*?\s*\|\s*(\d+)\s*\|\s*([A-F][+\-]?)\s*\|/g;
  const scores = createDefaultScores();
  const categoryMap: Record<string, EvaluationCategory> = {
    '코드 품질': 'codeQuality',
    'code quality': 'codeQuality',
    '아키텍처 설계': 'architecture',
    'architecture': 'architecture',
    'architecture design': 'architecture',
    '보안': 'security',
    'security': 'security',
    '성능': 'performance',
    'performance': 'performance',
    '테스트 커버리지': 'testCoverage',
    'test coverage': 'testCoverage',
    '에러 처리': 'errorHandling',
    'error handling': 'errorHandling',
    '문서화': 'documentation',
    'documentation': 'documentation',
    '확장성': 'scalability',
    'scalability': 'scalability',
    '유지보수성': 'maintainability',
    'maintainability': 'maintainability',
    '프로덕션 준비도': 'productionReadiness',
    'production readiness': 'productionReadiness',
  };

  let hasMatch = false;
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    const label = match[1].toLowerCase().trim();
    const score = parseInt(match[2], 10);
    const grade = match[3] as ScoreGrade;

    for (const [key, category] of Object.entries(categoryMap)) {
      if (label.includes(key)) {
        scores[category] = { score, grade };
        hasMatch = true;
        break;
      }
    }
  }

  if (!hasMatch) {
    return null;
  }

  // 총점 계산
  const allScores = [
    scores.codeQuality,
    scores.architecture,
    scores.security,
    scores.performance,
    scores.testCoverage,
    scores.errorHandling,
    scores.documentation,
    scores.scalability,
    scores.maintainability,
    scores.productionReadiness,
  ];
  scores.totalAverage = calculateAverageScore(allScores);

  return scores;
}

/**
 * 파싱된 점수 데이터의 유효성을 검사하고 정규화합니다.
 * 
 * @description 점수가 0-100 범위 내에 있는지 확인하고,
 * 누락된 등급은 점수에서 계산합니다. 총점 평균도 자동으로 계산합니다.
 * 
 * @param raw - 원본 파싱 데이터 (any 타입)
 * @returns 정규화된 평가 점수 객체
 */
function validateAndNormalizeScores(raw: any): ProjectEvaluationScores {
  const scores = createDefaultScores();
  const categories: EvaluationCategory[] = [
    'codeQuality', 'architecture', 'security', 'performance',
    'testCoverage', 'errorHandling', 'documentation',
    'scalability', 'maintainability', 'productionReadiness',
  ];

  for (const cat of categories) {
    if (raw[cat] && typeof raw[cat].score === 'number') {
      const score = Math.max(0, Math.min(100, raw[cat].score));
      scores[cat] = {
        score,
        grade: raw[cat].grade || scoreToGrade(score),
        previousScore: raw[cat].previousScore,
        change: raw[cat].change,
      };
    }
  }

  // 총점 계산
  const allScores = categories.map(c => scores[c]);
  scores.totalAverage = calculateAverageScore(allScores);

  return scores;
}

