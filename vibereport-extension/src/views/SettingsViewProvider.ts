/**
 * Settings View Provider
 * 
 * @description Vibe Report 확장 설정을 위한 Webview UI를 제공합니다.
 * 사용자가 settings.json을 직접 수정하지 않고도 UI에서 설정을 변경할 수 있습니다.
 */

import * as vscode from 'vscode';

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
        case 'updateSetting':
          await this.updateSetting(message.key, message.value);
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
   * 설정값 업데이트
   */
  private async updateSetting(key: string, value: any): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('vibereport');
      await config.update(key, value, vscode.ConfigurationTarget.Workspace);

      this.log(`설정 업데이트: ${key} = ${JSON.stringify(value)}`);
      vscode.window.showInformationMessage(`설정이 저장되었습니다: ${key}`);

      // 설정 변경 후 UI 업데이트
      await this.sendCurrentSettings();
    } catch (error) {
      this.log(`설정 업데이트 실패: ${error}`);
      vscode.window.showErrorMessage(`설정 저장 실패: ${error}`);
    }
  }

  /**
   * 현재 설정값을 웹뷰에 전송
   */
  private async sendCurrentSettings(): Promise<void> {
    if (!this._view) return;

    const config = vscode.workspace.getConfiguration('vibereport');
    const settings = {
      reportDirectory: config.get<string>('reportDirectory', 'devplan'),
      snapshotFile: config.get<string>('snapshotFile', '.vscode/vibereport-state.json'),
      enableGitDiff: config.get<boolean>('enableGitDiff', true),
      excludePatterns: config.get<string[]>('excludePatterns', []),
      maxFilesToScan: config.get<number>('maxFilesToScan', 5000),
      autoOpenReports: config.get<boolean>('autoOpenReports', true),
      language: config.get<string>('language', 'ko'),
      projectVisionMode: config.get<string>('projectVisionMode', 'auto'),
      defaultProjectType: config.get<string>('defaultProjectType', 'auto-detect'),
      defaultQualityFocus: config.get<string>('defaultQualityFocus', 'development'),
      previewBackgroundColor: config.get<string>('previewBackgroundColor', 'ide'),
      reportOpenMode: config.get<string>('reportOpenMode', 'previewOnly'),
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
      reportDirectory: 'devplan',
      snapshotFile: '.vscode/vibereport-state.json',
      enableGitDiff: true,
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/build/**',
        '**/.git/**',
      ],
      maxFilesToScan: 5000,
      autoOpenReports: true,
      language: 'ko',
      projectVisionMode: 'auto',
      defaultProjectType: 'auto-detect',
      defaultQualityFocus: 'development',
      previewBackgroundColor: 'ide',
      reportOpenMode: 'previewOnly',
    };

    for (const [key, value] of Object.entries(defaults)) {
      await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }

    vscode.window.showInformationMessage('설정이 기본값으로 초기화되었습니다.');
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
**/.git/**</textarea>
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
    <div class="setting-label">언어</div>
    <div class="setting-description">보고서 생성 언어</div>
    <select class="setting-select" id="language">
      <option value="ko">한국어</option>
      <option value="en">English</option>
    </select>
  </div>

  <!-- 프리뷰 설정 -->
  <div class="section-title">🎨 프리뷰 설정</div>

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

    // 요소 참조
    const elements = {
      reportDirectory: document.getElementById('reportDirectory'),
      snapshotFile: document.getElementById('snapshotFile'),
      maxFilesToScan: document.getElementById('maxFilesToScan'),
      excludePatterns: document.getElementById('excludePatterns'),
      enableGitDiff: document.getElementById('enableGitDiff'),
      autoOpenReports: document.getElementById('autoOpenReports'),
      language: document.getElementById('language'),
      projectVisionMode: document.getElementById('projectVisionMode'),
      defaultProjectType: document.getElementById('defaultProjectType'),
      defaultQualityFocus: document.getElementById('defaultQualityFocus'),
      previewBackgroundColor: document.getElementById('previewBackgroundColor'),
      reportOpenMode: document.getElementById('reportOpenMode'),
    };

    // 설정 로드
    function loadSettings(settings) {
      elements.reportDirectory.value = settings.reportDirectory || 'devplan';
      elements.snapshotFile.value = settings.snapshotFile || '.vscode/vibereport-state.json';
      elements.maxFilesToScan.value = settings.maxFilesToScan || 5000;
      elements.excludePatterns.value = (settings.excludePatterns || []).join('\\n');
      elements.enableGitDiff.checked = settings.enableGitDiff !== false;
      elements.autoOpenReports.checked = settings.autoOpenReports !== false;
      elements.language.value = settings.language || 'ko';
      elements.projectVisionMode.value = settings.projectVisionMode || 'auto';
      elements.defaultProjectType.value = settings.defaultProjectType || 'auto-detect';
      elements.defaultQualityFocus.value = settings.defaultQualityFocus || 'development';
      elements.previewBackgroundColor.value = settings.previewBackgroundColor || 'ide';
      elements.reportOpenMode.value = settings.reportOpenMode || 'previewOnly';
    }

    // 모든 설정 저장
    function saveAllSettings() {
      const settings = {
        reportDirectory: elements.reportDirectory.value.trim(),
        snapshotFile: elements.snapshotFile.value.trim(),
        maxFilesToScan: parseInt(elements.maxFilesToScan.value, 10) || 5000,
        excludePatterns: elements.excludePatterns.value.split('\\n').filter(p => p.trim()),
        enableGitDiff: elements.enableGitDiff.checked,
        autoOpenReports: elements.autoOpenReports.checked,
        language: elements.language.value,
        projectVisionMode: elements.projectVisionMode.value,
        defaultProjectType: elements.defaultProjectType.value,
        defaultQualityFocus: elements.defaultQualityFocus.value,
        previewBackgroundColor: elements.previewBackgroundColor.value,
        reportOpenMode: elements.reportOpenMode.value,
      };

      for (const [key, value] of Object.entries(settings)) {
        vscode.postMessage({ command: 'updateSetting', key, value });
      }
    }

    // 이벤트 리스너
    document.getElementById('btn-save').addEventListener('click', saveAllSettings);

    document.getElementById('btn-reset').addEventListener('click', function() {
      vscode.postMessage({ command: 'resetToDefaults' });
    });

    document.getElementById('btn-set-vision').addEventListener('click', function() {
      vscode.postMessage({ command: 'openSetVision' });
    });

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
