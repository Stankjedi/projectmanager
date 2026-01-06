# Vibe Coding Report
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow.svg?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/stankjedi)
<p align="center">
  <img src="images/icon.png" alt="Vibe Coding Report Logo" width="128" height="128">
</p>

<p align="center">
  <strong>AI 기반 프로젝트 평가 및 개선 보고서 자동 생성 VS Code 확장</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=Stankjedi.vibereport">
    <img src="https://img.shields.io/visual-studio-marketplace/v/Stankjedi.vibereport" alt="Version">
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

### 🔒 보안/안전 가드
- `vibereport.reportDirectory`, `vibereport.snapshotFile` 경로 설정에 대해 절대 경로 및 `..`(path traversal) 차단
- 분석 프롬프트에 포함되는 사용자 커스텀 지침에서 secret-like 패턴 자동 마스킹

### 📋 AI 친화적 출력
- 클립보드에 분석 프롬프트 자동 복사
- Copilot Chat에 바로 붙여넣기 가능
- 순차 실행 가능한 프롬프트 구조
- 미완료 프롬프트 전체(순서대로) 원클릭 복사 지원

### 🖥️ 사이드바 UI
- 프로젝트 요약 Webview (CSP 보안 적용)
- 세션 히스토리 TreeView
- 자동 새로고침 (devplan/*.md 변경 감지)

## 🚀 Installation

### From VSIX
```bash
code --install-extension vibereport-extension/vibereport-0.4.41.vsix
```

### Development
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
| `VibeCoding: Update Project Reports (All Workspaces)` | 모든 워크스페이스 보고서 업데이트 |
| `VibeCoding: Export Settings` | 설정 내보내기 |
| `VibeCoding: Import Settings` | 설정 가져오기 |
| `VibeCoding: Clear Session History` | 세션 히스토리 초기화 |
| `VibeCoding: Open Evaluation Report` | 평가 보고서 열기 |
| `VibeCoding: Open Improvement Report` | 개선 보고서 열기 |
| `VibeCoding: Mark Improvement Applied` | 개선 항목 적용 완료 마킹 |
| `VibeCoding: Open Prompt File` | AI 프롬프트 파일 열기 |
| `VibeCoding: Set Project Vision` | 프로젝트 비전 설정 |
| `VibeCoding: Open Session History` | 세션 히스토리 열기 |
| `VibeCoding: Generate Improvement Prompt` | 개선 프롬프트 생성 |
| `VibeCoding: Share Report Preview` | 보고서 프리뷰 공유 |
| `VibeCoding: Export Report Bundle` | 보고서 번들 내보내기 |
| `VibeCoding: Open Code Reference` | 코드 레퍼런스 열기 |
| `VibeCoding: Open Report Preview (with Mermaid)` | Mermaid 지원 보고서 프리뷰 |
| `VibeCoding: Set Analysis Root (Wizard)` | 분석 루트 설정(마법사) |
| `VibeCoding: Open Troubleshooting Guide` | 문제 해결 가이드 열기 |
| `VibeCoding: Report Doctor: Validate/Repair Reports` | 보고서 검증/복구 |
| `Antigravity: Toggle Auto-Accept` | 승인(accept) 자동 실행 토글 |
| `VibeCoding: Initialize Project Reports` | 보고서 초기화 |

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `vibereport.reportDirectory` | 보고서 저장 디렉토리 (보안: 워크스페이스 하위 상대 경로만 허용) | `devplan` |
| `vibereport.snapshotFile` | 스냅샷 상태 파일 경로 (보안: 워크스페이스 하위 상대 경로만 허용) | `.vscode/vibereport-state.json` |
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

현재 200+ 단위 테스트 통과 (서비스/유틸/뷰 레이어)

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
- VS Code 1.90.0+

### WSL (Windows Subsystem for Linux)
- **권장 위치**: `/mnt/c` 대신 WSL 파일시스템(예: `~/dev/projectmanager`)에 저장/작업
- **권장 버전**: Node.js 20+, pnpm 9
- **의존성 설치**:
  ```bash
  pnpm -C vibereport-extension install --frozen-lockfile
  ```

#### Troubleshooting (특히 /mnt/c에서 발생)
- 자세한 내용: [vibereport-extension/TROUBLESHOOTING.md](vibereport-extension/TROUBLESHOOTING.md)
- `ERR_PNPM_EACCES` during install: `/mnt/c` 밖으로 이동 → `vibereport-extension/node_modules` 삭제 → 재설치
- Rollup 오류 `Cannot find module @rollup/rollup-linux-x64-gnu`: Windows에서 설치된 `node_modules` 재사용 금지 → WSL에서 재설치

#### Verify like CI
```bash
pnpm -C vibereport-extension install --frozen-lockfile
pnpm -C vibereport-extension run compile
pnpm -C vibereport-extension run lint
pnpm -C vibereport-extension run test:run
pnpm -C vibereport-extension run test:coverage
```

### Building
```bash
pnpm install
pnpm run compile
```

### Packaging
```bash
pnpm run package
# vibereport-0.4.41.vsix 생성
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
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Stankjedi.vibereport)

---

Made with ❤️ for Vibe Coding
