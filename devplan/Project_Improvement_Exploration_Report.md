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
| **버전** | v0.4.35 |
| **분석 기준일** | 2026-01-02 |
| **로컬 검증(본 환경)** | 2026-01-02 기준 `pnpm -C vibereport-extension run compile`/`lint`/`test:run`/`test:coverage` 통과 |
| **테스트/커버리지** | CI에서 `test:run`/`test:coverage` 실행. (최근 산출물 기준 statements 86.75% / branches 71.11% / functions 85.44% / lines 88.41%) |
| **발행자** | Stankjedi |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-ERROR-EXPLORATION-START -->
## 🔍 오류 및 리스크 탐색 절차

> 이 섹션은 개선 항목이 어떤 근거로 도출되었는지(신뢰 가능한 출처/과정)를 요약합니다.

### 1. 데이터 수집
- 로컬 실행: `pnpm -C vibereport-extension run compile`/`lint`/`test:run`/`test:coverage` 통과.
- CI 설정 점검: `.github/workflows/ci.yml`(compile/lint/test/coverage 실행) 확인.
- 커버리지 산출물 확인: `vibereport-extension/coverage/`(html/json) 기반으로 현재 커버리지 수준 확인.
- 설정 점검: `.vscode/settings.json`(snapshotFile/excludePatterns/language 등) 확인.
- 리포지토리 스캔(현황): 워크스페이스 루트에 `vsctoken.txt` 존재(민감 파일 가능성), 문서 내 마켓플레이스 링크/배지/설치 예시 드리프트 가능 지점 확인.

### 2. 정적/구조 분석
- 보안/프라이버시: 민감 파일(토큰/키/.env 등)이 워크스페이스에 존재할 수 있으며, 스캔/프리뷰/공유 단계에서 노출 위험이 커질 수 있습니다(닥터 기반 점검/차단 필요).
- 운영 자동화: 닥터 기능이 유용하지만, 안전한 조치를 “묶어서 일괄 실행”하지 못하면 운영 실수 가능성이 증가할 수 있습니다.
- 문서 정합성: 버전/VSIX/릴리즈 URL 드리프트는 테스트로 차단되지만, 마켓플레이스 링크/배지 정합성은 별도 검증이 없으면 재발 여지가 있습니다.
- 유지보수성: `src/utils/markdownUtils.ts` 등 대형 유틸 파일은 변경 영향이 커져 장기 유지보수 비용이 증가할 수 있습니다.

### 3. 개선 후보 정제
- 각 항목에 `Origin`(test-failure/build-error/static-analysis/manual-idea), `리스크 레벨`, `관련 평가 카테고리`를 부여했습니다.
- 이 문서에는 **현재 미적용(P1/P2/P3/OPT) 항목만** 유지합니다(완료 항목 기록/히스토리는 포함하지 않음).
<!-- AUTO-ERROR-EXPLORATION-END -->

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

> **기준일:** 2026-01-02  
> 아래 데이터는 현재 코드/설정 분석 및 로컬 실행 관찰(가능 범위) 기반으로 도출된 **미적용(대기)** 항목입니다(완료 히스토리는 `Session_History.md`에서 관리).

### 1. 우선순위별 대기 항목 수

| 우선순위 | 대기(미적용) | 주요 내용 |
|:---:|:---:|:---|
| 🔴 **긴급 (P1)** | 1 | 민감 파일(토큰/키/.env 등) 노출 위험을 닥터에서 사전 차단/가이드. |
| 🟡 **중요 (P2)** | 2 | 문서 정합성(특히 마켓플레이스/줄바꿈 보존) 회귀를 테스트로 고정. |
| 🟢 **개선 (P3)** | 2 | 닥터 운영 자동화(안전 항목 묶음 실행) 및 스냅샷 저장 모드 옵션화. |
| ⚙️ **최적화 (OPT)** | 1 | 대형 유틸 모듈화로 유지보수성/변경 영향 최소화. |
| **총계** | **6** | **모든 항목은 현재 대기 중입니다(미적용 항목만 유지).** |

### 2. 전체 개선 항목 리스트

