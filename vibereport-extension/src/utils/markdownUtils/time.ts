/**
 * Time formatting helpers for markdown reports.
 */

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

