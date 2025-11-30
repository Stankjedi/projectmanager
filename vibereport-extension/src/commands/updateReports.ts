/**
 * Update Reports Command
 *
 * @description Main workflow for scanning the workspace, generating prompts,
 * updating reports, and copying the analysis prompt to the clipboard.
 *
 * @example
 * const command = new UpdateReportsCommand(outputChannel);
 * await command.execute();
 */

import * as vscode from 'vscode';
import type {
  VibeReportConfig,
  ProjectSnapshot,
  SnapshotDiff,
} from '../models/types.js';
import {
  WorkspaceScanner,
  SnapshotService,
  ReportService,
} from '../services/index.js';
import { generateImprovementId } from '../utils/markdownUtils.js';

export class UpdateReportsCommand {
  private workspaceScanner: WorkspaceScanner;
  private snapshotService: SnapshotService;
  private reportService: ReportService;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.workspaceScanner = new WorkspaceScanner(outputChannel);
    this.snapshotService = new SnapshotService(outputChannel);
    this.reportService = new ReportService(outputChannel);
  }

  /**
   * 보고서 업데이트 실행
   *
   * @description Run a full scan, generate prompt, persist snapshot, and notify user.
   */
  async execute(): Promise<void> {
    // 워크스페이스 확인
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다. 프로젝트 폴더를 열어주세요.');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const projectName = workspaceFolders[0].name;

    // 설정 로드
    const config = this.loadConfig();

    // 기존 보고서 확인
    const reportsExist = await this.reportService.reportsExist(rootPath, config);
    const isFirstRun = !reportsExist;

    // 진행 표시
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Vibe Report: ${projectName}`,
        cancellable: false,
      },
      async (progress) => {
        try {
          await this.generatePromptAndCreateReports(rootPath, config, projectName, progress, isFirstRun);
        } catch (error) {
          this.log(`오류 발생: ${error}`);
          vscode.window.showErrorMessage(`보고서 업데이트 실패: ${error}`);
        }
      }
    );
  }

  /**
   * 프롬프트 생성 및 보고서 템플릿 생성
   */
  private async generatePromptAndCreateReports(
    rootPath: string,
    config: VibeReportConfig,
    projectName: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    isFirstRun: boolean
  ): Promise<void> {
    const reportProgress = (message: string, increment?: number) => {
      progress.report({ message, increment });
      this.log(message);
    };

    // 1. 프로젝트 스캔
    reportProgress('프로젝트 구조 스캔 중...', 20);
    const snapshot = await this.workspaceScanner.scan(config, reportProgress);

    // 2. 이전 상태 로드
    reportProgress('상태 분석 중...', 40);
    let state = await this.snapshotService.loadState(rootPath, config);
    if (!state) {
      state = this.snapshotService.createInitialState();
    }

    // 3. 스냅샷 비교
    const diff = await this.snapshotService.compareSnapshots(
      state.lastSnapshot,
      snapshot,
      rootPath,
      config
    );

    // 4. 보고서 디렉토리 및 템플릿 생성
    reportProgress('보고서 준비 중...', 60);
    await this.reportService.ensureReportDirectory(rootPath, config);
    
    const paths = this.reportService.getReportPaths(rootPath, config);
    const fs = await import('fs/promises');
    
    // 기존 보고서가 없으면 템플릿 생성
    if (isFirstRun) {
      const evalTemplate = this.reportService.createEvaluationTemplate(snapshot, config.language);
      const improvTemplate = this.reportService.createImprovementTemplate(snapshot, config.language);
      await fs.writeFile(paths.evaluation, evalTemplate, 'utf-8');
      await fs.writeFile(paths.improvement, improvTemplate, 'utf-8');
    }

    // 5. 프롬프트 생성
    reportProgress('분석 프롬프트 생성 중...', 80);
    const prompt = this.buildAnalysisPrompt(snapshot, diff, state.appliedImprovements, isFirstRun, config);

    // 6. 클립보드에 복사
    await vscode.env.clipboard.writeText(prompt);

    // 7. 스냅샷 저장
    state = this.snapshotService.updateSnapshot(state, snapshot);
    await this.snapshotService.saveState(rootPath, config, state);

    reportProgress('완료!', 100);

    // 8. 결과 알림
    const openChat = 'Copilot Chat 열기';
    const openEval = '평가 보고서 열기';
    const openImprove = '개선 보고서 열기';
    
    const message = isFirstRun
      ? `✅ [${projectName}] 초기 분석 프롬프트가 클립보드에 복사되었습니다!`
      : `✅ [${projectName}] 업데이트 프롬프트가 클립보드에 복사되었습니다!`;

    const result = await vscode.window.showInformationMessage(
      message + '\n\nCopilot Chat에 붙여넣기(Ctrl+V)하여 분석을 시작하세요.',
      openChat,
      openEval,
      openImprove
    );

    if (result === openChat) {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    } else if (result === openEval) {
      await this.reportService.openReport(rootPath, config, 'evaluation');
    } else if (result === openImprove) {
      await this.reportService.openReport(rootPath, config, 'improvement');
    }
  }

  /**
   * 분석 프롬프트 생성
   */
  private buildAnalysisPrompt(
    snapshot: ProjectSnapshot,
    diff: SnapshotDiff,
    appliedImprovements: import('../models/types.js').AppliedImprovement[],
    isFirstRun: boolean,
    config: VibeReportConfig
  ): string {
    const lines: string[] = [];

    // 보고서 파일 경로 계산
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const reportDir = workspaceFolder 
      ? `${workspaceFolder.uri.fsPath.replace(/\\/g, '/')}/${config.reportDirectory}`
      : config.reportDirectory;
    const evaluationPath = `${reportDir}/Project_Evaluation_Report.md`;
    const improvementPath = `${reportDir}/Project_Improvement_Exploration_Report.md`;
    const promptPath = `${reportDir}/Prompt.md`;

    lines.push('# 🔧 프로젝트 분석 및 보고서 작성 요청');
    lines.push('');
    lines.push(`현재 열린 **${snapshot.projectName}** 프로젝트를 분석하고, **아래 세 파일에 직접 보고서를 작성**해주세요.`);
    lines.push('');
    lines.push('## 🚨 필수 규칙: 파일 직접 수정 (텍스트 응답 금지)');
    lines.push('');
    lines.push('> **⛔ 절대 금지 사항:**');
    lines.push('> - 채팅으로 코드나 보고서 내용을 텍스트로 보여주는 것');
    lines.push('> - "다음과 같이 수정하세요" 라고 말만 하는 것');
    lines.push('> - 코드 블록으로 변경사항을 표시만 하는 것');
    lines.push('> ');
    lines.push('> **✅ 반드시 해야 하는 것:**');
    lines.push('> - `replace_string_in_file` 또는 `create_file` 도구를 사용하여 **직접 파일 수정**');
    lines.push('> - 모든 변경사항을 **실제 파일에 반영**');
    lines.push('> - 파일 수정 후 "파일을 수정했습니다" 라고 확인');
    lines.push('');
    lines.push('### 수정할 파일 목록:');
    lines.push('');
    lines.push(`1. **평가 보고서**: \`${evaluationPath}\``);
    lines.push(`2. **개선 보고서**: \`${improvementPath}\``);
    lines.push(`3. **프롬프트 파일**: \`${promptPath}\``);
    lines.push('');
    lines.push('**❗ 이 프롬프트를 받으면 즉시 파일 수정 도구를 호출하세요. 설명만 하지 마세요.**');
    lines.push('');
    lines.push('## 📝 대용량 파일 수정 지침');
    lines.push('');
    lines.push('**⚠️ 파일이 너무 클 경우 순차적으로 파트를 나눠서 수정하세요:**');
    lines.push('');
    lines.push('1. **파일 크기 확인**: 보고서 파일이 길면 한 번에 전체를 수정하지 마세요.');
    lines.push('2. **섹션별 수정**: `<!-- AUTO-*-START -->` 마커로 구분된 섹션을 하나씩 수정하세요.');
    lines.push('3. **수정 순서**:');
    lines.push('   - 1차: `<!-- AUTO-OVERVIEW-START -->` ~ `<!-- AUTO-OVERVIEW-END -->` (프로젝트 개요)');
    lines.push('   - 2차: `<!-- AUTO-SCORE-START -->` ~ `<!-- AUTO-SCORE-END -->` (점수 섹션)');
    lines.push('   - 3차: `<!-- AUTO-SUMMARY-START -->` ~ `<!-- AUTO-SUMMARY-END -->` (요약 섹션)');
    lines.push('   - 4차: `<!-- AUTO-SESSION-LOG-START -->` ~ `<!-- AUTO-SESSION-LOG-END -->` (세션 로그)');
    lines.push('   - 5차: `<!-- AUTO-IMPROVEMENT-LIST-START -->` ~ `<!-- AUTO-IMPROVEMENT-LIST-END -->` (개선 항목)');
    lines.push('4. **oldString 최소화**: 수정 시 oldString에 3~5줄의 컨텍스트만 포함하세요.');
    lines.push('5. **다중 수정**: 가능하면 multi_replace_string_in_file 도구로 여러 수정을 한 번에 처리하세요.');
    lines.push('');

    // 프로젝트 요약 정보
    lines.push('---');
    lines.push('');
    lines.push('## 📋 프로젝트 현황');
    lines.push('');
    lines.push(`- **프로젝트명**: ${snapshot.projectName}`);
    
    // 파일/디렉토리 수와 변화량 표시
    const filesChange = diff.filesCountDiff !== undefined && diff.filesCountDiff !== 0 
      ? ` (${diff.filesCountDiff > 0 ? '+' : ''}${diff.filesCountDiff})` 
      : '';
    const dirsChange = diff.dirsCountDiff !== undefined && diff.dirsCountDiff !== 0 
      ? ` (${diff.dirsCountDiff > 0 ? '+' : ''}${diff.dirsCountDiff})` 
      : '';
    
    lines.push(`- **파일 수**: ${snapshot.filesCount}개${filesChange}`);
    lines.push(`- **디렉토리 수**: ${snapshot.dirsCount}개${dirsChange}`);
    
    const topLanguages = Object.entries(snapshot.languageStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => `${lang}(${count})`)
      .join(', ');
    lines.push(`- **주요 언어**: ${topLanguages || '감지 안됨'}`);
    
    if (snapshot.mainConfigFiles.packageJson) {
      const pkg = snapshot.mainConfigFiles.packageJson;
      lines.push(`- **프로젝트 버전**: ${pkg.version || '-'}`);
      const mainDeps = pkg.dependencies.slice(0, 8).join(', ');
      if (mainDeps) {
        lines.push(`- **주요 의존성**: ${mainDeps}${pkg.dependencies.length > 8 ? '...' : ''}`);
      }
    }
    lines.push('');

    // 변경사항 (업데이트인 경우)
    if (!isFirstRun && !diff.isInitial) {
      lines.push('## 📝 이전 분석 이후 변경사항');
      lines.push('');
      if (diff.totalChanges === 0 && (diff.filesCountDiff === undefined || diff.filesCountDiff === 0)) {
        lines.push('- 변경사항 없음');
      } else {
        if (diff.filesCountDiff !== undefined && diff.filesCountDiff !== 0) {
          const changeType = diff.filesCountDiff > 0 ? '증가' : '감소';
          lines.push(`- 파일 수 ${changeType}: ${Math.abs(diff.filesCountDiff)}개`);
        }
        if (diff.newFiles.length > 0) {
          lines.push(`- 새 파일: ${diff.newFiles.length}개`);
          // 새 파일 목록 (최대 10개)
          diff.newFiles.slice(0, 10).forEach(f => {
            lines.push(`  - \`${f}\``);
          });
          if (diff.newFiles.length > 10) {
            lines.push(`  - ... 외 ${diff.newFiles.length - 10}개`);
          }
        }
        if (diff.removedFiles.length > 0) {
          lines.push(`- 삭제된 파일: ${diff.removedFiles.length}개`);
        }
        if (diff.changedConfigs.length > 0) {
          lines.push(`- 설정 변경: ${diff.changedConfigs.join(', ')}`);
        }
      }
      lines.push('');
    }

    // 적용된 개선사항
    if (appliedImprovements.length > 0) {
      lines.push('## ✅ 이미 적용된 개선사항 (제외 필수)');
      lines.push('');
      appliedImprovements.forEach(imp => {
        lines.push(`- ${imp.title}`);
      });
      lines.push('');
    }

    // ===== 평가 보고서 작성 요청 =====
    lines.push('---');
    lines.push('');
    lines.push('## 📊 작성 요청 1: 종합 평가 보고서');
    lines.push('');
    lines.push(`**파일 경로**: \`${evaluationPath}\``);
    lines.push('');
    lines.push('### 필수 포함 섹션:');
    lines.push('');
    lines.push('#### 1. 프로젝트 목표 및 비전');
    lines.push('- 프로젝트의 목적과 핵심 목표');
    lines.push('- 대상 사용자');
    lines.push('');
    lines.push('#### 2. 현재 구현된 기능');
    lines.push('테이블 형식으로 작성:');
    lines.push('```');
    lines.push('| 기능 | 상태 | 설명 | 평가 |');
    lines.push('|------|------|------|------|');
    lines.push('| 기능명 | ✅ 완료/🔄 부분/❌ 미구현 | 설명 | 🟢 우수/🟡 양호/🔴 미흡 |');
    lines.push('```');
    lines.push('');
    lines.push('#### 3. 종합 점수 테이블');
    lines.push('`<!-- AUTO-SCORE-START -->` 와 `<!-- AUTO-SCORE-END -->` 마커 사이에 작성:');
    lines.push('```');
    lines.push('| 항목 | 점수 (100점 만점) | 등급 | 변화 |');
    lines.push('|------|------------------|------|------|');
    lines.push('| 코드 품질 | ? | 🔵 B | ⬆️ +? |');
    lines.push('| ... | ... | ... | ... |');
    lines.push('```');
    lines.push('');
    lines.push('#### 4. 기능별 상세 평가');
    lines.push('각 주요 모듈/서비스별로:');
    lines.push('- 기능 완성도, 코드 품질, 에러 처리, 성능 점수');
    lines.push('- 강점과 약점');
    lines.push('');
    lines.push('#### 5. 현재 상태 요약');
    lines.push('`<!-- AUTO-SUMMARY-START -->` 와 `<!-- AUTO-SUMMARY-END -->` 마커 사이에 작성');
    lines.push('');
    lines.push('#### 6. 세션 로그 업데이트');
    lines.push('`<!-- AUTO-SESSION-LOG-START -->` 마커 사이에:');
    lines.push('- 현재 세션 정보를 **맨 앞에** 추가 (기존 로그 유지)');
    lines.push('- 날짜, 분석 내용, 주요 변경사항 기록');
    lines.push('');

    // ===== 개선 보고서 작성 요청 =====
    lines.push('---');
    lines.push('');
    lines.push('## 🚀 작성 요청 2: 개선 제안 보고서');
    lines.push('');
    lines.push(`**파일 경로**: \`${improvementPath}\``);
    lines.push('');
    lines.push('### ⚠️ 핵심 원칙: 미적용 항목만 표시');
    lines.push('');
    lines.push('**❌ 절대 금지:**');
    lines.push('- 이미 적용 완료된 항목을 보고서에 표시하지 마세요');
    lines.push('- "✅ 적용 완료" 섹션을 만들지 마세요');
    lines.push('- 완료된 항목의 히스토리를 개선 목록에 남기지 마세요');
    lines.push('');
    lines.push('**✅ 올바른 방법:**');
    lines.push('- 현재 시점에서 **아직 적용되지 않은** 개선 항목만 작성');
    lines.push('- 코드를 분석하여 **새로운 개선점** 발굴');
    lines.push('- 기존 미적용 항목 + 새 발견 항목만 포함');
    lines.push('');
    lines.push('### 필수 포함 섹션:');
    lines.push('');
    lines.push('#### 1. 전체 개선 현황 요약');
    lines.push('`<!-- AUTO-SUMMARY-START -->` 마커 사이에:');
    lines.push('- 현황 개요 테이블 (P1/P2/P3 **미적용** 개수만)');
    lines.push('- 카테고리별 분포');
    lines.push('- 우선순위별 한줄 요약');
    lines.push('- **적용 완료 항목 개수는 세션 로그에만 기록** (요약에서는 총 개수만 언급)');
    lines.push('');
    lines.push('#### 2. 🔧 기능 개선 항목 (기존 기능 개선)');
    lines.push('`<!-- AUTO-IMPROVEMENT-LIST-START -->` 마커 사이에:');
    lines.push('');
    lines.push('**미적용 항목만** 아래 형식으로 작성 (**코드 제외, 설명만**):');
    lines.push('```');
    lines.push('### 🟡 중요 (P2)');
    lines.push('');
    lines.push('#### [P2-1] 항목명');
    lines.push('| 항목 | 내용 |');
    lines.push('|------|------|');
    lines.push('| **ID** | `고유-id` |');
    lines.push('| **카테고리** | 🧪 테스트 / 🔒 보안 / 🧹 코드 품질 등 |');
    lines.push('| **복잡도** | Low / Medium / High |');
    lines.push('| **대상 파일** | 파일 경로 |');
    lines.push('');
    lines.push('**현재 상태:** ...');
    lines.push('**개선 내용:** ...');
    lines.push('**기대 효과:** ...');
    lines.push('```');
    lines.push('');
    lines.push('#### 3. ✨ 기능 추가 항목 (새 기능)');
    lines.push('`<!-- AUTO-FEATURE-LIST-START -->` 마커 사이에:');
    lines.push('- 위와 동일한 형식으로 새 기능 제안 (**미적용 항목만**)');
    lines.push('');
    lines.push('#### 4. 세션 로그 업데이트');
    lines.push('`<!-- AUTO-SESSION-LOG-START -->` 마커 사이에:');
    lines.push('- 현재 세션 정보 **맨 앞에** 추가');
    lines.push('- 날짜, 분석 내용, 새로 발견된 항목 수, 적용 완료된 항목 수 기록');
    lines.push('');

    // ===== 프롬프트 파일 작성 요청 (영어) =====
    lines.push('---');
    lines.push('');
    lines.push('## 🤖 Request 3: AI Prompt File (Write in English)');
    lines.push('');
    lines.push(`**File Path**: \`${promptPath}\``);
    lines.push('');
    lines.push('### ⚠️ CRITICAL: Based on Improvement Report');
    lines.push('');
    lines.push('**Prompt.md MUST be generated from the Improvement Report\'s pending items:**');
    lines.push('- Read `Project_Improvement_Exploration_Report.md` first');
    lines.push('- Extract ONLY the pending (not applied) items from P1/P2/P3 sections');
    lines.push('- Create prompts for EACH pending item with complete implementation code');
    lines.push('- DO NOT include prompts for already completed items');
    lines.push('');
    lines.push('### ⚠️ CRITICAL: Sequential Execution Structure');
    lines.push('');
    lines.push('The Prompt.md file MUST be structured so that when copied entirely and given to an AI agent,');
    lines.push('the agent will execute ALL prompts sequentially without stopping after the first one.');
    lines.push('');
    lines.push('### ⚠️ CRITICAL: No Useless Headers or Descriptions');
    lines.push('');
    lines.push('**DO NOT include any of these at the top of Prompt.md:**');
    lines.push('- Generic descriptions like "This file contains ready-to-use prompts"');
    lines.push('- Instructions like "Copy any section and paste it into Copilot Chat"');
    lines.push('- Any introductory text that is not directly actionable');
    lines.push('');
    lines.push('**START DIRECTLY with the mandatory execution rules.**');
    lines.push('');
    lines.push('### Required File Structure:');
    lines.push('');
    lines.push('````markdown');
    lines.push('# 🤖 AI Agent Improvement Prompts');
    lines.push('');
    lines.push('> ## 🚨 MANDATORY: FILE MODIFICATION REQUIRED');
    lines.push('> ');
    lines.push('> **⛔ DO NOT just respond with text or code blocks.**');
    lines.push('> **⛔ DO NOT say "you can modify like this" without actually modifying.**');
    lines.push('> **⛔ DO NOT explain what needs to be done without doing it.**');
    lines.push('> ');
    lines.push('> **✅ YOU MUST use file editing tools (`replace_string_in_file`, `create_file`, `multi_replace_string_in_file`) to directly modify files.**');
    lines.push('> **✅ After each prompt, confirm "I have modified the file(s)" with the actual changes made.**');
    lines.push('> ');
    lines.push('> ---');
    lines.push('> ');
    lines.push('> **Process ALL prompts below SEQUENTIALLY. Do NOT stop after completing one prompt.**');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📋 Execution Checklist');
    lines.push('');
    lines.push('| # | Prompt ID | Title | Priority | Status |');
    lines.push('|:---:|:---|:---|:---:|:---:|');
    lines.push('| 1 | PROMPT-001 | [Title from P2-1 in Improvement Report] | P2 | ⬜ Pending |');
    lines.push('| 2 | PROMPT-002 | [Title from P2-2 in Improvement Report] | P2 | ⬜ Pending |');
    lines.push('| 3 | PROMPT-003 | [Title from P3-1 in Improvement Report] | P3 | ⬜ Pending |');
    lines.push('| ... | ... | ... | ... | ... |');
    lines.push('');
    lines.push('**Total: X prompts** | **Completed: 0** | **Remaining: X**');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🔴 Priority 1 (Critical) - Execute First');
    lines.push('');
    lines.push('### [PROMPT-001] Title Here');
    lines.push('');
    lines.push('> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**');
    lines.push('');
    lines.push('**Task**: Clear one-sentence description of what needs to be done');
    lines.push('**Files to Modify**: `src/path/to/file.ts`');
    lines.push('');
    lines.push('#### Instructions:');
    lines.push('');
    lines.push('1. Open `src/path/to/file.ts`');
    lines.push('2. Locate the specific section to modify');
    lines.push('3. Apply the changes shown below');
    lines.push('');
    lines.push('#### Implementation Code:');
    lines.push('');
    lines.push('```typescript');
    lines.push('// FULL implementation code here - NO abbreviations');
    lines.push('// Include ALL necessary imports');
    lines.push('// Include COMPLETE function/class definitions');
    lines.push('```');
    lines.push('');
    lines.push('#### Verification:');
    lines.push('- Run: `pnpm run compile`');
    lines.push('- Expected: No compilation errors');
    lines.push('');
    lines.push('**✅ After completing this prompt, proceed to [PROMPT-002]**');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('### [PROMPT-002] Next Title');
    lines.push('');
    lines.push('**⏱️ Execute this prompt now, then proceed to PROMPT-003**');
    lines.push('');
    lines.push('[Continue with same structure...]');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🟡 Priority 2 (High) - Execute Second');
    lines.push('');
    lines.push('[P2 prompts with same structure...]');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🟢 Priority 3 (Medium) - Execute Last');
    lines.push('');
    lines.push('[P3 prompts with same structure...]');
    lines.push('');
    lines.push('**🎉 ALL PROMPTS COMPLETED! Run final verification.**');
    lines.push('````');
    lines.push('');
    lines.push('### ⚠️ MANDATORY Requirements for Each Prompt:');
    lines.push('');
    lines.push('1. **Header**: `**⏱️ Execute this prompt now, then proceed to PROMPT-XXX**`');
    lines.push('2. **Complete Code**: NO `// ... existing code ...` or `/* omitted */`');
    lines.push('3. **Full Context**: Include imports, class definitions, everything needed');
    lines.push('4. **Verification Step**: Include command to run after implementation');
    lines.push('5. **Footer**: `**✅ After completing this prompt, proceed to [PROMPT-XXX]**`');
    lines.push('6. **Final Prompt**: End with `**🎉 ALL PROMPTS COMPLETED!**`');
    lines.push('');
    lines.push('### ❌ NEVER Include:');
    lines.push('- Abbreviated code blocks');
    lines.push('- Placeholder comments like `// add implementation here`');
    lines.push('- References to "see above" or "similar to previous"');
    lines.push('- Incomplete function bodies');
    lines.push('- "Previously Completed Prompts" section or any completed prompt history');
    lines.push('- Any list or mention of already completed/applied improvements');
    lines.push('- Historical data about past prompts or previous sessions');
    lines.push('');
    lines.push('### 📌 IMPORTANT: Prompt.md Content Rule');
    lines.push('- Prompt.md should ONLY contain PENDING prompts that need to be executed');
    lines.push('- DO NOT add any section showing completed or previously applied prompts');
    lines.push('- Each run should generate fresh prompts based on current improvement report');
    lines.push('- No historical tracking of completed prompts in this file');
    lines.push('');

    // ===== 완료 확인 =====
    lines.push('---');
    lines.push('');
    lines.push('## ✅ 작성 완료 체크리스트');
    lines.push('');
    lines.push(`- [ ] \`${evaluationPath}\` - 프로젝트 목표, 기능 테이블, 점수, 상세 평가 (한국어)`);
    lines.push(`- [ ] \`${improvementPath}\` - 전체 요약, 기능 개선/추가 분리, 코드 제외 (한국어)`);
    lines.push(`- [ ] \`${promptPath}\` - Sequential AI prompts with COMPLETE code (English)`);
    lines.push('');
    lines.push('### Prompt.md 필수 검증:');
    lines.push('- [ ] 모든 프롬프트에 "Execute this prompt now, then proceed to PROMPT-XXX" 헤더가 있는가?');
    lines.push('- [ ] 모든 프롬프트에 "After completing this prompt, proceed to [PROMPT-XXX]" 푸터가 있는가?');
    lines.push('- [ ] Execution Checklist 테이블이 모든 프롬프트를 포함하는가?');
    lines.push('- [ ] 모든 코드가 완전하고 축약 없이 작성되었는가?');
    lines.push('- [ ] 마지막 프롬프트가 "ALL PROMPTS COMPLETED"로 끝나는가?');
    lines.push('- [ ] 이미 적용된 개선사항이 제외되었는가?');

    return lines.join('\n');
  }

  /**
   * 설정 로드
   */
  private loadConfig(): VibeReportConfig {
    const config = vscode.workspace.getConfiguration('vibereport');
    
    return {
      reportDirectory: config.get<string>('reportDirectory', 'devplan'),
      snapshotFile: config.get<string>('snapshotFile', '.vscode/vibereport-state.json'),
      enableGitDiff: config.get<boolean>('enableGitDiff', true),
      excludePatterns: config.get<string[]>('excludePatterns', [
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/build/**',
        '**/.git/**',
        '**/target/**',
        '**/.next/**',
        '**/__pycache__/**',
        '**/.venv/**',
        '**/coverage/**',
        '**/*.log',
        '**/*.lock',
      ]),
      maxFilesToScan: config.get<number>('maxFilesToScan', 5000),
      autoOpenReports: config.get<boolean>('autoOpenReports', true),
      language: config.get<'ko' | 'en'>('language', 'ko'),
    };
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[UpdateReports] ${message}`);
  }
}

/**
 * 개선 항목 적용 완료 마킹 명령
 */
export class MarkImprovementAppliedCommand {
  private snapshotService: SnapshotService;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.snapshotService = new SnapshotService(outputChannel);
  }

  /**
   * 현재 선택된 텍스트에서 개선 항목을 적용 완료로 마킹
   */
  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('활성화된 에디터가 없습니다.');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
      vscode.window.showWarningMessage('개선 항목을 선택해주세요.');
      return;
    }

    // 항목 ID 추출 시도
    const idMatch = selectedText.match(/항목 ID:\s*`([a-f0-9]+)`/);
    const titleMatch = selectedText.match(/\[P[123]\]\s*([^\n]+)/);

    if (!idMatch && !titleMatch) {
      vscode.window.showWarningMessage(
        '올바른 개선 항목 형식이 아닙니다. [P1/P2/P3] 제목 형식의 항목을 선택해주세요.'
      );
      return;
    }

    const title = titleMatch ? titleMatch[1].trim() : '알 수 없음';
    const id = idMatch ? idMatch[1] : generateImprovementId(title, selectedText);

    // 워크스페이스 확인
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const config = this.loadConfig();

    // 상태 로드
    let state = await this.snapshotService.loadState(rootPath, config);
    if (!state) {
      state = this.snapshotService.createInitialState();
    }

    // 적용 완료 항목 추가
    state = this.snapshotService.addAppliedImprovement(state, {
      id,
      title,
      appliedAt: new Date().toISOString(),
      sessionId: SnapshotService.generateSessionId(),
    });

    // 상태 저장
    await this.snapshotService.saveState(rootPath, config, state);

    vscode.window.showInformationMessage(
      `개선 항목이 적용 완료로 마킹되었습니다: ${title}`
    );

    this.log(`적용 완료 마킹: ${id} - ${title}`);
  }

  private loadConfig(): VibeReportConfig {
    const config = vscode.workspace.getConfiguration('vibereport');
    return {
      reportDirectory: config.get<string>('reportDirectory', 'devplan'),
      snapshotFile: config.get<string>('snapshotFile', '.vscode/vibereport-state.json'),
      enableGitDiff: config.get<boolean>('enableGitDiff', true),
      excludePatterns: config.get<string[]>('excludePatterns', []),
      maxFilesToScan: config.get<number>('maxFilesToScan', 5000),
      autoOpenReports: config.get<boolean>('autoOpenReports', true),
      language: config.get<'ko' | 'en'>('language', 'ko'),
    };
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[MarkApplied] ${message}`);
  }
}
