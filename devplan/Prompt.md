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
| 1 | PROMPT-001 | Add AI direct integration service (`feat-ai-integration-001`) | P3 | ⬜ Pending |
| 2 | PROMPT-002 | Enable multi-workspace report workflow (`feat-multi-workspace-001`) | P3 | ⬜ Pending |
| 3 | OPT-001 | Integrate snapshot cache and diff metrics (`opt-snapshot-diff-001`) | OPT | ⬜ Pending |

**Total: 3 prompts** | **Completed: 0** | **Remaining: 3**

---

## 🟢 Priority 3 (Medium) - Feature Additions

### [PROMPT-001] Add AI direct integration service

**⏱️ Execute this prompt now, then proceed to PROMPT-002**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Introduce an AI integration service using VS Code Language Model API and wire it into the report update flow.

**Details:**

| Field | Value |
|:---|:---|
| **ID** | `feat-ai-integration-001` |
| **Category** | ✨ Feature |
| **Complexity** | High |
| **Target Files** | `src/commands/updateReports.ts`, `package.json`, `(new) src/services/aiService.ts` |
| **Risk Level** | 🟢 Low |

**Current State:** Prompts are generated and copied to clipboard. Users must manually paste to Copilot Chat. No direct AI integration exists.

**Improvement:**
- Add `vibereport.enableDirectAi` config option (boolean, default `false`) in `package.json`
- Create `AiService` in `src/services/aiService.ts` using `vscode.lm` API
- Update `UpdateReportsCommand` to check flag and call AI service or use clipboard fallback

**Expected Effect:**
- One-click automated analysis when AI API is available
- Graceful fallback to clipboard when API unavailable

#### Implementation Code:

```typescript
// src/services/aiService.ts
import * as vscode from "vscode";

export interface AiRequestOptions {
  modelId?: string;
}

export class AiService {
  constructor(private readonly output: vscode.OutputChannel) {}

  async run(prompt: string, options: AiRequestOptions = {}): Promise<string | null> {
    const lmApi = (vscode as any).lm;

    if (!lmApi || typeof lmApi.selectChatModels !== "function") {
      this.output.appendLine("[AiService] Language Model API is not available.");
      vscode.window.showWarningMessage(
        "Language Model API not available. Using clipboard-only workflow."
      );
      return null;
    }

    try {
      const [model] = await lmApi.selectChatModels({
        where: { family: options.modelId ?? "gpt" },
      });

      if (!model) {
        this.output.appendLine("[AiService] No chat model selected.");
        return null;
      }

      const messages = [
        { role: "user", content: prompt },
      ];

      const response = await model.sendRequest(messages);
      const chunks: string[] = [];
      
      for await (const chunk of response.text) {
        chunks.push(chunk);
      }

      return chunks.join("");
    } catch (error) {
      this.output.appendLine(`[AiService] Error: ${error}`);
      return null;
    }
  }
}
```

#### Definition of Done:
- [ ] `src/services/aiService.ts` created
- [ ] `package.json` includes `vibereport.enableDirectAi` configuration
- [ ] `UpdateReportsCommand` checks flag and branches accordingly
- [ ] `pnpm compile` passes
- [ ] `pnpm test` passes

**✅ After completing this prompt, proceed to [PROMPT-002]**

---

### [PROMPT-002] Enable multi-workspace report workflow

**⏱️ Execute this prompt now, then proceed to OPT-001**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: Use `selectWorkspaceRoot()` to support multi-root workspaces across the main commands.

**Details:**

| Field | Value |
|:---|:---|
| **ID** | `feat-multi-workspace-001` |
| **Category** | ⚙️ Workflow |
| **Complexity** | Medium |
| **Target Files** | `src/commands/updateReports.ts`, `src/utils/configUtils.ts` |
| **Risk Level** | 🟢 Low |

**Current State:** `selectWorkspaceRoot()` exists in configUtils but isn't used. Commands use `workspaceFolders[0]` directly.

**Improvement:**
- Replace `workspaceFolders[0]` usage with `selectWorkspaceRoot()` call
- Pass selected workspace path to all services
- Show workspace name in progress UI

**Expected Effect:**
- First-class multi-root workspace support
- Clear workspace context in all operations

#### Implementation Code:

