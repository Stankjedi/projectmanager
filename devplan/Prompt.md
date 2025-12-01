# 🤖 AI Agent Improvement Prompts

> **Action Required:** Use your file editing tools to apply the following prompts sequentially. Confirm completion after each step.

---

## 📋 Execution Checklist & Summary

| Priority | ID | Task | Status |
|---|---|---|---|
| 🟡 **P2** | `report-test-001` | Add focused unit tests for `ReportService` | ⬜️ |
| 🟡 **P2** | `docs-sync-001` | Sync `README.md` and configuration docs | ⬜️ |
| 🟢 **P3** | `share-export-001` | Add `Export Reports` command for team sharing | ⬜️ |
| 🟢 **P3** | `scoring-config-001`| Make evaluation scoring configurable | ⬜️ |

---

## 🟡 [P2] Important Improvements

### 1. Task: Add focused unit tests for `ReportService`

**ID:** `report-test-001`

```
Please perform the following tasks:

1. Create a new test file: `vibereport-extension/src/services/__tests__/reportService.test.ts`.
2. Write Vitest unit tests for the `ReportService`.
3. **Mock `fs/promises` and `vscode`** to ensure the tests are isolated from the file system and VS Code UI.
4. Verify the following core behaviors:
    - `updateEvaluationReport` correctly replaces content within the `<!-- AUTO-SCORE-START -->` and `<!-- AUTO-SUMMARY-START -->` markers.
    - `updateImprovementReport` correctly filters out already-applied improvements and updates the `<!-- AUTO-SUMMARY-START -->` section.
    - New session logs are **prepended** inside the `<!-- AUTO-SESSION-LOG-START -->` block.
    - The correct language template (`ko` or `en`) is used based on the configuration.

Target files:
- `vibereport-extension/src/services/reportService.ts`
- `vibereport-extension/src/services/__tests__/reportService.test.ts` (new)

Use this skeleton to start:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';

// Mock dependencies
vi.mock('fs/promises', async () => ({
  ...(await vi.importActual<typeof fs>('fs/promises')),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('vscode', async () => {
    const actualVscode = await vi.importActual<typeof vscode>('vscode');
    return {
        ...actualVscode,
        Uri: { file: (p: string) => ({ fsPath: p }) },
        workspace: { 
            getConfiguration: () => ({
                get: (key: string) => {
                    if (key === 'language') return 'ko';
                    if (key === 'reportDirectory') return 'devplan';
                    // Add other config mocks as needed
                    return undefined;
                }
            })
        },
        window: { 
            ...actualVscode.window,
            createOutputChannel: () => ({ appendLine: vi.fn(), dispose: vi.fn(), show: vi.fn() })
        },
    };
});


import { ReportService } from '../reportService';
import type { VibeReportConfig } from '../../models/types';

describe('ReportService', () => {
  let service: ReportService;
  const output = { appendLine: vi.fn() } as any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportService(output);
  });

  it('should update the score and summary sections of the evaluation report', async () => {
    // Arrange: Mock readFile to return a template with markers
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockResolvedValue(`<!-- AUTO-SCORE-START -->old score<!-- AUTO-SCORE-END --><!-- AUTO-SUMMARY-START -->old summary<!-- AUTO-SUMMARY-END -->`);
    const mockWriteFile = vi.mocked(fs.writeFile);

    // Act
    await service.updateEvaluationReport(
        '/fake/ws', 
        { reportDirectory: 'devplan', language: 'ko' } as VibeReportConfig,
        {} as any,
        {} as any,
        'test prompt',
        'test summary'
    );

    // Assert
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    expect(writtenContent).toContain('<!-- AUTO-SCORE-START -->');
    expect(writtenContent).toContain('<!-- AUTO-SUMMARY-START -->');
    expect(writtenContent).not.toContain('old score');
    expect(writtenContent).not.toContain('old summary');
  });
});
```

