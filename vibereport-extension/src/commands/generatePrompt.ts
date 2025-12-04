/**
 * Generate Prompt Command
 *
 * @description 개선 보고서의 미적용 항목을 기반으로,
 * 항상 영어로만 작성된 Prompt.md를 생성하는 명령
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parseImprovementItems, loadConfig, type ParsedImprovementItem } from '../utils/index.js';

interface PromptTask {
  promptId: string;
  improvementId: string;
  priority: 'P1' | 'P2' | 'P3' | 'OPT';
  title: string;
  categoryEmoji?: string;
  categoryLabelEn?: string;
  complexity?: string;
  targetFiles?: string[];
}

/**
 * 기존 Prompt.md에서 파싱된 프롬프트 항목
 */
interface ExistingPrompt {
  promptId: string;
  title: string;
  priority: string;
  status: 'pending' | 'in-progress' | 'done';
  fullContent: string;
}

/**
 * 개선 항목 선택 및 프롬프트 생성 명령
 */
export class GeneratePromptCommand {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * 메인 실행: 모드 선택 후 해당 기능 수행
   */
  async execute(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const config = loadConfig();
    const promptPath = path.join(rootPath, config.reportDirectory, 'Prompt.md');

    // 기존 Prompt.md 확인
    let existingPrompts: ExistingPrompt[] = [];
    try {
      const promptContent = await fs.readFile(promptPath, 'utf-8');
      existingPrompts = this.parseExistingPrompts(promptContent);
    } catch {
      // Prompt.md가 없으면 빈 배열
    }

    // 모드 선택
    const modeOptions: vscode.QuickPickItem[] = [];
    
    if (existingPrompts.length > 0) {
      const pendingCount = existingPrompts.filter(p => p.status !== 'done').length;
      modeOptions.push({
        label: '$(clippy) 기존 프롬프트 선택 및 복사',
        description: `${pendingCount}개의 대기 중인 프롬프트`,
        detail: 'Prompt.md에서 프롬프트를 선택하여 클립보드에 복사합니다.',
      });
    }
    
    modeOptions.push({
      label: '$(add) 새 프롬프트 생성',
      description: '개선 보고서에서 항목 선택',
      detail: '개선 보고서의 미적용 항목을 기반으로 새 Prompt.md를 생성합니다.',
    });

    // 기존 프롬프트가 있으면 모드 선택, 없으면 바로 새 프롬프트 생성
    let selectedMode: string;
    if (existingPrompts.length > 0) {
      const mode = await vscode.window.showQuickPick(modeOptions, {
        placeHolder: '작업을 선택하세요',
        title: '🔧 프롬프트 관리',
      });
      if (!mode) return;
      selectedMode = mode.label.includes('기존') ? 'select' : 'generate';
    } else {
      selectedMode = 'generate';
    }

    if (selectedMode === 'select') {
      await this.selectExistingPrompt(existingPrompts, promptPath);
    } else {
      await this.generateNewPrompts(rootPath, config, promptPath);
    }
  }

  /**
   * 기존 Prompt.md에서 프롬프트 선택 및 복사
   */
  private async selectExistingPrompt(prompts: ExistingPrompt[], promptPath: string): Promise<void> {
    const pendingPrompts = prompts.filter(p => p.status !== 'done');
    
    if (pendingPrompts.length === 0) {
      vscode.window.showInformationMessage('모든 프롬프트가 완료되었습니다! 🎉');
      return;
    }

    const quickPickItems: vscode.QuickPickItem[] = pendingPrompts.map(p => ({
      label: `${this.getStatusIcon(p.status)} [${p.promptId}] ${p.title}`,
      description: p.priority,
      detail: `상태: ${this.getStatusText(p.status)}`,
      _prompt: p,
    } as vscode.QuickPickItem & { _prompt: ExistingPrompt }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      canPickMany: false,
      placeHolder: '복사할 프롬프트를 선택하세요',
      title: '📋 프롬프트 선택',
    });

    if (!selected) return;

    // @ts-expect-error - 커스텀 속성 접근
    const selectedPrompt: ExistingPrompt = selected._prompt;
    
    // 선택된 프롬프트 내용을 클립보드에 복사
    await vscode.env.clipboard.writeText(selectedPrompt.fullContent);

    const openChat = 'Copilot Chat 열기';
    const openFile = '프롬프트 파일 열기';
    
    const result = await vscode.window.showInformationMessage(
      `✅ [${selectedPrompt.promptId}] 프롬프트가 클립보드에 복사되었습니다!\nCtrl+V로 AI 챗에 붙여넣기하세요.`,
      openChat,
      openFile
    );

    if (result === openChat) {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    } else if (result === openFile) {
      const doc = await vscode.workspace.openTextDocument(promptPath);
      await vscode.window.showTextDocument(doc);
    }

    this.log(`프롬프트 [${selectedPrompt.promptId}] 클립보드에 복사됨`);
  }

