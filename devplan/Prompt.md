# AI Agent Improvement Prompts

> MANDATORY EXECUTION RULES
> 1) Tool-first editing: Always modify files via file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`). Do not respond with text-only suggestions.
> 2) Sequential execution: Execute prompts strictly in order (PROMPT-001 → PROMPT-002 → PROMPT-003 → PROMPT-004 → PROMPT-005 → OPT-1). Do not skip or reorder.
> 3) No placeholders: Write complete, working code and tests. Do not leave TODO stubs or "..." omissions.
> 4) Verify every prompt: Run the verification commands before marking a prompt done.
> 5) Report completion: After each prompt, report touched files, verification results, and the next prompt ID.
> 6) English-only output for this file.

## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Align CI pnpm version with lockfile v9 | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Harden Open Report Preview HTML escaping | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Make Prompt.md checklist parsing resilient | P2 | ⬜ Pending |
| 4 | PROMPT-004 | Increase coverage for extension activation and preview | P2 | ⬜ Pending |
| 5 | PROMPT-005 | Improve evaluation history version labeling | P3 | ⬜ Pending |
| 6 | OPT-1 | Skip unchanged Settings updates in batch save | OPT | ⬜ Pending |

Total: 6 prompts | Completed: 0 | Remaining: 6

---

## P1 Prompts

### [PROMPT-001] Align CI pnpm version with lockfile v9

Execute this prompt now, then proceed to PROMPT-002.

**Linked Improvement ID:** `ci-pnpm-version-001`  
**Priority:** P1

**Task**
Fix the GitHub Actions workflow so CI can install dependencies and run `compile/lint/test/coverage` with the current `pnpm-lock.yaml` (lockfileVersion 9).

**Target files**
- `vibereport-extension/.github/workflows/ci.yml`

**Steps**
1) Update the pnpm setup step to use pnpm `9` (or an explicit `9.x` version).
2) Ensure dependency installation uses `pnpm install --frozen-lockfile`.
3) Keep Node.js at `20` (unless you have a specific reason to change it) and keep pnpm caching enabled.
4) Ensure the workflow still runs `compile`, `lint`, `test:run`, and `test:coverage` in `vibereport-extension`.

**Implementation requirements**
- Do not regenerate or modify the lockfile as part of this change.

**Verification**
- `pnpm -C vibereport-extension install --frozen-lockfile`
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`
- `pnpm -C vibereport-extension run test:coverage`

After completing this prompt, proceed to PROMPT-002.

---

## P2 Prompts

### [PROMPT-002] Harden Open Report Preview HTML escaping

Execute this prompt now, then proceed to PROMPT-003.

**Linked Improvement ID:** `security-openpreview-escape-001`  
**Priority:** P2

**Task**
Harden the custom Markdown-to-HTML renderer used by `vibereport.openReportPreview` so inline code and links are safely escaped (no raw HTML injection via Markdown content).

**Target files**
- `vibereport-extension/src/commands/openReportPreview.ts`
- `vibereport-extension/src/utils/htmlEscape.ts`
- `vibereport-extension/src/commands/__tests__/openReportPreview.test.ts`

**Steps**
1) Add an attribute-escaping helper (e.g. `escapeHtmlAttribute`) or tighten `sanitizeHref()` to reject quotes/angle brackets and then escape the final href.
2) Update inline code rendering to escape the code text (e.g. `` `<` `` becomes `&lt;` inside `<code>`).
3) Update link rendering:
   - keep the allowlist behavior (`#`, `http:`, `https:`, `command:vibereport.*`),
   - escape the link label,
   - ensure the `href` attribute cannot be broken by quotes.
4) Add tests that lock in:
   - inline code containing `<script>` is escaped in the generated HTML,
   - a link with a malicious href (quotes / `<`) is rejected or safely escaped,
   - existing mermaid rendering still works (no regression).

**Implementation requirements**
- Do not rely on CSP alone; the generated HTML must be safe by construction.
- Write complete code and tests; no placeholders.

**Verification**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

After completing this prompt, proceed to PROMPT-003.

---
### [PROMPT-003] Make Prompt.md checklist parsing resilient

Execute this prompt now, then proceed to PROMPT-004.

**Linked Improvement ID:** `quality-prompt-parse-001`  
**Priority:** P2

**Task**
Make the prompt toolchain resilient to `Execution Checklist` heading variations by supporting both:
- `## 📋 Execution Checklist`
- `## Execution Checklist`
across parsing and cleanup code.

**Target files**
- `vibereport-extension/src/commands/generatePrompt.ts`
- `vibereport-extension/src/services/reportService.ts`
- `vibereport-extension/src/commands/updateReportsWorkflow.ts`
- `vibereport-extension/src/utils/reportDoctorUtils.ts`
- `vibereport-extension/src/commands/__tests__/generatePrompt.test.ts`

