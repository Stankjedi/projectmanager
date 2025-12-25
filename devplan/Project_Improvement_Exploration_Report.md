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
| **버전** | v0.4.33 |
| **분석 기준일** | 2025-12-24 |
| **로컬 검증(본 환경)** | `pnpm -C vibereport-extension run compile`/`lint` 통과. `test:run`은 `docsConsistency`에서 `CHANGELOG.md`/`README.md` 버전 불일치(0.4.32 ↔ 0.4.33)로 실패 |
| **테스트/커버리지** | CI에서 `test:run`/`test:coverage` 실행. (최근 산출물 기준 statements 86.76% / branches 71.12% / functions 85.45% / lines 88.42%) |
| **발행자** | Stankjedi |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-ERROR-EXPLORATION-START -->
## 🔍 오류 및 리스크 탐색 절차

> 이 섹션은 개선 항목이 어떤 근거로 도출되었는지(신뢰 가능한 출처/과정)를 요약합니다.

### 1. 데이터 수집
- 로컬 실행: `pnpm -C vibereport-extension run compile`/`lint` 통과.
- 테스트 결과: `pnpm -C vibereport-extension run test:run` 실패 — `docsConsistency.test.ts`에서 package.json(0.4.33) ↔ CHANGELOG/README(0.4.32) 불일치 감지.
- CI 설정 점검: `.github/workflows/ci.yml`(ubuntu-latest, Node 20, pnpm 9, compile/lint/test/coverage 실행) 확인.
- 커버리지 산출물 확인: `vibereport-extension/coverage/`(html/json) 기반으로 statements/branches/functions/lines 현재 수준 확인.
- 문자열 스캔: README/CHANGELOG/확장 README에 `0.4.32` 잔존 여부 확인(릴리즈/설치 안내 신뢰도 점검).

### 2. 정적/구조 분석
- 릴리즈 무결성: 문서 버전 불일치가 테스트로 강제되므로, “버전 bump 후 문서 동기화 누락”이 즉시 CI 차단 요인이 됩니다.
- 운영 자동화 여지: Report Doctor가 DOCS_VERSION_MISMATCH를 감지하지만 자동 수정은 제공하지 않아, 반복 실수/운영 비용 증가 여지가 있습니다.
- 품질 게이트 강도: `vitest.config.ts` coverage thresholds가 현재 커버리지 수준 대비 낮아, 향후 회귀가 발생해도 테스트가 통과할 수 있습니다(기준선 상향 권장).

### 3. 개선 후보 정제
- 각 항목에 `Origin`(test-failure/build-error/static-analysis/manual-idea), `리스크 레벨`, `관련 평가 카테고리`를 부여했습니다.
- 이 문서에는 **현재 미적용(P1/P2/P3/OPT) 항목만** 유지합니다(완료 항목 기록/히스토리는 포함하지 않음).
<!-- AUTO-ERROR-EXPLORATION-END -->

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

> **기준일:** 2025-12-24  
> 아래 데이터는 현재 코드/설정 분석 및 로컬 실행 관찰(가능 범위) 기반으로 도출된 **미적용(Pending)** 항목입니다(완료 히스토리는 `Session_History.md`에서 관리).

### 1. 우선순위별 대기 항목 수

| 우선순위 | 대기(Pending) | 주요 내용 |
|:---:|:---:|:---|
| 🔴 **긴급 (P1)** | 1 | CHANGELOG/README 버전 정합성 복구로 `docsConsistency` 테스트/CI 차단 해소. |
| 🟡 **중요 (P2)** | 1 | 확장 README 설치/릴리즈 안내를 v0.4.33 기준으로 갱신(사용자 혼선 최소화). |
| 🟢 **개선 (P3)** | 1 | Report Doctor에서 DOCS_VERSION_MISMATCH “자동 수정” 액션 제공. |
| ⚙️ **최적화 (OPT)** | 1 | 커버리지 thresholds 상향으로 품질 게이트 강화(회귀 탐지력 개선). |
| **총계** | **4** | **모든 항목은 현재 대기 중입니다(미적용 항목만 유지).** |

### 2. 전체 개선 항목 리스트

