# Vibe Coding Report

<p align="center">
  <img src="images/icon.png" alt="Vibe Coding Report Logo" width="128" height="128">
</p>

<p align="center">
  <strong>AI 기반 프로젝트 평가 및 개선 보고서 자동 생성 VS Code 확장</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=vibe-coding.vibereport">
    <img src="https://img.shields.io/visual-studio-marketplace/v/vibe-coding.vibereport" alt="Version">
  </a>
  <a href="https://github.com/Stankjedi/projectmanager/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  </a>
</p>

---

바이브 코딩(AI 페어 프로그래밍)을 통해 프로그램을 제작할 때, 프로젝트 상태를 분석하고 AI 에이전트에게 전달할 개선 프롬프트를 자동으로 생성하는 확장 프로그램입니다.

## ✨ Features

### 📊 삼중 보고서 시스템
- **Project Evaluation Report** - 프로젝트 현황 평가 (10개 카테고리 점수)
- **Project Improvement Exploration Report** - 개선 사항 탐색 및 추적
- **Prompt.md** - AI 에이전트용 실행 프롬프트

### 🔄 증분 업데이트
- 마커 기반 섹션 업데이트 (전체 덮어쓰기 X)
- 이전 세션 내용 보존
- 변경된 부분만 AI에게 전달

### ✅ 적용된 개선사항 추적
- 이미 적용된 개선사항 자동 제외
- 우선순위(P1/P2/P3)별 분류
- 다음 보고서에서 중복 제안 방지

### 📋 AI 친화적 출력
- 클립보드에 분석 프롬프트 자동 복사
- Copilot Chat에 바로 붙여넣기 가능
- 순차 실행 가능한 프롬프트 구조

### 🖥️ 사이드바 UI
- 프로젝트 요약 Webview (CSP 보안 적용)
- 세션 히스토리 TreeView
- 자동 새로고침 (devplan/*.md 변경 감지)

## 🚀 Installation

### VSIX 파일로 설치 (권장)

GitHub Releases에서 최신 `.vsix` 파일을 다운로드하여 설치합니다.

#### 방법 1: VS Code UI에서 설치
1. [Releases 페이지](https://github.com/Stankjedi/projectmanager/releases)에서 `vibereport-x.x.x.vsix` 다운로드
2. VS Code 열기
3. Extensions 사이드바 열기 (`Ctrl+Shift+X`)
4. 상단 `...` 메뉴 클릭 → **Install from VSIX...** 선택
5. 다운로드한 `.vsix` 파일 선택
6. VS Code 재시작

#### 방법 2: 명령줄에서 설치
```bash
# VSIX 파일 다운로드 후
code --install-extension vibereport-0.1.0.vsix
```

#### 방법 3: PowerShell/터미널에서 직접 다운로드 및 설치
```powershell
# GitHub에서 직접 다운로드 (PowerShell)
Invoke-WebRequest -Uri "https://github.com/Stankjedi/projectmanager/releases/download/v0.1.0/vibereport-0.1.0.vsix" -OutFile "vibereport-0.1.0.vsix"
code --install-extension vibereport-0.1.0.vsix
```

```bash
# Linux/Mac
curl -L -o vibereport-0.1.0.vsix https://github.com/Stankjedi/projectmanager/releases/download/v0.1.0/vibereport-0.1.0.vsix
code --install-extension vibereport-0.1.0.vsix
```

### Development (개발자용)
```bash
cd vibereport-extension
pnpm install
pnpm run compile
# F5 눌러서 Extension Development Host 실행
```

## 📖 Usage

### 보고서 업데이트
1. Command Palette 열기 (`Ctrl+Shift+P`)
2. `VibeCoding: Update Project Reports` 실행
3. 분석 프롬프트가 클립보드에 복사됨
4. Copilot Chat에 붙여넣어 분석 요청

### 명령어 목록

| 명령어 | 설명 |
|--------|------|
| `VibeCoding: Update Project Reports` | 프로젝트 분석 및 보고서 업데이트 |
| `VibeCoding: Open Evaluation Report` | 평가 보고서 열기 |
| `VibeCoding: Open Improvement Report` | 개선 보고서 열기 |
| `VibeCoding: Open Prompt File` | AI 프롬프트 파일 열기 |
| `VibeCoding: Initialize Project Reports` | 보고서 초기화 |
| `VibeCoding: Show Last Run Summary` | 마지막 실행 요약 보기 |

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `vibereport.reportDirectory` | 보고서 저장 디렉토리 | `devplan` |
| `vibereport.snapshotFile` | 스냅샷 상태 파일 경로 | `.vscode/vibereport-state.json` |
| `vibereport.enableGitDiff` | Git 기반 변경 분석 활성화 | `true` |
| `vibereport.excludePatterns` | 스캔 제외 패턴 | `["**/node_modules/**", ...]` |
| `vibereport.maxFilesToScan` | 최대 스캔 파일 수 | `5000` |
| `vibereport.autoOpenReports` | 업데이트 후 자동 열기 | `true` |
| `vibereport.language` | 보고서 언어 (`ko` / `en`) | `ko` |

## 📁 Generated Files

```
devplan/
├── Project_Evaluation_Report.md      # 종합 평가 보고서
├── Project_Improvement_Exploration_Report.md  # 개선 탐색 보고서
└── Prompt.md                         # AI 에이전트용 프롬프트
```

### 마커 기반 섹션 업데이트

보고서의 특정 섹션만 자동 업데이트됩니다:
```markdown
<!-- AUTO-OVERVIEW-START -->
이 영역만 자동 업데이트
<!-- AUTO-OVERVIEW-END -->
```

## 🏗️ Architecture

```
vibereport-extension/
├── src/
│   ├── extension.ts          # 진입점
│   ├── commands/             # 명령 핸들러
│   │   ├── index.ts
│   │   └── updateReports.ts  # 핵심 워크플로우
│   ├── services/             # 비즈니스 로직
│   │   ├── workspaceScanner.ts
│   │   ├── snapshotService.ts
│   │   ├── reportService.ts
│   │   └── __tests__/
│   ├── views/                # UI 컴포넌트
│   │   ├── SummaryViewProvider.ts
│   │   ├── HistoryViewProvider.ts
│   │   └── __tests__/
│   ├── models/               # 타입 정의
│   │   ├── types.ts
│   │   ├── errors.ts
│   │   └── constants.ts
│   └── utils/                # 유틸리티
│       ├── markdownUtils.ts
│       ├── timeUtils.ts
│       ├── logger.ts
│       └── __tests__/
├── images/
│   └── icon.png
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 🧪 Testing

```bash
# 단위 테스트 실행
pnpm test

# 커버리지 리포트
pnpm run test:coverage

# 테스트 감시 모드
pnpm test -- --watch
```

현재 49개 단위 테스트 통과 (서비스/유틸/뷰 레이어)

## 📚 API Documentation

```bash
# TypeDoc으로 API 문서 생성
pnpm run docs
# docs/ 폴더에 HTML 문서 생성됨
```

## 🛠️ Development

### Prerequisites
- Node.js 18+
- pnpm
- VS Code 1.100+

### Building
```bash
pnpm install
pnpm run compile
```

### Packaging
```bash
pnpm run package
# vibereport-0.1.0.vsix 생성
```

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 🔗 Links

- [GitHub Repository](https://github.com/Stankjedi/projectmanager)
- [Issue Tracker](https://github.com/Stankjedi/projectmanager/issues)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=vibe-coding.vibereport)

---

Made with ❤️ for Vibe Coding
