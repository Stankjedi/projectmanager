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

> **기준일:** 2025-12-19  
> 아래 데이터는 코드 분석 및 로컬 테스트 결과에 기반하여 도출된 **미적용(Pending)** 항목입니다.

### 1. 우선순위별 대기 항목 수

| 우선순위 | 대기(Pending) | 주요 내용 |
|:---:|:---:|:---|
| 🔴 **긴급 (P1)** | 1 | GitHub Actions CI 빌드 실패 해결 (배포/테스트 정상화). |
| 🟡 **중요 (P2)** | 3 | 보안(프리뷰 XSS), 파싱 견고성(Prompt), 핵심 커버리지 확보. |
| 🟢 **개선 (P3)** | 1 | 평가 이력에 Git 버전 라벨링 추가로 가독성 개선. |
| ⚙️ **최적화 (OPT)** | 1 | 설정 저장 시 불필요한 파일 쓰기(I/O) 제거. |
| **총계** | **6** | **모든 항목이 현재 대기 중입니다.** |

### 2. 전체 개선 항목 리스트

| # | 항목명 | 우선순위 | 카테고리 | ID |
|:---:|:---|:---:|:---|:---|
| 1 | CI 파이프라인 pnpm 버전(lockfile v9) 일치화 | P1 | 📦 배포/CI | `ci-pnpm-version-001` |
| 2 | Prompt 체크리스트 헤더 파싱 유연성 확보 | P2 | 🧹 코드 품질 | `quality-prompt-parse-001` |
| 3 | Open Report Preview 렌더링 보안(XSS) 강화 | P2 | 🔒 보안 | `security-openpreview-escape-001` |
| 4 | 확장 진입점(activate) 테스트 커버리지 강화 | P2 | 🧪 테스트 | `test-coverage-extension-001` |
| 5 | 평가 추이 테이블 Git Short Hash 라벨링 | P3 | ✨ 기능 추가 | `feat-evalhistory-version-001` |
| 6 | Settings 배치 저장 I/O 최적화 | OPT | 🚀 최적화 | `opt-settings-skip-unchanged-001` |
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
| **대상 파일** | `.github/workflows/ci.yml`, `vibereport-extension/pnpm-lock.yaml` |
| **Origin** | build-error |
| **리스크 레벨** | critical |
| **관련 평가 카테고리** | productionReadiness, testCoverage |

**현재 상태:**
- 로컬 환경은 `pnpm 9.x`를 사용하여 `lockfile v9`을 생성했습니다.
- GitHub Actions CI 워크플로우는 `pnpm-action` 기본값(v8 추정)을 사용하여 `pnpm install` 시 호환성 오류가 발생합니다.

**문제점 (Problem):**
- CI 파이프라인에서 의존성 설치가 실패하여, PR 및 메인 브랜치의 자동 테스트/린트 검사가 수행되지 않고 있습니다.

**영향 (Impact):**
- 코드 품질 회귀 방지 장치가 작동하지 않아, 결함 있는 코드가 병합될 리스크가 매우 높습니다 (배포 신뢰도 상실).

**원인 (Cause):**
- `.github/workflows/ci.yml`의 `pnpm/action-setup` 단계에 명시적인 버전 지정(`version: 9`)이 누락되었습니다.

**개선 내용 (Proposed Solution):**
- CI 워크플로우 파일에서 `pnpm` 버전을 `9`로 고정하여 로컬 환경과 일치시킵니다.

**기대 효과:**
- CI 빌드 및 테스트 정상화, 자동화된 품질 게이트 복구.

**✅ Definition of Done:**
- [ ] GitHub Actions `Build` 단계 성공 (pnpm install 통과)
- [ ] `pnpm run test` 및 `pnpm run compile`이 CI에서 정상 실행

---

### 🟡 중요 (P2)

#### [P2-1] Prompt.md 체크리스트 헤더 파싱 견고성

| 항목 | 내용 |
|------|------|
| **ID** | `quality-prompt-parse-001` |
| **카테고리** | 🧹 코드 품질 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/src/commands/generatePrompt.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | maintainability |

**현재 상태:**
- `generatePrompt.ts`가 `Prompt.md` 파일의 체크리스트 섹션을 찾을 때, 특정 이모지(`📋`)가 포함된 헤더만 정규식으로 매칭합니다.

**문제점 (Problem):**
- 사용자가 `Prompt.md` 제목을 수정하거나 이모지를 지울 경우, 파싱에 실패하여 프롬프트 생성이 오작동합니다.

**개선 내용 (Proposed Solution):**
- 헤더 정규식을 유연하게 변경하여 이모지가 없거나 달라도 텍스트(`Execution Checklist`) 기반으로 매칭되도록 개선합니다.

**기대 효과:**
- 사용자 수정에 대한 내성 강화 및 유지보수성 향상.

**✅ Definition of Done:**
- [ ] 이모지 없는 헤더(`## Execution Checklist`) 테스트 케이스 통과
- [ ] 기존 포맷과 변경된 포맷 모두 정상 파싱 확인

