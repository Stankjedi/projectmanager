# 🚀 프로젝트 개선 탐색 보고서

> 이 문서는 Vibe Coding Report VS Code 확장에서 자동으로 관리됩니다.  
> **미적용 개선 항목만 표시됩니다. 적용 완료된 항목은 자동으로 제외됩니다.**
> 
> 💡 **구체적인 구현 코드는 `Prompt.md` 파일을 참조하세요.**

---

<!-- AUTO-OVERVIEW-START -->
## 📋 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프로젝트명** | projectmanager (vibereport) |
| **버전** | 0.2.6 |
| **최초 분석일** | 2025-11-30 00:48 |
| **최근 분석일** | 2025-12-01 20:21 |
| **테스트** | 74개 통과 (Vitest) |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

### 현황 개요

| 우선순위 | 개수 | 설명 |
|:---|:---:|:---|
| 🔴 긴급 (P1) | 0 | 없음 |
| 🟡 중요 (P2) | 3 | loadConfig 리팩토링, 명령 레이어 테스트, 세션 로그 통합 |
| 🟢 개선 (P3) | 2 | AI 직접 연동, 멀티 워크스페이스 지원 |
| **총 미적용** | **5** | - |

### ✅ v0.2.6 적용 완료 항목 (4개)

이전 보고서의 P1-1, P2-1, P2-2, P3-1 항목이 모두 적용되어 제외되었습니다:
- ~~[P1-1] updateReports 리팩토링~~ → 완료
- ~~[P2-1] ReportService 단위 테스트~~ → 완료 (23개 테스트 추가)
- ~~[P2-2] JSDoc 문서화~~ → 완료
- ~~[P3-1] 설정 UI 개발~~ → 완료 (SettingsViewProvider.ts)

### 카테고리별 분포

| 카테고리 | 개수 | 항목 |
|:---|:---:|:---|
| 🧹 코드 품질 | 2 | loadConfig 리팩토링, 세션 로그 통합 |
| 🧪 테스트 | 1 | 명령 레이어 테스트 |
| ✨ 기능 추가 | 2 | AI 직접 연동, 멀티 워크스페이스 |

### 우선순위별 요약

**🟡 P2 - 다음 릴리즈 전 권장:**
1. **loadConfig 중복 코드 리팩토링**: 여러 파일에 산재한 설정 로드 로직을 중앙화
2. **명령 레이어 테스트 추가**: GeneratePromptCommand, MarkImprovementApplied 등
3. **세션 로그 단일 소스화**: 평가/개선 보고서의 세션 로그를 Session_History.md로 통합

**🟢 P3 - 점진적 개선:**
1. **AI 직접 연동**: Language Model API를 통한 자동화 (장기 목표)
2. **멀티 워크스페이스 지원**: 다중 루트 워크스페이스 환경 대응
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🟡 중요 (P2)

#### [P2-1] loadConfig 중복 코드 리팩토링

| 항목 | 내용 |
|:---|:---|
| **ID** | `refactor-config-001` |
| **카테고리** | 🧹 코드 품질 |
| **복잡도** | Medium |
| **대상 파일** | `src/extension.ts`, `src/commands/updateReports.ts`, `src/views/*.ts` |

**현재 상태:** `loadConfig()` 함수가 `extension.ts`, `UpdateReportsCommand`, `MarkImprovementAppliedCommand`, `SummaryViewProvider`, `HistoryViewProvider`, `SettingsViewProvider` 등 최소 6곳 이상에서 동일하게 정의되어 있습니다. 설정 항목이 변경되면 모든 곳을 수정해야 하며, 불일치 버그 발생 위험이 있습니다.

**개선 내용:**
- `src/utils/configUtils.ts` 파일을 생성하여 `loadConfig()` 함수를 중앙화합니다.
- 모든 파일에서 해당 유틸을 import하여 사용하도록 변경합니다.
- 설정 기본값을 `models/constants.ts`에 정의하고 재사용합니다.

**기대 효과:**
- 코드 중복 제거 및 유지보수성 향상
- 설정 항목 변경 시 한 곳만 수정하면 됨
- 설정 관련 버그 발생 가능성 감소

---

#### [P2-2] 명령 레이어 단위 테스트 추가

