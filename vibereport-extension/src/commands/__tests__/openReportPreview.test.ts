/**
 * OpenReportPreviewCommand Unit Tests
 *
 * @description 마크다운 보고서 Mermaid 프리뷰 명령에 대한 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    activeTextEditor: undefined,
    showErrorMessage: vi.fn(),
    createWebviewPanel: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    })),
  },
  Uri: {
    joinPath: vi.fn((base: { fsPath: string }, ...paths: string[]) => ({
      fsPath: [base.fsPath, ...paths].join('/'),
    })),
  },
  ViewColumn: {
    Active: 1,
    Beside: 2,
  },
}));

describe('OpenReportPreviewCommand', () => {
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

  it('creates a webview panel and assigns HTML', async () => {
    const panel = {
      webview: {
        cspSource: 'vscode-webview',
        html: '',
        asWebviewUri: vi.fn((uri: { fsPath?: string }) => ({
          toString: () => `webview:${uri.fsPath ?? ''}`,
        })),
      },
      onDidDispose: vi.fn(),
      dispose: vi.fn(),
      reveal: vi.fn(),
    };

    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);

    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor =
      {
        document: {
          languageId: 'markdown',
          getText: () => '# Report',
          fileName: 'C:\\test\\workspace\\devplan\\Project_Evaluation_Report.md',
        },
      };

    const { OpenReportPreviewCommand } = await import('../openReportPreview.js');
    const cmd = new OpenReportPreviewCommand(
      mockOutputChannel,
      { fsPath: 'C:\\test\\ext' } as unknown as vscode.Uri
    );

    await cmd.execute();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
    expect(panel.webview.html).toContain('<!DOCTYPE html>');
    expect(panel.webview.html).toContain('Content-Security-Policy');
  });

  it('escapes HTML, blocks unsafe hrefs, and tightens CSP/Mermaid security', async () => {
    const panel = {
      webview: {
        cspSource: 'vscode-webview',
        html: '',
        asWebviewUri: vi.fn((uri: { fsPath?: string }) => ({
          toString: () => `webview:${uri.fsPath ?? ''}`,
        })),
      },
      onDidDispose: vi.fn(),
      dispose: vi.fn(),
      reveal: vi.fn(),
    };

    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);

    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor =
      {
        document: {
          languageId: 'markdown',
          getText: () =>
            [
              '# Report',
              '',
              'Hello <script>alert(1)</script>',
              'Inline code: `<script>alert(1)</script>`',
              '',
              '[bad](javascript:alert(1))',
              '[evilQuotes](https://evil.example.com" onmouseover="alert(1))',
              '[evilAngle](https://evil2.example.com/<img src=x onerror=alert(1)>)',
              '[good](https://example.com)',
              '',
              '```mermaid',
              'flowchart LR',
              'A-->B',
              '```',
            ].join('\n'),
          fileName: 'C:\\test\\workspace\\devplan\\Project_Evaluation_Report.md',
        },
      };

    const { OpenReportPreviewCommand } = await import('../openReportPreview.js');
    const cmd = new OpenReportPreviewCommand(
      mockOutputChannel,
      { fsPath: 'C:\\test\\ext' } as unknown as vscode.Uri
    );

    await cmd.execute();

    expect(panel.webview.html).not.toContain('<script>alert(1)</script>');
    expect(panel.webview.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');

    expect(panel.webview.html).toContain(
      '<code>&lt;script&gt;alert(1)&lt;/script&gt;</code>'
    );

    expect(panel.webview.html).not.toContain('javascript:');

    expect(panel.webview.html).not.toContain('https://evil.example.com');
    expect(panel.webview.html).not.toContain('https://evil2.example.com');
    expect(panel.webview.html).not.toContain('onmouseover');
    expect(panel.webview.html).not.toContain('onerror');

    expect(panel.webview.html).toContain(
      '<a href="https://example.com" rel="noopener noreferrer">good</a>'
    );

    expect(panel.webview.html).toContain('<div class="mermaid">');
    expect(panel.webview.html).toContain('flowchart LR');
    expect(panel.webview.html).toContain('A--&gt;B');

    expect(panel.webview.html).not.toContain('unsafe-inline');

    const nonceMatch = panel.webview.html.match(/'nonce-([^']+)'/);
    expect(nonceMatch).not.toBeNull();
    const nonce = nonceMatch?.[1];

    expect(panel.webview.html).toContain(`style-src vscode-webview 'nonce-${nonce}'`);
    expect(panel.webview.html).toContain(`<style nonce="${nonce}">`);
    expect(panel.webview.html).toContain(`<script nonce="${nonce}">`);

    expect(panel.webview.html).toContain("securityLevel: 'strict'");
  });

  it.each([
    ['black', 'dark'],
    ['white', 'default'],
  ])(
    'selects Mermaid theme deterministically from previewBackgroundColor=%s',
    async (previewBackgroundColor, expectedTheme) => {
      const panel = {
        webview: {
          cspSource: 'vscode-webview',
          html: '',
          asWebviewUri: vi.fn((uri: { fsPath?: string }) => ({
            toString: () => `webview:${uri.fsPath ?? ''}`,
          })),
        },
        onDidDispose: vi.fn(),
        dispose: vi.fn(),
        reveal: vi.fn(),
      };

      vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => {
          if (key === 'previewBackgroundColor') return previewBackgroundColor;
          return defaultValue;
        }),
      } as never);

      (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor =
        {
          document: {
            languageId: 'markdown',
            getText: () => '# Report',
            fileName: 'C:\\test\\workspace\\devplan\\Project_Evaluation_Report.md',
          },
        };

      const { OpenReportPreviewCommand } = await import('../openReportPreview.js');
      const cmd = new OpenReportPreviewCommand(
        mockOutputChannel,
        { fsPath: 'C:\\test\\ext' } as unknown as vscode.Uri
      );

      await cmd.execute();

      expect(panel.webview.html).toContain(`theme: '${expectedTheme}'`);
    }
  );

  it('shows an error when there is no active editor', async () => {
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = undefined;

    const { OpenReportPreviewCommand } = await import('../openReportPreview.js');
    const cmd = new OpenReportPreviewCommand(
      mockOutputChannel,
      { fsPath: 'C:\\test\\ext' } as unknown as vscode.Uri
    );

    await cmd.execute();

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('열린 파일이 없습니다.');
    expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
  });

  it('shows an error when the active document is not markdown', async () => {
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor =
      {
        document: {
          languageId: 'plaintext',
          getText: () => 'hello',
          fileName: 'C:\\test\\workspace\\notes.txt',
        },
      };

    const { OpenReportPreviewCommand } = await import('../openReportPreview.js');
    const cmd = new OpenReportPreviewCommand(
      mockOutputChannel,
      { fsPath: 'C:\\test\\ext' } as unknown as vscode.Uri
    );

    await cmd.execute();

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      '마크다운 파일만 미리보기할 수 있습니다.'
    );
    expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
  });
});
