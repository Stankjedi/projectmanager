import type { ProjectSnapshot } from '../models/types.js';
import { MARKERS, formatDateTimeKorean } from '../utils/markdownUtils.js';

export function createEvaluationTemplate(args: {
  snapshot: ProjectSnapshot;
  language: 'ko' | 'en';
  mainLanguage: string;
  framework: string;
}): string {
  const { snapshot, language, mainLanguage, framework } = args;
  const now = formatDateTimeKorean(new Date());
  const version = snapshot.mainConfigFiles.packageJson?.version || '-';

  if (language === 'ko') {
    return `# 📊 프로젝트 종합 평가 보고서

> 이 문서는 Vibe Coding Report VS Code 확장에서 자동으로 관리됩니다.

---

${MARKERS.OVERVIEW_START}
## 📋 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **프로젝트명** | ${snapshot.projectName} |
| **버전** | ${version} |
| **최초 분석일** | ${now} |
| **최근 분석일** | ${now} |
| **파일 수** | ${snapshot.filesCount} |
| **디렉토리 수** | ${snapshot.dirsCount} |
| **주요 언어** | ${mainLanguage} |
| **프레임워크** | ${framework} |
${MARKERS.OVERVIEW_END}

---

<!-- AUTO-STRUCTURE-START -->
## 📐 프로젝트 구조

${snapshot.structureDiagram || '*프로젝트 구조 다이어그램이 생성 중입니다...*'}
<!-- AUTO-STRUCTURE-END -->

---

${MARKERS.SCORE_START}
## 📊 종합 점수 요약

| 항목 | 점수 (100점 만점) | 등급 | 변화 |
|------|------------------|------|------|
| **코드 품질** | - | - | - |
| **아키텍처 설계** | - | - | - |
| **보안** | - | - | - |
| **성능** | - | - | - |
| **테스트 커버리지** | - | - | - |
| **에러 처리** | - | - | - |
| **문서화** | - | - | - |
| **확장성** | - | - | - |
| **유지보수성** | - | - | - |
| **프로덕션 준비도** | - | - | - |
| **총점 평균** | **-** | **-** | - |

*첫 번째 분석 후 점수가 표시됩니다.*
${MARKERS.SCORE_END}

---

<!-- AUTO-DETAIL-START -->
## 🔍 기능별 상세 평가

*첫 번째 분석 후 상세 평가가 표시됩니다.*
<!-- AUTO-DETAIL-END -->

---

<!-- AUTO-TREND-START -->
## 📈 버전별 점수 추이

| 버전 | 날짜 | 총점 | 주요 변경 |
|------|------|------|----------|
| - | - | - | - |

*버전 업데이트 시 점수 추이가 기록됩니다.*
<!-- AUTO-TREND-END -->
`;
  }

  return `# 📊 Project Evaluation Report

> This document is automatically managed by Vibe Coding Report VS Code extension.

---

${MARKERS.OVERVIEW_START}
## 📋 Project Overview

| Item | Value |
|------|-------|
| **Project Name** | ${snapshot.projectName} |
| **Version** | ${version} |
| **First Analyzed** | ${now} |
| **Last Analyzed** | ${now} |
| **Files** | ${snapshot.filesCount} |
| **Directories** | ${snapshot.dirsCount} |
| **Main Language** | ${mainLanguage} |
| **Framework** | ${framework} |
${MARKERS.OVERVIEW_END}

---

<!-- AUTO-STRUCTURE-START -->
## 📐 Project Structure

${snapshot.structureDiagram || '*Project structure diagram is being generated...*'}
<!-- AUTO-STRUCTURE-END -->

---

${MARKERS.SCORE_START}
## 📊 Score Summary

| Category | Score (out of 100) | Grade | Change |
|----------|-------------------|-------|--------|
| **Code Quality** | - | - | - |
| **Architecture Design** | - | - | - |
| **Security** | - | - | - |
| **Performance** | - | - | - |
| **Test Coverage** | - | - | - |
| **Error Handling** | - | - | - |
| **Documentation** | - | - | - |
| **Scalability** | - | - | - |
| **Maintainability** | - | - | - |
| **Production Readiness** | - | - | - |
| **Total Average** | **-** | **-** | - |

*Scores will be displayed after the first analysis.*
${MARKERS.SCORE_END}

---

<!-- AUTO-DETAIL-START -->
## 🔍 Detailed Feature Evaluation

*Detailed evaluation will be displayed after the first analysis.*
<!-- AUTO-DETAIL-END -->

---

<!-- AUTO-TREND-START -->
## 📈 Version Score Trend

| Version | Date | Total | Major Changes |
|---------|------|-------|---------------|
| - | - | - | - |

*Score trends will be recorded with version updates.*
<!-- AUTO-TREND-END -->
`;
}

