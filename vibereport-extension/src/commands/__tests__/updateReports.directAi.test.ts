import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// updateReportsWorkflow imports SnapshotService, which imports vscode.
vi.mock('vscode', () => ({}));

const baseConfig = {
  reportDirectory: 'devplan',
  snapshotFile: '.vscode/vibereport-state.json',
  enableGitDiff: true,
  excludePatterns: [],
  maxFilesToScan: 5000,
  autoOpenReports: true,
  language: 'ko',
  projectVisionMode: 'auto',
  defaultProjectType: 'auto-detect',
  defaultQualityFocus: 'development',
} as const;

describe('generateAndCopyPrompt - Direct AI branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('copies AI response, then opens it as a Markdown document (enableDirectAi=true)', async () => {
    const { generateAndCopyPrompt } = await import('../updateReportsWorkflow.js');

    const aiService = {
      runAnalysisPrompt: vi.fn().mockResolvedValue('AI_RESPONSE'),
    };

    const ui = {
      withProgress: vi.fn(async (_options, task) => {
        const progress = { report: vi.fn() };
        const token = { isCancellationRequested: false };
        return task(progress, token);
      }),
      clipboardWriteText: vi.fn().mockResolvedValue(undefined),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      openMarkdownDocument: vi.fn().mockResolvedValue(undefined),
    };

    const deps = {
      workspaceScanner: {} as any,
      snapshotService: {} as any,
      reportService: {} as any,
      fs: {} as any,
      aiService,
      ui,
      buildAnalysisPrompt: vi.fn(() => 'PROMPT'),
      log: vi.fn(),
      now: () => new Date('2025-01-01T00:00:00.000Z'),
    } as any;

    const prompt = await generateAndCopyPrompt({
      snapshot: {} as any,
      diff: {} as any,
      state: { appliedImprovements: [] } as any,
      isFirstRun: false,
      config: { ...baseConfig, enableDirectAi: true } as any,
      reportProgress: vi.fn(),
      deps,
    });

    expect(prompt).toBe('PROMPT');
    expect(ui.withProgress).toHaveBeenCalledWith(
      expect.objectContaining({ cancellable: true, title: 'Direct AI analysis' }),
      expect.any(Function)
    );
    expect(aiService.runAnalysisPrompt).toHaveBeenCalledWith(
      'PROMPT',
      expect.objectContaining({ cancellationToken: expect.any(Object) })
    );
    expect(ui.clipboardWriteText).toHaveBeenCalledWith('AI_RESPONSE');
    expect(ui.openMarkdownDocument).toHaveBeenCalledWith('AI_RESPONSE');
    expect(ui.showInformationMessage).not.toHaveBeenCalled();
    expect(ui.showWarningMessage).not.toHaveBeenCalled();
  });

  it('falls back to clipboard prompt and shows a warning when AI is unavailable (enableDirectAi=true)', async () => {
    const { generateAndCopyPrompt } = await import('../updateReportsWorkflow.js');

    const aiService = {
      runAnalysisPrompt: vi.fn().mockResolvedValue(null),
    };

    const ui = {
      withProgress: vi.fn(async (_options, task) => {
        const progress = { report: vi.fn() };
        const token = { isCancellationRequested: false };
        return task(progress, token);
      }),
      clipboardWriteText: vi.fn().mockResolvedValue(undefined),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      openMarkdownDocument: vi.fn().mockResolvedValue(undefined),
    };

    const deps = {
      workspaceScanner: {} as any,
      snapshotService: {} as any,
      reportService: {} as any,
      fs: {} as any,
      aiService,
      ui,
      buildAnalysisPrompt: vi.fn(() => 'PROMPT'),
      log: vi.fn(),
      now: () => new Date('2025-01-01T00:00:00.000Z'),
    } as any;

    const prompt = await generateAndCopyPrompt({
      snapshot: {} as any,
      diff: {} as any,
      state: { appliedImprovements: [] } as any,
      isFirstRun: false,
      config: { ...baseConfig, enableDirectAi: true } as any,
      reportProgress: vi.fn(),
      deps,
    });

    expect(prompt).toBe('PROMPT');
    expect(ui.clipboardWriteText).toHaveBeenCalledWith('PROMPT');
    expect(ui.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Prompt copied to clipboard')
    );
    expect(ui.openMarkdownDocument).not.toHaveBeenCalled();
  });

  it('falls back to clipboard prompt and shows info when Direct AI is cancelled (enableDirectAi=true)', async () => {
    const { generateAndCopyPrompt } = await import('../updateReportsWorkflow.js');

    const aiService = {
      runAnalysisPrompt: vi.fn().mockResolvedValue('AI_RESPONSE'),
    };

    const ui = {
      withProgress: vi.fn(async (_options, task) => {
        const progress = { report: vi.fn() };
        const token = { isCancellationRequested: true };
        return task(progress, token);
      }),
      clipboardWriteText: vi.fn().mockResolvedValue(undefined),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      openMarkdownDocument: vi.fn().mockResolvedValue(undefined),
    };

    const deps = {
      workspaceScanner: {} as any,
      snapshotService: {} as any,
      reportService: {} as any,
      fs: {} as any,
      aiService,
      ui,
      buildAnalysisPrompt: vi.fn(() => 'PROMPT'),
      log: vi.fn(),
      now: () => new Date('2025-01-01T00:00:00.000Z'),
    } as any;

    const prompt = await generateAndCopyPrompt({
      snapshot: {} as any,
      diff: {} as any,
      state: { appliedImprovements: [] } as any,
      isFirstRun: false,
      config: { ...baseConfig, enableDirectAi: true } as any,
      reportProgress: vi.fn(),
      deps,
    });

    expect(prompt).toBe('PROMPT');
    expect(aiService.runAnalysisPrompt).not.toHaveBeenCalled();
    expect(ui.clipboardWriteText).toHaveBeenCalledWith('PROMPT');
    expect(ui.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Direct AI cancelled')
    );
    expect(ui.showWarningMessage).not.toHaveBeenCalled();
    expect(ui.openMarkdownDocument).not.toHaveBeenCalled();
  });

  it('uses clipboard-only workflow when enableDirectAi=false', async () => {
    const { generateAndCopyPrompt } = await import('../updateReportsWorkflow.js');

    const aiService = {
      runAnalysisPrompt: vi.fn().mockResolvedValue('AI_RESPONSE'),
    };

    const ui = {
      withProgress: vi.fn(),
      clipboardWriteText: vi.fn().mockResolvedValue(undefined),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      openMarkdownDocument: vi.fn().mockResolvedValue(undefined),
    };

    const deps = {
      workspaceScanner: {} as any,
      snapshotService: {} as any,
      reportService: {} as any,
      fs: {} as any,
      aiService,
      ui,
      buildAnalysisPrompt: vi.fn(() => 'PROMPT'),
      log: vi.fn(),
      now: () => new Date('2025-01-01T00:00:00.000Z'),
    } as any;

    const prompt = await generateAndCopyPrompt({
      snapshot: {} as any,
      diff: {} as any,
      state: { appliedImprovements: [] } as any,
      isFirstRun: false,
      config: { ...baseConfig, enableDirectAi: false } as any,
      reportProgress: vi.fn(),
      deps,
    });

    expect(prompt).toBe('PROMPT');
    expect(ui.withProgress).not.toHaveBeenCalled();
    expect(aiService.runAnalysisPrompt).not.toHaveBeenCalled();
    expect(ui.clipboardWriteText).toHaveBeenCalledWith('PROMPT');
    expect(ui.openMarkdownDocument).not.toHaveBeenCalled();
  });
});

