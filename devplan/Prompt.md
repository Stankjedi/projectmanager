# 🤖 AI Agent Improvement Prompts

> ## 🚨 MANDATORY: FILE MODIFICATION REQUIRED
> 
> **⛔ DO NOT just respond with text or code blocks.**
> **⛔ DO NOT say "you can modify like this" without actually modifying.**
> **⛔ DO NOT explain what needs to be done without doing it.**
> 
> **✅ YOU MUST use file editing tools (`replace_string_in_file`, `create_file`, `multi_replace_string_in_file`) to directly modify files.**
> **✅ After each prompt, confirm "I have modified the file(s)" with the actual changes made.**
> 
> ---
> 
> **Process ALL prompts below SEQUENTIALLY. Do NOT stop after completing one prompt.**

---

## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | loadConfig 중복 코드 리팩토링 | P2 | ⬜ Pending |
| 2 | PROMPT-002 | 명령 레이어 단위 테스트 추가 | P2 | ⬜ Pending |
| 3 | PROMPT-003 | 세션 로그 단일 소스화 | P2 | ⬜ Pending |
| 4 | PROMPT-004 | AI 직접 연동 서비스 스켈레톤 | P3 | ⬜ Pending |
| 5 | PROMPT-005 | 멀티 워크스페이스 선택 UI | P3 | ⬜ Pending |

**Total: 5 prompts** | **Completed: 0** | **Remaining: 5**

---

## 🟡 Priority 2 (High) - Execute First

### [PROMPT-001] loadConfig 중복 코드 리팩토링

**⏱️ Execute this prompt now, then proceed to PROMPT-002**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Create a centralized config utility and refactor all files to use it
**Files to Modify**: 
- `(new) vibereport-extension/src/utils/configUtils.ts`
- `vibereport-extension/src/utils/index.ts`
- `vibereport-extension/src/extension.ts`
- `vibereport-extension/src/commands/updateReports.ts`
- `vibereport-extension/src/views/SummaryViewProvider.ts`
- `vibereport-extension/src/views/HistoryViewProvider.ts`

#### Step 1: Create the centralized config utility

Create file `vibereport-extension/src/utils/configUtils.ts`:

```typescript
/**
 * Configuration Utilities
 * 
 * @description Centralized configuration loading for Vibe Report extension.
 * This eliminates duplicate loadConfig functions across the codebase.
 */

import * as vscode from 'vscode';
import type { VibeReportConfig } from '../models/types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Readonly<VibeReportConfig> = {
  reportDirectory: 'devplan',
  snapshotFile: '.vscode/vibereport-state.json',
  enableGitDiff: true,
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/out/**',
    '**/build/**',
    '**/.git/**',
    '**/target/**',
    '**/.next/**',
    '**/__pycache__/**',
    '**/.venv/**',
    '**/coverage/**',
    '**/*.log',
    '**/*.lock',
  ],
  maxFilesToScan: 5000,
  autoOpenReports: true,
  language: 'ko',
} as const;

/**
 * Load Vibe Report configuration from VS Code workspace settings
 * 
 * @description Retrieves all vibereport.* settings with fallback to defaults
 * @returns Complete VibeReportConfig object
 * 
 * @example
 * const config = loadConfig();
 * console.log(config.reportDirectory); // 'devplan'
 */
export function loadConfig(): VibeReportConfig {
  const config = vscode.workspace.getConfiguration('vibereport');
  
  return {
    reportDirectory: config.get<string>('reportDirectory', DEFAULT_CONFIG.reportDirectory),
    snapshotFile: config.get<string>('snapshotFile', DEFAULT_CONFIG.snapshotFile),
    enableGitDiff: config.get<boolean>('enableGitDiff', DEFAULT_CONFIG.enableGitDiff),
    excludePatterns: config.get<string[]>('excludePatterns', [...DEFAULT_CONFIG.excludePatterns]),
    maxFilesToScan: config.get<number>('maxFilesToScan', DEFAULT_CONFIG.maxFilesToScan),
    autoOpenReports: config.get<boolean>('autoOpenReports', DEFAULT_CONFIG.autoOpenReports),
    language: config.get<'ko' | 'en'>('language', DEFAULT_CONFIG.language),
  };
}

/**
 * Get the root path of the current workspace
 * 
 * @description Returns the first workspace folder's path or null if no workspace is open
 * @returns Absolute path to workspace root or null
 */
export function getRootPath(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }
  return workspaceFolders[0].uri.fsPath;
}
```

#### Step 2: Update utils/index.ts to export the new utility

Add to `vibereport-extension/src/utils/index.ts`:

```typescript
export { loadConfig, getRootPath, DEFAULT_CONFIG } from './configUtils.js';
```

#### Step 3: Update extension.ts

Replace the local `loadConfig` function with import:
```typescript
import { loadConfig, getRootPath } from './utils/configUtils.js';
```

Remove the duplicate `loadConfig` and `getRootPath` function definitions.

#### Step 4: Update all command and view files

