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
| **버전** | v0.4.38 (`vibereport-extension/package.json`) |
| **분석 기준일** | 2026-01-02 |
| **로컬 검증(본 환경)** | `pnpm -C vibereport-extension run compile` ✅ / `pnpm -C vibereport-extension run lint` ✅ / `pnpm -C vibereport-extension run test:run` ✅ / `pnpm -C vibereport-extension run doctor:check` ✅ |
| **테스트/커버리지** | CI: `.github/workflows/ci.yml`에서 `compile`/`lint`/`bundle`/`test:run`/`test:coverage` 실행 |
| **발행자** | Stankjedi |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-ERROR-EXPLORATION-START -->
## 🔍 오류 및 리스크 탐색 절차

> 이 섹션은 개선 항목이 어떤 근거로 도출되었는지(신뢰 가능한 출처/과정)를 요약합니다.

### 1. 데이터 수집
- 스크립트/엔트리포인트 점검: `vibereport-extension/package.json`의 `scripts` 및 `contributes.commands`/`main` 확인.
- 로컬 실행(2026-01-02): `pnpm -C vibereport-extension run compile` ✅ / `pnpm -C vibereport-extension run lint` ✅ / `pnpm -C vibereport-extension run test:run` ✅ / `pnpm -C vibereport-extension run doctor:check` ✅.
- CI 설정 점검: `.github/workflows/ci.yml`에서 `compile`/`lint`/`bundle`/`test:run`/`test:coverage` 실행.
- 레드 플래그 스캔: `any`(`vibereport-extension/src/scripts/doctorCli.ts`), `TODO/FIXME`(템플릿/테스트 중심) 확인. (`@ts-ignore`, `eslint-disable`는 미발견)
- 민감 파일 존재 여부: 워크스페이스 루트에 `vsctoken.txt`가 존재할 수 있으나, 내용은 미열람(민감 정보 보호 원칙).

### 2. 정적/구조 분석
- 번들 내보내기 개인정보: `vibereport-extension/src/commands/exportReportBundle.ts`가 `metadata.json`에 `workspaceRoot`(절대 경로)를 저장 → 공유 시 개인정보 노출 가능(`security-export-bundle-redaction-001`).
- 프리뷰 추출 견고성: `shareReport.ts`/`exportReportBundle.ts`가 특정 헤더 텍스트에 의존한 정규식으로 TL;DR/점수표를 추출 → 언어/포맷 변화에 취약(`quality-share-preview-marker-extraction-001`).
- 프리뷰 언어 일관성: 프리뷰 템플릿이 한국어/`ko-KR`에 고정되어 설정(`vibereport.language`)과 불일치 가능(`feat-share-preview-i18n-001`).
- TODO/FIXME 민감 문자열: `improvementFormatting.ts`에서 findings 텍스트를 그대로 출력 → 토큰/키 형태 우발 노출 가능(`security-todo-fixme-findings-redaction-001`).
- 성능: `todoFixmeScanner.ts`는 `stat` 병렬화는 있으나 콘텐츠 읽기는 순차 처리(`opt-todo-scan-parallel-001`).
- 레포 위생: `tmp_lines.txt`가 루트에 남아 있으며 `.gitignore`에 제외 규칙이 없음(`repo-ignore-artifacts-001`).

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
| 🔴 **긴급 (P1)** | 1 | 번들/공유 산출물 개인정보·경로 레드액션 및 안전 기본값 정립 |
| 🟡 **중요 (P2)** | 3 | 프리뷰 추출 로직 견고화(마커 기반), TODO/FIXME 텍스트 레드액션, 레포 산출물 파일 정리 |
| 🟢 **개선 (P3)** | 1 | Share Report/번들 프리뷰 i18n(언어/날짜) 지원 |
| ⚙️ **최적화 (OPT)** | 1 | TODO/FIXME 스캔 콘텐츠 읽기 병렬화(동시성 제한) |
| **총계** | **6** | **현재 대기 중인 항목만 유지합니다(완료 히스토리는 제외).** |

### 2. 전체 개선 항목 리스트

