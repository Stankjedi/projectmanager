# AI Agent Improvement Prompts

> **MANDATORY EXECUTION RULES**
> 1. **Tool-first editing:** Always modify files via file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`). Do not respond with text-only suggestions.
> 2. **Sequential execution:** Execute prompts strictly in order (PROMPT-001 → ... → PROMPT-005 → OPT-1). Do not skip or reorder.
> 3. **No placeholders:** Write complete, working code and tests. Do not leave TODO stubs or "..." omissions.
> 4. **Verify every prompt:** Run the verification commands before marking a prompt done.
> 5. **Report completion:** After each prompt, report touched files, verification results, and the next prompt ID.
> 6. **English-only output** for this file.

## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Fix GitHub Actions pnpm Version Mismatch | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Harden Open Report Preview Security (XSS) | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Improve Prompt Header Parsing Robustness | P2 | ⬜ Pending |
| 4 | PROMPT-004 | Enhance Extension Entry Point Test Coverage | P2 | ⬜ Pending |
| 5 | PROMPT-005 | Add Git Commit Hash Label to Evaluation History | P3 | ⬜ Pending |
| 6 | OPT-1 | Skip unchanged Settings updates in batch save | OPT | ⬜ Pending |

> **Total: 6 prompts | Completed: 0 | Remaining: 6**

---

## 🔴 Priority 1 (Critical)

### [PROMPT-001] Fix GitHub Actions pnpm Version Mismatch

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-002].
- Status: P1 (Pending)
- Linked Improvement ID: `ci-pnpm-version-001`

**Task:**
The CI workflow handles `pnpm-lock.yaml` (v9) incorrectly because `pnpm-action` uses a default version (likely v8). You must enforce `pnpm` version 9 in the GitHub Actions workflow to match the local environment.

**Target files:**
- `.github/workflows/ci.yml`

**Steps:**
1. Open `.github/workflows/ci.yml`.
2. Locate the step using `pnpm/action-setup`.
3. Add or update the `version` field to `9`.

**Implementation Details:**
- Ensure the workflow runs `pnpm install` successfully.

**Verification:**
- Since you cannot run GitHub Actions locally, verify that the file content is syntactically correct.
- Run `pnpm install` locally to ensure the lockfile is still valid (sanity check).

**After Completion:**
- Proceed directly to [PROMPT-002].

---

## 🟡 Priority 2 (High)

### [PROMPT-002] Harden Open Report Preview Security (XSS)

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-003].
- Status: P2 (Pending)
- Linked Improvement ID: `security-openpreview-escape-001`

**Task:**
Harden the custom Markdown-to-HTML renderer used by `vibereport.openReportPreview` so inline code and links are safely escaped (no raw HTML injection via Markdown content).

**Target files:**
- `vibereport-extension/src/commands/openReportPreview.ts`

**Steps:**
1. Ensure all dynamic insertions in HTML generation are using an escaping function.
2. Update inline code rendering to escape the code text.
3. Update link rendering to `escapeHtml` the label and ensure `rel="noopener noreferrer"` is added for external links.

**Verification:**
- `pnpm -C vibereport-extension run test:run` (Verify no regressions)

**After Completion:**
- Proceed directly to [PROMPT-003].


---

### [PROMPT-003] Improve Prompt Header Parsing Robustness

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-004].
- Status: P2 (Pending)
- Linked Improvement ID: `quality-prompt-parse-001`

**Task:**
Make the prompt toolchain resilient to `Execution Checklist` heading variations by supporting both `## 📋 Execution Checklist` and `## Execution Checklist`.

**Target files:**
- `vibereport-extension/src/commands/generatePrompt.ts`

**Steps:**
1. Update `GeneratePromptCommand` parsing logic to use a regex that treats the emoji as optional.
2. Ensure it can parse the checklist status correctly even if the header changes.

**Verification:**
- `pnpm -C vibereport-extension run test:run`
- Verify that `generatePrompt` works with both header styles.

**After Completion:**
- Proceed directly to [PROMPT-004].

---

### [PROMPT-004] Enhance Extension Entry Point Test Coverage

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-005].
- Status: P2 (Pending)
- Linked Improvement ID: `test-coverage-extension-001`

**Task:**
Increase test coverage for high-impact runtime paths (extension activation) to reduce regression risk.

**Target files:**
- `vibereport-extension/src/extension.ts`
- `vibereport-extension/src/test/extension.test.ts` (or `extension.test.ts`)

**Steps:**
1. Add new test cases to `extension.test.ts` that call `activate()`.
2. Verify that commands are registered.
3. Handle potential exceptions during activation in tests.

**Verification:**
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-005].


---

## 🟢 Priority 3 (Feature)

### [PROMPT-005] Add Git Commit Hash Label to Evaluation History

**Directives:**
- Execute this prompt now, then proceed to [OPT-1].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-evalhistory-version-001`

**Task:**
When `package.json` version is missing, use Git Short Hash as the version label in Evaluation History to improve traceability.

**Target files:**
- `vibereport-extension/src/services/workspaceScanner.ts`
- `vibereport-extension/src/commands/updateReportsWorkflow.ts`

**Steps:**
1. Modify the logic that determines the project version.
2. If `package.json` version is null/undefined, check `Snapshot.gitInfo`.
3. If git info exists, return `git:<short_hash>` (7 chars).
4. Verify that the trend table in Evaluation Report displays this label correctly.

**Verification:**
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [OPT-1].

---

## ⚙️ Optimization (OPT)

### [OPT-1] Skip unchanged Settings updates in batch save

**Directives:**
- Execute this prompt now, then proceed to Final Completion.
- Status: OPT (Pending)
- Linked Improvement ID: `opt-settings-skip-unchanged-001`

**Task:**
Reduce config I/O by skipping `update()` calls if the value hasn't changed.

**Target files:**
- `vibereport-extension/src/views/SettingsViewProvider.ts`

**Steps:**
1. In the `saveAll` or update loop, read the current config value using `inspect` or `get`.
2. Compare with the new value.
3. Only call `config.update(...)` if they differ.

**Verification:**
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to Final Completion.

---

## ✅ Final Completion

**Instructions:**
1. Run a full verification suite: `pnpm -C vibereport-extension run test:run`.
2. Ensure that `Prompt.md` itself contains NO Korean characters.
3. Print the final success message:
   `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`

