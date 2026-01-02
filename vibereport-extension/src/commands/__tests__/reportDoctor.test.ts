import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { MARKERS } from '../../utils/markdownUtils.js';

vi.mock('vscode', () => ({
  Uri: {
    file: vi.fn((p: string) => ({ fsPath: p })),
  },
  workspace: {
    openTextDocument: vi.fn(),
    findFiles: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  window: {
    showTextDocument: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
}));

vi.mock('fs/promises');

vi.mock('../../utils/index.js', () => ({
  loadConfig: vi.fn(() => ({
    reportDirectory: 'devplan',
    analysisRoot: '',
    snapshotFile: '.vscode/vibereport-state.json',
    language: 'ko',
    includeSensitiveFiles: false,
    excludePatterns: [],
    maxFilesToScan: 5000,
  })),
  selectWorkspaceRoot: vi.fn(),
  resolveAnalysisRoot: vi.fn((workspaceRoot: string) => workspaceRoot),
}));

function createValidEvaluationTemplate(): string {
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

function createValidImprovementTemplate(): string {
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

function createValidPromptMarkdown(): string {
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
    'Print: `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`',
    '',
  ].join('\n');
}

function mockReadFileWithMap(map: Record<string, string>): void {
  vi.mocked(fs.readFile).mockImplementation(async (filePath: unknown) => {
    const key = String(filePath);
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      return map[key];
    }
    throw new Error('ENOENT');
  });
}

describe('ReportDoctorCommand', () => {
  const rootPath = 'C:\\test\\workspace';
  const paths = {
    evaluation: path.join(rootPath, 'devplan', 'Project_Evaluation_Report.md'),
    improvement: path.join(
      rootPath,
      'devplan',
      'Project_Improvement_Exploration_Report.md'
    ),
    prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
  };
  const docsPaths = {
    packageJson: path.join(rootPath, 'vibereport-extension', 'package.json'),
    changelog: path.join(rootPath, 'vibereport-extension', 'CHANGELOG.md'),
    readme: path.join(rootPath, 'README.md'),
  };
  const packageVersion = '0.4.30';
  const matchingDocs = {
    packageJson: JSON.stringify({ version: packageVersion }),
    changelog: `## [${packageVersion}] - 2025-12-23`,
    readme: `Install vibereport-${packageVersion}.vsix`,
  };

  const outputChannel = {
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  } as unknown as vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vscode.workspace.findFiles).mockResolvedValue([] as any);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('reports no issues when markers are valid', async () => {
    const { selectWorkspaceRoot } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();
    const promptMarkdown = createValidPromptMarkdown();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    mockReadFileWithMap({
      [paths.evaluation]: evalTemplate,
      [paths.improvement]: improvementTemplate,
      [paths.prompt]: promptMarkdown,
      [docsPaths.packageJson]: matchingDocs.packageJson,
      [docsPaths.changelog]: matchingDocs.changelog,
      [docsPaths.readme]: matchingDocs.readme,
    });

    await command.execute();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Report Doctor: No marker/table issues found.'
    );
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('opens reports when the user selects Open Reports', async () => {
    const { selectWorkspaceRoot } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    mockReadFileWithMap({
      [paths.evaluation]: 'broken content',
      [paths.improvement]: 'broken content',
      [paths.prompt]: 'broken content',
      [docsPaths.packageJson]: matchingDocs.packageJson,
      [docsPaths.changelog]: matchingDocs.changelog,
      [docsPaths.readme]: matchingDocs.readme,
    });

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Open Reports' as unknown as vscode.MessageItem
    );
    vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
    vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);

    await command.execute();

    expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(3);
    expect(vscode.window.showTextDocument).toHaveBeenCalledTimes(3);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('repairs missing reports by writing templates when the user selects Repair', async () => {
    const { selectWorkspaceRoot } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    vi.mocked(fs.readFile).mockImplementation(async (filePath: unknown) => {
      const key = String(filePath);
      if (key === docsPaths.packageJson) return matchingDocs.packageJson;
      if (key === docsPaths.changelog) return matchingDocs.changelog;
      if (key === docsPaths.readme) return matchingDocs.readme;
      throw new Error('ENOENT');
    });
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Repair' as unknown as vscode.MessageItem
    );

    await command.execute();

    expect(fs.writeFile).toHaveBeenCalledWith(
      paths.evaluation,
      evalTemplate,
      'utf-8'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      paths.improvement,
      improvementTemplate,
      'utf-8'
    );
    expect(fs.writeFile).not.toHaveBeenCalledWith(
      paths.prompt,
      expect.anything(),
      'utf-8'
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Report Doctor: repaired 2 file(s).'
    );
  });

  it('opens docs when version sync issues are detected', async () => {
    const { selectWorkspaceRoot } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();
    const promptMarkdown = createValidPromptMarkdown();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    mockReadFileWithMap({
      [paths.evaluation]: evalTemplate,
      [paths.improvement]: improvementTemplate,
      [paths.prompt]: promptMarkdown,
      [docsPaths.packageJson]: matchingDocs.packageJson,
      [docsPaths.changelog]: '## [0.4.29] - 2025-12-20',
      [docsPaths.readme]: 'Install vibereport-0.4.28.vsix',
    });

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Open Docs' as unknown as vscode.MessageItem
    );
    vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
    vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);

    await command.execute();

    expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(3);
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fsPath: docsPaths.readme })
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fsPath: docsPaths.changelog })
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ fsPath: docsPaths.packageJson })
    );
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('fixes docs when the user selects Fix Docs Versions', async () => {
    const { selectWorkspaceRoot } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();
    const promptMarkdown = createValidPromptMarkdown();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    const mismatchedDocs = {
      changelog: '## [0.4.29] - 2025-12-20',
      readme: [
        'Current version: 0.4.28',
        'Install vibereport-0.4.28.vsix',
        'Download https://github.com/Stankjedi/projectmanager/releases/download/v0.4.28/vibereport-0.4.28.vsix',
      ].join('\n'),
    };

    mockReadFileWithMap({
      [paths.evaluation]: evalTemplate,
      [paths.improvement]: improvementTemplate,
      [paths.prompt]: promptMarkdown,
      [docsPaths.packageJson]: matchingDocs.packageJson,
      [docsPaths.changelog]: mismatchedDocs.changelog,
      [docsPaths.readme]: mismatchedDocs.readme,
    });

    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Fix Docs Versions' as unknown as vscode.MessageItem
    );

    await command.execute();

    expect(fs.writeFile).toHaveBeenCalledWith(
      docsPaths.readme,
      expect.stringContaining(`vibereport-${packageVersion}.vsix`),
      'utf-8'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      docsPaths.changelog,
      expect.stringContaining(`## [${packageVersion}]`),
      'utf-8'
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Report Doctor: fixed docs version sync (2 file(s) updated).'
    );

    expect(outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('[ReportDoctor] Fixed docs versions:')
    );
  });

  it('fixes docs + repairs reports when the user selects Fix All Safe Issues', async () => {
    const { selectWorkspaceRoot } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();
    const promptMarkdown = createValidPromptMarkdown();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    const fileMap: Record<string, string> = {
      [paths.evaluation]: 'broken content',
      [paths.improvement]: 'broken content',
      [paths.prompt]: promptMarkdown,
      [docsPaths.packageJson]: matchingDocs.packageJson,
      [docsPaths.changelog]: '## [0.4.29] - 2025-12-20',
      [docsPaths.readme]: 'Install vibereport-0.4.28.vsix',
    };

    vi.mocked(fs.readFile).mockImplementation(async (filePath: unknown) => {
      const key = String(filePath);
      if (Object.prototype.hasOwnProperty.call(fileMap, key)) {
        return fileMap[key];
      }
      throw new Error('ENOENT');
    });

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockImplementation(async (filePath: unknown, data: unknown) => {
      fileMap[String(filePath)] = String(data);
      return undefined;
    });

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Fix All Safe Issues' as unknown as vscode.MessageItem
    );

    await command.execute();

    expect(fs.writeFile).toHaveBeenCalledWith(
      docsPaths.readme,
      expect.stringContaining(`vibereport-${packageVersion}.vsix`),
      'utf-8'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      docsPaths.changelog,
      expect.stringContaining(`## [${packageVersion}]`),
      'utf-8'
    );

    expect(fs.writeFile).toHaveBeenCalledWith(
      paths.evaluation,
      expect.stringContaining(MARKERS.TLDR_START),
      'utf-8'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      paths.improvement,
      expect.stringContaining(MARKERS.OVERVIEW_START),
      'utf-8'
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Report Doctor: fixed all safe issues')
    );
  });

  it('opens docs when README version differs from package.json', async () => {
    const { selectWorkspaceRoot } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();
    const promptMarkdown = createValidPromptMarkdown();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    mockReadFileWithMap({
      [paths.evaluation]: evalTemplate,
      [paths.improvement]: improvementTemplate,
      [paths.prompt]: promptMarkdown,
      [docsPaths.packageJson]: matchingDocs.packageJson,
      [docsPaths.changelog]: matchingDocs.changelog,
      [docsPaths.readme]: 'Install vibereport-0.4.28.vsix',
    });

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Open Docs' as unknown as vscode.MessageItem
    );
    vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
    vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);

    await command.execute();

    expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(3);
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fsPath: docsPaths.readme })
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fsPath: docsPaths.changelog })
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ fsPath: docsPaths.packageJson })
    );
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('opens docs when CHANGELOG version differs from package.json', async () => {
    const { selectWorkspaceRoot } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();
    const promptMarkdown = createValidPromptMarkdown();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    mockReadFileWithMap({
      [paths.evaluation]: evalTemplate,
      [paths.improvement]: improvementTemplate,
      [paths.prompt]: promptMarkdown,
      [docsPaths.packageJson]: matchingDocs.packageJson,
      [docsPaths.changelog]: '## [0.4.29] - 2025-12-20',
      [docsPaths.readme]: matchingDocs.readme,
    });

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Open Docs' as unknown as vscode.MessageItem
    );
    vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
    vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);

    await command.execute();

    expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(3);
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fsPath: docsPaths.readme })
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fsPath: docsPaths.changelog })
    );
    expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ fsPath: docsPaths.packageJson })
    );
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('warns when sensitive files are present and includeSensitiveFiles is true', async () => {
    const { selectWorkspaceRoot, loadConfig } = await import('../../utils/index.js');
    vi.mocked(selectWorkspaceRoot).mockResolvedValue(rootPath);
    vi.mocked(loadConfig).mockReturnValue({
      reportDirectory: 'devplan',
      analysisRoot: '',
      snapshotFile: '.vscode/vibereport-state.json',
      language: 'ko',
      includeSensitiveFiles: true,
      excludePatterns: [],
      maxFilesToScan: 5000,
    } as any);

    const { ReportDoctorCommand } = await import('../reportDoctor.js');
    const command = new ReportDoctorCommand(outputChannel);

    const evalTemplate = createValidEvaluationTemplate();
    const improvementTemplate = createValidImprovementTemplate();
    const promptMarkdown = createValidPromptMarkdown();

    (command as unknown as { reportService: unknown }).reportService = {
      getReportPaths: vi.fn(() => ({
        evaluation: paths.evaluation,
        improvement: paths.improvement,
        sessionHistory: path.join(rootPath, 'devplan', 'Session_History.md'),
        prompt: path.join(rootPath, 'devplan', 'Prompt.md'),
      })),
      createEvaluationTemplate: vi.fn(() => evalTemplate),
      createImprovementTemplate: vi.fn(() => improvementTemplate),
    };

    (command as unknown as { snapshotService: unknown }).snapshotService = {
      loadState: vi.fn().mockResolvedValue(null),
    };

    mockReadFileWithMap({
      [paths.evaluation]: evalTemplate,
      [paths.improvement]: improvementTemplate,
      [paths.prompt]: promptMarkdown,
      [docsPaths.packageJson]: matchingDocs.packageJson,
      [docsPaths.changelog]: matchingDocs.changelog,
      [docsPaths.readme]: matchingDocs.readme,
    });

    vi.mocked(vscode.workspace.findFiles).mockResolvedValue([
      { fsPath: path.join(rootPath, 'vsctoken.txt') },
    ] as any);

    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(
      'Continue' as unknown as vscode.MessageItem
    );

    await command.execute();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Sensitive files were detected'),
      { modal: true },
      'Open Settings',
      'Continue'
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Report Doctor: No marker/table issues found.'
    );
  });
});
