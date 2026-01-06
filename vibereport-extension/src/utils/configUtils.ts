/**
 * Configuration Utilities
 * 
 * @description Centralized configuration loading for Vibe Report extension.
 * This eliminates duplicate loadConfig functions across the codebase.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { VibeReportConfig, ProjectType, QualityFocus } from '../models/types.js';
import { resolveAnalysisRootPortable } from './analysisRootUtils.js';
import { normalizeExcludePatterns } from './excludePatternUtils.js';
import { validateWorkspaceRelativeSubpathInput } from './workspaceSubpathUtils.js';

// Cache last selected workspace root for multi-root UX.
let lastSelectedWorkspaceRoot: string | null = null;
const warnedInvalidSubpathSettings = new Set<'reportDirectory' | 'snapshotFile'>();

/**
 * Get last selected workspace root (in-memory for current session)
 */
export function getLastSelectedWorkspaceRoot(): string | null {
  return lastSelectedWorkspaceRoot;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Readonly<VibeReportConfig> = {
  reportDirectory: 'devplan',
  analysisRoot: '',
  snapshotFile: '.vscode/vibereport-state.json',
  snapshotStorageMode: 'workspaceFile',
  enableGitDiff: true,
  respectGitignore: true,
  includeSensitiveFiles: false,
  excludePatternsIncludeDefaults: true,
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
    '**/temp_compare/**',
    '**/*.log',
    '**/*.lock',
    '**/*.vsix',
  ],
  maxFilesToScan: 5000,
  autoOpenReports: true,
  enableDirectAi: false,
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

  const sanitizeWorkspaceSubpathSetting = (
    key: 'reportDirectory' | 'snapshotFile',
    value: string,
    fallback: string
  ): string => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const candidate = trimmed || fallback;
    const validation = validateWorkspaceRelativeSubpathInput(candidate);

    if (validation.ok) {
      return candidate;
    }

    if (!warnedInvalidSubpathSettings.has(key)) {
      warnedInvalidSubpathSettings.add(key);
      vscode.window.showErrorMessage(
        `보안 정책: vibereport.${key} 설정이 유효하지 않습니다 (절대 경로 및 \"..\" 금지). 기본값(\"${fallback}\")으로 대체합니다.`
      );
    }

    return fallback;
  };

  const excludePatternsIncludeDefaults = config.get<boolean>(
    'excludePatternsIncludeDefaults',
    DEFAULT_CONFIG.excludePatternsIncludeDefaults
  );
  const userExcludePatterns = config.get<string[]>('excludePatterns', [...DEFAULT_CONFIG.excludePatterns]);
  const excludePatterns = excludePatternsIncludeDefaults
    ? normalizeExcludePatterns([...DEFAULT_CONFIG.excludePatterns, ...userExcludePatterns])
    : normalizeExcludePatterns(userExcludePatterns);

  const reportDirectory = sanitizeWorkspaceSubpathSetting(
    'reportDirectory',
    config.get<string>('reportDirectory', DEFAULT_CONFIG.reportDirectory),
    DEFAULT_CONFIG.reportDirectory
  );
  const snapshotFile = sanitizeWorkspaceSubpathSetting(
    'snapshotFile',
    config.get<string>('snapshotFile', DEFAULT_CONFIG.snapshotFile),
    DEFAULT_CONFIG.snapshotFile
  );
  
  return {
    reportDirectory,
    analysisRoot: config.get<string>('analysisRoot', DEFAULT_CONFIG.analysisRoot),
    snapshotFile,
    snapshotStorageMode: config.get<'workspaceFile' | 'vscodeStorage'>('snapshotStorageMode', DEFAULT_CONFIG.snapshotStorageMode),
    enableGitDiff: config.get<boolean>('enableGitDiff', DEFAULT_CONFIG.enableGitDiff),
    respectGitignore: config.get<boolean>('respectGitignore', DEFAULT_CONFIG.respectGitignore),
    includeSensitiveFiles: config.get<boolean>('includeSensitiveFiles', DEFAULT_CONFIG.includeSensitiveFiles),
    excludePatternsIncludeDefaults,
    excludePatterns,
    maxFilesToScan: config.get<number>('maxFilesToScan', DEFAULT_CONFIG.maxFilesToScan),
    autoOpenReports: config.get<boolean>('autoOpenReports', DEFAULT_CONFIG.autoOpenReports),
    enableDirectAi: config.get<boolean>('enableDirectAi', DEFAULT_CONFIG.enableDirectAi),
    language: config.get<'ko' | 'en'>('language', DEFAULT_CONFIG.language),
    projectVisionMode: config.get<'auto' | 'custom'>('projectVisionMode', DEFAULT_CONFIG.projectVisionMode),
    defaultProjectType: config.get<ProjectType | 'auto-detect'>('defaultProjectType', DEFAULT_CONFIG.defaultProjectType),
    defaultQualityFocus: config.get<QualityFocus>('defaultQualityFocus', DEFAULT_CONFIG.defaultQualityFocus),
  };
}

export function resolveAnalysisRoot(workspaceRoot: string, analysisRoot: string): string {
  return resolveAnalysisRootPortable(workspaceRoot, analysisRoot, path);
}

export { resolveAnalysisRootPortable };

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
    lastSelectedWorkspaceRoot = workspaceFolders[0].uri.fsPath;
    return lastSelectedWorkspaceRoot;
  }

  // Multiple workspaces - show picker
  const items = workspaceFolders.map(folder => ({
    label: folder.name,
    description: folder.uri.fsPath,
    folder,
    picked: folder.uri.fsPath === lastSelectedWorkspaceRoot,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '보고서를 생성할 워크스페이스를 선택하세요',
    title: 'Vibe Report: 워크스페이스 선택',
  });

  if (!selected) {
    return null; // User cancelled
  }

  lastSelectedWorkspaceRoot = selected.folder.uri.fsPath;
  return lastSelectedWorkspaceRoot;
}