In each file (`updateReports.ts`, `SummaryViewProvider.ts`, `HistoryViewProvider.ts`, etc.):
- Remove the local `loadConfig` method
- Add import: `import { loadConfig } from '../utils/configUtils.js';`

#### Verification:

- Run: `cd vibereport-extension && pnpm run compile`
- Run: `cd vibereport-extension && pnpm run test:run`
- Expected: No compilation errors, all 74 tests pass

**✅ After completing this prompt, proceed to [PROMPT-002]**

---

### [PROMPT-002] 명령 레이어 단위 테스트 추가

**⏱️ Execute this prompt now, then proceed to PROMPT-003**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Add unit tests for GeneratePromptCommand
**Files to Modify**: 
- `(new) vibereport-extension/src/commands/__tests__/generatePrompt.test.ts`

#### Create the test file

Create file `vibereport-extension/src/commands/__tests__/generatePrompt.test.ts`:

```typescript
/**
 * GeneratePromptCommand Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test' }],
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
    it('should show warning when no workspace is open', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = undefined;

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('워크스페이스')
      );
    });

    it('should show warning when improvement report does not exist', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test' } as vscode.WorkspaceFolder,
      ];
      
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should parse improvement items from report', async () => {
      // Arrange
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/test/workspace' }, name: 'test' } as vscode.WorkspaceFolder,
      ];

      const mockReport = `
## 개선 항목
### 🟡 중요 (P2)
#### [P2-1] Test Item
| 항목 | 내용 |
| **ID** | \`test-001\` |
**현재 상태:** Test state
**개선 내용:** Test improvement
`;

      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValue(mockReport);
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      const { GeneratePromptCommand } = await import('../generatePrompt.js');
      const command = new GeneratePromptCommand(mockOutputChannel);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showQuickPick).toHaveBeenCalled();
    });
  });

  describe('improvement item parsing', () => {
    it('should correctly identify P1/P2/P3 priorities', async () => {
      const { parseImprovementItems } = await import('../../utils/markdownUtils.js');
      
      const content = `
#### [P1] Critical Item
**ID**: \`critical-001\`

#### [P2-1] Important Item  
**ID**: \`important-001\`

#### [P3-1] Nice to have
**ID**: \`nice-001\`
`;

      const items = parseImprovementItems(content);
      
      expect(items.length).toBeGreaterThanOrEqual(0);
    });
  });
});
```

#### Verification:

- Run: `cd vibereport-extension && pnpm run compile`
- Run: `cd vibereport-extension && pnpm run test:run`
- Expected: All tests pass (77+ tests)

**✅ After completing this prompt, proceed to [PROMPT-003]**

---

### [PROMPT-003] 세션 로그 단일 소스화

**⏱️ Execute this prompt now, then proceed to PROMPT-004**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Remove session log duplication from evaluation/improvement reports
**Files to Modify**: 
- `vibereport-extension/src/services/reportService.ts`

#### Step 1: Update createEvaluationTemplate

In `reportService.ts`, find the `createEvaluationTemplate` method and replace the session log section.

Find this section in the Korean template:
```typescript
${MARKERS.SESSION_LOG_START}
## 📝 세션 기록

*세션 기록이 여기에 추가됩니다.*
${MARKERS.SESSION_LOG_END}
```

Replace with:
```typescript
## 📝 세션 기록

> 📖 상세 세션 히스토리는 \`Session_History.md\` 파일을 참조하세요.
```

Do the same for the English template.

#### Step 2: Update createImprovementTemplate similarly

Replace session log markers section with a reference.

#### Step 3: Modify updateEvaluationReport

In `updateEvaluationReport` method, remove or comment out the line:
```typescript
content = this.prependSessionLog(content, sessionEntry);
```

Session logs should only be written to Session_History.md.

#### Verification:

- Run: `cd vibereport-extension && pnpm run compile`
- Run: `cd vibereport-extension && pnpm run test:run`
- Expected: All tests pass

**✅ After completing this prompt, proceed to [PROMPT-004]**

---

## 🟢 Priority 3 (Medium) - Execute Last

### [PROMPT-004] AI 직접 연동 서비스 스켈레톤

**⏱️ Execute this prompt now, then proceed to PROMPT-005**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Create skeleton for AI service integration
**Files to Modify**: 
- `(new) vibereport-extension/src/services/aiService.ts`
- `vibereport-extension/src/services/index.ts`

#### Create the AI service skeleton

Create file `vibereport-extension/src/services/aiService.ts`:

