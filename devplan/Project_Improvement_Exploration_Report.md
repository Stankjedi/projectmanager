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
| **버전** | 0.3.8 |
| **최초 분석일** | 2025-11-30 00:48 |
| **최근 분석일** | 2025-12-04 18:30 |
| **테스트** | 86개 통과 (Vitest) |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

### 현황 개요

| 우선순위 | 개수 | 설명 |
|:---|:---:|:---|
| 🔴 긴급 (P1) | 0 | 없음 |
| 🟡 중요 (P2) | 1 | 명령 레이어 단위 테스트 확장 |
| 🟢 개선 (P3) | 2 | AI 직접 연동, 멀티 워크스페이스 지원 |
| **총 미적용** | **3** | - |

### 항목별 분포 테이블

| # | 항목명 | 우선순위 | 카테고리 |
|:---:|:---|:---:|:---|
| 1 | 명령 레이어 단위 테스트 확장 | P2 | 🧪 테스트 |
| 2 | AI 직접 연동 (Language Model API) | P3 | ✨ 기능 추가 |
| 3 | 멀티 워크스페이스 지원 | P3 | ✨ 기능 추가 |

### 카테고리별 분포

| 카테고리 | 개수 | 항목 |
|:---|:---:|:---|
| 🧪 테스트 | 1 | 명령 레이어 단위 테스트 확장 |
| ✨ 기능 추가 | 2 | AI 직접 연동, 멀티 워크스페이스 |

### 우선순위별 요약

**🟡 P2 - 다음 릴리즈 전 권장:**
1. **명령 레이어 테스트 확장**: UpdateReportsCommand, SetProjectVisionCommand 등 주요 명령 플로우에 대한 테스트 보강. v0.3.8에서 generatePrompt.ts가 개선되었으므로 테스트 패턴을 재사용하기 용이함.

**🟢 P3 - 점진적 개선:**
1. **AI 직접 연동**: VS Code Language Model API를 사용한 자동화 경로 도입
2. **멀티 워크스페이스 지원**: 다중 루트 워크스페이스 환경 지원 및 UX 개선
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🟡 중요 (P2)

#### [P2-1] 명령 레이어 단위 테스트 확장

