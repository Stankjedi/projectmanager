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
  validateDocsVersionSync,
  fixDocsVersionSync,
  findSensitiveFiles,
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

  constructor(outputChannel: vscode.OutputChannel, storageRoot?: string) {
    this.outputChannel = outputChannel;
    this.reportService = new ReportService(outputChannel);
    this.snapshotService = new SnapshotService(outputChannel, storageRoot);
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
    const docsPaths = {
      packageJson: path.join(workspaceRoot, 'vibereport-extension', 'package.json'),
      changelog: path.join(workspaceRoot, 'vibereport-extension', 'CHANGELOG.md'),
      readme: path.join(workspaceRoot, 'README.md'),
    };

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

    const excludePattern =
      config.excludePatterns.length > 0 ? `{${config.excludePatterns.join(',')}}` : undefined;

    const sensitiveUris = await vscode.workspace.findFiles(
      '**/*',
      excludePattern,
      config.maxFilesToScan
    );
    const repoRelativeFiles = sensitiveUris
      .filter((uri) => uri.fsPath.startsWith(rootPath))
      .map((uri) => path.relative(rootPath, uri.fsPath).replace(/\\/g, '/'));

    const sensitiveFiles = findSensitiveFiles(repoRelativeFiles);
    if (sensitiveFiles.length > 0) {
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(
        `[ReportDoctor] Sensitive files detected (${sensitiveFiles.length}, showing up to ${Math.min(
          sensitiveFiles.length,
          20
        )}):`
      );
      for (const filePath of sensitiveFiles) {
        this.outputChannel.appendLine(`  - ${filePath}`);
      }

      if (config.includeSensitiveFiles === true) {
        const choice = await vscode.window.showWarningMessage(
          'Sensitive files were detected in this workspace. Consider disabling vibereport.includeSensitiveFiles before sharing or exporting reports.',
          { modal: true },
          'Open Settings',
          'Continue'
        );

        if (choice === 'Open Settings') {
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'vibereport.includeSensitiveFiles'
          );
          return;
        }

        if (choice !== 'Continue') {
          return;
        }
      } else {
        vscode.window.showInformationMessage(
          `Report Doctor: detected ${sensitiveFiles.length} sensitive file(s). Review before sharing/exporting.`
        );
      }
    }

    const results: Array<{
      target: ReportTarget;
      content: string;
      issues: ReturnType<typeof validateReportMarkdown>;
      fileExists: boolean;
    }> = await Promise.all(
      targets.map(async (target) => {
        const { content, fileExists } = await this.readFileBestEffort(
          target.filePath
        );
        const issues = validateReportMarkdown(content, target.type);
        return { target, content, issues, fileExists };
      })
    );

    for (const result of results) {
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(
        `- ${result.target.label}: ${result.target.filePath}`
      );
      if (!result.fileExists) {
        this.outputChannel.appendLine('  - Status: missing file');
      }
      if (result.issues.length === 0) {
        this.outputChannel.appendLine('  - OK: No issues found');
      } else {
        this.outputChannel.appendLine(`  - Issues: ${result.issues.length}`);
        for (const issue of result.issues) {
          this.outputChannel.appendLine(
            `    - [${issue.sectionId}] ${issue.code}: ${issue.message}`
          );
        }
      }
    }

    const [packageResult, changelogResult, readmeResult] = await Promise.all([
      this.readFileBestEffort(docsPaths.packageJson),
      this.readFileBestEffort(docsPaths.changelog),
      this.readFileBestEffort(docsPaths.readme),
    ]);

    let packageVersion = '';
    if (packageResult.fileExists) {
      try {
        const parsed = JSON.parse(packageResult.content) as { version?: string };
        if (typeof parsed.version === 'string') {
          packageVersion = parsed.version;
        }
      } catch {
        packageVersion = '';
      }
    }

    const docsIssues = validateDocsVersionSync({
      packageVersion,
      readmeContent: readmeResult.content,
      changelogContent: changelogResult.content,
    });

    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(
      `- Docs: ${docsPaths.readme} | ${docsPaths.changelog} | ${docsPaths.packageJson}`
    );
    if (docsIssues.length === 0) {
      this.outputChannel.appendLine('  - OK: No issues found');
    } else {
      this.outputChannel.appendLine(`  - Issues: ${docsIssues.length}`);
      for (const issue of docsIssues) {
        this.outputChannel.appendLine(
          `    - [${issue.sectionId}] ${issue.code}: ${issue.message}`
        );
      }
    }

    const reportIssuesCount = results.reduce((sum, r) => sum + r.issues.length, 0);
    const totalIssues = reportIssuesCount + docsIssues.length;
    if (totalIssues === 0) {
      vscode.window.showInformationMessage(
        'Report Doctor: No marker/table issues found.'
      );
      return;
    }

    const safeFixableReportIssuesCount = results.reduce((sum, r) => {
      if (r.target.type === 'prompt') return sum;
      return sum + r.issues.length;
    }, 0);
    const hasSafeFixableIssues =
      docsIssues.length > 0 || safeFixableReportIssuesCount > 0;

    const actions: string[] = [];
    if (hasSafeFixableIssues) {
      actions.push('Fix All Safe Issues');
    }
    if (reportIssuesCount > 0) {
      actions.push('Repair', 'Open Reports');
    }
    if (docsIssues.length > 0) {
      actions.push('Fix Docs Versions', 'Open Docs');
    }
    actions.push('Cancel');

    const action = await vscode.window.showWarningMessage(
      `Report Doctor found ${totalIssues} issue(s).`,
      { modal: true },
      ...actions
    );

    if (action === 'Fix All Safe Issues') {
      const changedFiles: string[] = [];
      const failures: Array<{ filePath: string; error: unknown }> = [];

      if (docsIssues.length > 0) {
        if (!packageVersion) {
          failures.push({
            filePath: docsPaths.packageJson,
            error: new Error('package.json version is missing'),
          });
        } else {
          const fixed = fixDocsVersionSync({
            packageVersion,
            readmeContent: readmeResult.content,
            changelogContent: changelogResult.content,
          });

          try {
            if (fixed.changed.readme) {
              await fs.writeFile(docsPaths.readme, fixed.readmeContent, 'utf-8');
              changedFiles.push(docsPaths.readme);
            }
          } catch (error) {
            failures.push({ filePath: docsPaths.readme, error });
          }

          try {
            if (fixed.changed.changelog) {
              await fs.writeFile(docsPaths.changelog, fixed.changelogContent, 'utf-8');
              changedFiles.push(docsPaths.changelog);
            }
          } catch (error) {
            failures.push({ filePath: docsPaths.changelog, error });
          }
        }
      }

      for (const result of results) {
        if (result.issues.length === 0) continue;
        if (result.target.type === 'prompt') continue;

        try {
          const repaired = repairReportMarkdown({
            content: result.content,
            template: result.target.template,
            type: result.target.type,
          });

          if (!repaired.changed) continue;
          if (repaired.issuesAfter.length > 0) {
            failures.push({
              filePath: result.target.filePath,
              error: new Error(`repair produced ${repaired.issuesAfter.length} remaining issue(s)`),
            });
            continue;
          }

          await fs.mkdir(path.dirname(result.target.filePath), { recursive: true });
          await fs.writeFile(result.target.filePath, repaired.content, 'utf-8');
          changedFiles.push(result.target.filePath);
        } catch (error) {
          failures.push({ filePath: result.target.filePath, error });
        }
      }

      const refreshedResults: Array<{
        target: ReportTarget;
        content: string;
        issues: ReturnType<typeof validateReportMarkdown>;
        fileExists: boolean;
      }> = await Promise.all(
        targets.map(async (target) => {
          const { content, fileExists } = await this.readFileBestEffort(
            target.filePath
          );
          const issues = validateReportMarkdown(content, target.type);
          return { target, content, issues, fileExists };
        })
      );

      const [readmeAfter, changelogAfter] = await Promise.all([
        this.readFileBestEffort(docsPaths.readme),
        this.readFileBestEffort(docsPaths.changelog),
      ]);

      const refreshedDocsIssues = validateDocsVersionSync({
        packageVersion,
        readmeContent: readmeAfter.content,
        changelogContent: changelogAfter.content,
      });

      const remainingReportIssues = refreshedResults.reduce(
        (sum, r) => sum + r.issues.length,
        0
      );
      const remainingTotalIssues = remainingReportIssues + refreshedDocsIssues.length;

      this.outputChannel.appendLine('');
      if (changedFiles.length > 0) {
        this.outputChannel.appendLine(
          `[ReportDoctor] Fix All Safe Issues updated ${changedFiles.length} file(s): ${changedFiles.join(', ')}`
        );
      } else {
        this.outputChannel.appendLine('[ReportDoctor] Fix All Safe Issues made no changes.');
      }

      if (failures.length > 0) {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(
          `[ReportDoctor] Fix All Safe Issues encountered ${failures.length} failure(s):`
        );
        for (const failure of failures) {
          this.outputChannel.appendLine(
            `  - ${failure.filePath}: ${String(failure.error)}`
          );
        }
      }

      if (remainingTotalIssues === 0) {
        vscode.window.showInformationMessage(
          `Report Doctor: fixed all safe issues (${changedFiles.length} file(s) updated).`
        );
        return;
      }

      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(
        `[ReportDoctor] Remaining issues after Fix All Safe Issues: ${remainingTotalIssues}`
      );
      for (const result of refreshedResults) {
        if (result.issues.length === 0) continue;
        this.outputChannel.appendLine(`- ${result.target.label}: ${result.target.filePath}`);
        for (const issue of result.issues) {
          this.outputChannel.appendLine(
            `  - [${issue.sectionId}] ${issue.code}: ${issue.message}`
          );
        }
      }
      for (const issue of refreshedDocsIssues) {
        this.outputChannel.appendLine(
          `- [${issue.sectionId}] ${issue.code}: ${issue.message}`
        );
      }

      const promptIssues = refreshedResults.find(
        (r) => r.target.type === 'prompt'
      )?.issues;
      if (promptIssues && promptIssues.length > 0) {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(
          `[ReportDoctor] Prompt.md is not auto-repaired and still has ${promptIssues.length} issue(s).`
        );
      }

      vscode.window.showWarningMessage(
        'Report Doctor: some issues remain after Fix All Safe Issues (see output for details).'
      );
      return;
    }

    if (action === 'Open Reports') {
      await this.openReports(results.map(r => r.target.filePath));
      return;
    }

    if (action === 'Fix Docs Versions') {
      if (!packageVersion) {
        vscode.window.showErrorMessage(
          'Report Doctor: cannot fix docs because package.json version is missing.'
        );
        return;
      }

      const fixed = fixDocsVersionSync({
        packageVersion,
        readmeContent: readmeResult.content,
        changelogContent: changelogResult.content,
      });

      const changedFiles: string[] = [];
      if (fixed.changed.readme) {
        await fs.writeFile(docsPaths.readme, fixed.readmeContent, 'utf-8');
        changedFiles.push(docsPaths.readme);
      }
      if (fixed.changed.changelog) {
        await fs.writeFile(docsPaths.changelog, fixed.changelogContent, 'utf-8');
        changedFiles.push(docsPaths.changelog);
      }

      const issuesAfter = validateDocsVersionSync({
        packageVersion,
        readmeContent: fixed.readmeContent,
        changelogContent: fixed.changelogContent,
      });

      if (issuesAfter.length === 0) {
        this.outputChannel.appendLine('');
        if (changedFiles.length > 0) {
          this.outputChannel.appendLine(
            `[ReportDoctor] Fixed docs versions: ${changedFiles.join(', ')}`
          );
        } else {
          this.outputChannel.appendLine('[ReportDoctor] Docs versions already in sync.');
        }

        vscode.window.showInformationMessage(
          `Report Doctor: fixed docs version sync (${changedFiles.length} file(s) updated).`
        );
      } else {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(
          `[ReportDoctor] Docs fix still has issues: ${issuesAfter.length}`
        );
        for (const issue of issuesAfter) {
          this.outputChannel.appendLine(
            `  - [${issue.sectionId}] ${issue.code}: ${issue.message}`
          );
        }
        vscode.window.showWarningMessage(
          'Report Doctor: failed to fix docs versions (see output for details).'
        );
      }

      return;
    }

    if (action === 'Open Docs') {
      await this.openReports([docsPaths.readme, docsPaths.changelog, docsPaths.packageJson]);
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