| # | 항목명 | 우선순위 | 카테고리 | ID |
|:---:|:---|:---:|:---|:---|
| 1 | CHANGELOG/README 버전 정합성 복구(테스트/CI 차단 해소) | P1 | 📦 배포/📚 문서 | `docs-version-sync-001` |
| 2 | 확장 README 설치/릴리즈 안내 v0.4.33 기준 갱신 | P2 | 📚 문서/📦 배포 | `docs-extension-readme-version-001` |
| 3 | Report Doctor: 문서 버전 불일치 자동 수정 액션 추가 | P3 | ✨ 기능 추가 | `feat-doctor-docs-autofix-001` |
| 4 | 커버리지 thresholds 상향(현재 수준 기준 품질 게이트 강화) | OPT | 🚀 최적화/🧪 테스트 | `opt-coverage-thresholds-001` |
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 중요 (P1)

#### [P1-1] CHANGELOG/README 버전 정합성 복구(테스트/CI 차단 해소)

| 항목 | 내용 |
|------|------|
| **ID** | `docs-version-sync-001` |
| **카테고리** | 📦 배포 / 📚 문서 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/package.json`, `vibereport-extension/CHANGELOG.md`, `README.md`, `vibereport-extension/src/docsConsistency.test.ts` |
| **Origin** | test-failure |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | productionReadiness, documentation |

- **현재 상태:** `vibereport-extension/package.json` 버전은 0.4.33이지만, `CHANGELOG.md`/루트 `README.md`는 0.4.32를 가리켜 `docsConsistency` 테스트가 실패합니다.
- **문제점 (Problem):** 릴리즈 버전 bump 후 문서 동기화 누락이 품질 게이트(test/CI)를 차단합니다.
- **영향 (Impact):** CI 실패로 병합/릴리즈 지연, 사용자/기여자 혼선 증가.
- **원인 (Cause):** 버전 업데이트가 코드(package.json)와 문서(CHANGELOG/README)에 동일하게 반영되지 않았습니다.
- **개선 내용 (Proposed Solution):** CHANGELOG 최상단 버전 헤더를 0.4.33으로 갱신하고, 루트 README의 버전 문자열/설치 예시(필요 시)도 0.4.33으로 동기화하여 `docsConsistency` 테스트를 통과시킵니다.
- **기대 효과:** 테스트/CI 차단 해소, 릴리즈 문서 신뢰도 회복, 배포/온보딩 혼선 감소.

**✅ Definition of Done:**
- [ ] `vibereport-extension/CHANGELOG.md` 최상단 버전이 0.4.33과 일치
- [ ] 루트 `README.md` 버전 문자열이 0.4.33과 일치
- [ ] `pnpm -C vibereport-extension run test:run` 통과
- [ ] (권장) `pnpm -C vibereport-extension run test:coverage` 통과

---

### 🟡 중요 (P2)

#### [P2-1] 확장 README 설치/릴리즈 안내 v0.4.33 기준 갱신

| 항목 | 내용 |
|------|------|
| **ID** | `docs-extension-readme-version-001` |
| **카테고리** | 📚 문서 / 📦 배포 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/README.md`, `README.md`, `vibereport-extension/CHANGELOG.md` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | documentation, productionReadiness, usability |

- **현재 상태:** 확장 README의 버전 배지/설치 명령/릴리즈 URL에 0.4.32가 잔존합니다.
- **문제점 (Problem):** 실제 패키지 버전과 문서의 설치 안내가 불일치하면 사용자가 잘못된 vsix를 설치하거나 릴리즈 링크를 따라갈 수 있습니다.
- **영향 (Impact):** 지원/온보딩 비용 증가, 사용자 신뢰도 하락.
- **원인 (Cause):** 문서 내 버전 문자열이 단일 소스(패키지 버전)와 연동되지 않아 수동 갱신 누락이 발생합니다.
- **개선 내용 (Proposed Solution):** `vibereport-extension/README.md`의 버전 배지/릴리즈 안내/설치 예시를 0.4.33 기준으로 갱신하고, 루트 README의 설치 예시도 동일 기준으로 정리합니다.
- **기대 효과:** 설치/업데이트 동선 명확화, 사용자 혼선 및 지원 비용 감소.

