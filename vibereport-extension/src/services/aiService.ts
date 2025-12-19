import * as vscode from 'vscode';

const MAX_RESPONSE_CHARS = 200_000;
const TRUNCATED_SUFFIX = '\n\n[TRUNCATED]';
const MAX_RESPONSE_CONTENT_CHARS = MAX_RESPONSE_CHARS - TRUNCATED_SUFFIX.length;

/**
 * AI Service for direct integration with VS Code Language Model API.
 * Provides a layer to send analysis prompts directly to AI models.
 */
export class AiService {
  private outputChannel: vscode.OutputChannel;
  private lastSelectedModelId?: string;
  private memento?: vscode.Memento;

  private static readonly LAST_SELECTED_MODEL_ID_KEY =
    'vibereport.lastSelectedAiModelId';

  constructor(outputChannel: vscode.OutputChannel, memento?: vscode.Memento) {
    this.outputChannel = outputChannel;
    this.memento = memento;
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
  async runAnalysisPrompt(
    prompt: string,
    options?: { cancellationToken?: vscode.CancellationToken }
  ): Promise<string | null> {
    try {
      if (options?.cancellationToken?.isCancellationRequested) {
        this.log('AI request cancelled before start');
        return null;
      }

      if (typeof vscode.lm === 'undefined') {
        this.log('Language Model API is not available');
        return null;
      }

      const models = await vscode.lm.selectChatModels();
      if (!models || models.length === 0) {
        this.log('No AI models available');
        return null;
      }

      let model = models[0];
      if (models.length > 1) {
        const persistedLastSelected = this.memento?.get<string>(
          AiService.LAST_SELECTED_MODEL_ID_KEY
        );
        if (typeof persistedLastSelected === 'string' && persistedLastSelected) {
          this.lastSelectedModelId = persistedLastSelected;
        }

        type ModelPickItem = vscode.QuickPickItem & {
          model: (typeof models)[number];
        };

        const items: ModelPickItem[] = models.map(m => ({
          label: m.name || m.id || 'Unknown model',
          description: m.id,
          model: m,
          picked: m.id === this.lastSelectedModelId,
        }));

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select an AI model',
          ignoreFocusOut: true,
        });

        if (!picked) {
          this.log('AI model selection cancelled');
          return null;
        }

        model = picked.model;
        this.lastSelectedModelId = model.id;
        try {
          await this.memento?.update(
            AiService.LAST_SELECTED_MODEL_ID_KEY,
            model.id
          );
        } catch (error) {
          this.log(`Failed to persist last selected model ID: ${error}`);
        }
      }

      this.log(`Using AI model: ${model.name || model.id}`);

      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      const response = await model.sendRequest(
        messages,
        {},
        options?.cancellationToken ?? new vscode.CancellationTokenSource().token
      );

      const chunks: string[] = [];
      let totalChars = 0;
      let truncated = false;

      for await (const chunk of response.text) {
        if (typeof chunk !== 'string') {
          continue;
        }

        if (totalChars >= MAX_RESPONSE_CONTENT_CHARS) {
          truncated = true;
          break;
        }

        const nextTotal = totalChars + chunk.length;
        if (nextTotal > MAX_RESPONSE_CONTENT_CHARS) {
          const remaining = MAX_RESPONSE_CONTENT_CHARS - totalChars;
          if (remaining > 0) {
            chunks.push(chunk.slice(0, remaining));
            totalChars += remaining;
          }
          truncated = true;
          break;
        }

        chunks.push(chunk);
        totalChars = nextTotal;
      }

      let result = chunks.join('');
      if (truncated) {
        vscode.window.showWarningMessage(
          'AI response was truncated due to the size limit.'
        );
        this.log(`AI response truncated (max=${MAX_RESPONSE_CHARS} chars)`);
        result += TRUNCATED_SUFFIX;
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
