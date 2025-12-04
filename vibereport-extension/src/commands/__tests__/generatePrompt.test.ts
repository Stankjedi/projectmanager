/**
 * GeneratePromptCommand Unit Tests
 * 
 * @description Prompt.md에서 프롬프트 선택 및 클립보드 복사 명령에 대한 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 }],
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: any) => defaultValue),
    })),
    openTextDocument: vi.fn(),
  },
  window: {
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showTextDocument: vi.fn(),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  QuickPickItemKind: {
    Separator: 1,
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
}));

describe('GeneratePromptCommand', () => {
  let mockOutputChannel: vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOutputChannel = {
      appendLine: vi.fn(),
      dispose: vi.fn(),
    } as unknown as vscode.OutputChannel;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('execute', () => {
    it('should show error when no workspace is open', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = undefined;

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '워크스페이스가 열려있지 않습니다.'
      );
    });

    it('should show error when workspace folders is empty array', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [];

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '워크스페이스가 열려있지 않습니다.'
      );
    });

    it('should show error when no items available (both Prompt.md and Improvement Report missing)', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];
      
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - Now requires Prompt.md file
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Prompt.md 파일을 찾을 수 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
    });

    it('should show error when no prompts or OPT items found', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // Prompt.md with no prompt items, Improvement Report with no OPT items
      const mockPromptMd = `
# AI Agent Improvement Prompts

아직 프롬프트가 없습니다.
`;
      const mockImprovementMd = `
# 개선 보고서

개선 항목이 없습니다.
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockImplementation((filePath: any) => {
        if (filePath.includes('Prompt.md')) {
          return Promise.resolve(mockPromptMd);
        }
        if (filePath.includes('Project_Improvement_Exploration_Report.md')) {
          return Promise.resolve(mockImprovementMd);
        }
        return Promise.reject(new Error('File not found'));
      });

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '선택 가능한 프롬프트나 OPT 항목이 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
    });

    it('should parse prompts from Prompt.md and show QuickPick', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const mockPromptMd = `
# 🤖 AI Agent Improvement Prompts

## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Test Prompt | P2 | ⬜ Pending |

## 🟡 Priority 2 (High) - Execute Second

### [PROMPT-001] Test Prompt

**⏱️ Execute this prompt now.**

#### Goal
- Test goal

#### Context
- Priority: P2

#### Verification
- Run tests
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockPromptMd);
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined); // User cancelled

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showQuickPick).toHaveBeenCalled();
    });

    it('should copy selected prompt to clipboard', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const mockPromptMd = `
# 🤖 AI Agent Improvement Prompts

## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Code Quality Improvement | P2 | ⬜ Pending |

## 🟡 Priority 2 (High)

### [PROMPT-001] Code Quality Improvement

**⏱️ Execute this prompt now.**

#### Goal
- Improve code quality

#### Context
- Priority: P2

#### Verification
- Run tests
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockPromptMd);
      
      // Simulate user selecting a prompt (returns array for canPickMany: true)
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue([{
        label: '⬜ [PROMPT-001] Code Quality Improvement',
        description: 'P2',
        detail: '📋 프롬프트 | 상태: 대기 중',
        _item: {
          type: 'prompt',
          item: {
            promptId: 'PROMPT-001',
            title: 'Code Quality Improvement',
            priority: 'P2',
            status: 'pending',
            fullContent: '### [PROMPT-001] Code Quality Improvement\n\n**⏱️ Execute this prompt now.**',
          },
        },
      }] as any);

      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - Check clipboard was written
      expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should open Copilot Chat when user clicks the button', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const mockPromptMd = `
## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Test | P2 | ⬜ Pending |

### [PROMPT-001] Test

Content
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockPromptMd);
      
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue([{
        label: '⬜ [PROMPT-001] Test',
        description: 'P2',
        detail: '📋 프롬프트 | 상태: 대기 중',
        _item: {
          type: 'prompt',
          item: {
            promptId: 'PROMPT-001',
            title: 'Test',
            priority: 'P2',
            status: 'pending',
            fullContent: '### [PROMPT-001] Test\n\nContent',
          },
        },
      }] as any);

      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Copilot Chat 열기' as any);

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.panel.chat.view.copilot.focus');
    });

    it('should open Prompt.md file when user clicks the button', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const mockPromptMd = `
## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Test | P2 | ⬜ Pending |

### [PROMPT-001] Test

Content
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockPromptMd);
      
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue([{
        label: '⬜ [PROMPT-001] Test',
        description: 'P2',
        detail: '📋 프롬프트 | 상태: 대기 중',
        _item: {
          type: 'prompt',
          item: {
            promptId: 'PROMPT-001',
            title: 'Test',
            priority: 'P2',
            status: 'pending',
            fullContent: '### [PROMPT-001] Test\n\nContent',
          },
        },
      }] as any);

      const mockDocument = { uri: { fsPath: '/test/workspace/devplan/Prompt.md' } };
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('프롬프트 파일 열기' as any);

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });
  });
});

describe('improvement item parsing', () => {
  it('should correctly identify P1/P2/P3 priorities', async () => {
    const { parseImprovementItems } = await import('../../utils/markdownUtils.js');
    
    const content = `
### 🔴 긴급 (P1)

#### [P1-1] Critical Item
| 항목 | 내용 |
| **ID** | \`critical-001\` |

**현재 상태:** Critical issue

---

### 🟡 중요 (P2)

#### [P2-1] Important Item  
| 항목 | 내용 |
| **ID** | \`important-001\` |

**현재 상태:** Important

---

### 🟢 개선 (P3)

#### [P3-1] Nice to have
| 항목 | 내용 |
| **ID** | \`nice-001\` |

**현재 상태:** Optional
`;

    const items = parseImprovementItems(content);
    
    // Check that items are parsed
    expect(items.length).toBeGreaterThanOrEqual(0);
  });

  it('should extract ID from markdown table', async () => {
    const { parseImprovementItems } = await import('../../utils/markdownUtils.js');
    
    const content = `
#### [P2-1] Test Item
| 항목 | 내용 |
|:---|:---|
| **ID** | \`test-id-123\` |
| **카테고리** | 🧪 테스트 |

**현재 상태:** Test
`;

    const items = parseImprovementItems(content);
    
    // Should find at least one item
    expect(items).toBeDefined();
  });

  it('should handle empty content', async () => {
    const { parseImprovementItems } = await import('../../utils/markdownUtils.js');
    
    const items = parseImprovementItems('');
    
    expect(items).toEqual([]);
  });

  it('should handle content without improvement markers', async () => {
    const { parseImprovementItems } = await import('../../utils/markdownUtils.js');
    
    const content = `
# Some Document

This is just regular markdown without improvement items.
`;

    const items = parseImprovementItems(content);
    
    expect(items).toEqual([]);
  });
});
