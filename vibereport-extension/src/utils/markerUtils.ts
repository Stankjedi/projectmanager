/**
 * Marker Utilities
 *
 * @description 마크다운 파일에서 마커 기반 섹션 처리를 위한 저수준 유틸리티입니다.
 * Single Responsibility Principle에 따라 markdownUtils에서 분리되었습니다.
 *
 * @module markerUtils
 */

/**
 * 마커의 라인 범위를 나타내는 인터페이스
 */
export interface MarkerRange {
  /** 시작 마커가 위치한 라인 인덱스 (0-based) */
  start: number;
  /** 종료 마커가 위치한 라인 인덱스 (0-based) */
  end: number;
}

/**
 * 라인 배열에서 마커의 범위를 찾습니다.
 *
 * @description 시작 마커와 종료 마커가 포함된 라인의 인덱스를 찾아 반환합니다.
 * 마커가 없거나 순서가 잘못된 경우 null을 반환합니다.
 *
 * @param lines - 검색할 라인 배열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @returns 마커 범위 또는 null
 *
 * @example
 * ```typescript
 * const lines = ['line1', '<!-- START -->', 'content', '<!-- END -->', 'line5'];
 * const range = findMarkerRange(lines, '<!-- START -->', '<!-- END -->');
 * // range: { start: 1, end: 3 }
 * ```
 */
export function findMarkerRange(
  lines: string[],
  startMarker: string,
  endMarker: string
): MarkerRange | null {
  let start = -1;
  let end = -1;

  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && lines[i].includes(startMarker)) {
      start = i;
    }
    if (lines[i].includes(endMarker)) {
      end = i;
      if (start !== -1) {
        break;
      }
    }
  }

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return { start, end };
}

/**
 * 마커 사이의 내용을 새로운 블록으로 교체합니다. (라인 기반)
 *
 * @description 라인 단위로 마커 사이의 내용을 교체하는 저수준 함수입니다.
 * 마커가 없으면 원본 내용을 그대로 반환합니다.
 *
 * @param content - 원본 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @param newBlock - 교체할 새 블록 (여러 줄 가능)
 * @returns 마커 사이 내용이 교체된 문자열
 *
 * @example
 * ```typescript
 * const content = '<!-- START -->\nold\n<!-- END -->';
 * const result = replaceBetweenMarkersLines(content, '<!-- START -->', '<!-- END -->', 'new content');
 * // result: '<!-- START -->\nnew content\n<!-- END -->'
 * ```
 */
export function replaceBetweenMarkersLines(
  content: string,
  startMarker: string,
  endMarker: string,
  newBlock: string
): string {
  const lines = content.split('\n');
  const range = findMarkerRange(lines, startMarker, endMarker);

  if (!range) {
    return content;
  }

  const before = lines.slice(0, range.start + 1);
  const after = lines.slice(range.end);
  const middle = newBlock.replace(/\r?\n$/, '').split('\n');

  return [...before, ...middle, ...after].join('\n');
}

export interface MarkerReplacementDefinition {
  startMarker: string;
  endMarker: string;
  newBlock: string;
}

/**
 * 여러 마커 구간을 한 번의 라인 split/scan으로 교체합니다.
 *
 * @description 동일 문서에서 여러 섹션을 갱신할 때 `replaceBetweenMarkersLines`를
 * 반복 호출하며 content를 매번 split/scan하는 비용을 줄이기 위한 유틸입니다.
 * 마커가 없는 교체 항목은 무시하며(throw 없음) 나머지만 적용합니다.
 *
 * @param content - 원본 문자열
 * @param replacements - 교체 목록
 * @returns 교체가 적용된 문자열 (마커가 없으면 원본 유지)
 */
export function replaceManyBetweenMarkersLines(
  content: string,
  replacements: MarkerReplacementDefinition[]
): string {
  if (replacements.length === 0) return content;

  const lines = content.split('\n');

  const targets = replacements
    .map(replacement => ({
      replacement,
      range: findMarkerRange(lines, replacement.startMarker, replacement.endMarker),
    }))
    .filter((t): t is { replacement: MarkerReplacementDefinition; range: MarkerRange } =>
      Boolean(t.range)
    )
    .sort((a, b) => b.range.start - a.range.start);

  if (targets.length === 0) return content;

  const nextLines = [...lines];
  for (const { replacement, range } of targets) {
    const middle = replacement.newBlock.replace(/\r?\n$/, '').split('\n');
    const deleteCount = range.end - range.start - 1;
    nextLines.splice(range.start + 1, deleteCount, ...middle);
  }

  return nextLines.join('\n');
}

/**
 * 마커 사이에 내용을 앞에 추가합니다. (prepend)
 *
 * @description 시작 마커 바로 다음에 새 내용을 추가합니다.
 * 마커가 없으면 원본 내용을 그대로 반환합니다.
 *
 * @param content - 원본 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @param newBlock - 추가할 새 블록
 * @returns 내용이 prepend된 문자열
 */
export function prependBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newBlock: string
): string {
  const lines = content.split('\n');
  const range = findMarkerRange(lines, startMarker, endMarker);

  if (!range) {
    return content;
  }

  const before = lines.slice(0, range.start + 1);
  const existingContent = lines.slice(range.start + 1, range.end);
  const after = lines.slice(range.end);
  const newLines = newBlock.replace(/\r?\n$/, '').split('\n');

  return [...before, ...newLines, ...existingContent, ...after].join('\n');
}

/**
 * 마커 사이에 내용을 뒤에 추가합니다. (append)
 *
 * @description 종료 마커 바로 전에 새 내용을 추가합니다.
 * 마커가 없으면 원본 내용을 그대로 반환합니다.
 *
 * @param content - 원본 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @param newBlock - 추가할 새 블록
 * @returns 내용이 append된 문자열
 */
export function appendBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newBlock: string
): string {
  const lines = content.split('\n');
  const range = findMarkerRange(lines, startMarker, endMarker);

  if (!range) {
    return content;
  }

  const before = lines.slice(0, range.start + 1);
  const existingContent = lines.slice(range.start + 1, range.end);
  const after = lines.slice(range.end);
  const newLines = newBlock.replace(/\r?\n$/, '').split('\n');

  return [...before, ...existingContent, ...newLines, ...after].join('\n');
}

/**
 * 마커가 존재하는지 확인합니다.
 *
 * @param content - 검색할 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @returns 마커 쌍이 올바른 순서로 존재하면 true
 */
export function hasMarkers(
  content: string,
  startMarker: string,
  endMarker: string
): boolean {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  return startIndex !== -1 && endIndex !== -1 && startIndex < endIndex;
}

/**
 * 마커 사이의 내용을 추출합니다. (라인 기반)
 *
 * @description 시작 마커와 종료 마커 사이에 있는 라인들을 추출합니다.
 * 마커가 없으면 null을 반환합니다.
 *
 * @param content - 검색할 전체 문자열
 * @param startMarker - 시작 마커 문자열
 * @param endMarker - 종료 마커 문자열
 * @returns 마커 사이의 내용 또는 null
 */
export function extractBetweenMarkersLines(
  content: string,
  startMarker: string,
  endMarker: string
): string | null {
  const lines = content.split('\n');
  const range = findMarkerRange(lines, startMarker, endMarker);

  if (!range) {
    return null;
  }

  const contentLines = lines.slice(range.start + 1, range.end);
  return contentLines.join('\n').trim();
}
