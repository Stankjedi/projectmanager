/**
 * ShareReportCommand Unit Tests
 *
 * @description 평가 보고서 공유 프리뷰 명령에 대한 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

const mockSelectWorkspaceRoot = vi.fn();
const mockLoadConfig = vi.fn();
const mockResolveAnalysisRoot = vi.fn();

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    })),
  },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createWebviewPanel: vi.fn(),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
  ViewColumn: {
    One: 1,
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock config utils
vi.mock('../../utils/index.js', () => ({
  selectWorkspaceRoot: mockSelectWorkspaceRoot,
  loadConfig: mockLoadConfig,
  resolveAnalysisRoot: mockResolveAnalysisRoot,
}));

describe('ShareReportCommand', () => {
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

  it('writes preview report to clipboard when evaluation report can be read', async () => {
    mockSelectWorkspaceRoot.mockResolvedValue('C:\\test\\workspace');
    mockLoadConfig.mockReturnValue({
      reportDirectory: 'devplan',
      analysisRoot: '',
      snapshotFile: '.vscode/vibereport-state.json',
    } as unknown);
    mockResolveAnalysisRoot.mockImplementation((_root: string) => 'C:\\test\\workspace');

    const evalContent = [
      '**현재 버전** | 0.4.15 |',
      '**총점 평균** | **83** | 🔵 B |',
      '',
      '<!-- TLDR-START -->',
      '| **전체 등급** | 🔵 B |',
      '<!-- TLDR-END -->',
      '',
      '<!-- AUTO-SCORE-START -->',
      '| 항목 | 점수 |',
      '| --- | --- |',
      '| 코드 품질 | 80 |',
      '<!-- AUTO-SCORE-END -->',
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(evalContent);
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);

    const { ShareReportCommand } = await import('../shareReport.js');
    const cmd = new ShareReportCommand(mockOutputChannel);

    await cmd.execute();

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledTimes(1);
    const clipboardText =
      vi.mocked(vscode.env.clipboard.writeText).mock.calls[0]?.[0] ?? '';
    expect(clipboardText).toContain('프로젝트 평가 보고서');
    expect(clipboardText).toContain('83점');
  });

  it('shows an error when evaluation report is missing', async () => {
    mockSelectWorkspaceRoot.mockResolvedValue('C:\\test\\workspace');
    mockLoadConfig.mockReturnValue({ reportDirectory: 'devplan', analysisRoot: '' } as unknown);
    mockResolveAnalysisRoot.mockImplementation((_root: string) => 'C:\\test\\workspace');

    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const { ShareReportCommand } = await import('../shareReport.js');
    const cmd = new ShareReportCommand(mockOutputChannel);

    await cmd.execute();

    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
  });
});
