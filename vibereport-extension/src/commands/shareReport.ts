/**
 * Share Report Command
 *
 * @description 프로젝트 평가 보고서를 외부 공유용 프리뷰 형태로 클립보드에 복사합니다.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { loadConfig, selectWorkspaceRoot, resolveAnalysisRoot } from '../utils/index.js';
import { getPreviewStyle } from '../utils/previewStyle.js';
import { redactForSharing } from '../utils/redactionUtils.js';
import { buildPreviewHtml, buildSharePreviewMarkdown } from './shareReportPreview.js';

export class ShareReportCommand {
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

    const reportDir = path.join(rootPath, config.reportDirectory);

    const analysisRootRel = config.analysisRoot.trim();
    const reportRelativePath = analysisRootRel
      ? path.posix.join(
          analysisRootRel.replace(/\\/g, '/'),
          config.reportDirectory,
          'Project_Evaluation_Report.md'
        )
      : path.posix.join(config.reportDirectory, 'Project_Evaluation_Report.md');

    try {
      // 평가 보고서 읽기
      const evalPath = path.join(reportDir, 'Project_Evaluation_Report.md');
      const evalContent = await fs.readFile(evalPath, 'utf-8');

      // 프리뷰 보고서 생성
      const preview = this.generatePreviewReport(
        evalContent,
        workspaceRoot,
        reportRelativePath
      );

      // 클립보드에 복사
      await vscode.env.clipboard.writeText(preview);

      const action = await vscode.window.showInformationMessage(
        '📋 프리뷰 보고서가 클립보드에 복사되었습니다!',
        '미리보기'
      );

      if (action === '미리보기') {
        this.showPreviewPanel(preview);
      }

      this.log('프리뷰 보고서 생성 및 복사 완료');
    } catch (error) {
      vscode.window.showErrorMessage(
        '보고서를 읽을 수 없습니다. 먼저 Update Reports를 실행해주세요.'
      );
      this.log(`오류: ${error}`);
    }
  }

  /**
   * 평가 보고서에서 프리뷰용 요약 생성
   */
  private generatePreviewReport(
    evalContent: string,
    workspaceRootPath: string,
    reportRelativePath: string
  ): string {
    const config = loadConfig();

    const preview = buildSharePreviewMarkdown({
      evalContent,
      workspaceRootPath,
      reportRelativePath,
      language: config.language,
    });

    const settings = vscode.workspace.getConfiguration('vibereport');
    const redactionEnabled = settings.get<boolean>('sharePreviewRedactionEnabled', true);

    return redactionEnabled ? redactForSharing(preview) : preview;
  }

  /**
   * 미리보기 패널 표시
   */
  private showPreviewPanel(content: string): void {
    const panel = vscode.window.createWebviewPanel(
      'vibeReportPreview',
      '📋 프리뷰 보고서',
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    panel.webview.html = this.getPreviewHtml(content);
  }

  /**
   * 미리보기 HTML 생성
   */
  private getPreviewHtml(markdown: string): string {
    return buildPreviewHtml(markdown, getPreviewStyle(vscode.workspace.getConfiguration('vibereport')));
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[ShareReport] ${message}`);
  }
}