| # | 항목명 | 우선순위 | 카테고리 | ID |
|:---:|:---|:---:|:---|:---|
| 1 | 번들 내보내기 개인정보/경로 레드액션 강화(기본값 안전화) | P1 | 🔒 보안 | `security-export-bundle-redaction-001` |
| 2 | Share Report/번들 프리뷰 추출 로직 마커 기반 리팩토링(중복 제거) | P2 | 🧹 코드 품질/🧪 테스트 | `quality-share-preview-marker-extraction-001` |
| 3 | TODO/FIXME 발견 텍스트 민감 문자열 레드액션 | P2 | 🔒 보안/🧹 코드 품질 | `security-todo-fixme-findings-redaction-001` |
| 4 | 레포 산출물 파일 정리 및 `.gitignore` 반영(`tmp_lines.txt`) | P2 | 🧹 유지보수 | `repo-ignore-artifacts-001` |
| 5 | Share Report/번들 프리뷰 i18n(언어/날짜 로케일) 지원 | P3 | ✨ 기능 추가/🧰 UX | `feat-share-preview-i18n-001` |
| 6 | TODO/FIXME 스캔 콘텐츠 읽기 병렬화(동시성 제한) | OPT | ⚙️ 성능/🚀 코드 최적화 | `opt-todo-scan-parallel-001` |
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🔴 중요 (P1)

#### [P1-1] 번들 내보내기 개인정보/경로 레드액션 강화(기본값 안전화)

| 항목 | 내용 |
|------|------|
| **ID** | `security-export-bundle-redaction-001` |
| **카테고리** | 🔒 보안 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/exportReportBundle.ts`, `vibereport-extension/src/utils/redactionUtils.ts`, `vibereport-extension/package.json`, `vibereport-extension/src/commands/__tests__/exportReportBundle.test.ts` |
| **Evidence** | `vibereport-extension/src/commands/exportReportBundle.ts: metadata.json에 workspaceRoot(절대 경로)를 저장`<br/>`vibereport-extension/src/commands/exportReportBundle.ts: Share_Preview.md만 redaction 옵션 적용, 나머지 마크다운/metadata는 원본 그대로 저장` |
| **Origin** | static-analysis |
| **리스크 레벨** | high |
| **관련 평가 카테고리** | security, productionReadiness |

**현재 상태:**
- 번들 내보내기는 공유/아카이브에 유용하지만, 산출물 중 일부(특히 `metadata.json`)에 환경 정보(절대 경로)가 포함될 수 있습니다.

**문제점 (Problem):**
- “공유용 산출물”의 기본값이 안전하지 않을 수 있어, 사용자가 번들을 그대로 공유할 때 개인정보(로컬 경로) 노출 위험이 존재합니다.

**영향 (Impact):**
- 개인정보 노출, 보안 정책 위반, 사용자 신뢰 저하(공유/아카이브 기능 사용 위축).

**원인 (Cause):**
- redaction 정책이 Share_Preview에만 적용되고, 번들 전체 산출물 및 `metadata.json`에 대한 정책/테스트가 부족합니다.

**개선 내용 (Proposed Solution):**
- 번들 내보내기 경로에서 redaction 정책을 “옵션”이 아니라 “안전 기본값”으로 정립합니다.
  - `metadata.json`의 `workspaceRoot`는 제거/마스킹(또는 최소 정보로 치환)합니다.
  - (선택) 번들에 포함되는 마크다운 파일도 command URI/절대 경로를 마스킹한 “redacted 버전”을 함께 제공하거나, export 옵션으로 선택 가능하게 합니다.
  - 테스트로 번들 산출물에 절대 경로/command URI가 남지 않음을 검증합니다.

**기대 효과:**
- 사용자의 실수(무심코 공유)로 인한 노출 가능성을 낮추고, “안전한 공유”를 기본 UX로 제공합니다.

**✅ 완료 기준(Definition of Done):**
- [ ] 번들 내보내기 시 redaction 정책이 `metadata.json` 및 산출물에 일관되게 적용됨
- [ ] 관련 단위 테스트 추가/수정 및 통과
- [ ] `pnpm -C vibereport-extension run compile` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과

---

### 🟡 중요 (P2)

#### [P2-1] Share Report/번들 프리뷰 추출 로직 마커 기반 리팩토링(중복 제거)

| 항목 | 내용 |
|------|------|
| **ID** | `quality-share-preview-marker-extraction-001` |
| **카테고리** | 🧹 코드 품질 / 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/shareReport.ts`, `vibereport-extension/src/commands/exportReportBundle.ts`, `vibereport-extension/src/utils/markerUtils.ts`, `vibereport-extension/src/commands/__tests__/shareReportPreview.test.ts`, `vibereport-extension/src/commands/__tests__/exportReportBundle.test.ts` |
| **Evidence** | `vibereport-extension/src/commands/shareReport.ts: AUTO-SCORE-START 섹션을 '### 점수-등급 기준표' 헤더로 매칭해 추출(포맷/언어 변경에 취약)`<br/>`vibereport-extension/src/commands/exportReportBundle.ts: 유사한 프리뷰 생성 로직이 중복되어 유지보수 비용 증가` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | productionReadiness, maintainability, documentation |

