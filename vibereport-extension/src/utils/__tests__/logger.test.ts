import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, LogLevel } from '../logger.js';

const createOutputChannel = () => ({
  appendLine: vi.fn(),
  show: vi.fn(),
});

describe('logger', () => {
  beforeEach(() => {
    const outputChannel = createOutputChannel();
    logger.initialize(outputChannel as any);
    logger.setLevel(LogLevel.INFO);
    vi.clearAllMocks();
  });

  it('writes debug when level allows it', () => {
    const outputChannel = createOutputChannel();
    logger.initialize(outputChannel as any);
    logger.setLevel(LogLevel.DEBUG);

    logger.debug('UnitTest', 'debug message');

    expect(outputChannel.appendLine).toHaveBeenCalledTimes(1);
    expect(outputChannel.appendLine.mock.calls[0][0]).toContain('[DEBUG] [UnitTest] debug message');
  });

  it('skips info when level is WARN', () => {
    const outputChannel = createOutputChannel();
    logger.initialize(outputChannel as any);
    logger.setLevel(LogLevel.WARN);

    logger.info('UnitTest', 'info message');

    expect(outputChannel.appendLine).not.toHaveBeenCalled();
  });

  it('writes warn and error at WARN level', () => {
    const outputChannel = createOutputChannel();
    logger.initialize(outputChannel as any);
    logger.setLevel(LogLevel.WARN);

    logger.warn('UnitTest', 'warn message');
    logger.error('UnitTest', 'error message');

    expect(outputChannel.appendLine).toHaveBeenCalledTimes(2);
    expect(outputChannel.appendLine.mock.calls[0][0]).toContain('[WARN] [UnitTest] warn message');
    expect(outputChannel.appendLine.mock.calls[1][0]).toContain('[ERROR] [UnitTest] error message');
  });

  it('includes stack trace when provided', () => {
    const outputChannel = createOutputChannel();
    logger.initialize(outputChannel as any);
    logger.setLevel(LogLevel.ERROR);

    const err = new Error('boom');
    logger.error('UnitTest', 'error message', err);

    expect(outputChannel.appendLine).toHaveBeenCalledTimes(1);
    expect(outputChannel.appendLine.mock.calls[0][0]).toContain('Stack:');
  });

  it('shows the output channel when requested', () => {
    const outputChannel = createOutputChannel();
    logger.initialize(outputChannel as any);

    logger.show();

    expect(outputChannel.show).toHaveBeenCalledTimes(1);
  });
});
