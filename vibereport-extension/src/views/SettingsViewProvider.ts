/**
 * Settings View Provider
 * 
 * @description Vibe Report 확장 설정을 위한 Webview UI를 제공합니다.
 * 사용자가 settings.json을 직접 수정하지 않고도 UI에서 설정을 변경할 수 있습니다.
 */

import * as vscode from 'vscode';
import { DEFAULT_CONFIG } from '../utils/configUtils.js';

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
  key: SettingsKey,
  newValue: unknown,
  target: vscode.ConfigurationTarget
): Promise<boolean> {
  const currentValue = config.get(key, SETTINGS_DEFAULT_FACTORIES[key]());
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
  previewEnabled: () => true,
  preferredMarkdownViewer: () => 'mermaid',
  previewBackgroundColor: () => 'ide',
  reportOpenMode: () => 'previewOnly',
};

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
      return { ok: true, value: res.value || DEFAULT_CONFIG.reportDirectory };
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
      return { ok: true, value: res.value || DEFAULT_CONFIG.snapshotFile };
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

      const config = vscode.workspace.getConfiguration('vibereport');

      let updatedCount = 0;
      for (const key of SETTINGS_KEYS) {
        if (!validated.has(key)) continue;
        const value = validated.get(key);

        const wasUpdated = await updateSettingIfChanged(
          config,
          key,
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
    };

    const entries = Object.entries(defaults) as Array<[SettingsKey, unknown]>;
    let updatedCount = 0;
    for (const [key, value] of entries) {
      const wasUpdated = await updateSettingIfChanged(
        config,
        key,
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

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Vibe Report Settings</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      padding: 12px;
      margin: 0;
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
    }
    .header {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .setting-group {
      margin-bottom: 16px;
    }
    .setting-label {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--vscode-foreground);
    }
    .setting-description {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }
    .setting-input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: 12px;
      box-sizing: border-box;
    }
    .setting-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .setting-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .setting-checkbox input {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
    .setting-select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border-radius: 4px;
      font-size: 12px;
    }
    .setting-textarea {
      width: 100%;
      min-height: 80px;
      padding: 6px 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family);
      resize: vertical;
      box-sizing: border-box;
    }
    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-top: 8px;
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .actions {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin: 16px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .number-input {
      width: 100px;
    }
  </style>
</head>
<body>
  <div class="header">
    ⚙️ <span>설정</span>
  </div>

  <!-- 기본 설정 -->
  <div class="section-title">📁 파일 설정</div>

  <div class="setting-group">
    <div class="setting-label">보고서 디렉토리</div>
    <div class="setting-description">보고서 파일이 저장될 폴더 경로</div>
    <input type="text" class="setting-input" id="reportDirectory" value="devplan">
  </div>

  <div class="setting-group">
    <div class="setting-label">상태 파일 경로</div>
    <div class="setting-description">스냅샷 및 세션 상태를 저장할 파일 경로</div>
    <input type="text" class="setting-input" id="snapshotFile" value=".vscode/vibereport-state.json">
  </div>

  <div class="setting-group">
    <div class="setting-label">분석 루트 (analysisRoot)</div>
    <div class="setting-description">모노레포/서브폴더 분석 시 워크스페이스 루트 기준 상대 경로 (비워두면 전체)</div>
    <input type="text" class="setting-input" id="analysisRoot" value="">
  </div>

  <!-- 스캔 설정 -->
  <div class="section-title">🔍 스캔 설정</div>

  <div class="setting-group">
    <div class="setting-label">최대 스캔 파일 수</div>
    <div class="setting-description">스캔할 최대 파일 개수 (성능 조절용)</div>
    <input type="number" class="setting-input number-input" id="maxFilesToScan" value="5000" min="100" max="50000">
  </div>

  <div class="setting-group">
    <div class="setting-label">제외 패턴</div>
    <div class="setting-description">스캔에서 제외할 glob 패턴 (한 줄에 하나씩)</div>
    <textarea class="setting-textarea" id="excludePatterns">**/node_modules/**
**/dist/**
**/out/**
**/build/**
**/.git/**
**/target/**
**/.next/**
**/__pycache__/**
**/.venv/**
**/coverage/**
**/*.log
**/*.lock
**/*.vsix</textarea>
  </div>

  <!-- 동작 설정 -->
  <div class="section-title">🎯 동작 설정</div>

  <div class="setting-group">
    <label class="setting-checkbox">
      <input type="checkbox" id="enableGitDiff" checked>
      <span>Git 변경사항 추적 활성화</span>
    </label>
    <div class="setting-description">Git diff를 사용하여 변경사항을 추적합니다</div>
  </div>

  <div class="setting-group">
    <label class="setting-checkbox">
      <input type="checkbox" id="autoOpenReports" checked>
      <span>보고서 자동 열기</span>
    </label>
    <div class="setting-description">업데이트 후 보고서 파일을 자동으로 엽니다</div>
  </div>

  <div class="setting-group">
    <label class="setting-checkbox">
      <input type="checkbox" id="enableDirectAi">
      <span>Direct AI 활성화</span>
    </label>
    <div class="setting-description">외부 AI 연동(Direct AI)을 활성화합니다</div>
  </div>

  <div class="setting-group">
    <div class="setting-label">언어</div>
    <div class="setting-description">보고서 생성 언어</div>
    <select class="setting-select" id="language">
      <option value="ko">한국어</option>
      <option value="en">English</option>
    </select>
  </div>

  <!-- 자동 업데이트 설정 -->
  <div class="section-title">🔄 자동 업데이트</div>

  <div class="setting-group">
    <label class="setting-checkbox">
      <input type="checkbox" id="enableAutoUpdateReports">
      <span>파일 변경 시 보고서 자동 업데이트</span>
    </label>
    <div class="setting-description">파일 변경을 감지하면 보고서 업데이트를 자동 실행합니다</div>
  </div>

  <div class="setting-group">
    <div class="setting-label">디바운스 시간(ms)</div>
    <div class="setting-description">변경이 잠잠해진 뒤 업데이트를 실행하는 대기 시간</div>
    <input type="number" class="setting-input number-input" id="autoUpdateDebounceMs" value="1500" min="0" max="60000" disabled>
  </div>

  <!-- 프리뷰 설정 -->
  <div class="section-title">🎨 프리뷰 설정</div>

  <div class="setting-group">
    <label class="setting-checkbox">
      <input type="checkbox" id="previewEnabled" checked>
      <span>프리뷰 스타일 활성화</span>
    </label>
    <div class="setting-description">보고서 마크다운 미리보기에 Vibe Report 스타일을 적용합니다</div>
  </div>

  <div class="setting-group">
    <div class="setting-label">기본 미리보기 뷰어</div>
    <div class="setting-description">보고서 미리보기에 사용할 뷰어를 선택합니다</div>
    <select class="setting-select" id="preferredMarkdownViewer">
      <option value="mermaid">🔍 Mermaid 프리뷰 (권장)</option>
      <option value="standard">📝 VS Code 기본 미리보기</option>
    </select>
  </div>

  <div class="setting-group">
    <div class="setting-label">프리뷰 배경색</div>
    <div class="setting-description">Share Report Preview 미리보기 배경색</div>
    <select class="setting-select" id="previewBackgroundColor">
      <option value="ide">🖥️ IDE 테마 색상 (기본값)</option>
      <option value="white">⬜ 흰색 배경</option>
      <option value="black">⬛ 검은색 배경</option>
    </select>
  </div>

  <div class="setting-group">
    <div class="setting-label">보고서 열기 모드</div>
    <div class="setting-description">보고서 열기 버튼 클릭 시 표시 방식</div>
    <select class="setting-select" id="reportOpenMode">
      <option value="previewOnly">🔍 Mermaid 프리뷰만 (권장)</option>
      <option value="both">📑 에디터 + 프리뷰</option>
      <option value="editorOnly">📝 에디터만</option>
    </select>
  </div>

  <!-- 프로젝트 비전 설정 -->
  <div class="section-title">🎯 프로젝트 비전 설정</div>

  <div class="setting-group">
    <div class="setting-label">비전 모드</div>
    <div class="setting-description">프로젝트 분석 방식을 선택합니다</div>
    <select class="setting-select" id="projectVisionMode">
      <option value="auto">🔍 자동 분석 (전체 파일 평가)</option>
      <option value="custom">✨ 사용자 정의 비전 사용</option>
    </select>
  </div>

  <div class="setting-group">
    <div class="setting-label">기본 프로젝트 유형</div>
    <div class="setting-description">프로젝트 유형 기본값 (auto-detect: 자동 감지)</div>
    <select class="setting-select" id="defaultProjectType">
      <option value="auto-detect">🔍 자동 감지</option>
      <option value="vscode-extension">📦 VS Code Extension</option>
      <option value="web-frontend">🌐 Web Frontend</option>
      <option value="web-backend">⚙️ Web Backend</option>
      <option value="fullstack">🔄 Full Stack</option>
      <option value="cli-tool">💻 CLI Tool</option>
      <option value="library">📚 Library</option>
      <option value="desktop-app">🖥️ Desktop App</option>
      <option value="mobile-app">📱 Mobile App</option>
      <option value="api-server">🔌 API Server</option>
      <option value="monorepo">📁 Monorepo</option>
      <option value="other">❓ 기타</option>
    </select>
  </div>

  <div class="setting-group">
    <div class="setting-label">기본 개발 단계</div>
    <div class="setting-description">현재 프로젝트의 개발 단계 (품질 우선순위에 영향)</div>
    <select class="setting-select" id="defaultQualityFocus">
      <option value="prototype">⚡ 프로토타입 (빠른 구현 우선)</option>
      <option value="development">🔨 개발 중 (기능 + 기본 품질)</option>
      <option value="stabilization">🛡️ 안정화 (테스트/문서화 집중)</option>
      <option value="production">🚀 프로덕션 (보안/성능 집중)</option>
      <option value="maintenance">🔧 유지보수 (리팩토링/기술부채)</option>
    </select>
  </div>

  <div class="setting-group">
    <button class="btn btn-secondary" id="btn-set-vision" style="width: 100%;">
      🎯 상세 프로젝트 비전 설정...
    </button>
    <div class="setting-description">프로젝트 목표, 집중 영역, 제외 영역 등 상세 설정</div>
  </div>

  <!-- 액션 버튼 -->
  <div class="actions">
    <button class="btn btn-primary" id="btn-save">💾 설정 저장</button>
    <button class="btn btn-secondary" id="btn-reset">🔄 기본값 복원</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const DEFAULTS = ${JSON.stringify(DEFAULT_CONFIG)};
    const UI_DEFAULTS = {
      previewBackgroundColor: 'ide',
      reportOpenMode: 'previewOnly',
      previewEnabled: true,
      preferredMarkdownViewer: 'mermaid',
      enableAutoUpdateReports: false,
      autoUpdateDebounceMs: 1500,
    };
  
    // 요소 참조
    const elements = {
      reportDirectory: document.getElementById('reportDirectory'),
      snapshotFile: document.getElementById('snapshotFile'),
      analysisRoot: document.getElementById('analysisRoot'),
      maxFilesToScan: document.getElementById('maxFilesToScan'),
      excludePatterns: document.getElementById('excludePatterns'),
      enableGitDiff: document.getElementById('enableGitDiff'),
      autoOpenReports: document.getElementById('autoOpenReports'),
      enableDirectAi: document.getElementById('enableDirectAi'),
      language: document.getElementById('language'),
      projectVisionMode: document.getElementById('projectVisionMode'),
      defaultProjectType: document.getElementById('defaultProjectType'),
      defaultQualityFocus: document.getElementById('defaultQualityFocus'),
      enableAutoUpdateReports: document.getElementById('enableAutoUpdateReports'),
      autoUpdateDebounceMs: document.getElementById('autoUpdateDebounceMs'),
      previewEnabled: document.getElementById('previewEnabled'),
      preferredMarkdownViewer: document.getElementById('preferredMarkdownViewer'),
      previewBackgroundColor: document.getElementById('previewBackgroundColor'),
      reportOpenMode: document.getElementById('reportOpenMode'),
    };

    function syncAutoUpdateUi() {
      const enabled = elements.enableAutoUpdateReports.checked;
      elements.autoUpdateDebounceMs.disabled = !enabled;
    }

    // 설정 로드
    function loadSettings(settings) {
      elements.reportDirectory.value = settings.reportDirectory ?? DEFAULTS.reportDirectory;
      elements.snapshotFile.value = settings.snapshotFile ?? DEFAULTS.snapshotFile;
      elements.analysisRoot.value = settings.analysisRoot ?? DEFAULTS.analysisRoot;
      elements.maxFilesToScan.value = String(settings.maxFilesToScan ?? DEFAULTS.maxFilesToScan);
      elements.excludePatterns.value = (settings.excludePatterns ?? DEFAULTS.excludePatterns).join('\\n');
      elements.enableGitDiff.checked = settings.enableGitDiff ?? DEFAULTS.enableGitDiff;
      elements.autoOpenReports.checked = settings.autoOpenReports ?? DEFAULTS.autoOpenReports;
      elements.enableDirectAi.checked = settings.enableDirectAi ?? DEFAULTS.enableDirectAi;
      elements.language.value = settings.language ?? DEFAULTS.language;
      elements.projectVisionMode.value = settings.projectVisionMode ?? DEFAULTS.projectVisionMode;
      elements.defaultProjectType.value = settings.defaultProjectType ?? DEFAULTS.defaultProjectType;
      elements.defaultQualityFocus.value = settings.defaultQualityFocus ?? DEFAULTS.defaultQualityFocus;
      elements.enableAutoUpdateReports.checked = settings.enableAutoUpdateReports ?? UI_DEFAULTS.enableAutoUpdateReports;
      elements.autoUpdateDebounceMs.value = String(settings.autoUpdateDebounceMs ?? UI_DEFAULTS.autoUpdateDebounceMs);
      elements.previewEnabled.checked = settings.previewEnabled ?? UI_DEFAULTS.previewEnabled;
      elements.preferredMarkdownViewer.value = settings.preferredMarkdownViewer ?? UI_DEFAULTS.preferredMarkdownViewer;
      elements.previewBackgroundColor.value = settings.previewBackgroundColor ?? UI_DEFAULTS.previewBackgroundColor;
      elements.reportOpenMode.value = settings.reportOpenMode ?? UI_DEFAULTS.reportOpenMode;
      syncAutoUpdateUi();
    }

    // 모든 설정 저장
    function saveAllSettings() {
      const debounceMs = parseInt(elements.autoUpdateDebounceMs.value, 10);
      const resolvedDebounceMs = Number.isFinite(debounceMs) ? debounceMs : UI_DEFAULTS.autoUpdateDebounceMs;

      const settings = {
        reportDirectory: elements.reportDirectory.value.trim(),
        snapshotFile: elements.snapshotFile.value.trim(),
        analysisRoot: elements.analysisRoot.value.trim(),
        maxFilesToScan: parseInt(elements.maxFilesToScan.value, 10) || 5000,
        excludePatterns: elements.excludePatterns.value
          .split('\\n')
          .map(p => p.trim())
          .filter(Boolean),
        enableGitDiff: elements.enableGitDiff.checked,
        autoOpenReports: elements.autoOpenReports.checked,
        enableDirectAi: elements.enableDirectAi.checked,
        language: elements.language.value,
        projectVisionMode: elements.projectVisionMode.value,
        defaultProjectType: elements.defaultProjectType.value,
        defaultQualityFocus: elements.defaultQualityFocus.value,
        enableAutoUpdateReports: elements.enableAutoUpdateReports.checked,
        autoUpdateDebounceMs: resolvedDebounceMs,
        previewEnabled: elements.previewEnabled.checked,
        preferredMarkdownViewer: elements.preferredMarkdownViewer.value,
        previewBackgroundColor: elements.previewBackgroundColor.value,
        reportOpenMode: elements.reportOpenMode.value,
      };

      vscode.postMessage({ command: 'updateSettings', settings });
    }

    // 이벤트 리스너
    document.getElementById('btn-save').addEventListener('click', saveAllSettings);

    document.getElementById('btn-reset').addEventListener('click', function() {
      vscode.postMessage({ command: 'resetToDefaults' });
    });

    document.getElementById('btn-set-vision').addEventListener('click', function() {
      vscode.postMessage({ command: 'openSetVision' });
    });

    elements.enableAutoUpdateReports.addEventListener('change', syncAutoUpdateUi);

    // 메시지 수신
    window.addEventListener('message', function(event) {
      const message = event.data;
      if (message.command === 'settingsLoaded') {
        loadSettings(message.settings);
      }
    });

    // 초기 설정 요청
    vscode.postMessage({ command: 'getSetting' });
  </script>
</body>
</html>`;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[SettingsView] ${message}`);
  }
}