**Verification:**
- Run `pnpm test` and ensure all new and existing tests pass.
```

---

### 2. Task: Sync README and configuration docs

**ID:** `docs-sync-001`

```
Please perform the following tasks:

1.  **Update Architecture Diagram:** In `vibereport-extension/README.md`, modify the architecture section to accurately reflect the `src/` directory structure. Remove any mention of obsolete files like `aiClient.ts`.
2.  **Sync Configuration Table:** In the same `README.md`, regenerate the "Configuration" table to match the properties defined in `vibereport-extension/package.json` under `contributes.configuration`.
3.  **Add New Command Usage:** Add examples for new commands like `vibereport.openPrompt` and `vibereport.showSessionDetail`.
4.  **Mention API Docs:** Add a brief note about the TypeDoc-generated API documentation, instructing users to run `pnpm run docs` and check the `docs/` folder.

Target files:
- `vibereport-extension/README.md`
- `vibereport-extension/package.json` (for reference)

Example of an up-to-date configuration row in `README.md`:
```md
| Setting | Description | Default |
|---|---|---|
| `vibereport.language` | The language for generated reports (`ko` or `en`). | `ko` |
```

**Verification:**
- Manually review `README.md` to confirm it matches the current codebase.
- Run `pnpm run docs` to ensure it completes without errors.
```

---

## 🟢 [P3] Nice-to-have Improvements

### 3. Task: Add 'Export Reports' command

**ID:** `share-export-001`

```
Please perform the following tasks:

1.  **Add Command:** In `vibereport-extension/package.json`, add a new command contribution:
    - ID: `vibereport.exportReports`
    - Title: `Vibe Report: Export Reports for Sharing`
    - Category: `Vibe Report`
2.  **Implement Handler:** In `vibereport-extension/src/extension.ts` (or a new command file), create the handler for `vibereport.exportReports`.
3.  **Functionality:** The handler should:
    - Prompt the user to select a destination folder using `vscode.window.showSaveDialog`.
    - Copy the entire `devplan` directory to the selected location as a ZIP archive. You can use a library like `jszip`.
    - Show an information message upon successful export.
4.  **Update Docs:** Add a small section to `vibereport-extension/README.md` explaining how to use the new export feature.

Target files:
- `vibereport-extension/package.json`
- `vibereport-extension/src/extension.ts`
- `vibereport-extension/README.md`

**Verification:**
- Compile the extension (`pnpm run compile`).
- Test the `Vibe Report: Export Reports for Sharing` command in the Extension Development Host.
```

---

### 4. Task: Make evaluation scoring configurable

**ID:** `scoring-config-001`

```
Please perform the following tasks:

1.  **Extend Config Type:** In `vibereport-extension/src/models/types.ts`, add an optional `scoring` property to the `VibeReportConfig` interface. This should allow specifying category weights.
    ```ts
    scoring?: {
      weights?: Partial<Record<EvaluationCategory, number>>;
    };
    ```
2.  **Add Setting:** In `vibereport-extension/package.json`, add a new configuration setting `vibereport.scoring.weights` with a description that explains how users can assign custom weights to evaluation categories.
3.  **Update Logic:** In `vibereport-extension/src/utils/markdownUtils.ts`, refactor `formatScoreTable` to:
    - Read the `scoring.weights` from the configuration.
    - Apply these weights when calculating the total average score.
    - If no weights are provided, default to equal weighting for all categories.
4.  **Update Tests:** Adjust any relevant unit tests in `markdownUtils.test.ts` to cover the new weighting logic.

Target files:
- `vibereport-extension/src/models/types.ts`
- `vibereport-extension/src/utils/markdownUtils.ts`
- `vibereport-extension/package.json`
- `vibereport-extension/src/utils/__tests__/markdownUtils.test.ts`

**Verification:**
- Run `pnpm test` to ensure all tests pass.
- Manually test in the Extension Development Host by setting custom weights in `settings.json` and verifying the change in the generated report.
```
---

*Last Updated: 2025-12-01 17:16 (v0.2.1)*