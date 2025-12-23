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
import { extractScoreTable } from './shareReportPreview.js';

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

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
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
        reportRelativePath
      );
      const preview = redactionEnabled ? redactForSharing(previewRaw) : previewRaw;

      const metadata: ExportMetadata = {
        version: readExtensionVersion(),
        timestamp: now.toISOString(),
        workspaceRoot,
        analysisRoot: config.analysisRoot,
        reportDirectory: config.reportDirectory,
        redactionEnabled,
      };

      await vscode.workspace.fs.createDirectory(vscode.Uri.file(bundleDir));

      await Promise.all([
        writeTextFile(path.join(bundleDir, 'Project_Evaluation_Report.md'), evalContent),
        writeTextFile(
          path.join(bundleDir, 'Project_Improvement_Exploration_Report.md'),
          improvementContent
        ),
        writeTextFile(path.join(bundleDir, 'Prompt.md'), promptContent),
        writeTextFile(path.join(bundleDir, 'Share_Preview.md'), preview),
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
    reportRelativePath: string
  ): string {
    const projectName = path.basename(workspaceRootPath);
    const now = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // TL;DR 섹션 추출
    const tldrMatch = evalContent.match(/<!-- TLDR-START -->([\s\S]*?)<!-- TLDR-END -->/);
    const tldr = tldrMatch ? cleanMarkdownTable(tldrMatch[1]) : '';

    // 종합 점수 테이블 추출
    const scoreMatch = evalContent.match(/<!-- AUTO-SCORE-START -->([\s\S]*?)### 점수-등급 기준표/);
    const scoreTable = scoreMatch ? extractScoreTable(scoreMatch[1]) : '';

    // 버전 추출
    const versionMatch = evalContent.match(/\*\*현재 버전\*\*\s*\|\s*([^\|]+)/);
    const version = versionMatch ? versionMatch[1].trim() : '-';

    // 종합 점수 추출
    const totalScoreMatch = evalContent.match(/\*\*총점 평균\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*([^\|]+)/);
    const totalScore = totalScoreMatch ? totalScoreMatch[1] : '-';
    const totalGrade = totalScoreMatch ? totalScoreMatch[2].trim() : '-';

    return `# 📊 ${projectName} 프로젝트 평가 보고서

> 🗓️ 생성일: ${now}
> 📦 버전: ${version}
> 🏆 종합 점수: **${totalScore}점 (${totalGrade})**

---

## 📝 요약 (TL;DR)

${tldr}

---

## 📊 상세 점수

${scoreTable}

---

## 🔗 상세 정보

이 보고서는 [Vibe Coding Report](https://marketplace.visualstudio.com/items?itemName=stankjedi.vibereport) VS Code 확장으로 자동 생성되었습니다.

전체 보고서는 프로젝트의 \`${reportRelativePath}\` 파일에서 확인 할 수 있습니다.
`;
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

function cleanMarkdownTable(content: string): string {
  return content
    .trim()
    .split('\n')
    .filter(line => line.trim().startsWith('|'))
    .join('\n');
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

