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
| **버전** | v0.4.32 |
| **분석 기준일** | 2025-12-24 |
| **로컬 검증(본 환경)** | `pnpm -C vibereport-extension run compile`/`lint` 통과. `test:run`은 WSL(`/mnt/c`)에서 preflight가 Rollup native 모듈 누락을 감지해 중단됨(환경 이슈) |
| **테스트/커버리지** | CI에서 `test:run`/`test:coverage` 실행. (최근 산출물 기준 statements 86.75% / branches 71.11% / functions 85.44% / lines 88.41%) |
| **발행자** | Stankjedi |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-ERROR-EXPLORATION-START -->
## 🔍 오류 및 리스크 탐색 절차

> 이 섹션은 개선 항목이 어떤 근거로 도출되었는지(신뢰 가능한 출처/과정)를 요약합니다.

### 1. 데이터 수집
- 로컬 실행 관찰: `pnpm -C vibereport-extension run compile`/`lint` 통과. `test:run`은 WSL(`/mnt/c`)에서 preflight가 Rollup native 모듈 누락을 감지해 중단됨(환경 이슈 → 로컬 회귀 검증 리스크).
- CI 설정 점검: `.github/workflows/ci.yml`(ubuntu-latest, Node 20, pnpm 9, compile/lint/test/coverage 실행) 확인.
- 커버리지 산출물 확인: `vibereport-extension/coverage/index.html` 총계(statements/branches/functions/lines)로 현재 수준 파악.
- 코드/설정 점검: Report Doctor 관리 섹션 커버리지, `.gitattributes` 정책 적용 여부, WSL preflight 경로 판별 범위, 적용 완료 항목 클린업(정규식 기반) 성능 경로를 점검.

### 2. 정적/구조 분석
- 운영 안전망: `src/utils/reportDoctorUtils.ts`의 관리 섹션 정의가 일부 마커(TL;DR/리스크/점수 매핑/요약/Feature List 등)를 누락할 수 있어, 손상된 보고서가 “정상”으로 오진될 여지가 있음.
- 협업 노이즈: Windows/WSL 혼용 시 CRLF/LF 혼재 가능(README 등)로 diff/스냅샷 노이즈가 증가할 수 있음.
- 테스트 DX: `scripts/preflightTestEnv.js`가 WSL 마운트 경로를 제한적으로 판별(`/mnt/c` 중심)하여, 유사 환경에서 진단 누락 가능성이 있음.
- 성능 여지: Prompt/개선 항목 수가 커질수록 “적용 완료 항목 정리(cleanup)”의 정규식 기반 전역 치환 비용이 체감 성능 이슈로 이어질 수 있음.

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
| 🔴 **긴급 (P1)** | 1 | Report Doctor의 검증/복구 커버리지 확장(운영 안전망 보강). |
| 🟡 **중요 (P2)** | 2 | 라인 엔딩 정책 확정/renormalize, WSL preflight 경로 판별 범위 보강. |
| 🟢 **개선 (P3)** | 1 | VS Code 명령으로 TROUBLESHOOTING 문서 즉시 열기(온보딩/지원 동선 단축). |
| ⚙️ **최적화 (OPT)** | 1 | Prompt/백로그 규모 증가 시 적용 완료 항목 클린업 성능 최적화. |
| **총계** | **5** | **모든 항목은 현재 대기 중입니다(미적용 항목만 유지).** |

### 2. 전체 개선 항목 리스트

| # | 항목명 | 우선순위 | 카테고리 | ID |
|:---:|:---|:---:|:---|:---|
| 1 | Report Doctor 관리 섹션 커버리지 확장(검증/복구) | P1 | 🧪 테스트/운영 | `doctor-sections-001` |
| 2 | 라인 엔딩 표준화 및 renormalize 적용 | P2 | 📦 배포/🧹 코드 품질 | `dev-eol-standardize-001` |
| 3 | WSL preflight 마운트 경로 판별 범위 보강(`/mnt/*`) | P2 | 🧪 테스트 | `dev-preflight-wsl-mount-001` |
| 4 | VS Code 명령: TROUBLESHOOTING 문서 열기 | P3 | ✨ 기능 추가 | `feat-open-troubleshooting-001` |
| 5 | 적용 완료 항목 클린업 성능 최적화 | OPT | 🚀 최적화 | `opt-applied-cleanup-perf-001` |
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 중요 (P1)

