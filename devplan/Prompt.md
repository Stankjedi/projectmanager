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
| 1 | PROMPT-001 | Expand command layer unit tests | P2 | ⬜ Pending |
| 2 | PROMPT-002 | Add AI direct integration service | P3 | ⬜ Pending |
| 3 | PROMPT-003 | Enable multi-workspace report workflow | P3 | ⬜ Pending |

**Total: 3 prompts** | **Completed: 0** | **Remaining: 3**

---

## 🟡 Priority 2 (High) - Execute First

### [PROMPT-001] Expand command layer unit tests

**⏱️ Execute this prompt now, then proceed to PROMPT-002**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Add and expand unit tests for the main command classes using VS Code and fs mocks.

**Details:**

| Field | Value |
|:---|:---|
| **ID** | `test-commands-001` |
| **Category** | 🧪 Testing |
| **Complexity** | Medium |
| **Target Files** | `src/commands/__tests__/generatePrompt.test.ts`, `(new) src/commands/__tests__/setProjectVision.test.ts`, `(new) src/commands/__tests__/updateReports.test.ts` |
| **Origin** | `code-smell` |
| **Risk Level** | 🟡 Medium |

**📥 Input:**
- Existing `generatePrompt.test.ts` as a reference for mocking patterns
- `SetProjectVisionCommand` and `UpdateReportsCommand` source files
- VS Code API types for mocking (`vscode.window`, `vscode.workspace`)

**📤 Output:**
- `src/commands/__tests__/setProjectVision.test.ts` (new file, 5+ test cases)
- `src/commands/__tests__/updateReports.test.ts` (new file, 5+ test cases)

**Current State:** There is an existing unit test file for `GeneratePromptCommand`, but `UpdateReportsCommand` and `SetProjectVisionCommand` still have no dedicated tests. Many important branches (no workspace, scan errors, user cancellation in multi-step input flows) are only validated manually.

**Improvement:**
- Reuse the existing mocking approach for `vscode` and `fs/promises` in `generatePrompt.test.ts`.
- Add comprehensive tests for `SetProjectVisionCommand` covering:
  - No workspace / empty workspace folders
  - Happy path where all QuickPick/InputBox prompts are answered
  - Early return when the user cancels at each step.
- Add targeted tests for `UpdateReportsCommand` covering:
  - No workspace / empty folders
  - Successful execution path where `_executeWithProgress` is invoked
  - Error handling when workspace scan or report preparation fails.

**Expected Effect:**
- Higher confidence when refactoring the command layer.
- Improved overall test coverage focusing on user-facing flows.

#### Implementation Code:

```typescript
// FULL implementation code here - NO abbreviations
// Include ALL necessary imports
// Include COMPLETE function/class definitions
```

---

#### Definition of Done:

- [ ] `setProjectVision.test.ts` created with 5+ test cases
- [ ] `updateReports.test.ts` created with 5+ test cases
- [ ] All tests pass: `pnpm test`
- [ ] No compile errors: `pnpm compile`
- [ ] Test coverage remains at 85%+

#### Verification:

- Run: `cd vibereport-extension && pnpm compile`
- Run: `cd vibereport-extension && pnpm test`
- Confirm no compilation errors

**✅ After completing this prompt, proceed to [PROMPT-002]**

### [PROMPT-002] Add AI direct integration service
	
**⏱️ Execute this prompt now, then proceed to PROMPT-003**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Introduce an AI integration service and wire it into the report update flow, guarded by a configuration flag.

**Details:**

| Field | Value |
|:---|:---|
| **ID** | `feat-ai-integration-001` |
| **Category** | ✨ Feature |
| **Complexity** | High |
| **Target Files** | `src/commands/updateReports.ts`, `src/utils/configUtils.ts`, `(new) src/services/aiService.ts` |
| **Origin** | `manual-idea` |
| **Risk Level** | 🟢 Low |

**📥 Input:**
- VS Code Language Model API documentation
- Existing `UpdateReportsCommand` implementation
- `configUtils.ts` for configuration management

**📤 Output:**
- `src/services/aiService.ts` (new file with `AiService` class)
- Updated `package.json` with `vibereport.enableDirectAi` setting
- Updated `UpdateReportsCommand` with AI integration logic

**Current State:** Prompts are generated and copied to the clipboard, but there is no direct AI integration via the VS Code Language Model API, and there is no configuration flag to enable or disable such behavior.
	
