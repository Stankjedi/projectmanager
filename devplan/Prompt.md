# AI Agent Improvement Prompts

> **MANDATORY EXECUTION RULES**
> 1. **Tool-first editing:** Always modify files via file-edit tools (`apply_patch` or an equivalent patch tool). Do not respond with text-only suggestions.
> 2. **Sequential execution:** Execute prompts strictly in order (PROMPT-001 -> PROMPT-002 -> PROMPT-003 -> PROMPT-004 -> PROMPT-005 -> OPT-1). Do not skip or reorder.
> 3. **No placeholders:** Write complete, working code and tests. Do not leave TODO stubs or omitted logic.
> 4. **Verify every prompt:** Run the verification commands before marking a prompt done.
> 5. **Report completion:** After each prompt, report touched files, verification results, and the next prompt ID.
> 6. **English-only file:** This file must contain only English text.
> 7. **Do not disclose secrets:** Never open, paste, or log token/key/credential contents (e.g., `*token*`, `*secret*`, `*key*`, `.env*`, `vsctoken.txt`). If encountered, redact immediately.

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Validate path-based settings (`security-path-traversal-001`) | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Redact secret-like patterns in custom instructions (`security-custom-instructions-redaction-001`) | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Unify sensitive path detection (`quality-sensitive-path-detection-001`) | P2 | ⬜ Pending |
| 4 | PROMPT-004 | Harden share preview metadata parsing (`quality-share-preview-metadata-parsing-001`) | P2 | ⬜ Pending |
| 5 | PROMPT-005 | Copy all pending prompts in order (`feat-copy-all-prompts-001`) | P3 | ⬜ Pending |
| 6 | OPT-1 | Cap structure summary output (`opt-structure-summary-cap-001`) | OPT | ⬜ Pending |

> **Total: 6 prompts | Completed: 0 | Remaining: 6**

---

## Priority P1

### [PROMPT-001] Validate path-based settings (reportDirectory, snapshotFile)

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-002].
- Status: P1 (Pending)
- Linked Improvement ID: `security-path-traversal-001`

**Task:**
Prevent path traversal and unintended writes by validating that `vibereport.reportDirectory` and `vibereport.snapshotFile` are workspace-relative subpaths (no absolute paths, no `..` escapes). Fail safely with clear errors and/or safe fallbacks.

**Target files:**
- `vibereport-extension/src/utils/configUtils.ts`
- `vibereport-extension/src/services/reportService.ts`
- `vibereport-extension/src/services/snapshotService.ts`
- `vibereport-extension/src/views/SettingsViewProvider.ts`
- Tests: add/update a suitable test under `vibereport-extension/src/utils/__tests__/` and/or `vibereport-extension/src/services/__tests__/`.

**Steps:**
1. Introduce a shared "subpath validation" helper:
   - Accept a workspace root and a user-supplied path.
   - Reject absolute paths.
   - Reject any resolution that escapes the workspace root.
   - Reuse the same logic style as `resolveAnalysisRootPortable(...)` in `analysisRootUtils.ts`.
2. Apply validation to the path-based settings:
   - Validate at `loadConfig()` (preferred) and/or validate right before writing/reading:
     - `ReportService.getReportPaths()` / `ensureReportDirectory()`
     - `SnapshotService.getStatePath()`
3. Update Settings UI validation:
   - When the user submits invalid values, show a validation error and do not persist invalid settings.
4. Tests:
   - Add valid cases (e.g., `devplan`, `.vscode/vibereport-state.json`).
   - Add invalid cases (e.g., `../outside`, `/abs/path`, `C:\\abs\\path`).
   - Ensure the behavior is deterministic across platforms.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-002].

---

## Priority P2

### [PROMPT-002] Redact secret-like patterns in custom instructions

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-003].
- Status: P2 (Pending)
- Linked Improvement ID: `security-custom-instructions-redaction-001`

**Task:**
Reduce the risk of accidental secret leakage by redacting secret-like patterns from `vibereport.ai.customInstructions` before they are embedded into the analysis prompt, while preserving the intent of the instructions as much as possible.

**Target files:**
- `vibereport-extension/src/utils/analysisPromptTemplate.ts`
- `vibereport-extension/src/utils/redactionUtils.ts`
- Tests: `vibereport-extension/src/utils/__tests__/analysisPromptTemplate.test.ts`

**Steps:**
1. Detect and redact:
   - Apply `redactSecretLikePatterns(...)` to custom instructions before adding them to the prompt.
   - Avoid changing formatting more than necessary.
2. Add a safety note:
   - If redaction changed the text, add a short line in the prompt indicating that redaction was applied.
3. Tests:
   - Add a test where custom instructions contain a token-like string (e.g., `sk-...`) and assert that the prompt contains a redacted placeholder instead of the raw token.
   - Add a negative test where normal text remains unchanged.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-003].

---

### [PROMPT-003] Unify sensitive path detection in analysis prompt template

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-004].
- Status: P2 (Pending)
- Linked Improvement ID: `quality-sensitive-path-detection-001`