export function createImprovementTemplate(args: {
  snapshot: ProjectSnapshot;
  language: 'ko' | 'en';
}): string {
  const { snapshot, language } = args;
  const now = formatDateTimeKorean(new Date());

  if (language === 'ko') {
    return `# 🚀 프로젝트 개선 탐색 보고서

> 이 문서는 Vibe Coding Report VS Code 확장에서 자동으로 관리됩니다.  
> **적용된 개선 항목은 자동으로 필터링되어 미적용 항목만 표시됩니다.**
>
> 💡 **구체적인 구현 코드는 \`Prompt.md\` 파일을 참조하세요.**

---

## 📋 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프로젝트명** | ${snapshot.projectName} |
| **최초 분석일** | ${now} |

---

<!-- AUTO-ERROR-EXPLORATION-START -->
## 🔍 오류 및 리스크 탐색 절차

> 이 섹션은 개선 항목이 어떤 기준으로 도출되었는지를 설명합니다.

### 1. 데이터 수집
- 최근 빌드/테스트/런타임 로그 분석
- VS Code 문제 패널(Problems) 확인
- Git diff 및 커밋 메시지 검토
- TODO/FIXME 주석 스캔

### 2. 자동 분석
- 테스트 실패/스킵 케이스 분류
- 빌드 오류/경고 메시지 그룹화
- 빈번하게 수정되는 파일/모듈 탐지
- 정적 분석(lint, type-check) 결과 검토

### 3. 개선 후보 도출
- 동일 원인의 오류/경고를 하나의 "개선 항목 후보"로 묶기
- 영향도(테스트 실패, 빌드 실패, 성능 저하)에 따라 우선순위 부여
- 프로젝트 비전과의 일치 여부 검토

### 4. 최종 백로그 정제
- 복잡도/리스크 대비 효용 검토
- Definition of Done 명시
- 관련 평가 점수 카테고리 매핑
<!-- AUTO-ERROR-EXPLORATION-END -->

---

## 📌 사용 방법

1. 이 보고서의 개선 항목을 검토합니다
2. 적용하고 싶은 항목을 선택하여 \`Prompt.md\`를 생성합니다
3. AI 에이전트(Copilot Chat 등)에 붙여넣어 구현을 요청합니다
4. 다음 보고서 업데이트 시 적용된 항목은 자동으로 제외됩니다

---

${MARKERS.SUMMARY_START}
## 📊 개선 현황 요약

| 상태 | 개수 |
|------|------|
| 🔴 긴급 (P1) | 0 |
| 🟡 중요 (P2) | 0 |
| 🟢 개선 (P3) | 0 |
| 🚀 최적화 | 0 |
${MARKERS.SUMMARY_END}

---

<!-- AUTO-TODO-FIXME-START -->
## 🧾 TODO/FIXME 발견 요약

*TODO/FIXME 항목이 없습니다.*
<!-- AUTO-TODO-FIXME-END -->

---

${MARKERS.IMPROVEMENT_LIST_START}
## 📝 개선 항목 목록

*아직 분석되지 않았습니다. 첫 번째 보고서 업데이트를 실행해주세요.*
${MARKERS.IMPROVEMENT_LIST_END}

---

${MARKERS.OPTIMIZATION_START}
## 🚀 코드 품질 및 성능 최적화

> 기존 기능을 해치지 않으면서 코드 품질과 성능을 향상시킬 수 있는 개선점입니다.

*아직 분석되지 않았습니다. 첫 번째 보고서 업데이트를 실행해주세요.*
${MARKERS.OPTIMIZATION_END}
`;
  }

  return `# 🚀 Project Improvement Exploration Report

> This document is automatically managed by Vibe Coding Report VS Code extension.  
> **Applied improvements are automatically filtered out - only pending items are shown.**
>
> 💡 **For concrete implementation code, refer to the \`Prompt.md\` file.**

---

## 📋 Project Information

| Item | Value |
|------|-------|
| **Project Name** | ${snapshot.projectName} |
| **First Analyzed** | ${now} |

---

<!-- AUTO-ERROR-EXPLORATION-START -->
## 🔍 Error and Risk Exploration Process

> This section explains how improvement items were derived.

### 1. Data Collection
- Recent build/test/runtime log analysis
- VS Code Problems panel review
- Git diff and commit message inspection
- TODO/FIXME comment scanning

### 2. Automated Analysis
- Test failure/skip case classification
- Build error/warning message grouping
- Frequently modified file/module detection
- Static analysis (lint, type-check) result review

### 3. Improvement Candidate Derivation
- Group errors/warnings with same root cause into one "improvement candidate"
- Assign priority based on impact (test failure, build failure, performance degradation)
- Review alignment with project vision

### 4. Final Backlog Refinement
- Evaluate complexity/risk vs. benefit
- Specify Definition of Done
- Map to related evaluation score categories
<!-- AUTO-ERROR-EXPLORATION-END -->

---

## 📌 How to Use

1. Review improvement items in this report
2. Select items you want to apply and generate \`Prompt.md\`
3. Paste to AI agent (like Copilot Chat) and request implementation
4. Applied items will be automatically excluded in the next update

---

${MARKERS.SUMMARY_START}
## 📊 Improvement Status Summary

| Status | Count |
|--------|-------|
| 🔴 Critical (P1) | 0 |
| 🟡 Important (P2) | 0 |
| 🟢 Nice to have (P3) | 0 |
| 🚀 Optimization | 0 |
${MARKERS.SUMMARY_END}

---

<!-- AUTO-TODO-FIXME-START -->
## 🧾 TODO/FIXME Findings Summary

*No TODO/FIXME findings.*
<!-- AUTO-TODO-FIXME-END -->

---

${MARKERS.IMPROVEMENT_LIST_START}
## 📝 Improvement Items

*Not analyzed yet. Please run the first report update.*
${MARKERS.IMPROVEMENT_LIST_END}

---

${MARKERS.OPTIMIZATION_START}
## 🚀 Code Quality & Performance Optimization

> Improvements that enhance code quality and performance without breaking existing functionality.

*Not analyzed yet. Please run the first report update.*
${MARKERS.OPTIMIZATION_END}
`;
}

export function createSessionHistoryTemplate(): string {
  return `# 📜 세션 히스토리

> 이 문서는 Vibe Coding Report VS Code 확장에서 자동으로 관리됩니다.
> 모든 분석 세션 기록이 이 파일에 저장됩니다.

---

<!-- STATS-START -->
## 📊 세션 통계

| 항목 | 값 |
|------|-----|
| **총 세션 수** | 0 |
| **첫 세션** | - |
| **마지막 세션** | - |
| **마지막 업데이트** | - |
| **적용 완료 항목** | 0 |
<!-- STATS-END -->

---

<!-- SESSION-LIST-START -->
## 🕐 전체 세션 기록

*세션 기록이 여기에 추가됩니다.*
<!-- SESSION-LIST-END -->
`;
}
