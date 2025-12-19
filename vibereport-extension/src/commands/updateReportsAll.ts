import * as vscode from 'vscode';
import { UpdateReportsCommand } from './updateReports.js';

export class UpdateReportsAllCommand {
  private updateReportsCommand: UpdateReportsCommand;

  constructor(
    outputChannel: vscode.OutputChannel,
    updateReportsCommand?: UpdateReportsCommand
  ) {
    this.updateReportsCommand =
      updateReportsCommand ?? new UpdateReportsCommand(outputChannel);
  }

  async execute(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
      return;
    }

    const total = folders.length;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Vibe Report: Batch Update (${total} workspaces)`,
        cancellable: false,
      },
      async progress => {
        for (let index = 0; index < folders.length; index++) {
          const folder = folders[index];
          const prefix = `[${index + 1}/${total}] ${folder.name}`;

          progress.report({ message: `${prefix}: starting...` });

          const folderProgress: vscode.Progress<{
            message?: string;
            increment?: number;
          }> = {
            report: ({ message }) => {
              if (message) {
                progress.report({ message: `${prefix}: ${message}` });
              }
            },
          };

          await this.updateReportsCommand.executeForWorkspace(
            folder.uri.fsPath,
            folder.name,
            {
              progress: folderProgress,
              suppressOpenReports: true,
              suppressNotifications: true,
            }
          );
        }
      }
    );

    vscode.window.showInformationMessage(
      `✅ Batch report update completed for ${total} workspace folders.`
    );
  }
}
