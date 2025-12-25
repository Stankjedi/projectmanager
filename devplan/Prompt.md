# AI Agent Improvement Prompts

> **MANDATORY EXECUTION RULES**
> 1. **Tool-first editing:** Always modify files via file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`, or an equivalent patch tool). Do not respond with text-only suggestions.
> 2. **Sequential execution:** Execute prompts strictly in order (PROMPT-001 -> PROMPT-002 -> PROMPT-003 -> PROMPT-004 -> OPT-1). Do not skip or reorder.
> 3. **No placeholders:** Write complete, working code and tests. Do not leave TODO stubs or omitted logic.
> 4. **Verify every prompt:** Run the verification commands before marking a prompt done.
> 5. **Report completion:** After each prompt, report touched files, verification results, and the next prompt ID.
> 6. **English-only output** for this file (no Korean characters).

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Expand Report Doctor managed sections (`doctor-sections-001`) | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Standardize line endings and renormalize (`dev-eol-standardize-001`) | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Generalize WSL mount detection in preflight (`dev-preflight-wsl-mount-001`) | P2 | ⬜ Pending |
| 4 | PROMPT-004 | Add command to open Troubleshooting docs (`feat-open-troubleshooting-001`) | P3 | ⬜ Pending |
| 5 | OPT-1 | Optimize applied-item cleanup performance (`opt-applied-cleanup-perf-001`) | OPT | ⬜ Pending |

> **Total: 5 prompts | Completed: 0 | Remaining: 5**

---

## Priority 1 (Critical)

### [PROMPT-001] Expand Report Doctor managed sections

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-002].
- Status: P1 (Pending)
- Linked Improvement ID: `doctor-sections-001`

**Task:**
Expand Report Doctor validation and repair coverage so it matches all auto-managed sections in the Evaluation and Improvement reports.

**Target files:**
- `vibereport-extension/src/utils/reportDoctorUtils.ts`
- `vibereport-extension/src/utils/markdownUtils.ts`
- `vibereport-extension/src/services/reportTemplates.ts`
- Tests: `vibereport-extension/src/utils/__tests__/reportDoctorUtils.test.ts`

**Steps:**
1. In `reportDoctorUtils.ts`, extend the managed section lists:
   - Evaluation report: add managed sections for TL;DR (`MARKERS.TLDR_*`), Risk Summary (`MARKERS.RISK_SUMMARY_*`), Score Mapping (`MARKERS.SCORE_MAPPING_*`), and Current Summary (`MARKERS.SUMMARY_*`).
   - Improvement report: add managed sections for Project Overview (`MARKERS.OVERVIEW_*`) and Feature List (`MARKERS.FEATURE_LIST_*`).
2. Set `validateTables: true` for the table-driven sections (TL;DR, Risk Summary, Score Mapping, Overview). Keep it `false` for free-form sections (Summary, Feature List).
3. Ensure `repairReportMarkdown()` can restore missing or duplicated blocks for the newly managed sections using the corresponding blocks from the report templates.
4. Update `reportDoctorUtils.test.ts` fixtures so the template/content samples include all required managed markers for the report type being tested.
5. Add at least one new unit test that verifies missing markers for a newly added section are detected (for example: missing `MARKERS.TLDR_END` or missing `MARKERS.FEATURE_LIST_START`).

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-002].

---

## Priority 2 (High)

### [PROMPT-002] Standardize line endings and renormalize

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-003].
- Status: P2 (Pending)
- Linked Improvement ID: `dev-eol-standardize-001`

**Task:**
Make line endings consistent across the repository to reduce cross-platform diffs and snapshot noise (LF for text files; keep binary files untouched).

**Target files:**
- `.gitattributes`
- `vibereport-extension/.gitattributes`

**Steps:**
1. Define a single policy for text files (recommended: `* text=auto eol=lf`) and keep explicit `binary` patterns for assets (`.png`, `.vsix`, etc.).
2. If you keep platform-specific exceptions, make them explicit (for example: `.bat`/`.cmd`/`.ps1` remain CRLF for Windows compatibility).
3. Run `git add --renormalize .` and confirm the diff is line-ending-only (no semantic changes).
4. Ensure Markdown files in the repo are normalized to LF so report snapshots do not churn on Windows/WSL.

**Verification:**
- `git diff --check`
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`

**After Completion:**
- Proceed directly to [PROMPT-003].

### [PROMPT-003] Generalize WSL mount detection in preflight

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-004].
- Status: P2 (Pending)
- Linked Improvement ID: `dev-preflight-wsl-mount-001`

