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
| **버전** | v0.4.40 (`vibereport-extension/package.json`) |
| **분석 기준일** | 2026-01-06 |
| **로컬 검증(본 환경)** | `pnpm -C vibereport-extension run compile` ✅ / `pnpm -C vibereport-extension run lint` ✅ / `pnpm -C vibereport-extension run test:run` ✅(테스트 417개) / `pnpm -C vibereport-extension run doctor:check` ✅ (2026-01-06) |
| **테스트/커버리지** | CI: `.github/workflows/ci.yml`에서 `compile`/`lint`/`bundle`/`test:run`/`test:coverage` 실행 |
| **발행자** | Stankjedi |
| **민감 파일 주의** | 워크스페이스 루트에 `vsctoken.txt` 존재(내용 미열람, 보고서/프롬프트에 값 포함 금지) |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-ERROR-EXPLORATION-START -->
## 🔍 오류 및 리스크 탐색 절차

> 이 섹션은 개선 항목이 어떤 근거로 도출되었는지(신뢰 가능한 출처/과정)를 요약합니다.

### 1. 데이터 수집
- 스크립트/엔트리포인트 점검: `vibereport-extension/package.json`의 `scripts` 및 `contributes.commands`/`main` 확인.
- 로컬 실행(2026-01-06): `pnpm -C vibereport-extension run compile` ✅ / `pnpm -C vibereport-extension run lint` ✅ / `pnpm -C vibereport-extension run test:run` ✅(테스트 파일 55개/테스트 417개) / `pnpm -C vibereport-extension run doctor:check` ✅.
- CI 설정 점검: `.github/workflows/ci.yml`에서 `compile`/`lint`/`bundle`/`test:run`/`test:coverage` 실행.
- 레드 플래그 스캔: `any`(`vibereport-extension/src/scripts/doctorCli.ts`), `TODO/FIXME`(템플릿/테스트 중심) 확인. (`@ts-ignore`, `eslint-disable`는 미발견)
- 민감 파일 존재 여부: 워크스페이스 루트에 `vsctoken.txt`가 존재함(내용 미열람, 민감 정보 보호 원칙).

### 2. 정적/구조 분석
- 경로 기반 설정 검증: `reportDirectory`/`snapshotFile`이 `path.join(...)`으로 바로 사용되어, 잘못된 값(예: `..`)에 대한 방어가 약함 → `security-path-traversal-001`.
- 사용자 커스텀 지침 노출: `vibereport.ai.customInstructions`가 분석 프롬프트에 그대로 삽입되어 토큰/키 형태 문자열이 섞이면 우발 노출 가능 → `security-custom-instructions-redaction-001`.
- 민감 파일 판별 중복: `analysisPromptTemplate.ts`가 자체 `isSensitivePath`(키워드 포함) 구현을 사용하여 과탐지/누락 가능 → `quality-sensitive-path-detection-001`.
- 프리뷰 메타 파싱 취약: 공유 프리뷰에서 일부 메타(버전/총점)가 정규식 기반으로 추출되어 포맷 변화에 취약 → `quality-share-preview-metadata-parsing-001`.
- 성능/프롬프트 크기: `workspaceScanner.ts: buildStructureSummary`가 디렉토리 엔트리 수 제한 없이 생성되어 대형 워크스페이스에서 지연/비대화 가능 → `opt-structure-summary-cap-001`.
- 사용자 경험: `generatePrompt.ts`는 다중 선택 복사를 지원하지만 “미완료 항목 전체를 순서대로” 복사하는 동선이 부족해 누락/순서 혼선 여지 → `feat-copy-all-prompts-001`.

### 3. 개선 후보 정제
- 각 항목에 `Origin`(test-failure/build-error/static-analysis/manual-idea), `리스크 레벨`, `관련 평가 카테고리`를 부여했습니다.
- 이 문서에는 **현재 미적용(P1/P2/P3/OPT) 항목만** 유지합니다(완료 항목 기록/히스토리는 포함하지 않음).
<!-- AUTO-ERROR-EXPLORATION-END -->

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

> **기준일:** 2026-01-06  
> 아래 데이터는 현재 코드/설정 분석 및 로컬 실행 관찰(가능 범위) 기반으로 도출된 **미적용(대기)** 항목입니다(완료 히스토리는 `Session_History.md`에서 관리).

### 1. 우선순위별 대기 항목 수