#### [P1-1] Report Doctor 관리 섹션 커버리지 확장(검증/복구)

| 항목 | 내용 |
|------|------|
| **ID** | `doctor-sections-001` |
| **카테고리** | 🧪 테스트 / 🧩 운영 안정성 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/utils/reportDoctorUtils.ts`, `vibereport-extension/src/utils/markdownUtils.ts`, `vibereport-extension/src/services/reportTemplates.ts`, `vibereport-extension/src/utils/__tests__/reportDoctorUtils.test.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | productionReadiness, documentation, maintainability, errorHandling |

- **현재 상태:** Report Doctor는 일부 자동 섹션만 관리 대상으로 정의되어 있어, 평가/개선 보고서에 존재하는 자동 섹션(TL;DR/리스크/점수-개선 매핑/현재 상태 요약/Feature List 등)의 손상·누락이 감지되지 않을 수 있습니다.
- **문제점 (Problem):** 마커 손상/누락이 발생해도 Doctor가 문제를 탐지하지 못하면, 복구 플로우(Repair)가 트리거되지 않아 “손상된 보고서”가 누적될 수 있습니다.
- **영향 (Impact):** 보고서 자동 갱신 신뢰도 저하, 운영 문서 품질 게이트 약화, AI 실행 프롬프트 생성 흐름의 안정성 저하.
- **원인 (Cause):** `reportDoctorUtils.ts`의 관리 섹션 정의가 실제 자동 관리 마커(MARKERS)와 정합되지 않아, 누락된 섹션이 검증 대상에서 빠집니다.
- **개선 내용 (Proposed Solution):** (1) 평가 보고서: TL;DR/리스크/점수-개선 매핑/현재 상태 요약 섹션을 관리 대상으로 추가 (2) 개선 보고서: Overview/Feature List 섹션을 관리 대상으로 추가 (3) 마커 검증/복구 테스트를 보강하여 누락/중복/순서 오류가 일관되게 탐지·복구되도록 합니다.
- **기대 효과:** 손상 조기 탐지/복구를 통한 운영 안정성 향상, Report Doctor 신뢰도 상승, 보고서 파이프라인 회귀 리스크 감소.

**✅ Definition of Done:**
- [ ] 주요 코드 리팩토링 및 구현 완료
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음
- [ ] Repair 실행 시 누락 섹션이 템플릿 기반으로 복구됨

---

### 🟡 중요 (P2)

#### [P2-1] 라인 엔딩 표준화 및 renormalize 적용

| 항목 | 내용 |
|------|------|
| **ID** | `dev-eol-standardize-001` |
| **카테고리** | 📦 배포 / 🧹 코드 품질 |
| **복잡도** | Low |
| **대상 파일** | `.gitattributes`, `vibereport-extension/.gitattributes`, `README.md`, `vibereport-extension/README.md`, `vibereport-extension/TROUBLESHOOTING.md` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | documentation, productionReadiness, maintainability |

