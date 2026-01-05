# AI Agent Improvement Prompts

> **MANDATORY EXECUTION RULES**
> 1. **Tool-first editing:** Always modify files via file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`, or an equivalent patch tool). Do not respond with text-only suggestions.
> 2. **Sequential execution:** Execute prompts strictly in order (PROMPT-001 -> PROMPT-002 -> PROMPT-003 -> PROMPT-004 -> PROMPT-005 -> OPT-1). Do not skip or reorder.
> 3. **No placeholders:** Write complete, working code and tests. Do not leave TODO stubs or omitted logic.
> 4. **Verify every prompt:** Run the verification commands before marking a prompt done.
> 5. **Report completion:** After each prompt, report touched files, verification results, and the next prompt ID.
> 6. **English-only content** for this file (no Hangul characters).

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Make export bundle safe by default (`security-export-bundle-redaction-001`) | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Use marker-based extraction for share preview (`quality-share-preview-marker-extraction-001`) | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Redact secret-like patterns in TODO/FIXME findings (`security-todo-fixme-findings-redaction-001`) | P2 | ⬜ Pending |
| 4 | PROMPT-004 | Remove or ignore repo artifact file (`repo-ignore-artifacts-001`) | P2 | ⬜ Pending |
| 5 | PROMPT-005 | Localize share preview language + date (`feat-share-preview-i18n-001`) | P3 | ⬜ Pending |
| 6 | OPT-1 | Parallelize TODO/FIXME content reads (`opt-todo-scan-parallel-001`) | OPT | ⬜ Pending |

> **Total: 6 prompts | Completed: 0 | Remaining: 6**

---

## Priority P1

### [PROMPT-001] Make export bundle safe by default (redaction + metadata sanitization)

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-002].
- Status: P1 (Pending)
- Linked Improvement ID: `security-export-bundle-redaction-001`

**Task:**
Harden `ExportReportBundleCommand` so exported bundles are share-safe by default: avoid leaking absolute paths / command URIs in bundle outputs when redaction is enabled (default), and sanitize `metadata.json` to avoid embedding local absolute paths.

**Target files:**
- `vibereport-extension/src/commands/exportReportBundle.ts`
- `vibereport-extension/src/utils/redactionUtils.ts`
- (Optional) `vibereport-extension/package.json` (only if you add a new setting)
- Tests: `vibereport-extension/src/commands/__tests__/exportReportBundle.test.ts`

**Steps:**
1. Define a "share-safe export" policy:
   - When `vibereport.sharePreviewRedactionEnabled` is `true`, treat the bundle as safe-to-share:
     - Redact exported markdown files (`Project_Evaluation_Report.md`, `Project_Improvement_Exploration_Report.md`, `Prompt.md`, `Share_Preview.md`) using `redactForSharing(...)`.
     - Sanitize bundle metadata so it does not contain local absolute paths.
   - When the setting is `false`, export raw content (current behavior).
2. Sanitize `metadata.json`:
   - Do not write `workspaceRoot` as an absolute path when redaction is enabled.
   - Replace it with `workspaceName` (e.g., `path.basename(workspaceRoot)`) or a fixed placeholder.
   - Keep the JSON schema stable and backward compatible.
3. Update tests:
   - With redaction enabled, assert exported bundle outputs do **not** contain absolute path patterns (for example `/Users/`, `C:\\`, `/mnt/`) and do **not** contain `command:` URIs.
   - Keep existing assertions for `evaluation-history.json` and the `redactionEnabled` flag.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-002].

---

## Priority P2

### [PROMPT-002] Use marker-based extraction for share preview (remove header dependency)

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-003].
- Status: P2 (Pending)
- Linked Improvement ID: `quality-share-preview-marker-extraction-001`

**Task:**
Refactor Share Report and Export Bundle preview generation so TL;DR and score extraction is marker-based (not dependent on Korean section headers), and eliminate duplicated preview-building logic.

**Target files:**
- `vibereport-extension/src/commands/shareReport.ts`
- `vibereport-extension/src/commands/exportReportBundle.ts`
- (Optional) `vibereport-extension/src/commands/shareReportPreview.ts` (shared helpers)
- Tests: `vibereport-extension/src/commands/__tests__/shareReportPreview.test.ts`, `vibereport-extension/src/commands/__tests__/exportReportBundle.test.ts`

**Steps:**
1. Replace score extraction with marker-based extraction:
   - Extract the score section using `<!-- AUTO-SCORE-START -->` and `<!-- AUTO-SCORE-END -->`.
   - Pass the extracted section to `extractScoreTable(...)`.
   - Do not rely on the `###` header text.
2. Ensure TL;DR extraction remains marker-based:
   - Prefer `<!-- AUTO-TLDR-START -->` and `<!-- AUTO-TLDR-END -->` (or keep `TLDR-START/END`), but do not rely on language-specific headings.
3. Deduplicate preview markdown generation:
   - Extract the common "share preview markdown" builder into a shared helper (for example in `shareReportPreview.ts`) and reuse it from both commands.
4. Update tests:
   - Update fixtures to include `<!-- AUTO-SCORE-END -->` and remove any dependency on a language-specific score header line.
   - Add at least one case where the score section has no trailing header line, and extraction still works.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-003].

