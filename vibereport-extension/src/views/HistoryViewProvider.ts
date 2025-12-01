/**
 * History View Provider
 * 세션 히스토리 트리 뷰
 */

import * as vscode from 'vscode';
import type { SessionRecord, VibeReportConfig } from '../models/types.js';
import { SnapshotService } from '../services/index.js';
import { formatRelativeTime, loadConfig } from '../utils/index.js';

/**
 * 히스토리 아이템 타입
 */
type HistoryItemType = 'session' | 'section' | 'detail';

export class HistoryViewProvider implements vscode.TreeDataProvider<HistoryItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<HistoryItem | undefined | null | void> = 
    new vscode.EventEmitter<HistoryItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<HistoryItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private extensionUri: vscode.Uri;
  private outputChannel: vscode.OutputChannel;
  private snapshotService: SnapshotService;

  constructor(extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel) {
    this.extensionUri = extensionUri;
    this.outputChannel = outputChannel;
    this.snapshotService = new SnapshotService(outputChannel);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HistoryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HistoryItem): Promise<HistoryItem[]> {
    if (!element) {
      // 루트: 세션 목록
      const sessions = await this.loadSessions();
      return sessions.map(session => new HistoryItem(
        session.userPrompt.substring(0, 40) + (session.userPrompt.length > 40 ? '...' : ''),
        formatRelativeTime(session.timestamp),
        vscode.TreeItemCollapsibleState.Collapsed,
        'session',
        session
      ));
    }

    // 세션의 자식 요소
    if (element.itemType === 'session' && element.session) {
      return this.getSessionSections(element.session);
    }

    // 섹션의 자식 요소 (상세 정보)
    if (element.itemType === 'section' && element.session && element.sectionType) {
      return this.getSectionDetails(element.session, element.sectionType);
    }

    return [];
  }

  private async loadSessions(): Promise<SessionRecord[]> {
    const rootPath = this.getRootPath();
    if (!rootPath) return [];

    const config = loadConfig();
    const state = await this.snapshotService.loadState(rootPath, config);

    if (!state) return [];

    // 최신순으로 정렬
    return [...state.sessions].reverse().slice(0, 20);
  }

  /**
   * 세션의 3개 주요 섹션 반환: 사용자 요약, 변경 사항, 분석 결과
   */
  private getSessionSections(session: SessionRecord): HistoryItem[] {
    const items: HistoryItem[] = [];

    // 1. 시간 정보 (간단히)
    const dateStr = new Date(session.timestamp).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    items.push(new HistoryItem(
      dateStr,
      '시간',
      vscode.TreeItemCollapsibleState.None,
      'detail',
      undefined,
      undefined,
      new vscode.ThemeIcon('calendar')
    ));

    // 2. 사용자 요약 섹션
    items.push(new HistoryItem(
      session.changesSummary || session.userPrompt,
      '변경사항',
      vscode.TreeItemCollapsibleState.Collapsed,
      'section',
      session,
      'changes',
      new vscode.ThemeIcon('edit')
    ));

    // 3. 개선 항목 (있는 경우)
    if (session.aiMetadata) {
      items.push(new HistoryItem(
        `${session.aiMetadata.improvementsProposed}개 제안`,
        '개선 항목',
        vscode.TreeItemCollapsibleState.Collapsed,
        'section',
        session,
        'improvements',
        new vscode.ThemeIcon('lightbulb')
      ));

      // 4. 리스크 (있는 경우)
      if (session.aiMetadata.risksIdentified > 0) {
        items.push(new HistoryItem(
          `${session.aiMetadata.risksIdentified}개 리스크`,
          '리스크',
          vscode.TreeItemCollapsibleState.Collapsed,
          'section',
          session,
          'risks',
          new vscode.ThemeIcon('warning')
        ));
      }
    }

    return items;
  }

  /**
   * 섹션별 상세 정보 반환
   */
  private getSectionDetails(session: SessionRecord, sectionType: string): HistoryItem[] {
    const items: HistoryItem[] = [];

    switch (sectionType) {
      case 'changes':
        // 변경사항 상세
        if (session.diffSummary) {
          if (session.diffSummary.newFilesCount > 0) {
            items.push(new HistoryItem(
              `새 파일 ${session.diffSummary.newFilesCount}개`,
              '',
              vscode.TreeItemCollapsibleState.None,
              'detail',
              undefined,
              undefined,
              new vscode.ThemeIcon('new-file', new vscode.ThemeColor('charts.green'))
            ));
          }
          if (session.diffSummary.removedFilesCount > 0) {
            items.push(new HistoryItem(
              `삭제된 파일 ${session.diffSummary.removedFilesCount}개`,
              '',
              vscode.TreeItemCollapsibleState.None,
              'detail',
              undefined,
              undefined,
              new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red'))
            ));
          }
          if (session.diffSummary.changedConfigsCount > 0) {
            items.push(new HistoryItem(
              `설정 변경 ${session.diffSummary.changedConfigsCount}개`,
              '',
              vscode.TreeItemCollapsibleState.None,
              'detail',
              undefined,
              undefined,
              new vscode.ThemeIcon('settings-gear')
            ));
          }
          if (session.diffSummary.totalChanges > 0) {
            items.push(new HistoryItem(
              `총 변경: ${session.diffSummary.totalChanges}개`,
              '',
              vscode.TreeItemCollapsibleState.None,
              'detail',
              undefined,
              undefined,
              new vscode.ThemeIcon('diff')
            ));
          }
        }
        if (items.length === 0) {
          items.push(new HistoryItem(
            session.changesSummary || '변경사항 없음',
            '',
            vscode.TreeItemCollapsibleState.None,
            'detail'
          ));
        }
        break;

      case 'improvements':
        // 개선 항목 상세
        if (session.aiMetadata) {
          if (session.aiMetadata.priorityItems && session.aiMetadata.priorityItems.length > 0) {
            session.aiMetadata.priorityItems.forEach((item, index) => {
              items.push(new HistoryItem(
                item.length > 50 ? item.substring(0, 50) + '...' : item,
                `우선순위 ${index + 1}`,
                vscode.TreeItemCollapsibleState.None,
                'detail',
                undefined,
                undefined,
                new vscode.ThemeIcon('check')
              ));
            });
          } else {
            items.push(new HistoryItem(
              `${session.aiMetadata.improvementsProposed}개 개선 항목 제안됨`,
              '',
              vscode.TreeItemCollapsibleState.None,
              'detail',
              undefined,
              undefined,
              new vscode.ThemeIcon('lightbulb')
            ));
          }

          // 점수 표시
          if (session.aiMetadata.overallScore !== undefined) {
            const score = session.aiMetadata.overallScore;
            const scoreIcon = score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'error';
            items.push(new HistoryItem(
              `종합 점수: ${score}/100`,
              '',
              vscode.TreeItemCollapsibleState.None,
              'detail',
              undefined,
              undefined,
              new vscode.ThemeIcon(scoreIcon)
            ));
          }
        }
        break;

      case 'risks':
        // 리스크 상세
        if (session.aiMetadata && session.aiMetadata.risksIdentified > 0) {
          items.push(new HistoryItem(
            `${session.aiMetadata.risksIdentified}개의 잠재적 리스크 식별됨`,
            '',
            vscode.TreeItemCollapsibleState.None,
            'detail',
            undefined,
            undefined,
            new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
          ));
        }
        break;
    }

    return items;
  }

  private getRootPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }
    return workspaceFolders[0].uri.fsPath;
  }
}

class HistoryItem extends vscode.TreeItem {
  public readonly session?: SessionRecord;
  public readonly itemType: HistoryItemType;
  public readonly sectionType?: string;

  constructor(
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    itemType: HistoryItemType,
    session?: SessionRecord,
    sectionType?: string,
    iconPath?: vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.session = session;
    this.itemType = itemType;
    this.sectionType = sectionType;
    this.tooltip = session?.userPrompt || label;

    if (iconPath) {
      this.iconPath = iconPath;
    } else if (itemType === 'session') {
      this.iconPath = new vscode.ThemeIcon('history');
    }

    if (itemType === 'session' && session) {
      this.contextValue = 'session';
      this.command = {
        command: 'vibereport.showSessionDetail',
        title: 'Show Session Detail',
        arguments: [this.session],
      };
    }
  }
}