| 항목 | 내용 |
|:---|:---|
| **ID** | `test-commands-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `src/commands/__tests__/generatePrompt.test.ts`, `(new) src/commands/__tests__/setProjectVision.test.ts`, `(new) src/commands/__tests__/updateReports.test.ts` |
| **Origin** | `code-smell` |
| **Risk Level** | 🟡 Medium |

**현재 상태:** `GeneratePromptCommand`에 대한 기본 단위 테스트는 추가되었지만, `UpdateReportsCommand`, `SetProjectVisionCommand` 등 핵심 명령 흐름에 대한 테스트가 부족합니다. 워크스페이스 미존재, 설정 로딩 실패, 스냅샷 로딩 오류, 사용자의 QuickPick/입력 취소 등 다양한 분기 처리가 실제로는 사람이 수동으로만 검증되고 있습니다.

**개선 내용:**
- VS Code API(`vscode.window`, `vscode.workspace`, `vscode.commands`)와 `fs/promises`를 모킹하여 명령 레이어 단위 테스트를 추가
- `UpdateReportsCommand.execute()`의 정상 플로우 및 에러 플로우(스캔 실패, 리포트 생성 실패 등) 검증
- `SetProjectVisionCommand.execute()`에서 각 단계별 사용자 취소 시 조기 종료를 검증하고, 최종적으로 상태 저장 및 설정 업데이트가 올바르게 호출되는지 확인
- 기존 `generatePrompt.test.ts` 패턴을 재사용해, 새로운 테스트 파일에서도 일관된 mocking 스타일 유지

<!-- ERROR-EXPLORATION-START -->
**🔍 Error Exploration Procedure:**
1. **현상 파악**: 명령 레이어에 테스트가 없어 리팩토링 시 회귀 버그 발생 가능성 높음
2. **재현 단계**: 
   - `pnpm test` 실행 시 command 레이어 커버리지 확인
   - `UpdateReportsCommand`, `SetProjectVisionCommand`에 대한 테스트 파일 부재 확인
3. **근본 원인**: 초기 개발 시 서비스 레이어에 집중하여 명령 레이어 테스트 미구현
4. **해결 방안**: `generatePrompt.test.ts` 패턴 재사용하여 테스트 파일 생성
5. **검증 방법**: `pnpm test` 실행 후 모든 테스트 통과 및 커버리지 증가 확인
<!-- ERROR-EXPLORATION-END -->

**기대 효과:**
- 명령 레이어 리팩토링 시 회귀 버그를 조기에 발견
- UX에 직접적인 영향을 주는 오류(메시지 표시, 취소 플로우 등)를 자동화된 테스트로 검증
- 테스트 커버리지 약 10~15% 추가 향상 및 품질 지표 개선

**✅ Definition of Done:**
- [ ] `setProjectVision.test.ts` 생성 및 5개 이상 테스트 케이스 추가
- [ ] `updateReports.test.ts` 생성 및 5개 이상 테스트 케이스 추가
- [ ] `pnpm compile` 에러 없이 완료
- [ ] `pnpm test` 모든 테스트 통과
- [ ] 테스트 커버리지 85% 이상 유지
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🚀 코드 최적화 (OPT-1)
| 항목 | 내용 |
|------|------|
| **ID** | `opt-markdown-parse-001` |
| **카테고리** | 🚀 코드 최적화 |
| **영향 범위** | 품질 |
| **대상 파일** | `src/utils/markdownUtils.ts` |

**현재 상태:** `markdownUtils`는 마커 기반 섹션 추출/치환, 개선 항목 파싱, 점수 테이블 생성을 모두 담당하고 있습니다. 기능은 충실하지만, 하나의 유틸리티 모듈에 다양한 책임이 섞여 있어 테스트 관점에서 개별 기능의 경계를 이해하기 어렵고, 향후 파서 로직이 복잡해질수록 유지보수 난이도가 증가할 수 있습니다.

**최적화 내용:** 마커 처리(append/prepend/replaceBetweenMarkers)와 개선 항목/점수 테이블 도메인 로직을 내부적으로 분리하고, 순수 함수 중심으로 재구성합니다. 예를 들어 `markerUtils.ts`(마커 처리), `improvementParser.ts`(개선 항목 파싱), `scoreTableFormatter.ts`(점수 테이블 생성)처럼 역할별 서브 모듈로 구조를 나누되, 외부 공개 API는 `markdownUtils`에서 재export하여 기존 호출부는 그대로 유지합니다.

**예상 효과:**
- 성능: 로직 자체의 성능 변화는 크지 않지만, 단일 책임 원칙(SRP)을 적용함으로써 특정 기능만 교체/최적화하기 쉬워집니다.
- 품질: 각 책임이 분리되어 테스트 대상이 명확해지고, 파싱/포매팅 로직에 대한 단위 테스트를 촘촘히 작성하기 쉬워집니다.
**측정 가능한 지표:** 모듈 분리 전후의 파일 라인 수 감소, 함수당 평균 라인 수 감소, 개선 항목 파서 및 점수 테이블 생성 로직에 대한 테스트 커버리지(라인/브랜치 기준) 향상.

---

### ⚙️ 성능 튜닝 (OPT-2)
| 항목 | 내용 |
|------|------|
| **ID** | `opt-snapshot-diff-001` |
| **카테고리** | ⚙️ 성능 튜닝 |
| **영향 범위** | 성능 / 품질 |
| **대상 파일** | `src/services/workspaceScanner.ts`, `src/services/snapshotService.ts` |

**현재 상태:** WorkspaceScanner와 SnapshotService는 `maxFilesToScan`과 `excludePatterns`를 활용해 기본적인 성능을 확보하고 있지만, 대형 모노레포에서 자주 실행될 경우 동일한 파일 목록/설정 파일을 반복적으로 스캔하게 됩니다. Git diff 요약도 라인 수 기준 메트릭이 부족해 "변경 규모"를 정량적으로 판단하기 어렵습니다.

**최적화 내용:** 마지막 스캔 결과(파일 목록, 주요 설정 파일, Git 상태 요약)를 메모이제이션하거나, 간단한 캐시 구조를 도입해 짧은 시간 내 연속 실행 시 재사용하도록 개선합니다. 동시에 Git diff 요약에 변경 라인 수(added/removed/total)를 포함하고, SnapshotDiff 및 Summary에서 이 정보를 노출해 대규모 변경 여부를 한눈에 파악할 수 있게 합니다.

**예상 효과:**
- 성능: 대형 프로젝트에서 연속 실행 시 스캔 시간이 체감적으로 단축되고, 불필요한 파일 시스템 접근이 줄어듭니다.
- 품질: 변경량을 숫자로 표현함으로써, "큰 변경"이 발생한 세션을 Session History에서 빠르게 식별할 수 있습니다.
**측정 가능한 지표:** 동일 워크스페이스에서 연속 두 번 실행 시, 두 번째 실행의 스캔 시간 및 파일 시스템 호출 수 감소 비율, Git diff 요약에 포함된 라인 수 메트릭 활용 빈도.
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
