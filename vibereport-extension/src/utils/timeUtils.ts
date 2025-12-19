/**
 * Time Utilities
 * 시간 관련 유틸리티 함수
 */

/**
 * ISO 타임스탬프 생성
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 타임스탬프를 Date 객체로 변환
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

/**
 * 두 타임스탬프 간의 차이 (밀리초)
 */
export function getTimeDifference(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return endDate.getTime() - startDate.getTime();
}

/**
 * 밀리초를 사람이 읽을 수 있는 형식으로 변환
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}일 ${hours % 24}시간`;
  } else if (hours > 0) {
    return `${hours}시간 ${minutes % 60}분`;
  } else if (minutes > 0) {
    return `${minutes}분 ${seconds % 60}초`;
  } else {
    return `${seconds}초`;
  }
}

/**
 * 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * 주어진 날짜가 오늘인지 확인
 */
export function isToday(timestamp: string): boolean {
  const date = new Date(timestamp);
  const today = new Date();
  
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * 주어진 날짜가 이번 주인지 확인
 */
export function isThisWeek(timestamp: string): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return date >= weekStart && date < weekEnd;
}

/**
 * UI 표시용 타임스탬프 포맷 (YYYY-MM-DD HH:mm)
 * - 로케일 의존(toLocaleString) 없이 고정 포맷을 반환합니다.
 * - 유효하지 않은 입력은 '-'를 반환합니다.
 */
export function formatTimestampForUi(timestampIso: string): string {
  const date = new Date(timestampIso);
  if (Number.isNaN(date.getTime())) return '-';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