| 항목 | 내용 |
|:---|:---|
| **ID** | `test-commands-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `(new) src/commands/__tests__/generatePrompt.test.ts`, `(new) src/commands/__tests__/setProjectVision.test.ts` |

**현재 상태:** `GeneratePromptCommand`, `MarkImprovementAppliedCommand`, `SetProjectVisionCommand` 등 명령 레이어에 대한 단위 테스트가 없습니다. 이로 인해 리팩토링 시 회귀 버그 위험이 존재합니다.

**개선 내용:**
- VS Code API 모킹을 활용한 명령 클래스 단위 테스트 작성
- `vscode.window.showQuickPick`, `vscode.workspace.getConfiguration` 등을 모킹
- 개선 항목 파싱, 프롬프트 생성, 클립보드 복사 로직 검증

**기대 효과:**
- 명령 레이어의 안정성 확보
- 리팩토링 시 회귀 버그 조기 발견
- 테스트 커버리지 추가 향상

---

#### [P2-3] 세션 로그 단일 소스화 (Session_History.md 통합)

| 항목 | 내용 |
|:---|:---|
| **ID** | `refactor-session-log-001` |
| **카테고리** | 🧹 코드 품질 |
| **복잡도** | Low |
| **대상 파일** | `src/services/reportService.ts`, `src/commands/updateReports.ts` |

**현재 상태:** 세션 로그가 `Session_History.md`와 평가/개선 보고서 내 `<!-- AUTO-SESSION-LOG-START -->` 섹션에 중복 기록되고 있습니다. 이는 데이터 불일치 및 보고서 파일 크기 증가 문제를 야기합니다.

**개선 내용:**
- 평가/개선 보고서 템플릿에서 `<!-- AUTO-SESSION-LOG-START -->` 섹션 제거
- `updateEvaluationReport`, `updateImprovementReport` 메소드에서 세션 로그 기록 코드 제거
- `Session_History.md`를 세션 로그의 단일 소스로 유지
- 보고서에는 "세션 히스토리는 Session_History.md를 참조하세요" 안내 문구만 남김

**기대 효과:**
- 데이터 일관성 보장
- 보고서 파일 크기 감소
- 코드 단순화
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## ✨ 기능 추가 항목

> 새로운 기능을 추가하는 항목입니다.

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] AI 직접 연동 (Language Model API)

| 항목 | 내용 |
|:---|:---|
| **ID** | `feat-ai-integration-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | High |
| **대상 파일** | `src/commands/updateReports.ts`, `(new) src/services/aiService.ts` |

**현재 상태:** 현재 워크플로우는 생성된 프롬프트를 클립보드에 복사한 후, 사용자가 수동으로 AI 챗(예: Copilot Chat)에 붙여넣는 방식에 의존합니다. 이는 반자동화 상태로, 완전한 경험을 제공하지 못합니다.

**추가 기능:**
- VS Code의 `Language Model API` (`vscode.lm`)가 안정화되면 이를 활용합니다.
- `aiService.ts`라는 새로운 서비스를 만들어 AI 모델과의 통신을 추상화합니다.
- `updateReports` 명령어 실행 시, 생성된 프롬프트를 AI 모델에 직접 전송합니다.
- AI의 응답을 받아 `reportService`를 통해 파일에 직접 반영하는 로직을 구현합니다.

**기대 효과:**
- 버튼 클릭 한 번으로 분석-보고-개선 제안까지 이어지는 완전 자동화된 워크플로우 달성.
- 사용자 경험을 극대화하고 도구의 핵심 가치를 완성.

---

#### [P3-2] 멀티 워크스페이스 지원

| 항목 | 내용 |
|:---|:---|
| **ID** | `feat-multi-workspace-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Medium |
| **대상 파일** | `src/services/workspaceScanner.ts`, `src/commands/updateReports.ts` |

**현재 상태:** 현재 구현은 `vscode.workspace.workspaceFolders[0]`만을 대상으로 하여, 멀티 루트 워크스페이스 환경에서는 첫 번째 폴더만 스캔됩니다.

**추가 기능:**
- 사용자가 여러 워크스페이스 중 하나를 선택할 수 있는 QuickPick UI 추가
- 또는 모든 워크스페이스를 순회하며 각각에 대해 보고서를 생성하는 옵션 제공
- 워크스페이스 컨텍스트를 명확히 표시하여 혼란 방지

**기대 효과:**
- 모노레포 또는 다중 프로젝트 환경에서도 확장 사용 가능
- 사용자 요구 범위 확대
<!-- AUTO-FEATURE-LIST-END -->

---

## 📜 분석 이력

<!-- AUTO-SESSION-LOG-START -->

> 📖 **전체 세션 히스토리는 `Session_History.md` 파일을 참조하세요.**

### 최근 분석 세션

| 날짜 | 분석 유형 | 주요 내용 |
|------|----------|----------|
| 2025-12-01 20:21 | 보고서 업데이트 | v0.2.6: PROMPT-001~004 적용 완료, 새 개선 항목 발굴 |
| 2025-12-01 17:16 | 버그수정/기능추가 | v0.2.0→v0.2.1: 세션 트래킹 버그 수정, Session_History.md 파일 지원 추가 |
| 2025-12-01 12:00 | 기능 추가 | v0.1.0→v0.2.0: Project Vision 기능 추가 |

<!-- AUTO-SESSION-LOG-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
