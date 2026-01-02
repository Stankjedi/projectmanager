# AI Agent Improvement Prompts

> **MANDATORY EXECUTION RULES**
> 1. **Tool-first editing:** Always modify files via file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`, or an equivalent patch tool). Do not respond with text-only suggestions.
> 2. **Sequential execution:** Execute prompts strictly in order (PROMPT-001 -> PROMPT-002 -> PROMPT-003 -> PROMPT-004 -> PROMPT-005 -> OPT-1). Do not skip or reorder.
> 3. **No placeholders:** Write complete, working code and tests. Do not leave TODO stubs or omitted logic.
> 4. **Verify every prompt:** Run the verification commands before marking a prompt done.
> 5. **Report completion:** After each prompt, report touched files, verification results, and the next prompt ID.
> 6. **English-only content** for this file (no Korean characters).

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Add sensitive files guard to Report Doctor (`sec-sensitive-files-001`) | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Add marketplace itemName checks to docsConsistency (`test-docs-marketplace-001`) | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Add newline preservation tests for docs auto-fix (`test-doctor-docs-fix-newlines-001`) | P2 | ⬜ Pending |
| 4 | PROMPT-004 | Add "Fix All Safe Issues" action to Report Doctor (`feat-doctor-fix-all-001`) | P3 | ⬜ Pending |
| 5 | PROMPT-005 | Add snapshot storage mode option (`feat-snapshot-storage-mode-001`) | P3 | ⬜ Pending |
| 6 | OPT-1 | Modularize markdown markers/constants (`opt-markdown-utils-modularize-001`) | OPT | ⬜ Pending |

> **Total: 6 prompts | Completed: 0 | Remaining: 6**

---

## Priority 1 (Critical)

### [PROMPT-001] Add sensitive files guard to Report Doctor

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-002].
- Status: P1 (Pending)
- Linked Improvement ID: `sec-sensitive-files-001`

**Task:**
Prevent accidental secret leakage by adding a Report Doctor check for sensitive files (tokens/keys/.env) and providing safe, actionable guidance before users share/export reports.

**Target files:**
- `vibereport-extension/src/commands/reportDoctor.ts`
- `vibereport-extension/src/utils/reportDoctorUtils.ts`
- `vibereport-extension/src/services/workspaceScanner/fileCollector.ts`
- New: `vibereport-extension/src/utils/sensitiveFilesUtils.ts`
- Tests: `vibereport-extension/src/utils/__tests__/sensitiveFilesUtils.test.ts`, `vibereport-extension/src/commands/__tests__/reportDoctor.test.ts`

**Steps:**
1. Create a shared sensitive-path detector:
   - Add `vibereport-extension/src/utils/sensitiveFilesUtils.ts` exporting `isSensitivePath(relativePath: string): boolean`.
   - Move the current sensitive-path logic from `vibereport-extension/src/services/workspaceScanner/fileCollector.ts` into that function (keep `.env.example` as an allowed exception).
2. Wire the scanner to the shared detector:
   - In `vibereport-extension/src/services/workspaceScanner/fileCollector.ts`, replace the local `isSensitivePath` implementation with an import from `../../utils/sensitiveFilesUtils.js`.
3. Add a Doctor issue type and detection helper:
   - In `vibereport-extension/src/utils/reportDoctorUtils.ts`, extend `ReportDoctorIssueCode` with `SENSITIVE_FILES_PRESENT`.
   - Export `findSensitiveFiles(fileList: string[]): string[]` that returns at most 20 repo-relative paths and uses `isSensitivePath`.
4. Integrate the check into the Report Doctor command:
   - In `vibereport-extension/src/commands/reportDoctor.ts`, collect a file list for the selected analysis root (use `vscode.workspace.findFiles('**/*', excludePattern, config.maxFilesToScan)` and convert to repo-relative POSIX paths).
   - Call `findSensitiveFiles(...)`.
   - If any are found:
     - Always log a summary in the OutputChannel (count + first N paths).
     - If `config.includeSensitiveFiles === true`, show a warning modal that encourages disabling the setting before proceeding. Offer actions: `Open Settings` and `Continue`.
     - If `config.includeSensitiveFiles === false`, show an information message only (do not block).
   - Do not read file contents; only operate on paths.
5. Add tests:
   - Add `vibereport-extension/src/utils/__tests__/sensitiveFilesUtils.test.ts` covering `.env`, `.env.local`, `.env.example`, `vsctoken.txt`, `api_token.json`, `private.pem`, `id_rsa.key`, and a non-sensitive file like `README.md`.
   - In `vibereport-extension/src/commands/__tests__/reportDoctor.test.ts`, mock `vscode.workspace.findFiles` to return a token-like file and assert the warning path is triggered when `includeSensitiveFiles=true`.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-002].

---

## Priority 2 (High)

### [PROMPT-002] Add marketplace itemName checks to docsConsistency

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-003].
- Status: P2 (Pending)
- Linked Improvement ID: `test-docs-marketplace-001`

**Task:**
Strengthen docs consistency tests by validating that all VS Code Marketplace links/badges in README files use the current `publisher.name` (itemName) from `vibereport-extension/package.json`.

**Target files:**
- `vibereport-extension/package.json` (source of truth)
- `vibereport-extension/src/docsConsistency.test.ts`
- `README.md`
- (Optional input) `vibereport-extension/README.md`

**Steps:**
1. In `docsConsistency.test.ts`, read `publisher` and `name` from `vibereport-extension/package.json` and compute `expectedMarketplaceItemName = \`\${publisher}.\${name}\``.
2. In `README.md`, extract every marketplace itemName and assert they all match:
   - Marketplace URL regex: `/marketplace\\.visualstudio\\.com\\/items\\?itemName=([\\w.-]+)/g`
   - Marketplace badge regex: `/img\\.shields\\.io\\/visual-studio-marketplace\\/(?:v|d)\\/([\\w.-]+)/g`
   - Assert at least one match exists across URLs+badges, and every distinct match equals `expectedMarketplaceItemName`.
