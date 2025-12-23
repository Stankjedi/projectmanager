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
| **버전** | v0.4.28 |
| **분석 기준일** | 2025-12-22 |
| **테스트/커버리지** | Vitest, 테스트 371개, 라인 87.89% / 브랜치 70.55% (`pnpm -C vibereport-extension run test:coverage` 기준) |
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

> **기준일:** 2025-12-22  
> 아래 데이터는 현재 코드/설정 분석 및 로컬 검증 결과에 기반하여 도출된 **미적용(Pending)** 항목입니다(완료 히스토리는 `Session_History.md`에서 관리).

### 1. 우선순위별 대기 항목 수

| 우선순위 | 대기(Pending) | 주요 내용 |
|:---:|:---:|:---|
| 🔴 **긴급 (P1)** | 1 | 모노레포 구조에서 기능 기반 구조도/엔트리포인트 탐지 정확도 개선. |
| 🟡 **중요 (P2)** | 2 | 민감 파일 기본 제외(보안), excludePatterns 기본값 보존(설정 병합 옵션). |
| 🟢 **개선 (P3)** | 1 | analysisRoot 설정 마법사(QuickPick) 명령 추가로 모노레포 UX 개선. |
| ⚙️ **최적화 (OPT)** | 1 | Git 정보(상태/로그) TTL 캐시로 대형 레포 스캔 비용 절감. |
| **총계** | **5** | **모든 항목은 현재 대기 중입니다(미적용 항목만 유지).** |

### 2. 전체 개선 항목 리스트

| # | 항목명 | 우선순위 | 카테고리 | ID |
|:---:|:---|:---:|:---|:---|
| 1 | 기능 기반 구조도/엔트리포인트 탐지의 모노레포 지원 강화 | P1 | 🧹 코드 품질 | `scan-structure-001` |
| 2 | 스캔 단계에서 민감 파일 기본 제외(예: `.env`, `*token*`) | P2 | 🔒 보안 | `security-sensitive-scan-001` |
| 3 | excludePatterns 기본값 보존(설정 병합 옵션)으로 아티팩트 스캔 노이즈 차단 | P2 | ⚙️ 성능 | `config-exclude-001` |
| 4 | analysisRoot 설정 마법사(QuickPick) 명령 추가 | P3 | ✨ 기능 추가 | `feat-analysisroot-wizard-001` |
| 5 | Git 정보(상태/로그) TTL 캐시 최적화 | OPT | 🚀 최적화 | `opt-gitinfo-cache-001` |
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 중요 (P1)

#### [P1-1] 기능 기반 구조도/엔트리포인트 탐지의 모노레포 지원 강화

| 항목 | 내용 |
|------|------|
| **ID** | `scan-structure-001` |
| **카테고리** | 🧹 코드 품질 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/services/workspaceScanner.ts`, `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | architecture, documentation, maintainability |

- **현재 상태:** 기능 기반 구조도 생성이 루트 `src/` 전제에 치우쳐, 현재 스냅샷에서 `devplan/`만 집계되고 `vibereport-extension/src/*`가 구조도로 반영되지 않는 문제가 확인됩니다.
- **문제점 (Problem):** 구조도/엔트리포인트가 부정확하면 평가·개선 보고서의 신뢰도가 떨어지고, 모노레포 사용자 경험이 악화됩니다.
- **영향 (Impact):** 구조/진입점 오해 → 잘못된 개선 제안·리스크 판단, 초기 온보딩 비용 증가.
- **원인 (Cause):** 경로 분해가 `firstDir === 'src'` 중심으로 설계되어 `packages/foo/src/...` 형태를 분류하지 못합니다.
- **개선 내용 (Proposed Solution):** 경로에서 `src` 세그먼트를 탐지해 그 다음 디렉토리로 기능 분류(예: `*/src/commands/*`)하고, 엔트리포인트 탐지를 `*/src/extension.ts` 등 패턴까지 확장합니다. 모노레포 케이스 테스트를 추가해 계약을 고정합니다.
- **기대 효과:** 구조도 품질 향상, 리포트 신뢰도/가독성 개선, 모노레포 지원 강화.

