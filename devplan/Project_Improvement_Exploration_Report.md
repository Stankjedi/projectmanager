# 🚀 프로젝트 개선 탐색 보고서

> 이 문서는 Vibe Coding Report VS Code 확장에서 자동으로 관리됩니다.  
> **미적용 개선 항목만 표시됩니다. 적용 완료된 항목은 자동으로 제외됩니다.**
> 
> 💡 **구체적인 구현 코드는 `Prompt.md` 파일을 참조하세요.**

---

<!-- AUTO-OVERVIEW-START -->
## 📋 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프로젝트명** | projectmanager (vibereport-extension) |
| **버전** | 0.2.1 |
| **최초 분석일** | 2025-11-30 00:48 |
| **최근 분석일** | 2025-12-01 17:16 |
<!-- AUTO-OVERVIEW-END -->

---

<!-- AUTO-SUMMARY-START -->
## 📊 개선 현황 요약

### 현황 개요

| 우선순위 | 개수 | 설명 |
|----------|------|------|
| 🔴 긴급 (P1) | 0 | - |
| 🟡 중요 (P2) | 2 | ReportService 단위 테스트, README/문서 동기화 |
| 🟢 개선 (P3) | 2 | 보고서 내보내기 기능, 평가 점수 커스터마이징 |
| **총 미적용** | **4** | - |

### 카테고리별 분포

| 카테고리 | 개수 | 항목 |
|----------|------|------|
| 🧪 테스트 | 1 | `ReportService` 단위 테스트 |
| 📚 문서화 | 1 | `README.md`와 설정 동기화 |
| ✨ 기능 추가 | 2 | 팀 공유용 내보내기, 점수 커스터마이즈 |

### 우선순위별 요약

**🟡 P2 - 다음 릴리즈 전 권장:**
1.  **`ReportService` 단위 테스트 보강**: 핵심 보고서 생성/수정 로직의 안정성을 위해 직접적인 단위 테스트가 필요합니다.
2.  **문서 동기화**: `README.md`의 아키텍처 설명과 설정 옵션을 최신 코드베이스와 일치시켜야 합니다.

**🟢 P3 - 점진적 개선:**
1.  **보고서 내보내기 기능 추가**: 생성된 보고서를 팀원과 쉽게 공유할 수 있는 `Export` 명령을 추가합니다.
2.  **평가 점수 커스터마이징**: 사용자가 프로젝트 특성에 맞게 평가 항목과 가중치를 설정할 수 있도록 유연성을 제공합니다.
<!-- AUTO-SUMMARY-END -->

---

## 🔧 기능 개선 항목

> 기존 기능의 품질, 보안, 성능을 향상시키는 항목입니다.

<!-- AUTO-IMPROVEMENT-LIST-START -->

### 🟡 중요 (P2)

#### [P2-1] ReportService 단위 테스트 보강

