# Vibe Coding Report

<p align="center">
  <img src="images/icon.png" alt="Vibe Coding Report Logo" width="128" height="128">
</p>

<p align="center">
  <strong>AI 기반 프로젝트 평가 및 개선 보고서 자동 생성 VS Code 확장</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=stankjedi.vibereport">
    <img src="https://img.shields.io/visual-studio-marketplace/v/stankjedi.vibereport" alt="Version">
  </a>
  <a href="https://github.com/Stankjedi/projectmanager/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  </a>
  <img src="https://img.shields.io/badge/version-0.4.13-brightgreen" alt="Current Version">
</p>

---

바이브 코딩(AI 페어 프로그래밍)을 통해 프로그램을 제작할 때, 프로젝트 상태를 분석하고 AI 에이전트에게 전달할 개선 프롬프트를 자동으로 생성하는 확장 프로그램입니다.

> **🚀 v0.4.13 주요 업데이트**: 로컬 Mermaid 번들링으로 오프라인 환경 완벽 지원, CSP 보안 강화, 보고서 프리뷰 기능 대폭 개선

## ✨ Features

### 📊 삼중 보고서 시스템
| 보고서 | 설명 |
|--------|------|
| **Project Evaluation Report** | 프로젝트 현황 평가 (10개 카테고리 점수 + A~F 등급) |
| **Project Improvement Report** | 개선 사항 탐색 및 우선순위별 추적 |
| **Prompt.md** | AI 에이전트용 실행 프롬프트 (영어) |

### 📈 Mermaid 다이어그램 지원 (v0.4.x 신기능)
- **로컬 Mermaid 번들링**: 외부 CDN 의존성 완전 제거
- **오프라인 동작**: 인터넷 없이도 다이어그램 렌더링 가능
- **빠른 프리뷰**: 로컬 라이브러리로 즉시 로딩
- **기능 기반 패키지 구조도**: 아키텍처 다이어그램 자동 생성

### 🔒 보안 강화 (CSP)
- Webview에 엄격한 Content Security Policy 적용
- `script-src 'nonce-...'` 적용으로 외부 스크립트 실행 차단
- 안전한 로컬 리소스만 허용

### 🔄 증분 업데이트
- 마커 기반 섹션 업데이트 (전체 덮어쓰기 X)
- 이전 세션 내용 보존
- 변경된 부분만 AI에게 전달

### ✅ 스마트 개선사항 추적
- 이미 적용된 개선사항 자동 필터링
- 우선순위(P1/P2/P3) 및 최적화 항목(OPT) 분류
- 완료된 항목 자동 제외로 중복 제안 방지
- 다중 프롬프트 선택 및 일괄 복사 지원

### 📋 AI 친화적 출력
- 클립보드에 분석 프롬프트 자동 복사
- Copilot Chat / Claude / ChatGPT에 바로 붙여넣기 가능
- 10개 TODO 체크리스트 기반 순차 실행 구조
- 파트별 분리 작성 지침 (150줄 단위)

### 🖥️ 사이드바 UI
- **Summary**: 프로젝트 요약 Webview (CSP 보안 적용)
- **Session History**: 세션별 스냅샷 관리 TreeView
- **Settings**: 프로젝트 비전 및 환경 설정 패널
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
code --install-extension vibereport-0.4.13.vsix
```

#### 방법 3: PowerShell/터미널에서 직접 다운로드 및 설치
```powershell
# GitHub에서 직접 다운로드 (PowerShell)
Invoke-WebRequest -Uri "https://github.com/Stankjedi/projectmanager/releases/download/v0.4.13/vibereport-0.4.13.vsix" -OutFile "vibereport-0.4.13.vsix"
code --install-extension vibereport-0.4.13.vsix
```

```bash
# Linux/Mac
curl -L -o vibereport-0.4.13.vsix https://github.com/Stankjedi/projectmanager/releases/download/v0.4.13/vibereport-0.4.13.vsix
code --install-extension vibereport-0.4.13.vsix
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

| 명령어 | 설명 | 단축키 |
|--------|------|--------|
| `VibeCoding: Update Project Reports` | 프로젝트 분석 및 보고서 업데이트 | - |
| `VibeCoding: Open Evaluation Report` | 평가 보고서 열기 | - |
| `VibeCoding: Open Improvement Report` | 개선 보고서 열기 | - |
| `VibeCoding: Open Prompt File` | AI 프롬프트 파일 열기 | - |
| `VibeCoding: Initialize Project Reports` | 보고서 초기화 | - |
| `VibeCoding: Set Project Vision` | 프로젝트 비전 설정 | - |
| `VibeCoding: Open Session History` | 세션 히스토리 열기 | - |
| `VibeCoding: Generate Improvement Prompt` | 개선 프롬프트 생성 | - |
| `VibeCoding: Open Report Preview` | Mermaid 지원 보고서 프리뷰 | `Ctrl+K M` |
| `VibeCoding: Share Report Preview` | 보고서 공유 | - |

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
| `vibereport.projectVisionMode` | 프로젝트 비전 모드 (`auto` / `custom`) | `auto` |
| `vibereport.defaultProjectType` | 기본 프로젝트 유형 | `auto-detect` |
| `vibereport.defaultQualityFocus` | 기본 품질 우선순위 | `development` |
| `vibereport.preferredMarkdownViewer` | 마크다운 뷰어 (`mermaid` / `standard`) | `mermaid` |
| `vibereport.previewBackgroundColor` | 프리뷰 배경색 (`ide` / `white` / `black`) | `ide` |
| `vibereport.reportOpenMode` | 보고서 열기 방식 (`previewOnly` / `both` / `editorOnly`) | `previewOnly` |

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
# vibereport-0.4.13.vsix 생성
```

## 📝 Changelog

### v0.4.13 (2025-12-15) - 🚀 Major Update

#### 📦 로컬 Mermaid 번들링 및 오프라인 지원
- **Local Mermaid Integration**: 외부 CDN 의존성 완전 제거, 확장 프로그램 내부에 Mermaid.js 번들링
- 오프라인 환경에서도 보고서 프리뷰가 완벽하게 동작
- 프리뷰 로딩 속도 획기적 개선

#### 🔒 보안 강화 (CSP)
- **Strict Content Security Policy**: Webview에 엄격한 CSP 적용
- `script-src 'nonce-...'` 적용으로 보안성 극대화

#### 📊 보고서 시스템 고도화
- **기능 기반 패키지 구조도**: Mermaid 기반 아키텍처 다이어그램 자동 생성
- **상세 평가 지표**: 10개 항목에 대한 정량적 점수와 등급(A~F) 제공
- **개선 보고서 필터링**: 적용된 항목 자동 제외, 미완료 작업만 표시

#### 🛠 기타 개선사항
- Session History 안정화
- 주요 명령어 UX 개선
- 프리뷰 테마 완전 지원 (white/black/ide)

---

이전 버전 히스토리는 [CHANGELOG.md](CHANGELOG.md)를 참고하세요.

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
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=stankjedi.vibereport)

---

Made with ❤️ for Vibe Coding