**현재 상태:**
- Share Report/번들 프리뷰는 평가 보고서에서 TL;DR/점수표를 추출해 요약을 생성합니다.

**문제점 (Problem):**
- 추출 로직이 특정 헤더 텍스트(한국어)에 의존하여, 보고서 포맷/언어가 바뀌면 프리뷰가 깨질 수 있습니다.
- Share/Export 경로에 유사한 프리뷰 생성 코드가 중복되어 변경 누락 위험이 있습니다.

**영향 (Impact):**
- 공유 프리뷰 신뢰성 저하(빈 점수표/요약), 유지보수 비용 증가, 다국어 지원 시 회귀 위험 확대.

**원인 (Cause):**
- 마커 기반 추출 유틸이 있음에도, 프리뷰 추출이 정규식+헤더 의존 형태로 구현되어 있습니다.

**개선 내용 (Proposed Solution):**
- TL;DR/점수표는 헤더 문자열이 아니라 마커(`<!-- AUTO-TLDR-START -->`, `<!-- AUTO-SCORE-START -->`) 기반으로 추출하도록 리팩토링합니다.
- Share Report/번들 내보내기의 프리뷰 생성 템플릿을 단일 함수로 통합하고, 테스트로 포맷/언어 변화에 대한 회귀를 방지합니다.

**기대 효과:**
- 프리뷰 생성이 보고서 언어/형식 변화에 견고해지고, 중복 제거로 유지보수성이 개선됩니다.

**✅ 완료 기준(Definition of Done):**
- [ ] 마커 기반 추출로 프리뷰 생성이 동작(언어/헤더 변경에 독립적)
- [ ] Share/Export 프리뷰 생성 로직 중복 제거
- [ ] 관련 단위 테스트 추가/수정 및 통과
- [ ] `pnpm -C vibereport-extension run compile` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과

---

#### [P2-2] TODO/FIXME 발견 텍스트 민감 문자열 레드액션

