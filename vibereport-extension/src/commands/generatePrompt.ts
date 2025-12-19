/**
 * Generate Prompt Command
 *
 * @description Prompt.md에서 프롬프트를 선택하거나, 개선 보고서의 OPT 항목을 선택하여 클립보드에 복사하는 명령
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { loadConfig, selectWorkspaceRoot, resolveAnalysisRoot } from '../utils/index.js';
import { EXECUTION_CHECKLIST_BLOCK_REGEX } from '../utils/promptChecklistUtils.js';

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
  status: 'pending' | 'in-progress' | 'done';
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
   * 메인 실행: Prompt.md에서 프롬프트와 OPT 항목을 선택하여 클립보드에 복사
   */
  async execute(): Promise<void> {
    const workspaceRoot = await selectWorkspaceRoot();
    if (!workspaceRoot) {
      this.log('워크스페이스 선택이 취소되었습니다.');
      return;
    }
    const config = loadConfig();

    let rootPath = workspaceRoot;
    try {
      rootPath = resolveAnalysisRoot(workspaceRoot, config.analysisRoot);
    } catch (error) {
      vscode.window.showErrorMessage(
        'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
      );
      this.log(`analysisRoot invalid: ${String(error)}`);
      return;
    }

    const promptPath = path.join(rootPath, config.reportDirectory, 'Prompt.md');

    // Prompt.md에서 프롬프트와 OPT 항목 파싱
    let existingPrompts: ExistingPrompt[] = [];
    let optItems: OptimizationItem[] = [];

    try {
      const promptContent = await fs.readFile(promptPath, 'utf-8');
      existingPrompts = this.parseExistingPrompts(promptContent);
      optItems = this.parseOptimizationItemsFromPromptMd(promptContent);
    } catch {
      vscode.window.showErrorMessage(
        'Prompt.md 파일을 찾을 수 없습니다. 먼저 "보고서 업데이트"를 실행해주세요.'
      );
      return;
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

    // 프롬프트 항목 추가 (완료된 항목 제외, 미완료 항목만 표시)
    const pendingPrompts = prompts.filter(p => p.status !== 'done');
    const sortedPrompts = [...pendingPrompts].sort((a, b) => {
      if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
      if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;
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

    // OPT 항목 추가 (완료된 항목 제외, 미완료 항목만 표시)
    const pendingOptItems = optItems.filter(opt => opt.status !== 'done');
    const sortedOptItems = [...pendingOptItems].sort((a, b) => {
      if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
      if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;
      return 0;
    });

    if (sortedOptItems.length > 0 && pendingPrompts.length > 0) {
      quickPickItems.push({
        label: '─────────────────────────────────',
        description: '코드 품질 및 성능 최적화 제안',
        detail: '',
        kind: vscode.QuickPickItemKind.Separator,
        _item: null as unknown as SelectableItem,
      });
    }

    for (const opt of sortedOptItems) {
      quickPickItems.push({
        label: `${this.getStatusIcon(opt.status)} [${opt.optId}] ${opt.title}`,
        description: opt.category,
        detail: `📁 대상: ${opt.targetFiles} | 상태: ${this.getStatusText(opt.status)}`,
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
   * Prompt.md에서 가져온 경우 이미 영어로 작성되어 있으므로 fullContent를 그대로 사용
   */
  private formatOptAsPrompt(opt: OptimizationItem): string {
    // fullContent가 이미 Prompt.md 형식인 경우 그대로 반환
    if (opt.fullContent.startsWith('### [OPT-')) {
      return opt.fullContent;
    }

    // 레거시: 개선 보고서에서 가져온 경우 포맷팅
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
    const checklistMatch = content.match(EXECUTION_CHECKLIST_BLOCK_REGEX);

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
   * Prompt.md에서 OPT 항목 파싱 (영어)
   * 다양한 테이블 형식을 지원하기 위해 라인별 파싱 사용
   */
  private parseOptimizationItemsFromPromptMd(content: string): OptimizationItem[] {
    const items: OptimizationItem[] = [];

    // 체크리스트에서 OPT 상태 정보 추출 - 라인별 파싱으로 개선
    const statusMap = new Map<string, 'pending' | 'in-progress' | 'done'>();
    const checklistMatch = content.match(EXECUTION_CHECKLIST_BLOCK_REGEX);

    if (checklistMatch) {
      const checklistContent = checklistMatch[0];
      // 라인별로 파싱하여 다양한 테이블 형식 지원
      const lines = checklistContent.split('\n');
      for (const line of lines) {
        // 테이블 행인지 확인 (|로 시작)
        if (!line.trim().startsWith('|')) continue;

        // OPT-XXX 패턴 찾기 (1~3자리 숫자 지원)
        const optMatch = line.match(/\|\s*(OPT-\d{1,3})\s*\|/);
        if (!optMatch) continue;

        const optId = optMatch[1];

        // 상태 아이콘 찾기 (라인 끝에서 찾음)
        const statusMatch = line.match(/(⬜|🟡|✅)/);
        let status: 'pending' | 'in-progress' | 'done' = 'pending';
        if (statusMatch) {
          if (statusMatch[1] === '🟡') status = 'in-progress';
          else if (statusMatch[1] === '✅') status = 'done';
        }
        statusMap.set(optId, status);
      }
    }

    this.log(`[parseOptimizationItemsFromPromptMd] Status map: ${JSON.stringify([...statusMap.entries()])}`);

    // OPT 섹션 파싱: ## 🔧 Optimization Items (OPT) 이후의 ### [OPT-X] 항목들
    // 다양한 형식 지원: ## 🔧 Optimization Items, ## 🔧 OPT, ## Optimization Items 등
    let optSectionMatch = content.match(/##\s*(?:🔧\s*)?Optimization\s*Items?(?:\s*\(OPT\))?[\s\S]*$/i);

    // 대체 패턴: OPT 헤더가 다른 형식인 경우
    if (!optSectionMatch) {
      optSectionMatch = content.match(/##\s*(?:🔧\s*)?OPT(?:imization)?(?:\s*Items?)?[\s\S]*$/i);
    }

    // 여전히 없으면, ### [OPT-로 시작하는 섹션을 직접 찾아서 해당 지점부터 끝까지 사용
    if (!optSectionMatch) {
      const optHeaderIndex = content.search(/###\s*\[OPT-\d/i);
      if (optHeaderIndex !== -1) {
        optSectionMatch = [content.substring(optHeaderIndex)];
        this.log('[parseOptimizationItemsFromPromptMd] OPT section found via direct header search');
      }
    }

    if (!optSectionMatch) {
      this.log('[parseOptimizationItemsFromPromptMd] No OPT section found');
      return items;
    }

    const optContent = optSectionMatch[0];

    // OPT 항목 패턴: ### [OPT-XXX] Title
    // 종료 조건을 더 명확하게: 다음 OPT 헤더, 다른 ## 섹션, 🎉 마커, ✅ Final Completion, 또는 문서 끝
    const optPattern = /###\s*\[(OPT-\d{1,3})\]\s*([^\n]+)\n([\s\S]*?)(?=\n###\s*\[(?:OPT-|PROMPT-)|\n##\s+[^\n]|\n?\*?\*?🎉|\n##\s*✅|$)/gi;

    let match;
    while ((match = optPattern.exec(optContent)) !== null) {
      const optId = match[1];
      const title = match[2].trim()
        // 제목 끝의 백틱 ID 제거 (예: `opt-markdown-parse-001`)
        .replace(/\s*\(`[^`]+`\)\s*$/, '')
        .replace(/\s*`[^`]+`\s*$/, '');
      const sectionContent = match[3].trim();

      // 카테고리 추출 (영어)
      const categoryMatch = sectionContent.match(/\|\s*\*\*Category\*\*\s*\|\s*([^|]+)\|/i);
      const category = categoryMatch ? categoryMatch[1].trim() : 'Optimization';

      // 대상 파일 추출 (영어)
      const targetFilesMatch = sectionContent.match(/\|\s*\*\*Target Files?\*\*\s*\|\s*([^|]+)\|/i);
      const targetFiles = targetFilesMatch ? targetFilesMatch[1].trim() : '';

      // 상태 확인 - 상태 맵에서 가져오거나 pending으로 기본값
      const status = statusMap.get(optId) || 'pending';

      // 전체 내용
      const fullContent = `### [${optId}] ${title}\n\n${sectionContent}`;

      this.log(`[parseOptimizationItemsFromPromptMd] Parsed OPT item: ${optId} - ${title} (status: ${status})`);

      items.push({
        optId,
        title,
        category,
        targetFiles,
        status,
        fullContent,
      });
    }

    this.log(`[parseOptimizationItemsFromPromptMd] Total OPT items found: ${items.length}`);

    return items;
  }

  /**
   * 개선 보고서에서 OPT 항목 파싱 (한글) - 레거시, 더 이상 사용하지 않음
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
        status: 'pending',
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
      case 'pending': return 'Pending';
      case 'in-progress': return 'In Progress';
      case 'done': return 'Done';
    }
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[GeneratePrompt] ${message}`);
  }
}
