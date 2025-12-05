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
| 3 | OPT-001 | Refine markdown/marker pipeline (`opt-markdown-parse-001`) | OPT | ⬜ Pending |
| 4 | OPT-002 | Integrate snapshot cache and diff metrics (`opt-snapshot-diff-001`) | OPT | ⬜ Pending |

**Total: 4 prompts** | **Completed: 0** | **Remaining: 4**

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

### [OPT-001] Refine markdown/marker pipeline (`opt-markdown-parse-001`)

**⏱️ Execute this prompt now, then proceed to OPT-002**

| Field | Value |
|:---|:---|
| **ID** | `opt-markdown-parse-001` |
| **Category** | 🚀 Code Optimization |
| **Impact** | Quality |
| **Target Files** | `src/utils/markdownUtils.ts`, `src/utils/markerUtils.ts`, `src/services/reportService.ts` |

**Current State:**  
- Marker handling has been extracted into `markerUtils.ts`, but some Markdown/table formatting logic is still spread across multiple services.  
- When the report format changes (for example, score table or TL;DR layout), several files must be edited manually.

**Optimization:**  
- Consolidate common table/section rendering helpers into `markdownUtils` and reuse them across the report templates.  
- Ensure all marker-based replacements go through `markerUtils` so that marker semantics are centralized.

**Expected Effect:**  
- Easier modifications to report templates with fewer places to update.  
- Clearer separation between data (scores, risks, improvements) and presentation (Markdown layout).

#### Implementation Code:

```typescript
// Example: extracting a reusable table renderer in markdownUtils.ts
export interface ScoreRow {
  label: string;
  score: number;
  grade: string;
  delta: string;
}

export function renderScoreTable(rows: ScoreRow[]): string {
  const header = [
    "| 항목 | 점수 (100점 만점) | 등급 | 변화 |",
    "|------|------------------|------|------|",
  ];

  const body = rows.map((row) =>
    `| ${row.label} | ${row.score} | ${row.grade} | ${row.delta} |`
  );

  return [...header, ...body].join("\n");
}
```

#### Definition of Done:
- [ ] Common Markdown/table helpers are centralized in `markdownUtils.ts`
- [ ] Marker-based replacements consistently use `markerUtils.ts`
- [ ] `pnpm compile` passes
- [ ] `pnpm test` passes

**✅ After completing this prompt, proceed to [OPT-002]**

---

### [OPT-002] Integrate snapshot cache and diff metrics (`opt-snapshot-diff-001`)

**⏱️ Execute this prompt now - FINAL PROMPT**

| Field | Value |
|:---|:---|
| **ID** | `opt-snapshot-diff-001` |
| **Category** | ⚙️ Performance Tuning |
| **Impact** | Performance / Observability |
| **Target Files** | `src/services/workspaceScanner.ts`, `src/services/snapshotService.ts`, `src/services/snapshotCache.ts` |

**Current State:**  
- `snapshotCache.ts` provides TTL-based caching, but WorkspaceScanner and SnapshotService use it only partially.  
- Diff summaries do not yet include added/removed/total line counts, making it harder to identify large change sessions.

**Optimization:**  
- Add cache lookups for file lists and snapshot data in WorkspaceScanner, falling back to recomputation only when needed.  
- Extend SnapshotService to compute and store line-count metrics in the diff summary model.

**Expected Effect:**  
- Faster repeated scans on large workspaces.  
- Better visibility into high-impact sessions through numeric diff metrics.

#### Implementation Code:

```typescript
// Example: using snapshot cache in workspaceScanner.ts
import { getCachedValue, setCachedValue } from "./snapshotCache.js";

async function collectFilesWithCache(
  rootPath: string,
  excludeGlobs: string[],
  maxFilesToScan: number,
  log: (msg: string) => void
): Promise<string[]> {
  const cacheKey = `file-list:${rootPath}:${maxFilesToScan}`;
  const cached = getCachedValue<string[]>(cacheKey);

  if (cached) {
    log(`Using cached file list (${cached.length} files)`);
    return cached;
  }

  // ... perform file scan, then cache result ...
  setCachedValue(cacheKey, files);
  log(`Scanned ${files.length} files (cached for 30s)`);
  return files;
}
```

#### Definition of Done:
- [ ] WorkspaceScanner uses `snapshotCache` for file lists and/or snapshots
- [ ] Snapshot diffs include line-count metrics for added/removed/total lines
- [ ] `pnpm compile` passes
- [ ] `pnpm test` passes

**🎉 ALL PROMPTS COMPLETED!**
