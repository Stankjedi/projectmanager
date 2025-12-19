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
| **버전** | v0.4.24 |
| **분석 기준일** | 2025-12-19 |
| **테스트/커버리지** | Vitest 215개, Lines 73.5% (`pnpm -C vibereport-extension run test:coverage` 기준) |
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

> 기준: 2025-12-19 코드/설정 정적 리뷰 + 로컬 검증(`compile/lint/test:run/test:coverage`) 결과를 반영했습니다.
> 아래는 **현재 미적용(대기) 항목만** 포함합니다.

### 1. 현황 개요 (미적용 항목만 집계)

| 우선순위 | 미적용 개수 | 설명 |
|:---|:---:|:---|
| 🔴 긴급 (P1) | 1 | CI 파이프라인의 버전 불일치로 인한 배포/테스트 자동화 실패. |
| 🟡 중요 (P2) | 3 | 보안(프리뷰 XSS), 품질(파싱 견고성), 테스트(핵심 커버리지) 리스크. |
| 🟢 개선 (P3) | 1 | 평가 추이 비교 효용 증대를 위한 버전 라벨링 개선. |
| ⚙️ OPT (최적화) | 1 | 설정 저장 로직의 I/O 비효율 개선. |
| **총 미적용** | **6** | **P1 1개, P2 3개, P3 1개, OPT 1개** |

### 2. 항목별 분포 테이블 (검토 대기)

| # | 항목명 | 우선순위 | 카테고리 |
|:---:|:---|:---:|:---|
| 1 | **GitHub Actions pnpm 버전(lockfile v9) 정렬** (`ci-pnpm-version-001`) | P1 | 📦 배포/CI |
| 2 | **Open Report Preview 렌더링 이스케이프/링크 속성 하드닝** (`security-openpreview-escape-001`) | P2 | 🔒 보안 |
| 3 | **Prompt.md 체크리스트 파싱 견고성(이모지 유무 허용)** (`quality-prompt-parse-001`) | P2 | 🧹 코드 품질 |
| 4 | **핵심 엔트리/명령 커버리지 강화(회귀 방어)** (`test-coverage-extension-001`) | P2 | 🧪 테스트 |
| 5 | **평가 추이 버전 라벨 개선(git 커밋 기반)** (`feat-evalhistory-version-001`) | P3 | ✨ 기능 추가 |
| 6 | **Settings 배치 저장: 변경 없는 키 update 스킵** (`opt-settings-skip-unchanged-001`) | OPT | 🚀 최적화 |

### 3. 우선순위별 한줄 요약

- 🔴 **P1:** CI 실패(pnpm↔lockfile)를 즉시 해소해 테스트/커버리지 게이트를 복구합니다.
- 🟡 **P2:** 프리뷰 보안/도구 체인의 파싱 견고성/핵심 커버리지를 강화해 운영 리스크를 낮춥니다.
- 🟢 **P3:** 평가 추이의 비교 가독성을 개선해 품질 추세 분석의 효용을 높입니다.
- ⚙️ **OPT:** 불필요한 설정 업데이트로 인한 이벤트/갱신 비용을 최소화합니다.
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 중요 (P1)

#### [P1-1] GitHub Actions pnpm 버전(lockfile v9) 정렬

| 항목 | 내용 |
|------|------|
| **ID** | `ci-pnpm-version-001` |
| **카테고리** | 📦 배포/CI |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/.github/workflows/ci.yml`, `vibereport-extension/pnpm-lock.yaml` |
| **Origin** | build-error |
| **리스크 레벨** | critical |
| **관련 평가 카테고리** | productionReadiness, testCoverage |

**현재 상태:**
- `pnpm-lock.yaml`은 v9 버전으로 생성되었으나, GitHub Actions 워크플로우(`ci.yml`)는 `pnpm-action`에서 기본값(또는 v8)을 사용 중입니다.
- 이로 인해 CI 환경에서 `pnpm install` 단계가 실패하고 있습니다.

**문제점 (Problem):**
- PR이나 메인 브랜치 푸시 시 자동 테스트 및 린트 검사가 실행되지 않아, 깨진 코드가 병합될 위험이 매우 큽니다.

**영향 (Impact):**
- 품질 게이트 무력화로 인한 회귀 가능성 증가, 배포 신뢰도 하락.

**원인 (Cause):**
- 로컬 개발 환경(v9)과 CI 환경(v8 예상)의 pnpm 버전 불일치.

**개선 내용 (Proposed Solution):**
- `.github/workflows/ci.yml` 파일 내 `pnpm/action-setup` 단계에서 `version: 9`를 명시합니다.

**기대 효과:**
- CI 파이프라인 정상화 및 자동 테스트 게이트 복구.

**✅ Definition of Done:**
- [ ] GitHub Actions에서 `pnpm install` 성공
- [ ] `compile`/`test` 단계가 정상 실행 및 통과

---

### 🟡 중요 (P2)

#### [P2-1] Open Report Preview 렌더링 이스케이프/링크 속성 하드닝

| 항목 | 내용 |
|------|------|
| **ID** | `security-openpreview-escape-001` |
| **카테고리** | 🔒 보안 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/openReportPreview.ts`, `vibereport-extension/src/utils/htmlEscape.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | security |

**현재 상태:**
- 보고서 프리뷰를 위한 HTML 생성 시, 일부 사용자 입력(링크 제목, 인라인 코드)이 단순 문자열 치환으로 처리되어 이스케이프가 누락될 가능성이 있습니다.

**개선 내용 (Proposed Solution):**
- 모든 동적 삽입 데이터에 `escapeHtml` 유틸리티 적용을 강제하고, `target="_blank"` 속성 사용 시 `rel="noopener noreferrer"`를 자동 추가하도록 개선합니다.

**✅ Definition of Done:**
- [ ] 특수문자(`<`, `>`) 포함 시 올바르게 이스케이프 렌더링 확인
- [ ] 관련 테스트 케이스 추가

#### [P2-2] Prompt.md 체크리스트 파싱 견고성(이모지 유무 허용)

| 항목 | 내용 |
|------|------|
| **ID** | `quality-prompt-parse-001` |
| **카테고리** | 🧹 코드 품질 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/src/commands/generatePrompt.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | maintainability |

**문제점:**
- `## 📋 Execution Checklist` 헤더 파싱 시 이모지가 없으면 인식을 못 하는 정규식을 사용 중입니다.

