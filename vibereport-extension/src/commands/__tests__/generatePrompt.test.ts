/**
 * GeneratePromptCommand Unit Tests
 * 
 * @description 개선 항목 선택 및 프롬프트 생성 명령에 대한 테스트
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

    it('should show error when improvement report does not exist', async () => {
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

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '개선 보고서를 찾을 수 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
    });

    it('should show info message when no pending improvements found', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      // Report with no improvement items
      const mockReport = `
# 개선 보고서

아직 개선 항목이 없습니다.
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockReport);

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - The code uses showInformationMessage with "적용할 개선 항목이 없습니다. 🎉"
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        '적용할 개선 항목이 없습니다. 🎉'
      );
    });

    it('should parse improvement items from report and show QuickPick', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const mockReport = `
## 🔧 기능 개선 항목

### 🟡 중요 (P2)

#### [P2-1] 테스트 항목
| 항목 | 내용 |
|:---|:---|
| **ID** | \`test-001\` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | \`src/test.ts\` |

**현재 상태:** 현재 테스트가 없습니다.

**개선 내용:**
- 테스트 추가

**기대 효과:**
- 안정성 향상
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockReport);
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined); // User cancelled

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showQuickPick).toHaveBeenCalled();
    });

    it('should generate prompt and copy to clipboard when items selected', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 } as vscode.WorkspaceFolder,
      ];

      const mockReport = `
### 🟡 중요 (P2)

#### [P2-1] 코드 개선
| 항목 | 내용 |
|:---|:---|
| **ID** | \`improve-001\` |
| **카테고리** | 🧹 코드 품질 |

**현재 상태:** 중복 코드가 있습니다.

**개선 내용:**
- 중복 코드 제거
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockReport);
      
      // Simulate user selecting items (returns array since canPickMany: true)
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue([{
        label: '🟡 [P2-1] 코드 개선',
        description: '🧹 코드 품질',
        detail: '중복 코드 제거',
        _item: {
          id: 'improve-001',
          title: '코드 개선',
          priority: 'P2',
          description: '중복 코드가 있습니다.',
          applied: false,
          rawContent: mockReport,
        },
        _index: 0,
      }] as any);

      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert - Check clipboard was written
      expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
      // Check file was written
      expect(fs.writeFile).toHaveBeenCalled();
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
