import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { PreviewStyleService } from '../previewStyleService.js';

const mockGetConfiguration = vi.fn();

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: (...args: any[]) => mockGetConfiguration(...args),
  },
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import * as fs from 'fs/promises';

describe('PreviewStyleService', () => {
  const mockOutputChannel = {
    appendLine: vi.fn(),
  } as unknown as vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes the custom variables block in ide mode and writes only when content changes', async () => {
    let fileContent = `/* ===== CUSTOM VARIABLES START ===== */
:root {
  --vibe-preview-background: #000;
}
/* ===== CUSTOM VARIABLES END ===== */

body { color: red; }
`;

    vi.mocked(fs.readFile).mockImplementation(async () => fileContent);
    vi.mocked(fs.writeFile).mockImplementation(async (_path, content) => {
      fileContent = String(content);
    });

    mockGetConfiguration.mockReturnValue({
      get: (key: string, def: any) => {
        if (key === 'previewBackgroundColor') return 'ide';
        if (key === 'previewEnabled') return true;
        return def;
      },
    });

    const service = new PreviewStyleService(mockOutputChannel, '/ext');

    await service.updatePreviewStyles();
    await service.updatePreviewStyles();

    expect(fileContent).not.toContain('CUSTOM VARIABLES START');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });
});

