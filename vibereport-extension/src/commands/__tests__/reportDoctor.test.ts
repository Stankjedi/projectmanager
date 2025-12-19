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
  })),
  selectWorkspaceRoot: vi.fn(),
  resolveAnalysisRoot: vi.fn((workspaceRoot: string) => workspaceRoot),
}));

function createValidEvaluationTemplate(): string {
  return [
    MARKERS.OVERVIEW_START,
    'overview',
    MARKERS.OVERVIEW_END,
    '<!-- AUTO-STRUCTURE-START -->',
    'structure',
    '<!-- AUTO-STRUCTURE-END -->',
    MARKERS.SCORE_START,
    'score',
    MARKERS.SCORE_END,
    '<!-- AUTO-DETAIL-START -->',
    'detail',
    '<!-- AUTO-DETAIL-END -->',
    MARKERS.TREND_START,
    'trend',
    MARKERS.TREND_END,
  ].join('\n');
}

function createValidImprovementTemplate(): string {
  return [
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

  const outputChannel = {
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  } as unknown as vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
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

    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(evalTemplate)
      .mockResolvedValueOnce(improvementTemplate)
      .mockResolvedValueOnce(promptMarkdown);

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

    vi.mocked(fs.readFile)
      .mockResolvedValueOnce('broken content')
      .mockResolvedValueOnce('broken content')
      .mockResolvedValueOnce('broken content');

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

    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
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
});