- **현재 상태:** Windows/WSL 혼용 환경에서 라인 엔딩(CRLF/LF)이 혼재할 수 있고, diff/스냅샷 노이즈가 커질 가능성이 있습니다(특히 문서 파일).
- **문제점 (Problem):** 의미 없는 라인 엔딩 변경이 리뷰/세션 diff/보고서 갱신 결과에 섞여 운영 비용을 증가시킵니다.
- **영향 (Impact):** 리뷰/머지 비용 증가, 스냅샷 비교 신뢰도 저하, 협업 경험 악화.
- **원인 (Cause):** `.gitattributes` 정책이 없거나(또는 미적용/미추적) 기존 파일에 renormalize가 적용되지 않아 “정책은 있어도 실제 파일은 혼재” 상태가 될 수 있습니다.
- **개선 내용 (Proposed Solution):** `.gitattributes`에 `* text=auto eol=lf` 기반 정책을 확정하고, 바이너리/Windows 스크립트 예외를 명시한 뒤 `git add --renormalize .`로 일괄 적용합니다(의미 변경 없이 라인 엔딩만 정리).
- **기대 효과:** 크로스플랫폼 협업 노이즈 감소, 보고서/스냅샷 변경량 안정화.

**✅ Definition of Done:**
- [ ] 주요 코드/설정 변경 완료
- [ ] `git add --renormalize .` 적용 후 diff가 라인 엔딩 정리에 한정됨
- [ ] `git diff --check`에서 공백/엔딩 관련 경고 없음
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run lint` 통과

---

#### [P2-2] WSL preflight 마운트 경로 판별 범위 보강(`/mnt/*`)

| 항목 | 내용 |
|------|------|
| **ID** | `dev-preflight-wsl-mount-001` |
| **카테고리** | 🧪 테스트 / 🧰 개발자 경험 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/scripts/preflightTestEnv.js`, `vibereport-extension/src/scripts/__tests__/preflightTestEnv.test.ts`, `vibereport-extension/TROUBLESHOOTING.md` |
| **Origin** | test-failure |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | testCoverage, productionReadiness, maintainability |

- **현재 상태:** WSL에서 마운트된 Windows 드라이브 경로 판별이 제한적(`/mnt/c` 중심)일 수 있어, 유사 환경에서 진단 메시지가 누락될 수 있습니다.
- **문제점 (Problem):** Rollup native 모듈 누락과 같은 환경 이슈가 발생해도 사전 진단이 동작하지 않으면, 개발자는 원인 파악에 불필요한 시간을 소모합니다.
- **영향 (Impact):** 로컬 회귀 검증 지연, 신규 기여자 온보딩 비용 증가, “테스트가 안 된다”는 지원 요청 증가.
- **원인 (Cause):** `isWslMountedPath()`의 경로 패턴이 드라이브 문자/다른 마운트 케이스를 포괄하지 못합니다.
- **개선 내용 (Proposed Solution):** (1) `/mnt/<drive-letter>/...` 패턴을 포괄하도록 판별 로직을 확장하고 (2) 관련 단위 테스트를 추가/보강하며 (3) TROUBLESHOOTING의 예시 경로를 `/mnt/*`로 일반화합니다.
- **기대 효과:** 환경 이슈 조기 진단율 상승, 테스트 실행 실패 시 안내 품질 개선, DX 향상.

**✅ Definition of Done:**
- [ ] 주요 코드 수정 및 구현 완료
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음
- [ ] 문서(TROUBLESHOOTING) 예시/가이드가 경로 일반화를 반영함
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **중복 코드 및 유틸 추출:** Prompt/개선 항목 파싱·필터링·클린업 로직은 누적될수록 중복/복잡도가 증가하기 쉬움.
- **타입 안정성 강화:** string 기반 파싱(정규식/마크다운 테이블)은 입력 변동에 취약하므로 계약을 테스트로 고정하는 것이 중요함.
- **복잡한 처리 경로:** 장시간 워크플로우/정규식 반복 처리처럼 “입력 크기”에 비례해 비용이 커지는 구간은 체감 성능 이슈로 연결될 수 있음.
- **에러 처리 일관성:** 사용자가 취소/중단했을 때(또는 I/O 실패 시) 메시지/로그가 일관되면 운영 피로도가 크게 줄어듦.
- **불필요한 연산:** 대형 문서에서 매번 전체 문자열을 반복 스캔하는 패턴은 성능 병목이 되기 쉬움(특히 Prompt.md가 길어질 때).

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] 적용 완료 항목 클린업 성능 최적화 (Prompt/개선 보고서)

| 항목 | 내용 |
|------|------|
| **ID** | `opt-applied-cleanup-perf-001` |
| **카테고리** | 🚀 코드 최적화 |
| **영향 범위** | 성능/품질 |
| **대상 파일** | `vibereport-extension/src/services/reportService.ts` |

**현재 상태:**
- 적용 완료 항목 제거 로직이 문서 전체에 대해 여러 차례 정규식 전역 치환(섹션 제거, 체크리스트 정리, 공백/구분선 정리)을 수행합니다.
- 현재 구현은 ID/제목 패턴을 그룹화해 패스 수를 일부 줄였지만, Prompt/개선 항목이 누적되어 문서가 길어질수록(수십~수백 항목) 체감 지연이 발생할 수 있습니다.

**최적화 내용:**
- (1) 제거 대상(ID/제목)을 사전 컴파일한 단일/소수의 패턴으로 묶거나 (2) 체크리스트/섹션을 한 번 파싱해 재구성하는 방식으로 “전체 문자열 반복 스캔”을 줄입니다.
- 제거 후 공백/구분선 정리 단계도 최소화하여 불필요한 문자열 재생성을 줄입니다.
- 기능 동작은 동일하게 유지(제거 규칙/링크화/요약 갱신 등), 성능만 개선합니다.

**예상 효과:**
- 대형 Prompt.md/개선 보고서에서 클린업 시간 감소, 실행 UX 개선, 자동 업데이트 시 체감 지연 감소.

**측정 지표:**
- (실측) 50/100/200개 항목 규모의 Prompt.md에서 클린업 실행 시간 전/후 비교
- (간접) Update Reports/cleanup 단계의 진행 메시지 체감 개선
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] VS Code 명령: TROUBLESHOOTING 문서 열기

| 항목 | 내용 |
|------|------|
| **ID** | `feat-open-troubleshooting-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/package.json`, `vibereport-extension/src/commands/openTroubleshooting.ts` *(신규)*, `vibereport-extension/src/commands/index.ts`, `vibereport-extension/src/extension.ts`, `vibereport-extension/TROUBLESHOOTING.md` |
| **Origin** | manual-idea |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | documentation, productionReadiness, usability |

**기능 목적:**
- WSL/pnpm/테스트 환경 등 개발 중 자주 발생하는 이슈에 대해, TROUBLESHOOTING 문서를 Command Palette에서 즉시 열어 지원/온보딩 동선을 단축합니다.

**현재 상태:**
- `vibereport-extension/TROUBLESHOOTING.md` 문서는 존재하지만, 사용자가 파일 트리/링크를 통해 찾아야 하므로 “문제가 발생했을 때” 접근 동선이 길어질 수 있습니다.

**제안 구현 전략:**
- Command Palette에서 실행 가능한 `vibereport.openTroubleshooting` 명령을 추가합니다.
- 실행 시 확장 설치 경로(`context.extensionUri`) 기준으로 `TROUBLESHOOTING.md`를 열고, 실패 시 사용자에게 명확한 안내(파일 누락/권한 문제 등)를 제공합니다.
- (선택) Settings View/요약 뷰에 “Troubleshooting 열기” 링크를 추가하여 UI에서도 접근 가능하게 합니다.

**기대 효과:**
- 환경 이슈 대응 시간 단축, 신규 기여자 온보딩 비용 감소, 지원 요청 품질 향상(재현 절차/해결책 안내).

**✅ Definition of Done:**
- [ ] Command Palette에서 실행 가능(Windows/WSL 포함)
- [ ] TROUBLESHOOTING 문서가 정상적으로 열리고, 실패 시 사용자에게 명확히 안내
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run lint` 통과
- [ ] (가능한 환경/CI) `pnpm -C vibereport-extension run test:run` 통과
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