**Task:**
Make sensitive file detection consistent (and avoid false positives) by removing the local heuristic in `analysisPromptTemplate.ts` and reusing the shared `isSensitivePath(...)` implementation from `sensitiveFilesUtils.ts`.

**Target files:**
- `vibereport-extension/src/utils/analysisPromptTemplate.ts`
- `vibereport-extension/src/utils/sensitiveFilesUtils.ts`
- Tests: `vibereport-extension/src/utils/__tests__/analysisPromptTemplate.test.ts`

**Steps:**
1. Replace the local `isSensitivePath(...)` helper in `analysisPromptTemplate.ts`:
   - Import and use `isSensitivePath` from `sensitiveFilesUtils.ts`.
   - Ensure path normalization stays correct for both Windows and POSIX separators.
2. Keep behavior stable:
   - Ensure sensitive files are still excluded from "Recently added files" and TODO/FIXME findings tables.
   - Ensure the "Sensitive files detected" list remains informative without leaking file contents.
3. Tests:
   - Add a regression test for a false-positive filename (e.g., `src/monkey.ts`) to ensure it is NOT treated as sensitive.
   - Ensure existing sensitive cases remain covered (e.g., `.env*`, `vsctoken.txt`).

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-004].

---

### [PROMPT-004] Harden share preview metadata parsing (version + overall score)

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-005].
- Status: P2 (Pending)
- Linked Improvement ID: `quality-share-preview-metadata-parsing-001`

**Task:**
Make share preview metadata extraction more robust by deriving the preview version and overall score from marker-extracted sections (TL;DR and score table), instead of brittle regex scans over the entire evaluation report markdown.

**Target files:**
- `vibereport-extension/src/commands/shareReportPreview.ts`
- Tests: `vibereport-extension/src/commands/__tests__/shareReportPreview.test.ts`, `vibereport-extension/src/commands/__tests__/exportReportBundle.test.ts`

**Steps:**
1. Version extraction:
   - Use the TL;DR marker block (already extracted via `extractBetweenMarkersLines(...)`) and parse its markdown table rows.
   - Support both localized labels (Korean and English), including the TL;DR row for the current version.
2. Overall score extraction:
   - Use the already extracted `scoreTable` (from the score marker block) and parse table rows/cells.
   - Prefer the row that represents the overall average (localized label), such as "Total Average" in English; fall back to a safe heuristic only if needed.
3. Fallback behavior:
   - Keep the current regex-based extraction only as a fallback when marker sections are missing.
4. Tests:
   - Add a fixture evaluation markdown that includes both marker blocks and assert the preview contains the correct version and overall score line.
   - Add a regression test to ensure unrelated heading changes do not break metadata parsing.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-005].

---

## Priority P3

### [PROMPT-005] Copy all pending prompts in order (one-click workflow)

**Directives:**
- Execute this prompt now, then proceed to [OPT-1].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-copy-all-prompts-001`

**Task:**
Improve the prompt execution workflow by adding a "copy all pending items in order" option to the prompt picker, so users can copy the full set of pending prompts (and optionally OPT items) as a single, ordered clipboard payload.

**Target files:**
- `vibereport-extension/src/commands/generatePrompt.ts`
- Tests: `vibereport-extension/src/commands/__tests__/generatePrompt.test.ts`

**Steps:**
1. Add a dedicated action in the picker UI:
   - Provide a clearly labeled option like "Copy all pending prompts (in order)".
   - Keep existing multi-select behavior unchanged.
2. Define ordering:
   - Sort prompts by `PROMPT-###` numeric order.
   - If OPT items are included, place them after prompts, ordered by `OPT-#`.
3. Define content output:
   - Join each selected prompt section with `---` separators.
   - Keep the "next prompt" flow intact inside each section.
4. Tests:
   - Add a test that seeds Prompt.md content with multiple pending prompts and verifies the clipboard payload ordering.
   - Add a test that done prompts are excluded and in-progress prompts remain included.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [OPT-1].

---

## Optimization (OPT)

### [OPT-1] Cap structure summary output (entries per directory)

**Directives:**
- Execute this prompt now, then proceed to Final Completion.
- Status: OPT (Pending)
- Linked Improvement ID: `opt-structure-summary-cap-001`

**Task:**
Reduce runtime and prompt size in large workspaces by adding a per-directory cap to `WorkspaceScanner` structure summaries, while keeping deterministic ordering and readable output.

**Target files:**
- `vibereport-extension/src/services/workspaceScanner.ts`
- Tests: `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts`

**Steps:**
1. Implement a per-directory entry cap:
   - Add a constant like `MAX_ENTRIES_PER_DIR = 50` (or a config-backed value if you prefer, but keep defaults safe).
   - When a directory has more entries than the cap, include only the first N entries (after filtering and sorting), plus a final "summary node" that indicates how many were omitted.
2. Preserve deterministic ordering:
   - Keep the existing "directories first, then files" sort.
   - Ensure the summary node is always last.
3. Tests:
   - Add a test that simulates a directory with > N entries and asserts the output includes the summary node.
   - Add a test that ordering is stable and deterministic.

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
   - `pnpm -C vibereport-extension run doctor:check`
2. Confirm Prompt.md contains only English text.
3. Print a completion message:
   - `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`