```typescript
/**
 * AI Service
 * 
 * @description Abstraction layer for AI model communication.
 * Currently a skeleton - will be implemented when VS Code Language Model API stabilizes.
 * 
 * @see https://code.visualstudio.com/api/extension-guides/language-model
 */

import * as vscode from 'vscode';

/**
 * AI Response structure
 */
export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
  model?: string;
  tokensUsed?: number;
}

/**
 * AI Service Options
 */
export interface AIServiceOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

/**
 * AI Service for Language Model integration
 * 
 * @description This service will eventually use VS Code's Language Model API
 * to directly communicate with AI models like GPT-4 or Claude.
 * 
 * Current status: Skeleton implementation
 * Future: Full Language Model API integration
 */
export class AIService {
  private outputChannel: vscode.OutputChannel;
  private isAvailable: boolean = false;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.checkAvailability();
  }

  /**
   * Check if Language Model API is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      // Check if vscode.lm API exists (Proposed API)
      // This will be available when the API stabilizes
      const lm = (vscode as any).lm;
      this.isAvailable = typeof lm?.selectChatModels === 'function';
      
      if (this.isAvailable) {
        this.log('Language Model API is available');
      } else {
        this.log('Language Model API is not yet available');
      }
    } catch {
      this.isAvailable = false;
      this.log('Language Model API check failed');
    }
  }

  /**
   * Check if AI service is ready to use
   */
  public isReady(): boolean {
    return this.isAvailable;
  }

  /**
   * Send a prompt to the AI model
   * 
   * @param prompt - The prompt to send
   * @param options - Optional configuration
   * @returns AI response or error
   * 
   * @example
   * const response = await aiService.sendPrompt('Analyze this code...');
   * if (response.success) {
   *   console.log(response.content);
   * }
   */
  public async sendPrompt(
    prompt: string,
    options?: AIServiceOptions
  ): Promise<AIResponse> {
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'Language Model API is not available. Please use clipboard-based workflow.',
      };
    }

    try {
      // TODO: Implement actual Language Model API call when available
      // const lm = (vscode as any).lm;
      // const models = await lm.selectChatModels({ family: 'gpt-4' });
      // const model = models[0];
      // const response = await model.sendRequest([{ role: 'user', content: prompt }]);
      
      this.log(`Sending prompt (${prompt.length} chars)...`);
      
      // Placeholder response
      return {
        success: false,
        error: 'Language Model API integration is not yet implemented',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`AI request failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Analyze project and generate reports using AI
   * 
   * @param projectContext - Project snapshot and context
   * @returns Generated report content or error
   */
  public async analyzeProject(
    projectContext: string
  ): Promise<AIResponse> {
    const prompt = this.buildAnalysisPrompt(projectContext);
    return this.sendPrompt(prompt);
  }

  /**
   * Build analysis prompt from project context
   */
  private buildAnalysisPrompt(context: string): string {
    return `You are an expert code reviewer. Analyze the following project and provide:
1. A comprehensive evaluation report
2. Improvement suggestions with priorities (P1/P2/P3)
3. Specific code improvements with implementation details

Project Context:
${context}

Respond in a structured format suitable for markdown reports.`;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[AIService] ${message}`);
  }
}
```

#### Update services/index.ts

Add to exports:

```typescript
export { AIService } from './aiService.js';
export type { AIResponse, AIServiceOptions } from './aiService.js';
```

#### Verification:

- Run: `cd vibereport-extension && pnpm run compile`
- Run: `cd vibereport-extension && pnpm run test:run`
- Expected: All tests pass

**✅ After completing this prompt, proceed to [PROMPT-005]**

---

### [PROMPT-005] 멀티 워크스페이스 선택 UI

**⏱️ Execute this prompt now - FINAL PROMPT**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Add workspace selection QuickPick for multi-root workspaces
**Files to Modify**: 
- `vibereport-extension/src/utils/configUtils.ts` (if created in PROMPT-001, otherwise create new)

#### Add to configUtils.ts

Add the following function:

```typescript
/**
 * Get workspace root path with multi-root support
 * 
 * @description If multiple workspace folders exist, prompts user to select one.
 * For single workspace, returns the path directly.
 * 
 * @returns Selected workspace path or null if cancelled/no workspace
 */
export async function selectWorkspaceRoot(): Promise<string | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
    return null;
  }

  // Single workspace - return directly
  if (workspaceFolders.length === 1) {
    return workspaceFolders[0].uri.fsPath;
  }

  // Multiple workspaces - show picker
  const items = workspaceFolders.map(folder => ({
    label: folder.name,
    description: folder.uri.fsPath,
    folder,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '보고서를 생성할 워크스페이스를 선택하세요',
    title: 'Vibe Report: 워크스페이스 선택',
  });

  if (!selected) {
    return null; // User cancelled
  }

  return selected.folder.uri.fsPath;
}
```

#### Update utils/index.ts export

```typescript
export { loadConfig, getRootPath, selectWorkspaceRoot, DEFAULT_CONFIG } from './configUtils.js';
```

#### Verification:

- Run: `cd vibereport-extension && pnpm run compile`
- Run: `cd vibereport-extension && pnpm run test:run`
- Expected: All tests pass

**🎉 ALL PROMPTS COMPLETED! Run final verification:**

```bash
cd vibereport-extension
pnpm run compile
pnpm run test:run
pnpm run package
```

---

*Generated: 2025-12-01T20:21:00.000Z*
