/**
 * ExportReportBundleCommand Unit Tests
 *
 * @description 최신 보고서 + 공유 프리뷰를 폴더 번들로 내보내는 명령 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

const mockSelectWorkspaceRoot = vi.fn();
const mockLoadConfig = vi.fn();
const mockResolveAnalysisRoot = vi.fn();

const mockShowOpenDialog = vi.fn();
const mockShowInformationMessage = vi.fn();
const mockShowErrorMessage = vi.fn();
const mockCreateDirectory = vi.fn();
const mockWriteFile = vi.fn();
const mockGetConfiguration = vi.fn();

vi.mock('vscode', () => ({
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath })),
  },
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfiguration(...args),
    fs: {
      createDirectory: (...args: any[]) => mockCreateDirectory(...args),
      writeFile: (...args: any[]) => mockWriteFile(...args),
    },
  },
  window: {
    showOpenDialog: (...args: any[]) => mockShowOpenDialog(...args),
    showInformationMessage: (...args: any[]) => mockShowInformationMessage(...args),
    showErrorMessage: (...args: any[]) => mockShowErrorMessage(...args),
  },
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('../../utils/index.js', () => ({
  selectWorkspaceRoot: mockSelectWorkspaceRoot,
  loadConfig: mockLoadConfig,
  resolveAnalysisRoot: mockResolveAnalysisRoot,
}));

describe('ExportReportBundleCommand', () => {
  let mockOutputChannel: vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOutputChannel = {
      appendLine: vi.fn(),
      dispose: vi.fn(),
    } as unknown as vscode.OutputChannel;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('writes bundle files and applies redaction to all bundle outputs when enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-02T03:04:05.000Z'));

    mockSelectWorkspaceRoot.mockResolvedValue('/test/workspace');
    mockLoadConfig.mockReturnValue({
      reportDirectory: 'devplan',
      analysisRoot: '',
      snapshotFile: '.vscode/vibereport-state.json',
      language: 'en',
    } as unknown);
    mockResolveAnalysisRoot.mockImplementation((root: string) => root);

    mockShowOpenDialog.mockResolvedValue([{ fsPath: '/exports' }]);
    mockCreateDirectory.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    mockGetConfiguration.mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => {
        if (key === 'sharePreviewRedactionEnabled') return true;
        return defaultValue;
      }),
    });

    const evalContent = [
      '[OpenRef](command:vibereport.openFunctionInFile?foo=bar)',
      '',
      '<!-- TLDR-START -->',
      '| Item | Value |',
      '|------|------|',
      '| **Current Version** | 0.4.28 |',
      '| **Top Risk** | C:\\\\secret\\\\file.ts |',
      '<!-- TLDR-END -->',
      '',
      '<!-- AUTO-SCORE-START -->',
      '| Category | Score | Grade |',
      '| --- | --- | --- |',
      '| Code Quality | 80 | 🔵 B |',
      '| **Total Average** | **83** | 🔵 B |',
      '<!-- AUTO-SCORE-END -->',
    ].join('\n');

    const improvementContent = [
      '# improvement',
      'Absolute path: /Users/alice/secret.txt',
      'Raw command: command:vibereport.openFunctionInFile?x=1',
    ].join('\n');

    const promptContent = ['# prompt', 'Path: /mnt/c/Users/john/secret.txt'].join('\n');

    vi.mocked(fs.readFile).mockImplementation((filePath: any) => {
      const p = String(filePath);
      if (p.endsWith('.vscode/vibereport-state.json')) {
        return Promise.resolve(
          JSON.stringify(
            {
              lastSnapshot: null,
              sessions: [],
              appliedImprovements: [],
              lastUpdated: '2025-01-01T00:00:00.000Z',
              version: 1,
              evaluationHistory: [
                {
                  version: '0.4.28',
                  evaluatedAt: '2025-01-01T00:00:00.000Z',
                  totalScore: 90,
                  grade: 'A-',
                  scoresByCategory: { codeQuality: 85 },
                },
              ],
            },
            null,
            2
          )
        );
      }
      if (p.endsWith('Project_Evaluation_Report.md')) return Promise.resolve(evalContent);
      if (p.endsWith('Project_Improvement_Exploration_Report.md')) return Promise.resolve(improvementContent);
      if (p.endsWith('Prompt.md')) return Promise.resolve(promptContent);
      return Promise.reject(new Error(`unexpected readFile path: ${p}`));
    });

    const { ExportReportBundleCommand } = await import('../exportReportBundle.js');
    const cmd = new ExportReportBundleCommand(mockOutputChannel, '/storage');

    await cmd.execute();

    expect(mockCreateDirectory).toHaveBeenCalledTimes(1);
    const createdUri = mockCreateDirectory.mock.calls[0]?.[0] as { fsPath: string };

    const now = new Date();
    const pad2 = (value: number) => String(value).padStart(2, '0');
    const expectedDir = `/exports/vibereport-bundle-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    expect(createdUri.fsPath).toBe(expectedDir);

    expect(mockWriteFile).toHaveBeenCalledTimes(6);

    const getWrittenText = (suffix: string): string => {
      const call = mockWriteFile.mock.calls.find(c => String((c[0] as any)?.fsPath).endsWith(suffix));
      expect(call, `Expected writeFile call for ${suffix}`).toBeDefined();
      return Buffer.from(call?.[1] as Uint8Array).toString('utf-8');
    };

    const shareText = getWrittenText('Share_Preview.md');
    expect(shareText).toContain('[REDACTED_PATH]');
    expect(shareText).not.toContain('C:\\\\secret\\\\file.ts');
    expect(shareText).not.toContain('](command:');
    expect(shareText).not.toContain('command:vibereport');
    expect(shareText).toContain('Summary (TL;DR)');
    expect(shareText).toContain('Generated on');
    expect(shareText).toContain('> 📦 Version: 0.4.28');
    expect(shareText).toContain('> 🏆 Overall score: **83 (🔵 B)**');
    expect(shareText).not.toContain('점');
    expect(shareText).not.toMatch(/[가-힣]/);

    const evaluationText = getWrittenText('Project_Evaluation_Report.md');
    expect(evaluationText).toContain('[REDACTED_PATH]');
    expect(evaluationText).not.toContain('C:\\\\secret\\\\file.ts');
    expect(evaluationText).not.toContain('](command:');
    expect(evaluationText).not.toContain('command:vibereport');

    const improvementText = getWrittenText('Project_Improvement_Exploration_Report.md');
    expect(improvementText).toContain('[REDACTED_PATH]');
    expect(improvementText).toContain('[REDACTED_COMMAND]');
    expect(improvementText).not.toContain('/Users/alice/secret.txt');
    expect(improvementText).not.toContain('](command:');
    expect(improvementText).not.toContain('command:vibereport');

    const promptText = getWrittenText('Prompt.md');
    expect(promptText).toContain('[REDACTED_PATH]');
    expect(promptText).not.toContain('/mnt/c/Users/john/secret.txt');

    const metadataText = getWrittenText('metadata.json');
    const metadata = JSON.parse(metadataText) as { timestamp: string; redactionEnabled: boolean; workspaceRoot?: string };
    expect(metadata.timestamp).toBe(now.toISOString());
    expect(metadata.redactionEnabled).toBe(true);
    expect(metadata.workspaceRoot).toBe('workspace');

    const historyText = getWrittenText('evaluation-history.json');
    const history = JSON.parse(historyText) as Array<{ version: string; totalScore: number; grade: string }>;
    expect(history).toEqual([{ version: '0.4.28', evaluatedAt: '2025-01-01T00:00:00.000Z', totalScore: 90, grade: 'A-', scoresByCategory: { codeQuality: 85 } }]);

    expect(mockShowInformationMessage).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('shows an error when reports cannot be read', async () => {
    mockSelectWorkspaceRoot.mockResolvedValue('/test/workspace');
    mockLoadConfig.mockReturnValue({ reportDirectory: 'devplan', analysisRoot: '' } as unknown);
    mockResolveAnalysisRoot.mockImplementation((root: string) => root);
    mockShowOpenDialog.mockResolvedValue([{ fsPath: '/exports' }]);

    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const { ExportReportBundleCommand } = await import('../exportReportBundle.js');
    const cmd = new ExportReportBundleCommand(mockOutputChannel, '/storage');

    await cmd.execute();

    expect(mockShowErrorMessage).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
