import { describe, it, expect } from 'vitest';
import { decideRealtimeWatcherAction } from '../realtimeWatcherDecision.js';

describe('decideRealtimeWatcherAction', () => {
  it('returns start when enabling', () => {
    expect(
      decideRealtimeWatcherAction(
        { enabled: false, debounceMs: 1500 },
        { enabled: true, debounceMs: 1500 }
      )
    ).toBe('start');
  });

  it('returns stop when disabling', () => {
    expect(
      decideRealtimeWatcherAction(
        { enabled: true, debounceMs: 1500 },
        { enabled: false, debounceMs: 1500 }
      )
    ).toBe('stop');
  });

  it('returns restart when debounce changes while enabled', () => {
    expect(
      decideRealtimeWatcherAction(
        { enabled: true, debounceMs: 1500 },
        { enabled: true, debounceMs: 3000 }
      )
    ).toBe('restart');
  });

  it('returns noop when nothing changes', () => {
    expect(
      decideRealtimeWatcherAction(
        { enabled: true, debounceMs: 1500 },
        { enabled: true, debounceMs: 1500 }
      )
    ).toBe('noop');

    expect(
      decideRealtimeWatcherAction(
        { enabled: false, debounceMs: 1500 },
        { enabled: false, debounceMs: 3000 }
      )
    ).toBe('noop');
  });
});