#### [P2-2] Open Report Preview 렌더링 보안 강화 (XSS 방지)

| 항목 | 내용 |
|------|------|
| **ID** | `security-openpreview-escape-001` |
| **카테고리** | 🔒 보안 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/openReportPreview.ts` |
| **Origin** | static-analysis |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | security |

**현재 상태:**
- 보고서 프리뷰 HTML 생성 시, 외부 데이터(링크 텍스트 등)를 직접 문자열 접합하는 구간이 있어 XSS 취약점 가능성이 존재합니다.

**개선 내용 (Proposed Solution):**
- 모든 동적 텍스트 삽입부에 `escapeHtml` 함수를 적용하고, 외부 링크에는 `rel="noopener noreferrer"` 속성을 강제합니다.

**✅ Definition of Done:**
- [ ] 특수문자 포함 데이터 렌더링 시 이스케이프 확인
- [ ] 생성된 HTML 소스 내 `noopener` 속성 확인

#### [P2-3] 핵심 진입점(extension.ts) 커버리지 강화

| 항목 | 내용 |
|------|------|
| **ID** | `test-coverage-extension-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/extension.ts`, `src/test/extension.test.ts` |
| **Origin** | test-coverage |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | testCoverage |

**현재 상태:**
- 비즈니스 로직 테스트는 풍부하나, VS Code 확장의 진입점(`activate`/`deactivate`)과 명령 등록 부분의 테스트가 부족합니다.

**개선 내용 (Proposed Solution):**
- `extension.test.ts`에 통합 테스트 성격의 시나리오를 추가하여, 확장 활성화 시 주요 서비스가 올바르게 인스턴스화되는지 검증합니다.

**✅ Definition of Done:**
- [ ] `activate` 함수 호출 테스트 케이스 작성 컴파일
- [ ] 주요 명령(`Update Project Reports`) 등록 여부 확인
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **설정 저장 효율화:** `Configuration.update` 메서드는 디스크 I/O와 이벤트 전파를 유발하므로, 실제 값이 변경된 경우에만 호출해야 합니다. 현재 배치 저장 기능에서 이 확인 절차가 누락되어 있습니다.
- **문자열 병합:** 리포트 생성 시 템플릿 리터럴을 과도하게 사용하면 메모리 사용량이 일시적으로 증가할 수 있으나, 현재 규모에서는 큰 문제는 아닙니다.

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] Settings 배치 저장: 변경 없는 키 Update 스킵

| 항목 | 내용 |
|------|------|
| **ID** | `opt-settings-skip-unchanged-001` |
| **카테고리** | 🚀 코드 최적화 |
| **영향 범위** | 성능 |
| **대상 파일** | `vibereport-extension/src/views/SettingsViewProvider.ts` |

**현재 상태:**
- Settings 뷰의 '저장' 버튼 클릭 시, 폼에 입력된 모든 항목에 대해 무조건 `config.update()`를 호출합니다.

**최적화 내용:**
- `vscode.workspace.getConfiguration().get()`으로 현재 값을 읽어와, 입력된 값과 `Deep Equal` 비교를 수행합니다.
- 변경된 키에 대해서만 `update`를 실행하여 I/O를 최소화합니다.

**예상 효과:**
- 불필요한 `settings.json` 쓰기 방지 및 `onDidChangeConfiguration` 이벤트 발생 빈도 감소.

**측정 지표:**
- 저장 작업 수행 시 `update` 호출 횟수가 실제 변경된 항목 수와 동일한지 확인.
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] 평가 추이 버전 라벨 개선 (Git Commit 기반)

| 항목 | 내용 |
|------|------|
| **ID** | `feat-evalhistory-version-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/src/commands/updateReportsWorkflow.ts`, `services/workspaceScanner.ts` |
| **Origin** | manual-idea |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | maintainability |

**기능 목적:**
- `package.json` 버전 정보가 없는 프로젝트에서도 평가 히스토리에 Git Short Hash 등을 버전 라벨로 사용하여 식별력을 높임.

**현재 상태:**
- 버전 정보가 없으면 `unknown`으로 표시되어, 히스토리 추적 시 시점 구분이 어렵습니다.

**제안 구현 전략:**
- `SnapshotService`에서 프로젝트 버전을 결정할 때, `package.json` 버전이 없으면 Git HEAD의 Short Hash(`git:a1b2c`)를 대체 값으로 사용하도록 로직을 보완합니다.

**기대 효과:**
- 평가 추세표의 버전 컬럼에 의미 있는 값이 표시되어 변경 이력 추적이 용이해짐.

**✅ Definition of Done:**
- [ ] `WorkspaceScanner`에서 Git 정보 수집 확인
- [ ] 버전 결정 로직에 Git Hash 폴백 추가
- [ ] 평가 히스토리 저장 시 포맷(`git:xxxxxx`) 확인
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
