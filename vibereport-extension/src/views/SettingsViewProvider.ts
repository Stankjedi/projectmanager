/**
 * Settings View Provider
 * 
 * @description Vibe Report 확장 설정을 위한 Webview UI를 제공합니다.
 * 사용자가 settings.json을 직접 수정하지 않고도 UI에서 설정을 변경할 수 있습니다.
 */

import * as vscode from 'vscode';
import { DEFAULT_CONFIG } from '../utils/configUtils.js';
import { validateWorkspaceRelativeSubpathInput } from '../utils/workspaceSubpathUtils.js';
import { buildSettingsHtml } from './settingsViewHtml.js';

type SettingsKey =
  | 'reportDirectory'
  | 'analysisRoot'
  | 'snapshotFile'
  | 'enableGitDiff'
  | 'excludePatterns'
  | 'maxFilesToScan'
  | 'autoOpenReports'
  | 'enableDirectAi'
  | 'language'
  | 'projectVisionMode'
  | 'defaultProjectType'
  | 'defaultQualityFocus'
  | 'enableAutoUpdateReports'
  | 'autoUpdateDebounceMs'
  | 'antigravityAutoAcceptEnabled'
  | 'previewEnabled'
  | 'preferredMarkdownViewer'
  | 'previewBackgroundColor'
  | 'reportOpenMode';

const SETTINGS_KEYS: ReadonlySet<SettingsKey> = new Set<SettingsKey>([
  'reportDirectory',
  'analysisRoot',
  'snapshotFile',
  'enableGitDiff',
  'excludePatterns',
  'maxFilesToScan',
  'autoOpenReports',
  'enableDirectAi',
  'language',
  'projectVisionMode',
  'defaultProjectType',
  'defaultQualityFocus',
  'previewEnabled',
  'preferredMarkdownViewer',
  'previewBackgroundColor',
  'reportOpenMode',
  'enableAutoUpdateReports',
  'autoUpdateDebounceMs',
  'antigravityAutoAcceptEnabled',
]);

function isSettingsKey(key: string): key is SettingsKey {
  return SETTINGS_KEYS.has(key as SettingsKey);
}

function isDeepEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return Object.is(left, right);
  }
}

async function updateSettingIfChanged(
  config: vscode.WorkspaceConfiguration,
  key: string,
  defaultFactory: () => unknown,
  newValue: unknown,
  target: vscode.ConfigurationTarget
): Promise<boolean> {
  const currentValue = config.get(key, defaultFactory());
  if (isDeepEqual(currentValue, newValue)) {
    return false;
  }

  await config.update(key, newValue, target);
  return true;
}

const SETTINGS_DEFAULT_FACTORIES: Record<SettingsKey, () => unknown> = {
  reportDirectory: () => DEFAULT_CONFIG.reportDirectory,
  analysisRoot: () => DEFAULT_CONFIG.analysisRoot,
  snapshotFile: () => DEFAULT_CONFIG.snapshotFile,
  enableGitDiff: () => DEFAULT_CONFIG.enableGitDiff,
  excludePatterns: () => [...DEFAULT_CONFIG.excludePatterns],
  maxFilesToScan: () => DEFAULT_CONFIG.maxFilesToScan,
  autoOpenReports: () => DEFAULT_CONFIG.autoOpenReports,
  enableDirectAi: () => DEFAULT_CONFIG.enableDirectAi,
  language: () => DEFAULT_CONFIG.language,
  projectVisionMode: () => DEFAULT_CONFIG.projectVisionMode,
  defaultProjectType: () => DEFAULT_CONFIG.defaultProjectType,
  defaultQualityFocus: () => DEFAULT_CONFIG.defaultQualityFocus,
  enableAutoUpdateReports: () => false,
  autoUpdateDebounceMs: () => 1500,
  antigravityAutoAcceptEnabled: () => false,
  previewEnabled: () => true,
  preferredMarkdownViewer: () => 'mermaid',
  previewBackgroundColor: () => 'ide',
  reportOpenMode: () => 'previewOnly',
};