| 우선순위 | 대기(미적용) | 주요 내용 |
|:---:|:---:|:---|
| 🔴 **긴급 (P1)** | 1 | 경로 기반 설정 검증(보고서/스냅샷) 및 안전 폴백 |
| 🟡 **중요 (P2)** | 3 | 커스텀 지침 레드액션/경고, 민감 파일 판별 로직 단일화, 프리뷰 메타 파싱 견고화 |
| 🟢 **개선 (P3)** | 1 | 미완료 프롬프트/OPT 항목 “순서대로 일괄 복사” UX 추가 |
| ⚙️ **최적화 (OPT)** | 1 | 구조 요약 생성량 제한으로 프롬프트 비대화/지연 완화 |
| **총계** | **6** | **현재 대기 중인 항목만 유지합니다(완료 히스토리는 제외).** |

### 2. 전체 개선 항목 리스트

| # | 항목명 | 우선순위 | 카테고리 | ID |
|:---:|:---|:---:|:---|:---|
| 1 | 보고서/스냅샷 경로 설정 검증 및 안전 폴백(서브패스 강제) | P1 | 🔒 보안/📦 프로덕션 | `security-path-traversal-001` |
| 2 | 사용자 커스텀 지침 토큰/키 패턴 레드액션 및 경고 | P2 | 🔒 보안 | `security-custom-instructions-redaction-001` |
| 3 | 분석 프롬프트 민감 파일 판별 로직 단일화(과탐지/누락 방지) | P2 | 🧹 코드 품질/🔒 보안 | `quality-sensitive-path-detection-001` |
| 4 | 공유 프리뷰 메타(버전/총점) 파싱을 TL;DR 마커 기반으로 견고화 | P2 | 🧹 코드 품질/🧰 사용자 경험 | `quality-share-preview-metadata-parsing-001` |
| 5 | 미완료 프롬프트/OPT 항목 “순서대로 일괄 복사” 옵션 추가 | P3 | ✨ 기능 추가/🧰 사용자 경험 | `feat-copy-all-prompts-001` |
| 6 | 구조 요약 생성량 제한(대형 워크스페이스 성능/프롬프트 크기 개선) | OPT | ⚙️ 성능/🚀 코드 최적화 | `opt-structure-summary-cap-001` |
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 중요 (P1)

#### [P1-1] 보고서/스냅샷 경로 설정 검증 및 안전 폴백(서브패스 강제)

| 항목 | 내용 |
|------|------|
| **ID** | `security-path-traversal-001` |
| **카테고리** | 🔒 보안 / 📦 프로덕션 |
| **Complexity** | Medium |
| **대상 파일** | `vibereport-extension/src/utils/configUtils.ts`, `vibereport-extension/src/services/reportService.ts`, `vibereport-extension/src/services/snapshotService.ts`, `vibereport-extension/src/views/SettingsViewProvider.ts` |
| **근거** | `vibereport-extension/src/services/reportService.ts: config.reportDirectory를 검증 없이 path.join(rootPath, ...)에 사용`<br/>`vibereport-extension/src/services/snapshotService.ts: config.snapshotFile을 검증 없이 path.join(rootPath, ...)에 사용` |
| **Origin** | static-analysis |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | security, productionReadiness |

- **현재 상태:** `analysisRoot`는 서브패스 검증을 수행하지만, `reportDirectory`/`snapshotFile`은 문자열 그대로 사용됩니다.
- **문제점:** `..`/절대 경로 등 비정상 입력 시 워크스페이스 밖으로 파일이 기록될 여지가 있습니다.
- **영향:** 예기치 않은 파일 생성/덮어쓰기, 개인정보/정책 위반 위험, 사용자 신뢰 저하.
- **원인:** 경로 설정 값에 대한 “서브패스 강제” 검증/폴백 로직 부재.
- **개선 내용:** `resolveAnalysisRootPortable` 방식으로 경로를 검증(절대 경로 금지, `..` 금지, 워크스페이스 하위 강제)하고 UI/명령 실행 시 명확한 오류 및 안전 기본값으로 폴백합니다.
- **기대 효과:** 안전한 기본값 강화, 잘못된 설정으로 인한 사고 가능성 감소.

**✅ 완료 기준**
- [ ] 주요 코드 리팩토링 및 구현 완료
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음
- [ ] `pnpm -C vibereport-extension run compile` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과

---

### 🟡 중요 (P2)

#### [P2-1] 사용자 커스텀 지침 토큰/키 패턴 레드액션 및 경고

