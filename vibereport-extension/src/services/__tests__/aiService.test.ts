import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../aiService.js';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  lm: {
    selectChatModels: vi.fn(),
  },
  CancellationTokenSource: vi.fn(function (this: any) {
    this.token = { isCancellationRequested: false };
  }),
  LanguageModelChatMessage: {
    User: vi.fn((content: string) => ({ role: 'user', content })),
  },
  window: {
    showQuickPick: vi.fn(),
    showWarningMessage: vi.fn(),
  },
}));

describe('AiService', () => {
  let aiService: AiService;
  const mockOutputChannel = {
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    name: 'test',
    replace: vi.fn(),
  } as unknown as vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = new AiService(mockOutputChannel);
  });

  describe('isAvailable', () => {
    it('returns true when models are available', async () => {
      (vscode.lm.selectChatModels as any).mockResolvedValue([
        { name: 'test-model', id: 'test-id' },
      ]);

      await expect(aiService.isAvailable()).resolves.toBe(true);
      expect(vscode.lm.selectChatModels).toHaveBeenCalled();
    });

    it('returns false when no models are available', async () => {
      (vscode.lm.selectChatModels as any).mockResolvedValue([]);

      await expect(aiService.isAvailable()).resolves.toBe(false);
    });

    it('returns false when selectChatModels returns null', async () => {
      (vscode.lm.selectChatModels as any).mockResolvedValue(null);

      await expect(aiService.isAvailable()).resolves.toBeFalsy();
    });

    it('returns false when selectChatModels throws', async () => {
      (vscode.lm.selectChatModels as any).mockRejectedValue(new Error('API Error'));

      await expect(aiService.isAvailable()).resolves.toBe(false);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('AI availability check failed')
      );
    });
  });

  describe('runAnalysisPrompt', () => {
    it('returns response text on success', async () => {
      async function* textGenerator() {
        yield 'Hello ';
        yield 'World!';
      }

      const model = {
        name: 'test-model',
        id: 'test-id',
        sendRequest: vi.fn().mockResolvedValue({ text: textGenerator() }),
      };

      (vscode.lm.selectChatModels as any).mockResolvedValue([model]);

      const result = await aiService.runAnalysisPrompt('Test prompt');

      expect(result).toBe('Hello World!');
      expect(model.sendRequest).toHaveBeenCalled();
      expect(vscode.LanguageModelChatMessage.User).toHaveBeenCalledWith('Test prompt');
    });

    it('truncates overly large streamed responses and warns once', async () => {
      async function* textGenerator() {
        yield 'a'.repeat(120_000);
        yield 'b'.repeat(120_000);
      }

      const model = {
        name: 'test-model',
        id: 'test-id',
        sendRequest: vi.fn().mockResolvedValue({ text: textGenerator() }),
      };

      (vscode.lm.selectChatModels as any).mockResolvedValue([model]);

      const result = await aiService.runAnalysisPrompt('Test prompt');

      expect(result).not.toBeNull();
      const text = result as string;
      expect(text.endsWith('[TRUNCATED]')).toBe(true);
      expect(text.length).toBeLessThanOrEqual(200_000);
      expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    });

    it('returns null when no models are available', async () => {
      (vscode.lm.selectChatModels as any).mockResolvedValue([]);

      const result = await aiService.runAnalysisPrompt('Test prompt');

      expect(result).toBeNull();
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('No AI models available')
      );
    });

    it('returns null when model selection is cancelled (multiple models)', async () => {
      const modelA = { name: 'Model A', id: 'a', sendRequest: vi.fn() };
      const modelB = { name: 'Model B', id: 'b', sendRequest: vi.fn() };

      (vscode.lm.selectChatModels as any).mockResolvedValue([modelA, modelB]);
      (vscode.window.showQuickPick as any).mockResolvedValue(undefined);

      const result = await aiService.runAnalysisPrompt('Test prompt');

      expect(result).toBeNull();
      expect(vscode.window.showQuickPick).toHaveBeenCalled();
      expect(modelA.sendRequest).not.toHaveBeenCalled();
      expect(modelB.sendRequest).not.toHaveBeenCalled();
    });

    it('prompts for model selection when multiple models exist and remembers last selection', async () => {
      async function* textGenerator() {
        yield 'OK';
      }

      const makeResponse = () => ({ text: textGenerator() });

      const modelA = {
        name: 'Model A',
        id: 'a',
        sendRequest: vi.fn().mockImplementation(() => Promise.resolve(makeResponse())),
      };
      const modelB = {
        name: 'Model B',
        id: 'b',
        sendRequest: vi.fn().mockImplementation(() => Promise.resolve(makeResponse())),
      };

      (vscode.lm.selectChatModels as any).mockResolvedValue([modelA, modelB]);
      (vscode.window.showQuickPick as any).mockResolvedValue({
        label: 'Model B',
        description: 'b',
        model: modelB,
      });

      const first = await aiService.runAnalysisPrompt('Test');
      expect(first).toBe('OK');
      expect(modelB.sendRequest).toHaveBeenCalled();

      // Second call should preselect (picked) the last selected model
      (vscode.window.showQuickPick as any).mockResolvedValue({
        label: 'Model B',
        description: 'b',
        model: modelB,
      });

      const second = await aiService.runAnalysisPrompt('Test2');
      expect(second).toBe('OK');

      const secondItems = (vscode.window.showQuickPick as any).mock.calls[1][0] as Array<{
        description?: string;
        picked?: boolean;
      }>;
      const picked = secondItems.find(i => i.description === 'b');
      expect(picked?.picked).toBe(true);
    });

    it('persists last selected model via memento and preselects it on a new instance', async () => {
      async function* textGenerator() {
        yield 'OK';
      }

      const makeResponse = () => ({ text: textGenerator() });

      const modelA = {
        name: 'Model A',
        id: 'a',
        sendRequest: vi.fn().mockImplementation(() => Promise.resolve(makeResponse())),
      };
      const modelB = {
        name: 'Model B',
        id: 'b',
        sendRequest: vi.fn().mockImplementation(() => Promise.resolve(makeResponse())),
      };

      const store = new Map<string, unknown>();
      const memento = {
        get: vi.fn((key: string) => store.get(key)),
        update: vi.fn(async (key: string, value: unknown) => {
          store.set(key, value);
        }),
      } as unknown as vscode.Memento;

      (vscode.lm.selectChatModels as any).mockResolvedValue([modelA, modelB]);
      (vscode.window.showQuickPick as any).mockResolvedValue({
        label: 'Model B',
        description: 'b',
        model: modelB,
      });

      const service1 = new AiService(mockOutputChannel, memento);
      const first = await service1.runAnalysisPrompt('Test');
      expect(first).toBe('OK');
      expect(memento.update).toHaveBeenCalledWith(
        'vibereport.lastSelectedAiModelId',
        'b'
      );

      // Simulate a reload: a new AiService instance should preselect the stored model ID.
      (vscode.lm.selectChatModels as any).mockResolvedValue([modelA, modelB]);
      (vscode.window.showQuickPick as any).mockResolvedValue({
        label: 'Model B',
        description: 'b',
        model: modelB,
      });

      const service2 = new AiService(mockOutputChannel, memento);
      const second = await service2.runAnalysisPrompt('Test2');
      expect(second).toBe('OK');

      const secondItems = (vscode.window.showQuickPick as any).mock.calls[1][0] as Array<{
        description?: string;
        picked?: boolean;
      }>;
      const picked = secondItems.find(i => i.description === 'b');
      expect(picked?.picked).toBe(true);
    });

    it('returns null and does not call sendRequest when cancelled before start', async () => {
      async function* textGenerator() {
        yield 'OK';
      }

      const model = {
        name: 'Model',
        id: 'm',
        sendRequest: vi.fn().mockResolvedValue({ text: textGenerator() }),
      };

      (vscode.lm.selectChatModels as any).mockResolvedValue([model]);

      const result = await aiService.runAnalysisPrompt('Test', {
        cancellationToken: { isCancellationRequested: true } as any,
      });

      expect(result).toBeNull();
      expect(model.sendRequest).not.toHaveBeenCalled();
    });

    it('logs model name when processing', async () => {
      async function* textGenerator() {
        yield 'Response';
      }

      const model = {
        name: 'GPT-4',
        id: 'gpt-4-id',
        sendRequest: vi.fn().mockResolvedValue({ text: textGenerator() }),
      };

      (vscode.lm.selectChatModels as any).mockResolvedValue([model]);

      await aiService.runAnalysisPrompt('Test');

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Using AI model: GPT-4')
      );
    });

    it('logs response size after receiving', async () => {
      async function* textGenerator() {
        yield 'Short response';
      }

      const model = {
        name: 'test-model',
        id: 'test-id',
        sendRequest: vi.fn().mockResolvedValue({ text: textGenerator() }),
      };

      (vscode.lm.selectChatModels as any).mockResolvedValue([model]);

      await aiService.runAnalysisPrompt('Test');

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('AI response received (14 characters)')
      );
    });

    it('returns null when sendRequest throws', async () => {
      const model = {
        name: 'test-model',
        id: 'test-id',
        sendRequest: vi.fn().mockRejectedValue(new Error('API Error')),
      };

      (vscode.lm.selectChatModels as any).mockResolvedValue([model]);

      const result = await aiService.runAnalysisPrompt('Test prompt');

      expect(result).toBeNull();
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('AI request failed')
      );
    });
  });
});