| # | 항목명 | 우선순위 | 카테고리 | ID |
|:---:|:---|:---:|:---|:---|
| 1 | 리포트 닥터: 민감 파일 점검/차단 강화 | P1 | 🔒 보안/🧰 운영 | `sec-sensitive-files-001` |
| 2 | docsConsistency: 마켓플레이스 링크/배지 정합성 검증 추가 | P2 | 🧪 테스트/📚 문서 | `test-docs-marketplace-001` |
| 3 | 닥터 문서 자동 수정: 줄바꿈(LF/CRLF) 보존 테스트 추가 | P2 | 🧪 테스트/🧰 운영 | `test-doctor-docs-fix-newlines-001` |
| 4 | 리포트 닥터: 안전 항목 묶음 실행 액션 추가 | P3 | ✨ 기능 추가/🧰 운영 | `feat-doctor-fix-all-001` |
| 5 | 스냅샷 저장 모드 옵션화(리포지토리 외 저장 지원) | P3 | ✨ 기능 추가/📦 운영 | `feat-snapshot-storage-mode-001` |
| 6 | markdownUtils 모듈화(유지보수성/변경 영향 최소화) | OPT | 🚀 최적화/🧹 코드 품질 | `opt-markdown-utils-modularize-001` |
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 중요 (P1)

#### [P1-1] 리포트 닥터: 민감 파일(토큰/키/.env) 점검 및 안전 조치 강화

| 항목 | 내용 |
|------|------|
| **ID** | `sec-sensitive-files-001` |
| **카테고리** | 🔒 보안 |
| **복잡도** | 중간 |
| **대상 파일** | `vibereport-extension/src/commands/reportDoctor.ts`, `vibereport-extension/src/utils/reportDoctorUtils.ts`, `vibereport-extension/src/services/workspaceScanner/fileCollector.ts` |
| **Origin** | `static-analysis` |
| **리스크 레벨** | `high` |
| **관련 평가 카테고리** | `security`, `productionReadiness` |

- **현재 상태:** 워크스페이스 루트에 `vsctoken.txt` 등 민감 파일 가능성이 있는 파일이 존재할 수 있으며, 운영 방식(프리뷰 공유/번들 내보내기 등)에 따라 노출 리스크가 발생할 수 있습니다.
- **문제점:** 민감 파일 존재/설정 상태를 닥터가 명시적으로 진단하지 않으면, 사용자의 실수(공유/내보내기)로 이어질 수 있습니다.
- **영향:** 보안 사고(토큰 유출), 신뢰도 하락, 긴급 롤백 및 운영 비용 증가.
- **원인:** 민감 파일 감지/안전 조치가 닥터 워크플로우에 통합되어 있지 않음.
- **개선 내용:** 닥터에 민감 파일 진단을 추가하고 (1) 설정 점검(`includeSensitiveFiles`) (2) 제외 패턴/가이드 제공 (3) 실행 전 재확인 등 안전 조치를 제공합니다.
- **기대 효과:** 실수 기반 유출을 사전에 차단하고, 운영 안정성과 보안 수준을 높입니다.

**✅ 완료 기준:**
- [ ] 주요 코드 구현 완료(닥터 진단/조치)
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음
- [ ] 문서 또는 주석 보완 (필요시)

---

### 🟡 중요 (P2)

#### [P2-1] docsConsistency: 마켓플레이스 링크/배지 정합성 테스트 추가

| 항목 | 내용 |
|------|------|
| **ID** | `test-docs-marketplace-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | 낮음 |
| **대상 파일** | `vibereport-extension/src/docsConsistency.test.ts`, `README.md` |
| **Origin** | `static-analysis` |
| **리스크 레벨** | `medium` |
| **관련 평가 카테고리** | `documentation`, `productionReadiness`, `testCoverage` |

- **현재 상태:** docsConsistency는 버전/VSIX/릴리즈 URL 드리프트는 잡지만, 마켓플레이스 링크/배지(`itemName`) 정합성은 테스트로 고정되어 있지 않습니다.
- **문제점:** 마켓플레이스 링크/배지 드리프트는 사용자 설치/업데이트 동선을 혼란스럽게 만들고 문서 신뢰도를 떨어뜨립니다.
- **영향:** 사용자 혼선 및 지원 비용 증가, 배포물 신뢰도 저하.
- **원인:** `publisher.name` 기반 정합성 검증이 테스트 범위에 포함되지 않음.
- **개선 내용:** `package.json`의 `publisher`/`name`을 단일 소스로 하여 루트 `README.md`의 마켓플레이스 URL/배지 내 `itemName`이 일치하는지 검증을 추가합니다.
- **기대 효과:** 문서 드리프트를 CI에서 조기에 차단하고 릴리즈 품질을 안정화합니다.

**✅ 완료 기준:**
- [ ] docsConsistency에 마켓플레이스 `itemName` 검증 추가
- [ ] `pnpm -C vibereport-extension run test:run` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과

---

#### [P2-2] 닥터 문서 자동 수정: 줄바꿈(LF/CRLF) 보존 회귀 테스트 추가

| 항목 | 내용 |
|------|------|
| **ID** | `test-doctor-docs-fix-newlines-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | 중간 |
| **대상 파일** | `vibereport-extension/src/utils/reportDoctorUtils.ts`, `vibereport-extension/src/utils/__tests__/reportDoctorUtils.test.ts` |
| **Origin** | `static-analysis` |
| **리스크 레벨** | `medium` |
| **관련 평가 카테고리** | `productionReadiness`, `documentation`, `testCoverage` |

