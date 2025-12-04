/**
 * Generate Prompt Command
 *
 * @description Prompt.md에서 프롬프트를 선택하여 클립보드에 복사하는 명령
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { loadConfig } from '../utils/index.js';

/**
 * Prompt.md에서 파싱된 프롬프트 항목
 */
interface ExistingPrompt {
  promptId: string;
  title: string;
  priority: string;
  status: 'pending' | 'in-progress' | 'done';
  fullContent: string;
}

/**
 * 프롬프트 선택 및 복사 명령
 */
export class GeneratePromptCommand {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * 메인 실행: Prompt.md에서 프롬프트를 선택하여 클립보드에 복사
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

    // Prompt.md 확인
    let promptContent: string;
    try {
      promptContent = await fs.readFile(promptPath, 'utf-8');
    } catch {
      vscode.window.showErrorMessage(
        'Prompt.md 파일을 찾을 수 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
      return;
    }

    // 프롬프트 파싱
    const existingPrompts = this.parseExistingPrompts(promptContent);
    
    if (existingPrompts.length === 0) {
      vscode.window.showErrorMessage(
        'Prompt.md에서 프롬프트를 찾을 수 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
      return;
    }

    // 프롬프트 선택 및 복사
    await this.selectExistingPrompt(existingPrompts, promptPath);
  }

  /**
   * Prompt.md에서 프롬프트 선택 및 복사
   */
  private async selectExistingPrompt(prompts: ExistingPrompt[], promptPath: string): Promise<void> {
    // 완료되지 않은 프롬프트 우선 표시, 완료된 것도 선택 가능
    const sortedPrompts = [...prompts].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return 0;
    });

    const quickPickItems: vscode.QuickPickItem[] = sortedPrompts.map(p => ({
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

  private log(message: string): void {
    this.outputChannel.appendLine(`[GeneratePrompt] ${message}`);
  }
}
