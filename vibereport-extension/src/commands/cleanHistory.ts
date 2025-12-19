/**
 * Clean History Command
 * 세션 히스토리 초기화 명령
 */

import * as vscode from 'vscode';
import { SnapshotService } from '../services/snapshotService.js';
import { loadConfig, selectWorkspaceRoot } from '../utils/index.js';

/**
 * Clean History Command
 * Clears all session history and resets the state file
 */
export class CleanHistoryCommand {
    private outputChannel: vscode.OutputChannel;
    private snapshotService: SnapshotService;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.snapshotService = new SnapshotService(outputChannel);
    }

    async execute(): Promise<void> {
        // Get workspace root
        const rootPath = await selectWorkspaceRoot();
        if (!rootPath) {
            return;
        }

        // Show confirmation dialog
        const confirmation = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all session history? This action cannot be undone.',
            { modal: true },
            'Yes',
            'No'
        );

        if (confirmation !== 'Yes') {
            this.log('세션 히스토리 초기화 취소됨');
            return;
        }

        try {
            const config = loadConfig();
            await this.snapshotService.clearHistory(rootPath, config);

            vscode.window.showInformationMessage('Session history cleared successfully.');
            this.log('세션 히스토리 초기화 완료');

            // Trigger view refresh
            vscode.commands.executeCommand('vibereport.refreshViews');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to clear session history: ${message}`);
            this.log(`세션 히스토리 초기화 실패: ${error}`);
        }
    }

    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] [CleanHistory] ${message}`);
    }
}
