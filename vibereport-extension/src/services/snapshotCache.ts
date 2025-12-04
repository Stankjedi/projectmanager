/**
 * Snapshot Cache
 *
 * @description 스캔 결과를 메모리에 캐싱하여 연속적인 실행 시 성능을 향상시킵니다.
 * TTL(Time-To-Live) 기반으로 캐시를 자동 만료시킵니다.
 *
 * @module snapshotCache
 */

/**
 * 캐시 엔트리 인터페이스
 */
export interface SnapshotCacheEntry<T> {
  /** 캐시 키 */
  key: string;
  /** 저장된 값 */
  value: T;
  /** 저장 시점 타임스탬프 (ms) */
  timestamp: number;
}

/**
 * 캐시 TTL (밀리초)
 * @default 30000 (30초)
 */
const CACHE_TTL_MS = 30_000;

/**
 * 내부 캐시 저장소
 */
const cache = new Map<string, SnapshotCacheEntry<unknown>>();

/**
 * 캐시에서 값을 가져옵니다.
 *
 * @description TTL이 만료된 경우 null을 반환하고 캐시에서 삭제합니다.
 *
 * @param key - 캐시 키
 * @returns 캐시된 값 또는 null (만료 또는 없음)
 *
 * @example
 * ```typescript
 * const files = getCachedValue<string[]>('file-list:/workspace');
 * if (files) {
 *   console.log('Using cached file list');
 * }
 * ```
 */
export function getCachedValue<T>(key: string): T | null {
  const entry = cache.get(key) as SnapshotCacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * 캐시에 값을 저장합니다.
 *
 * @param key - 캐시 키
 * @param value - 저장할 값
 *
 * @example
 * ```typescript
 * setCachedValue('file-list:/workspace', ['src/index.ts', 'src/utils.ts']);
 * ```
 */
export function setCachedValue<T>(key: string, value: T): void {
  cache.set(key, { key, value, timestamp: Date.now() });
}

/**
 * 특정 키의 캐시를 삭제합니다.
 *
 * @param key - 삭제할 캐시 키
 * @returns 삭제 성공 여부
 */
export function deleteCachedValue(key: string): boolean {
  return cache.delete(key);
}

/**
 * 특정 프리픽스로 시작하는 모든 캐시를 삭제합니다.
 *
 * @description 특정 워크스페이스의 모든 캐시를 삭제할 때 유용합니다.
 *
 * @param prefix - 캐시 키 프리픽스
 * @returns 삭제된 캐시 개수
 *
 * @example
 * ```typescript
 * // 특정 워크스페이스의 모든 캐시 삭제
 * clearCacheByPrefix('file-list:/workspace');
 * ```
 */
export function clearCacheByPrefix(prefix: string): number {
  let count = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * 모든 캐시를 삭제합니다.
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * 캐시 통계를 반환합니다.
 *
 * @returns 캐시 크기와 키 목록
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

/**
 * 만료된 캐시를 정리합니다.
 *
 * @description 주기적으로 호출하여 메모리를 정리할 수 있습니다.
 *
 * @returns 정리된 캐시 개수
 */
export function pruneExpiredCache(): number {
  const now = Date.now();
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * 캐시 키 생성 헬퍼
 *
 * @param type - 캐시 타입 (e.g., 'file-list', 'git-status')
 * @param rootPath - 워크스페이스 루트 경로
 * @param extra - 추가 식별자 (optional)
 * @returns 정규화된 캐시 키
 */
export function createCacheKey(
  type: string,
  rootPath: string,
  extra?: string | number
): string {
  const base = `${type}:${rootPath}`;
  return extra !== undefined ? `${base}:${extra}` : base;
}
