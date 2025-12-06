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
| **버전** | 0.3.14 |
| **최초 분석일** | 2025-11-30 00:48 |
| **최근 분석일** | 2025-12-06 |
| **테스트** | 102개 통과 (Vitest) |
| **발행자** | stankjedi |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

### 1. 현황 개요 (미적용 항목만 집계)

| 우선순위 | 미적용 개수 | 설명 |
|:---|:---:|:---|
| 🔴 긴급 (P1) | 0 | 현재 추적 중인 P1 항목 없음 |
| 🟡 중요 (P2) | 0 | 현재 추적 중인 P2 기능 개선 항목 없음 |
| 🟢 개선 (P3) | 2 | AI 직접 연동, 멀티 워크스페이스 지원 |
| ⚙️ OPT (코드 최적화) | 1 | 스냅샷 성능 튜닝 |
| **총 미적용** | **3** | 기능 추가 2개, OPT 1개 |

### 2. 항목별 분포 테이블 (미적용 항목만)

| # | 항목명 | 우선순위 | 카테고리 |
|:---:|:---|:---:|:---|
| 1 | AI 직접 연동 (Language Model API) | P3 | ✨ 기능 추가 |
| 2 | 멀티 워크스페이스 지원 | P3 | ✨ 기능 추가 |
| 3 | 스냅샷/디프 성능 튜닝 (`opt-snapshot-diff-001`) | OPT | ⚙️ 성능 튜닝 |

### 3. 카테고리별 분포

| 카테고리 | 미적용 개수 | 항목 |
|:---|:---:|:---|
| ✨ 기능 추가 | 2 | AI 직접 연동, 멀티 워크스페이스 |
| ⚙️ 성능 튜닝 | 1 | opt-snapshot-diff-001 |

### 4. 우선순위별 한줄 요약

- 🔴 **P1:** 현재까지 긴급하게 처리해야 할 버그·장애 등은 식별되지 않았습니다.  
- 🟡 **P2:** 명령 레이어 테스트·안정성 관련 주요 개선은 최근 버전에서 반영되어, 신규 P2 기능 개선 항목은 없습니다.  
- 🟢 **P3:** AI 직접 연동(`feat-ai-integration-001`)과 멀티 워크스페이스 지원(`feat-multi-workspace-001`)이 남은 핵심 기능 과제입니다.  
- ⚙️ **OPT:** 스냅샷 성능 튜닝(`opt-snapshot-diff-001`)을 통해 대형 프로젝트에서의 성능을 끌어올릴 수 있습니다.

> 참고: 적용 완료된 개선 항목의 **구체적인 목록과 개수**는 `devplan/Session_History.md` 및 VS Code 사이드바 **Session History** 뷰에서 별도로 관리됩니다. 이 보고서에는 **현재 시점 기준 미적용 항목만** 포함됩니다.
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 긴급 (P1)

현재 P1 우선순위의 미적용 기능 개선 항목은 없습니다.  
장애·데이터 손실·치명적 보안 이슈가 확인되는 경우, 아래 템플릿을 사용해 신규 항목을 추가합니다.

### 🟡 중요 (P2)

현재 추적 중인 P2 기능 개선 항목은 없습니다. 최근 버전에서 명령 레이어 테스트 확장 및 언어 규칙 강화가 완료되어, 남은 과제는 P3·OPT에 집중되어 있습니다.  
새로운 P2 항목이 발견되면 아래 형식을 사용해 **미적용 항목만** 추가합니다.

#### [P2-x] 예시 템플릿 (향후 항목 추가 시 사용)
| 항목 | 내용 |
|------|------|
| **ID** | `고유-id` |
| **카테고리** | 🧪 테스트 / 🔒 보안 / 🧹 코드 품질 등 |
| **복잡도** | Low / Medium / High |
| **대상 파일** | 파일 경로 |
| **Origin** | test-failure / build-error / static-analysis / manual-idea |
| **리스크 레벨** | low / medium / high / critical |
| **관련 평가 카테고리** | testCoverage, codeQuality 등 |