**개선 내용:**
- 이모지 부분을 선택(Optional) 그룹으로 처리하는 정규식으로 변경하여 유연성을 확보합니다.

**✅ Definition of Done:**
- [ ] 이모지 없는 `## Execution Checklist` 헤더도 정상 파싱
- [ ] `generatePrompt` 기능 정상 동작 확인

#### [P2-3] 핵심 엔트리/명령 커버리지 강화(회귀 방어)

| 항목 | 내용 |
|------|------|
| **ID** | `test-coverage-extension-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/extension.ts`, `vibereport-extension/src/extension.test.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | testCoverage |

**문제점:**
- 확장의 진입점(`activate` 함수)과 주요 명령 등록 로직에 대한 테스트 케이스가 부족하여, 초기화 단계의 에러가 감지되지 않을 수 있습니다.

**개선 내용:**
- `extension.test.ts`에 활성화 시나리오 및 예외 처리 테스트를 추가하여 커버리지를 높입니다.

**✅ Definition of Done:**
- [ ] `activate` 함수 예외 처리 테스트 추가
- [ ] 전체 커버리지 소폭 상승 확인
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **설정(Settings) 저장 최적화:** `Configuration.update` 호출은 디스크 I/O를 유발하므로, 실제 값이 변경되었을 때만 호출해야 합니다. 현재 대량 저장(`saveAll`) 시 이 검사가 누락된 부분이 있습니다.
- **불필요한 리렌더링:** `HistoryViewProvider` 등에서 데이터 변경이 없어도 `refresh()`가 호출되는 경로가 있어 최적화 여지가 있습니다.
- **문자열 처리:** 대규모 보고서 생성 시 템플릿 리터럴 병합이 많아, 메모리 효율을 위해 스트림 방식 도입을 장기적으로 고려할 수 있습니다.

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] Settings 배치 저장: 변경 없는 키 update 스킵

| 항목 | 내용 |
|------|------|
| **ID** | `opt-settings-skip-unchanged-001` |
| **카테고리** | 🚀 코드 최적화 |
| **영향 범위** | 성능 |
| **대상 파일** | `vibereport-extension/src/views/SettingsViewProvider.ts` |

**현재 상태:**
- 설정 뷰에서 "Save All" 실행 시, 폼에 있는 모든 키에 대해 순차적으로 `config.update()`를 호출합니다.

**최적화 내용:**
- `inspect()` 등을 통해 현재 설정 값을 확인하고, 입력된 값과 다를 경우에만 업데이트를 수행하도록 로직을 개선합니다.

**예상 효과:**
- 불필요한 `settings.json` 쓰기 작업 방지 및 확장 설정 변경 이벤트 트리거 최소화.

**측정 지표:**
- 저장 버튼 클릭 시 `Configuration.update` 호출 횟수 (변경 키 수와 일치해야 함).
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] 평가 추이 버전 라벨 개선(git 커밋 기반)

| 항목 | 내용 |
|------|------|
| **ID** | `feat-evalhistory-version-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/src/commands/updateReportsWorkflow.ts`, `vibereport-extension/src/services/workspaceScanner.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | maintainability |

**기능 목적:**
- `package.json`이 없는 프로젝트에서도 평가 히스토리에 의미 있는 버전 정보(Git Short Hash 등)를 남겨 추적을 용이하게 합니다.

**현재 상태:**
- `package.json` 버전이 없으면 `unknown`으로 기록되어, 시점별 변화를 파악하기 어렵습니다.

**제안 구현 전략:**
- `WorkspaceScanner`에서 수집된 Git 정보가 있다면 `git:a1b2c3d` 형식의 라벨을 우선 사용하도록 대체 로직을 추가합니다.

**기대 효과:**
- 평가 추이 표의 가독성 향상 및 버전 관리 효율 증대.

**✅ Definition of Done:**
- [ ] 버전 정보 없을 시 Git 해시 기반 라벨 생성 확인
- [ ] 평가 히스토리 저장 및 로딩 시 라벨 정상 표시
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
