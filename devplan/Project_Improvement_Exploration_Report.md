# 🚀 프로젝트 개선 탐색 보고서

> 이 문서는 Vibe Coding Report VS Code 확장에서 자동으로 관리됩니다.  
> **미적용 개선 항목만 표시됩니다. 적용 완료된 항목은 자동으로 제외됩니다.**
> 
> 💡 **구체적인 구현 코드는 [Prompt.md](./Prompt.md) 파일을 참조하세요.**

---

<!-- AUTO-OVERVIEW-START -->
## 📋 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프로젝트명** | projectmanager (Vibe Coding Report VS Code 확장) |
| **버전** | v0.4.27 |
| **분석 기준일** | 2025-12-20 |
| **테스트/커버리지** | Vitest, Lines 73%+ (`pnpm -C vibereport-extension run test:coverage` 기준) |
| **발행자** | Stankjedi |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-ERROR-EXPLORATION-START -->
## 🔍 오류 및 리스크 탐색 절차

> 이 섹션은 개선 항목이 어떤 근거로 도출되었는지(신뢰 가능한 출처/과정)를 요약합니다.

### 1. 데이터 수집
- 로컬 검증 결과 확인: `compile`, `lint`, `test:run`, `test:coverage`.
- 커버리지 리포트로 미커버 영역(특히 엔트리/명령 분기) 확인.
- CI 설정 점검: `.github/workflows/ci.yml`의 pnpm 버전과 lockfileVersion 정합성 확인.
- 코드 스캔: Webview/프리뷰 렌더링의 문자열 기반 HTML 생성 경로, 정규식 기반 파서(포맷 의존) 확인.

### 2. 정적/구조 분석
- 보안: Webview(CSP) + 커스텀 렌더러의 이스케이프/allowlist 적용 범위 점검.
- 테스트: 커버리지(라인/브랜치)와 핵심 경로(activation/명령) 미커버 분기 점검.
- 유지보수성: Prompt.md 포맷 변형(헤딩 이모지 유무 등)에 대한 파싱 견고성 점검.

### 3. 개선 후보 정제
- 각 항목에 `Origin`(test-failure/build-error/static-analysis/manual-idea), `리스크 레벨`, `관련 평가 카테고리`를 부여했습니다.
- 이 문서에는 **현재 미적용(P1/P2/P3/OPT) 항목만** 유지합니다(완료 항목 기록/히스토리는 포함하지 않음).
<!-- AUTO-ERROR-EXPLORATION-END -->

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

> **기준일:** 2025-12-20  
> 아래 데이터는 코드 분석 및 로컬 테스트 결과에 기반하여 도출된 **미적용(Pending)** 항목입니다.

### 1. 우선순위별 대기 항목 수

| 우선순위 | 대기(Pending) | 주요 내용 |
|:---:|:---:|:---|
| 🔴 **긴급 (P1)** | 1 | 상태 파일 추적 정비(정보 노출/노이즈 방지). |
| 🟡 **중요 (P2)** | 3 | CI 자동 검증 활성화, 브랜치 커버리지 보강, 대형 서비스 모듈 분리. |
| 🟢 **개선 (P3)** | 1 | TODO/FIXME 스캔 기반 개선 후보 자동 생성(가시성/근거 강화). |
| ⚙️ **최적화 (OPT)** | 1 | 내용 동일 시 보고서 파일 write 스킵(I/O/변경 노이즈 감소). |
| **총계** | **6** | **모든 항목이 현재 대기 중입니다.** |

### 2. 전체 개선 항목 리스트

| # | 항목명 | 우선순위 | 카테고리 | ID |
|:---:|:---|:---:|:---|:---|
| 1 | 상태 파일 레포 추적 정비 (민감 정보/노이즈 제거) | P1 | 🔒 보안 | `security-statefile-tracking-001` |
| 2 | CI 워크플로우를 레포 루트로 정리하여 자동 검증 활성화 | P2 | 📦 배포/CI | `ci-workflow-location-001` |
| 3 | 브랜치 커버리지 보강 (예외/분기 경로 회귀 방지) | P2 | 🧪 테스트 | `test-branch-coverage-001` |
| 4 | reportService 모듈 분리 리팩토링 (대형 파일 축소) | P2 | 🧹 코드 품질 | `refactor-reportservice-modularize-001` |
| 5 | TODO/FIXME 스캔 기반 개선 후보 자동 생성 | P3 | ✨ 기능 추가 | `feat-todo-fixme-scan-001` |
| 6 | 내용 동일 시 보고서 파일 write 스킵 | OPT | 🚀 최적화 | `opt-report-write-skip-001` |
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 중요 (P1)

#### [P1-1] 상태 파일 레포 추적 정비 (민감 정보/노이즈 제거)

