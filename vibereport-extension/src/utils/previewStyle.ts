import type * as vscode from 'vscode';
import { resolvePreviewColors, type PreviewBackgroundSetting } from './previewColors.js';

export type PreviewStyle = { bg: string; fg: string; border: string; link: string };

export function getPreviewStyle(config: vscode.WorkspaceConfiguration): PreviewStyle {
  const bgSettingRaw = config.get<string>('previewBackgroundColor', 'ide');

  const bgSetting: PreviewBackgroundSetting =
    bgSettingRaw === 'white' || bgSettingRaw === 'black' || bgSettingRaw === 'ide'
      ? bgSettingRaw
      : 'ide';

  if (bgSetting === 'ide') {
    return {
      bg: 'var(--vscode-editor-background)',
      fg: 'var(--vscode-foreground)',
      border: 'var(--vscode-panel-border)',
      link: 'var(--vscode-textLink-foreground)',
    };
  }

  const colors = resolvePreviewColors(bgSetting);

  if (!colors) {
    return {
      bg: 'var(--vscode-editor-background)',
      fg: 'var(--vscode-foreground)',
      border: 'var(--vscode-panel-border)',
      link: 'var(--vscode-textLink-foreground)',
    };
  }

  return {
    bg: colors.bg,
    fg: colors.fg,
    border: colors.border,
    link: bgSetting === 'white' ? '#0066cc' : '#4fc3f7',
  };
}

