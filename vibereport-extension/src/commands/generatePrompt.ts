/**
 * Generate Prompt Command
 *
 * @description Prompt.md에서 프롬프트를 선택하거나, 개선 보고서의 OPT 항목을 선택하여 클립보드에 복사하는 명령
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
 * 개선 보고서에서 파싱된 OPT 항목
 */
interface OptimizationItem {
  optId: string;
  title: string;
  category: string;
  targetFiles: string;
  fullContent: string;
}

/**
 * 선택 가능한 항목 (프롬프트 또는 OPT)
 */
type SelectableItem = 
  | { type: 'prompt'; item: ExistingPrompt }
  | { type: 'opt'; item: OptimizationItem };

/**
 * 프롬프트 선택 및 복사 명령
 */
export class GeneratePromptCommand {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * 메인 실행: Prompt.md에서 프롬프트를 선택하거나, 개선 보고서의 OPT 항목을 선택하여 클립보드에 복사
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
    const improvementPath = path.join(rootPath, config.reportDirectory, 'Project_Improvement_Exploration_Report.md');

    // Prompt.md에서 프롬프트 파싱
    let existingPrompts: ExistingPrompt[] = [];
    try {
      const promptContent = await fs.readFile(promptPath, 'utf-8');
      existingPrompts = this.parseExistingPrompts(promptContent);
    } catch {
      // Prompt.md가 없어도 OPT 항목은 선택 가능
      this.log('Prompt.md를 찾을 수 없습니다. OPT 항목만 표시합니다.');
    }

    // 개선 보고서에서 OPT 항목 파싱
    let optItems: OptimizationItem[] = [];
    try {
      const improvementContent = await fs.readFile(improvementPath, 'utf-8');
      optItems = this.parseOptimizationItems(improvementContent);
    } catch {
      this.log('개선 보고서를 찾을 수 없습니다.');
    }
    
    if (existingPrompts.length === 0 && optItems.length === 0) {
      vscode.window.showErrorMessage(
        '선택 가능한 프롬프트나 OPT 항목이 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
      return;
    }

    // 프롬프트와 OPT 항목 모두 선택 가능하게 표시
    await this.selectItem(existingPrompts, optItems, promptPath);
  }

