# 🤖 AI Agent Improvement Prompts

> ## 🚨 MANDATORY: FILE MODIFICATION REQUIRED
> 
> **⛔ DO NOT just respond with text or code blocks.**
> **⛔ DO NOT say "you can modify like this" without actually modifying.**
> **⛔ DO NOT explain what needs to be done without doing it.**
> 
> **✅ YOU MUST use file editing tools (`replace_string_in_file`, `create_file`, `multi_replace_string_in_file`) to directly modify files.**
> **✅ After each prompt, confirm "I have modified the file(s)" with the actual changes made.**
> 
> ---
> 
> **Process ALL prompts below SEQUENTIALLY. Do NOT stop after completing one prompt.**

---

## 📋 Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | -1] loadConfig 중복 코드 리팩토링 | P2 | ⬜ Pending |
| 2 | PROMPT-002 | -2] 명령 레이어 단위 테스트 추가 | P2 | ⬜ Pending |
| 3 | PROMPT-003 | -3] 세션 로그 단일 소스화 (Session_History.md 통합) | P2 | ⬜ Pending |

**Total: 3 prompts** | **Completed: 0** | **Remaining: 3**

---

## 🟡 Priority 2 (High) - Execute Second

### [PROMPT-001] -1] loadConfig 중복 코드 리팩토링

**⏱️ Execute this prompt now, then proceed to PROMPT-002**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: -1] loadConfig 중복 코드 Refactoring

**Details:**

| 항목 | 내용 |
|:---|:---|
| **ID** | `refactor-config-001` |
| **Category** | 🧹 코드 품질 |
| **Complexity** | Medium |
| **Target Files** | `src/extension.ts`, `src/commands/*.ts`, `src/views/*.ts` |

**Current State:** `loadConfig()` 함수가 `extension.ts`, `UpdateReportsCommand`, `GeneratePromptCommand`, `SummaryViewProvider`, `HistoryViewProvider`, `SettingsViewProvider` 등 최소 6곳 이상에서 동일하게 정의되어 있습니다. v0.2.8에서 `projectVisionMode`, `defaultProjectType`, `defaultQualityFocus` 설정이 추가되면서 모든 파일을 일일이 수정해야 했습니다.

**Improvement:**
- `src/utils/configUtils.ts` 파일을 생성하여 `loadConfig()` 함수를 중앙화
- `DEFAULT_CONFIG` 상수를 정의하여 기본값을 한 곳에서 관리
- 모든 파일에서 해당 유틸을 import하여 사용하도록 변경
- `getRootPath()` 헬퍼 함수도 함께 중앙화

**Expected Effect:**
- 코드 중복 약 200줄 이상 제거
- 설정 항목 변경 시 한 곳만 수정하면 됨
- 설정 관련 버그 발생 가능성 감소
- 유지보수성 점수 향상 예상

---

#

#### Verification:

- Run: `cd vibereport-extension && pnpm compile`
- Run: `cd vibereport-extension && pnpm test`
- Confirm no compilation errors

**✅ After completing this prompt, proceed to [PROMPT-002]**

---

### [PROMPT-002] -2] 명령 레이어 단위 테스트 추가

**⏱️ Execute this prompt now, then proceed to PROMPT-003**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: -2] 명령 레이어 단위 Testing 추가

**Details:**

| 항목 | 내용 |
|:---|:---|
| **ID** | `test-commands-001` |
| **Category** | 🧪 테스트 |
| **Complexity** | Medium |
| **Target Files** | `(new) src/commands/__tests__/generatePrompt.test.ts`, `(new) src/commands/__tests__/setProjectVision.test.ts` |

**Current State:** `GeneratePromptCommand`, `SetProjectVisionCommand` 등 명령 레이어에 대한 단위 테스트가 없습니다. 현재 74개 테스트 중 명령 레이어 테스트는 0개입니다. 리팩토링 시 회귀 버그 위험이 존재합니다.

**Improvement:**
- VS Code API 모킹을 활용한 명령 클래스 단위 테스트 작성
- `vscode.window.showQuickPick`, `vscode.workspace.getConfiguration` 등을 모킹
- 개선 항목 파싱, 프롬프트 생성, 클립보드 복사 로직 검증
- 프로젝트 비전 설정 플로우 테스트

**Expected Effect:**
- 명령 레이어의 안정성 확보
- 리팩토링 시 회귀 버그 조기 발견
- 테스트 커버리지 약 10-15% 추가 향상 예상

---

#

#### Verification:

- Run: `cd vibereport-extension && pnpm compile`
- Run: `cd vibereport-extension && pnpm test`
- Confirm no compilation errors

**✅ After completing this prompt, proceed to [PROMPT-003]**

---

### [PROMPT-003] -3] 세션 로그 단일 소스화 (Session_History.md 통합)

**⏱️ Execute this prompt now - FINAL PROMPT**

> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**

**Task**: -3] 세션 로그 단일 소스화 (Session_History.md 통합)

**Details:**

| 항목 | 내용 |
|:---|:---|
| **ID** | `refactor-session-log-001` |
| **Category** | 🧹 코드 품질 |
| **Complexity** | Low |
| **Target Files** | `src/services/reportService.ts`, `src/commands/updateReports.ts` |

**Current State:** 세션 로그가 `Session_History.md`를 단일 소스로 사용하도록 구조화되어 있지만, 보고서 템플릿에 여전히 `<!-- AUTO-SESSION-LOG-START -->` 마커가 남아있을 수 있습니다. 완전한 통합이 필요합니다.

**Improvement:**
- 평가/개선 보고서 템플릿에서 `<!-- AUTO-SESSION-LOG-START/END -->` 섹션 완전 제거
- `updateEvaluationReport`, `updateImprovementReport` 메소드에서 세션 로그 기록 코드 제거
- `Session_History.md`를 세션 로그의 유일한 소스로 유지
- 보고서에는 "세션 히스토리는 Session_History.md를 참조하세요" 안내 문구만 유지

**Expected Effect:**
- 데이터 일관성 보장 (중복 데이터 제거)
- 보고서 파일 크기 감소
- 코드 단순화 및 유지보수성 향상
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## ✨ 기능 추가 항목

> 새로운 기능을 추가하는 항목입니다.

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#

#### Verification:

- Run: `cd vibereport-extension && pnpm compile`
- Run: `cd vibereport-extension && pnpm test`
- Confirm no compilation errors

**🎉 ALL PROMPTS COMPLETED! Run final verification.**

---


*Generated: 2025-12-01T16:46:34.938Z*