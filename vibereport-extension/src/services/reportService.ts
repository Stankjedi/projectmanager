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
  TodoFixmeFinding,
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
import {
  hasMarkers,
  replaceManyBetweenMarkersLines,
} from '../utils/markerUtils.js';
import {
  EXECUTION_CHECKLIST_BLOCK_REGEX,
  findExecutionChecklistHeadingIndex,
} from '../utils/promptChecklistUtils.js';
import {
  createEvaluationTemplate as buildEvaluationTemplate,
  createImprovementTemplate as buildImprovementTemplate,
  createSessionHistoryTemplate as buildSessionHistoryTemplate,
} from './reportTemplates.js';
import { linkifyTableFilePaths } from './reportLinkify.js';
import { formatImprovementList, formatImprovementSummary, formatTodoFixmeFindingsSection } from './reportService/improvementFormatting.js';
import {
  SESSION_HISTORY_MARKERS,
  buildPrependedSessionHistorySessionListBlock,
  buildSessionHistoryStatsContent,
  ensureManagedSessionHistoryBlocks,
  formatSessionEntry,
} from './reportService/sessionHistoryUtils.js';
import { writeFileIfChanged } from './reportService/writeFileIfChanged.js';

const TODO_FIXME_SECTION_MARKERS = {
  START: '<!-- AUTO-TODO-FIXME-START -->',
  END: '<!-- AUTO-TODO-FIXME-END -->',
} as const;

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
  getReportPaths(rootPath: string, config: VibeReportConfig): ReportPaths & { sessionHistory: string; prompt: string } {
    const reportDir = path.join(rootPath, config.reportDirectory);
    return {
      evaluation: path.join(reportDir, REPORT_FILE_NAMES.evaluation),
      improvement: path.join(reportDir, REPORT_FILE_NAMES.improvement),
      sessionHistory: path.join(reportDir, 'Session_History.md'),
      prompt: path.join(reportDir, 'Prompt.md'),
    };
  }

  /**
   * 적용 완료된 개선 항목을 보고서 파일에서 제거
   *
   * @description Remove completed improvement items from improvement report and Prompt.md
   * @param rootPath 워크스페이스 루트 경로
   * @param config Vibe Report 설정
   * @param appliedImprovements 적용 완료된 항목 목록
   * @returns 제거된 항목 수
   */
  async cleanupAppliedItems(
    rootPath: string,
    config: VibeReportConfig,
    appliedImprovements: AppliedImprovement[]
  ): Promise<{ improvementRemoved: number; promptRemoved: number }> {
    if (appliedImprovements.length === 0) {
      return { improvementRemoved: 0, promptRemoved: 0 };
    }

    const paths = this.getReportPaths(rootPath, config);
    const appliedIds = new Set(appliedImprovements.map(i => i.id));
    const appliedTitles = new Set(appliedImprovements.map(i => i.title.toLowerCase()));

    let improvementRemoved = 0;
    let promptRemoved = 0;

    // 개선 보고서에서 적용 완료 항목 제거
    try {
      const improvementContent = await fs.readFile(paths.improvement, 'utf-8');
      const { content: cleanedImprovement, removedCount: impCount } = this.removeAppliedItemsFromContent(
        improvementContent,
        appliedIds,
        appliedTitles,
        'improvement'
      );

      if (impCount > 0) {
        await fs.writeFile(paths.improvement, cleanedImprovement, 'utf-8');
        improvementRemoved = impCount;
        this.log(`개선 보고서에서 적용 완료 항목 ${impCount}개 제거됨`);
      }
    } catch (error) {
      this.log(`개선 보고서 클린업 실패: ${error}`);
    }

    // Prompt.md에서 적용 완료 항목 제거
    try {
      const promptContent = await fs.readFile(paths.prompt, 'utf-8');
      const { content: cleanedPrompt, removedCount: promptCount } = this.removeAppliedItemsFromContent(
        promptContent,
        appliedIds,
        appliedTitles,
        'prompt'
      );

      if (promptCount > 0) {
        await fs.writeFile(paths.prompt, cleanedPrompt, 'utf-8');
        promptRemoved = promptCount;
        this.log(`Prompt.md에서 적용 완료 항목 ${promptCount}개 제거됨`);
      }
    } catch (error) {
      this.log(`Prompt.md 클린업 실패: ${error}`);
    }

    return { improvementRemoved, promptRemoved };
  }

  /**
   * 콘텐츠에서 적용 완료 항목 제거
   */
  private removeAppliedItemsFromContent(
    content: string,
    appliedIds: Set<string>,
    appliedTitles: Set<string>,
    type: 'improvement' | 'prompt'
  ): { content: string; removedCount: number } {
    let removedCount = 0;
    let result = content;

    // ID 기반 제거 패턴들
    for (const id of appliedIds) {
      // 개선 보고서 형식: ### 🔴 긴급 (P1) 항목명 또는 #### [P1-1] 항목명 등
      // ID가 포함된 섹션 찾기: | **ID** | `id` | 형태
      const idPattern = new RegExp(
        `(###[^#]*?\\|\\s*\\*\\*ID\\*\\*\\s*\\|\\s*\`${this.escapeRegex(id)}\`[\\s\\S]*?)(?=\\n###|\\n## |$)`,
        'gi'
      );

      if (idPattern.test(result)) {
        result = result.replace(idPattern, '');
        removedCount++;
      }
    }

    // 제목 기반 제거 (ID가 없는 경우 폴백)
    for (const title of appliedTitles) {
      // 프롬프트 형식: ### [PROMPT-001] Title 또는 ### [OPT-1] Title
      const promptTitlePattern = new RegExp(
        `(###\\s*\\[(?:PROMPT-\\d+|OPT-\\d+)\\]\\s*${this.escapeRegex(title)}[\\s\\S]*?)(?=\\n###\\s*\\[(?:PROMPT-|OPT-)|\\n##\\s+|\\*\\*🎉|$)`,
        'gi'
      );

      if (promptTitlePattern.test(result)) {
        const before = result;
        result = result.replace(promptTitlePattern, '');
        if (result !== before) {
          removedCount++;
        }
      }

      // 개선 보고서 형식: #### [P1-1] Title 또는 ### 🟡 중요 (P2) - Title
      const improvementTitlePattern = new RegExp(
        `((?:###|####)\\s*(?:\\[P[123]-\\d+\\]|[🔴🟡🟢⚡].*?)\\s*${this.escapeRegex(title)}[\\s\\S]*?)(?=\\n(?:###|####)|\\n## |$)`,
        'gi'
      );

      if (improvementTitlePattern.test(result)) {
        const before = result;
        result = result.replace(improvementTitlePattern, '');
        if (result !== before) {
          removedCount++;
        }
      }
    }

    // Prompt.md의 Execution Checklist에서 완료된 프롬프트 행 제거
    if (type === 'prompt') {
      const checklistMatch = result.match(
        EXECUTION_CHECKLIST_BLOCK_REGEX
      );

      if (checklistMatch) {
        const originalChecklist = checklistMatch[0];
        let checklist = originalChecklist;

        // ID 또는 제목이 포함된 테이블 행 제거
        for (const id of appliedIds) {
          const rowPatternById = new RegExp(
            `^\\|\\s*\\d+\\s*\\|[^|]*${this.escapeRegex(id)}[^|]*\\|[^|]*\\|[^|]*\\|\\s*$`,
            'gmi'
          );
          checklist = checklist.replace(rowPatternById, () => {
            removedCount++;
            return '';
          });
        }

        for (const title of appliedTitles) {
          const rowPatternByTitle = new RegExp(
            `^\\|\\s*\\d+\\s*\\|[^|]*\\|[^|]*${this.escapeRegex(title)}[^|]*\\|[^|]*\\|[^|]*\\|\\s*$`,
            'gmi'
          );
          checklist = checklist.replace(rowPatternByTitle, () => {
            removedCount++;
            return '';
          });
        }

        if (checklist !== originalChecklist) {
          result = result.replace(originalChecklist, checklist);
        }
      }
    }

    // 연속된 빈 줄 정리
    result = result.replace(/\n{3,}/g, '\n\n');
    // 연속된 구분선 정리
    result = result.replace(/(\n---\n){2,}/g, '\n---\n');

    // Prompt.md의 체크리스트 요약 갱신
    if (type === 'prompt') {
      result = this.updatePromptChecklistSummary(result);
    }

    return { content: result, removedCount };
  }

  /**
   * 정규식 특수문자 이스케이프
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Prompt.md Execution Checklist 요약(Total/Completed/Remaining) 갱신
   */
  private updatePromptChecklistSummary(content: string): string {
    const lines = content.split('\n');

    const checklistHeaderIndex = findExecutionChecklistHeadingIndex(lines);
    if (checklistHeaderIndex === -1) {
      return content;
    }

    const alignmentRowIndex = lines.findIndex(
      (line, index) => index > checklistHeaderIndex && line.trim().startsWith('|:')
    );
    if (alignmentRowIndex === -1) {
      return content;
    }

    const rows: string[] = [];
    for (let i = alignmentRowIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim().startsWith('|')) {
        break;
      }
      rows.push(line);
    }

    const promptRowCount = rows.filter((line) => /\|\s*\d+\s*\|/.test(line)).length;

    const summaryIndex = lines.findIndex(
      (line, index) => index > alignmentRowIndex && line.includes('**Total:')
    );

    if (summaryIndex === -1) {
      return lines.join('\n');
    }

    lines[summaryIndex] = `**Total: ${promptRowCount} prompts** | **Completed: 0** | **Remaining: ${promptRowCount}**`;

    return lines.join('\n');
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
   */
  createEvaluationTemplate(snapshot: ProjectSnapshot, language: 'ko' | 'en'): string {
    return buildEvaluationTemplate({
      snapshot,
      language,
      mainLanguage: this.getMainLanguage(snapshot),
      framework: this.getFramework(snapshot),
    });
  }

  /**
   * 개선 보고서 초기 템플릿 생성
   */
  createImprovementTemplate(snapshot: ProjectSnapshot, language: 'ko' | 'en'): string {
    return buildImprovementTemplate({ snapshot, language });
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
      content = buildEvaluationTemplate({
        snapshot,
        language: config.language,
        mainLanguage: this.getMainLanguage(snapshot),
        framework: this.getFramework(snapshot),
      });
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
    const evaluationWritten = await writeFileIfChanged(paths.evaluation, content);
    this.log(
      evaluationWritten
        ? `평가 보고서 업데이트 완료: ${paths.evaluation}`
        : `평가 보고서 변경 없음: ${paths.evaluation}`
    );
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
      content = buildImprovementTemplate({
        snapshot,
        language: config.language,
      });
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
    const improvementListMd = formatImprovementList(allPendingItems, config.language, rootPath);

    const summaryMd = formatImprovementSummary(
      allPendingItems,
      appliedImprovements.length,
      config.language
    );

    const canBatchReplace =
      hasMarkers(
        content,
        MARKERS.IMPROVEMENT_LIST_START,
        MARKERS.IMPROVEMENT_LIST_END
      ) &&
      hasMarkers(content, MARKERS.SUMMARY_START, MARKERS.SUMMARY_END);

    if (canBatchReplace) {
      const replacements = [
        {
          startMarker: MARKERS.IMPROVEMENT_LIST_START,
          endMarker: MARKERS.IMPROVEMENT_LIST_END,
          newBlock: `${improvementListMd}\n`,
        },
        {
          startMarker: MARKERS.SUMMARY_START,
          endMarker: MARKERS.SUMMARY_END,
          newBlock: `${summaryMd}\n`,
        },
      ];

      content = replaceManyBetweenMarkersLines(content, replacements);
    } else {
      // legacy: preserve fallback behavior when markers are missing
      content = replaceBetweenMarkers(
        content,
        MARKERS.IMPROVEMENT_LIST_START,
        MARKERS.IMPROVEMENT_LIST_END,
        improvementListMd
      );
      content = replaceBetweenMarkers(
        content,
        MARKERS.SUMMARY_START,
        MARKERS.SUMMARY_END,
        summaryMd
      );
    }

    const todoFixmeFindingsMd = formatTodoFixmeFindingsSection(
      snapshot.todoFixmeFindings ?? [],
      config.language
    );
    content = replaceBetweenMarkers(
      content,
      TODO_FIXME_SECTION_MARKERS.START,
      TODO_FIXME_SECTION_MARKERS.END,
      todoFixmeFindingsMd
    );

    // 저장 전 테이블 내 파일 경로도 링크화
    content = linkifyTableFilePaths(rootPath, content);

    // 파일 저장 (세션 로그는 Session_History.md에서 관리)
    const improvementWritten = await writeFileIfChanged(paths.improvement, content);
    this.log(
      improvementWritten
        ? `개선 보고서 업데이트 완료: ${paths.improvement}`
        : `개선 보고서 변경 없음: ${paths.improvement}`
    );
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
      content = buildSessionHistoryTemplate();
    }

    content = ensureManagedSessionHistoryBlocks(content);

    const statsContent = buildSessionHistoryStatsContent(content, totalSessions, appliedCount, session.timestamp);

    const sessionEntry = formatSessionEntry(session);
    const nextSessionListBlock = buildPrependedSessionHistorySessionListBlock(content, sessionEntry, session.id);

    const replacements = [
      {
        startMarker: SESSION_HISTORY_MARKERS.STATS_START,
        endMarker: SESSION_HISTORY_MARKERS.STATS_END,
        newBlock: statsContent,
      },
      ...(nextSessionListBlock
        ? [
            {
              startMarker: SESSION_HISTORY_MARKERS.SESSION_LIST_START,
              endMarker: SESSION_HISTORY_MARKERS.SESSION_LIST_END,
              newBlock: nextSessionListBlock,
            },
          ]
        : []),
    ];

    content = replaceManyBetweenMarkersLines(content, replacements);

    const sessionWritten = await writeFileIfChanged(paths.sessionHistory, content);
    this.log(
      sessionWritten
        ? `세션 히스토리 업데이트 완료: ${paths.sessionHistory}`
        : `세션 히스토리 변경 없음: ${paths.sessionHistory}`
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