  /**
   * 프롬프트 또는 OPT 항목 선택 및 복사
   */
  private async selectItem(
    prompts: ExistingPrompt[], 
    optItems: OptimizationItem[],
    promptPath: string
  ): Promise<void> {
    // QuickPick 아이템 생성
    const quickPickItems: (vscode.QuickPickItem & { _item: SelectableItem })[] = [];

    // 프롬프트 항목 추가 (완료되지 않은 것 우선)
    const sortedPrompts = [...prompts].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return 0;
    });

    for (const p of sortedPrompts) {
      quickPickItems.push({
        label: `${this.getStatusIcon(p.status)} [${p.promptId}] ${p.title}`,
        description: p.priority,
        detail: `📋 프롬프트 | 상태: ${this.getStatusText(p.status)}`,
        _item: { type: 'prompt', item: p },
      });
    }

    // OPT 항목 추가 (구분선 역할의 separator 추가)
    if (optItems.length > 0 && prompts.length > 0) {
      quickPickItems.push({
        label: '─────────────────────────────────',
        description: '코드 품질 및 성능 최적화 제안',
        detail: '',
        kind: vscode.QuickPickItemKind.Separator,
        _item: null as unknown as SelectableItem,
      });
    }

    for (const opt of optItems) {
      quickPickItems.push({
        label: `🔧 [${opt.optId}] ${opt.title}`,
        description: opt.category,
        detail: `📁 대상: ${opt.targetFiles}`,
        _item: { type: 'opt', item: opt },
      });
    }

    const selected = await vscode.window.showQuickPick(
      quickPickItems.filter(item => item.kind !== vscode.QuickPickItemKind.Separator),
      {
        canPickMany: true,
        placeHolder: '복사할 프롬프트 또는 OPT 항목을 선택하세요 (여러 개 선택 가능)',
        title: '📋 프롬프트 / 최적화 항목 선택',
      }
    );

    if (!selected || selected.length === 0) return;

    // 선택된 모든 항목의 내용을 합침
    const contents: string[] = [];
    const itemIds: string[] = [];

    for (const sel of selected) {
      const selectedItem = sel._item;
      
      if (selectedItem.type === 'prompt') {
        contents.push(selectedItem.item.fullContent);
        itemIds.push(selectedItem.item.promptId);
      } else {
        contents.push(this.formatOptAsPrompt(selectedItem.item));
        itemIds.push(selectedItem.item.optId);
      }
    }
    
    // 선택된 내용을 클립보드에 복사 (구분선으로 분리)
    const combinedContent = contents.join('\n\n---\n\n');
    await vscode.env.clipboard.writeText(combinedContent);

    const openChat = 'Copilot Chat 열기';
    const openFile = '프롬프트 파일 열기';
    
    const itemsText = itemIds.length === 1 
      ? `[${itemIds[0]}] 항목이` 
      : `${itemIds.length}개 항목(${itemIds.slice(0, 3).join(', ')}${itemIds.length > 3 ? '...' : ''})이`;
    
    const result = await vscode.window.showInformationMessage(
      `✅ ${itemsText} 클립보드에 복사되었습니다!\nCtrl+V로 AI 챗에 붙여넣기하세요.`,
      openChat,
      openFile
    );

    if (result === openChat) {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    } else if (result === openFile) {
      const doc = await vscode.workspace.openTextDocument(promptPath);
      await vscode.window.showTextDocument(doc);
    }

    this.log(`항목 [${itemIds.join(', ')}] 클립보드에 복사됨`);
  }

  /**
   * OPT 항목을 프롬프트 형식으로 포맷팅
   */
  private formatOptAsPrompt(opt: OptimizationItem): string {
    return `## 🔧 ${opt.title}

> **🚨 REQUIRED: Use file editing tools to make changes. Do NOT just show code.**

**Task**: Implement the optimization described below.

**Details:**

| Field | Value |
|:---|:---|
| **ID** | \`${opt.optId}\` |
| **Category** | ${opt.category} |
| **Target Files** | ${opt.targetFiles} |

${opt.fullContent}

---

#### Verification:

- Run: \`cd vibereport-extension && pnpm compile\`
- Run: \`cd vibereport-extension && pnpm test\`
- Confirm no compilation errors and all tests pass
`;
  }

  /**
   * Prompt.md에서 기존 프롬프트 선택 및 복사 (레거시 - selectItem으로 대체됨)
   */
  private async selectExistingPrompt(prompts: ExistingPrompt[], promptPath: string): Promise<void> {
    await this.selectItem(prompts, [], promptPath);
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

  /**
   * 개선 보고서에서 OPT 항목 파싱
   */
  private parseOptimizationItems(content: string): OptimizationItem[] {
    const items: OptimizationItem[] = [];
    
    // AUTO-OPTIMIZATION 마커 내의 콘텐츠 추출
    const optSectionMatch = content.match(/<!-- AUTO-OPTIMIZATION-START -->([\s\S]*?)<!-- AUTO-OPTIMIZATION-END -->/);
    if (!optSectionMatch) {
      return items;
    }
    
    const optContent = optSectionMatch[1];
    
    // OPT 항목 패턴: ### 🚀 코드 최적화 (OPT-1) 또는 ### ⚙️ 성능 튜닝 (OPT-2)
    const optPattern = /###\s*[🚀⚙️]\s*([^\n(]+)\s*\((OPT-\d+)\)\s*\n([\s\S]*?)(?=\n###\s*[🚀⚙️]|$)/gi;
    
    let match;
    while ((match = optPattern.exec(optContent)) !== null) {
      const title = match[1].trim();
      const optId = match[2];
      const sectionContent = match[3].trim();
      
      // 카테고리 추출
      const categoryMatch = sectionContent.match(/\|\s*\*\*카테고리\*\*\s*\|\s*([^|]+)\|/);
      const category = categoryMatch ? categoryMatch[1].trim() : '최적화';
      
      // 대상 파일 추출
      const targetFilesMatch = sectionContent.match(/\|\s*\*\*대상 파일\*\*\s*\|\s*([^|]+)\|/);
      const targetFiles = targetFilesMatch ? targetFilesMatch[1].trim() : '';
      
      // 전체 내용 (테이블 이후의 설명 포함)
      const fullContent = sectionContent;
      
      items.push({
        optId,
        title,
        category,
        targetFiles,
        fullContent,
      });
    }
    
    return items;
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