- **현재 상태:** 닥터의 문서 자동 수정 로직은 줄바꿈(LF/CRLF) 보존을 시도하지만, 이를 강제하는 회귀 테스트가 부족합니다.
- **문제점:** 줄바꿈 보존이 깨지면 불필요한 디프가 발생하고 리뷰/병합 비용이 증가하며, 자동 수정 기능 신뢰도가 하락할 수 있습니다.
- **영향:** 운영 비용 증가(불필요 디프), 자동 수정 기능 사용 기피.
- **원인:** CRLF/LF 픽스처 기반 테스트 부재.
- **개선 내용:** CRLF/LF 픽스처로 `fixDocsVersionSync()` 동작을 검증하고, “변경은 필요한 문자열만” 발생하는지 테스트로 고정합니다.
- **기대 효과:** Windows/WSL/CI 환경에서 안정적으로 문서 자동 수정을 운영할 수 있습니다.

**✅ 완료 기준:**
- [ ] 줄바꿈 보존(CRLF/LF) 회귀 테스트 추가
- [ ] `pnpm -C vibereport-extension run test:run` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **중복 코드 및 유틸 함수로 추출 가능한 부분:** 마크다운 파싱/템플릿 조립/링크화 등 범용 로직은 모듈로 분리하면 변경 영향이 줄어듭니다.
- **타입 안정성 강화 필요 구간 (`any` 남용 등):** 테스트/Mock에서 `as any`가 늘어나면 회귀 시 신호가 약해질 수 있어, 핵심 경로부터 점진적으로 타입을 강화하는 편이 안전합니다.
- **가독성을 해치는 복잡한 함수/파일:** `src/utils/markdownUtils.ts`처럼 파일이 커지면 변경 비용/리스크가 증가하므로 기능 단위 모듈화가 유리합니다.
- **에러 처리 로직 표준화 여지:** 자동 수정/파일 쓰기 실패 시 사용자 메시지+로그가 분산되기 쉬우므로, 표준화된 오류 요약(원인/복구 경로) 템플릿이 있으면 운영이 쉬워집니다.
- **성능 관점:** 대형 워크스페이스에서 스캔/후처리 비용이 커질 수 있어, 캐시 키/무효화 기준을 지속 관찰하며 최적화 지점을 찾는 것이 좋습니다.

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] markdownUtils 모듈화(유지보수성/변경 영향 최소화)

| 항목 | 내용 |
|------|------|
| **ID** | `opt-markdown-utils-modularize-001` |
| **카테고리** | 🚀 코드 최적화 / 🧹 코드 품질 |
| **영향 범위** | 품질 |
| **대상 파일** | `vibereport-extension/src/utils/markdownUtils.ts` |

**현재 상태:**
- `src/utils/markdownUtils.ts`는 기능 범위가 넓고 파일 규모가 커서, 작은 변경도 영향 범위가 커질 수 있습니다.
- 결과적으로 PR 리뷰 비용이 증가하고, 회귀 발생 시 원인 추적이 어려워질 수 있습니다.

**최적화 내용:**
- 기존 외부 API(함수 시그니처/동작)를 유지한 채로, 내부 구현을 기능 단위로 분리합니다(예: 파싱/정규화/링크화/JSON 펜스 추출 등).
- “한 번에 대규모 이동”이 아니라, 안전한 단위(순수 함수/테스트로 보호된 함수)부터 단계적으로 추출합니다.
- 추출 후에는 re-export로 호환성을 유지하고, 호출부의 import 정리 및 테스트 통과로 안정성을 확인합니다.

