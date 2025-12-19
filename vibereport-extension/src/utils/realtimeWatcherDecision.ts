export type RealtimeWatcherSettings = {
  enabled: boolean;
  debounceMs: number;
};

export type RealtimeWatcherAction = 'start' | 'stop' | 'restart' | 'noop';

export function decideRealtimeWatcherAction(
  previous: RealtimeWatcherSettings,
  next: RealtimeWatcherSettings
): RealtimeWatcherAction {
  if (previous.enabled !== next.enabled) {
    return next.enabled ? 'start' : 'stop';
  }

  if (!next.enabled) {
    return 'noop';
  }

  if (previous.debounceMs !== next.debounceMs) {
    return 'restart';
  }

  return 'noop';
}