**✅ Definition of Done:**
- [ ] 모노레포 경로(예: `vibereport-extension/src/*`)가 구조도 테이블에 반영됨
- [ ] 엔트리포인트 탐지에 `*/src/extension.ts` 등 대표 케이스 포함
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run test:run` 통과

---

### 🟡 중요 (P2)

#### [P2-1] 스캔 단계에서 민감 파일 기본 제외(예: `.env`, `*token*`)

| 항목 | 내용 |
|------|------|
| **ID** | `security-sensitive-scan-001` |
| **카테고리** | 🔒 보안 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/services/workspaceScanner/fileCollector.ts`, `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts`(보강) |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | security, productionReadiness |

- **현재 상태:** `.gitignore` 및 excludePatterns 기반으로 파일을 수집하지만, “민감 파일”에 대한 상시 차단은 스냅샷 파일 제외 수준에 그칩니다.
- **문제점 (Problem):** `.env`/키/토큰 등 파일이 파일 목록·구조도·프롬프트 경로에 포함될 수 있어 외부 공유/AI 전달 시 노출 위험이 있습니다.
- **영향 (Impact):** 보안 사고 가능성 및 사용자 신뢰 저하.
- **원인 (Cause):** fileCollector의 `applyGitignoreAndSensitiveFilters`가 민감 패턴을 실제로 필터링하지 않습니다.
- **개선 내용 (Proposed Solution):** 기본 민감 패턴 세트를 도입해 항상 제외(설정으로 확장 가능)하고, 제외된 파일이 언어 통계/구조도/TODO 스캔에서도 일관되게 제외되도록 합니다. 테스트로 계약을 고정합니다.
- **기대 효과:** 기본 보안 수준 상향, 공유/AI 전달 시 리스크 감소.

**✅ Definition of Done:**
- [ ] 기본 민감 패턴(예: `.env*`, `*.pem`, `*.key`, `*token*`)이 수집 결과에서 제외됨
- [ ] excludePatterns/`.gitignore`와 함께 동작(우선순위/중복) 명확
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과

---

#### [P2-2] excludePatterns 기본값 보존(설정 병합 옵션)으로 아티팩트 스캔 노이즈 차단

| 항목 | 내용 |
|------|------|
| **ID** | `config-exclude-001` |
| **카테고리** | ⚙️ 성능 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/src/utils/configUtils.ts`, `vibereport-extension/package.json`, `vibereport-extension/src/utils/__tests__/configDefaults.test.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | performance, productionReadiness |

- **현재 상태:** 워크스페이스 설정의 excludePatterns는 기본값을 “대체”하며, 사용자가 목록을 커스터마이즈할 때 기본 제외(예: `**/*.vsix`)가 누락될 수 있습니다.
- **문제점 (Problem):** 큰 바이너리/아티팩트가 스캔에 포함되면 성능 저하 및 리포트 노이즈가 증가합니다.
- **영향 (Impact):** 스캔 시간 증가, 결과 신뢰도 저하, 자동 업데이트 모드에서 I/O 누적.
- **원인 (Cause):** 설정 로딩 시 기본값과 사용자 값을 병합하지 않음(옵션 부재).
- **개선 내용 (Proposed Solution):** `excludePatternsIncludeDefaults`(기본 true) 옵션을 추가해 기본 패턴 + 사용자 패턴을 합집합으로 구성하고 중복 제거합니다. 테스트/문서를 함께 갱신합니다.
- **기대 효과:** 안전한 기본 동작 유지, 사용자 커스터마이징 시에도 품질/성능 안정화.

