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

  it('writes bundle files and applies redaction to share preview when enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-02T03:04:05.000Z'));

    mockSelectWorkspaceRoot.mockResolvedValue('/test/workspace');
    mockLoadConfig.mockReturnValue({
      reportDirectory: 'devplan',
      analysisRoot: '',
      snapshotFile: '.vscode/vibereport-state.json',
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
      '**현재 버전** | 0.4.28 |',
      '**총점 평균** | **83** | 🔵 B |',
      '',
      '<!-- TLDR-START -->',
      '| **Top Risk** | C:\\\\secret\\\\file.ts |',
      '<!-- TLDR-END -->',
      '',
      '<!-- AUTO-SCORE-START -->',
      '| 항목 | 점수 |',
      '| --- | --- |',
      '| 코드 품질 | 80 |',
      '### 점수-등급 기준표',
    ].join('\n');

    vi.mocked(fs.readFile).mockImplementation((filePath: any) => {
      const p = String(filePath);
      if (p.endsWith('Project_Evaluation_Report.md')) return Promise.resolve(evalContent);
      if (p.endsWith('Project_Improvement_Exploration_Report.md')) return Promise.resolve('# improvement');
      if (p.endsWith('Prompt.md')) return Promise.resolve('# prompt');
      return Promise.reject(new Error(`unexpected readFile path: ${p}`));
    });

    const { ExportReportBundleCommand } = await import('../exportReportBundle.js');
    const cmd = new ExportReportBundleCommand(mockOutputChannel);

    await cmd.execute();

    expect(mockCreateDirectory).toHaveBeenCalledTimes(1);
    const createdUri = mockCreateDirectory.mock.calls[0]?.[0] as { fsPath: string };

    const now = new Date();
    const pad2 = (value: number) => String(value).padStart(2, '0');
    const expectedDir = `/exports/vibereport-bundle-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    expect(createdUri.fsPath).toBe(expectedDir);

    expect(mockWriteFile).toHaveBeenCalledTimes(5);

    const shareCall = mockWriteFile.mock.calls.find(call =>
      String((call[0] as any)?.fsPath).endsWith('Share_Preview.md')
    );
    expect(shareCall).toBeDefined();
    const shareText = Buffer.from(shareCall?.[1] as Uint8Array).toString('utf-8');
    expect(shareText).toContain('[REDACTED_PATH]');
    expect(shareText).not.toContain('C:\\\\secret\\\\file.ts');

    const metadataCall = mockWriteFile.mock.calls.find(call =>
      String((call[0] as any)?.fsPath).endsWith('metadata.json')
    );
    expect(metadataCall).toBeDefined();
    const metadataText = Buffer.from(metadataCall?.[1] as Uint8Array).toString('utf-8');
    const metadata = JSON.parse(metadataText) as { timestamp: string; redactionEnabled: boolean };
    expect(metadata.timestamp).toBe(now.toISOString());
    expect(metadata.redactionEnabled).toBe(true);

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
    const cmd = new ExportReportBundleCommand(mockOutputChannel);

    await cmd.execute();

    expect(mockShowErrorMessage).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
