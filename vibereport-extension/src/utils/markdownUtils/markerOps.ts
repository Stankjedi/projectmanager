/**
 * Marker-based section utilities.
 *
 * @description Extract, replace, append, and prepend content between start/end markers.
 */

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
  if (startIndex === -1) return null;

  const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex === -1) return null;

  return content
    .substring(startIndex + startMarker.length, endIndex)
    .trim();
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
  const endIndex =
    startIndex === -1
      ? -1
      : content.indexOf(endMarker, startIndex + startMarker.length);

  if (startIndex === -1 || endIndex === -1) {
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