**✅ Definition of Done:**
- [ ] `vibereport-extension/README.md` 내 버전/URL/파일명 예시가 0.4.33 기준으로 정리됨
- [ ] (필요 시) 루트 `README.md`의 설치 예시도 동일 기준으로 갱신됨
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run lint` 통과
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **품질 게이트 강도:** 커버리지 thresholds는 프로젝트가 허용하는 “최소 품질”을 정의하므로, 현재 수준과 괴리가 크면 회귀를 놓칠 수 있습니다.
- **회귀 탐지 효율:** thresholds를 실제 커버리지 근처(여유 버퍼 포함)로 조정하면, 품질 회귀를 빠르게 차단할 수 있습니다.
- **측정 가능성:** `test:coverage` 결과를 기준선으로 두고, 상향 기준/예외 기준(예: -3%p 이내)을 명확히 하면 운영이 단순해집니다.
- **개발자 경험:** 회귀가 발생했을 때 어디가 떨어졌는지(요약/디렉터리/파일) 힌트가 명확하면 수정 시간이 줄어듭니다.
- **부작용 관리:** thresholds 상향은 “의도치 않은 큰 diff”를 유발할 수 있어, 1회 기준선 고정 후 점진 상향이 안전합니다.

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] 커버리지 thresholds 상향(품질 게이트 강화)

| 항목 | 내용 |
|------|------|
| **ID** | `opt-coverage-thresholds-001` |
| **카테고리** | 🚀 코드 최적화 / 🧪 테스트 |
| **영향 범위** | 품질 |
| **대상 파일** | `vibereport-extension/vitest.config.ts` |

**현재 상태:**
- `vitest.config.ts`의 coverage thresholds가 statements 66 / branches 45 / functions 60 / lines 67로 설정되어, 현재 커버리지(약 86/71/85/88) 대비 여유가 큽니다.
- 결과적으로 커버리지가 상당히 감소해도 테스트가 통과할 수 있어, 품질 게이트로서의 신호가 약해질 수 있습니다.

**최적화 내용:**
- `pnpm -C vibereport-extension run test:coverage` 결과를 기준으로, thresholds를 “현재 값 - 안전 버퍼(예: 3~5%p)”로 상향합니다.
- lines threshold는 실제 coverage 출력값을 확인해 안전하게 산정합니다(회귀 탐지력과 false negative/positive 균형 유지).

**예상 효과:**
- 품질 회귀 조기 차단, 리뷰/병합 단계에서 테스트의 신호(value) 상승, 장기 유지보수 비용 감소.

**측정 지표:**
- (필수) `pnpm -C vibereport-extension run test:coverage` 통과
- (권장) thresholds 상향 전/후 커버리지 요약(%) 기록
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] Report Doctor: 문서 버전 불일치 자동 수정 액션 추가

| 항목 | 내용 |
|------|------|
| **ID** | `feat-doctor-docs-autofix-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/reportDoctor.ts`, `vibereport-extension/src/utils/reportDoctorUtils.ts`, `vibereport-extension/src/commands/__tests__/reportDoctor.test.ts`, `vibereport-extension/CHANGELOG.md`, `README.md` |
| **Origin** | manual-idea |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | productionReadiness, documentation, usability |

**기능 목적:**
- Doctor가 감지한 DOCS_VERSION_MISMATCH(CHANGELOG/README 버전 불일치)를 VS Code 내에서 1회 클릭으로 수정하여, 릴리즈/병합 차단을 빠르게 해소합니다.

**현재 상태:**
- Doctor는 불일치를 감지하고 “Open Docs” 안내는 제공하지만, 자동 수정은 제공하지 않습니다(수동 수정 필요).

**제안 구현 전략:**
- docsIssues가 존재할 때 Warning modal에 `Fix Docs Versions`(또는 `Sync Docs Versions`) 액션을 추가합니다.
- package.json 버전(예: 0.4.33)을 기준으로:
  - `vibereport-extension/CHANGELOG.md` 최상단 `## [x.y.z]` 헤더를 최신 버전으로 갱신
  - 루트 `README.md`의 첫 버전 문자열을 최신 버전으로 갱신
  - *(선택)* `vibereport-extension/README.md`의 버전 배지/예시도 함께 갱신
- 수정 결과(변경된 파일/요약)를 OutputChannel에 기록하고, 실패 시 안전하게 중단합니다.
- 단위 테스트로 액션 노출/실행/파일 내용 갱신을 검증합니다.

**기대 효과:**
- 릴리즈/병합 차단 해소 시간 단축, 반복 실수 감소, 운영 자동화 강화.

**✅ Definition of Done:**
- [ ] Doctor에서 docs mismatch 발견 시 “Fix Docs Versions” 액션이 노출됨
- [ ] 실행 시 CHANGELOG/README 버전이 package.json과 일치하도록 수정됨
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run lint` 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
