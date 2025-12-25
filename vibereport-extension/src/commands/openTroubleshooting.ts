/**
 * Open Troubleshooting Command
 *
 * @description Opens the extension's TROUBLESHOOTING.md from the command palette.
 */

import * as vscode from 'vscode';

export class OpenTroubleshootingCommand {
  private outputChannel: vscode.OutputChannel;
  private extensionUri: vscode.Uri;

  constructor(outputChannel: vscode.OutputChannel, extensionUri: vscode.Uri) {
    this.outputChannel = outputChannel;
    this.extensionUri = extensionUri;
  }

  async execute(): Promise<void> {
    const docUri = vscode.Uri.joinPath(this.extensionUri, 'TROUBLESHOOTING.md');

    try {
      const doc = await vscode.workspace.openTextDocument(docUri);
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (error) {
      vscode.window.showWarningMessage(
        'Unable to open TROUBLESHOOTING.md. Please reinstall the extension or check your installation.'
      );
      this.outputChannel.appendLine(
        `[OpenTroubleshooting] Failed to open ${docUri.fsPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

