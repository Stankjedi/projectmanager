/**
 * Preview Style Service
 * 마크다운 미리보기 스타일 동적 관리
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { resolvePreviewColors, type PreviewBackgroundSetting } from '../utils/previewColors.js';

export class PreviewStyleService {
  private outputChannel: vscode.OutputChannel;
  private extensionPath: string;

  constructor(outputChannel: vscode.OutputChannel, extensionPath: string) {
    this.outputChannel = outputChannel;
    this.extensionPath = extensionPath;
  }

  /**
   * 사용자 설정에 따라 CSS 변수를 업데이트
   */
  async updatePreviewStyles(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vibereport');
    const backgroundColor = config.get<string>('previewBackgroundColor', '');
    const previewEnabled = config.get<boolean>('previewEnabled', true);

    if (!previewEnabled) {
      this.log('Preview styles disabled');
      return;
    }

    const cssPath = path.join(this.extensionPath, 'media', 'report-preview.css');
    
    try {
      let cssContent = await fs.readFile(cssPath, 'utf-8');
      
      // CSS 변수 섹션 업데이트 또는 추가
      const customVarsSection = this.generateCustomVarsSection(backgroundColor);
      
      // 기존 커스텀 변수 섹션 제거
      cssContent = cssContent.replace(
        /\/\* ===== CUSTOM VARIABLES START =====[\s\S]*?===== CUSTOM VARIABLES END ===== \*\//g,
        ''
      );
      
      // 새 커스텀 변수 섹션 추가 (파일 맨 앞에)
      if (customVarsSection) {
        cssContent = customVarsSection + '\n' + cssContent.trim();
        await fs.writeFile(cssPath, cssContent, 'utf-8');
        this.log(`Preview styles updated with background: ${backgroundColor || 'default'}`);
      }
    } catch (error) {
      this.log(`Failed to update preview styles: ${error}`);
    }
  }

  /**
   * 커스텀 CSS 변수 섹션 생성
   */
  private generateCustomVarsSection(backgroundSetting: string): string {        
    const setting: PreviewBackgroundSetting =
      backgroundSetting === 'white' || backgroundSetting === 'black' || backgroundSetting === 'ide'
        ? backgroundSetting
        : 'ide';

    const colors = resolvePreviewColors(setting);

    if (!colors) {
      // ide 모드: 커스텀 변수 없이 기본 CSS 변수 사용
      return '';
    }

    return `/* ===== CUSTOM VARIABLES START ===== */
:root {
  --vibe-preview-background: ${colors.bg};
  --vibe-preview-foreground: ${colors.fg};
  --vibe-preview-card-background: ${colors.cardBg};
  --vibe-preview-border: ${colors.border};
}
/* ===== CUSTOM VARIABLES END ===== */
`;
  }

  /**
   * 설정 변경 감지 및 스타일 업데이트
   */
  registerConfigChangeListener(): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration('vibereport.previewBackgroundColor') ||
        e.affectsConfiguration('vibereport.previewEnabled')
      ) {
        await this.updatePreviewStyles();
        
        // 미리보기 새로고침 안내
        const action = await vscode.window.showInformationMessage(
          '미리보기 스타일이 변경되었습니다. 마크다운 미리보기를 새로고침하세요.',
          '새로고침'
        );
        
        if (action === '새로고침') {
          await vscode.commands.executeCommand('markdown.preview.refresh');
        }
      }
    });
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[PreviewStyleService] ${message}`);
  }
}