| 항목 | 내용 |
|------|------|
| **ID** | `report-test-001` |
| **카테고리** | 🧪 테스트 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/services/reportService.ts`, `vibereport-extension/src/services/__tests__/reportService.test.ts` |

**현재 상태:** ReportService는 평가/개선 보고서의 핵심 로직을 담당하지만, marker 기반 업데이트와 세션 로그 생성에 대한 직접적인 단위 테스트가 없습니다.

**개선 내용:**  
- `updateEvaluationReport`, `updateImprovementReport`의 정상/에러 시나리오 테스트 추가  
- 마커 구간(`AUTO-OVERVIEW`, `AUTO-SCORE`, `AUTO-SUMMARY`, `AUTO-SESSION-LOG`) 업데이트 동작 검증  
- 적용된 개선항목 필터링 로직과 세션 로그 prepend 동작 검증  
- 한국어/영어 언어 설정에 따른 템플릿 생성 결과 확인

**기대 효과:** 보고서 섹션 손상 위험 감소, 리팩토링 시 회귀 버그 방지, 복잡한 문자열 처리 로직에 대한 신뢰도 향상

---

#### [P2-2] README 및 설정 문서 동기화

| 항목 | 내용 |
|------|------|
| **ID** | `docs-sync-001` |
| **카테고리** | 📚 문서화 |
| **복잡도** | Low |
| **대상 파일** | `vibereport-extension/README.md`, `vibereport-extension/package.json` |

**현재 상태:** README의 아키텍처 다이어그램과 설정 설명이 현재 코드 구조와 일부 불일치합니다(예: 제거된 `aiClient.ts` 언급, 갱신된 설정 키가 문서에 반영되지 않음).

**개선 내용:**  
- 실제 `src/` 디렉토리 구조와 일치하도록 아키텍처 섹션 업데이트  
- `contributes.configuration`에 정의된 설정 키/기본값/설명을 README 설정 표에 반영  
- 새로 추가된 명령(`openPrompt`, `showSessionDetail` 등)과 devplan 워크플로우를 사용 예시로 보강  
- TypeDoc로 생성 가능한 API 문서 위치를 README에서 간단히 안내

**기대 효과:** 첫 사용자 온보딩 속도 향상, 설정 오해 감소, 코드 변경과 문서 간 불일치로 인한 혼란 최소화

---

<!-- AUTO-IMPROVEMENT-LIST-END -->

---

## ✨ 기능 추가 항목

> 새로운 기능을 추가하는 항목입니다.

<!-- AUTO-FEATURE-LIST-START -->

### 🟢 개선 (P3)

#### [P3-1] 팀 공유용 보고서 내보내기 기능

| 항목 | 내용 |
|------|------|
| **ID** | `share-export-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/commands/updateReports.ts`, `vibereport-extension/src/extension.ts` |

**현재 상태:** devplan 내 마크다운 보고서는 로컬 워크스페이스 기준으로만 관리되며, 팀원과 공유하려면 사용자가 직접 파일을 복사/압축해야 합니다.

**추가 기능:**  
- `Vibe Report: Export Reports`와 같은 새 명령을 추가하여 `devplan/` 디렉토리를 ZIP 또는 단일 Markdown/HTML 번들로 내보내기  
- 내보내기 대상 디렉토리 선택 UI 제공 (워크스페이스 내/외부)  
- 내보내기 완료 후 상태바/알림을 통해 경로 안내

**기대 효과:** 팀/리뷰어와 보고서를 쉽게 공유할 수 있어 협업 효율 증가, 외부 리뷰 플로우와의 연동이 용이해짐

---

#### [P3-2] 평가 점수 및 가중치 커스터마이즈

| 항목 | 내용 |
|------|------|
| **ID** | `scoring-config-001` |
| **카테고리** | ✨ 기능 추가 |
| **복잡도** | Medium |
| **대상 파일** | `vibereport-extension/src/models/types.ts`, `vibereport-extension/src/utils/markdownUtils.ts`, `vibereport-extension/package.json` |

**현재 상태:** 평가 카테고리(코드 품질, 아키텍처, 보안 등)와 점수 가중치는 고정되어 있으며, 팀별 기준이나 프로젝트 특성에 맞게 조정할 수 없습니다.

**추가 기능:**  
- `vibereport` 설정에 평가 카테고리/가중치/표시 여부를 정의할 수 있는 스키마 추가  
- `markdownUtils.ts`의 점수/등급 계산 로직을 설정 기반으로 동작하도록 리팩터링  
- 평가 보고서의 점수 테이블이 커스터마이즈된 카테고리/가중치를 반영하도록 템플릿 개선

**기대 효과:** 팀/프로젝트 별 품질 기준을 그대로 반영하는 평가 보고서 생성 가능, 장기적으로 다양한 도메인(웹/백엔드/모바일 등)에 재사용성 향상

---

<!-- AUTO-FEATURE-LIST-END -->

---

## 📜 분석 이력

<!-- AUTO-SESSION-LOG-START -->

> 📖 **전체 세션 히스토리는 `Session_History.md` 파일을 참조하세요.**

### 최근 분석 세션 (v0.2.1)

| 날짜 | 분석 유형 | 주요 내용 |
|------|----------|----------|
| 2025-12-01 17:16 | 버그수정/기능추가 | v0.2.0→v0.2.1: 세션 트래킹 버그 수정, Session_History.md 파일 지원 추가 |
| 2025-12-01 12:00 | 기능 추가 | v0.1.0→v0.2.0: Project Vision 기능 추가 |
| 2025-12-01 09:42 | 테스트 수정 | View 테스트 수정, Prompt.md 템플릿 개선, 49개 테스트 통과 |

<!-- AUTO-SESSION-LOG-END -->

---

## 📌 사용 방법

1. **개선 항목 검토:** 이 보고서에서 적용할 항목 선택
2. **프롬프트 확인:** `Prompt.md` 파일에서 해당 항목의 구체적인 구현 코드 확인
3. **AI 에이전트에 요청:** 프롬프트를 복사하여 Copilot Chat에 붙여넣기
4. **적용 확인:** 다음 보고서 업데이트 시 적용된 항목 자동 제외