```typescript
// src/commands/updateReports.ts - execute method update
import { selectWorkspaceRoot, loadConfig } from "../utils/index.js";

async execute(): Promise<void> {
  const rootPath = await selectWorkspaceRoot();
  if (!rootPath) {
    return; // User cancelled or no workspace
  }

  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const selectedFolder = workspaceFolders.find(
    (folder) => folder.uri.fsPath === rootPath
  );
  const projectName = selectedFolder?.name ?? "workspace";

  const config = loadConfig();
  const reportsExist = await this.reportService.reportsExist(rootPath, config);
  const isFirstRun = !reportsExist;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Vibe Report: ${projectName}`,
      cancellable: false,
    },
    async (progress) => {
      await this._executeWithProgress(
        rootPath, config, projectName, progress, isFirstRun
      );
    }
  );
}
```

#### Definition of Done:
- [ ] `UpdateReportsCommand` uses `selectWorkspaceRoot()`
- [ ] Selected workspace path passed to all services
- [ ] Progress UI shows workspace name
- [ ] `pnpm compile` passes
- [ ] `pnpm test` passes

**✅ After completing this prompt, proceed to [OPT-001]**

---

## 🔧 Optimization Items (OPT)

### [OPT-001] Integrate snapshot cache and diff metrics (`opt-snapshot-diff-001`)

**⏱️ Execute this prompt now - FINAL PROMPT**

| Field | Value |
|:---|:---|
| **ID** | `opt-snapshot-diff-001` |
| **Category** | ⚙️ Performance Tuning |
| **Impact** | Performance / Observability |
| **Target Files** | `src/services/workspaceScanner.ts`, `src/services/snapshotService.ts`, `src/services/snapshotCache.ts` |

**Current State:**  
- `snapshotCache.ts` provides TTL-based caching infrastructure, and WorkspaceScanner already uses it for file list caching.
- However, SnapshotService does not yet expose line-count metrics (added/removed/total) in the diff summary, making it harder to identify large change sessions at a glance.

**Optimization:**  
- Ensure WorkspaceScanner's cache usage is consistent and well-documented.
- Extend SnapshotService to include `linesAdded`, `linesRemoved`, and `linesTotal` in the `SnapshotDiff` model.
- Update Summary and Session History views to display line-count metrics when available.

**Expected Effect:**  
- Faster repeated scans on large workspaces (already partially implemented).
- Better visibility into high-impact sessions through numeric diff metrics in UI.

#### Implementation Code:

```typescript
// src/models/types.ts - Add to SnapshotDiff interface
export interface SnapshotDiff {
  // ... existing fields ...
  
  /** Total lines added across all changed files */
  linesAdded?: number;
  /** Total lines removed across all changed files */
  linesRemoved?: number;
  /** Total line changes (added + removed) */
  linesTotal?: number;
}
```

```typescript
// src/services/snapshotService.ts - Update compareSnapshots method
async compareSnapshots(
  previous: ProjectSnapshot | null,
  current: ProjectSnapshot,
  rootPath: string,
  config: VibeReportConfig
): Promise<SnapshotDiff> {
  // ... existing code ...

  // Git 변경사항
  let gitChanges: GitChanges | undefined;
  let linesAdded = 0;
  let linesRemoved = 0;
  
  if (config.enableGitDiff) {
    gitChanges = await this.getGitChanges(rootPath);
    
    // Extract line metrics from gitChanges if available
    if (gitChanges?.lineMetrics) {
      for (const metric of gitChanges.lineMetrics) {
        linesAdded += metric.added;
        linesRemoved += metric.deleted;
      }
    }
  }

  return {
    // ... existing fields ...
    gitChanges,
    linesAdded: linesAdded > 0 ? linesAdded : undefined,
    linesRemoved: linesRemoved > 0 ? linesRemoved : undefined,
    linesTotal: (linesAdded + linesRemoved) > 0 ? linesAdded + linesRemoved : undefined,
  };
}
```

```typescript
// src/views/SummaryViewProvider.ts - Display line metrics
private formatDiffSummary(diff: SnapshotDiff): string {
  let summary = `Changes: ${diff.totalChanges}`;
  
  if (diff.linesTotal) {
    summary += ` | Lines: +${diff.linesAdded || 0} / -${diff.linesRemoved || 0}`;
  }
  
  return summary;
}
```

#### Definition of Done:
- [ ] `SnapshotDiff` interface includes `linesAdded`, `linesRemoved`, `linesTotal` optional fields
- [ ] `SnapshotService.compareSnapshots()` populates line metrics from Git diff
- [ ] Summary view displays line metrics when available
- [ ] `pnpm compile` passes
- [ ] `pnpm test` passes

**🎉 ALL PROMPTS COMPLETED!**
