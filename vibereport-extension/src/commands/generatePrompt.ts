/**
 * Generate Prompt Command
 *
 * @description 사용자가 개선 항목을 선택하여 영어 프롬프트를 생성하는 명령
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { VibeReportConfig } from '../models/types.js';
import { parseImprovementItems, loadConfig, type ParsedImprovementItem } from '../utils/index.js';

/**
 * 개선 항목 선택 및 프롬프트 생성 명령
 */
export class GeneratePromptCommand {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * 개선 보고서에서 항목을 읽어 QuickPick으로 선택 UI 표시
   */
  async execute(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const config = loadConfig();

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

    // QuickPick 아이템 생성
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
    const promptPath = path.join(rootPath, config.reportDirectory, 'Prompt.md');
    await fs.writeFile(promptPath, prompt, 'utf-8');

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
   * 선택된 개선 항목들을 영어 프롬프트로 변환
   */
  private generateEnglishPrompt(items: ParsedImprovementItem[]): string {
    const lines: string[] = [];

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

    // Execution Checklist
    lines.push('## 📋 Execution Checklist');
    lines.push('');
    lines.push('| # | Prompt ID | Title | Priority | Status |');
    lines.push('|:---:|:---|:---|:---:|:---:|');

    items.forEach((item, index) => {
      const promptId = `PROMPT-${String(index + 1).padStart(3, '0')}`;
      lines.push(`| ${index + 1} | ${promptId} | ${item.title} | ${item.priority} | ⬜ Pending |`);
    });

    lines.push('');
    lines.push(`**Total: ${items.length} prompts** | **Completed: 0** | **Remaining: ${items.length}**`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 우선순위별 그룹화
    const byPriority: Record<string, { item: ParsedImprovementItem; index: number }[]> = {
      P1: [],
      P2: [],
      P3: [],
    };

    items.forEach((item, index) => {
      byPriority[item.priority].push({ item, index });
    });

    const priorityLabels: Record<string, string> = {
      P1: '🔴 Priority 1 (Critical) - Execute First',
      P2: '🟡 Priority 2 (High) - Execute Second',
      P3: '🟢 Priority 3 (Medium) - Execute Last',
    };

    for (const priority of ['P1', 'P2', 'P3'] as const) {
      const priorityItems = byPriority[priority];
      if (priorityItems.length === 0) continue;

      lines.push(`## ${priorityLabels[priority]}`);
      lines.push('');

      for (const { item, index } of priorityItems) {
        const promptId = `PROMPT-${String(index + 1).padStart(3, '0')}`;
        const nextPromptId = index < items.length - 1 
          ? `PROMPT-${String(index + 2).padStart(3, '0')}`
          : null;

        lines.push(`### [${promptId}] ${item.title}`);
        lines.push('');
        
        if (nextPromptId) {
          lines.push(`**⏱️ Execute this prompt now, then proceed to ${nextPromptId}**`);
        } else {
          lines.push('**⏱️ Execute this prompt now - FINAL PROMPT**');
        }
        lines.push('');
        lines.push('> **🚨 REQUIRED: Use `replace_string_in_file` or `create_file` to make changes. Do NOT just show code.**');
        lines.push('');

        // 한글 설명을 영어로 변환된 형태로 구성
        lines.push(`**Task**: ${this.translateToEnglish(item.title)}`);
        lines.push('');
        lines.push('**Details:**');
        lines.push('');
        lines.push(this.formatDescriptionAsEnglish(item.description));
        lines.push('');
        lines.push('#### Verification:');
        lines.push('');
        lines.push('- Run: `cd vibereport-extension && pnpm compile`');
        lines.push('- Run: `cd vibereport-extension && pnpm test`');
        lines.push('- Confirm no compilation errors');
        lines.push('');

        if (nextPromptId) {
          lines.push(`**✅ After completing this prompt, proceed to [${nextPromptId}]**`);
        } else {
          lines.push('**🎉 ALL PROMPTS COMPLETED! Run final verification.**');
        }
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    lines.push('');
    lines.push(`*Generated: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * 한글 제목을 영어로 대략 변환 (실제로는 그대로 사용하거나 AI가 해석)
   */
  private translateToEnglish(title: string): string {
    // 기본적인 한글 -> 영어 매핑
    const translations: Record<string, string> = {
      '리팩토링': 'Refactoring',
      '테스트': 'Testing',
      '문서화': 'Documentation',
      '보안': 'Security',
      '성능': 'Performance',
      '에러 처리': 'Error Handling',
      '코드 품질': 'Code Quality',
      '기능 추가': 'Feature Addition',
      '설정': 'Configuration',
      'UI': 'UI',
    };

    let result = title;
    for (const [ko, en] of Object.entries(translations)) {
      result = result.replace(new RegExp(ko, 'g'), en);
    }

    return result;
  }

  /**
   * 설명을 영어 형식으로 포맷
   */
  private formatDescriptionAsEnglish(description: string): string {
    // 마크다운 테이블과 내용을 그대로 유지하면서 영어 컨텍스트 추가
    const lines = description.split('\n');
    const formattedLines: string[] = [];

    for (const line of lines) {
      // 한글 레이블을 영어로 변환
      let formatted = line
        .replace('**현재 상태:**', '**Current State:**')
        .replace('**개선 내용:**', '**Improvement:**')
        .replace('**기대 효과:**', '**Expected Effect:**')
        .replace('**추가 기능:**', '**New Features:**')
        .replace('**ID**', '**ID**')
        .replace('**카테고리**', '**Category**')
        .replace('**복잡도**', '**Complexity**')
        .replace('**대상 파일**', '**Target Files**');

      formattedLines.push(formatted);
    }

    return formattedLines.join('\n');
  }

  /**
   * 설명에서 카테고리 추출
   */
  private getCategoryFromDescription(description: string): string {
    const categoryMatch = description.match(/🧪|🔒|⚡|📚|🧹|🏗️|🛡️|♿|🌐|🔧|🎨|✨|🔄|📦|📊/);
    if (categoryMatch) {
      const categoryMap: Record<string, string> = {
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
      };
      return categoryMap[categoryMatch[0]] || '';
    }
    return '';
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[GeneratePrompt] ${message}`);
  }
}
