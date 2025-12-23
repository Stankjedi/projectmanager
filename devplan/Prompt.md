# AI Agent Improvement Prompts

> **MANDATORY EXECUTION RULES**
> 1. **Tool-first editing:** Always modify files via file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`, or an equivalent patch tool). Do not respond with text-only suggestions.
> 2. **Sequential execution:** Execute prompts strictly in order (PROMPT-001 → PROMPT-002 → PROMPT-003 → PROMPT-004 → OPT-1). Do not skip or reorder.
> 3. **No placeholders:** Write complete, working code and tests. Do not leave TODO stubs or "..." omissions.
> 4. **Verify every prompt:** Run the verification commands before marking a prompt done.
> 5. **Report completion:** After each prompt, report touched files, verification results, and the next prompt ID.
> 6. **English-only output** for this file (no non-English characters).

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Fix monorepo structure diagram + entrypoint detection (`scan-structure-001`) | P1 | ⬜ Pending |
| 2 | PROMPT-002 | Exclude sensitive files during scan by default (`security-sensitive-scan-001`) | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Preserve default exclude patterns via merge option (`config-exclude-001`) | P2 | ⬜ Pending |
| 4 | PROMPT-004 | Add an analysisRoot setup wizard command (`feat-analysisroot-wizard-001`) | P3 | ⬜ Pending |
| 5 | OPT-1 | Cache Git info (status/log) with TTL (`opt-gitinfo-cache-001`) | OPT | ⬜ Pending |

> **Total: 5 prompts | Completed: 0 | Remaining: 5**

---

## Priority 1 (Critical)

### [PROMPT-001] Fix monorepo structure diagram + entrypoint detection

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-002].
- Status: P1 (Pending)
- Linked Improvement ID: `scan-structure-001`

**Task:**
Make `WorkspaceScanner.generateFunctionBasedStructure(...)` classify monorepo paths such as `vibereport-extension/src/...` correctly and detect entrypoints like `vibereport-extension/src/extension.ts`, so the generated `structureDiagram` is accurate for nested projects.

**Target files:**
- `vibereport-extension/src/services/workspaceScanner.ts`
- `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts`

**Steps:**
1. Update the file-to-category mapping to support both:
   - root layouts: `src/<category>/...`
   - nested layouts: `<package>/src/<category>/...` (e.g., `vibereport-extension/src/commands/...`)
2. Keep existing top-level categories (e.g., `devplan/`) working.
3. Update entrypoint detection to allow an optional path prefix (not only `src/...` at repo root), and ensure `*/src/extension.ts` is recognized.
4. Add a unit test that scans a mocked workspace containing:
   - `vibereport-extension/src/extension.ts`
   - `vibereport-extension/src/commands/index.ts`
   - `devplan/Prompt.md`
   and asserts that `snapshot.structureDiagram` includes at least one non-devplan category (e.g., `commands/`) and lists `vibereport-extension/src/extension.ts` under "Entry points".

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-002].

---

## Priority 2 (High)

### [PROMPT-002] Exclude sensitive files during scan by default

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-003].
- Status: P2 (Pending)
- Linked Improvement ID: `security-sensitive-scan-001`

**Task:**
Prevent accidental leakage of secrets by filtering common sensitive files (e.g., `.env*`, `*.pem`, `*.key`, `*token*`) from scan results by default.

**Target files:**
- `vibereport-extension/src/services/workspaceScanner/fileCollector.ts`
- `vibereport-extension/src/models/types.ts` (config typing)
- `vibereport-extension/package.json` (configuration)
- `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts`

**Steps:**
1. Implement a small `isSensitivePath(relativePath)` filter inside `applyGitignoreAndSensitiveFilters(...)` to exclude common secret patterns (case-insensitive).
2. Add a config escape hatch (default: do not include sensitive files), e.g. `vibereport.includeSensitiveFiles: false`.
3. Add tests that prove:
   - `.env` and `vsctoken.txt` are excluded when the setting is false/default.
   - they are included when the setting is true.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-003].

---

### [PROMPT-003] Preserve default exclude patterns via merge option

**Directives:**
- Execute this prompt now, then proceed to [PROMPT-004].
- Status: P2 (Pending)
- Linked Improvement ID: `config-exclude-001`

**Task:**
Add an opt-in/opt-out configuration flag that preserves the extension's default `excludePatterns` even when users customize `vibereport.excludePatterns`, so large artifacts (e.g., `*.vsix`) and other noisy paths stay excluded by default.

**Target files:**
- `vibereport-extension/src/utils/configUtils.ts`
- `vibereport-extension/src/models/types.ts`
- `vibereport-extension/package.json`
- `vibereport-extension/src/utils/__tests__/configDefaults.test.ts`

**Steps:**
1. Extend `VibeReportConfig` with `excludePatternsIncludeDefaults: boolean` (default: `true`).
2. Update `DEFAULT_CONFIG` and `loadConfig()` so when the flag is enabled the effective patterns are:
   - `DEFAULT_CONFIG.excludePatterns` + user `excludePatterns` (trim + dedupe)
   and when disabled the effective patterns are user-only.
3. Update the contributed VS Code setting schema (package.json) with a clear description and default value.
4. Add/adjust tests to ensure:
   - the new setting is contributed with the correct default.
   - `loadConfig()` returns merged patterns when enabled.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [PROMPT-004].

---

## Priority 3 (Feature)

### [PROMPT-004] Add an analysisRoot setup wizard command

**Directives:**
- Execute this prompt now, then proceed to [OPT-1].
- Status: P3 (Pending)
- Linked Improvement ID: `feat-analysisroot-wizard-001`

**Task:**
Add a command that helps users pick and persist `vibereport.analysisRoot` for monorepos via Quick Pick, improving scan accuracy without manual settings edits.

**Target files:**
- `vibereport-extension/package.json`
- `vibereport-extension/src/commands/setAnalysisRootWizard.ts` (new)
- `vibereport-extension/src/commands/index.ts`
- `vibereport-extension/src/extension.ts`
- `vibereport-extension/src/commands/__tests__/setAnalysisRootWizard.test.ts` (new)

**Steps:**
1. Contribute a new command id (e.g., `vibereport.setAnalysisRootWizard`) with a clear title and category.
2. Implement the command:
   - Select `workspaceRoot` via `selectWorkspaceRoot()`.
   - Discover candidate folders by searching for signals like `package.json`, `tsconfig.json`, and `src/extension.ts` under the workspace (excluding `node_modules`, `.git`, and other ignored paths).
   - Present candidates as workspace-relative paths in `showQuickPick` (dedupe + sort; prefer shallow paths and ones that look like VS Code extensions).
   - Update workspace configuration `vibereport.analysisRoot` and validate with `resolveAnalysisRoot(workspaceRoot, selected)`.
3. Add tests that mock:
   - `vscode.workspace.findFiles` (candidates)
   - `vscode.window.showQuickPick` (selection)
   - `vscode.workspace.getConfiguration('vibereport').update(...)` (writes)
   and assert the correct value is persisted.

**Verification:**
- `pnpm -C vibereport-extension run compile`
- `pnpm -C vibereport-extension run lint`
- `pnpm -C vibereport-extension run test:run`

**After Completion:**
- Proceed directly to [OPT-1].

---

## Optimization (OPT)

### [OPT-1] Cache Git info (status/log) with TTL

**Directives:**
- Execute this prompt now, then proceed to Final Completion.
- Status: OPT (Pending)
- Linked Improvement ID: `opt-gitinfo-cache-001`

**Task:**
Reduce repeated Git overhead by caching `WorkspaceScanner.getGitInfo()` results in `snapshotCache` for a short TTL.

**Target files:**
- `vibereport-extension/src/services/workspaceScanner.ts`
- `vibereport-extension/src/services/snapshotCache.ts`
- `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts`

**Steps:**
1. Add a cache key (e.g., `createCacheKey('git-info', rootPath)`) and reuse cached results when available.
2. Keep behavior unchanged for non-repo workspaces and for errors (fail open to `undefined`).
3. Add tests that verify repeated scans within TTL reduce calls to `simpleGit().status()` and `.log()`.

**Verification:**
- `pnpm -C vibereport-extension run compile`
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