  /**
   * 개선 보고서에서 새 프롬프트 생성
   */
  private async generateNewPrompts(rootPath: string, config: ReturnType<typeof loadConfig>, promptPath: string): Promise<void> {
    // 개선 보고서 읽기
    const improvementPath = path.join(
      rootPath,
      config.reportDirectory,
      'Project_Improvement_Exploration_Report.md'
    );

    let content: string;
    try {
      content = await fs.readFile(improvementPath, 'utf-8');
    } catch {
      vscode.window.showErrorMessage(
        '개선 보고서를 찾을 수 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
      return;
    }

    // 개선 항목 파싱
    const items = parseImprovementItems(content);
    const pendingItems = items.filter(item => !item.applied);

    if (pendingItems.length === 0) {
      vscode.window.showInformationMessage('적용할 개선 항목이 없습니다. 🎉');
      return;
    }

    // QuickPick 아이템 생성 (한국어 설명은 UI에만 사용)
    const quickPickItems: vscode.QuickPickItem[] = pendingItems.map((item, index) => ({
      label: `[${item.priority}] ${item.title}`,
      description: this.getCategoryFromDescription(item.description),
      detail: item.description.split('\n')[0].substring(0, 100) + '...',
      picked: false,
      // 내부 데이터 저장 (QuickPickItem은 임의 속성을 허용함)
      _item: item,
      _index: index,
    } as vscode.QuickPickItem & { _item: ParsedImprovementItem; _index: number }));

    // QuickPick 표시
    const selected = await vscode.window.showQuickPick(quickPickItems, {
      canPickMany: true,
      placeHolder: '프롬프트를 생성할 개선 항목을 선택하세요 (여러 개 선택 가능)',
      title: '🔧 개선 항목 선택',
    });

    if (!selected || selected.length === 0) {
      return;
    }

    // 선택된 항목들로 프롬프트 생성
    // @ts-expect-error - 커스텀 속성 접근
    const selectedItems: ParsedImprovementItem[] = selected.map(s => s._item);
    const prompt = this.generateEnglishPrompt(selectedItems);

    // Prompt.md 파일에 저장
    await fs.writeFile(promptPath, prompt, 'utf-8');

    // AGENTS.md 보강: 프롬프트를 TODO 리스트로 취급하고, 모든 작업 완료 및 검증을 강제
    await this.ensureAgentsRules(rootPath);

    // 클립보드에도 복사
    await vscode.env.clipboard.writeText(prompt);

    // 결과 알림
    const openFile = '프롬프트 파일 열기';
    const openChat = 'Copilot Chat 열기';

    const result = await vscode.window.showInformationMessage(
      `✅ ${selectedItems.length}개 항목에 대한 영어 프롬프트가 생성되었습니다!\n클립보드에 복사됨.`,
      openFile,
      openChat
    );

    if (result === openFile) {
      const doc = await vscode.workspace.openTextDocument(promptPath);
      await vscode.window.showTextDocument(doc);
    } else if (result === openChat) {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    }

    this.log(`${selectedItems.length}개 개선 항목에 대한 프롬프트 생성 완료`);
  }

  /**
   * Prompt.md에서 기존 프롬프트 항목 파싱
   */
  private parseExistingPrompts(content: string): ExistingPrompt[] {
    const prompts: ExistingPrompt[] = [];
    
    // 체크리스트에서 상태 정보 추출 (다양한 테이블 형식 지원)
    const statusMap = new Map<string, 'pending' | 'in-progress' | 'done'>();
    
    // 체크리스트 테이블 패턴: | # | Prompt ID | Title | Priority | Status |
    // 또는: | # | Prompt ID | Improvement ID | Title | Priority | Complexity | Category | Status |
    const checklistMatch = content.match(/## 📋 Execution Checklist[\s\S]*?(?=\n---|\n\n##|\n\*\*Total)/);
    
    if (checklistMatch) {
      const checklistContent = checklistMatch[0];
      // 테이블 행에서 PROMPT-XXX와 상태 아이콘 추출 (컬럼 수에 관계없이)
      const rowPattern = /\|\s*\d+\s*\|\s*(PROMPT-\d+)\s*\|[\s\S]*?(⬜|🟡|✅)[^\n|]*\|/g;
      let rowMatch;
      while ((rowMatch = rowPattern.exec(checklistContent)) !== null) {
        const promptId = rowMatch[1];
        const statusIcon = rowMatch[2];
        let status: 'pending' | 'in-progress' | 'done' = 'pending';
        if (statusIcon === '🟡') status = 'in-progress';
        else if (statusIcon === '✅') status = 'done';
        statusMap.set(promptId, status);
      }
    }
    
    // 프롬프트 섹션 파싱: ### [PROMPT-001] 제목
    // 다음 프롬프트 섹션 또는 파일 끝까지 캡처
    const promptPattern = /###\s*\[(PROMPT-\d+)\]\s*([^\n]+)\n([\s\S]*?)(?=\n###\s*\[PROMPT-|\n##\s+[^#]|\n\*Generated|\n🎉 ALL PROMPTS|$)/gi;

    let match;
    while ((match = promptPattern.exec(content)) !== null) {
      const promptId = match[1];
      const title = match[2].trim();
      const sectionContent = match[3].trim();
      const fullContent = `### [${promptId}] ${title}\n\n${sectionContent}`;
      
      // 우선순위 추출 - 테이블 또는 텍스트에서
      const priorityMatch = sectionContent.match(/\|\s*\*\*?Priority\*\*?\s*\|\s*(P[123]|OPT)/i) ||
                           sectionContent.match(/Priority:\s*(P[123]|OPT)/i) ||
                           content.match(new RegExp(`\\|\\s*\\d+\\s*\\|\\s*${promptId}\\s*\\|[^|]*\\|[^|]*\\|\\s*(P[123]|OPT)`, 'i'));
      const priority = priorityMatch ? priorityMatch[1].toUpperCase() : 'P3';
      
      const status = statusMap.get(promptId) || 'pending';
      
      prompts.push({
        promptId,
        title,
        priority,
        status,
        fullContent,
      });
    }

    return prompts;
  }

  private getStatusIcon(status: 'pending' | 'in-progress' | 'done'): string {
    switch (status) {
      case 'pending': return '⬜';
      case 'in-progress': return '🟡';
      case 'done': return '✅';
    }
  }

  private getStatusText(status: 'pending' | 'in-progress' | 'done'): string {
    switch (status) {
      case 'pending': return '대기 중';
      case 'in-progress': return '진행 중';
      case 'done': return '완료';
    }
  }

  /**
   * 선택된 개선 항목들을 영어 전용 Prompt.md 문서로 변환
   */
  private generateEnglishPrompt(items: ParsedImprovementItem[]): string {
    const lines: string[] = [];
    const tasks: PromptTask[] = items.map((item, index) =>
      this.buildPromptTask(item, index)
    );

    lines.push('# 🤖 AI Agent Improvement Prompts');
    lines.push('');
    lines.push('> All instructions and content in this file MUST be written in **English only**, regardless of the source language of other reports.');
    lines.push('> Treat **every prompt below as a TODO item**, and do not finish until **all prompts are completed and verified**.');
    lines.push('> Keep the **Execution Checklist** table up to date (status flow: ⬜ Pending → 🟡 In Progress → ✅ Done).');
    lines.push('> For each prompt: plan the work, modify the actual project files, and run the Verification steps before marking it as ✅ Done.');
    lines.push('> Also obey any additional rules defined in the local `AGENTS.md` file (auto-managed by this extension).');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🔐 Mandatory Execution Rules');
    lines.push('');
    lines.push('- Do **not** answer with high-level advice only. You must apply changes directly to files.');
    lines.push('- After completing each prompt, explicitly confirm which files were modified and how.');
    lines.push('- Use file-editing tools or direct file edits in this workspace; do not rely on pseudo-code only.');
    lines.push('- If any Verification step fails, fix the issues and re-run the checks before marking the prompt as done.');
    lines.push('');

    // Execution Checklist as TODO list
    lines.push('---');
    lines.push('');
    lines.push('## 📋 Execution Checklist (TODO)');
    lines.push('');
    lines.push('| # | Prompt ID | Improvement ID | Title | Priority | Complexity | Category | Status |');
    lines.push('|:---:|:---|:---|:---|:---:|:---:|:---:|:---:|');

    tasks.forEach((task, index) => {
      lines.push(
        `| ${index + 1} | ${task.promptId} | ${task.improvementId} | ${task.title} | ${task.priority} | ${task.complexity ?? '-'} | ${task.categoryLabelEn ?? '-'} | ⬜ Pending |`
      );
    });

    lines.push('');
    lines.push(
      `**Total: ${tasks.length} prompts** | **Completed: 0** | **Remaining: ${tasks.length}**`
    );
    lines.push('');
    lines.push('> Status legend: ⬜ Pending → 🟡 In Progress → ✅ Done.');
    lines.push('');
    lines.push('---');
    lines.push('');

    // Group by priority
    const byPriority: Record<'P1' | 'P2' | 'P3' | 'OPT', PromptTask[]> = {
      P1: [],
      P2: [],
      P3: [],
      OPT: [],
    };
    tasks.forEach(task => {
      if (byPriority[task.priority]) {
        byPriority[task.priority].push(task);
      }
    });

    const priorityLabels: Record<'P1' | 'P2' | 'P3' | 'OPT', string> = {
      P1: '🔴 Priority 1 (Critical) - Execute First',
      P2: '🟡 Priority 2 (High) - Execute Second',
      P3: '🟢 Priority 3 (Medium) - Execute Third',
      OPT: '🚀 Optimization - Execute Last',
    };

    const orderedTasks = [...byPriority.P1, ...byPriority.P2, ...byPriority.P3, ...byPriority.OPT];

    (['P1', 'P2', 'P3', 'OPT'] as const).forEach(priority => {
      const priorityTasks = byPriority[priority];
      if (priorityTasks.length === 0) return;

      lines.push(`## ${priorityLabels[priority]}`);
      lines.push('');

      priorityTasks.forEach(task => {
        const currentIndex = orderedTasks.findIndex(t => t.promptId === task.promptId);
        const nextTask = orderedTasks[currentIndex + 1];

        lines.push(`### [${task.promptId}] ${task.title}`);
        lines.push('');

        if (nextTask) {
          lines.push(
            `**⏱️ Execute this prompt now, then proceed to ${nextTask.promptId}.**`
          );
        } else {
          lines.push('**⏱️ Execute this prompt now - FINAL PROMPT.**');
        }
        lines.push('');
        lines.push(
          '> You MUST edit real project files and keep the Execution Checklist in sync.'
        );
        lines.push('');

        // Structured sections: Goal / Context / Required Changes / Definition of Done / Verification
        lines.push('#### Goal');
        lines.push(
          `- Fully implement improvement item \`${task.improvementId}\` so that it is no longer considered "open" in the improvement report.`
        );
        lines.push('');

        lines.push('#### Context');
        lines.push('- Source report: `devplan/Project_Improvement_Exploration_Report.md`');
        lines.push(`- Improvement ID: \`${task.improvementId}\``);
        lines.push(`- Priority: ${task.priority}`);
        if (task.categoryLabelEn) {
          lines.push(`- Category: ${task.categoryLabelEn}`);
        }
        if (task.complexity) {
          lines.push(`- Complexity: ${task.complexity}`);
        }
        if (task.targetFiles && task.targetFiles.length > 0) {
          lines.push('- Target files/modules (initial focus):');
          task.targetFiles.forEach(f => {
            lines.push(`  - \`${f}\``);
          });
        }
        lines.push(
          '- For full problem/impact details, read the corresponding improvement item in the improvement report.'
        );
        lines.push('');

        lines.push('#### Required Changes');
        lines.push('- [ ] Open the improvement item in the improvement report and understand the Problem, Impact, Cause, and Proposed Solution.');
        lines.push('- [ ] Apply all necessary code and configuration changes so that the improvement is fully realized.');
        lines.push('- [ ] Keep naming, structure, and style consistent with the existing codebase.');
        lines.push('- [ ] Update or add tests and documentation where appropriate.');
        lines.push('');

        lines.push('#### Definition of Done');
        lines.push(`<!-- DOD-START: ${task.promptId} -->`);
        lines.push('- [ ] All Required Changes above have been fully implemented.');
        lines.push('- [ ] All relevant tests for this area have been added or updated.');
        lines.push('- [ ] `cd vibereport-extension && pnpm compile` succeeds without errors.');
        lines.push('- [ ] `cd vibereport-extension && pnpm test` succeeds without failures.');
        lines.push(
          '- [ ] The improvement report reflects this item as completed or no longer pending (according to the project’s tracking rules).'
        );
        lines.push(`<!-- DOD-END: ${task.promptId} -->`);
        lines.push('');

        lines.push('#### Verification');
        lines.push('');
        lines.push('- Run: `cd vibereport-extension && pnpm compile`');
        lines.push('- Run: `cd vibereport-extension && pnpm test`');
        lines.push('- Manually inspect any affected files to ensure the behavior matches the intent of the improvement item.');
        lines.push(
          '- If any verification step fails, fix the issues and re-run until everything passes.'
        );
        lines.push('');
        lines.push(
          '> After successful verification, update the Execution Checklist status for this prompt to `✅ Done`.'
        );
        lines.push('');
        lines.push('---');
        lines.push('');
      });
    });

    lines.push('');
    lines.push(`*Generated (UTC): ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * 개선 항목 메타데이터를 기반으로 PromptTask 생성
   * - Prompt 제목은 항상 영어로 구성 (Improvement ID 기반)
   */
  private buildPromptTask(item: ParsedImprovementItem, index: number): PromptTask {
    const promptId = this.formatPromptId(index);
    const meta = this.extractImprovementMetadata(item.description);

    const improvementId = meta.improvementId ?? item.id;
    const categoryEmoji =
      meta.categoryEmoji ?? this.getCategoryEmojiFromDescription(item.description);
    const categoryLabelEn = this.getCategoryLabelEn(categoryEmoji);

    const complexity = meta.complexity;
    const targetFiles = meta.targetFiles;

    const titleParts: string[] = ['Implement'];
    if (categoryLabelEn) {
      titleParts.push(categoryLabelEn.toLowerCase());
    } else {
      titleParts.push('improvement');
    }
    titleParts.push(`for \`${improvementId}\``);

    const title = titleParts.join(' ');

    return {
      promptId,
      improvementId,
      priority: item.priority,
      title,
      categoryEmoji,
      categoryLabelEn,
      complexity,
      targetFiles,
    };
  }

  private formatPromptId(index: number): string {
    return `PROMPT-${String(index + 1).padStart(3, '0')}`;
  }

  /**
   * 개선 보고서 설명에서 ID/카테고리/복잡도/대상 파일 메타데이터 추출
   * - 한국어/영어 테이블 모두 지원
   */
  private extractImprovementMetadata(description: string): {
    improvementId?: string;
    categoryEmoji?: string;
    complexity?: string;
    targetFiles?: string[];
  } {
    const improvementIdMatch =
      description.match(/\*\*ID\*\*\s*\|\s*`([^`]+)`/i) ??
      description.match(/Improvement ID:\s*`([^`]+)`/i);

    const categoryRowMatch =
      description.match(/\*\*(카테고리|Category)\*\*\s*\|\s*([^\n|]+)/) || undefined;

    const complexityMatch =
      description.match(/\*\*(복잡도|Complexity)\*\*\s*\|\s*([^\n|]+)/) || undefined;

    const targetFilesMatch =
      description.match(/\*\*(대상 파일|Target Files)\*\*\s*\|\s*([^\n]+)/) || undefined;

    const improvementId = improvementIdMatch ? improvementIdMatch[1].trim() : undefined;

    let categoryEmoji: string | undefined;
    if (categoryRowMatch) {
      const emojiMatch = categoryRowMatch[2].match(
        /🧪|🔒|⚡|📚|🧹|🏗️|🛡️|♿|🌐|🔧|🎨|✨|🔄|📦|📊|🚀|⚙️/
      );
      if (emojiMatch) {
        categoryEmoji = emojiMatch[0];
      }
    }

    const complexity = complexityMatch ? complexityMatch[2].trim() : undefined;

    let targetFiles: string[] | undefined;
    if (targetFilesMatch) {
      const raw = targetFilesMatch[2];
      const backtickFiles = [...raw.matchAll(/`([^`]+)`/g)].map(m => m[1].trim());
      if (backtickFiles.length > 0) {
        targetFiles = backtickFiles;
      } else {
        targetFiles = raw.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    return {
      improvementId,
      categoryEmoji,
      complexity,
      targetFiles,
    };
  }

  /**
   * 설명에서 카테고리 이모지를 추출 (QuickPick/메타데이터 공통)
   */
  private getCategoryEmojiFromDescription(description: string): string | undefined {
    const categoryMatch = description.match(
      /🧪|🔒|⚡|📚|🧹|🏗️|🛡️|♿|🌐|🔧|🎨|✨|🔄|📦|📊|🚀|⚙️/
    );
    return categoryMatch ? categoryMatch[0] : undefined;
  }

  /**
   * 설명에서 카테고리 추출 (QuickPick UI용 - 한국어 라벨)
   */
  private getCategoryFromDescription(description: string): string {
    const emoji = this.getCategoryEmojiFromDescription(description);
    if (!emoji) return '';

    const categoryMapKo: Record<string, string> = {
      '🧪': '테스트',
      '🔒': '보안',
      '⚡': '성능',
      '📚': '문서화',
      '🧹': '코드 품질',
      '🏗️': '아키텍처',
      '🛡️': '에러 처리',
      '♿': '접근성',
      '🌐': '국제화',
      '🔧': 'DevOps',
      '🎨': 'UX',
      '✨': '기능 추가',
      '🔄': '리팩토링',
      '📦': '의존성',
      '📊': '모니터링',
      '🚀': '코드 최적화',
      '⚙️': '성능 튜닝',
    };

    return categoryMapKo[emoji] ?? '';
  }

  /**
   * 카테고리 이모지 → 영어 라벨 변환 (Prompt.md 내에서 사용)
   */
  private getCategoryLabelEn(emoji?: string): string | undefined {
    if (!emoji) return undefined;

    const categoryMapEn: Record<string, string> = {
      '🧪': 'Testing',
      '🔒': 'Security',
      '⚡': 'Performance',
      '📚': 'Documentation',
      '🧹': 'Code Quality',
      '🏗️': 'Architecture',
      '🛡️': 'Error Handling',
      '♿': 'Accessibility',
      '🌐': 'Internationalization',
      '🔧': 'DevOps / CI/CD',
      '🎨': 'UX Improvement',
      '✨': 'Feature',
      '🔄': 'Refactoring',
      '📦': 'Dependencies',
      '📊': 'Monitoring / Logging',
      '🚀': 'Code Optimization',
      '⚙️': 'Performance Tuning',
    };

    return categoryMapEn[emoji];
  }

  /**
   * Prompt 생성 시, 로컬 워크스페이스의 AGENTS.md를 보강
   * - 없으면 생성하고, 있으면 "모든 작업 완료 및 검증" 규칙 섹션 추가
   */
  private async ensureAgentsRules(rootPath: string): Promise<void> {
    const agentsPathUpper = path.join(rootPath, 'AGENTS.md');
    const agentsPathLower = path.join(rootPath, 'agents.md');

    const candidatePaths = [agentsPathUpper, agentsPathLower];
    let existingPath: string | null = null;
    let content = '';

    for (const p of candidatePaths) {
      try {
        content = await fs.readFile(p, 'utf-8');
        existingPath = p;
        break;
      } catch {
        // 파일 없음 - 다음 후보 경로 확인
      }
    }

    const targetPath = existingPath ?? agentsPathUpper;
    const sectionHeader = '## Vibe Coding Report Agent Execution Rules';

    if (content.includes(sectionHeader)) {
      this.log(`AGENTS rules already present at ${targetPath}`);
      return;
    }

    const addition = `
${sectionHeader}

- When using \`devplan/Prompt.md\`, agents MUST treat every prompt as a **TODO item** and complete **all prompts** before finishing.
- Agents MUST keep the **Execution Checklist** in \`Prompt.md\` up to date (status: ⬜ Pending → 🟡 In Progress → ✅ Done).
- Agents MUST verify their changes (for example, by running tests, linters, or the Verification steps defined in each prompt) before marking any prompt as \`✅ Done\`.
- Partial work is not allowed: do **not** stop after one prompt if more prompts remain open.
- This section is auto-managed by the **Vibe Coding Report** VS Code extension. Do not remove or rename it unless you also update the extension configuration.
`;

    const base = existingPath
      ? `${content.trimEnd()}\n\n${addition}`
      : `# AGENTS\n\nThis file is auto-generated by the **Vibe Coding Report** VS Code extension to define local agent rules.\n\n${addition}`;

    try {
      await fs.writeFile(targetPath, base, 'utf-8');
      this.log(`AGENTS rules ensured at ${targetPath}`);
    } catch (error) {
      this.log(`Failed to update AGENTS rules at ${targetPath}: ${String(error)}`);
    }
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[GeneratePrompt] ${message}`);
  }
}
