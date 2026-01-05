import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AppliedImprovement,
  ProjectSnapshot,
  ProjectVision,
  SnapshotDiff,
  VibeReportConfig,
} from '../../models/types.js';

const vscodeMock = vi.hoisted(() => {
  const get = vi.fn();
  const getConfiguration = vi.fn(() => ({ get }));
  return { get, getConfiguration };
});

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vscodeMock.getConfiguration,
  },
}));

import { buildAnalysisPrompt } from '../analysisPromptTemplate.js';

describe('analysisPromptTemplate', () => {
  const snapshot: ProjectSnapshot = {
    projectName: 'test-project',
    generatedAt: '2025-01-01T00:00:00Z',
    rootPath: '/test/workspace',
    filesCount: 12,
    dirsCount: 3,
    languageStats: { ts: 10, json: 2 },
    importantFiles: [],
    structureSummary: [],
    mainConfigFiles: {
      packageJson: {
        name: 'test-project',
        version: '1.0.0',
        scripts: [],
        dependencies: [],
        devDependencies: [],
        hasTypeScript: true,
        hasTest: true,
        hasLint: true,
      },
      otherConfigs: [],
    },
  };

  const baseDiff: SnapshotDiff = {
    previousSnapshotTime: null,
    currentSnapshotTime: '2025-01-01T00:00:00Z',
    isInitial: true,
    newFiles: [],
    removedFiles: [],
    changedConfigs: [],
    languageStatsDiff: {},
    totalChanges: 0,
  };

	  const config: VibeReportConfig = {
	    reportDirectory: 'devplan',
	    analysisRoot: '',
	    snapshotFile: '.vscode/vibereport-state.json',
	    snapshotStorageMode: 'workspaceFile',
	    enableGitDiff: true,
	    respectGitignore: true,
	    includeSensitiveFiles: false,
	    excludePatternsIncludeDefaults: true,
	    excludePatterns: [],
	    maxFilesToScan: 5000,
	    autoOpenReports: true,
	    enableDirectAi: false,
	    language: 'ko',
    projectVisionMode: 'auto',
    defaultProjectType: 'auto-detect',
    defaultQualityFocus: 'development',
  };

  const reportPaths = {
    evaluation: 'devplan/Project_Evaluation_Report.md',
    improvement: 'devplan/Project_Improvement_Exploration_Report.md',
    prompt: 'devplan/Prompt.md',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vscodeMock.get.mockReturnValue('');
  });

  it('includes required headings and marker names', () => {
    const prompt = buildAnalysisPrompt(
      snapshot,
      baseDiff,
      [],
      true,
      config,
      reportPaths
    );

    expect(prompt).toContain(
      `# ${snapshot.projectName} – Automated Evaluation, Improvement & Prompt Generation`
    );
    expect(prompt).toContain('## 1. Global Language Rules (Mandatory)');
    expect(prompt).toContain('## 2. TODO Checklist – Execute in Order');
    expect(prompt).toContain('## 5. File 1 – Project Evaluation Report (Korean)');
    expect(prompt).toContain('## 6. File 2 – Project Improvement Exploration Report (Korean)');
    expect(prompt).toContain('## 7. File 3 – Prompt.md (English Only)');
    expect(prompt).toContain('## 8. Final Validation Checklist');

    // Marker names referenced in the prompt must remain stable.
    expect(prompt).toContain('<!-- AUTO-OVERVIEW-START -->');
    expect(prompt).toContain('<!-- AUTO-OVERVIEW-END -->');
    expect(prompt).toContain('<!-- AUTO-SCORE-START -->');
    expect(prompt).toContain('<!-- AUTO-SCORE-END -->');
    expect(prompt).toContain('<!-- AUTO-IMPROVEMENT-LIST-START -->');
    expect(prompt).toContain('<!-- AUTO-IMPROVEMENT-LIST-END -->');

    const idx1 = prompt.indexOf('## 1. Global Language Rules (Mandatory)');
    const idx2 = prompt.indexOf('## 2. TODO Checklist – Execute in Order');
    const idx3 = prompt.indexOf('## 3. File Editing Rules (Tools & Chunking)');
    const idx4 = prompt.indexOf('## 4. Project Context (Read-Only, for Analysis)');
    const idx5 = prompt.indexOf('## 5. File 1 – Project Evaluation Report (Korean)');
    const idx6 = prompt.indexOf('## 6. File 2 – Project Improvement Exploration Report (Korean)');
    const idx7 = prompt.indexOf('## 7. File 3 – Prompt.md (English Only)');
    const idx8 = prompt.indexOf('## 8. Final Validation Checklist');

    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThan(idx1);
    expect(idx3).toBeGreaterThan(idx2);
    expect(idx4).toBeGreaterThan(idx3);
    expect(idx5).toBeGreaterThan(idx4);
    expect(idx6).toBeGreaterThan(idx5);
    expect(idx7).toBeGreaterThan(idx6);
    expect(idx8).toBeGreaterThan(idx7);
  });

  it('adds recon, language exceptions, security rules, SSOT, and improved TODO-4 wording', () => {
    const prompt = buildAnalysisPrompt(
      snapshot,
      baseDiff,
      [],
      true,
      config,
      reportPaths
    );

    expect(prompt).toContain('## 0. Pre-flight Recon (Mandatory)');
    expect(prompt).toContain('### 1.X Language Exceptions (Applies to Korean-only files)');
    expect(prompt).toContain('### 1.Y Security / Sensitive Files (Mandatory)');
    expect(prompt).toContain('### 2.X Improvement IDs – Single Source of Truth (SSOT)');
    expect(prompt).toContain(
      'TODO-4` – Evaluation Report Part 4 – TL;DR + Risk Summary + Score↔Improvement Mapping + Trend + Current State Summary'
    );
  });

  it('marks sensitive newly added files separately', () => {
    const diff: SnapshotDiff = {
      ...baseDiff,
      isInitial: false,
      newFiles: ['vsctoken.txt', 'src/new-safe.ts'],
    };

    const prompt = buildAnalysisPrompt(
      snapshot,
      diff,
      [],
      false,
      config,
      reportPaths
    );

    expect(prompt).toContain('Recently added files (review them if relevant; do NOT open sensitive files):');
    expect(prompt).toContain('`src/new-safe.ts`');
    expect(prompt).toContain('Sensitive files detected (do not open or copy contents):');
    expect(prompt).toContain('`vsctoken.txt` (sensitive)');
  });

  it('redacts TODO/FIXME findings from sensitive files', () => {
    const snapshotWithFindings: ProjectSnapshot = {
      ...snapshot,
      todoFixmeFindings: [
        { file: 'src/todo.ts', line: 12, tag: 'TODO', text: 'add validation' },
        { file: 'vsctoken.txt', line: 1, tag: 'TODO', text: 'super-secret-token=DO_NOT_LEAK' },
      ],
    };

    const prompt = buildAnalysisPrompt(
      snapshotWithFindings,
      baseDiff,
      [],
      true,
      config,
      reportPaths
    );

    expect(prompt).toContain('| `src/todo.ts` | 12 | TODO | add validation |');
    expect(prompt).not.toContain('DO_NOT_LEAK');
    expect(prompt).toContain('Note: 1 finding(s) in sensitive files were redacted.');
  });

  it('renders TODO/FIXME findings when available', () => {
    const snapshotWithFindings: ProjectSnapshot = {
      ...snapshot,
      todoFixmeFindings: [
        { file: 'src/todo.ts', line: 12, tag: 'TODO', text: 'add validation' },
        { file: 'src/fixme.ts', line: 3, tag: 'FIXME', text: 'handle edge cases' },
      ],
    };

    const prompt = buildAnalysisPrompt(
      snapshotWithFindings,
      baseDiff,
      [],
      true,
      config,
      reportPaths
    );

    expect(prompt).toContain('### TODO/FIXME Findings (Auto Scan)');
    expect(prompt).toContain('| `src/todo.ts` | 12 | TODO | add validation |');
    expect(prompt).toContain('| `src/fixme.ts` | 3 | FIXME | handle edge cases |');
  });

  it('includes custom instructions, recent changes, applied items, and project vision when provided', () => {
    const diff: SnapshotDiff = {
      ...baseDiff,
      isInitial: false,
      newFiles: Array.from({ length: 12 }, (_, idx) => `src/new-${idx}.ts`),
      removedFiles: ['src/old.ts'],
    };

    const appliedImprovements: AppliedImprovement[] = [
      {
        id: 'test-coverage-001',
        title: 'Add coverage tests for prompt generation',
        appliedAt: '2025-01-01T00:00:00Z',
        sessionId: 'session-1',
      },
    ];

    const projectVision: ProjectVision = {
      coreGoals: ['Improve CI signal', 'Raise unit test coverage'],
      targetUsers: 'VS Code extension developers',
      projectType: 'vscode-extension',
      techStackPriorities: ['TypeScript', 'VS Code API'],
      qualityFocus: 'development',
      excludeCategories: [],
      focusCategories: [],
    };

    vscodeMock.get.mockReturnValue('Use clear headings and keep changes minimal.');

    const prompt = buildAnalysisPrompt(
      snapshot,
      diff,
      appliedImprovements,
      false,
      config,
      reportPaths,
      projectVision
    );

    expect(prompt).toContain('[User Custom Instructions]');
    expect(prompt).toContain('Use clear headings and keep changes minimal.');
    expect(prompt).toContain('Recently added files');
    expect(prompt).toContain('... and 2 more');
    expect(prompt).toContain('Recently removed files:');
    expect(prompt).toContain('### Already Applied Improvements (Exclude from reports)');
    expect(prompt).toContain(
      `- ${appliedImprovements[0].title} (\`${appliedImprovements[0].id}\`)`
    );
    expect(prompt).toContain('Reflect the following User-Defined Project Vision:');
    expect(prompt).toContain(`- **Core Goals:** ${projectVision.coreGoals.join(', ')}`);
  });
});