---

### [PROMPT-003] Redact secret-like patterns in TODO/FIXME findings

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-004].
- Status: P2 (Pending)
- Linked Improvement ID: `security-todo-fixme-findings-redaction-001`

**Task:**
Prevent accidental leakage of secrets via TODO/FIXME findings by redacting secret-like patterns (tokens/keys) before findings are written into markdown reports.

**Target files:**
- `vibereport-extension/src/services/workspaceScanner/todoFixmeScanner.ts`
- `vibereport-extension/src/services/reportService/improvementFormatting.ts`
- Tests: `vibereport-extension/src/services/__tests__/todoFixmeScanner.test.ts`
- (Optional) `vibereport-extension/src/utils/redactionUtils.ts` (shared redaction patterns)

**Steps:**
1. Define a small, conservative redaction function for findings text:
   - Mask common token/key prefixes (examples: `ghp_`, `sk-`, `AKIA...`, `AIza...`) and long high-entropy strings.
   - Keep it conservative to avoid excessive false positives in normal TODO text.
2. Apply redaction:
   - Apply when building findings (preferred) or right before rendering the findings table in `formatTodoFixmeFindingsSection(...)`.
   - Ensure the redacted output still respects existing truncation limits and table escaping.
3. Tests:
   - Add a test with a TODO line containing a token-like string and assert it is masked in output.
   - Add a negative test where normal text remains unchanged.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-004].

---

### [PROMPT-004] Remove or ignore repo artifact file

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-005].
- Status: P2 (Pending)
- Linked Improvement ID: `repo-ignore-artifacts-001`

**Task:**
Clean up repository artifacts so report scanning and repo hygiene are consistent: ensure `tmp_lines.txt` is not tracked and is ignored going forward.

**Target files:**
- `.gitignore`
- `tmp_lines.txt` (if present in the repository)

**Steps:**
1. Confirm `tmp_lines.txt` is not referenced by the codebase (keep evidence in the PR description, not in the repo).
2. Add `tmp_lines.txt` to `.gitignore`.
3. If `tmp_lines.txt` is tracked in git, remove it from the repository (keep it locally only if you need it).
4. Ensure report scanning does not treat it as a meaningful source file (optional: add it to default exclude patterns if necessary).

**Verification:**
- `git status -sb`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-005].

---

## Priority P3

### [PROMPT-005] Localize share preview language + date (config.language)

**Directives:**
- Execute this prompt now, then proceed to [OPT-1].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-share-preview-i18n-001`

**Task:**
Make share preview output consistent with the configured report language: the Share Report preview and the Export Bundle `Share_Preview.md` should render headings/labels and the date locale based on `vibereport.language` (`ko` or `en`).

**Target files:**
- `vibereport-extension/src/commands/shareReport.ts`
- `vibereport-extension/src/commands/exportReportBundle.ts`
- Tests: `vibereport-extension/src/commands/__tests__/shareReportPreview.test.ts`, `vibereport-extension/src/commands/__tests__/exportReportBundle.test.ts`

**Steps:**
1. Load the configured language:
   - Use `loadConfig()` (or VS Code config) to read `language` (`ko` or `en`).
2. Localize preview headings/labels:
   - For `en`, ensure the preview headings/labels are English (for example: "Summary (TL;DR)", "Detailed Scores", "More Details").
   - For `ko`, preserve the existing Korean output (do not break existing behavior).
3. Localize the date:
   - Use a locale appropriate for the configured language (for example: `en-US` vs `ko-KR`).
   - Keep tests deterministic using fake timers.
4. Tests:
   - Extend `shareReportPreview.test.ts` to cover both `language: 'en'` and `language: 'ko'` (mock config accordingly).
   - Extend `exportReportBundle.test.ts` to assert the generated `Share_Preview.md` is localized when `language` is `en`.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [OPT-1].

---

## Optimization (OPT)

### [OPT-1] Parallelize TODO/FIXME scan with a concurrency limit

**Directives:**
- Execute this prompt now, then proceed to Final Completion.
- Status: OPT (Pending)
- Linked Improvement ID: `opt-todo-scan-parallel-001`

**Task:**
Speed up TODO/FIXME scanning by parallelizing content reads with a concurrency limit, while preserving the current cache behavior and deterministic result ordering.

**Target files:**
- `vibereport-extension/src/services/workspaceScanner/todoFixmeScanner.ts`
- Tests: `vibereport-extension/src/services/__tests__/todoFixmeScanner.test.ts`

**Steps:**
1. Reuse the existing concurrency helper and keep the current `fs.stat` parallelization as-is.
2. Parallelize content reads:
   - Build a list of candidate files that need reading (not cached for the current signature, under size limits).
   - Read file contents with a concurrency limit (e.g., 8-16) and extract findings.
3. Preserve behavior:
   - Preserve deterministic ordering by merging findings in the original candidate order after parallel reads finish.
   - Preserve size limits, max findings, cache keys, and caching semantics.
4. Tests:
   - Ensure existing tests still pass.
   - Add at least one assertion that output ordering is stable and unaffected by concurrency.

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
   - `pnpm -C vibereport-extension run bundle`
2. Confirm `devplan/Prompt.md` contains no Hangul characters.
3. Print the final success message:
   `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`
