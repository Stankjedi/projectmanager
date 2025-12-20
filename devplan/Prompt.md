# AI Agent Improvement Prompts

> **MANDATORY EXECUTION RULES**
> 1. **Tool-first editing:** Always modify files via file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`). Do not respond with text-only suggestions.
> 2. **Sequential execution:** Execute prompts strictly in order (PROMPT-001 → PROMPT-002 → PROMPT-003 → PROMPT-004 → PROMPT-005 → OPT-1). Do not skip or reorder.
> 3. **No placeholders:** Write complete, working code and tests. Do not leave TODO stubs or "..." omissions.
> 4. **Verify every prompt:** Run the verification commands before marking a prompt done.
> 5. **Report completion:** After each prompt, report touched files, verification results, and the next prompt ID.
> 6. **English-only output** for this file (no non-English characters).

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Stop tracking vibereport state file | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Activate CI workflow at repo root | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Increase branch coverage for critical paths | P2 | ⬜ Pending |
| 4 | PROMPT-004 | Modularize reportService.ts (reduce monolith) | P2 | ⬜ Pending |
| 5 | PROMPT-005 | Add TODO/FIXME scanning to improvement report | P3 | ⬜ Pending |
| 6 | OPT-1 | Skip report writes when content unchanged | OPT | ⬜ Pending |

> **Total: 6 prompts | Completed: 0 | Remaining: 6**

---

## Priority 1 (Critical)

### [PROMPT-001] Stop tracking vibereport state file

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-002].
- Status: P1 (Pending)
- Linked Improvement ID: `security-statefile-tracking-001`

**Task:**
Prevent leaking local/session data and reduce git noise by removing `.vscode/vibereport-state.json` from version control and ignoring it going forward.

**Target files:**
- `.gitignore`
- `.vscode/vibereport-state.json`

**Steps:**
1. Update the root `.gitignore` to ignore the state file.
2. Remove the file from git tracking (keep it locally) using `git rm --cached`.
3. Ensure the extension still works locally (the state file should still be generated/updated locally).

**Implementation Details:**

Add this line to `.gitignore`:
```gitignore
.vscode/vibereport-state.json
```

Untrack the file (do not delete locally):
```bash
git rm --cached .vscode/vibereport-state.json
```

**Verification:**
- `git status --porcelain` shows `.vscode/vibereport-state.json` as removed and not re-added.
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-002].

---

## Priority 2 (High)

### [PROMPT-002] Activate CI workflow at repo root

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-003].
- Status: P2 (Pending)
- Linked Improvement ID: `ci-workflow-location-001`

**Task:**
Ensure GitHub Actions actually runs by placing the CI workflow under the repository root at `.github/workflows/ci.yml` (GitHub Actions ignores nested `.github/` folders).

**Target files:**
- `.github/workflows/ci.yml`
- `vibereport-extension/.github/workflows/ci.yml`

**Steps:**
1. Create `.github/workflows/ci.yml` at the repo root.
2. Copy the existing job logic from `vibereport-extension/.github/workflows/ci.yml`.
3. Keep `working-directory: vibereport-extension` so commands run in the extension package.
4. Optionally delete the nested workflow file to avoid confusion.

**Implementation Details:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: vibereport-extension

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: vibereport-extension/pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Compile
        run: pnpm run compile

      - name: Lint
        run: pnpm run lint

      - name: Test
        run: pnpm run test:run

      - name: Coverage
        run: pnpm run test:coverage
```

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-003].

---

### [PROMPT-003] Increase branch coverage for critical paths

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-004].
- Status: P2 (Pending)
- Linked Improvement ID: `test-branch-coverage-001`

**Task:**
Increase regression detection by adding branch-focused tests for low-covered utilities and edge/error paths. Target: raise overall branch coverage from ~54% to **≥60%** (or at least **+5pp**).

**Target files:**
- `vibereport-extension/src/utils/htmlEscape.ts`
- `vibereport-extension/src/utils/timeUtils.ts`
- `vibereport-extension/src/utils/promptChecklistUtils.ts`
- `vibereport-extension/src/utils/__tests__/htmlEscape.test.ts` (new)
- `vibereport-extension/src/utils/__tests__/timeUtils.test.ts` (new)
- `vibereport-extension/src/utils/__tests__/promptChecklistUtils.test.ts` (new)

**Steps:**
1. Add unit tests for `escapeHtml` and `escapeHtmlAttribute` (quotes, ampersands, newlines).
2. Add unit tests for `formatDuration` to cover all branches (days / hours / minutes / seconds).
3. Add unit tests for checklist parsing utilities:
   - `EXECUTION_CHECKLIST_HEADING_REGEX` matches with and without the emoji.
   - `extractExecutionChecklistBlock()` returns the checklist block and stops at the next section or `---`.
4. Run coverage and confirm branch coverage increases.

**Implementation Details:**
- `escapeHtmlAttribute()` must escape `\\r` and `\\n` to `&#13;` / `&#10;`.
- `formatDuration()` branch expectations:
  - `formatDuration(61_000)` => `1\\uBD84 1\\uCD08`
  - `formatDuration(3_600_000)` => `1\\uC2DC\\uAC04 0\\uBD84`
  - `formatDuration(86_400_000)` => `1\\uC77C 0\\uC2DC\\uAC04`
