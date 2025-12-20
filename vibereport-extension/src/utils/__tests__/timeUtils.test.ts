import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDuration,
  formatTimestampForUi,
  getTodayDateString,
  isThisWeek,
  isToday,
} from '../timeUtils.js';

describe('formatDuration', () => {
  it('formats seconds branch', () => {
    expect(formatDuration(30_000)).toBe(`30\uCD08`);
  });

  it('formats minutes branch', () => {
    expect(formatDuration(61_000)).toBe(`1\uBD84 1\uCD08`);
  });

  it('formats hours branch', () => {
    expect(formatDuration(3_600_000)).toBe(`1\uC2DC\uAC04 0\uBD84`);
  });

  it('formats days branch', () => {
    expect(formatDuration(86_400_000)).toBe(`1\uC77C 0\uC2DC\uAC04`);
  });
});

describe('date helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 20, 10, 30, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today date string in YYYY-MM-DD', () => {
    expect(getTodayDateString()).toBe('2025-12-20');
  });

  it('detects today vs non-today timestamps', () => {
    const todayIso = new Date(2025, 11, 20, 9, 0, 0).toISOString();
    const yesterdayIso = new Date(2025, 11, 19, 23, 59, 0).toISOString();

    expect(isToday(todayIso)).toBe(true);
    expect(isToday(yesterdayIso)).toBe(false);
  });

  it('detects current week correctly', () => {
    const inWeek = new Date(2025, 11, 18, 12, 0, 0).toISOString();
    const outOfWeek = new Date(2025, 11, 7, 12, 0, 0).toISOString();

    expect(isThisWeek(inWeek)).toBe(true);
    expect(isThisWeek(outOfWeek)).toBe(false);
  });
});

describe('formatTimestampForUi', () => {
  it('formats valid timestamps and returns "-" for invalid input', () => {
    const iso = new Date(2025, 11, 20, 9, 5, 0).toISOString();
    const date = new Date(iso);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;

    expect(formatTimestampForUi(iso)).toBe(expected);
    expect(formatTimestampForUi('not-a-date')).toBe('-');
  });
});
