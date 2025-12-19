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
| **버전** | v0.4.17 |
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
| 🔴 긴급 (P1) | 1 | CI 파이프라인이 lockfile v9와 pnpm 8 불일치로 실패 |
| 🟡 중요 (P2) | 3 | 프리뷰 렌더링 보안 하드닝, Prompt 파싱 견고성, 핵심 엔트리 커버리지 강화 |
| 🟢 개선 (P3) | 1 | 평가 추이 버전 라벨을 git 기반으로 보강하여 비교 효용 향상 |
| ⚙️ OPT (최적화) | 1 | Settings 배치 저장에서 변경 없는 키 update 스킵으로 불필요 갱신 최소화 |
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
- `pnpm-lock.yaml`의 lockfileVersion이 `9.0`인데, CI는 pnpm 8을 사용해 `pnpm install` 단계에서 실패합니다.

**문제점 (Problem):**
- PR/배포 파이프라인에서 “테스트/커버리지 게이트”가 동작하지 않아 회귀 위험이 급증합니다.

**영향 (Impact):**
- 배포/릴리즈 안정성 저하, 리뷰 비용 증가, 품질 신뢰도 하락.

**원인 (Cause):**
- `.github/workflows/ci.yml`에 pnpm 버전이 8로 고정되어 있습니다.

**개선 내용 (Proposed Solution):**
- CI의 pnpm 버전을 9로 올려 lockfile(v9)과 정렬하고, `pnpm install --frozen-lockfile` 기준으로 통과를 보장합니다.

**기대 효과:**
- CI 복구로 품질 게이트 신뢰성 회복 및 회귀 방어 강화.

**✅ Definition of Done:**
- [ ] GitHub Actions에서 `pnpm install` 단계가 실패 없이 완료됨
- [ ] GitHub Actions에서 `compile/lint/test:run/test:coverage`가 모두 통과함
- [ ] lockfile 변경 없이(불필요 재생성 없이) 안정적으로 동작함

### 🟡 중요 (P2)

#### [P2-1] Open Report Preview 렌더링 이스케이프/링크 속성 하드닝

| 항목 | 내용 |
|------|------|
| **ID** | `security-openpreview-escape-001` |
| **카테고리** | 🔒 보안 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/openReportPreview.ts`, `vibereport-extension/src/utils/htmlEscape.ts`, `vibereport-extension/src/commands/__tests__/openReportPreview.test.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | security, productionReadiness, codeQuality |

**현재 상태:**
- 커스텀 렌더러에서 인라인 코드/링크 href가 충분히 이스케이프되지 않은 채 HTML로 출력됩니다.

**문제점 (Problem):**
- 악의적/비정상 입력에서 프리뷰가 깨지거나(XSS/DOM 오염 가능성 포함) 신뢰도가 저하됩니다.

**영향 (Impact):**
- 프리뷰/공유 기능 품질 저하, 보안 리스크 및 유지보수 비용 증가.

**원인 (Cause):**
- 문자열 템플릿 기반 HTML 생성에서 텍스트/속성 이스케이프가 전 경로에 강제되지 않습니다.

**개선 내용 (Proposed Solution):**
- 텍스트/속성 이스케이프 유틸을 정리하고, 링크/인라인 코드 렌더링 경로를 안전하게 변경합니다.
- 테스트로 “인라인 코드에 `<` 포함”, “href에 따옴표 포함” 케이스를 고정합니다.

**기대 효과:**
- 프리뷰 보안/안정성 향상 및 환경 드리프트 감소.

**✅ Definition of Done:**
- [ ] 렌더링 결과에서 텍스트/속성이 안전하게 이스케이프됨
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] `pnpm -C vibereport-extension run compile/lint/test:run` 통과

#### [P2-2] Prompt.md 체크리스트 파싱 견고성(이모지 유무 허용)

| 항목 | 내용 |
|------|------|
| **ID** | `quality-prompt-parse-001` |
| **카테고리** | 🧹 코드 품질 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/src/commands/generatePrompt.ts`, `vibereport-extension/src/services/reportService.ts`, `vibereport-extension/src/utils/reportDoctorUtils.ts`, `vibereport-extension/src/commands/__tests__/generatePrompt.test.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | maintainability, productionReadiness, codeQuality |

**현재 상태:**
- 일부 파서/정리 로직이 `## 📋 Execution Checklist` 헤딩에 강결합되어 포맷 변형(이모지 미포함 등)에서 실패할 수 있습니다.

**문제점 (Problem):**
- Prompt 선택/정리 기능이 Prompt.md 포맷에 민감해 “도구 체인 단절”이 발생합니다.

**개선 내용 (Proposed Solution):**
- 체크리스트 섹션 탐지 정규식을 “이모지 선택(optional)”로 통일하고, 테스트에서 두 형식을 모두 커버합니다.

**기대 효과:**
- Prompt.md 포맷 변경 허용범위 확대 및 유지보수성 향상.

**✅ Definition of Done:**
- [ ] 이모지 포함/미포함 헤딩 모두에서 파싱이 동작함
- [ ] 관련 테스트 통과
- [ ] 빌드/린트 에러 없음