3. Make failure messages actionable:
   - Include the expected itemName and the mismatched distinct values found.
4. Keep the existing docsConsistency checks unchanged.

**Verification:**
- `pnpm -C vibereport-extension run test:run`
- `pnpm -C vibereport-extension run lint`

**After Completion:**
- Proceed directly to [PROMPT-003].

---

### [PROMPT-003] Add newline preservation tests for docs auto-fix

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-004].
- Status: P2 (Pending)
- Linked Improvement ID: `test-doctor-docs-fix-newlines-001`

**Task:**
Add regression tests ensuring `fixDocsVersionSync()` preserves the original newline style (LF/CRLF) while updating only the intended version strings.

**Target files:**
- `vibereport-extension/src/utils/reportDoctorUtils.ts`
- `vibereport-extension/src/utils/__tests__/reportDoctorUtils.test.ts`

**Steps:**
1. In `reportDoctorUtils.test.ts`, import `fixDocsVersionSync` from `../reportDoctorUtils.js`.
2. Add a CRLF-focused test:
   - Create `readmeContent` with `\\r\\n` newlines containing:
     - a version like `0.0.1`
     - a VSIX example `vibereport-0.0.1.vsix`
     - a versioned release URL `releases/download/v0.0.1/vibereport-0.0.1.vsix`
   - Create `changelogContent` with `\\r\\n` newlines containing a top header like `## [0.0.1]`.
   - Run `fixDocsVersionSync({ packageVersion: '9.9.9', readmeContent, changelogContent })`.
   - Assert:
     - Both outputs still use CRLF only (no lone `\\n`): they must not match `/[^\\r]\\n/`.
     - All updated versions equal `9.9.9` (README first version occurrence, VSIX examples, release URL, CHANGELOG top header).
3. Add a no-op test:
   - Provide inputs already matching `packageVersion: '9.9.9'`.
   - Assert `changed.readme === false`, `changed.changelog === false`, and contents are unchanged.

**Verification:**
- `pnpm -C vibereport-extension run test:run`
- `pnpm -C vibereport-extension run lint`

**After Completion:**
- Proceed directly to [PROMPT-004].

---

## Priority 3 (Feature)

### [PROMPT-004] Add "Fix All Safe Issues" action to Report Doctor

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-005].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-doctor-fix-all-001`

**Task:**
Add a single "Fix All Safe Issues" action to Report Doctor that runs all safe, automated fixes (report marker repair + docs version sync) and then re-validates.

**Target files:**
- `vibereport-extension/src/commands/reportDoctor.ts`
- `vibereport-extension/src/utils/reportDoctorUtils.ts`
- Tests: `vibereport-extension/src/commands/__tests__/reportDoctor.test.ts`

**Steps:**
1. In `reportDoctor.ts`, include a new modal action `Fix All Safe Issues` whenever there is at least one safe-fixable issue:
   - Safe-fixable = (a) docs version sync issues detected by `validateDocsVersionSync()` and/or (b) marker/table issues in evaluation/improvement reports that `repairReportMarkdown()` can repair.
2. Implement the action handler:
   - If docs issues exist and `packageVersion` is available, run the existing docs fix (`fixDocsVersionSync`) and write back `README.md` + `CHANGELOG.md` when changed.
   - For each report target:
     - If `target.type` is `evaluation` or `improvement` and `issues.length > 0`, run `repairReportMarkdown({ content, template, type })`.
     - Write the repaired content only when `changed === true` and `issuesAfter.length === 0`.
     - Continue even if one file cannot be repaired, but log details.
   - Re-run validation by re-reading targets/docs and re-running `validateReportMarkdown` + `validateDocsVersionSync`.
   - Show an information message if no issues remain; otherwise show a warning and log remaining issues.
3. Keep Prompt.md behavior unchanged: it should still not be auto-repaired, but the summary must mention if prompt issues remain.
4. Add tests:
   - Arrange a workspace with docs mismatch and repairable report marker issues.
   - Mock `showWarningMessage` to resolve to `Fix All Safe Issues`.
   - Assert `fs.writeFile` is called for docs and evaluation/improvement, and that `showInformationMessage` reports a successful fix.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-005].

---

### [PROMPT-005] Add snapshot storage mode option

**Directives:**
- Execute this prompt now, then proceed to [OPT-1].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-snapshot-storage-mode-001`