| 항목 | 내용 |
|------|------|
| **ID** | `security-todo-fixme-findings-redaction-001` |
| **카테고리** | 🔒 보안 / 🧹 코드 품질 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/services/workspaceScanner/todoFixmeScanner.ts`, `vibereport-extension/src/services/reportService/improvementFormatting.ts`, `vibereport-extension/src/services/__tests__/todoFixmeScanner.test.ts` |
| **Evidence** | `vibereport-extension/src/services/workspaceScanner/todoFixmeScanner.ts: TODO/FIXME 라인에서 텍스트를 추출해 findings.text로 저장`<br/>`vibereport-extension/src/services/reportService/improvementFormatting.ts: findings.text를 그대로 테이블에 출력(레드액션 없음)` |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | security, productionReadiness |

**현재 상태:**
- TODO/FIXME 스캔은 개발 편의성에 유용하지만, 발견 텍스트가 그대로 보고서에 포함됩니다.

**문제점 (Problem):**
- 비민감 파일 경로라도 TODO/FIXME 코멘트에 토큰/키가 섞여 있을 경우, 보고서/공유 산출물로 확산될 수 있습니다.

**영향 (Impact):**
- 우발적 민감 정보 노출 가능성 증가, 공유 기능 사용 부담 증가.

**원인 (Cause):**
- findings 텍스트에 대한 “민감 문자열 레드액션” 정책이 존재하지 않습니다.

**개선 내용 (Proposed Solution):**
- findings 텍스트에 대해 토큰/키 형태 패턴을 마스킹(예: `sk-...`, `ghp_...`, `AKIA...` 등)하고, 마스킹 정책/테스트를 추가합니다.
- (권장) redaction은 공유 프리뷰뿐 아니라, 보고서 생성 파이프라인에서도 방어적으로 적용합니다.

**기대 효과:**
- TODO/FIXME 기능을 유지하면서도, 우발적 노출 가능성을 낮춥니다.

**✅ 완료 기준(Definition of Done):**
- [ ] TODO/FIXME findings 텍스트 레드액션 규칙 추가
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] `pnpm -C vibereport-extension run compile` 통과
- [ ] `pnpm -C vibereport-extension run lint` 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과

---

#### [P2-3] 레포 산출물 파일 정리 및 `.gitignore` 반영(`tmp_lines.txt`)

| 항목 | 내용 |
|------|------|
| **ID** | `repo-ignore-artifacts-001` |
| **카테고리** | 🧹 유지보수 |
| **복잡도** | Low |
| **대상 파일** | `.gitignore`, `tmp_lines.txt` |
| **Evidence** | `.gitignore: vsctoken/state는 제외하지만 tmp_lines.txt는 제외 규칙이 없음`<br/>`tmp_lines.txt: 레포 루트에 잔존하며 코드에서 참조되지 않음` |
| **Origin** | manual-idea |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | maintainability, codeQuality |

**현재 상태:**
- 레포 루트에 `tmp_lines.txt` 같은 임시 산출물 파일이 남아 있습니다.

**문제점 (Problem):**
- 스캔/리포트 근거 데이터에 불필요한 노이즈를 추가하고, 레포 상태를 혼동시키는 원인이 됩니다.

**영향 (Impact):**
- 유지보수 비용 증가, 분석 결과 신뢰도 저하(“무엇이 산출물인지” 혼동).

**원인 (Cause):**
- 산출물 파일 정리/ignore 규칙이 일관되게 관리되지 않았습니다.

**개선 내용 (Proposed Solution):**
- `tmp_lines.txt`를 제거하거나 `.gitignore`에 추가하여 레포에 남지 않도록 합니다.
- (선택) 보고서 생성 파이프라인이 임시 파일을 남기지 않도록 점검합니다.

**기대 효과:**
- 레포 위생 개선, 스캔/분석 노이즈 감소.

**✅ 완료 기준(Definition of Done):**
- [ ] `tmp_lines.txt` 정리(삭제 또는 ignore)
- [ ] `.gitignore` 반영 및 로컬 확인
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **중복/재사용 기회:** 스캔/리포트 갱신/마커 조작 로직은 캐시·유틸로 재사용되나, 성능 측정 지점(타이밍 로그) 표준화가 있으면 최적화 근거가 더 명확해집니다.
- **타입 안정성:** 프로덕션 코드에서는 `any` 사용을 최소화하고, 오류 처리에서 `unknown` + 타입 가드로 안전성을 높이는 방식이 유리합니다.
- **I/O 성능:** 대형 워크스페이스에서 반복 I/O(특히 후보 파일 콘텐츠 read) 구간이 병목이 될 수 있어 동시성 제한을 둔 병렬화가 효과적입니다.
- **에러 처리 표준화:** 닥터/스캐너/번들에서 “사용자 메시지 + 로그 + 복구 힌트” 형식을 통일하면 운영 효율이 향상됩니다.

### 🚀 코드 최적화 (OPT-1)

#### [OPT-1] TODO/FIXME 스캔 I/O 병렬화(동시성 제한)

| 항목 | 내용 |
|------|------|
| **ID** | `opt-todo-scan-parallel-001` |
| **카테고리** | ⚙️ 성능 튜닝 / 🚀 코드 최적화 |
| **영향 범위** | 성능 |
| **대상 파일** | `vibereport-extension/src/services/workspaceScanner/todoFixmeScanner.ts` |

**현재 상태:**
- 후보 파일(최대 300개)에 대해 `fs.stat`은 병렬 처리(동시성 제한)가 적용되어 있으나,
- 콘텐츠 읽기(`readFile`)는 후보 순서대로 순차 처리되어 I/O 지연이 누적될 수 있습니다.

**최적화 내용:**
- 콘텐츠 읽기를 “동시성 제한(예: 8~16)”을 둔 병렬 처리로 전환하되, 결과는 후보 파일 순서를 유지한 채로 합쳐서(결정적 결과) 기존 동작과 동일한 출력이 나오도록 합니다.
- 캐시 키/무효화 로직과 maxFindings/maxFileBytes 등의 제한은 유지합니다.
- 성능 회귀 방지를 위해 단위 테스트(동일 입력 → 동일 출력)와 간단 측정 지표를 추가합니다.

**예상 효과:**
- 대형 워크스페이스에서 TODO/FIXME 스캔 단계의 체감 시간이 감소하고, 보고서 업데이트 전체 지연이 완화됩니다(특히 I/O 대기 구간).

**측정 지표:**
- (필수) `pnpm -C vibereport-extension run compile`/`lint`/`test:run` 통과
- (권장) 동일 파일 목록에서 스캔 단계 실행 시간(예: p95) 감소 확인
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] Share Report/번들 프리뷰 i18n(언어/날짜 로케일) 지원

| 항목 | 내용 |
|------|------|
| **ID** | `feat-share-preview-i18n-001` |
| **카테고리** | ✨ 기능 추가 / 🧰 UX |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/src/commands/shareReport.ts`, `vibereport-extension/src/commands/exportReportBundle.ts`, `vibereport-extension/package.json`, `vibereport-extension/src/commands/__tests__/shareReportPreview.test.ts`, `vibereport-extension/src/commands/__tests__/exportReportBundle.test.ts` |
| **Evidence** | `vibereport-extension/src/commands/shareReport.ts: 프리뷰 문구/날짜가 ko-KR + 한국어 템플릿에 고정`<br/>`vibereport-extension/package.json: vibereport.language(ko/en) 설정 존재` |
| **Origin** | manual-idea |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | documentation, productionReadiness |

