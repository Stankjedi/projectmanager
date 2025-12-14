import * as vscode from 'vscode';

/**
 * AI Service for direct integration with VS Code Language Model API.
 * Provides a layer to send analysis prompts directly to AI models.
 */
export class AiService {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Check if the Language Model API is available.
   * @returns true if vscode.lm is available and models can be selected
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (typeof vscode.lm === 'undefined') {
        return false;
      }
      const models = await vscode.lm.selectChatModels();
      return models && models.length > 0;
    } catch (error) {
      this.log(`AI availability check failed: ${error}`);
      return false;
    }
  }

  /**
   * Run an analysis prompt through the Language Model API.
   * @param prompt The analysis prompt to send
   * @returns The model response text, or null if unavailable/failed
   */
  async runAnalysisPrompt(prompt: string): Promise<string | null> {
    try {
      if (!await this.isAvailable()) {
        this.log('Language Model API is not available');
        return null;
      }

      const models = await vscode.lm.selectChatModels();
      if (!models || models.length === 0) {
        this.log('No AI models available');
        return null;
      }

      const model = models[0];
      this.log(`Using AI model: ${model.name || model.id}`);

      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      let result = '';
      for await (const chunk of response.text) {
        result += chunk;
      }

      this.log(`AI response received (${result.length} characters)`);
      return result;

    } catch (error) {
      this.log(`AI request failed: ${error}`);
      vscode.window.showWarningMessage(
        'AI direct integration failed. Falling back to clipboard mode.'
      );
      return null;
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] [AiService] ${message}`);
  }
}

