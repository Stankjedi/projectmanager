# AI Agent Improvement Prompts

> **EXECUTION RULES (Read Carefully):**
> 1.  **Direct Code Editing**: Always use file-edit tools (e.g., `write_to_file`, `replace_file_content`) to modify files. Do not just show code.
> 2.  **Sequential Execution**: Run prompts strictly in order (PROMPT-001 -> PROMPT-002...).
> 3.  **No Placeholders**: Write full, working code. Do not use comments like `// implementation here`.
> 4.  **Verification**: After each prompt, run the specified verification command (e.g., `pnpm run test`).

## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Add Unit Tests for AiService | P2 | ⬜ Pending |
| 2 | PROMPT-002 | Create Architecture Documentation | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Implement Custom System Prompt Support | P3 | ⬜ Pending |
| 4 | OPT-001 | Optimize Workspace Scanner Excludes | OPT | ⬜ Pending |

> **Total: 4 prompts | Completed: 0 | Remaining: 4**

---

## 🟡 P2: Critical Improvements

### [PROMPT-001] Add Unit Tests for AiService

> **Execute this prompt now, then proceed to PROMPT-002.**

**Task:**
Create a new test file `vibereport-extension/src/services/__tests__/aiService.test.ts` to verify the `AiService` functionality. Mock the `vscode.lm` API.

**Target File:**
- `vibereport-extension/src/services/__tests__/aiService.test.ts` (New)

**Steps:**
1.  Isolate `vscode.lm` dependency using `vi.mock('vscode')`.
2.  Test `runAnalysisPrompt` method:
    -   Case 1: Success (Model returns response).
    -   Case 2: Availability check (`isAvailable` returns false).
    -   Case 3: API Error (Graceful failure/null return).
3.  Ensure `vi` (Vitest) is imported.

**Implementation Goal (Example structure):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../aiService';
import * as vscode from 'vscode';

// Mock vscode language model API
vi.mock('vscode', () => ({
    lm: {
        selectChatModels: vi.fn(),
    },
    LanguageModelChatUserMessage: vi.fn(),
    LanguageModelChatSystemMessage: vi.fn(),
}));

describe('AiService', () => {
    // Implement tests...
});
```

**Verification:**
- Run `pnpm run test` and check that `aiService.test.ts` passes.

After completing this prompt, proceed to [PROMPT-002].

### [PROMPT-002] Create Architecture Documentation

> **Execute this prompt now, then proceed to PROMPT-003.**

**Task:**
Create `vibereport-extension/docs/ARCHITECTURE.md` to document the internal design. Update `vibereport-extension/README.md` to link to it.

**Target Files:**
- `vibereport-extension/docs/ARCHITECTURE.md` (New)
- `vibereport-extension/README.md` (Update)

**Steps:**
1.  Create `ARCHITECTURE.md`.
2.  Write sections:
    -   **System Map**: A Mermaid diagram showing Core Services, UI Layer, and Data Flow (reuse the one from Evaluation Report).
    -   **Core Components**: Brief description of WorkspaceScanner, SnapshotService, ReportService, AiService.
    -   **Report Generation Flow**: Explain the 3-step reporting.
    -   **Preview Architecture**: Explain Local Mermaid bundling and Webview CSP.
3.  Add a link `[Internal Architecture](./docs/ARCHITECTURE.md)` to `README.md` under a "Contributing" or "Internal" section.

**Content for ARCHITECTURE.md (Guidelines):**
-   Start with H1 "System Architecture".
-   Use Mermaid code blocks for diagrams.
-   Explain *why* we use local mermaid (security/offline support).

**Verification:**
-   Check that `vibereport-extension/docs/ARCHITECTURE.md` exists.
-   Check `README.md` contains the link.

After completing this prompt, proceed to [PROMPT-003].

---

## 🟢 P3: Feature Additions

### [PROMPT-003] Implement Custom System Prompt Support

> **Execute this prompt now, then proceed to OPT-001.**

**Task:**
Add filtering/customization for AI prompts by introducing `vibereport.ai.customInstructions` in `package.json` and consuming it in `analysisPromptTemplate.ts`.

**Target Files:**
- `vibereport-extension/package.json`
- `vibereport-extension/src/utils/analysisPromptTemplate.ts`

**Steps:**
1.  **Update schema**: Add `vibereport.ai.customInstructions` (string, description: "Custom instructions injected into AI analysis prompts") to `package.json` > `contributes.configuration`.
2.  **Update Prompt Template**:
    -   Modify `buildAnalysisPrompt` in `analysisPromptTemplate.ts` to accept `config` object (or read config inside it).
    -   If `customInstructions` exists, append it to the `systemInstructions` part of the template.
    -   Format: `\n\n[User Custom Instructions]\n${customInstructions}`.

**Verification:**
-   Add a temporary config value in `.vscode/settings.json` (if exists) or just verify compilation `pnpm run compile`.

After completing this prompt, proceed to [OPT-001].

---

## ⚙️ OPT: Code Optimization

### [OPT-001] Optimize Workspace Scanner Excludes

> **Execute this prompt now, then proceed to Final Verification.**

**Task:**
Improve `package.json` default exclude patterns and `configUtils.ts` to handle large exclusion lists mainly for performance.

**Target Files:**
- `vibereport-extension/package.json`
- `vibereport-extension/src/utils/configUtils.ts`

**Steps:**
1.  **Update Defaults**: In `package.json`, add typical heavy folders to `vibereport.excludePatterns` default:
    -   `**/__pycache__/**`, `**/.venv/**`, `**/.terraform/**`, `**/.gradle/**`, `**/bin/**`, `**/obj/**`.
2.  **Update Logic**: In `configUtils.ts`, ensure user-defined excludes are *merged* with essential defaults if not already doing so (or document behavior). Currently VS Code settings overwrite defaults. Leave as overwrite-behavior if that is standard, but ensure the *default list* is comprehensive.

**Verification:**
-   `pnpm run compile`

After completing this prompt, proceed to Final Completion.

---

## ✅ Final Completion

> **ALL PROMPTS COMPLETED.**

1.  **Verify**: Run `pnpm run test` one last time to ensure no regressions.
2.  **Report**: Print the following message:
    
    ```
    ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.
    ```