**Improvement:**
- Add a new configuration option `vibereport.enableDirectAi` (boolean, default `false`) in `package.json` and reflect it in `VibeReportConfig` and `DEFAULT_CONFIG`.
- Implement `AiService` in `src/services/aiService.ts` that:
  - Accepts a prompt string and optional metadata.
  - Uses `vscode.lm` if available, but fails gracefully (with a user-facing message) when not supported.
  - Returns the AI response as a string so that callers can decide how to apply it.
- Update `UpdateReportsCommand` so that, after generating the analysis prompt, it:
  - Checks `enableDirectAi`.
  - If disabled, keeps the existing clipboard behavior.
  - If enabled, calls `AiService` and logs or surfaces the response, ready to be applied to reports.
	
**Expected Effect:**
- One-click, fully automated analysis and improvement prompt execution.
- Clear separation between AI integration details and the command workflow.

#### Implementation Code:

```typescript
// FULL implementation code here - NO abbreviations
// Include ALL necessary imports
// Include COMPLETE function/class definitions
```

---

#### Definition of Done:

- [ ] `src/services/aiService.ts` created
- [ ] `package.json` includes `vibereport.enableDirectAi` configuration
- [ ] `UpdateReportsCommand` checks flag and branches accordingly
- [ ] Graceful fallback to clipboard when AI unavailable
- [ ] No compile errors: `pnpm compile`
- [ ] All tests pass: `pnpm test`

#### Verification:

- Run: `cd vibereport-extension && pnpm compile`
- Run: `cd vibereport-extension && pnpm test`
- Confirm the extension compiles successfully and the `enableDirectAi` flag toggles AI integration without runtime errors.

**✅ After completing this prompt, proceed to [PROMPT-003]**

---

## ✨ Feature Addition Items

> Items for adding new features to the extension.

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 Enhancement (P3)

### [PROMPT-003] Enable multi-workspace report workflow
	
**⏱️ Execute this prompt now - FINAL PROMPT**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Use `selectWorkspaceRoot()` to support multi-root workspaces across the main commands and views.

**Details:**

| Field | Value |
|:---|:---|
| **ID** | `feat-multi-workspace-001` |
| **Category** | ⚙️ Workflow |
| **Complexity** | Medium |
| **Target Files** | `src/commands/updateReports.ts`, `src/extension.ts`, `src/services/workspaceScanner.ts`, `src/utils/configUtils.ts` |
| **Origin** | `manual-idea` |
| **Risk Level** | 🟢 Low |

**📥 Input:**
- Existing `selectWorkspaceRoot()` implementation in `configUtils.ts`
- Current `UpdateReportsCommand` that uses `workspaceFolders[0]`
- `WorkspaceScanner` and `SnapshotService` interfaces

**📤 Output:**
- Updated `UpdateReportsCommand` using `selectWorkspaceRoot()`
- Updated service calls passing selected workspace path
- Progress UI showing workspace name

**Current State:** `configUtils.selectWorkspaceRoot()` exists but is not yet used consistently. The main commands (including `UpdateReportsCommand`) still use `workspaceFolders[0]`, effectively limiting the extension to a single workspace folder.

**Improvement:**
- Replace direct `workspaceFolders[0]` usage in `UpdateReportsCommand` and extension command registrations with `selectWorkspaceRoot()`.
- Make sure that the selected workspace path is passed through to `WorkspaceScanner`, `SnapshotService`, and `ReportService` so that all subsequent operations are scoped correctly.
- When multiple workspaces are open, show the workspace name in progress and status messages so users always know which workspace is being analyzed.

**Expected Effect:**
- First-class support for multi-root workspaces and monorepos.
- Reduced confusion when working with multiple projects in a single VS Code window.

#### Implementation Code:

```typescript
// FULL implementation code here - NO abbreviations
// Include ALL necessary imports
// Include COMPLETE function/class definitions
```

---

#### Definition of Done:

- [ ] `UpdateReportsCommand` uses `selectWorkspaceRoot()`
- [ ] Selected workspace path passed to all services
- [ ] Progress UI shows workspace name
- [ ] No compile errors: `pnpm compile`
- [ ] All tests pass: `pnpm test`
- [ ] Manual test in multi-root workspace successful

#### Verification:

- Run: `cd vibereport-extension && pnpm compile`
- Run: `cd vibereport-extension && pnpm test`
- Open a multi-root workspace and verify that:
  - `VibeCoding: Update Project Reports` prompts for a workspace root selection.
  - Reports and `Session_History.md` are written under the selected workspace.

**🎉 ALL PROMPTS COMPLETED!**
