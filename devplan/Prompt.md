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
| 4 | OPT-001 | Refactor markdownUtils for SRP | OPT | ⬜ Pending |
| 5 | OPT-002 | Add snapshot caching and Git line metrics | OPT | ⬜ Pending |

**Total: 5 prompts** | **Completed: 0** | **Remaining: 5**

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
| **Target Files** | `(new) src/commands/__tests__/setProjectVision.test.ts`, `(new) src/commands/__tests__/updateReports.test.ts` |
| **Origin** | `code-smell` |
| **Risk Level** | 🟡 Medium |

**📥 Input:**
- Existing `generatePrompt.test.ts` (updated in v0.3.5) as a reference for mocking patterns
- `SetProjectVisionCommand` and `UpdateReportsCommand` source files
- VS Code API types for mocking (`vscode.window`, `vscode.workspace`)

**📤 Output:**
- `src/commands/__tests__/setProjectVision.test.ts` (new file, 5+ test cases)
- `src/commands/__tests__/updateReports.test.ts` (new file, 5+ test cases)

**Current State:** There is an existing unit test file for `GeneratePromptCommand` (12 test cases as of v0.3.5), but `UpdateReportsCommand` and `SetProjectVisionCommand` still have no dedicated tests. Many important branches (no workspace, scan errors, user cancellation in multi-step input flows) are only validated manually.

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
- Test count expected to increase from 86 to ~96+.

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

**✅ After completing this prompt, proceed to [OPT-001]**

---

## 🔧 Optimization Items (OPT)

> Code quality and performance optimization suggestions from the Improvement Report.
> These are optional but recommended for maintaining code health.

### [OPT-001] Refactor markdownUtils for Single Responsibility Principle

| Field | Value |
|:---|:---|
| **ID** | `opt-markdown-parse-001` |
| **Category** | 🚀 Code Optimization |
| **Impact** | Quality |
| **Target Files** | `src/utils/markdownUtils.ts` |
| **Status** | ⬜ Pending |

**Current State:** `markdownUtils` handles marker-based section extraction/replacement, improvement item parsing, and score table generation all in one module. While functional, having diverse responsibilities in a single utility module makes it harder to understand boundaries for testing and increases maintenance difficulty as parser logic grows more complex.

**Optimization:** Separate marker processing (append/prepend/replaceBetweenMarkers) and domain logic (improvement parsing, score table formatting) internally. For example, create sub-modules like `markerUtils.ts` (marker handling), `improvementParser.ts` (improvement item parsing), `scoreTableFormatter.ts` (score table generation), while re-exporting from `markdownUtils` to maintain existing call sites.

**Expected Effect:**
- Performance: Logic performance won't change significantly, but applying SRP makes it easier to replace/optimize specific features.
- Quality: Separated responsibilities clarify test targets, making it easier to write granular unit tests for parsing/formatting logic.

**Measurable Metrics:** File line count reduction after module separation, average lines per function reduction, improvement in test coverage (line/branch basis) for improvement parser and score table generation logic.

**✅ After completing this prompt, proceed to [OPT-002]**

---

### [OPT-002] Add Snapshot Caching and Git Line Metrics

| Field | Value |
|:---|:---|
| **ID** | `opt-snapshot-diff-001` |
| **Category** | ⚙️ Performance Tuning |
| **Impact** | Performance / Quality |
| **Target Files** | `src/services/workspaceScanner.ts`, `src/services/snapshotService.ts` |
| **Status** | ⬜ Pending |

**Current State:** WorkspaceScanner and SnapshotService use `maxFilesToScan` and `excludePatterns` for basic performance, but frequently running in large monorepos means repeatedly scanning the same file lists and config files. Git diff summaries also lack line-based metrics, making it hard to quantify "change magnitude."

**Optimization:** Memoize or introduce a simple cache structure for last scan results (file list, key config files, Git status summary) to reuse during consecutive runs within a short time. Also include changed line counts (added/removed/total) in Git diff summaries and expose this info in SnapshotDiff and Summary for at-a-glance identification of large changes.

**Expected Effect:**
- Performance: Noticeable reduction in scan time for consecutive runs in large projects, fewer unnecessary filesystem accesses.
- Quality: Expressing change volume as numbers allows quick identification of sessions with "large changes" in Session History.

**Measurable Metrics:** Reduction ratio of scan time and filesystem calls on second consecutive run in same workspace, utilization frequency of line count metrics included in Git diff summary.

**🎉 ALL PROMPTS COMPLETED!**
