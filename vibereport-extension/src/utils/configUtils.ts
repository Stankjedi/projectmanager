/**
 * Configuration Utilities
 * 
 * @description Centralized configuration loading for Vibe Report extension.
 * This eliminates duplicate loadConfig functions across the codebase.
 */

import * as vscode from 'vscode';
import type { VibeReportConfig, ProjectType, QualityFocus } from '../models/types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Readonly<VibeReportConfig> = {
  reportDirectory: 'devplan',
  snapshotFile: '.vscode/vibereport-state.json',
  enableGitDiff: true,
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/out/**',
    '**/build/**',
    '**/.git/**',
    '**/target/**',
    '**/.next/**',
    '**/__pycache__/**',
    '**/.venv/**',
    '**/coverage/**',
    '**/*.log',
    '**/*.lock',
  ],
  maxFilesToScan: 5000,
  autoOpenReports: true,
  language: 'ko',
  projectVisionMode: 'auto',
  defaultProjectType: 'auto-detect',
  defaultQualityFocus: 'development',
} as const;

/**
 * Load Vibe Report configuration from VS Code workspace settings
 * 
 * @description Retrieves all vibereport.* settings with fallback to defaults
 * @returns Complete VibeReportConfig object
 * 
 * @example
 * const config = loadConfig();
 * console.log(config.reportDirectory); // 'devplan'
 */
export function loadConfig(): VibeReportConfig {
  const config = vscode.workspace.getConfiguration('vibereport');
  
  return {
    reportDirectory: config.get<string>('reportDirectory', DEFAULT_CONFIG.reportDirectory),
    snapshotFile: config.get<string>('snapshotFile', DEFAULT_CONFIG.snapshotFile),
    enableGitDiff: config.get<boolean>('enableGitDiff', DEFAULT_CONFIG.enableGitDiff),
    excludePatterns: config.get<string[]>('excludePatterns', [...DEFAULT_CONFIG.excludePatterns]),
    maxFilesToScan: config.get<number>('maxFilesToScan', DEFAULT_CONFIG.maxFilesToScan),
    autoOpenReports: config.get<boolean>('autoOpenReports', DEFAULT_CONFIG.autoOpenReports),
    language: config.get<'ko' | 'en'>('language', DEFAULT_CONFIG.language),
    projectVisionMode: config.get<'auto' | 'custom'>('projectVisionMode', DEFAULT_CONFIG.projectVisionMode),
    defaultProjectType: config.get<ProjectType | 'auto-detect'>('defaultProjectType', DEFAULT_CONFIG.defaultProjectType),
    defaultQualityFocus: config.get<QualityFocus>('defaultQualityFocus', DEFAULT_CONFIG.defaultQualityFocus),
  };
}

/**
 * Get the root path of the current workspace
 * 
 * @description Returns the first workspace folder's path or null if no workspace is open
 * @returns Absolute path to workspace root or null
 */
export function getRootPath(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }
  return workspaceFolders[0].uri.fsPath;
}

/**
 * Get workspace root path with multi-root support
 * 
 * @description If multiple workspace folders exist, prompts user to select one.
 * For single workspace, returns the path directly.
 * 
 * @returns Selected workspace path or null if cancelled/no workspace
 */
export async function selectWorkspaceRoot(): Promise<string | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
    return null;
  }

  // Single workspace - return directly
  if (workspaceFolders.length === 1) {
    return workspaceFolders[0].uri.fsPath;
  }

  // Multiple workspaces - show picker
  const items = workspaceFolders.map(folder => ({
    label: folder.name,
    description: folder.uri.fsPath,
    folder,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '보고서를 생성할 워크스페이스를 선택하세요',
    title: 'Vibe Report: 워크스페이스 선택',
  });

  if (!selected) {
    return null; // User cancelled
  }

  return selected.folder.uri.fsPath;
}
