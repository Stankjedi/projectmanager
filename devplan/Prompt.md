# 🤖 Improvement Prompts for AI Agent

## 🚨 MANDATORY: FILE MODIFICATION REQUIRED

⛔ DO NOT respond with text or code blocks only  
⛔ DO NOT say "modify like this" without actually modifying  
✅ YOU MUST use file editing tools (create_file, replace_string_in_file, etc.)  
✅ Confirm "I have modified the file(s)" after each action

---

## 📋 Execution Checklist

| # | Priority | Prompt | Status |
|---|----------|--------|--------|
| 1 | 🟡 P2 | Add focused unit tests for ReportService | ⬜ |
| 2 | 🟡 P2 | Sync README and configuration docs | ⬜ |
| 3 | 🟢 P3 | Add Export Reports command for team sharing | ⬜ |
| 4 | 🟢 P3 | Make evaluation scoring configurable | ⬜ |

---

## 🟡 [P2] Important Improvements

### 1. Add focused unit tests for `ReportService`

**⏱️ Execute this prompt now, then proceed to PROMPT-002**

```
Please perform the following tasks:

1. Create a new test file `src/services/__tests__/reportService.test.ts`.
2. Write Vitest unit tests for `ReportService.updateEvaluationReport` and
   `ReportService.updateImprovementReport`.
3. Mock `fs/promises` and `vscode` so tests do not touch the real filesystem or UI.
4. Verify the following behaviors:
   - The overview section between `<!-- AUTO-OVERVIEW-START -->` and
     `<!-- AUTO-OVERVIEW-END -->` is updated with the latest snapshot
     (project name, version, files, directories, main language, framework).
   - The score table between `<!-- AUTO-SCORE-START -->` and
     `<!-- AUTO-SCORE-END -->` is replaced when `evaluationScores` is provided.
   - The improvement report keeps only non-applied items and updates the summary
     between `<!-- AUTO-SUMMARY-START -->` and `<!-- AUTO-SUMMARY-END -->`.
   - New session log entries are prepended inside the
     `<!-- AUTO-SESSION-LOG-START -->` / `<!-- AUTO-SESSION-LOG-END -->` block.

Target files:
- vibereport-extension/src/services/reportService.ts
- vibereport-extension/src/services/__tests__/reportService.test.ts

Example test skeleton (adapt as needed):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('vscode', () => ({
  Uri: { file: (p: string) => ({ fsPath: p }) },
  workspace: {
    openTextDocument: vi.fn(),
    showTextDocument: vi.fn(),
  },
  window: {
    createOutputChannel: () => ({ appendLine: vi.fn(), dispose: vi.fn() }),
  },
}));

import { ReportService } from '../reportService.js';
import type {
  ProjectSnapshot,
  SnapshotDiff,
  VibeReportConfig,
} from '../../models/types.js';

describe('ReportService', () => {
  let service: ReportService;
  const output = { appendLine: vi.fn() } as any;
  const config: VibeReportConfig = {
    reportDirectory: 'devplan',
    snapshotFile: '.vscode/vibereport-state.json',
    enableGitDiff: false,
    excludePatterns: [],
    maxFilesToScan: 5000,
    autoOpenReports: true,
    language: 'ko',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportService(output);
  });

  it('updates evaluation report overview and score sections', async () => {
    const snapshot = {
      projectName: 'projectmanager',
      filesCount: 38,
      dirsCount: 14,
      languageStats: { ts: 24 },
      mainConfigFiles: { packageJson: { version: '0.1.0' } },
    } as ProjectSnapshot;

    const diff = { isInitial: false } as SnapshotDiff;

    // TODO: mock readFile/writeFile to assert updated content
    // and ensure markers are preserved.
    await service.updateEvaluationReport(
      '/workspace',
      config,
      snapshot,
      diff,
      'Test prompt',
      'AI summary',
    );
  });
});
```

Verification:
- Run: `pnpm test`
- Expected: All tests pass including new reportService tests

**✅ After completing this prompt, proceed to [PROMPT-002]**

---

### 2. Sync README and configuration docs with the current extension behavior

**⏱️ Execute this prompt now, then proceed to PROMPT-003**

