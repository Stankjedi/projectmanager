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
| **버전** | v0.3.29 |
| **분석 기준일** | 2025-12-15 |
| **테스트** | Vitest 107개 (스냅샷 기준) |
| **발행자** | stankjedi |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

### 1. 현황 개요 (미적용 항목만 집계)

| 우선순위 | 미적용 개수 | 설명 |
|:---|:---:|:---|
| 🔴 긴급 (P1) | 0 | 현재 크리티컬한 버그 없음 |
| 🟡 중요 (P2) | 2 | 테스트 보강 및 아키텍처 문서화 |
| 🟢 개선 (P3) | 1 | AI 프롬프트 커스터마이징 |
| ⚙️ OPT (최적화) | 1 | 대규모 프로젝트 스캔 성능 튜닝 |
| **총 미적용** | **4** | **P2 2개, P3 1개, OPT 1개** |

### 2. 항목별 분포 테이블 (검토 대기)

| # | 항목명 | 우선순위 | 카테고리 |
|:---:|:---|:---:|:---|
| 1 | **AI Service 단위 테스트** (`test-ai-service-001`) | P2 | 🧪 테스트 |
| 2 | **아키텍처 문서화** (`doc-architecture-001`) | P2 | 📝 문서화 |
| 3 | **프롬프트 사용자 설정** (`feat-ai-custom-prompt-001`) | P3 | ✨ 기능 추가 |
| 4 | **스캔 제외 패턴 최적화** (`opt-scanner-exclude-001`) | OPT | 🚀 성능 튜닝 |

### 3. 우선순위별 한줄 요약

- 🟡 **P2 (안정성):** AI 연동 로직의 신뢰성을 확보(`test`)하고, 프로젝트 구조를 명문화(`doc`)하여 유지보수 효율을 높여야 합니다.
- 🟢 **P3 (확장성):** 사용자가 원하는 스타일로 AI 답변을 유도할 수 있도록 `Custom Instruction` 기능을 추가합니다.
- ⚙️ **OPT (효율성):** 무거운 폴더(Rust, Python 가상환경 등)를 기본적으로 건너뛰도록 스캐너 설정을 개선합니다.
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->
### 🟡 중요 (P2)

#### [P2-1] AI Service 단위 테스트 추가 및 검증

| 항목 | 내용 |
|------|------|
| **ID** | `test-ai-service-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/services/__tests__/aiService.test.ts`(신규) |
| **Origin** | static-analysis |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | testCoverage, productionReadiness |

**현재 상태:**
- `AiService`가 핵심 기능이나 테스트 코드가 없어, 로직 변경 시 안전망이 부재합니다.
- 외부 API(`vscode.lm`) 의존성이 있어 실제 모델 없이도 동작을 검증할 수 있는 Mocking 테스트가 필수적입니다.

**문제점 (Problem):**
- 현재는 수동 실행으로만 동작을 확인해야 하므로, 배포 전 품질 검증 시간이 오래 걸립니다.

**개선 내용 (Proposed Solution):**
- `aiService.test.ts`를 생성하고 Vitest로 `vscode.lm` API를 모킹합니다.
- `isAvailable()` 메서드의 True/False 반환 시나리오를 테스트합니다.
- `runAnalysisPrompt()` 실행 시 정상 응답과 에러 발생(폴백) 케이스를 검증합니다.

**기대 효과:**
- AI 연동 로직 리팩토링 시 회귀 버그 방지 및 CI 파이프라인 신뢰도 상승.

**✅ Definition of Done:**
- [ ] `aiService.test.ts` 작성 및 `vi.mock` 설정 완료
- [ ] 정상/에러 시나리오 테스트 케이스 통과
- [ ] `pnpm run test` 실행 시 PASS 확인

#### [P2-2] 내부 아키텍처 문서화 (ARCHITECTURE.md)

