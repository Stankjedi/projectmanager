/**
 * Analysis Prompt Template
 *
 * @description 프로젝트 분석 및 보고서 작성을 위한 프롬프트 템플릿
 * 
 * Projectmanager – Automated Evaluation, Improvement & Prompt Generation
 */

import * as vscode from 'vscode';
import type {
  ProjectSnapshot,
  SnapshotDiff,
  AppliedImprovement,
  VibeReportConfig,
  ProjectVision,
} from '../models/types.js';
import { redactSecretLikePatterns } from './redactionUtils.js';
import { isSensitivePath } from './sensitiveFilesUtils.js';

/**
 * 분석 프롬프트 생성
 */
export function buildAnalysisPrompt(
  snapshot: ProjectSnapshot,
  diff: SnapshotDiff,
  appliedImprovements: AppliedImprovement[],
  isFirstRun: boolean,
  config: VibeReportConfig,
  reportPaths: { evaluation: string; improvement: string; prompt: string },
  projectVision?: ProjectVision
): string {
  const lines: string[] = [];

  // ===== 헤더 =====
  lines.push(`# ${snapshot.projectName} – Automated Evaluation, Improvement & Prompt Generation`);
  lines.push('');
  lines.push(`You are an AI agent running inside an IDE on the \`${snapshot.projectName}\` repository.`);
  lines.push('Your task is to review all files in the current project and directly rewrite three planning documents:');
  lines.push('');
  lines.push(`1. \`${reportPaths.evaluation}\``);
  lines.push(`2. \`${reportPaths.improvement}\``);
  lines.push(`3. \`${reportPaths.prompt}\``);
  lines.push('');
  lines.push('All three files should be updated sequentially in the required order, following the TODO list and rules below.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ===== 0. Pre-flight Recon =====
  lines.push('## 0. Pre-flight Recon (Mandatory)');
  lines.push('');
  lines.push('Before starting TODO-1, perform a quick repository recon so your evaluation and improvements are grounded in evidence:');
  lines.push('');
  lines.push('- Read `package.json` (scripts, entry points).');
  lines.push('- Read `README.md` (user scenarios, how to run/build/test).');
  lines.push('- Identify the main entry points (e.g., VS Code extension activation/commands, CLI entry, server entry).');
  lines.push('- Search for red flags: `TODO`, `FIXME`, `any`, `ts-ignore`, `eslint-disable`.');
  lines.push('- If the environment allows, run existing scripts from `package.json`:');
  lines.push('  - `pnpm run test` / `pnpm run build` / `pnpm run lint` (only if present).');
  lines.push('');
  lines.push('Use your recon findings as **Evidence** in improvement items (at least 1 per item: file path + observation).');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ===== 1. Global Language Rules =====
  lines.push('## 1. Global Language Rules (Mandatory)');
  lines.push('');
  lines.push('- `Project_Evaluation_Report.md`:');
  lines.push('  - Write **all content in Korean** (evaluation report in professional, concise Korean).');
  lines.push('  - Exception: allowed tokens listed in **1.X Language Exceptions** may remain English and must NOT be translated.');
  lines.push('');
  lines.push('- `Project_Improvement_Exploration_Report.md`:');
  lines.push('  - Write **all content in Korean** (improvement / exploration report in professional, concise Korean).');
  lines.push('  - Exception: allowed tokens listed in **1.X Language Exceptions** may remain English and must NOT be translated.');
  lines.push('');
  lines.push('- `Prompt.md`:');
  lines.push('  - Write **all content in English**.');
  lines.push('  - Validation rule: **no Hangul characters** allowed (regex: `[가-힣]`).');
  lines.push('  - **Do not** include any Korean text (한글) in this file (titles, descriptions, tables, comments).');
  lines.push('');
  lines.push('- Do **not** mix languages inside a single file.');
  lines.push('');
  lines.push('If `Prompt.md` contains any Korean, it is invalid and must be fixed.');
  lines.push('');

  lines.push('### 1.X Language Exceptions (Applies to Korean-only files)');
  lines.push('');
  lines.push('Even in Korean-only files, the following tokens are allowed and MUST NOT be translated:');
  lines.push('- File paths, folder names, package names');
  lines.push('- IDs (e.g., `test-commands-001`)');
  lines.push('- Enum-like values / fixed tokens:');
  lines.push('  - `Origin`: `test-failure` / `build-error` / `static-analysis` / `manual-idea`');
  lines.push('  - `Risk level`: `low` / `medium` / `high` / `critical`');
  lines.push('  - `Complexity`: `Low` / `Medium` / `High`');
  lines.push('  - Related evaluation category keys: `testCoverage`, `codeQuality`, `performance`, `productionReadiness`, etc.');
  lines.push('- Code blocks, CLI commands');
  lines.push('- Mermaid keywords (e.g., `flowchart`, `sequenceDiagram`, `subgraph`, `TB`, `LR`)');
  lines.push('');
  lines.push('For Mermaid diagrams: keywords remain as-is; node labels/descriptions must be Korean.');
  lines.push('');

  lines.push('### 1.Y Security / Sensitive Files (Mandatory)');
  lines.push('');
  lines.push('Do not open or copy secrets (tokens/keys/credentials).');
  lines.push('Treat the following as sensitive and **never include contents** in any report:');
  lines.push('- `vsctoken.txt`, `.env*`, `*token*`, `*secret*`, `*key*`, `*credential*`');
  lines.push('You may mention existence, but do NOT paste file contents or secret values.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ===== 2. TODO Checklist =====
  lines.push('## 2. TODO Checklist – Execute in Order');
  lines.push('');
  lines.push('Execute the following TODO items **strictly in order**.');
  lines.push('You must not skip or reorder tasks.');
  lines.push('Writing languages for each TODO are enforced as noted.');
  lines.push('All TODO lists must be completed.');
  lines.push('Dont stop until TODO-10 is completed.');
  lines.push('');

  lines.push('### 2.X Improvement IDs – Single Source of Truth (SSOT)');
  lines.push('');
  lines.push('All improvement IDs must be consistent across all three files:');
  lines.push('- If an improvement ID appears in the Evaluation report (Risk Summary / Score↔Improvement Mapping), the **same ID** MUST exist as an item in the Improvement report.');
  lines.push('- Every pending improvement item ID in the Improvement report MUST appear as a prompt in `Prompt.md`.');
  lines.push('- Never rename, translate, or “pretty print” IDs. IDs are canonical tokens.');
  lines.push('Practical rule: decide your improvement IDs early (before writing any tables that reference IDs) and reuse them unchanged.');
  lines.push('');

  lines.push('- `[ ] TODO-1` – Evaluation Report Part 1 – Project overview section (Korean)');
  lines.push('- `[ ] TODO-2` – Evaluation Report Part 2 – Global score table (Korean)');
  lines.push('- `[ ] TODO-3` – Evaluation Report Part 3 – Detailed per-feature evaluation (Korean)');
  lines.push('- `[ ] TODO-4` – Evaluation Report Part 4 – TL;DR + Risk Summary + Score↔Improvement Mapping + Trend + Current State Summary (Korean)');
  lines.push('- `[ ] TODO-5` – Improvement Report Part 1 – Overall improvement summary (Korean)');
  lines.push('- `[ ] TODO-6` – Improvement Report Part 2 – P1/P2 improvement items (Korean)');
  lines.push('- `[ ] TODO-7` – Improvement Report Part 3 – P3 and OPT items (Korean)');
  lines.push('- `[ ] TODO-8` – Prompt.md Part 1 – Header + checklist + first prompts (English only)');
  lines.push('- `[ ] TODO-9` – Prompt.md Part 2 – Remaining P2 prompts (English only)');
  lines.push('- `[ ] TODO-10` – Prompt.md Part 3 – P3 + OPT prompts and closing (English only)');
  lines.push('');
  lines.push('After completing each TODO:');
  lines.push('1. Actually modify the relevant file using the file-edit tools.');
  lines.push('2. In your response, mark the TODO as done, e.g., `[x] TODO-1: completed (Project_Evaluation_Report.md – overview section)`.');
  lines.push('3. Explicitly confirm in Korean that the file was updated, e.g., `파일을 수정했습니다.`');
  lines.push('4. Immediately proceed to the next TODO.');
  lines.push('');
  lines.push('Do **not** stop after "I will review", "I will analyze" or similar. You must carry out all TODOs and all file modifications.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ===== 3. File Editing Rules =====
  lines.push('## 3. File Editing Rules (Tools & Chunking)');
  lines.push('');
  lines.push('### 3.1 Allowed Operations');
  lines.push('');
  lines.push('You must always modify files using the available file-edit tools:');
  lines.push('');
  lines.push('Prohibited behaviors:');
  lines.push('- Do not merely show code or report text in the chat.');
  lines.push('- Do not say "you can modify like this" without actually modifying the file.');
  lines.push('- Do not provide only abstract instructions.');
  lines.push('- Do not update only one or two of the three files; all three must be modified.');
  lines.push('');
  lines.push('### 3.2 Chunk Size & Markers');
  lines.push('');
  lines.push('Due to output length limits, you must update files in **small sections**:');
  lines.push('- Each individual modification should write **no more than ~150 lines** at once.');
  lines.push('- Use multiple modifications per file as needed.');
  lines.push('- Replace content between existing section markers instead of rewriting entire files when possible.');
  lines.push('');
  lines.push('Markers you will use:');
  lines.push('- Evaluation report:');
  lines.push('  - `<!-- AUTO-OVERVIEW-START -->` … `<!-- AUTO-OVERVIEW-END -->`');
  lines.push('  - `<!-- AUTO-SCORE-START -->` … `<!-- AUTO-SCORE-END -->`');
  lines.push('  - `<!-- AUTO-TLDR-START -->` … `<!-- AUTO-TLDR-END -->`');
  lines.push('  - `<!-- AUTO-RISK-SUMMARY-START -->` … `<!-- AUTO-RISK-SUMMARY-END -->`');
  lines.push('  - `<!-- AUTO-SCORE-MAPPING-START -->` … `<!-- AUTO-SCORE-MAPPING-END -->`');
  lines.push('  - `<!-- AUTO-TREND-START -->` … `<!-- AUTO-TREND-END -->`');
  lines.push('  - `<!-- AUTO-SUMMARY-START -->` … `<!-- AUTO-SUMMARY-END -->`');
  lines.push('- Improvement report:');
  lines.push('  - `<!-- AUTO-SUMMARY-START -->` … `<!-- AUTO-SUMMARY-END -->`');
  lines.push('  - `<!-- AUTO-IMPROVEMENT-LIST-START -->` … `<!-- AUTO-IMPROVEMENT-LIST-END -->`');
  lines.push('  - `<!-- AUTO-FEATURE-LIST-START -->` … `<!-- AUTO-FEATURE-LIST-END -->`');
  lines.push('  - `<!-- AUTO-OPTIMIZATION-START -->` … `<!-- AUTO-OPTIMIZATION-END -->`');
  lines.push('');
  lines.push('When using `replace_string_in_file`:');
  lines.push('- Select 3–5 lines of unique existing context (including the markers) as `oldString`.');
  lines.push('- Replace only the intended section between markers with your new content.');
  lines.push('');
  lines.push('### 3.3 Recovery Rules');
  lines.push('');
  lines.push('If you cannot find a marker block (missing or unexpected format):');
  lines.push('1. Find the closest relevant section header in the file.');
  lines.push('2. Insert the missing marker block first.');
  lines.push('3. Then fill the content inside that marker block.');
  lines.push('');
  lines.push('If `replace_string_in_file` fails due to mismatch:');
  lines.push('- Open/read the file to copy the exact surrounding lines.');
  lines.push('- Retry with a longer, more unique `oldString` context (still including the markers).');
  lines.push('- Avoid blind retry loops.');
  lines.push('');
  lines.push('### 3.4 Recommended Partitioning per File');
  lines.push('');
  lines.push('- Evaluation report (`Project_Evaluation_Report.md`) – about 4 parts:');
  lines.push('  - Part 1 – Project overview.');
  lines.push('  - Part 2 – Global score table.');
  lines.push('  - Part 3 – Detailed per-feature evaluation.');
  lines.push('  - Part 4 – Summary / TL;DR / risk / trend mapping.');
  lines.push('- Improvement report (`Project_Improvement_Exploration_Report.md`) – about 3 parts:');
  lines.push('  - Part 1 – Overall improvement summary.');
  lines.push('  - Part 2 – P1/P2 improvement items.');
  lines.push('  - Part 3 – P3 and OPT items.');
  lines.push('- Prompt file (`Prompt.md`) – about 3 parts:');
  lines.push('  - Part 1 – Header, execution rules, execution checklist, and first prompts.');
  lines.push('  - Part 2 – Remaining P2 prompts.');
  lines.push('  - Part 3 – P3 prompts, OPT prompts, and final completion message.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ===== 4. Project Context =====
  lines.push('## 4. Project Context (Read-Only, for Analysis)');
  lines.push('');
  lines.push('High-level project facts:');
  lines.push(`- Name: \`${snapshot.projectName}\``);
  lines.push('- Approximate composition:');
  lines.push(`  - ${snapshot.filesCount} files, ${snapshot.dirsCount} directories`);

  const topLanguages = Object.entries(snapshot.languageStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => `${lang}(${count})`)
    .join(', ');
  lines.push(`  - Main languages: ${topLanguages || 'Not detected'}`);
  lines.push('');

  // 사용자 커스텀 지침 (Prompt 생성 시 참고)
  const customInstructions = vscode.workspace
    .getConfiguration('vibereport')
    .get<string>('ai.customInstructions', '')
    .trim();

  if (customInstructions) {
    const redactedCustomInstructions = redactSecretLikePatterns(customInstructions);
    lines.push('[User Custom Instructions]');
    if (redactedCustomInstructions !== customInstructions) {
      lines.push('Note: Secret-like patterns were redacted from user custom instructions.');
    }
    lines.push(redactedCustomInstructions);
    lines.push('');
  }

  // 새 파일 목록
  if (!isFirstRun && !diff.isInitial && diff.newFiles.length > 0) {
    const safeNewFiles = diff.newFiles.filter(f => !isSensitivePath(f));
    const sensitiveNewFiles = diff.newFiles.filter(isSensitivePath);

    if (safeNewFiles.length > 0) {
      lines.push('Recently added files (review them if relevant; do NOT open sensitive files):');
      safeNewFiles.slice(0, 10).forEach(f => {
        lines.push(`- \`${f}\``);
      });
      if (safeNewFiles.length > 10) {
        lines.push(`- ... and ${safeNewFiles.length - 10} more`);
      }
      lines.push('');
    }

    if (sensitiveNewFiles.length > 0) {
      lines.push('Sensitive files detected (do not open or copy contents):');
      sensitiveNewFiles.slice(0, 10).forEach(f => {
        lines.push(`- \`${f}\` (sensitive)`);
      });
      if (sensitiveNewFiles.length > 10) {
        lines.push(`- ... and ${sensitiveNewFiles.length - 10} more sensitive file(s)`);
      }
      lines.push('');
    }
  }

  // 삭제된 파일
  if (!isFirstRun && !diff.isInitial && diff.removedFiles.length > 0) {
    lines.push('Recently removed files:');
    diff.removedFiles.slice(0, 5).forEach(f => {
      lines.push(`- \`${f}\``);
    });
    lines.push('');
  }

  lines.push('### TODO/FIXME Findings (Auto Scan)');
  lines.push('');
  const allFindings = snapshot.todoFixmeFindings ?? [];
  const visibleFindings = allFindings.filter(f => !isSensitivePath(f.file));
  const redactedFindingsCount = allFindings.length - visibleFindings.length;

  if (visibleFindings.length === 0) {
    lines.push('- None detected.');
    if (redactedFindingsCount > 0) {
      lines.push(`- Note: ${redactedFindingsCount} finding(s) in sensitive files were redacted.`);
    }
    lines.push('');
  } else {
    const sanitize = (value: string) =>
      value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

    lines.push('| File | Line | Tag | Text |');
    lines.push('| --- | ---: | --- | --- |');
    visibleFindings.slice(0, 20).forEach(finding => {
      const text = sanitize(finding.text);
      lines.push(`| \`${finding.file}\` | ${finding.line} | ${finding.tag} | ${text} |`);
    });
    if (visibleFindings.length > 20) {
      lines.push(`| ... | ... | ... | ... and ${visibleFindings.length - 20} more |`);
    }
    if (redactedFindingsCount > 0) {
      lines.push('');
      lines.push(`Note: ${redactedFindingsCount} finding(s) in sensitive files were redacted.`);
    }
    lines.push('');
  }

  lines.push('Use this context when scoring, identifying risks, and proposing improvements.');
  lines.push('Session logs and historical application status of items are managed separately in `Session_History.md`.');
  lines.push('Do **not** write any session log or past history into the three target files.');
  lines.push('');

  // 적용된 개선사항
  if (appliedImprovements.length > 0) {
    lines.push('### Already Applied Improvements (Exclude from reports)');
    lines.push('');
    appliedImprovements.forEach(imp => {
      lines.push(`- ${imp.title} (\`${imp.id}\`)`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n') +
    buildEvaluationReportSection(reportPaths.evaluation, projectVision) +
    buildImprovementReportSection(reportPaths.improvement) +
    buildPromptFileSection(reportPaths.prompt) +
    buildFinalValidationSection(reportPaths);
}


/**
 * 평가 보고서 섹션 생성
 */
function buildEvaluationReportSection(evaluationPath: string, projectVision?: ProjectVision): string {
  const lines: string[] = [];

  lines.push('## 5. File 1 – Project Evaluation Report (Korean)');
  lines.push('');
  lines.push(`**Path:** \`${evaluationPath}\``);
  lines.push('');
  lines.push('**Language:**');
  lines.push('- Write everything in Korean (titles, paragraphs, table headers, table contents).');
  lines.push('- Exception: tokens listed in `1.X Language Exceptions` may remain English (IDs, file paths, enums, code, Mermaid keywords).');
  lines.push('- Use a clear, professional, and business-oriented tone.');
  lines.push('');
  lines.push('### 5.1 Required Sections');
  lines.push('');
  lines.push('You must ensure the following content exists and is up to date:');
  lines.push('');
  lines.push('#### (1) Project Goals and Vision');
  lines.push('');
  lines.push('Between `<!-- AUTO-OVERVIEW-START -->` and `<!-- AUTO-OVERVIEW-END -->`:');
  lines.push('- **Style Rule**: When listing items, use the format `**Label:** Value`. Label should be bold and concise, followed by a colon.');
  lines.push('');
  if (projectVision) {
    lines.push('**Reflect the following User-Defined Project Vision:**');
    lines.push(`- **Core Goals:** ${projectVision.coreGoals.join(', ')}`);
    lines.push(`- **Target Users:** ${projectVision.targetUsers}`);
    lines.push(`- **Quality Focus:** ${projectVision.qualityFocus}`);
    lines.push(`- **Tech Stack:** ${projectVision.techStackPriorities.join(', ')}`);
    lines.push('');
    lines.push('Explain the project purpose based on these goals. Summarize the strategic position.');
  } else {
    lines.push('- Explain the project\'s purpose and main objectives.');
    lines.push('- Describe target users and main usage scenarios.');
    lines.push('- Summarize the strategic position of this project within the broader ecosystem.');
  }
  lines.push('');
  lines.push('#### (2) Runtime Execution Flow Diagram (Readable Mermaid)');
  lines.push('');
  lines.push('Create a **clean, readable Mermaid diagram** that explains **how the project actually runs** at a high level (runtime/data flow), written in Korean.');
  lines.push('Your goal is NOT to draw a full dependency graph. Your goal is to make the runtime flow easy to understand in one glance.');
  lines.push('');
  lines.push('Hard constraints (to prevent messy diagrams):');
  lines.push('- Prefer `flowchart TB` (top-to-bottom). Avoid `LR` unless TB becomes unreadable.');
  lines.push('- Keep it small: **max 10–12 nodes**, **max 12–14 arrows**.');
  lines.push('- Avoid “fan-out spaghetti”: do NOT connect every module to every other module.');
  lines.push('- Use a single hub node (e.g., `shared core API` / `core services`) when many modules are involved.');
  lines.push('- Use short labels: `fileOrFolderName<br/>짧은 역할 설명`.');
  lines.push('- If there are 2 distinct flows (e.g., UI flow vs background job), separate them with subgraphs and connect them with only 1–2 edges.');
  lines.push('');
  lines.push('Required content:');
  lines.push('- Include the main user entry points (e.g., command/CLI/UI/extension pages).');
  lines.push('- Include persistence (e.g., DB / file / local storage) only once as a single node.');
  lines.push('- Show the “happy path” runtime flow (primary user scenario) first; optional flows second.');
  lines.push('');
  lines.push('Recommended section title in the report (Korean): `### 🔄 실행 흐름(런타임) 다이어그램`');
  lines.push('');
  lines.push('Example format (illustrative only):');
  lines.push('');
  lines.push('```mermaid');
  lines.push('flowchart TB');
  lines.push('    U([사용자])');
  lines.push('');
  lines.push('    subgraph App["앱/확장 실행 흐름"]');
  lines.push('        UI["UI/명령<br/>사용자 진입"]');
  lines.push('        EP["엔트리포인트<br/>초기화/라우팅"]');
  lines.push('        Core["코어 로직<br/>검증·처리"]');
  lines.push('        Out["출력/결과<br/>렌더/응답"]');
  lines.push('    end');
  lines.push('');
  lines.push('    Store[("저장소<br/>파일/DB/스토리지")]');
  lines.push('');
  lines.push('    U --> UI --> EP --> Core --> Out');
  lines.push('    Core <-->|읽기/쓰기| Store');
  lines.push('```');
  lines.push('');
  lines.push('Notes:');
  lines.push('- If a `sequenceDiagram` would be clearer (e.g., request/response or event-driven), you may use it instead — but keep it equally small and readable.');
  lines.push('- The diagram must be understandable without reading code; prioritize clarity over completeness.');
  lines.push('');
  lines.push('#### (3) Global Score Table (with Grade Mapping)');
  lines.push('');
  lines.push('Between `<!-- AUTO-SCORE-START -->` and `<!-- AUTO-SCORE-END -->`:');
  lines.push('');
  lines.push('1. Use the following score-to-grade rule exactly:');
  lines.push('');
  lines.push('| 점수 범위 | 등급 | 색상 | 의미 |');
  lines.push('|:---:|:---:|:---:|:---:|');
  lines.push('| 97–100 | A+ | 🟢 | 최우수 |');
  lines.push('| 93–96 | A | 🟢 | 우수 |');
  lines.push('| 90–92 | A- | 🟢 | 우수 |');
  lines.push('| 87–89 | B+ | 🔵 | 양호 |');
  lines.push('| 83–86 | B | 🔵 | 양호 |');
  lines.push('| 80–82 | B- | 🔵 | 양호 |');
  lines.push('| 77–79 | C+ | 🟡 | 보통 |');
  lines.push('| 73–76 | C | 🟡 | 보통 |');
  lines.push('| 70–72 | C- | 🟡 | 보통 |');
  lines.push('| 67–69 | D+ | 🟠 | 미흡 |');
  lines.push('| 63–66 | D | 🟠 | 미흡 |');
  lines.push('| 60–62 | D- | 🟠 | 미흡 |');
  lines.push('| 0–59 | F | 🔴 | 부족 |');
  lines.push('');
  lines.push('2. Derive **consistent** grades from scores; mismatches are not allowed.');
  lines.push('');
  lines.push('3. Create a global score table in Korean, such as:');
  lines.push('');
  lines.push('| 항목 | 점수 (100점 만점) | 등급 | 변화 |');
  lines.push('|------|------------------|------|------|');
  lines.push('| 코드 품질 | 85 | 🔵 B | ⬆️ +7 |');
  lines.push('| 테스트 커버리지 | 72 | 🟡 C- | ⬆️ +27 |');
  lines.push('| 문서화 | 65 | 🟠 D | ⬆️ +10 |');
  lines.push('| … | … | … | … |');
  lines.push('');
  lines.push('Explain briefly how you derived each score and grade.');
  lines.push('');
  lines.push('#### (4) Detailed Per-Feature Evaluation');
  lines.push('');
  lines.push('Create narrative and/or tabular subsections for major modules/services (e.g., CLI, VS Code extension, report generation):');
  lines.push('');
  lines.push('For each module (in Korean):');
  lines.push('- 기능 완성도: current feature completeness.');
  lines.push('- 코드 품질: clarity, structure, type-safety.');
  lines.push('- 에러 처리: error handling, resiliency.');
  lines.push('- 성능: performance considerations.');
  lines.push('- 강점: strengths.');
  lines.push('- 약점 / 리스크: weaknesses and risks.');
  lines.push('');
  lines.push('Use concise bullet points with concrete observations from the codebase.');
  lines.push('');
  lines.push('#### (5) TL;DR Summary');
  lines.push('');
  lines.push('Between `<!-- AUTO-TLDR-START -->` and `<!-- AUTO-TLDR-END -->`, provide a compact "at a glance" table, e.g.:');
  lines.push('');
  lines.push('| 항목 | 값 |');
  lines.push('|------|-----|');
  lines.push('| **전체 등급** | B (예: 83점) |');
  lines.push('| **전체 점수** | 83/100 |');
  lines.push('| **가장 큰 리스크** | 예: 명령 레이어 회귀 테스트 부족 |');
  lines.push('| **권장 최우선 작업** | 예: test-commands-001: 명령 레이어 테스트 확장 |');
  lines.push('');
  lines.push('All content here must be in Korean.');
  lines.push('');
  lines.push('#### (6) Risk Summary');
  lines.push('');
  lines.push('Between `<!-- AUTO-RISK-SUMMARY-START -->` and `<!-- AUTO-RISK-SUMMARY-END -->`, summarize key risks:');
  lines.push('');
  lines.push('| 리스크 레벨 | 항목 | 관련 개선 ID |');
  lines.push('|------------|------|-------------|');
  lines.push('| 🔴 High | 예: 명령 레이어 회귀 위험 | test-commands-001 |');
  lines.push('| 🟡 Medium | 예: AI 연동 미비 | feat-ai-integration-001 |');
  lines.push('| 🟢 Low | 예: 멀티 워크스페이스 미지원 | feat-multi-workspace-001 |');
  lines.push('');
  lines.push('The risk IDs must match improvement items later defined in the improvement report.');
  lines.push('');
  lines.push('#### (7) Score ↔ Improvement Mapping');
  lines.push('');
  lines.push('Between `<!-- AUTO-SCORE-MAPPING-START -->` and `<!-- AUTO-SCORE-MAPPING-END -->`, map evaluation scores to concrete improvement IDs:');
  lines.push('');
  lines.push('| 카테고리 | 현재 점수 | 주요 리스크 | 관련 개선 항목 ID |');
  lines.push('|----------|----------|------------|------------------|');
  lines.push('| 테스트 커버리지 | 85 (B) | 명령 레이어 회귀 | test-commands-001 |');
  lines.push('| 프로덕션 준비도 | 78 (C+) | AI 연동 미비 | feat-ai-integration-001 |');
  lines.push('');
  lines.push('Use real categories from your evaluation.');
  lines.push('');
  lines.push('#### (8) Evaluation Trend (If History Exists)');
  lines.push('');
  lines.push('Between `<!-- AUTO-TREND-START -->` and `<!-- AUTO-TREND-END -->`:');
  lines.push('- If previous evaluation sessions exist, describe the last few scores (up to 5) and trends per category.');
  lines.push('- Show whether each category is improving, stable, or regressing.');
  lines.push('- If no history exists, state that this is the first evaluation and leave a short note for future comparisons.');
  lines.push('');
  lines.push('#### (9) Current State Summary');
  lines.push('');
  lines.push('Between `<!-- AUTO-SUMMARY-START -->` and `<!-- AUTO-SUMMARY-END -->`, write a concise Korean summary of the current overall state:');
  lines.push('- Overall readiness.');
  lines.push('- Main strengths and differentiators.');
  lines.push('- Top 2–3 risks and recommended immediate actions.');
  lines.push('');
  lines.push('Do **not** include session logs or detailed historical data here; those belong in `Session_History.md`.');
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}


/**
 * 개선 보고서 섹션 생성
 */
function buildImprovementReportSection(improvementPath: string): string {
  const lines: string[] = [];

  lines.push('## 6. File 2 – Project Improvement Exploration Report (Korean)');
  lines.push('');
  lines.push(`**Path:** \`${improvementPath}\``);
  lines.push('');
  lines.push('**Language:**');
  lines.push('- Write everything in Korean.');
  lines.push('- Exception: tokens listed in `1.X Language Exceptions` may remain English (IDs, file paths, enums, code, Mermaid keywords).');
  lines.push('- Use concise, structured, and actionable language.');
  lines.push('');
  lines.push('### 6.1 Core Principle – Only Pending Items');
  lines.push('');
  lines.push('This report should describe **only improvements that are not yet applied**:');
  lines.push('- Do **not** list completed items.');
  lines.push('- Do **not** keep a history of past improvements here.');
  lines.push('- Do **not** create a "completed" section in this file.');
  lines.push('');
  lines.push('You must:');
  lines.push('- Analyze Professionally the current code and configuration.');
  lines.push('- Identify real issues and opportunities.');
  lines.push('- Keep only currently pending items (P1, P2, P3 and OPT) that still need work.');
  lines.push('');
  lines.push('Historical application status and completion logs belong in `Session_History.md`, not here.');
  lines.push('');
  lines.push('### 6.2 Error & Issue Discovery Process');
  lines.push('');
  lines.push('Base each improvement item on actual observed issues. Use a clear process such as:');
  lines.push('');
  lines.push('1. **Data collection**');
  lines.push('   - Review build/compile errors and linter warnings.');
  lines.push('   - Check test results (failed, skipped, flaky cases).');
  lines.push('   - Inspect Git history for frequently modified or problematic files.');
  lines.push('   - Scan for `TODO`, `FIXME`, or similar comments.');
  lines.push('');
  lines.push('2. **Static/structural analysis**');
  lines.push('   - Identify modules with low test coverage.');
  lines.push('   - Spot overly complex functions/classes (long, deeply nested, or with many responsibilities).');
  lines.push('   - Find type-unsafe areas (e.g., excessive `any`, missing types).');
  lines.push('');
  lines.push('3. **Improvement candidate extraction**');
  lines.push('   - For each candidate, record:');
  lines.push('   - `Origin`: one of `test-failure`, `build-error`, `static-analysis`, `manual-idea`.');
  lines.push('   - `Risk level`: `low`, `medium`, `high`, or `critical`.');
  lines.push('   - Related evaluation categories, such as `testCoverage`, `codeQuality`, `performance`, `productionReadiness`.');
  lines.push('');
  lines.push('Reflect this process in the descriptions of your improvement items so they are trustworthy and grounded.');
  lines.push('');
  lines.push('### 6.3 Required Sections');
  lines.push('');
  lines.push('#### (1) Overall Improvement Summary');
  lines.push('');
  lines.push('Between `<!-- AUTO-SUMMARY-START -->` and `<!-- AUTO-SUMMARY-END -->`:');
  lines.push('- Briefly summarize the current improvement status in Korean.');
  lines.push('- Show counts **only for pending** P1, P2, P3, and OPT items.');
  lines.push('- Include a distribution table, for example:');
  lines.push('');
  lines.push('| # | 항목명 | 우선순위 | 카테고리 |');
  lines.push('|:---:|:---|:---:|:---|');
  lines.push('| 1 | loadConfig 리팩토링 | P2 | 🧹 코드 품질 |');
  lines.push('| 2 | 명령 레이어 테스트 확장 | P2 | 🧪 테스트 |');
  lines.push('| 3 | AI 연동 기능 구현 | P3 | ✨ 기능 추가 |');
  lines.push('');
  lines.push('Optionally add short bullet summaries such as:');
  lines.push('- P1: highest risk items to address immediately.');
  lines.push('- P2: important improvements for stability and maintainability.');
  lines.push('- P3: feature enhancements and nice-to-have changes.');
  lines.push('');
  lines.push('Do **not** list applied items; if you mention counts, clarify that they refer to remaining work.');
  lines.push('');
  lines.push('#### (2) Functional Improvement Items (Existing Functionality)');
  lines.push('');
  lines.push('Between `<!-- AUTO-IMPROVEMENT-LIST-START -->` and `<!-- AUTO-IMPROVEMENT-LIST-END -->`:');
  lines.push('- Describe only P1/P2 items that improve **existing** functionality.');
  lines.push('- Use a consistent template in Korean; for example:');
  lines.push('');
  lines.push('For P1 (critical) and P2 (high):');
  lines.push('- Section headings like: `### 🔴 중요 (P1)` and `### 🟡 중요 (P2)` as needed.');
  lines.push('- Each item as:');
  lines.push('');
  lines.push('`#### [P2-1] 항목명`');
  lines.push('');
  lines.push('| 항목 | 내용 |');
  lines.push('|------|------|');
  lines.push('| **ID** | `고유-id` (e.g., `test-commands-001`) |');
  lines.push('| **카테고리** | 🧪 테스트 / 🔒 보안 / 🧹 코드 품질 / ⚙️ 성능 / 📦 배포 / 기타 |');
  lines.push('| **복잡도** | Low / Medium / High |');
  lines.push('| **대상 파일** | 하나 이상의 실제 파일 경로 |');
  lines.push('| **Evidence** | `파일경로:관찰내용` (함수명/에러메시지/주석 등) 최소 1개 |');
  lines.push('| **Origin** | test-failure / build-error / static-analysis / manual-idea |');
  lines.push('| **리스크 레벨** | low / medium / high / critical |');
  lines.push('| **관련 평가 카테고리** | 예: testCoverage, codeQuality, performance, productionReadiness |');
  lines.push('');
  lines.push('Then in Korean:');
  lines.push('- **현재 상태:** 현재 구현 상황 및 문제 맥락.');
  lines.push('- **문제점 (Problem):** 발견된 문제를 구체적으로 기술.');
  lines.push('- **영향 (Impact):** 사용성, 안정성, 유지보수성, 성능 등에 미치는 영향.');
  lines.push('- **원인 (Cause):** 근본 원인 분석.');
  lines.push('- **개선 내용 (Proposed Solution):** 제안하는 해결 방법의 요약.');
  lines.push('- **기대 효과:** 개선 후 기대되는 정량/정성적 향상.');
  lines.push('');
  lines.push('Include a **Definition of Done** checklist:');
  lines.push('- [ ] 주요 코드 리팩토링 및 구현 완료');
  lines.push('- [ ] 관련 테스트 추가/수정 및 통과');
  lines.push('- [ ] 빌드 및 린트 에러 없음');
  lines.push('- [ ] 문서 또는 주석 보완 (필요시)');
  lines.push('');
  lines.push('#### (3) Feature Addition Items (New Capabilities)');
  lines.push('');
  lines.push('Between `<!-- AUTO-FEATURE-LIST-START -->` and `<!-- AUTO-FEATURE-LIST-END -->`:');
  lines.push('- Describe new features or capabilities (mainly P3 items).');
  lines.push('- Use a similar template as above but emphasize:');
  lines.push('- Feature purpose and user value.');
  lines.push('- Dependencies on existing modules.');
  lines.push('- Suggested implementation strategy (e.g., new commands, new extension commands, new config options).');
  lines.push('- Interaction with evaluation metrics (e.g., improving usability, automation, or observability).');
  lines.push('');
  lines.push('Again, list only pending features that are not implemented yet.');
  lines.push('');
  lines.push('#### (4) Code Quality & Performance Optimization (OPT – Mandatory)');
  lines.push('');
  lines.push('Between `<!-- AUTO-OPTIMIZATION-START -->` and `<!-- AUTO-OPTIMIZATION-END -->`:');
  lines.push('- This section is **mandatory** and must contain at least one OPT item.');
  lines.push('- OPT items will later be turned into prompts in `Prompt.md`, so you must structure them clearly.');
  lines.push('');
  lines.push('Write in Korean, but design the structure so it can be easily translated to English for `Prompt.md`.');
  lines.push('');
  lines.push('Include:');
  lines.push('');
  lines.push('1. **General analysis** (short bullet list):');
  lines.push('- 중복 코드 및 유틸 함수로 추출 가능한 부분');
  lines.push('- 타입 안정성 강화 필요 구간 (`any` 남용 등)');
  lines.push('- 가독성을 해치는 복잡한 함수/파일');
  lines.push('- 에러 처리 로직이 부족하거나 일관되지 않은 부분');
  lines.push('- 불필요한 연산, 비효율적인 비동기 처리, 캐싱 부재 구간');
  lines.push('');
  lines.push('2. **At least one concrete OPT item**, for example:');
  lines.push('');
  lines.push('`### 🚀 코드 최적화 (OPT-1)`');
  lines.push('');
  lines.push('| 항목 | 내용 |');
  lines.push('|------|------|');
  lines.push('| **ID** | `opt-xxx-001` |');
  lines.push('| **카테고리** | 🚀 코드 최적화 / ⚙️ 성능 튜닝 |');
  lines.push('| **영향 범위** | 성능 / 품질 / 둘 다 |');
  lines.push('| **대상 파일** | 실제 파일 경로 |');
  lines.push('');
  lines.push('Then in Korean:');
  lines.push('- **현재 상태:** 현재 코드 구조나 동작상의 문제 설명.');
  lines.push('- **최적화 내용:** 어떤 방식으로 코드 또는 성능을 최적화할지 구체적으로 기술.');
  lines.push('- **예상 효과:** 성능/품질 측면에서 기대되는 개선 효과 (예: 응답 시간, 메모리 사용량, 코드 라인 감소 등).');
  lines.push('- **측정 지표:** 벤치마크 방법, 측정 기준, 또는 평가 방법.');
  lines.push('');
  lines.push('All OPT items must be pending (not yet applied). These OPT items **must** later appear as prompts in `Prompt.md`.');
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}


/**
 * Prompt.md 섹션 생성
 */
function buildPromptFileSection(promptPath: string): string {
  const lines: string[] = [];

  lines.push('## 7. File 3 – Prompt.md (English Only)');
  lines.push('');
  lines.push(`**Path:** \`${promptPath}\``);
  lines.push('');
  lines.push('**Language:**');
  lines.push('- Write all content in English.');
  lines.push('- Validation rule: **no Hangul characters** allowed (regex: `[가-힣]`).');
  lines.push('- Titles, descriptions, tables, comments, and any other content must be English.');
  lines.push('');
  lines.push('### 7.1 Source of Truth');
  lines.push('');
  lines.push('When generating `Prompt.md`:');
  lines.push('- First read the **current** `Project_Improvement_Exploration_Report.md`.');
  lines.push('- Extract **only pending items** (P1, P2, P3, and OPT) from that report.');
  lines.push('- Do not create prompts for items that are already applied or marked as completed.');
  lines.push('- For each pending item, generate one or more concrete implementation prompts.');
  lines.push('');
  lines.push('All OPT items from the `AUTO-OPTIMIZATION` section **must** be included as prompts in `Prompt.md`.');
  lines.push('');
  lines.push('### 7.2 Overall Behavior of `Prompt.md`');
  lines.push('');
  lines.push('`Prompt.md` is designed to be copied as a whole into an AI agent. The agent should:');
  lines.push('- Start at the top.');
  lines.push('- Read the global rules.');
  lines.push('- Execute **all prompts sequentially** from beginning to end.');
  lines.push('- Use file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`) to apply changes.');
  lines.push('- Confirm completion for each prompt.');
  lines.push('');
  lines.push('Do **not** include:');
  lines.push('- Generic introductions like "This file contains ready-to-use prompts".');
  lines.push('- Non-actionable guidance like "Copy any section and paste it into Copilot Chat".');
  lines.push('- Historical records of completed prompts.');
  lines.push('- Lists of previously applied improvements.');
  lines.push('');
  lines.push('The file should consist only of:');
  lines.push('- Execution rules.');
  lines.push('- Execution checklist.');
  lines.push('- Pending implementation prompts (including OPT).');
  lines.push('- Final completion message.');
  lines.push('');
  lines.push('### 7.3 Required Structure');
  lines.push('');
  lines.push('The structure of `Prompt.md` must follow this outline:');
  lines.push('');
  lines.push('1. **Top-level title and mandatory execution rules.**');
  lines.push('   - Example: `# AI Agent Improvement Prompts`');
  lines.push('   - Immediately followed by a concise rules block explaining:');
  lines.push('   - Do not respond with text-only explanations.');
  lines.push('   - Always modify files via tools.');
  lines.push('   - Process all prompts sequentially.');
  lines.push('');
  lines.push('2. **Execution Checklist table.**');
  lines.push('   - For example:');
  lines.push('');
  lines.push('| # | Prompt ID | Title | Priority | Status |');
  lines.push('|:---:|:---|:---|:---:|:---:|');
  lines.push('| 1 | PROMPT-001 | Title from P1/P2 item | P1/P2 | ⬜ Pending |');
  lines.push('| 2 | PROMPT-002 | Title from next item | P2 | ⬜ Pending |');
  lines.push('| 3 | PROMPT-003 | Title from P3 item | P3 | ⬜ Pending |');
  lines.push('| 4 | OPT-1 | Code Optimization Title | OPT | ⬜ Pending |');
  lines.push('');
  lines.push('- Include a short summary line such as:');
  lines.push('  - `Total: X prompts | Completed: 0 | Remaining: X`.');
  lines.push('');
  lines.push('3. **Prompt sections by priority.**');
  lines.push('   - Group prompts logically (e.g., P1 first, then P2, then P3, then OPT).');
  lines.push('   - For each prompt (PROMPT-XXX or OPT-XX), include:');
  lines.push('');
  lines.push('- A heading: `[PROMPT-001] Title`.');
  lines.push('- A short directive: `Execute this prompt now, then proceed to PROMPT-XXX`.');
  lines.push('- Fields:');
  lines.push('- Task description (one or two clear sentences).');
  lines.push('- Target files and paths.');
  lines.push('- Steps (1, 2, 3…) describing what to do.');
  lines.push('- A section indicating that the agent must write **actual implementation code** (TypeScript/JavaScript, etc.).');
  lines.push('- A verification section specifying commands (for example, `pnpm run test` or `pnpm run compile`), adjusted to the project\'s scripts.');
  lines.push('- A final line such as: `After completing this prompt, proceed to [PROMPT-002].`');
  lines.push('');
  lines.push('- Implementation details:');
  lines.push('- Provide enough context (imports, function signatures, major structures) so the agent can write complete and executable code.');
  lines.push('- Do **not** use placeholders like `// TODO: implement` or `// full implementation here`.');
  lines.push('- Do **not** write `// ...` or `/* omitted */` as a replacement for actual logic.');
  lines.push('- For test-related prompts, also indicate expected behaviors and edge cases.');
  lines.push('');
  lines.push('4. **Optimization prompts (OPT).**');
  lines.push('   - Create prompts for each OPT item from the improvement report.');
  lines.push('   - Structure them just like other prompts, with emphasis on optimization goals and measurable outcomes.');
  lines.push('');
  lines.push('5. **Final completion section.**');
  lines.push('   - At the very end of `Prompt.md`, include a short final section that tells the agent to:');
  lines.push('   - Confirm that all prompts have been executed.');
  lines.push('   - Run any final verification commands.');
  lines.push('   - Print a clear completion message, such as:');
  lines.push('     - `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`');
  lines.push('');
  lines.push('### 7.4 Additional Hard Requirements for `Prompt.md`');
  lines.push('');
  lines.push('For every prompt:');
  lines.push('- Include a clear status flow: this prompt → next prompt.');
  lines.push('- Ensure there is no reference to past sessions or completed work.');
  lines.push('- Do not mention "previously completed prompts".');
  lines.push('- Do not store historical data in this file.');
  lines.push('- Write everything in **English**.');
  lines.push('');
  lines.push('For the file overall:');
  lines.push('- If there are many prompts, write the file in multiple chunks (as per the chunking rules) but ensure that the final content is logically continuous and internally consistent.');
  lines.push('- Make sure every pending improvement and OPT item from the improvement report is represented somewhere in the prompts.');
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}


/**
 * 최종 검증 섹션 생성
 */
function buildFinalValidationSection(reportPaths: { evaluation: string; improvement: string; prompt: string }): string {
  const lines: string[] = [];

  lines.push('## 8. Final Validation Checklist');
  lines.push('');
  lines.push('After completing all TODOs and file modifications, verify the following:');
  lines.push('');
  lines.push('### 8.1 File-Level Completion');
  lines.push('');
  lines.push(`- [ ] \`${reportPaths.evaluation}\` has been fully updated in Korean.`);
  lines.push(`- [ ] \`${reportPaths.improvement}\` has been fully updated in Korean.`);
  lines.push(`- [ ] \`${reportPaths.prompt}\` has been fully updated in English and contains no Korean.`);
  lines.push('');
  lines.push('In your final response:');
  lines.push('- Mark all TODO items `[x]` with brief descriptions of which sections and files were updated.');
  lines.push('- Confirm that all three files were modified and saved using the file-edit tools.');
  lines.push('- In Korean, clearly state that the files have been updated (e.g., `세 개의 보고서 파일을 모두 수정했습니다.`).');
  lines.push('');
  lines.push('### 8.2 Content Checks');
  lines.push('');
  lines.push('**Evaluation Report (Korean):**');
  lines.push('- [ ] Project goals and vision are clearly described.');
  lines.push('- [ ] Feature overview table is present and up to date.');
  lines.push('- [ ] Global score table is present and consistent with the grade mapping.');
  lines.push('- [ ] Detailed per-feature evaluation exists for major modules.');
  lines.push('- [ ] TL;DR summary is present.');
  lines.push('- [ ] Risk summary and score-to-improvement mapping tables are consistent with improvement IDs.');
  lines.push('- [ ] Trend section is present or explicitly marked as first evaluation.');
  lines.push('- [ ] Current state summary is present and does not include session logs.');
  lines.push('');
  lines.push('**Improvement Report (Korean):**');
  lines.push('- [ ] Overall improvement summary shows only pending items.');
  lines.push('- [ ] P1/P2 functional improvement items are fully described and grounded in observed issues.');
  lines.push('- [ ] P3 feature addition items describe new capabilities only.');
  lines.push('- [ ] OPT section exists with at least one concrete optimization item.');
  lines.push('- [ ] No completed items are listed; no historical "done" log is mixed into this file.');
  lines.push('');
  lines.push('**Prompt.md (English only):**');
  lines.push('- [ ] All text is in English (no Korean anywhere).');
  lines.push('- [ ] Execution rules and checklist are present at the top.');
  lines.push('- [ ] Each pending improvement item (P1/P2/P3) has at least one concrete prompt.');
  lines.push('- [ ] All OPT items from the improvement report are represented as prompts.');
  lines.push('- [ ] Each prompt instructs the agent to modify files via file-edit tools and includes verification steps.');
  lines.push('- [ ] The file contains no references to past sessions or completed prompts.');
  lines.push('- [ ] The file ends with a clear completion section indicating that all prompts should be executed sequentially and that final verification should be run.');
  lines.push('');
  lines.push('Once all checks are satisfied and all TODOs are marked as completed, your task is done.');

  return lines.join('\n');
}