function resolveConfigurationKey(key: SettingsKey): { section: string | null; key: string } {
  if (key === 'antigravityAutoAcceptEnabled') {
    return { section: null, key: 'antigravity-auto-accept.enabled' };
  }

  return { section: 'vibereport', key };
}

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function validateSettingValue(key: SettingsKey, value: unknown): ValidationResult<unknown> {
  const trimmedString = (input: unknown): ValidationResult<string> => {
    if (typeof input !== 'string') {
      return { ok: false, error: '문자열 값이 필요합니다.' };
    }

    return { ok: true, value: input.trim() };
  };

  const booleanValue = (input: unknown): ValidationResult<boolean> => {
    if (typeof input !== 'boolean') {
      return { ok: false, error: '불리언 값이 필요합니다.' };
    }

    return { ok: true, value: input };
  };

  const enumValue = <T extends string>(
    input: unknown,
    allowed: readonly T[],
    label: string
  ): ValidationResult<T> => {
    if (typeof input !== 'string') {
      return { ok: false, error: `${label} 값이 필요합니다.` };
    }

    if (!allowed.includes(input as T)) {
      return { ok: false, error: `${label} 값이 올바르지 않습니다.` };
    }

    return { ok: true, value: input as T };
  };

  switch (key) {
    case 'reportDirectory': {
      const res = trimmedString(value);
      if (!res.ok) return res;
      const nextValue = res.value || DEFAULT_CONFIG.reportDirectory;
      const validation = validateWorkspaceRelativeSubpathInput(nextValue);
      if (!validation.ok) {
        return { ok: false, error: '절대 경로 및 ".."(상위 경로) 사용은 허용되지 않습니다.' };
      }
      return { ok: true, value: nextValue };
    }
    case 'analysisRoot': {
      const res = trimmedString(value);
      if (!res.ok) return res;
      // Empty means workspace root.
      return { ok: true, value: res.value };
    }
    case 'snapshotFile': {
      const res = trimmedString(value);
      if (!res.ok) return res;
      const nextValue = res.value || DEFAULT_CONFIG.snapshotFile;
      const validation = validateWorkspaceRelativeSubpathInput(nextValue);
      if (!validation.ok) {
        return { ok: false, error: '절대 경로 및 ".."(상위 경로) 사용은 허용되지 않습니다.' };
      }
      return { ok: true, value: nextValue };
    }
    case 'antigravityAutoAcceptEnabled': {
      return booleanValue(value);
    }
    case 'enableGitDiff':
    case 'autoOpenReports':
    case 'enableDirectAi': {
      return booleanValue(value);
    }
    case 'previewEnabled':
    case 'enableAutoUpdateReports': {
      return booleanValue(value);
    }
    case 'excludePatterns': {
      let patterns: string[];
      if (Array.isArray(value)) {
        patterns = value.filter((v): v is string => typeof v === 'string');
      } else if (typeof value === 'string') {
        patterns = value.split('\n');
      } else {
        return { ok: false, error: 'excludePatterns는 문자열 배열이어야 합니다.' };
      }

      const normalized: string[] = [];
      const seen = new Set<string>();
      for (const raw of patterns) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        if (seen.has(trimmed)) continue;
        seen.add(trimmed);
        normalized.push(trimmed);
      }

      return { ok: true, value: normalized };
    }
    case 'maxFilesToScan': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, error: 'maxFilesToScan은 숫자여야 합니다.' };
      }

      const intValue = Math.trunc(value);
      const clamped = Math.max(100, Math.min(50000, intValue));
      return { ok: true, value: clamped };
    }
    case 'autoUpdateDebounceMs': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, error: 'autoUpdateDebounceMs는 숫자여야 합니다.' };
      }

      const intValue = Math.trunc(value);
      const clamped = Math.max(0, Math.min(60000, intValue));
      return { ok: true, value: clamped };
    }
    case 'language': {
      return enumValue(value, ['ko', 'en'] as const, '언어');
    }
    case 'projectVisionMode': {
      return enumValue(value, ['auto', 'custom'] as const, '비전 모드');
    }
    case 'defaultProjectType': {
      return enumValue(
        value,
        [
          'auto-detect',
          'vscode-extension',
          'web-frontend',
          'web-backend',
          'fullstack',
          'cli-tool',
          'library',
          'desktop-app',
          'mobile-app',
          'api-server',
          'monorepo',
          'other',
        ] as const,
        '프로젝트 유형'
      );
    }
    case 'defaultQualityFocus': {
      return enumValue(
        value,
        ['prototype', 'development', 'stabilization', 'production', 'maintenance'] as const,
        '개발 단계'
      );
    }
    case 'preferredMarkdownViewer': {
      return enumValue(value, ['mermaid', 'standard'] as const, '기본 미리보기 뷰어');
    }
    case 'previewBackgroundColor': {
      return enumValue(value, ['ide', 'white', 'black'] as const, '프리뷰 배경색');
    }
    case 'reportOpenMode': {
      return enumValue(value, ['previewOnly', 'both', 'editorOnly'] as const, '보고서 열기 모드');
    }
  }
}

