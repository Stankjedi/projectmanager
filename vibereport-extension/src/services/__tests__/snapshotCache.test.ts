import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearAllCache,
  getCacheStats,
  pruneExpiredCache,
  setCachedValue,
} from '../snapshotCache.js';

describe('snapshotCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    clearAllCache();
  });

  afterEach(() => {
    clearAllCache();
    vi.useRealTimers();
  });

  it('pruneExpiredCache removes entries older than the TTL', () => {
    setCachedValue('a', 1);

    vi.advanceTimersByTime(30_001);

    expect(pruneExpiredCache()).toBe(1);
    expect(getCacheStats().keys).not.toContain('a');
  });

  it('setCachedValue proactively prunes expired entries and keeps new ones', () => {
    setCachedValue('old', 'x');

    vi.advanceTimersByTime(30_001);

    // This write should prune "old" before inserting "new".
    setCachedValue('new', 'y');

    const stats = getCacheStats();
    expect(stats.keys).toEqual(expect.arrayContaining(['new']));
    expect(stats.keys).not.toContain('old');
  });
});