| 항목 | 내용 |
|------|------|
| **ID** | `security-statefile-tracking-001` |
| **카테고리** | 🔒 보안 |
| **복잡도** | Low |
| **대상 파일** | `.vscode/vibereport-state.json`, `.gitignore` |
| **Origin** | static-analysis |
| **리스크 레벨** | critical |
| **관련 평가 카테고리** | security, productionReadiness |

- **현재 상태:** `.vscode/vibereport-state.json`가 Git 추적 상태이며 로컬 경로/세션 요약/평가 히스토리가 포함됩니다.
- **문제점 (Problem):** 민감 정보 노출 + PR/커밋 노이즈 증가 + 협업 시 충돌 유발.
- **영향 (Impact):** 보안/컴플라이언스 리스크 및 개발 생산성 저하.
- **원인 (Cause):** 루트 `.gitignore`가 상태 파일/임시 파일을 제외하지 않습니다.
- **개선 내용 (Proposed Solution):** `git rm --cached`로 추적 해제 후 `.gitignore`에 상태 파일 패턴 추가(필요 시 샘플/스키마 파일 제공).
- **기대 효과:** 정보 노출 위험 감소, PR 노이즈/충돌 감소.

**✅ Definition of Done:**
- [ ] `.vscode/vibereport-state.json` 추적 해제 및 `.gitignore` 반영
- [ ] 로컬 실행 시 상태 파일은 유지되되 커밋에는 포함되지 않음
- [ ] 관련 문서에 “상태 파일은 추적하지 않음” 안내 추가(필요시)
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run test:run` 통과

---

### 🟡 중요 (P2)

#### [P2-1] CI 워크플로우를 레포 루트로 정리하여 자동 검증 활성화

| 항목 | 내용 |
|------|------|
| **ID** | `ci-workflow-location-001` |
| **카테고리** | 📦 배포/CI |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/.github/workflows/ci.yml`, `.github/workflows/ci.yml` |
| **Origin** | static-analysis |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | productionReadiness, testCoverage |

- **현재 상태:** CI 워크플로우 파일이 레포 루트가 아닌 하위 경로에 있어 GitHub Actions가 실행되지 않을 가능성이 큽니다.
- **문제점 (Problem):** 자동 검증이 누락되면 회귀가 릴리즈/배포 단계에서 늦게 발견될 수 있습니다.
- **영향 (Impact):** 배포 신뢰도 저하, 유지보수 비용 증가.
- **원인 (Cause):** GitHub Actions의 워크플로우 경로 규칙(레포 루트 `.github/workflows`) 미준수.
- **개선 내용 (Proposed Solution):** 워크플로우를 레포 루트로 이동/복제하고, `working-directory: vibereport-extension` 설정을 유지합니다.
- **기대 효과:** PR/푸시 시 자동 compile/lint/test/coverage로 품질 게이트 확보.

**✅ Definition of Done:**
- [ ] `.github/workflows/ci.yml`가 레포 루트에 존재하고 트리거가 동작
- [ ] `pnpm install --frozen-lockfile` + `compile/lint/test:run/test:coverage` 단계 수행
- [ ] 워크플로우 캐시 설정(`pnpm`/lockfile path) 정상
- [ ] 로컬에서도 동일 스크립트로 재현 가능

---

#### [P2-2] 브랜치 커버리지 보강 (예외/분기 경로 회귀 방지)

| 항목 | 내용 |
|------|------|
| **ID** | `test-branch-coverage-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/extension.ts`, `vibereport-extension/src/utils/htmlEscape.ts`, `vibereport-extension/src/utils/timeUtils.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | testCoverage, codeQuality |

- **현재 상태:** 커버리지 Lines 73.68% / Branch 54.10%로 분기/예외 경로 검증이 상대적으로 약합니다.
- **문제점 (Problem):** 오류 처리/분기 로직 회귀가 테스트에서 누락될 수 있습니다.
- **영향 (Impact):** 런타임 예외/엣지 케이스 버그의 발견 지연.
- **원인 (Cause):** VS Code API 경로, 유틸 분기 로직에 대한 케이스 설계 부족.
- **개선 내용 (Proposed Solution):** 저커버 영역(`extension.ts`, `htmlEscape`, `timeUtils` 등)에 분기 중심 테스트를 추가해 Branch ≥ 60%를 목표로 합니다.
- **기대 효과:** 회귀 탐지력 향상, 릴리즈 안정성 강화.

**✅ Definition of Done:**
- [ ] Branch 커버리지 60% 이상(또는 +5%p 이상) 달성
- [ ] 신규 테스트가 분기/예외 경로를 명확히 검증
- [ ] `pnpm -C vibereport-extension run test:run` 및 `test:coverage` 통과
- [ ] flaky/환경 의존 테스트 없이 재현 가능

---

#### [P2-3] reportService 모듈 분리 리팩토링 (대형 파일 축소)

| 항목 | 내용 |
|------|------|
| **ID** | `refactor-reportservice-modularize-001` |
| **카테고리** | 🧹 코드 품질 |
| **복잡도** | High |
| **대상 파일** | `vibereport-extension/src/services/reportService.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | maintainability, codeQuality |

