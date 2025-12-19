/**
 * Report Doctor Command
 *
 * @description Validate report marker integrity and offer a repair flow that
 * regenerates managed blocks while preserving user text outside managed areas.
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ProjectSnapshot, VibeReportConfig } from '../models/types.js';
import { ReportService } from '../services/reportService.js';
import { SnapshotService } from '../services/snapshotService.js';
import { loadConfig, selectWorkspaceRoot, resolveAnalysisRoot } from '../utils/index.js';
import {
  repairReportMarkdown,
  validateReportMarkdown,
  type ReportDocumentType,
} from '../utils/reportDoctorUtils.js';

type ReportTarget = {
  type: ReportDocumentType;
  label: string;
  filePath: string;
  template: string;
};

export class ReportDoctorCommand {
  private outputChannel: vscode.OutputChannel;
  private reportService: ReportService;
  private snapshotService: SnapshotService;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.reportService = new ReportService(outputChannel);
    this.snapshotService = new SnapshotService(outputChannel);
  }

  async execute(): Promise<void> {
    const workspaceRoot = await selectWorkspaceRoot();
    if (!workspaceRoot) return;

    const config = loadConfig();
    let rootPath = workspaceRoot;
    try {
      rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
    } catch (error) {
      vscode.window.showErrorMessage(
        'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
      );
      this.outputChannel.appendLine(`[analysisRoot] invalid: ${String(error)}`);
      return;
    }
    const paths = this.reportService.getReportPaths(rootPath, config);

    const snapshot = await this.loadSnapshotBestEffort(rootPath, config);
    const evaluationTemplate = this.reportService.createEvaluationTemplate(
      snapshot,
      config.language
    );
    const improvementTemplate = this.reportService.createImprovementTemplate(
      snapshot,
      config.language
    );

    const targets: ReportTarget[] = [
      {
        type: 'evaluation',
        label: 'Evaluation Report',
        filePath: paths.evaluation,
        template: evaluationTemplate,
      },
      {
        type: 'improvement',
        label: 'Improvement Report',
        filePath: paths.improvement,
        template: improvementTemplate,
      },
      {
        type: 'prompt',
        label: 'Prompt.md',
        filePath: paths.prompt,
        template: '',
      },
    ];

    this.outputChannel.show(true);
    this.outputChannel.appendLine('='.repeat(60));
    this.outputChannel.appendLine(
      `[ReportDoctor] Started: ${new Date().toISOString()}`
    );
    this.outputChannel.appendLine(`Workspace: ${workspaceRoot}`);
    if (rootPath !== workspaceRoot) {
      this.outputChannel.appendLine(`Analysis root: ${rootPath}`);
    }
    this.outputChannel.appendLine('='.repeat(60));

    const results: Array<{
      target: ReportTarget;
      content: string;
      issues: ReturnType<typeof validateReportMarkdown>;
      fileExists: boolean;
    }> = [];

    for (const target of targets) {
      const { content, fileExists } = await this.readFileBestEffort(
        target.filePath
      );
      const issues = validateReportMarkdown(content, target.type);
      results.push({ target, content, issues, fileExists });

      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`- ${target.label}: ${target.filePath}`);
      if (!fileExists) {
        this.outputChannel.appendLine('  - Status: missing file');
      }
      if (issues.length === 0) {
        this.outputChannel.appendLine('  - OK: No issues found');
      } else {
        this.outputChannel.appendLine(`  - Issues: ${issues.length}`);
        for (const issue of issues) {
          this.outputChannel.appendLine(
            `    - [${issue.sectionId}] ${issue.code}: ${issue.message}`
          );
        }
      }
    }

    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    if (totalIssues === 0) {
      vscode.window.showInformationMessage(
        'Report Doctor: No marker/table issues found.'
      );
      return;
    }

    const action = await vscode.window.showWarningMessage(
      `Report Doctor found ${totalIssues} issue(s).`,
      { modal: true },
      'Repair',
      'Open Reports',
      'Cancel'
    );

    if (action === 'Open Reports') {
      await this.openReports(results.map(r => r.target.filePath));
      return;
    }

    if (action !== 'Repair') {
      return;
    }

    let repairedCount = 0;
    for (const result of results) {
      if (result.issues.length === 0) continue;
      if (result.target.type === 'prompt') {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(
          `[ReportDoctor] Prompt.md is not auto-repaired: ${result.target.filePath}`
        );
        continue;
      }

      const repaired = repairReportMarkdown({
        content: result.content,
        template: result.target.template,
        type: result.target.type,
      });

      if (repaired.issuesAfter.length > 0) {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(
          `[ReportDoctor] Repair still has issues for: ${result.target.filePath}`
        );
        for (const issue of repaired.issuesAfter) {
          this.outputChannel.appendLine(
            `  - [${issue.sectionId}] ${issue.code}: ${issue.message}`
          );
        }
        continue;
      }

      await fs.mkdir(path.dirname(result.target.filePath), { recursive: true });
      await fs.writeFile(result.target.filePath, repaired.content, 'utf-8');
      repairedCount++;
      this.outputChannel.appendLine(
        `[ReportDoctor] Repaired: ${result.target.filePath}`
      );
    }

    if (repairedCount > 0) {
      vscode.window.showInformationMessage(
        `Report Doctor: repaired ${repairedCount} file(s).`
      );
    } else {
      vscode.window.showWarningMessage(
        'Report Doctor: no files were repaired (see output for details).'
      );
    }
  }

  private async readFileBestEffort(
    filePath: string
  ): Promise<{ content: string; fileExists: boolean }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { content, fileExists: true };
    } catch {
      return { content: '', fileExists: false };
    }
  }

  private async openReports(filePaths: string[]): Promise<void> {
    for (const p of filePaths) {
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch {
        // Ignore failures (missing file, permissions, etc.)
      }
    }
  }

  private async loadSnapshotBestEffort(
    rootPath: string,
    config: VibeReportConfig
  ): Promise<ProjectSnapshot> {
    const state = await this.snapshotService.loadState(rootPath, config);
    if (state?.lastSnapshot) return state.lastSnapshot;
    return this.createFallbackSnapshot(rootPath);
  }

  private createFallbackSnapshot(rootPath: string): ProjectSnapshot {
    const nowIso = new Date().toISOString();
    return {
      projectName: path.basename(rootPath),
      generatedAt: nowIso,
      rootPath,
      filesCount: 0,
      dirsCount: 0,
      languageStats: {},
      importantFiles: [],
      structureSummary: [],
      mainConfigFiles: { otherConfigs: [] },
    };
  }
}