| 항목 | 내용 |
|------|------|
| **ID** | `doc-architecture-001` |
| **카테고리** | 📝 문서화 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/docs/ARCHITECTURE.md`(신규), `vibereport-extension/README.md` |
| **Origin** | manual-idea |
| **리스크 레벨** | medium |
| **관련 평가 카테고리** | maintainability |

**현재 상태:**
- README만 존재하여, `ReportPreview`의 로컬 번들링 방식이나 스냅샷 증분 로직 등 '내부 구현'을 이해하기 어렵습니다.

**문제점 (Problem):**
- 오픈소스 기여를 받거나 팀원이 늘어날 때, 코드 맥락을 설명하는 데 반복적인 커뮤니케이션 비용이 발생합니다.

**개선 내용 (Proposed Solution):**
- `docs/ARCHITECTURE.md`를 신설하여 시스템 다이어그램과 핵심 모듈(Scanner, Snapshot, Report)의 역할을 기술합니다.
- 특히 **로컬 Mermaid 번들링** 이유(보안/오프라인)와 구현 방식을 명시합니다.

**기대 효과:**
- 코드 유지보수성 향상 및 신규 개발자의 온보딩 시간 단축.

**✅ Definition of Done:**
- [ ] `docs/ARCHITECTURE.md` 생성
- [ ] README.md에 아키텍처 문서 링크 추가
<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## 🚀 코드 품질 및 성능 최적화 제안

<!-- AUTO-OPTIMIZATION-START -->
### 🔎 OPT 일반 분석

- **중복 코드:** `configUtils`의 설정 병합 로직에서 `Array` 타입(배열) 병합 시, 기본값과 사용자 값의 중복 제거가 필요할 수 있습니다.
- **성능:** 대형 모노레포(파일 1만 개 이상) 스캔 시 `node_modules` 외에도 `.venv`, `.git` 등 무거운 폴더가 포함되면 초기 분석에 수십 초가 소요됩니다.

### 🚀 코드 최적화 (OPT-1)

| 항목 | 내용 |
|------|------|
| **ID** | `opt-scanner-exclude-001` |
| **카테고리** | ⚙️ 성능 튜닝 |
| **영향 범위** | 성능 |
| **대상 파일** | `vibereport-extension/package.json`, `vibereport-extension/src/utils/configUtils.ts` |

**현재 상태:**
- 기본 제외 패턴(`excludePatterns`)이 너무 단순하여(`node_modules`, `dist` 정도), 최신 프레임워크 부산물(예: `.next`, `__pycache__`, `.rust`, `.terraform`)을 걸러내지 못합니다.

**최적화 내용:**
- **패턴 확장:** `package.json`의 기본값에 `**/__pycache__/**`, `**/.venv/**`, `**/.terraform/**`, `**/.gradle/**`, `**/bin/**`, `**/obj/**` 등을 추가합니다.
- **설정 로직 개선:** 사용자가 제외 패턴을 추가할 때, 기본 중요 패턴이 실수로 지워지지 않도록 병합 정책을 검토합니다(현재 VS Code 동작에 따르되, 문서화 강화).

**예상 효과:**
- 스캔 대상 파일 수 20~30% 감소 및 분석 속도 2배 향상.
- 메모리 사용량 절감으로 익스텐션 성능 최적화.

**측정 지표:**
- 대형 오픈소스 레포지토리(예: vscode) 대상 스캔 시간 전후 비교.
<!-- AUTO-OPTIMIZATION-END -->

---

## ✨ 기능 추가 항목

> 새로운 기능을 추가하는 항목입니다.

<!-- AUTO-FEATURE-LIST-START -->
### 🟢 개선 (P3)

#### [P3-1] AI 시스템 프롬프트 설정 (Custom System Prompt)

| 항목 | 내용 |
|------|------|
| **ID** | `feat-ai-custom-prompt-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/package.json`, `vibereport-extension/src/utils/analysisPromptTemplate.ts` |
| **Origin** | manual-idea |
| **리스크 레벨** | low |
| **관련 평가 카테고리** | ux |

**현재 상태:**
- AI 분석 프롬프트가 소스코드 내 문자열로 고정되어 있어, "답변은 한국어로만 해줘" 같은 사용자별 요구사항을 반영할 수 없습니다.

**기능 목적:**
- `package.json` 설정에 `customInstructions` 항목을 추가하여, 프롬프트 생성 시 사용자가 정의한 규칙을 주입합니다.

**제안 기능:**
- `package.json` 설정: `vibereport.ai.customInstructions` (multiline text).
- `analysisPromptTemplate.ts` 로직: 설정값이 있으면 프롬프트 상단 `[User Instructions]` 섹션에 삽입합니다.

**기대 효과:**
- 단순 리포팅 도구를 넘어, 사용자 취향에 맞춘 개인화된 AI 에이전트로 활용성 증대.

**✅ Definition of Done:**
- [ ] `package.json` 설정 스키마 추가
- [ ] `analysisPromptTemplate.ts` 수정 및 단위 테스트 검증
<!-- AUTO-FEATURE-LIST-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인  
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