- Checklist block extraction should support both headers:
  - `## 📋 Execution Checklist`
  - `## Execution Checklist`

**Verification:**
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`
- `pnpm -C vibereport-extension run test:coverage` (confirm improved branch coverage)

**After Completion:**
- Proceed directly to [PROMPT-004].

---

### [PROMPT-004] Modularize reportService.ts (reduce monolith)

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-005].
- Status: P2 (Pending)
- Linked Improvement ID: `refactor-reportservice-modularize-001`

**Task:**
Reduce maintenance and regression risk by extracting the large template builders out of `reportService.ts` while keeping public behavior and APIs intact.

**Target files:**
- `vibereport-extension/src/services/reportService.ts`
- `vibereport-extension/src/services/reportTemplates.ts` (new)

**Steps:**
1. Create `reportTemplates.ts` exporting:
   - `createEvaluationTemplate(...)`
   - `createImprovementTemplate(...)`
   - `createSessionHistoryTemplate(...)`
2. Keep the generated content identical (same marker blocks and headings).
3. Update `ReportService` to call the extracted functions instead of class methods.
4. Keep TypeScript types strict (no `any`) and remove dead imports after extraction.
5. Run the full test suite to ensure there are no behavior regressions.

**Implementation Details:**

```ts
import type { ProjectSnapshot } from '../models/types.js';

export function createEvaluationTemplate(args: {
  snapshot: ProjectSnapshot;
  language: 'ko' | 'en';
  mainLanguage: string;
  framework: string;
}): string;

export function createImprovementTemplate(args: {
  snapshot: ProjectSnapshot;
  language: 'ko' | 'en';
}): string;

export function createSessionHistoryTemplate(): string;
```

In `reportService.ts`, replace these call sites with extracted functions:
- `this.createEvaluationTemplate(snapshot, config.language)`
- `this.createImprovementTemplate(snapshot, config.language)`
- `this.createSessionHistoryTemplate()`

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-005].

---

## Priority 3 (Feature)

### [PROMPT-005] Add TODO/FIXME scanning to improvement report

**Directives:**
- Execute this prompt now, then proceed to [OPT-1].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-todo-fixme-scan-001`

**Task:**
Add lightweight TODO/FIXME scanning so improvement generation can reference concrete findings (file + line) instead of relying only on free-form analysis.

**Target files:**
- `vibereport-extension/src/models/types.ts`
- `vibereport-extension/src/services/workspaceScanner.ts`
- `vibereport-extension/src/utils/analysisPromptTemplate.ts`
- `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts` (update/add)

**Steps:**
1. Extend `ProjectSnapshot` with a new optional field for findings (keep it small and bounded).
2. In `WorkspaceScanner`, scan a bounded subset of text files for `TODO` / `FIXME` (respect exclude patterns and size limits).
3. Add a short "TODO/FIXME Findings" section to the analysis prompt template so the AI report can cite it.
4. Add unit tests for the scanner and the prompt template inclusion.

**Implementation Details:**

```ts
export type TodoFixmeTag = 'TODO' | 'FIXME';

export interface TodoFixmeFinding {
  file: string;
  line: number;
  tag: TodoFixmeTag;
  text: string;
}

export interface ProjectSnapshot {
  // ...
  todoFixmeFindings?: TodoFixmeFinding[];
}
```

- Suggested scan constraints (tune as needed):
  - maxFilesToInspect: 300
  - maxFileBytes: 200_000
  - maxFindings: 200
- Suggested regex (line-based): `/\\b(TODO|FIXME)\\b[:]?(.*)$/`

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [OPT-1].

---

## Optimization (OPT)

### [OPT-1] Skip report writes when content unchanged

**Directives:**
- Execute this prompt now, then proceed to Final Completion.
- Status: OPT (Pending)
- Linked Improvement ID: `opt-report-write-skip-001`

**Task:**
Reduce I/O and git noise by skipping report file writes when the generated content is identical to the existing file.

**Target files:**
- `vibereport-extension/src/services/reportService.ts`

**Steps:**
1. Introduce a small helper `writeFileIfChanged(...)` in `reportService.ts` (or a new utility module).
2. Use it for evaluation and improvement report writes (and any other report that is expected to be idempotent).
3. Log whether a write happened (or was skipped) to aid debugging, but keep logs concise.

**Implementation Details:**

```ts
import * as fs from 'fs/promises';

async function writeFileIfChanged(filePath: string, next: string): Promise<boolean> {
  try {
    const current = await fs.readFile(filePath, 'utf-8');
    if (current === next) return false;
  } catch {
    // File missing or unreadable: fall through and write.
  }

  await fs.writeFile(filePath, next, 'utf-8');
  return true;
}
```

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`
- Optional: run the report update logic twice with identical inputs and confirm the second run does not rewrite report files.

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
2. Ensure that `Prompt.md` itself contains NO Korean characters.
3. Print the final success message:
   `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`