**현재 상태:** (예시) 명령 레이어 테스트는 충분하지만, 특정 에러 경로에 대한 회귀 테스트가 부족합니다.  
**문제점 (Problem):** 에러 플로우 리팩토링 시 예외 케이스에서 회귀가 발생할 수 있습니다.  
**영향 (Impact):** 사용자에게 잘못된 에러 메시지가 노출되거나, 보고서 업데이트가 조용히 실패할 수 있습니다.  
**원인 (Cause):** 예외 흐름에 대한 테스트 케이스가 부족하고, 경계 조건에 대한 명세가 부족합니다.  
**개선 내용 (Proposed Solution):** 해당 명령·서비스에 대한 에러 플로우 테스트를 보강하고, 실패 시 사용자 피드백을 통일합니다.  
**기대 효과:** 회귀 위험 감소, 사용자 경험 향상, 문제 재현·디버깅 시간 단축.

**Definition of Done:**
- [ ] 에러 플로우 테스트 케이스가 추가되어 있음
- [ ] 실패 시 사용자 메시지가 일관되게 노출됨
- [ ] `pnpm test` 전체 통과
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### ⚙️ 성능 튜닝 (OPT-1) - 스냅샷/디프 성능 및 가시성 개선
| 항목 | 내용 |
|------|------|
| **ID** | `opt-snapshot-diff-001` |
| **카테고리** | ⚙️ 성능 튜닝 |
| **영향 범위** | 성능 / 품질 |
| **대상 파일** | `src/services/workspaceScanner.ts`, `src/services/snapshotService.ts`, `src/services/snapshotCache.ts` |
| **관련 평가 카테고리** | `performance`, `observability` |

**현재 상태:**  
- `snapshotCache.ts`가 신규 추가되어 TTL 기반 캐싱 인프라는 준비되어 있으나, 실제 WorkspaceScanner/SnapshotService에서 캐시를 활용하는 로직은 아직 제한적입니다.  
- Git diff 요약에 라인 수(added/removed/total) 메트릭이 포함되어 있지 않아, "변경량이 큰 세션"을 수치로 빠르게 파악하기 어렵습니다.

**최적화 내용:**  
- WorkspaceScanner에서 파일 목록·스냅샷 계산에 snapshotCache를 적극 활용하도록 연동합니다.  
- SnapshotService에서 Git diff 결과에 라인 수 메트릭(added/removed/total)을 포함시키고, Summary·Session History에서 해당 정보를 노출합니다.

**예상 효과:**  
- 성능: 대형 프로젝트에서 연속 실행 시 스캔 시간이 눈에 띄게 단축됩니다.  
- 품질/가시성: 변경량을 숫자로 표현함으로써, "큰 변경"이 발생한 세션을 Session History에서 빠르게 식별할 수 있습니다.

**측정 가능한 지표:**  
- 동일 워크스페이스에서 연속 실행 시 두 번째 실행의 스캔 시간 감소 비율  
- Session History에서 라인 수 메트릭이 노출되는 세션 비율
<!-- AUTO-OPTIMIZATION-END -->

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
| **Origin** | `manual-idea` |
| **Risk Level** | 🟢 Low |
| **관련 평가 카테고리** | `productionReadiness`, `automation`, `developerExperience` |

**현재 상태:** 현재 워크플로우는 생성된 프롬프트를 클립보드에 복사한 후, 사용자가 수동으로 AI 챗(예: Copilot Chat)에 붙여넣는 방식에 의존합니다. VS Code의 Language Model API가 아직 Proposed API 단계이므로 직접 연동은 보류 중이며, 관련 서비스(`aiService`)나 설정 플래그도 존재하지 않습니다.

**추가 기능:**
- VS Code의 `Language Model API` (`vscode.lm`)가 안정화되면 이를 활용하는 `AiService` 레이어를 도입
- `AiService`를 통해 프롬프트 생성, 모델 선택, 토큰 제한 관리 등을 캡슐화하고, UpdateReportsCommand에서는 서비스 인터페이스만 호출하도록 분리
- 사용자가 "AI 직접 실행" 여부를 설정으로 제어할 수 있도록 `vibereport.enableDirectAi`(boolean) 옵션 추가
- API가 사용 불가하거나 오류가 발생하는 경우, 기존 "클립보드 복사 + 수동 실행" 플로우로 자동 폴백

<!-- ERROR-EXPLORATION-START -->
**🔍 Error Exploration Procedure:**
1. **현상 파악**: 수동 복사/붙여넣기 과정으로 인한 UX 저하 및 자동화 부재
2. **재현 단계**: 
   - Update Reports 명령 실행 후 클립보드에 복사된 프롬프트 확인
   - Copilot Chat에 수동 붙여넣기 필요
