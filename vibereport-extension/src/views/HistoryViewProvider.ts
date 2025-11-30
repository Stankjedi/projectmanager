/**
 * History View Provider
 * 세션 히스토리 트리 뷰
 */

import * as vscode from 'vscode';
import type { SessionRecord, VibeReportConfig } from '../models/types.js';
import { SnapshotService } from '../services/index.js';
import { formatRelativeTime } from '../utils/markdownUtils.js';

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
    if (element) {
      // 세션 상세 정보
      return this.getSessionDetails(element.session!);
    }

    // 루트: 세션 목록
    const sessions = await this.loadSessions();
    return sessions.map(session => new HistoryItem(
      session.userPrompt.substring(0, 50) + (session.userPrompt.length > 50 ? '...' : ''),
      formatRelativeTime(session.timestamp),
      vscode.TreeItemCollapsibleState.Collapsed,
      session
    ));
  }

  private async loadSessions(): Promise<SessionRecord[]> {
    const rootPath = this.getRootPath();
    if (!rootPath) return [];

    const config = this.loadConfig();
    const state = await this.snapshotService.loadState(rootPath, config);

    if (!state) return [];

    // 최신순으로 정렬
    return [...state.sessions].reverse().slice(0, 20);
  }

  private getSessionDetails(session: SessionRecord): HistoryItem[] {
    const items: HistoryItem[] = [];

    items.push(new HistoryItem(
      `📅 ${new Date(session.timestamp).toLocaleString()}`,
      '시간',
      vscode.TreeItemCollapsibleState.None
    ));

    items.push(new HistoryItem(
      `📝 ${session.changesSummary}`,
      '변경사항',
      vscode.TreeItemCollapsibleState.None
    ));

    if (session.aiMetadata) {
      items.push(new HistoryItem(
        `💡 ${session.aiMetadata.improvementsProposed}개 제안`,
        '개선 항목',
        vscode.TreeItemCollapsibleState.None
      ));

      if (session.aiMetadata.risksIdentified > 0) {
        items.push(new HistoryItem(
          `⚠️ ${session.aiMetadata.risksIdentified}개 리스크`,
          '리스크',
          vscode.TreeItemCollapsibleState.None
        ));
      }
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
}

class HistoryItem extends vscode.TreeItem {
  public readonly session?: SessionRecord;

  constructor(
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    session?: SessionRecord
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.session = session;
    this.tooltip = session?.userPrompt || label;

    if (session) {
      this.iconPath = new vscode.ThemeIcon('history');
      this.contextValue = 'session';
      this.command = {
        command: 'vibereport.showSessionDetail',
        title: 'Show Session Detail',
        arguments: [this.session],
      };
    }
  }
}