**기능 목적:**
- 보고서 언어 설정(`vibereport.language`)에 맞춰 Share Report/번들 프리뷰의 제목·라벨·날짜 로케일을 일관되게 제공합니다.

**현재 상태:**
- 프리뷰는 한국어 문구와 `ko-KR` 날짜 포맷을 고정으로 사용하여, 영어 보고서/영어 사용자 환경에서 일관성이 떨어질 수 있습니다.

**제안 구현 전략:**
- (1) config.language에 따라 프리뷰 템플릿 문자열(헤더/라벨)과 날짜 로케일을 분기합니다.
- (2) P2 항목(`quality-share-preview-marker-extraction-001`)과 결합하여 TL;DR/점수표 추출이 언어에 독립적으로 동작하도록 합니다.
- (3) 테스트에서 `language='en'`일 때 영문 헤더가 포함되는지, `language='ko'`일 때 기존 출력이 유지되는지 확인합니다.

**기대 효과:**
- 공유 프리뷰 UX 일관성 개선, 다국어 사용자 대상 신뢰도 향상.

**✅ 완료 기준:**
- [ ] `vibereport.language`에 따라 프리뷰 문구/날짜가 일관되게 생성됨
- [ ] 관련 테스트 추가/수정 및 통과
- [ ] `pnpm -C vibereport-extension run test:run` 통과
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 코파일럿 챗에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