**Task:**
Add an option to store vibereport snapshot state outside of the workspace folder to reduce repo noise and accidental commits.

**Target files:**
- `vibereport-extension/src/models/types.ts`
- `vibereport-extension/src/utils/configUtils.ts`
- `vibereport-extension/src/services/snapshotService.ts`
- `vibereport-extension/src/extension.ts`
- Call sites: `vibereport-extension/src/commands/updateReports.ts`, `vibereport-extension/src/commands/reportDoctor.ts`, `vibereport-extension/src/views/HistoryViewProvider.ts`, `vibereport-extension/src/views/SummaryViewProvider.ts`, `vibereport-extension/src/commands/cleanHistory.ts`, `vibereport-extension/src/commands/setProjectVision.ts`
- Tests: update impacted tests (snapshotService + command mocks)

**Steps:**
1. Add a new config field:
   - In `VibeReportConfig`, add `snapshotStorageMode: 'workspaceFile' | 'vscodeStorage'`.
   - In `DEFAULT_CONFIG` and `loadConfig()`, set/read `snapshotStorageMode` (default: `workspaceFile`).
2. Extend `SnapshotService` to support vscode storage:
   - Add constructor param `storageRoot?: string` and store it.
   - Update `getStatePath()`:
     - If `snapshotStorageMode === 'workspaceFile'`, keep existing behavior (`path.join(rootPath, config.snapshotFile)`).
     - If `snapshotStorageMode === 'vscodeStorage'` and `storageRoot` is set, write state under a per-workspace subdir (use a stable hash of `rootPath`), e.g. `<storageRoot>/vibereport/<hash>/vibereport-state.json`.
3. Wire `storageRoot` from extension activation:
   - Pass `context.globalStorageUri.fsPath` into every `SnapshotService` instantiation path (commands and views) so vscode storage mode can work.
4. Update tests:
   - Fix config mocks to include `snapshotStorageMode`.
   - Add at least one `snapshotService` unit test that uses `snapshotStorageMode: 'vscodeStorage'` and asserts the computed path is under the provided `storageRoot`.
5. Ensure backwards compatibility:
   - Default behavior remains unchanged unless the new setting is enabled.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [OPT-1].

---

## Optimization (OPT)

### [OPT-1] Modularize markdown markers/constants

**Directives:**
- Execute this prompt now, then proceed to Final Completion.
- Status: OPT (Pending)
- Linked Improvement ID: `opt-markdown-utils-modularize-001`

**Task:**
Reduce coupling to the large `markdownUtils.ts` module by extracting `MARKERS` into a dedicated module and re-exporting for backwards compatibility.

**Target files:**
- New: `vibereport-extension/src/utils/markdownMarkers.ts`
- `vibereport-extension/src/utils/markdownUtils.ts`
- `vibereport-extension/src/utils/reportDoctorUtils.ts`
- Tests updated as needed

**Steps:**
1. Create `vibereport-extension/src/utils/markdownMarkers.ts` and move the `MARKERS` constant definition into it (export it as `export const MARKERS = { ... } as const;`).
2. In `vibereport-extension/src/utils/markdownUtils.ts`:
   - Remove the in-file `MARKERS` constant definition.
   - Add `import { MARKERS } from './markdownMarkers.js';` for internal use.
   - Add `export { MARKERS } from './markdownMarkers.js';` to keep existing imports working.
3. In `vibereport-extension/src/utils/reportDoctorUtils.ts`, import `MARKERS` from `./markdownMarkers.js` (do not import it from `./markdownUtils.js`).
4. Run the test suite and ensure no imports break.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to Final Completion.

---

## Final Completion

**Instructions:**
1. Run a full verification suite:
   - `pnpm -C vibereport-extension run compile`
   - `pnpm -C vibereport-extension run lint`
   - `pnpm -C vibereport-extension run test:run`
   - `pnpm -C vibereport-extension run test:coverage`
2. Ensure that `devplan/Prompt.md` contains no Korean characters.
3. Print the final success message:
   `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`