| 항목 | 내용 |
|------|------|
| **ID** | `security-custom-instructions-redaction-001` |
| **카테고리** | 🔒 보안 |
| **Complexity** | Medium |
| **대상 파일** | `vibereport-extension/src/utils/analysisPromptTemplate.ts`, `vibereport-extension/src/utils/redactionUtils.ts`, `vibereport-extension/src/utils/__tests__/analysisPromptTemplate.test.ts` |
| **근거** | `vibereport-extension/src/utils/analysisPromptTemplate.ts: ai.customInstructions를 레드액션 없이 프롬프트에 삽입` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | security, productionReadiness |

- **현재 상태:** 사용자 지침이 프롬프트/클립보드/로그 경로로 그대로 흘러갈 수 있습니다.
- **문제점:** 토큰/키/자격증명 형태 문자열이 섞이면 우발 노출로 이어집니다.
- **영향:** 민감 정보 유출 위험, 기능 사용 위축, 운영 신뢰도 저하.
- **원인:** 사용자 입력 텍스트에 대한 최소 레드액션/경고 부재.
- **개선 내용:** 기본으로 `redactSecretLikePatterns`를 적용하고(또는 탐지 시 경고+선택지 제공), 테스트로 마스킹을 보장합니다.
- **기대 효과:** 우발 노출 가능성 감소, 안전한 사용 경험 제공.

**✅ 완료 기준**
- [ ] 주요 코드 리팩토링 및 구현 완료
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음
- [ ] `pnpm -C vibereport-extension run compile` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과

---

#### [P2-2] 분석 프롬프트 민감 파일 판별 로직 단일화(과탐지/누락 방지)

| 항목 | 내용 |
|------|------|
| **ID** | `quality-sensitive-path-detection-001` |
| **카테고리** | 🧹 코드 품질 / 🔒 보안 |
| **Complexity** | Low |
| **대상 파일** | `vibereport-extension/src/utils/analysisPromptTemplate.ts`, `vibereport-extension/src/utils/sensitiveFilesUtils.ts`, `vibereport-extension/src/utils/__tests__/analysisPromptTemplate.test.ts` |
| **근거** | `vibereport-extension/src/utils/analysisPromptTemplate.ts: normalized.includes('key') 등 단순 키워드 탐지로 과탐지 가능(예: monkey.ts)`<br/>`vibereport-extension/src/utils/sensitiveFilesUtils.ts: 토큰화 기반 isSensitivePath 구현이 존재하지만 analysisPromptTemplate에서 미사용` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | codeQuality, security, productionReadiness |

- **현재 상태:** 신규 파일/Findings 필터링이 중복 로직에 의존합니다.
- **문제점:** 과탐지 시 정상 파일/근거가 프롬프트에서 제외되어 분석 품질이 저하됩니다.
- **영향:** 개선 항목 도출 누락/왜곡, 사용자 신뢰 저하.
- **원인:** 동일 목적 로직의 중복 구현 및 단순 부분문자열 탐지.
- **개선 내용:** `analysisPromptTemplate.ts`에서 `sensitiveFilesUtils.isSensitivePath`를 단일 소스로 사용하고, 대표 과탐지 케이스를 테스트로 고정합니다.
- **기대 효과:** 민감 파일 보호는 유지하면서 분석 품질 변동을 감소.

**✅ 완료 기준**
- [ ] 주요 코드 리팩토링 및 구현 완료
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음
- [ ] `pnpm -C vibereport-extension run compile` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과

---

#### [P2-3] 공유 프리뷰 메타(버전/총점) 파싱을 TL;DR 마커 기반으로 견고화

