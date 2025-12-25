# AI Agent Improvement Prompts

> **MANDATORY EXECUTION RULES**
> 1. **Tool-first editing:** Always modify files via file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`, or an equivalent patch tool). Do not respond with text-only suggestions.
> 2. **Sequential execution:** Execute prompts strictly in order (PROMPT-001 -> PROMPT-002 -> PROMPT-003 -> OPT-1). Do not skip or reorder.
> 3. **No placeholders:** Write complete, working code and tests. Do not leave TODO stubs or omitted logic.
> 4. **Verify every prompt:** Run the verification commands before marking a prompt done.
> 5. **Report completion:** After each prompt, report touched files, verification results, and the next prompt ID.
> 6. **English-only output** for this file (no Korean characters).

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Fix docs version mismatch (CHANGELOG/README) (`docs-version-sync-001`) | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Update extension README version references (`docs-extension-readme-version-001`) | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Add Report Doctor action to auto-fix docs versions (`feat-doctor-docs-autofix-001`) | P3 | ⬜ Pending |
| 4 | OPT-1 | Raise Vitest coverage thresholds (`opt-coverage-thresholds-001`) | OPT | ⬜ Pending |

> **Total: 4 prompts | Completed: 0 | Remaining: 4**

---

## Priority 1 (Critical)

### [PROMPT-001] Fix docs version mismatch (CHANGELOG/README)

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-002].
- Status: P1 (Pending)
- Linked Improvement ID: `docs-version-sync-001`

**Task:**
Bring documentation versions back in sync with `vibereport-extension/package.json` so `docsConsistency.test.ts` passes.

**Target files:**
- `vibereport-extension/package.json` (source of truth)
- `vibereport-extension/CHANGELOG.md`
- `README.md`
- Test: `vibereport-extension/src/docsConsistency.test.ts`

**Steps:**
1. Read the version from `vibereport-extension/package.json` (expected: `0.4.33`) and treat it as the single source of truth.
2. Update `vibereport-extension/CHANGELOG.md`:
   - Change the first version header `## [x.y.z]` to match the package version.
   - If there is a date in the heading, keep it accurate for the release (use today's date only if appropriate).
3. Update `README.md`:
   - Ensure the first version string in the file matches the package version.
   - Update any related installation examples that reference the old VSIX filename/version (for example: `vibereport-0.4.32.vsix`) to the new version, so the README is internally consistent.
4. Run verification and confirm `docsConsistency` tests no longer fail.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-002].

---

## Priority 2 (High)

### [PROMPT-002] Update extension README version references

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-003].
- Status: P2 (Pending)
- Linked Improvement ID: `docs-extension-readme-version-001`

**Task:**
Update `vibereport-extension/README.md` so all installation and release references match the current package version.

**Target files:**
- `vibereport-extension/README.md`
- (Optional) `README.md`
- (Reference) `vibereport-extension/package.json`

**Steps:**
1. Read the current package version from `vibereport-extension/package.json` (expected: `0.4.33`).
2. In `vibereport-extension/README.md`, update all versioned references to match the package version:
   - version badge text
   - release notes header (if present)
   - VSIX filename examples (for example: `vibereport-0.4.33.vsix`)
   - GitHub release URLs (if versioned)
   - any `code --install-extension` examples
3. Ensure the README remains internally consistent (no mixed `0.4.32` / `0.4.33` references).
4. Run verification to confirm nothing else broke.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-003].

## Priority 3 (Feature)

### [PROMPT-003] Add Report Doctor action to auto-fix docs versions

**Directives:**
- Execute this prompt now, then proceed to [OPT-1].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-doctor-docs-autofix-001`

**Task:**
Add a "Fix Docs Versions" action to Report Doctor that automatically updates docs to match the package version when docs sync issues are detected.

**Target files:**
- `vibereport-extension/src/commands/reportDoctor.ts`
- `vibereport-extension/src/utils/reportDoctorUtils.ts` (optional helper)
- `vibereport-extension/CHANGELOG.md`
- `README.md`
- Tests: `vibereport-extension/src/commands/__tests__/reportDoctor.test.ts`

**Steps:**
1. In `reportDoctor.ts`, when `docsIssues.length > 0`, include an additional modal action: `Fix Docs Versions` (or `Sync Docs Versions`) alongside the existing actions.
2. Implement a safe docs-fix routine:
   - Use the already parsed `packageVersion` as the source of truth.
   - Update `vibereport-extension/CHANGELOG.md` by replacing only the first version header matching `^##\\s*\\[(\\d+\\.\\d+\\.\\d+)\\]` with the package version.
   - Update the root `README.md` by replacing only the first version occurrence matching `(\\d+\\.\\d+\\.\\d+)` with the package version.
   - Preserve the original newline style of each file (LF/CRLF) and avoid touching unrelated content.
3. After writing, re-run `validateDocsVersionSync()` and report the result:
   - If still mismatched, show a warning with details.
   - If fixed, show an information message and log the changed files.
4. Update/add unit tests in `reportDoctor.test.ts`:
   - Arrange a docs mismatch scenario.
   - Mock the `Fix Docs Versions` action selection.
   - Assert `writeFile` is called with updated contents for README and CHANGELOG.
   - Assert the command reports success (message + output channel log).

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [OPT-1].

---

## Optimization (OPT)

### [OPT-1] Raise Vitest coverage thresholds

**Directives:**
- Execute this prompt now, then proceed to Final Completion.
- Status: OPT (Pending)
- Linked Improvement ID: `opt-coverage-thresholds-001`

**Task:**
Increase `vitest.config.ts` coverage thresholds to better reflect current coverage and prevent silent regressions.

**Target files:**
- `vibereport-extension/vitest.config.ts`

**Steps:**
1. Update the coverage `thresholds` in `vitest.config.ts` to a safer baseline (based on current coverage ~86/71/85/88):  
   - statements: 80  
   - branches: 60  
   - functions: 75  
   - lines: 80
2. Update the thresholds comment to reflect the new baseline date and rationale.
3. Run coverage and confirm the thresholds are enforced (and still passing).

**Verification:**
- `pnpm -C vibereport-extension run test:coverage`

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