**예상 효과:**
- 변경 영향 최소화(작은 PR 단위로 분리 가능), 가독성/테스트 용이성 향상, 회귀 원인 추적 비용 감소.

**측정 지표:**
- (필수) `pnpm -C vibereport-extension run compile`/`lint`/`test:run` 통과
- (권장) 리팩토링 후 파일 규모 감소 및 모듈 단위 테스트 보강
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] 리포트 닥터: 안전 항목 묶음 실행 액션 추가

| 항목 | 내용 |
|------|------|
| **ID** | `feat-doctor-fix-all-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | 중간 |
| **대상 파일** | `vibereport-extension/src/commands/reportDoctor.ts`, `vibereport-extension/src/utils/reportDoctorUtils.ts`, `vibereport-extension/src/commands/__tests__/reportDoctor.test.ts` |
| **Origin** | `manual-idea` |
| **리스크 레벨** | `medium` |
| **관련 평가 카테고리** | `productionReadiness`, `usability`, `maintainability` |

**기능 목적:**
- 닥터에서 감지된 “안전하게 자동 수정 가능한” 이슈들을 한 번에 적용하여 운영 속도와 안정성을 높입니다.

**현재 상태:**
- 이슈별 액션이 늘어날수록 사용자가 선택/순서를 판단해야 하며, 운영 실수 가능성이 증가할 수 있습니다.

**제안 구현 전략:**
- 닥터 이슈를 “안전 자동 수정 가능” / “수동 조치 필요”로 분류합니다.
- 안전 자동 수정 가능 항목만 묶어서 실행하는 `Fix All Safe Issues` 액션을 제공합니다.
- 실행 후 `validateReportMarkdown()`/정합성 검사들을 재실행하여 결과를 요약(성공/실패/남은 이슈)합니다.
- 실패 시 부분 적용 상태를 명확히 알리고, 추가 조치(열기/가이드)를 제공합니다.

**기대 효과:**
- 반복적인 운영 작업 시간을 단축하고, “한 번에 안전하게 복구”하는 사용 경험을 제공하여 실수를 줄입니다.

**✅ 완료 기준:**
- [ ] 닥터에 `Fix All Safe Issues` 액션이 추가됨
- [ ] 실행 후 재검증 결과가 사용자 메시지 및 출력 채널(`OutputChannel`)에 요약됨
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음

---

#### [P3-2] 스냅샷 저장 모드 옵션화(리포지토리 외 저장 지원)

| 항목 | 내용 |
|------|------|
| **ID** | `feat-snapshot-storage-mode-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | 높음 |
| **대상 파일** | `vibereport-extension/src/utils/configUtils.ts`, `vibereport-extension/src/services/snapshotService.ts`, `vibereport-extension/src/extension.ts` |
| **Origin** | `manual-idea` |
| **리스크 레벨** | `medium` |
| **관련 평가 카테고리** | `productionReadiness`, `security`, `usability` |

**기능 목적:**
- 스냅샷 상태 파일을 리포지토리 경로(.vscode)뿐 아니라 VS Code 확장 저장소(워크스페이스/글로벌 스토리지)에도 저장할 수 있게 하여 운영 노이즈/실수 커밋 위험을 줄입니다.

**현재 상태:**
- 스냅샷 파일 경로가 워크스페이스 파일로 설정되면(예: `.vscode/vibereport-state.json`), 팀 환경에서 디프 노이즈/공유 리스크가 발생할 수 있습니다.

**제안 구현 전략:**
- `snapshotStorageMode`(예: `workspaceFile`/`vscodeStorage`) 설정을 추가하고 기본값은 현행 동작을 유지합니다.
- `vscodeStorage` 모드에서는 `ExtensionContext`의 저장소 경로에 상태를 저장/로드합니다(워크스페이스별 분리).
- 마이그레이션: 기존 파일이 존재하면 1회 가져오기 옵션을 제공하고, 이후에는 선택된 모드에 따라 저장 위치를 결정합니다.

**기대 효과:**
- 리포지토리 노이즈 감소, 실수 커밋/공유 위험 감소, 팀 운영 안정성 향상.

**✅ 완료 기준:**
- [ ] 저장 모드 설정 추가 및 동작 구현(기본값은 하위 호환)
- [ ] 마이그레이션/폴백 동선 정의
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 코파일럿 챗에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