- **현재 상태:** `reportService.ts`가 1600+ 라인으로 템플릿/업데이트/IO 책임이 과도하게 결합되어 있습니다.
- **문제점 (Problem):** 작은 변경도 영향 범위가 커지고, 리그레션 위험이 증가합니다.
- **영향 (Impact):** 유지보수 비용 증가, 리뷰 난이도 상승, 버그 수정 속도 저하.
- **원인 (Cause):** 템플릿 생성/마커 갱신/세션 기록 갱신 로직이 단일 클래스에 누적.
- **개선 내용 (Proposed Solution):** 템플릿/업데이트/IO 유틸을 단계적으로 분리(파일 단위 분할)하고, 외부 API는 유지합니다.
- **기대 효과:** 변경 영향 축소, 테스트 작성 용이, 장기 확장성 개선.

**✅ Definition of Done:**
- [ ] `reportService.ts`에서 핵심 책임을 분리한 모듈(신규 파일) 도입
- [ ] 기존 동작/출력 포맷이 유지(스냅샷/마커 기반 테스트 통과)
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run test:run` 통과
- [ ] 리팩토링 범위/의존성 변화가 문서화됨(간단 메모 수준)
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **중복 코드:** 보고서 생성/마커 갱신 흐름에서 유사한 문자열 처리·I/O 패턴이 반복됩니다.
- **타입 안정성 강화:** `unknown`/문자열 변환 중심 로직은 테스트 기반으로 분기 케이스를 보강할 여지가 있습니다.
- **복잡도:** 대형 파일(`reportService.ts` 1600+L, `updateReportsWorkflow.ts` 800+L 등)로 인해 변경 영향이 커질 수 있습니다.
- **에러 처리 일관성:** `try/catch` 후 로깅/사용자 메시지 처리의 표준화 여지가 있습니다.
- **I/O/비동기 효율:** 내용이 동일해도 보고서 파일 write가 발생하면 파일 워처/디스크 I/O를 불필요하게 유발합니다.

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] 내용 동일 시 보고서 파일 write 스킵 (I/O/노이즈 감소)

| 항목 | 내용 |
|------|------|
| **ID** | `opt-report-write-skip-001` |
| **카테고리** | 🚀 코드 최적화 |
| **영향 범위** | 성능 · 품질 |
| **대상 파일** | `vibereport-extension/src/services/reportService.ts` |

**현재 상태:**
- `updateEvaluationReport` / `updateImprovementReport`가 마커 갱신 후 **항상** `writeFile`을 수행합니다(내용 동일이어도 write).

**최적화 내용:**
- 기존 파일 내용을 읽어 변경 여부를 비교하고, 변경이 없으면 write를 생략합니다.
- write 생략 시 OutputChannel에 “skip write (no diff)” 로그를 남겨 디버깅 가능하게 합니다.

**예상 효과:**
- 디스크 I/O 및 파일 워처 이벤트 감소 → 자동 업데이트/확장 동작 안정화.
- Git 작업 시 불필요한 diff 노이즈 감소.

**측정 지표:**
- 변경 없는 상태에서 보고서 업데이트 후 `git diff`가 깨끗하게 유지되는지 확인.
- 동일 스냅샷 입력에서 write 횟수(또는 로그)가 0회인지 확인.
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] TODO/FIXME 스캔 기반 개선 후보 자동 생성

| 항목 | 내용 |
|------|------|
| **ID** | `feat-todo-fixme-scan-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/services/workspaceScanner.ts`, `vibereport-extension/src/services/reportService.ts`, `vibereport-extension/src/models/types.ts` |
| **Origin** | manual-idea |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | maintainability, codeQuality |

**기능 목적:**
- 코드에 남아있는 TODO/FIXME를 근거로 “미적용 개선 후보”를 자동 수집하여 개선 보고서의 신뢰도와 실행성을 높입니다.

**현재 상태:**
- 개선 탐색 절차에는 TODO/FIXME 스캔이 언급되지만, 실제 자동 추출 결과가 보고서에 포함되지 않습니다.

**제안 구현 전략:**
- 스캔 대상 확장자(ts/js/md 등)와 최대 파일/라인 제한을 두고, `TODO`/`FIXME` 패턴을 수집(파일/라인/요약)합니다.
- 결과를 개선 보고서에 요약 섹션(또는 P3 후보)으로 반영하고, Origin을 `static-analysis`로 기록합니다.

**기대 효과:**
- 개선 항목의 근거 강화(“어디에서 발견됐는지”가 명확), AI 프롬프트 생성 품질 향상.

**✅ Definition of Done:**
- [ ] 파일/라인 포함 TODO/FIXME 요약이 보고서에 생성됨(상한/필터 포함)
- [ ] exclude 패턴 및 성능 상한(최대 파일/라인) 준수
- [ ] 관련 테스트 추가 후 `pnpm -C vibereport-extension run test:run` 통과
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