| 항목 | 내용 |
|------|------|
| **ID** | `quality-share-preview-metadata-parsing-001` |
| **카테고리** | 🧹 코드 품질 / 🧰 사용자 경험 |
| **Complexity** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/shareReportPreview.ts`, `vibereport-extension/src/commands/__tests__/shareReportPreview.test.ts`, `vibereport-extension/src/commands/__tests__/exportReportBundle.test.ts` |
| **근거** | `vibereport-extension/src/commands/shareReportPreview.ts: 버전/총점 추출이 정규식(versionMatch/totalScoreMatch)에 의존` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | maintainability, productionReadiness, documentation |

- **현재 상태:** TL;DR/점수표는 마커 기반 추출이지만, 버전/총점은 정규식으로 추출합니다.
- **문제점:** 보고서 테이블 포맷이 변하면 프리뷰 메타가 `-`로 표시될 수 있습니다.
- **영향:** 공유 프리뷰 신뢰성 저하, 사용자 혼란.
- **원인:** 구조화된 마커 섹션이 있음에도 메타 파싱이 문자열 패턴에 결합됨.
- **개선 내용:** TL;DR 마커 섹션의 표에서 메타를 파싱하고, 정규식은 폴백으로만 사용합니다(테스트로 고정).
- **기대 효과:** 포맷 변화에 대한 프리뷰 견고성 향상.

**✅ 완료 기준**
- [ ] 주요 코드 리팩토링 및 구현 완료
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] 빌드 및 린트 에러 없음
- [ ] `pnpm -C vibereport-extension run compile` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **중복 코드 및 유틸 추출:** 스캔/리포트 갱신/마커 조작 로직은 재사용 가능성이 높아, 공통 유틸/헬퍼로 정리하면 유지보수 비용이 감소합니다.
- **타입 안정성 강화:** 프로덕션 코드에서 `any` 사용을 최소화하고, 오류 처리에서 `unknown` + 타입 가드로 안전성을 높이는 방식이 유리합니다.
- **복잡도 관리:** 깊은 중첩/긴 함수는 조기 리턴, 단계 분리(파이프라인화), 단위 테스트로 리스크를 낮출 수 있습니다.
- **에러 처리 일관성:** “사용자 메시지 + 로그 + 복구 힌트” 형식을 명령/서비스 전반에 통일하면 운영 효율이 향상됩니다.
- **불필요한 연산/비동기 최적화:** 대형 워크스페이스에서 구조 요약 등 반복 I/O 구간은 결과량 제한/캐싱/동시성 전략이 유효합니다.

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] 구조 요약 생성량 제한(대형 워크스페이스 성능/프롬프트 크기 개선)

| 항목 | 내용 |
|------|------|
| **ID** | `opt-structure-summary-cap-001` |
| **카테고리** | 🚀 코드 최적화 / ⚙️ 성능 튜닝 |
| **영향 범위** | 둘 다 |
| **대상 파일** | `vibereport-extension/src/services/workspaceScanner.ts`, `vibereport-extension/src/services/__tests__/workspaceScanner.test.ts` |

**현재 상태:**
- `buildStructureSummary`는 maxDepth까지만 제한하지만, 각 디렉토리의 엔트리 수 제한이 없어 대형 루트에서 결과가 비대해질 수 있습니다.

**최적화 내용:**
- 디렉토리당 최대 표시 엔트리 수(예: 50)를 도입하고, 초과분은 “... 그리고 N개 더...” 형태의 요약 노드로 표시합니다.
- 정렬/결정적 순서를 유지하고, 테스트로 “제한 + 요약 노드” 동작을 고정합니다.

**예상 효과:**
- 스캔 단계 지연 감소 및 분석 프롬프트 크기 감소로 AI 응답 품질/속도 개선에 기여합니다.

**측정 지표:**
- (필수) `pnpm -C vibereport-extension run compile`/`lint`/`test:run` 통과
- (권장) 대형 워크스페이스에서 구조 요약 생성 시간 및 노드 수 감소 확인
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] 미완료 프롬프트/OPT 항목 “순서대로 일괄 복사” 옵션 추가

| 항목 | 내용 |
|------|------|
| **ID** | `feat-copy-all-prompts-001` |
| **카테고리** | ✨ 기능 추가 / 🧰 사용자 경험 |
| **Complexity** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/generatePrompt.ts`, `vibereport-extension/src/commands/__tests__/generatePrompt.test.ts` |
| **근거** | `vibereport-extension/src/commands/generatePrompt.ts: 다중 선택은 가능하나 “미완료 전체를 순서대로” 복사하는 전용 옵션/정렬 보장이 없음` |
| **Origin** | manual-idea |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | productionReadiness, documentation |

**기능 목적:**
- 미완료(Pending/In-progress) 프롬프트와 OPT 항목을 “순서대로” 한 번에 복사하여 AI 에이전트가 끝까지 실행하도록 유도합니다.

**현재 상태:**
- 사용자는 QuickPick에서 항목을 직접 선택해야 하며, 선택/정렬/누락에 따른 실행 순서 혼선이 발생할 수 있습니다.

**제안 구현 전략:**
- (1) QuickPick에 “모든 미완료 항목 순서대로 복사” 옵션 추가(또는 별도 명령).
- (2) `PROMPT-###` 순서로 정렬 후 `---` 구분선으로 결합하여 클립보드에 복사.
- (3) 테스트로 “정렬/필터링/결합 포맷”을 고정하고, 기존 다중 선택 흐름은 유지합니다.

**기대 효과:**
- 누락/순서 오류 감소, 반복 작업 시간 단축, AI 적용 루프의 안정성 향상.

**✅ 완료 기준:**
- [ ] 모든 미완료 항목을 순서대로 복사하는 UX 제공
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 코파일럿 챗에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
