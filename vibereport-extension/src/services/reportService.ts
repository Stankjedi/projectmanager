/**
 * Report Service
 *
 * @description Handles creation, reading, and marker-based updates for evaluation
 * and improvement reports so only intended sections are modified.
 *
 * @example
 * const service = new ReportService(outputChannel);
 * const paths = service.getReportPaths(rootPath, config);
 * await service.updateEvaluationReport(rootPath, config, snapshot, diff, userPrompt, aiContent);
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  ProjectSnapshot,
  SnapshotDiff,
  ReportPaths,
  VibeReportConfig,
  AppliedImprovement,
  ProjectEvaluationScores,
  EvaluationScore,
  EvaluationCategory,
} from '../models/types.js';
import { REPORT_FILE_NAMES, EVALUATION_CATEGORY_LABELS } from '../models/types.js';
import type { SessionRecord } from '../models/types.js';
import {
  MARKERS,
  appendBetweenMarkers,
  replaceBetweenMarkers,
  extractBetweenMarkers,
  parseImprovementItems,
  filterAppliedImprovements,
  formatDateTimeKorean,
} from '../utils/markdownUtils.js';

export class ReportService {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * 보고서 파일 경로 계산
   *
   * @description Resolve absolute report paths based on workspace root and config.
   * @param rootPath 워크스페이스 루트 경로
   * @param config Vibe Report 설정
   * @returns 평가/개선 보고서의 절대 경로
   */
  getReportPaths(rootPath: string, config: VibeReportConfig): ReportPaths & { sessionHistory: string } {
    const reportDir = path.join(rootPath, config.reportDirectory);
    return {
      evaluation: path.join(reportDir, REPORT_FILE_NAMES.evaluation),
      improvement: path.join(reportDir, REPORT_FILE_NAMES.improvement),
      sessionHistory: path.join(reportDir, 'Session_History.md'),
    };
  }

  /**
   * 보고서 디렉토리 확인/생성
   *
   * @description Ensure the report directory exists before writing any file.
   * @param rootPath 워크스페이스 루트
   * @param config Vibe Report 설정
   */
  async ensureReportDirectory(rootPath: string, config: VibeReportConfig): Promise<void> {
    const reportDir = path.join(rootPath, config.reportDirectory);
    try {
      await fs.mkdir(reportDir, { recursive: true });
    } catch {
      // 이미 존재
    }
  }

  /**
   * 평가 보고서 읽기
   *
   * @param rootPath 워크스페이스 루트
   * @param config Vibe Report 설정
   * @returns 내용 문자열 또는 존재하지 않으면 null
   */
  async readEvaluationReport(
    rootPath: string,
    config: VibeReportConfig
  ): Promise<string | null> {
    const paths = this.getReportPaths(rootPath, config);
    try {
      return await fs.readFile(paths.evaluation, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * 개선 보고서 읽기
   *
   * @param rootPath 워크스페이스 루트
   * @param config Vibe Report 설정
   * @returns 내용 문자열 또는 존재하지 않으면 null
   */
  async readImprovementReport(
    rootPath: string,
    config: VibeReportConfig
  ): Promise<string | null> {
    const paths = this.getReportPaths(rootPath, config);
    try {
      return await fs.readFile(paths.improvement, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * 평가 보고서 초기 템플릿 생성
   *
   * @description Create a localized evaluation report skeleton with marker blocks.
   * @param snapshot 현재 프로젝트 스냅샷
   * @param language ko/en
   */
  createEvaluationTemplate(snapshot: ProjectSnapshot, language: 'ko' | 'en'): string {
    const now = formatDateTimeKorean(new Date());
    const version = snapshot.mainConfigFiles.packageJson?.version || '-';
    
    if (language === 'ko') {
      return `# 📊 프로젝트 종합 평가 보고서

> 이 문서는 Vibe Coding Report VS Code 확장에서 자동으로 관리됩니다.  
> 수동 수정 시 확장의 동작에 영향을 줄 수 있습니다.

---

<!-- AUTO-TLDR-START -->
## 🎯 TL;DR (한눈에 보기)

| 항목 | 값 |
|------|-----|
| **전체 등급** | - |
| **전체 점수** | -/100 |
| **가장 큰 리스크** | 첫 분석 후 표시됩니다 |
| **권장 최우선 작업** | 첫 분석 후 표시됩니다 |

*첫 번째 분석 후 요약이 표시됩니다.*
<!-- AUTO-TLDR-END -->

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
| **주요 언어** | ${this.getMainLanguage(snapshot)} |
| **프레임워크** | ${this.getFramework(snapshot)} |
${MARKERS.OVERVIEW_END}

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

<!-- AUTO-RISK-SUMMARY-START -->
## ⚠️ 리스크 요약

| 리스크 레벨 | 항목 | 관련 개선 ID |
|------------|------|-------------|
| - | 첫 분석 후 표시됩니다 | - |

*첫 번째 분석 후 리스크가 표시됩니다.*
<!-- AUTO-RISK-SUMMARY-END -->

---

<!-- AUTO-SCORE-MAPPING-START -->
## 🎯 점수 ↔ 개선 항목 매핑

| 카테고리 | 현재 점수 | 주요 리스크 | 관련 개선 항목 ID |
|----------|----------|------------|------------------|
| - | - | 첫 분석 후 표시됩니다 | - |

*첫 번째 분석 후 매핑이 표시됩니다.*
<!-- AUTO-SCORE-MAPPING-END -->

---

<!-- AUTO-TREND-START -->
## 📈 평가 트렌드 (최근 5회)

| 회차 | 날짜 | 총점 | 코드품질 | 테스트 | 보안 |
|------|------|------|---------|--------|------|
| - | - | - | - | - | - |

*평가 이력이 쌓이면 트렌드가 표시됩니다.*
<!-- AUTO-TREND-END -->

---

${MARKERS.SUMMARY_START}
## 📈 현재 상태 요약

*아직 분석되지 않았습니다. 첫 번째 보고서 업데이트를 실행해주세요.*
${MARKERS.SUMMARY_END}

---

## 📝 세션 기록

> 📌 상세 세션 기록은 [\`Session_History.md\`](./Session_History.md) 파일을 참조하세요.
`;
    }

    // English version
    return `# 📊 Project Evaluation Report

> This document is automatically managed by Vibe Coding Report VS Code extension.  
> Manual modifications may affect the extension's behavior.

---

<!-- AUTO-TLDR-START -->
## 🎯 TL;DR (At a Glance)

| Item | Value |
|------|-------|
| **Overall Grade** | - |
| **Overall Score** | -/100 |
| **Top Risk** | Will be displayed after first analysis |
| **Recommended Priority Action** | Will be displayed after first analysis |

*Summary will be displayed after the first analysis.*
<!-- AUTO-TLDR-END -->

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
| **Main Language** | ${this.getMainLanguage(snapshot)} |
| **Framework** | ${this.getFramework(snapshot)} |
${MARKERS.OVERVIEW_END}

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

<!-- AUTO-RISK-SUMMARY-START -->
## ⚠️ Risk Summary

| Risk Level | Item | Related Improvement ID |
|------------|------|------------------------|
| - | Will be displayed after first analysis | - |

*Risks will be displayed after the first analysis.*
<!-- AUTO-RISK-SUMMARY-END -->

---

<!-- AUTO-SCORE-MAPPING-START -->
## 🎯 Score ↔ Improvement Mapping

| Category | Current Score | Main Risk | Related Improvement IDs |
|----------|--------------|-----------|------------------------|
| - | - | Will be displayed after first analysis | - |

*Mapping will be displayed after the first analysis.*
<!-- AUTO-SCORE-MAPPING-END -->

---

<!-- AUTO-TREND-START -->
## 📈 Evaluation Trend (Last 5)

| # | Date | Total | Code Quality | Test | Security |
|---|------|-------|--------------|------|----------|
| - | - | - | - | - | - |

*Trends will be displayed as evaluation history accumulates.*
<!-- AUTO-TREND-END -->

---

${MARKERS.SUMMARY_START}
## 📈 Current Status Summary

*Not analyzed yet. Please run the first report update.*
${MARKERS.SUMMARY_END}

---

## 📝 Session Log

> 📌 For detailed session history, please refer to [\`Session_History.md\`](./Session_History.md).
`;
  }

  /**
   * 개선 보고서 초기 템플릿 생성
   *
   * @description Create a localized improvement report skeleton with marker blocks.
   * @param snapshot 현재 프로젝트 스냅샷
   * @param language ko/en
   */
  createImprovementTemplate(snapshot: ProjectSnapshot, language: 'ko' | 'en'): string {
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
| ✅ 적용 완료 | 0 |
${MARKERS.SUMMARY_END}

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

---

## 📜 분석 이력

> 📌 상세 분석 이력은 [\`Session_History.md\`](./Session_History.md) 파일을 참조하세요.
`;
    }

    // English version
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
| ✅ Applied | 0 |
${MARKERS.SUMMARY_END}

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

---

## 📜 Analysis History

> 📌 For detailed analysis history, please refer to [\`Session_History.md\`](./Session_History.md).
`;
  }

  /**
   * 평가 보고서 업데이트
   *
   * @description Update overview, score, and session sections for the evaluation report.
   * @param rootPath 워크스페이스 루트
   * @param config Vibe Report 설정
   * @param snapshot 현재 스냅샷
   * @param diff 이전 스냅샷 대비 변경사항
   * @param userPrompt 사용자 입력
   * @param aiContent AI 응답 요약
   * @param evaluationScores 선택적 평가 점수
   */
  async updateEvaluationReport(
    rootPath: string,
    config: VibeReportConfig,
    snapshot: ProjectSnapshot,
    diff: SnapshotDiff,
    userPrompt: string,
    aiContent: string,
    evaluationScores?: ProjectEvaluationScores
  ): Promise<void> {
    await this.ensureReportDirectory(rootPath, config);
    const paths = this.getReportPaths(rootPath, config);

    let content = await this.readEvaluationReport(rootPath, config);

    // 파일이 없으면 템플릿 생성
    if (!content) {
      content = this.createEvaluationTemplate(snapshot, config.language);
    }

    // 프로젝트 개요 업데이트 (현재 스냅샷 기반)
    content = this.updateProjectOverview(content, snapshot, config.language);

    // 점수 섹션 업데이트 (점수가 있는 경우)
    if (evaluationScores) {
      const { formatScoreTable } = require('../utils/markdownUtils.js');
      const scoreTableMd = formatScoreTable(evaluationScores, config.language);
      const scoreSection = `## 📊 ${config.language === 'ko' ? '종합 점수 요약' : 'Score Summary'}\n\n${scoreTableMd}`;
      content = replaceBetweenMarkers(content, MARKERS.SCORE_START, MARKERS.SCORE_END, scoreSection);
    }

    // 파일 저장 (세션 로그는 Session_History.md에서 관리)
    await fs.writeFile(paths.evaluation, content, 'utf-8');
    this.log(`평가 보고서 업데이트 완료: ${paths.evaluation}`);
  }

  /**
   * 프로젝트 개요 업데이트
   * - 버전, 최근 분석일, 파일 수, 디렉토리 수 등을 현재 스냅샷 기반으로 업데이트
   */
  private updateProjectOverview(
    content: string,
    snapshot: ProjectSnapshot,
    language: 'ko' | 'en'
  ): string {
    const now = formatDateTimeKorean(new Date());
    const version = snapshot.mainConfigFiles.packageJson?.version || '-';
    
    // 기존 개요에서 최초 분석일 추출
    const existingOverview = extractBetweenMarkers(content, MARKERS.OVERVIEW_START, MARKERS.OVERVIEW_END);
    let firstAnalyzedDate = now;
    
    if (existingOverview) {
      // 최초 분석일 패턴 매칭
      const firstAnalyzedMatch = existingOverview.match(/\*\*(?:최초 분석일|First Analyzed)\*\*\s*\|\s*(.+?)\s*\|/);
      if (firstAnalyzedMatch) {
        firstAnalyzedDate = firstAnalyzedMatch[1].trim();
      }
    }

    const overviewContent = language === 'ko'
      ? `## 📋 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **프로젝트명** | ${snapshot.projectName} |
| **버전** | ${version} |
| **최초 분석일** | ${firstAnalyzedDate} |
| **최근 분석일** | ${now} |
| **파일 수** | ${snapshot.filesCount} |
| **디렉토리 수** | ${snapshot.dirsCount} |
| **주요 언어** | ${this.getMainLanguage(snapshot)} |
| **프레임워크** | ${this.getFramework(snapshot)} |`
      : `## 📋 Project Overview

| Item | Value |
|------|-------|
| **Project Name** | ${snapshot.projectName} |
| **Version** | ${version} |
| **First Analyzed** | ${firstAnalyzedDate} |
| **Last Analyzed** | ${now} |
| **Files** | ${snapshot.filesCount} |
| **Directories** | ${snapshot.dirsCount} |
| **Main Language** | ${this.getMainLanguage(snapshot)} |
| **Framework** | ${this.getFramework(snapshot)} |`;

    // 마커가 있으면 교체, 없으면 추가
    if (content.includes(MARKERS.OVERVIEW_START)) {
      return replaceBetweenMarkers(content, MARKERS.OVERVIEW_START, MARKERS.OVERVIEW_END, overviewContent);
    } else {
      // 마커가 없는 기존 보고서 - "## 📋 프로젝트 개요" 섹션을 찾아서 마커로 감싸기
      const overviewPattern = language === 'ko'
        ? /## 📋 프로젝트 개요[\s\S]*?(?=\n---|\n##|\n<!-- AUTO)/
        : /## 📋 Project Overview[\s\S]*?(?=\n---|\n##|\n<!-- AUTO)/;
      
      if (overviewPattern.test(content)) {
        return content.replace(overviewPattern, `${MARKERS.OVERVIEW_START}\n${overviewContent}\n${MARKERS.OVERVIEW_END}`);
      }
      
      return content;
    }
  }

  /**
   * 개선 보고서 업데이트
   *
   * @description Filter out applied items, merge new AI suggestions, and rewrite summary/list/session sections.
   * @param rootPath 워크스페이스 루트
   * @param config Vibe Report 설정
   * @param snapshot 현재 스냅샷
   * @param diff 스냅샷 diff (로그 작성용)
   * @param userPrompt 사용자 입력
   * @param aiContent AI 응답 본문
   * @param appliedImprovements 이미 적용된 개선 항목 목록
   */
  async updateImprovementReport(
    rootPath: string,
    config: VibeReportConfig,
    snapshot: ProjectSnapshot,
    diff: SnapshotDiff,
    userPrompt: string,
    aiContent: string,
    appliedImprovements: AppliedImprovement[]
  ): Promise<void> {
    await this.ensureReportDirectory(rootPath, config);
    const paths = this.getReportPaths(rootPath, config);

    let content = await this.readImprovementReport(rootPath, config);

    // 파일이 없으면 템플릿 생성
    if (!content) {
      content = this.createImprovementTemplate(snapshot, config.language);
    }

    // 적용된 항목 ID 집합
    const appliedIds = new Set(appliedImprovements.map(i => i.id));

    // AI 응답에서 개선 항목 파싱
    const newItems = parseImprovementItems(aiContent);
    
    // 기존 개선 목록 가져오기
    const existingContent = extractBetweenMarkers(
      content,
      MARKERS.IMPROVEMENT_LIST_START,
      MARKERS.IMPROVEMENT_LIST_END
    ) || '';

    const existingItems = parseImprovementItems(existingContent);

    // 기존 항목 중 적용되지 않은 것만 유지
    const pendingExistingItems = existingItems.filter(
      item => !appliedIds.has(item.id) && !item.applied
    );

    // 새 항목 중 중복/적용된 것 제외
    const existingIds = new Set(existingItems.map(i => i.id));
    const newUniqueItems = newItems.filter(
      item => !existingIds.has(item.id) && !appliedIds.has(item.id)
    );

    // 개선 목록 재구성 (새 항목 + 기존 미적용 항목)
    const allPendingItems = [...newUniqueItems, ...pendingExistingItems];
    
    // 우선순위별 정렬
    allPendingItems.sort((a, b) => {
      const priorityOrder: Record<string, number> = { P1: 0, P2: 1, P3: 2, OPT: 3 };
      return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    });

    // 개선 목록 마크다운 생성
    const improvementListMd = this.formatImprovementList(allPendingItems, config.language);

    // 개선 목록 섹션 업데이트
    content = replaceBetweenMarkers(
      content,
      MARKERS.IMPROVEMENT_LIST_START,
      MARKERS.IMPROVEMENT_LIST_END,
      improvementListMd
    );

    // 요약 업데이트
    const summaryMd = this.formatImprovementSummary(
      allPendingItems,
      appliedImprovements.length,
      config.language
    );
    content = replaceBetweenMarkers(
      content,
      MARKERS.SUMMARY_START,
      MARKERS.SUMMARY_END,
      summaryMd
    );

    // 파일 저장 (세션 로그는 Session_History.md에서 관리)
    await fs.writeFile(paths.improvement, content, 'utf-8');
    this.log(`개선 보고서 업데이트 완료: ${paths.improvement}`);
  }

  /**
   * 개선 항목 목록 포맷
   */
  private formatImprovementList(
    items: Array<{ id: string; priority: 'P1' | 'P2' | 'P3' | 'OPT'; title: string; description: string }>,
    language: 'ko' | 'en'
  ): string {
    if (items.length === 0) {
      return language === 'ko' 
        ? '모든 개선 항목이 적용되었습니다! 🎉\n\n다음 분석에서 새로운 개선점이 발견될 수 있습니다.'
        : 'All improvements have been applied! 🎉\n\nNew improvements may be found in the next analysis.';
    }

    const lines: string[] = [];
    
    // 우선순위별 그룹
    const byPriority: Record<string, typeof items> = { P1: [], P2: [], P3: [], OPT: [] };
    items.forEach(item => {
      if (byPriority[item.priority]) {
        byPriority[item.priority].push(item);
      }
    });

    const priorityLabels = {
      ko: { P1: '🔴 긴급 (P1)', P2: '🟡 중요 (P2)', P3: '🟢 개선 (P3)', OPT: '🚀 최적화 (OPT)' },
      en: { P1: '🔴 Critical (P1)', P2: '🟡 Important (P2)', P3: '🟢 Nice to have (P3)', OPT: '🚀 Optimization (OPT)' },
    };

    for (const priority of ['P1', 'P2', 'P3', 'OPT'] as const) {
      const priorityItems = byPriority[priority];
      if (priorityItems && priorityItems.length > 0) {
        lines.push(`\n### ${priorityLabels[language][priority]}`);
        lines.push('');

        for (const item of priorityItems) {
          lines.push(`#### [${priority}] ${item.title}`);
          lines.push('');
          lines.push(`> 항목 ID: \`${item.id}\``);
          lines.push('');
          lines.push(item.description);
          lines.push('');
          lines.push('---');
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 개선 요약 포맷 - 미적용 항목만 표시
   */
  private formatImprovementSummary(
    pendingItems: Array<{ priority: 'P1' | 'P2' | 'P3' | 'OPT' }>,
    appliedCount: number,
    language: 'ko' | 'en'
  ): string {
    const counts: Record<string, number> = { P1: 0, P2: 0, P3: 0, OPT: 0 };
    pendingItems.forEach(item => {
      if (counts[item.priority] !== undefined) {
        counts[item.priority]++;
      }
    });

    const total = counts.P1 + counts.P2 + counts.P3 + counts.OPT;

    if (language === 'ko') {
      return `## 📊 개선 현황 요약

| 우선순위 | 미적용 개수 |
|----------|------------|
| 🔴 긴급 (P1) | ${counts.P1} |
| 🟡 중요 (P2) | ${counts.P2} |
| 🟢 개선 (P3) | ${counts.P3} |
| 🚀 최적화 (OPT) | ${counts.OPT} |
| **총 미적용** | **${total}** |`;
    }

    return `## 📊 Improvement Status Summary

| Priority | Pending Count |
|----------|---------------|
| 🔴 Critical (P1) | ${counts.P1} |
| 🟡 Important (P2) | ${counts.P2} |
| 🟢 Nice to have (P3) | ${counts.P3} |
| 🚀 Optimization (OPT) | ${counts.OPT} |
| **Total Pending** | **${total}** |`;
  }

  /**
   * Diff 요약 포맷
   */
  private formatDiffSummary(diff: SnapshotDiff): string {
    if (diff.isInitial) {
      return '초기 분석 (이전 스냅샷 없음)';
    }

    const parts: string[] = [];

    if (diff.newFiles.length > 0) {
      parts.push(`새 파일 ${diff.newFiles.length}개`);
    }
    if (diff.removedFiles.length > 0) {
      parts.push(`삭제된 파일 ${diff.removedFiles.length}개`);
    }
    if (diff.changedConfigs.length > 0) {
      parts.push(`설정 변경: ${diff.changedConfigs.join(', ')}`);
    }
    if (diff.gitChanges) {
      const gc = diff.gitChanges;
      const total = gc.modified.length + gc.added.length + gc.deleted.length;
      if (total > 0) {
        parts.push(`Git 변경 ${total}개`);
      }
    }

    return parts.length > 0 ? parts.join(' | ') : '변경사항 없음';
  }

  /**
   * 주요 언어 추출
   */
  private getMainLanguage(snapshot: ProjectSnapshot): string {
    const stats = Object.entries(snapshot.languageStats);
    if (stats.length === 0) return 'Unknown';
    
    stats.sort((a, b) => b[1] - a[1]);
    const top = stats[0][0];
    
    const langMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript (React)',
      js: 'JavaScript',
      py: 'Python',
      rs: 'Rust',
      go: 'Go',
    };
    
    return langMap[top] || top.toUpperCase();
  }

  /**
   * 프레임워크 추출
   */
  private getFramework(snapshot: ProjectSnapshot): string {
    const configs = snapshot.mainConfigFiles;
    
    if (configs.tauriConfig) return 'Tauri';
    if (configs.packageJson) {
      const deps = [...configs.packageJson.dependencies, ...configs.packageJson.devDependencies];
      if (deps.includes('next')) return 'Next.js';
      if (deps.includes('react')) return 'React';
      if (deps.includes('vue')) return 'Vue';
      if (deps.includes('express')) return 'Express';
      if (deps.includes('fastify')) return 'Fastify';
    }
    if (configs.cargoToml) return 'Rust/Cargo';
    
    return '-';
  }

  /**
   * 보고서 파일 열기
   *
   * @description Open evaluation or improvement report in VS Code.
   * @param rootPath 워크스페이스 루트
   * @param config Vibe Report 설정
   * @param type 평가/개선 구분
   */
  async openReport(
    rootPath: string,
    config: VibeReportConfig,
    type: 'evaluation' | 'improvement'
  ): Promise<void> {
    const paths = this.getReportPaths(rootPath, config);
    const filePath = type === 'evaluation' ? paths.evaluation : paths.improvement;

    try {
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(`보고서 파일을 열 수 없습니다: ${error}`);
    }
  }

  /**
   * 보고서 존재 여부 확인
   *
   * @param rootPath 워크스페이스 루트
   * @param config Vibe Report 설정
   * @returns 두 보고서가 모두 존재하면 true
   */
  async reportsExist(rootPath: string, config: VibeReportConfig): Promise<boolean> {
    const paths = this.getReportPaths(rootPath, config);
    
    try {
      await fs.access(paths.evaluation);
      await fs.access(paths.improvement);
      return true;
    } catch {
      return false;
    }
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[ReportService] ${message}`);
  }

  /**
   * 세션 히스토리 파일 업데이트
   * 
   * @description 세션 기록을 Session_History.md 파일에 저장합니다.
   * 이 파일은 평가 보고서의 세션 로그를 대체하여 보고서 크기를 줄입니다.
   */
  async updateSessionHistoryFile(
    rootPath: string,
    config: VibeReportConfig,
    session: SessionRecord,
    totalSessions: number,
    appliedCount: number
  ): Promise<void> {
    await this.ensureReportDirectory(rootPath, config);
    const paths = this.getReportPaths(rootPath, config);

    let content: string;
    try {
      content = await fs.readFile(paths.sessionHistory, 'utf-8');
    } catch {
      // 파일이 없으면 헤더 생성
      content = this.createSessionHistoryTemplate();
    }

    // 통계 업데이트
    content = this.updateSessionHistoryStats(content, totalSessions, appliedCount);

    // 새 세션 로그 추가 (맨 위에)
    const sessionEntry = this.formatSessionEntry(session);
    content = this.prependSessionToHistory(content, sessionEntry);

    await fs.writeFile(paths.sessionHistory, content, 'utf-8');
    this.log(`세션 히스토리 업데이트 완료: ${paths.sessionHistory}`);
  }

  /**
   * 세션 히스토리 템플릿 생성
   */
  private createSessionHistoryTemplate(): string {
    return `# 📜 세션 히스토리

> 이 문서는 Vibe Coding Report VS Code 확장에서 자동으로 관리됩니다.
> 모든 분석 세션 기록이 이 파일에 저장됩니다.

---

<!-- STATS-START -->
## 📊 통계 요약

| 항목 | 값 |
|------|-----|
| **총 세션 수** | 0 |
| **적용 완료** | 0 |
| **마지막 업데이트** | - |
<!-- STATS-END -->

---

<!-- SESSION-LIST-START -->
## 📝 세션 기록

*세션 기록이 여기에 추가됩니다.*
<!-- SESSION-LIST-END -->
`;
  }

  /**
   * 세션 히스토리 통계 업데이트
   */
  private updateSessionHistoryStats(
    content: string,
    totalSessions: number,
    appliedCount: number
  ): string {
    const now = formatDateTimeKorean(new Date());
    const statsContent = `## 📊 통계 요약

| 항목 | 값 |
|------|-----|
| **총 세션 수** | ${totalSessions} |
| **적용 완료** | ${appliedCount} |
| **마지막 업데이트** | ${now} |`;

    if (content.includes('<!-- STATS-START -->')) {
      return content.replace(
        /<!-- STATS-START -->[\s\S]*?<!-- STATS-END -->/,
        `<!-- STATS-START -->\n${statsContent}\n<!-- STATS-END -->`
      );
    }

    return content;
  }

  /**
   * 세션 엔트리 포맷
   */
  private formatSessionEntry(session: SessionRecord): string {
    const date = new Date(session.timestamp);
    const formattedDate = formatDateTimeKorean(date);

    let entry = `### 📅 ${formattedDate}

| 항목 | 값 |
|------|-----|
| **세션 ID** | \`${session.id}\` |
| **작업** | ${session.userPrompt} |
| **새 파일** | ${session.diffSummary.newFilesCount}개 |
| **삭제 파일** | ${session.diffSummary.removedFilesCount}개 |
| **설정 변경** | ${session.diffSummary.changedConfigsCount}개 |
| **총 변경** | ${session.diffSummary.totalChanges}개 |`;

    if (session.aiMetadata) {
      entry += `
| **개선 제안** | ${session.aiMetadata.improvementsProposed || 0}개 |
| **리스크 감지** | ${session.aiMetadata.risksIdentified || 0}개 |`;
      
      if (session.aiMetadata.overallScore) {
        entry += `
| **품질 점수** | ${session.aiMetadata.overallScore}/100 |`;
      }
    }

    entry += '\n\n---\n';

    return entry;
  }

  /**
   * 세션을 히스토리 맨 앞에 추가
   */
  private prependSessionToHistory(content: string, entry: string): string {
    const sessionListStart = '<!-- SESSION-LIST-START -->';
    const sessionListEnd = '<!-- SESSION-LIST-END -->';

    if (!content.includes(sessionListStart)) {
      return content;
    }

    const existing = content.match(/<!-- SESSION-LIST-START -->\s*([\s\S]*?)\s*<!-- SESSION-LIST-END -->/);
    let existingContent = existing ? existing[1].trim() : '';

    // 초기 메시지 제거
    if (existingContent.includes('세션 기록이 여기에 추가됩니다')) {
      existingContent = '';
    }

    // 제목 처리
    const headerLine = '## 📝 세션 기록\n\n';
    if (existingContent.startsWith('## 📝')) {
      existingContent = existingContent.replace(/^## 📝 세션 기록\n*/, '');
    }

    const newContent = `${headerLine}${entry}\n${existingContent}`.trim();

    return content.replace(
      /<!-- SESSION-LIST-START -->[\s\S]*?<!-- SESSION-LIST-END -->/,
      `${sessionListStart}\n${newContent}\n${sessionListEnd}`
    );
  }

  /**
   * 세션 히스토리 파일 읽기
   */
  async readSessionHistory(rootPath: string, config: VibeReportConfig): Promise<string | null> {
    const paths = this.getReportPaths(rootPath, config);
    try {
      return await fs.readFile(paths.sessionHistory, 'utf-8');
    } catch {
      return null;
    }
  }
}