**✅ Definition of Done:**
- [ ] 설정 옵션 추가 및 기본값 동작 정의(기본 패턴 유지)
- [ ] 패턴 병합/중복 제거 로직 구현
- [ ] 관련 테스트 통과
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run test:run` 통과
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **중복 코드:** 스캔/리포트/프리뷰 영역에서 “문자열 기반 추출(정규식)”이 여러 곳에 존재하므로 공통 유틸로 정리할 여지가 있습니다.
- **타입 안정성:** 설정/경로/파싱 경계 로직은 정책이 명확한 만큼, 타입과 테스트로 계약을 더 촘촘히 고정하는 것이 효과적입니다.
- **복잡도:** `workspaceScanner.ts`는 기능 범위가 넓어(수집/구조/깃/요약) “작은 단위 테스트 가능한 헬퍼”로 더 분리할 여지가 있습니다.
- **에러 처리 일관성:** Git/파일 I/O 실패 시 사용자 메시지 vs 로그(outputChannel) 기준을 명확히 분리하면 운영 디버깅이 쉬워집니다.
- **불필요한 연산/캐싱 부재:** 연속 실행 시 Git 상태/로그 수집이 반복될 수 있으므로 TTL 캐시로 비용을 줄일 여지가 있습니다.

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] Git 정보(상태/로그) TTL 캐시 최적화

| 항목 | 내용 |
|------|------|
| **ID** | `opt-gitinfo-cache-001` |
| **카테고리** | 🚀 코드 최적화 |
| **영향 범위** | 성능 · 품질 |
| **대상 파일** | `vibereport-extension/src/services/workspaceScanner.ts`, `vibereport-extension/src/services/snapshotCache.ts`, `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts` |

**현재 상태:**
- `WorkspaceScanner.getGitInfo()`가 스캔 시점마다 Git 상태/로그를 조회하며, 대형 레포에서는 `status()` 호출이 상대적으로 고비용일 수 있습니다.
- 연속 실행(자동 업데이트/반복 실행)에서는 “Git 상태 변화가 없음”에도 동일 작업이 반복될 수 있습니다.

**최적화 내용:**
- `snapshotCache`(TTL 30초) 기반으로 Git 정보를 캐싱하고, 동일 `rootPath`의 연속 스캔에서는 캐시를 재사용합니다.
- enableGitDiff=false 또는 레포 아님(non-repo) 케이스는 기존처럼 빠르게 종료하도록 유지합니다.
- 캐시 미스/오류 시에는 기존 로직으로 폴백하여 안전하게 동작합니다.

**예상 효과:**
- 대형 레포에서 보고서 업데이트 체감 시간을 단축하고, 자동 업데이트 모드의 CPU/I/O 사용량을 안정화합니다.

**측정 지표:**
- 동일 워크스페이스에서 연속 실행 시 Git status 호출 횟수 감소(테스트에서 호출 수 검증).
- Git 상태가 실제로 변경되었을 때(커밋/스테이지/수정) 정보가 갱신되는지 확인(수동 또는 추가 테스트).
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] analysisRoot 설정 마법사(QuickPick) 명령 추가

| 항목 | 내용 |
|------|------|
| **ID** | `feat-analysisroot-wizard-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/package.json`, `vibereport-extension/src/commands/setAnalysisRootWizard.ts`(신규), `vibereport-extension/src/commands/index.ts`, `vibereport-extension/src/extension.ts`, `vibereport-extension/src/commands/__tests__/setAnalysisRootWizard.test.ts`(신규) |
| **Origin** | manual-idea |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | usability, scalability, productionReadiness |

**기능 목적:**
- 모노레포/서브폴더 프로젝트에서 “분석 대상 루트(analysisRoot)”를 빠르게 선택·저장하여, 구조도/스캔 품질과 초기 온보딩을 개선합니다.

**현재 상태:**
- `vibereport.analysisRoot` 설정은 존재하지만 사용자가 직접 설정 파일을 편집해야 하며, 올바른 후보 경로를 찾기 위한 가이드/도구가 부족합니다.

**제안 구현 전략:**
- 워크스페이스 하위에서 `package.json`/`tsconfig.json`/`src/extension.ts` 등 신호를 기반으로 후보 폴더를 탐색하고 QuickPick으로 선택합니다.
- 선택 결과를 Workspace settings(`vibereport.analysisRoot`)에 저장하고, `resolveAnalysisRoot`로 유효성 검증 후 사용자에게 결과를 안내합니다.
- 선택 후 즉시 “보고서 업데이트”를 실행하도록 선택 옵션을 제공(선택 사항).

**기대 효과:**
- 모노레포에서도 구조도/언어 통계/스캔 결과의 품질이 개선되고, 설정 실수로 인한 진단 품질 저하를 줄입니다.

**✅ Definition of Done:**
- [ ] 명령/설정 기여(package.json) 추가 및 동작 확인
- [ ] 후보 탐색/유효성 검증/설정 저장이 정상 동작
- [ ] 단위 테스트 추가 및 통과
- [ ] `pnpm -C vibereport-extension run compile && pnpm -C vibereport-extension run test:run` 통과
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