3. **근본 원인**: VS Code Language Model API가 Proposed API 단계로 안정화 대기 중
4. **해결 방안**: `AiService` 레이어 도입 및 `enableDirectAi` 설정 플래그 추가
5. **검증 방법**: 설정 플래그 On/Off에 따른 동작 검증, API 미지원 시 폴백 확인
<!-- ERROR-EXPLORATION-END -->

**기대 효과:**
- 버튼 클릭 한 번으로 분석-보고-개선 제안까지 완전 자동화
- 수동 복사/붙여넣기 과정 제거로 사용자 경험(UX) 향상
- 향후 다른 AI 공급자(OpenAI, Azure OpenAI 등)로 교체하기 쉬운 구조 확보

**✅ Definition of Done:**
- [ ] `src/services/aiService.ts` 생성
- [ ] `package.json`에 `vibereport.enableDirectAi` 설정 추가
- [ ] `UpdateReportsCommand`에서 설정 확인 후 분기 처리
- [ ] API 미지원 시 기존 클립보드 플로우로 폴백
- [ ] `pnpm compile` 에러 없이 완료
- [ ] `pnpm test` 모든 테스트 통과

---

#### [P3-2] 멀티 워크스페이스 지원

| 항목 | 내용 |
|:---|:---|
| **ID** | `feat-multi-workspace-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Medium |
| **대상 파일** | `src/services/workspaceScanner.ts`, `src/commands/updateReports.ts`, `src/utils/configUtils.ts` |
| **Origin** | `manual-idea` |
| **Risk Level** | 🟢 Low |
| **관련 평가 카테고리** | `scalability`, `developerExperience` |

**현재 상태:** `configUtils.selectWorkspaceRoot()`가 추가되어 다중 워크스페이스 중 하나를 선택할 수 있는 기반은 마련되었지만, `UpdateReportsCommand`와 주요 명령/뷰에서는 여전히 `workspaceFolders[0]`을 직접 사용하는 부분이 남아 있습니다. 실제 보고서 생성/열기 플로우는 단일 루트 기준으로 동작합니다.

**추가 기능:**
- UpdateReportsCommand와 관련 명령(보고서 열기, Prompt 열기 등)에서 `selectWorkspaceRoot()`를 사용하여 사용자가 명시적으로 워크스페이스를 선택하도록 개선
- WorkspaceScanner와 SnapshotService가 선택된 워크스페이스 컨텍스트를 명확히 인자로 받도록 인터페이스 정리
- Summary/History 뷰에서 현재 선택된 워크스페이스 이름을 표시하고, 멀티 워크스페이스 환경에서의 혼란을 줄이는 UX 제공
- (옵션) 모든 워크스페이스에 대해 순차적으로 보고서를 생성하는 "전체 워크스페이스 스캔" 모드 제공

<!-- ERROR-EXPLORATION-START -->
**🔍 Error Exploration Procedure:**
1. **현상 파악**: 멀티루트 워크스페이스에서 항상 첫 번째 폴더만 대상으로 분석됨
2. **재현 단계**: 
   - 2개 이상의 루트 폴더가 있는 워크스페이스 열기
   - Update Reports 명령 실행 시 `workspaceFolders[0]`만 사용됨 확인
3. **근본 원인**: 초기 구현 시 단일 워크스페이스 가정으로 설계
4. **해결 방안**: `selectWorkspaceRoot()` 활용하여 사용자 선택 기반으로 변경
5. **검증 방법**: 멀티루트 워크스페이스에서 각 폴더별 보고서 생성 확인
<!-- ERROR-EXPLORATION-END -->

**기대 효과:**
- 모노레포 또는 다중 프로젝트 환경에서도 확장 사용 가능
- 대규모 프로젝트·팀에서의 활용성 증가
- 워크스페이스 컨텍스트 명시화로 분석 결과 해석이 쉬워짐

**✅ Definition of Done:**
- [ ] `UpdateReportsCommand`에서 `selectWorkspaceRoot()` 사용
- [ ] 선택된 워크스페이스 경로가 모든 서비스에 전달됨 확인
- [ ] Progress UI에 선택된 워크스페이스 이름 표시
- [ ] `pnpm compile` 에러 없이 완료
- [ ] `pnpm test` 모든 테스트 통과
- [ ] 멀티루트 워크스페이스에서 수동 테스트 통과
<!-- AUTO-FEATURE-LIST-END -->

---

## 📜 분석 이력

> 📖 **전체 세션 히스토리는 `Session_History.md` 파일을 참조하세요.**  
> 이 보고서에는 세션별 상세 로그를 중복 기록하지 않습니다.

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