**Task:**
Generalize the WSL mounted-path detection in the test preflight script so it works for any `/mnt/<drive>` path (not just `/mnt/c`), and keep the guidance accurate.

**Target files:**
- `vibereport-extension/scripts/preflightTestEnv.js`
- `vibereport-extension/src/scripts/__tests__/preflightTestEnv.test.ts`
- `vibereport-extension/TROUBLESHOOTING.md`

**Steps:**
1. Update `isWslMountedPath()` to return `true` for `/mnt/<drive>` and its subdirectories (for example: `/mnt/c`, `/mnt/d/dev/repo`) and `false` otherwise.
   - Keep the existing normalization behavior (`\\` to `/`, lowercase).
   - Suggested regex after normalization: `^/mnt/[a-z](/|$)`.
2. Update `printWslRollupFix()` messaging (if needed) so it refers to `/mnt/<drive>` or `/mnt/*` rather than a single drive letter.
3. Update `preflightTestEnv.test.ts` to cover:
   - `/mnt/c` and `/mnt/c/projects/x` => true
   - `/mnt/d` and `/mnt/d/projects/x` => true
   - `/home/user/repo` => false
4. Update `TROUBLESHOOTING.md` so WSL examples are generalized (use `/mnt/<drive>` or `/mnt/*`).

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-004].

## Priority 3 (Feature)

### [PROMPT-004] Add command to open Troubleshooting docs

**Directives:**
- Execute this prompt now, then proceed to [OPT-1].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-open-troubleshooting-001`

**Task:**
Add a VS Code command that opens the extension's `TROUBLESHOOTING.md` so users can access troubleshooting guidance from the Command Palette in one step.

**Target files:**
- `vibereport-extension/package.json` (add a new command contribution)
- `vibereport-extension/src/commands/openTroubleshooting.ts` (new)
- `vibereport-extension/src/commands/index.ts`
- `vibereport-extension/src/extension.ts`
- `vibereport-extension/TROUBLESHOOTING.md`
- Tests under `vibereport-extension/src/commands/__tests__/`

**Steps:**
1. Add a new command contribution in `vibereport-extension/package.json`:
   - command ID: `vibereport.openTroubleshooting`
   - title: `Open Troubleshooting Guide`
   - category: `VibeCoding`
2. Implement `OpenTroubleshootingCommand` in `vibereport-extension/src/commands/openTroubleshooting.ts`:
   - accept `outputChannel` and `extensionUri` (or `extensionPath`) in the constructor
   - build the doc URI with `vscode.Uri.joinPath(extensionUri, 'TROUBLESHOOTING.md')`
   - open it via `vscode.workspace.openTextDocument` and `vscode.window.showTextDocument`
   - on failure, show a warning message and log details to the output channel
3. Export and wire the command in `vibereport-extension/src/commands/index.ts` and register it in `vibereport-extension/src/extension.ts`.
4. Add unit tests that mock VS Code APIs and verify:
   - success path opens the correct URI
   - missing-file path shows a warning and does not throw
5. Ensure `TROUBLESHOOTING.md` is packaged with the extension (do not exclude it via `.vscodeignore` if present).

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [OPT-1].

---

## Optimization (OPT)

### [OPT-1] Optimize applied-item cleanup performance

**Directives:**
- Execute this prompt now, then proceed to Final Completion.
- Status: OPT (Pending)
- Linked Improvement ID: `opt-applied-cleanup-perf-001`

**Task:**
Speed up applied-item cleanup for large Prompt.md and improvement reports by reducing repeated full-document regex scans while preserving behavior.

**Target files:**
- `vibereport-extension/src/services/reportService.ts`
- Tests in `vibereport-extension/src/services/__tests__/reportService.test.ts` (or a new focused test file)

**Steps:**
1. Identify the hot path in `cleanupAppliedItems` / `removeAppliedItemsFromContent` where it loops over IDs/titles and applies multiple global regex passes.
2. Refactor to reduce passes over the full content:
   - prefer a single scan that removes sections by ID rows like `| **ID** | \`doctor-sections-001\` |` and updates the checklist in one pass
   - avoid running expensive cleanup regexes repeatedly when there is no change
3. Preserve the observable behavior:
   - same removal rules (by ID first, then title fallback)
   - same whitespace/section separator normalization
   - same checklist summary update behavior
4. Add tests that cover:
   - multiple applied IDs, mixed prompt IDs and titles
   - large synthetic Prompt.md content (many sections) still produces correct output
   - no changes when there are no applied items
5. Do not change public command behavior; only optimize internals.

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