**Steps**
1) Introduce a shared checklist heading regex (or helper) that treats the leading emoji as optional.
2) Update `GeneratePromptCommand` parsing to find the checklist section with the shared regex.
3) Update `ReportService` and `updateReportsWorkflow` checklist parsing/cleanup code to use the same shared regex.
4) Extend tests to include both heading formats and ensure:
   - prompt IDs are extracted,
   - status icons are parsed,
   - and no prompts disappear due to a missing emoji.

**Implementation requirements**
- Write complete code and tests; no placeholders.

**Verification**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

After completing this prompt, proceed to PROMPT-004.

---

### [PROMPT-004] Increase coverage for extension activation and preview

Execute this prompt now, then proceed to PROMPT-005.

**Linked Improvement ID:** `test-coverage-extension-001`  
**Priority:** P2

**Task**
Increase test coverage for high-impact runtime paths (extension activation and report preview) to reduce regression risk, while keeping behavior unchanged.

**Target files**
- `vibereport-extension/src/extension.ts`
- `vibereport-extension/src/extension.test.ts`
- `vibereport-extension/src/commands/openReportPreview.ts`
- `vibereport-extension/src/commands/__tests__/openReportPreview.test.ts`

**Steps**
1) Add at least one new `activate()` test case covering a different branch than the existing smoke test (e.g. auto-update disabled, or watcher not created).
2) Add tests for `OpenReportPreviewCommand` edge cases that tend to regress:
   - no active editor,
   - non-markdown document,
   - and any new guard/escaping behavior added in PROMPT-002.
3) Run coverage and confirm improvements are reflected in the report (focus on `src/extension.ts` and `src/commands/openReportPreview.ts`).

**Implementation requirements**
- Write complete tests; no placeholders.

**Verification**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`
- `pnpm -C vibereport-extension run test:coverage`

After completing this prompt, proceed to PROMPT-005.

---
## P3 Prompts

### [PROMPT-005] Improve evaluation history version labeling

Execute this prompt now, then proceed to OPT-1.

**Linked Improvement ID:** `feat-evalhistory-version-001`  
**Priority:** P3

**Task**
When the analysis root has no `package.json` version, store a git-based version label instead of `unknown` so the Evaluation Report trend is readable (e.g. `git:abc1234@main`).

**Target files**
- `vibereport-extension/src/commands/updateReportsWorkflow.ts`
- `vibereport-extension/src/services/workspaceScanner.ts`
- `vibereport-extension/src/commands/__tests__/updateReports.test.ts`

**Steps**
1) In `runUpdateReportsWorkflow` (or the evaluation-history step), when `snapshot.mainConfigFiles.packageJson?.version` is missing:
   - use `snapshot.gitInfo.branch` and `snapshot.gitInfo.lastCommitHash` (shortened to 7 chars) to build a label like `git:abc1234@main`.
2) Store that label in `EvaluationHistoryEntry.version` instead of `unknown`.
3) Update the trend table formatting so non-semver labels are not prefixed with `v`.
4) Add/extend tests to cover:
   - no package version + git info present → version label is `git:*`,
   - and the Evaluation Report trend table shows the same label.

**Implementation requirements**
- Write complete code and tests; no placeholders.

**Verification**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

After completing this prompt, proceed to OPT-1.

---

## OPT Prompts

### [OPT-1] Skip unchanged Settings updates in batch save

Execute this prompt now, then proceed to Final Completion.

**Linked Improvement ID:** `opt-settings-skip-unchanged-001`  
**Priority:** OPT

**Task**
Reduce unnecessary config writes by skipping `config.update` calls for Settings keys whose values did not change during a batch save.

**Target files**
- `vibereport-extension/src/views/SettingsViewProvider.ts`
- `vibereport-extension/src/views/__tests__/SettingsViewProvider.test.ts`

**Steps**
1) In `updateSettings(settings: unknown)`, compare each validated value with the current config value.
   - update only changed keys (deep-compare arrays like `excludePatterns`).
2) Keep the user-visible behavior stable:
   - at most one success notification,
   - `sendCurrentSettings()` called once.
3) Add/extend tests to prove:
   - unchanged payload → `config.update` is not called,
   - one changed key → exactly one `config.update` call for that key.

**Implementation requirements**
- Write complete code and tests; no placeholders.

**Verification**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`
- `pnpm -C vibereport-extension run test:coverage`

After completing this prompt, proceed to Final Completion.

---

## Final Completion

After all prompts are done:
1) Run the full verification suite.
2) Confirm `devplan/Project_Evaluation_Report.md`, `devplan/Project_Improvement_Exploration_Report.md`, and `devplan/Prompt.md` are internally consistent (IDs and mappings).
3) Confirm `devplan/Prompt.md` contains no Hangul characters (expected: no matches): `python -c "import pathlib,re; text=pathlib.Path('devplan/Prompt.md').read_text(encoding='utf-8'); assert not re.search(r'[\\uAC00-\\uD7A3]', text)"`.
4) Print: `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`

**Final Verification**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`
- `pnpm -C vibereport-extension run test:coverage`