#### [P2-3] 핵심 엔트리/명령 커버리지 강화(회귀 방어)

| 항목 | 내용 |
|------|------|
| **ID** | `test-coverage-extension-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/extension.ts`, `vibereport-extension/src/extension.test.ts`, `vibereport-extension/src/commands/openReportPreview.ts`, `vibereport-extension/src/commands/__tests__/openReportPreview.test.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | testCoverage, maintainability, productionReadiness |

**현재 상태:**
- 전체 커버리지(라인 73.5%, 브랜치 52.49%)는 양호하지만, `extension.ts`/일부 명령의 분기 경로가 상대적으로 미커버 상태입니다.

**문제점 (Problem):**
- 활성화/명령 등록/예외 분기에서 회귀가 발생해도 조기에 탐지되지 않을 수 있습니다.

**개선 내용 (Proposed Solution):**
- 활성화/명령 등록/에러 분기 등 “회귀 영향이 큰 경로”에 집중해 테스트를 보강합니다.

**기대 효과:**
- 회귀 방어 강화, 배포 신뢰도 향상.

**✅ Definition of Done:**
- [ ] 핵심 분기 테스트가 추가됨
- [ ] `pnpm -C vibereport-extension run test:coverage` 통과(임계치 만족)
- [ ] 빌드/린트 에러 없음

<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **중복 코드 및 유틸 추출:** nonce 생성/HTML 이스케이프 등 Webview 관련 유틸이 파일별로 분산되어 중복이 존재합니다.
- **타입 안정성 강화:** Webview 메시지 페이로드는 런타임 검증이 있으나 “변경된 키만 업데이트” 정책/타입 경계가 더 명확해질 여지가 있습니다.
- **복잡도 관리:** `openReportPreview`의 커스텀 렌더러는 문자열/정규식 기반으로 커져, 유지보수와 보안 대응이 어려워질 수 있습니다.
- **에러 처리 일관성:** 사용자 알림(show*)과 OutputChannel 로깅의 정책을 명확히 분리/표준화하면 진단성이 좋아집니다.
- **불필요한 연산/비효율:** Settings 저장 시 변경 없는 키까지 `config.update`가 호출되면 이벤트/갱신 비용이 누적됩니다.

### 🚀 코드 최적화 (OPT-1)

| 항목 | 내용 |
|------|------|
| **ID** | `opt-settings-skip-unchanged-001` |
| **카테고리** | 🚀 코드 최적화 |
| **영향 범위** | 성능/품질 |
| **대상 파일** | `vibereport-extension/src/views/SettingsViewProvider.ts`, `vibereport-extension/src/views/__tests__/SettingsViewProvider.test.ts` |

**현재 상태:**
- Settings 배치 저장 시, 실제 값이 바뀌지 않은 키도 `config.update`가 호출될 수 있습니다.

**최적화 내용:**
- 현재 config 값과 비교해 “변경된 키만” 업데이트하고, 성공 알림/`sendCurrentSettings()`는 1회 유지합니다.
- 테스트에서 “동일 값 저장 → update 호출 0회”를 검증합니다.

**예상 효과:**
- 불필요한 설정 업데이트/이벤트/갱신 감소로 UI 반응성과 안정성 개선.

**측정 지표:**
- 저장 1회당 `config.update` 호출 수(변경 키 수와 동일해야 함).
- 연속 저장/자동 업데이트 환경에서 갱신 이벤트 발생 빈도(로그/테스트로 확인).
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

> 새로운 기능을 추가하는 항목입니다.

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] 평가 추이 버전 라벨 개선(git 커밋 기반)

| 항목 | 내용 |
|------|------|
| **ID** | `feat-evalhistory-version-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/src/commands/updateReportsWorkflow.ts`, `vibereport-extension/src/services/workspaceScanner.ts`, `vibereport-extension/src/commands/__tests__/updateReports.test.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | maintainability, productionReadiness |

**기능 목적 / 사용자 가치:**
- 평가 추이의 버전 값이 `unknown`으로 기록될 때도, git 기반 라벨을 사용해 “어떤 시점의 품질”인지 비교 가능하게 합니다.

**현재 상태:**
- 분석 루트에 `package.json`이 없으면 `currentVersion`이 비어 평가 히스토리에 `unknown`이 저장됩니다.

**제안 구현 전략:**
- `packageJson.version`이 없을 때는 `gitInfo.lastCommitHash`(짧은 해시)와 브랜치를 조합한 라벨(e.g., `git:abc1234@main`)을 저장합니다.
- 평가 보고서의 추이 표에도 동일 라벨을 사용합니다.
- 테스트로 “packageJson.version 없음 + gitInfo 있음 → version 라벨 생성”을 고정합니다.

**기대 효과:**
- 추이 비교 가독성 향상, 회귀 시점 추적 비용 감소.

**✅ Definition of Done:**
- [ ] 평가 히스토리에 git 기반 버전 라벨이 저장됨
- [ ] 평가 보고서 추이 표에 동일 라벨이 출력됨
- [ ] 관련 테스트 통과 및 빌드/린트 에러 없음

<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
