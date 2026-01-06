/**
 * Export Report Bundle Command
 *
 * @description Exports the latest reports (evaluation, improvement, Prompt.md) and a redacted share preview
 * into a single timestamped folder for sharing and archiving.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { loadConfig, selectWorkspaceRoot, resolveAnalysisRoot } from '../utils/index.js';
import { redactForSharing } from '../utils/redactionUtils.js';
import { buildSharePreviewMarkdown } from './shareReportPreview.js';
import { SnapshotService } from '../services/snapshotService.js';

type ExportMetadata = {
  version: string;
  timestamp: string;
  workspaceRoot: string;
  analysisRoot: string;
  reportDirectory: string;
  redactionEnabled: boolean;
};

export class ExportReportBundleCommand {
  private outputChannel: vscode.OutputChannel;
  private storageRoot: string;

  constructor(outputChannel: vscode.OutputChannel, storageRoot: string) {
    this.outputChannel = outputChannel;
    this.storageRoot = storageRoot;
  }

  async execute(): Promise<void> {
    const workspaceRoot = await selectWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    const config = loadConfig();

    let rootPath = workspaceRoot;
    try {
      rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
    } catch (error) {
      vscode.window.showErrorMessage(
        'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
      );
      this.log(`analysisRoot invalid: ${String(error)}`);
      return;
    }

    const outputDirUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Export',
      title: 'Select an output folder for the report bundle',
    });
    if (!outputDirUris || outputDirUris.length === 0) {
      this.log('Export cancelled (no output folder selected)');
      return;
    }

    const outputRoot = outputDirUris[0]?.fsPath;
    if (!outputRoot) {
      this.log('Export cancelled (invalid output folder)');
      return;
    }

    const now = new Date();
    const bundleFolderName = `vibereport-bundle-${formatBundleTimestamp(now)}`;
    const bundleDir = path.join(outputRoot, bundleFolderName);

    const reportDir = path.join(rootPath, config.reportDirectory);
    const evalPath = path.join(reportDir, 'Project_Evaluation_Report.md');
    const improvementPath = path.join(reportDir, 'Project_Improvement_Exploration_Report.md');
    const promptPath = path.join(reportDir, 'Prompt.md');

    try {
      const snapshotService = new SnapshotService(this.outputChannel, this.storageRoot);
      const state = await snapshotService.loadState(rootPath, config);
      const evaluationHistory = (state?.evaluationHistory ?? []).slice(-5).map(entry => ({
        version: entry.version,
        evaluatedAt: entry.evaluatedAt,
        totalScore: entry.totalScore,
        grade: entry.grade,
        ...(entry.scoresByCategory ? { scoresByCategory: entry.scoresByCategory } : {}),
      }));

      const [evalContent, improvementContent, promptContent] = await Promise.all([
        fs.readFile(evalPath, 'utf-8'),
        fs.readFile(improvementPath, 'utf-8'),
        fs.readFile(promptPath, 'utf-8'),
      ]);

      const analysisRootRel = config.analysisRoot.trim();
      const reportRelativePath = analysisRootRel
        ? path.posix.join(
            analysisRootRel.replace(/\\/g, '/'),
            config.reportDirectory,
            'Project_Evaluation_Report.md'
          )
        : path.posix.join(config.reportDirectory, 'Project_Evaluation_Report.md');

      const settings = vscode.workspace.getConfiguration('vibereport');
      const redactionEnabled = settings.get<boolean>('sharePreviewRedactionEnabled', true);

      const previewRaw = this.generateSharePreviewMarkdown(
        evalContent,
        workspaceRoot,
        reportRelativePath,
        config.language
      );
      const preview = redactionEnabled ? redactForSharing(previewRaw) : previewRaw;

      const evalOut = redactionEnabled ? redactForSharing(evalContent) : evalContent;
      const improvementOut = redactionEnabled ? redactForSharing(improvementContent) : improvementContent;
      const promptOut = redactionEnabled ? redactForSharing(promptContent) : promptContent;

      const workspaceRootForMetadata = redactionEnabled ? path.basename(workspaceRoot) : workspaceRoot;

      const metadata: ExportMetadata = {
        version: readExtensionVersion(),
        timestamp: now.toISOString(),
        workspaceRoot: workspaceRootForMetadata || 'workspace',
        analysisRoot: config.analysisRoot,
        reportDirectory: config.reportDirectory,
        redactionEnabled,
      };

      await vscode.workspace.fs.createDirectory(vscode.Uri.file(bundleDir));

      await Promise.all([
        writeTextFile(path.join(bundleDir, 'Project_Evaluation_Report.md'), evalOut),
        writeTextFile(
          path.join(bundleDir, 'Project_Improvement_Exploration_Report.md'),
          improvementOut
        ),
        writeTextFile(path.join(bundleDir, 'Prompt.md'), promptOut),
        writeTextFile(path.join(bundleDir, 'Share_Preview.md'), preview),
        writeTextFile(
          path.join(bundleDir, 'evaluation-history.json'),
          JSON.stringify(evaluationHistory, null, 2)
        ),
        writeTextFile(path.join(bundleDir, 'metadata.json'), JSON.stringify(metadata, null, 2)),
      ]);

      vscode.window.showInformationMessage(`✅ Report bundle exported: ${bundleDir}`);
      this.log(`Report bundle exported: ${bundleDir}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        '보고서 번들을 내보낼 수 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
      this.log(`Export failed: ${String(error)}`);
    }
  }

  private generateSharePreviewMarkdown(
    evalContent: string,
    workspaceRootPath: string,
    reportRelativePath: string,
    language: 'ko' | 'en' | undefined
  ): string {
    return buildSharePreviewMarkdown({
      evalContent,
      workspaceRootPath,
      reportRelativePath,
      language,
    });
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[ExportReportBundle] ${message}`);
  }
}

function readExtensionVersion(): string {
  try {
    return (require('../../package.json') as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatBundleTimestamp(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
}