```
Please perform the following tasks:

1. Update the architecture section of `README.md` so it matches the actual `src/`
   layout:
   - Remove references to `aiClient.ts` (the file no longer exists).
   - Ensure services, views, tests, and utils match the current folder structure.
2. Regenerate the "Configuration" table in `README.md` from the
   `contributes.configuration` block in `package.json`:
   - Document keys like `vibereport.reportDirectory`,
     `vibereport.snapshotFile`, `vibereport.enableGitDiff`,
     `vibereport.maxFilesToScan`, `vibereport.autoOpenReports`,
     `vibereport.language`, etc.
   - Keep descriptions short and action-focused.
3. Add usage examples for the newer commands:
   - `vibereport.openPrompt`
   - `vibereport.showSessionDetail`
   - Auto-refresh behavior when `devplan/*.md` changes.
4. Ensure that any TypeDoc-generated docs (from `pnpm run docs`) are mentioned:
   - Either link to the generated `docs/` folder from the README, or
   - Add a short "API Docs" section pointing to TypeDoc output.

Target files:
- vibereport-extension/README.md
- vibereport-extension/package.json

Example snippet for aligning configuration docs:

```md
| Setting | Description | Default |
|--------|-------------|---------|
| `vibereport.reportDirectory` | Relative path where devplan reports are stored. | `devplan` |
| `vibereport.snapshotFile` | Path to the snapshot state JSON file. | `.vscode/vibereport-state.json` |
| `vibereport.enableGitDiff` | Enable Git-based change analysis for snapshots. | `true` |
| `vibereport.maxFilesToScan` | Maximum number of files to scan in the workspace. | `5000` |
| `vibereport.autoOpenReports` | Automatically open reports after updating. | `true` |
| `vibereport.language` | Default language for generated reports (`ko` or `en`). | `ko` |
```

Verification:
- Manually review README.md matches current codebase
- Run: `pnpm run docs` to verify TypeDoc generates without errors

**✅ After completing this prompt, proceed to [PROMPT-003]**

---

## 🟢 [P3] Nice-to-have Improvements

### 3. Add an `Export Reports` command for team sharing

**⏱️ Execute this prompt now, then proceed to PROMPT-004**

```
Please perform the following tasks:

1. Add a new command contribution to `package.json`:
   - Command ID: `vibereport.exportReports`
   - Title: `Export Project Reports`
   - Category: `VibeCoding`

2. Implement a command handler that:
   - Asks the user for an export directory
     (using `vscode.window.showOpenDialog` or a similar API).
   - Copies the entire `devplan/` folder (evaluation, improvement, Prompt)
     into the chosen location.
   - Optionally compresses the folder into a single ZIP or generates a single
     combined Markdown file.

3. Register the command in `extension.ts` after the existing report commands,
   and log progress to the shared output channel (`Vibe Report`).

4. Update `README.md` with a short "Team Sharing" section describing how to
   use the export command.

Target files:
- vibereport-extension/package.json
- vibereport-extension/src/extension.ts
- vibereport-extension/README.md

Example command registration stub:

```ts
context.subscriptions.push(
  vscode.commands.registerCommand('vibereport.exportReports', async () => {
    const rootPath = getRootPath();
    if (!rootPath) return;

    // TODO: ask for target directory and copy devplan/ there
    outputChannel.appendLine(
      '[ExportReports] Exporting devplan reports for sharing...',
    );
  }),
  );
```

Verification:
- Run: `pnpm run compile`
- Test the command manually in Extension Development Host

**✅ After completing this prompt, proceed to [PROMPT-004]**

---

### 4. Make evaluation scoring configurable via settings

**⏱️ Execute this prompt now**

```
Please perform the following tasks:1. Extend `VibeReportConfig` in `src/models/types.ts` to add an optional
   `scoring` field that allows per-category weights or enabled flags, for example:

   ```ts
   export interface VibeReportConfig {
     reportDirectory: string;
     snapshotFile: string;
     enableGitDiff: boolean;
     excludePatterns: string[];
     maxFilesToScan: number;
     autoOpenReports: boolean;
     language: 'ko' | 'en';
     scoring?: {
       enabledCategories?: EvaluationCategory[];
       weights?: Partial<Record<EvaluationCategory, number>>;
     };
   }
   ```

2. Add a new configuration entry in `package.json` under
   `contributes.configuration.properties` for scoring, for example:
   - `vibereport.scoring.enabledCategories`
   - `vibereport.scoring.weights`

   Each key should be documented so users understand how to enable/disable
   categories and set weights.

3. Update `formatScoreTable` (and any related helpers) in
   `src/utils/markdownUtils.ts` so it:
   - Reads the scoring config from `VibeReportConfig`.
   - Filters out disabled categories.
   - Applies weights when computing the total average.

4. Optionally, update the evaluation report text
   (`devplan/Project_Evaluation_Report.md`) to briefly explain that scoring can
   be customized via settings.

Target files:
- vibereport-extension/src/models/types.ts
- vibereport-extension/src/utils/markdownUtils.ts
- vibereport-extension/package.json
- devplan/Project_Evaluation_Report.md (optional explanatory text)

Example adjustment in `formatScoreTable`:

```ts
const categories: EvaluationCategory[] =
  config.scoring?.enabledCategories ?? [
    'codeQuality',
    'architecture',
    'security',
    'performance',
    'testCoverage',
    'errorHandling',
    'documentation',
    'scalability',
    'maintainability',
    'productionReadiness',
  ];
```

Verification:
- Run: `pnpm run compile`
- Run: `pnpm test`
- Test with custom settings in Extension Development Host

**🎉 ALL PROMPTS COMPLETED! Run final verification with `pnpm test`.**

---

*Last Updated*: 2025-12-01 09:42  
*Generated for*: projectmanager (vibereport-extension)

