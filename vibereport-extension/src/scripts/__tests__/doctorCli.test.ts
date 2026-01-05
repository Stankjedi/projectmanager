import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MARKERS } from '../../utils/markdownUtils.js';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-doctor-'));
}

function createValidEvaluationReport(): string {
  return [
    MARKERS.TLDR_START,
    '| Item | Value |',
    '|:---|:---|',
    '| **Overall Grade** | B |',
    MARKERS.TLDR_END,
    '',
    MARKERS.RISK_SUMMARY_START,
    '| Risk Level | Item | Related Improvement ID |',
    '|-----------|------|-------------------------|',
    '| Low | - | - |',
    MARKERS.RISK_SUMMARY_END,
    '',
    MARKERS.OVERVIEW_START,
    '| Item | Value |',
    '|------|-------|',
    '| **Project Name** | demo |',
    MARKERS.OVERVIEW_END,
    '<!-- AUTO-STRUCTURE-START -->',
    'structure',
    '<!-- AUTO-STRUCTURE-END -->',
    MARKERS.SCORE_START,
    '| Category | Score | Grade | Change |',
    '|----------|-------|-------|--------|',
    '| **Code Quality** | 80 | B- | - |',
    MARKERS.SCORE_END,
    '',
    MARKERS.SCORE_MAPPING_START,
    '| Category | Current Score | Major Risk | Related Improvement IDs |',
    '|----------|--------------|------------|--------------------------|',
    '| Test Coverage | 80 (B-) | - | - |',
    MARKERS.SCORE_MAPPING_END,
    '<!-- AUTO-DETAIL-START -->',
    'detail',
    '<!-- AUTO-DETAIL-END -->',
    '',
    MARKERS.SUMMARY_START,
    'summary',
    MARKERS.SUMMARY_END,
    MARKERS.TREND_START,
    '| Version | Date | Total | Major Changes |',
    '|---------|------|-------|---------------|',
    '| - | - | - | - |',
    MARKERS.TREND_END,
  ].join('\n');
}

function createValidImprovementReport(): string {
  return [
    MARKERS.OVERVIEW_START,
    '| Item | Value |',
    '|------|-------|',
    '| **Project Name** | demo |',
    MARKERS.OVERVIEW_END,
    '',
    MARKERS.ERROR_EXPLORATION_START,
    'error exploration',
    MARKERS.ERROR_EXPLORATION_END,
    MARKERS.SUMMARY_START,
    'summary',
    MARKERS.SUMMARY_END,
    MARKERS.IMPROVEMENT_LIST_START,
    'improvement list',
    MARKERS.IMPROVEMENT_LIST_END,
    MARKERS.OPTIMIZATION_START,
    'optimization',
    MARKERS.OPTIMIZATION_END,
    '',
    MARKERS.FEATURE_LIST_START,
    'features',
    MARKERS.FEATURE_LIST_END,
  ].join('\n');
}

function createValidPromptFile(): string {
  return [
    '# AI Agent Improvement Prompts',
    '',
    '## Execution Checklist',
    '| # | Prompt ID | Title | Priority | Status |',
    '|:---:|:---|:---|:---:|:---:|',
    '| 1 | PROMPT-001 | Example prompt | P1 | ⬜ Pending |',
    '| 2 | OPT-1 | Example optimization | OPT | ⬜ Pending |',
    '',
    '---',
    '',
    '### [PROMPT-001] Example prompt',
    '',
    'After completing this prompt, proceed to OPT-1.',
    '',
    '---',
    '',
    '### [OPT-1] Example optimization',
    '',
    'After completing this prompt, proceed to Final Completion.',
    '',
    '---',
    '',
    '## Final Completion',
    '',
    'ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.',
    '',
  ].join('\n');
}

describe('doctorCli', () => {
  it('returns exit code 1 when docs versions are out of sync', async () => {
    const { runDoctorCli } = await import('../doctorCli.js');

    const tempRoot = createTempDir();
    const repoRoot = tempRoot;
    const extensionRoot = path.join(repoRoot, 'vibereport-extension');
    fs.mkdirSync(path.join(repoRoot, 'devplan'), { recursive: true });
    fs.mkdirSync(extensionRoot, { recursive: true });

    const packageVersion = '1.2.3';
    fs.writeFileSync(
      path.join(extensionRoot, 'package.json'),
      JSON.stringify({ version: packageVersion }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(extensionRoot, 'CHANGELOG.md'),
      `## [${packageVersion}] - 2026-01-02`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(repoRoot, 'README.md'),
      `Current version: 0.0.1\nInstall vibereport-0.0.1.vsix`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(extensionRoot, 'README.md'),
      `Install vibereport-${packageVersion}.vsix`,
      'utf-8'
    );

    fs.writeFileSync(
      path.join(repoRoot, 'devplan', 'Project_Evaluation_Report.md'),
      createValidEvaluationReport(),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(repoRoot, 'devplan', 'Project_Improvement_Exploration_Report.md'),
      createValidImprovementReport(),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(repoRoot, 'devplan', 'Prompt.md'),
      createValidPromptFile(),
      'utf-8'
    );

    const exitCode = await runDoctorCli({
      argv: ['check'],
      cwd: extensionRoot,
      stdout: { log: () => {} },
      stderr: { error: () => {} },
    });

    expect(exitCode).toBe(1);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('supports JSON output mode for CI parsers', async () => {
    const { runDoctorCli } = await import('../doctorCli.js');

    const tempRoot = createTempDir();
    const repoRoot = tempRoot;
    const extensionRoot = path.join(repoRoot, 'vibereport-extension');
    fs.mkdirSync(path.join(repoRoot, 'devplan'), { recursive: true });
    fs.mkdirSync(extensionRoot, { recursive: true });

    const packageVersion = '1.2.3';
    fs.writeFileSync(
      path.join(extensionRoot, 'package.json'),
      JSON.stringify({ version: packageVersion }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(extensionRoot, 'CHANGELOG.md'),
      `## [${packageVersion}] - 2026-01-02`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(repoRoot, 'README.md'),
      `Current version: ${packageVersion}\nInstall vibereport-${packageVersion}.vsix`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(extensionRoot, 'README.md'),
      `Install vibereport-${packageVersion}.vsix`,
      'utf-8'
    );

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    const exitCode = await runDoctorCli({
      argv: ['check', '--format', 'json'],
      cwd: extensionRoot,
      stdout: { log: (line: string) => stdoutLines.push(line) },
      stderr: { error: (line: string) => stderrLines.push(line) },
    });

    expect(exitCode).toBe(1);
    expect(stderrLines.length).toBeGreaterThanOrEqual(0);
    expect(stdoutLines).toHaveLength(1);

    const parsed = JSON.parse(stdoutLines[0]) as any;
    expect(parsed).toHaveProperty('ok');
    expect(parsed).toHaveProperty('exitCode');
    expect(parsed).toHaveProperty('issuesFound');
    expect(parsed).toHaveProperty('missingFiles');
    expect(parsed).toHaveProperty('docsIssues');
    expect(parsed).toHaveProperty('reportIssues');

    expect(parsed.ok).toBe(false);
    expect(parsed.exitCode).toBe(1);
    expect(parsed.missingFiles).toEqual(
      expect.arrayContaining([path.join(repoRoot, 'devplan', 'Prompt.md')])
    );

    const promptReport = (parsed.reportIssues as any[]).find(
      r => r.label === 'devplan/Prompt.md'
    );
    expect(promptReport).toBeTruthy();
    expect(promptReport.exists).toBe(false);
    expect(Array.isArray(promptReport.issues)).toBe(true);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