/**
 * 설정 뷰 프로바이더
 * 
 * @description VS Code 사이드바에 설정 패널을 렌더링하는 WebviewViewProvider입니다.
 */
export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibereport.settings';

  private _view?: vscode.WebviewView;
  private extensionUri: vscode.Uri;
  private outputChannel: vscode.OutputChannel;

  constructor(extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel) {
    this.extensionUri = extensionUri;
    this.outputChannel = outputChannel;
  }

  /**
   * 고유 nonce 생성 (CSP용)
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Webview 뷰 초기화
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // 메시지 핸들러 등록
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'updateSettings':
          await this.updateSettings(message.settings);
          break;
        case 'getSetting':
          await this.sendCurrentSettings();
          break;
        case 'resetToDefaults':
          await this.resetToDefaults();
          break;
        case 'openSetVision':
          await vscode.commands.executeCommand('vibereport.setProjectVision');
          break;
      }
    });

    this.updateContent();
  }

  /**
   * 설정값 배치 업데이트
   *
   * 정책: all-or-nothing (유효성 검증에 실패하면 아무 것도 반영하지 않음)
   */
  private async updateSettings(settings: unknown): Promise<void> {
    try {
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        const message = '설정 업데이트 실패: settings는 객체여야 합니다.';
        this.log(message);
        vscode.window.showErrorMessage(message);
        return;
      }

      const payload = settings as Record<string, unknown>;

      const unknownKeys = Object.keys(payload).filter((key) => !isSettingsKey(key));
      if (unknownKeys.length > 0) {
        const message = `허용되지 않은 설정 키가 포함되어 있습니다: ${unknownKeys.join(', ')}`;
        this.log(message);
        vscode.window.showErrorMessage(message);
        return;
      }

      const validated = new Map<SettingsKey, unknown>();
      for (const key of SETTINGS_KEYS) {
        if (!(key in payload)) continue;
        const res = validateSettingValue(key, payload[key]);
        if (!res.ok) {
          const message = `설정 값이 올바르지 않습니다 (${key}): ${res.error}`;
          this.log(`${message} (value=${JSON.stringify(payload[key])})`);
          vscode.window.showErrorMessage(message);
          return;
        }
        validated.set(key, res.value);
      }

      let updatedCount = 0;
      for (const key of SETTINGS_KEYS) {
        if (!validated.has(key)) continue;
        const value = validated.get(key);

        const resolved = resolveConfigurationKey(key);
        const settingConfig = resolved.section
          ? vscode.workspace.getConfiguration(resolved.section)
          : vscode.workspace.getConfiguration();
        const wasUpdated = await updateSettingIfChanged(
          settingConfig,
          resolved.key,
          SETTINGS_DEFAULT_FACTORIES[key],
          value,
          vscode.ConfigurationTarget.Workspace
        );

        if (wasUpdated) {
          updatedCount += 1;
          this.log(`설정 배치 업데이트: ${key} = ${JSON.stringify(value)}`);
        }
      }

      if (updatedCount === 0) {
        this.log('설정 배치 업데이트: 변경 사항 없음 (config.update 생략)');
        vscode.window.showInformationMessage('변경된 설정이 없습니다.');
      } else {
        vscode.window.showInformationMessage(`설정 ${updatedCount}개가 업데이트되었습니다.`);
      }
      await this.sendCurrentSettings();
    } catch (error) {
      this.log(`설정 배치 업데이트 실패: ${error}`);
      vscode.window.showErrorMessage(`설정 저장 실패: ${error}`);
    }
  }

  /**
   * 설정값 업데이트
   */
  /**
   * 현재 설정값을 웹뷰에 전송
   */
  private async sendCurrentSettings(): Promise<void> {
    if (!this._view) return;

    const config = vscode.workspace.getConfiguration('vibereport');       
    const rootConfig = vscode.workspace.getConfiguration();
    const settings = {
      reportDirectory: config.get<string>('reportDirectory', DEFAULT_CONFIG.reportDirectory),
      analysisRoot: config.get<string>('analysisRoot', DEFAULT_CONFIG.analysisRoot),
      snapshotFile: config.get<string>('snapshotFile', DEFAULT_CONFIG.snapshotFile),
      enableGitDiff: config.get<boolean>('enableGitDiff', DEFAULT_CONFIG.enableGitDiff),
      excludePatterns: config.get<string[]>('excludePatterns', [...DEFAULT_CONFIG.excludePatterns]),
      maxFilesToScan: config.get<number>('maxFilesToScan', DEFAULT_CONFIG.maxFilesToScan),
      autoOpenReports: config.get<boolean>('autoOpenReports', DEFAULT_CONFIG.autoOpenReports),
      enableDirectAi: config.get<boolean>('enableDirectAi', DEFAULT_CONFIG.enableDirectAi),
      language: config.get<'ko' | 'en'>('language', DEFAULT_CONFIG.language),
      projectVisionMode: config.get<'auto' | 'custom'>('projectVisionMode', DEFAULT_CONFIG.projectVisionMode),
      defaultProjectType: config.get<string>('defaultProjectType', DEFAULT_CONFIG.defaultProjectType),
      defaultQualityFocus: config.get<string>('defaultQualityFocus', DEFAULT_CONFIG.defaultQualityFocus),
      previewEnabled: config.get<boolean>('previewEnabled', true),
      preferredMarkdownViewer: config.get<'mermaid' | 'standard'>('preferredMarkdownViewer', 'mermaid'),
      previewBackgroundColor: config.get<string>('previewBackgroundColor', 'ide'),
      reportOpenMode: config.get<string>('reportOpenMode', 'previewOnly'),
      enableAutoUpdateReports: config.get<boolean>('enableAutoUpdateReports', false),
      autoUpdateDebounceMs: config.get<number>('autoUpdateDebounceMs', 1500),
      antigravityAutoAcceptEnabled: rootConfig.get<boolean>(
        'antigravity-auto-accept.enabled',
        false
      ),
    };

    await this._view.webview.postMessage({
      command: 'settingsLoaded',
      settings,
    });
  }

  /**
   * 설정을 기본값으로 초기화
   */
  private async resetToDefaults(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vibereport');       
    const rootConfig = vscode.workspace.getConfiguration();

    const defaults = {
      reportDirectory: DEFAULT_CONFIG.reportDirectory,
      analysisRoot: DEFAULT_CONFIG.analysisRoot,
      snapshotFile: DEFAULT_CONFIG.snapshotFile,
      enableGitDiff: DEFAULT_CONFIG.enableGitDiff,
      excludePatterns: [...DEFAULT_CONFIG.excludePatterns],
      maxFilesToScan: DEFAULT_CONFIG.maxFilesToScan,
      autoOpenReports: DEFAULT_CONFIG.autoOpenReports,
      enableDirectAi: DEFAULT_CONFIG.enableDirectAi,
      language: DEFAULT_CONFIG.language,
      projectVisionMode: DEFAULT_CONFIG.projectVisionMode,
      defaultProjectType: DEFAULT_CONFIG.defaultProjectType,
      defaultQualityFocus: DEFAULT_CONFIG.defaultQualityFocus,
      previewEnabled: true,
      preferredMarkdownViewer: 'mermaid',
      previewBackgroundColor: 'ide',
      reportOpenMode: 'previewOnly',
      enableAutoUpdateReports: false,
      autoUpdateDebounceMs: 1500,
      antigravityAutoAcceptEnabled: false,
    };

    const entries = Object.entries(defaults) as Array<[SettingsKey, unknown]>;
    let updatedCount = 0;
    for (const [key, value] of entries) {
      const resolved = resolveConfigurationKey(key);
      const settingConfig = resolved.section ? config : rootConfig;
      const wasUpdated = await updateSettingIfChanged(
        settingConfig,
        resolved.key,
        SETTINGS_DEFAULT_FACTORIES[key],
        value,
        vscode.ConfigurationTarget.Workspace
      );
      if (wasUpdated) {
        updatedCount += 1;
      }
    }

    if (updatedCount === 0) {
      vscode.window.showInformationMessage('변경된 설정이 없습니다.');
    } else {
      vscode.window.showInformationMessage('설정이 기본값으로 초기화되었습니다.');
    }
    await this.sendCurrentSettings();
  }

  /**
   * 뷰 새로고침
   */
  public async refresh(): Promise<void> {
    await this.updateContent();
  }

  /**
   * 웹뷰 콘텐츠 업데이트
   */
  private async updateContent(): Promise<void> {
    if (!this._view) return;
    this._view.webview.html = this.getHtmlContent();
  }

  /**
   * HTML 콘텐츠 생성
   */
  private getHtmlContent(): string {
    const nonce = this.getNonce();
    const cspSource = this._view?.webview.cspSource || '';

    return buildSettingsHtml({ nonce, cspSource });
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[SettingsView] ${message}`);
  }
}
