import * as vscode from 'vscode';

type AntigravityAcceptCommands = {
  agentStep?: string;
  command?: string;
  terminalCommand?: string;
};

const AUTO_ACCEPT_SETTING_KEY = 'antigravity-auto-accept.enabled';

const CONTEXT_KEYS = {
  editorTextFocus: 'editorTextFocus',
  terminalFocus: 'terminalFocus',
  canAcceptOrRejectCommand: 'antigravity.canAcceptOrRejectCommand',
  canTriggerTerminalCommandAction: 'antigravity.canTriggerTerminalCommandAction',
} as const;

const COMMAND_ALIASES: Readonly<
  Record<keyof AntigravityAcceptCommands, readonly string[]>
> = {
  agentStep: [
    'antigravity.agent.acceptAgentStep',
    'antigravity.agent.acceptagentstep',
  ],
  command: ['antigravity.command.accept'],
  terminalCommand: ['antigravity.terminalCommand.accept'],
};

export class AntigravityAutoAcceptService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  private enabled = false;
  private acceptInProgress = false;
  private acceptQueued = false;
  private acceptDebounceTimer: NodeJS.Timeout | undefined;
  private lastAcceptLogAtMs = 0;
  private contextKeyQuerySupported: boolean | undefined;

  private resolvedCommands: AntigravityAcceptCommands = {};
  private lastCommandRefreshAtMs = 0;

  constructor(private readonly channel: vscode.OutputChannel) {}

  async initialize(): Promise<void> {
    this.enabled = this.readEnabledSetting();
    await this.refreshAntigravityCommands({ force: true });

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (!event.affectsConfiguration(AUTO_ACCEPT_SETTING_KEY)) return;
        void this.applyEnabledSetting();
      })
    );

    const workspaceEvents = vscode.workspace as unknown as Partial<
      Pick<typeof vscode.workspace, 'onDidChangeTextDocument' | 'onDidOpenTextDocument'>
    >;
    const windowEvents = vscode.window as unknown as Partial<
      Pick<
        typeof vscode.window,
        | 'onDidChangeActiveTextEditor'
        | 'onDidOpenTerminal'
        | 'onDidChangeActiveTerminal'
        | 'onDidChangeWindowState'
      >
    >;

    if (typeof workspaceEvents.onDidChangeTextDocument === 'function') {
      this.disposables.push(
        workspaceEvents.onDidChangeTextDocument(event => {
          if (!this.enabled) return;
          if (event.document.uri.scheme === 'file') return;
          this.requestAccept(`textDocument:${event.document.uri.scheme}`);
        })
      );
    }

    if (typeof workspaceEvents.onDidOpenTextDocument === 'function') {
      this.disposables.push(
        workspaceEvents.onDidOpenTextDocument(doc => {
          if (!this.enabled) return;
          this.requestAccept(`openTextDocument:${doc.uri.scheme}`);
        })
      );
    }

    if (typeof windowEvents.onDidChangeActiveTextEditor === 'function') {
      this.disposables.push(
        windowEvents.onDidChangeActiveTextEditor(editor => {
          if (!this.enabled) return;
          const scheme = editor?.document.uri.scheme;
          if (!scheme) return;
          this.requestAccept(`activeEditor:${scheme}`);
        })
      );
    }

    if (typeof windowEvents.onDidOpenTerminal === 'function') {
      this.disposables.push(
        windowEvents.onDidOpenTerminal(() => {
          if (!this.enabled) return;
          this.requestAccept('openTerminal');
        })
      );
    }

    if (typeof windowEvents.onDidChangeActiveTerminal === 'function') {
      this.disposables.push(
        windowEvents.onDidChangeActiveTerminal(() => {
          if (!this.enabled) return;
          this.requestAccept('activeTerminal');
        })
      );
    }

    if (typeof windowEvents.onDidChangeWindowState === 'function') {
      this.disposables.push(
        windowEvents.onDidChangeWindowState(state => {
          if (!this.enabled) return;
          if (!state.focused) return;
          this.requestAccept('windowFocus');
        })
      );
    }

    if (this.enabled) {
      this.channel.appendLine(
        '[AntigravityAutoAccept] enabled (event-driven, no polling)'
      );
    }
  }

  dispose(): void {
    if (this.acceptDebounceTimer) {
      clearTimeout(this.acceptDebounceTimer);
      this.acceptDebounceTimer = undefined;
    }
    for (const d of this.disposables.splice(0, this.disposables.length)) {
      try {
        d.dispose();
      } catch {
        // ignore
      }
    }
  }

  async toggleEnabled(): Promise<void> {
    const next = !this.readEnabledSetting();
    await this.updateEnabledSetting(next);
    await this.applyEnabledSetting();
    vscode.window.showInformationMessage(
      next ? 'Auto-Accept enabled.' : 'Auto-Accept disabled.'
    );
  }

  private readEnabledSetting(): boolean {
    return vscode.workspace
      .getConfiguration()
      .get<boolean>(AUTO_ACCEPT_SETTING_KEY, false);
  }

  private async updateEnabledSetting(enabled: boolean): Promise<void> {
    const cfg = vscode.workspace.getConfiguration();
    const inspected = cfg.inspect<boolean>(AUTO_ACCEPT_SETTING_KEY);

    const target =
      inspected?.workspaceFolderValue !== undefined
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : inspected?.workspaceValue !== undefined
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global;

    await cfg.update(AUTO_ACCEPT_SETTING_KEY, enabled, target);
  }

  private async applyEnabledSetting(): Promise<void> {
    this.enabled = this.readEnabledSetting();
    await this.refreshAntigravityCommands({ force: true });

    if (!this.enabled) {
      this.channel.appendLine('[AntigravityAutoAccept] disabled');
      return;
    }

    const { agentStep, command, terminalCommand } = this.resolvedCommands;
    if (!agentStep && !command && !terminalCommand) {
      this.channel.appendLine(
        '[AntigravityAutoAccept] enabled but Antigravity accept commands were not found'
      );
    } else {
      this.channel.appendLine('[AntigravityAutoAccept] enabled');
    }

    this.requestAccept('enabled');
  }

  private requestAccept(trigger: string): void {
    if (!this.enabled) return;

    this.acceptQueued = true;
    if (this.acceptDebounceTimer) return;

    // Coalesce bursts of UI/document events.
    this.acceptDebounceTimer = setTimeout(() => {
      this.acceptDebounceTimer = undefined;
      void this.drainAcceptQueue(trigger);
    }, 75);
  }

  private async drainAcceptQueue(trigger: string): Promise<void> {
    if (this.acceptInProgress) return;
    this.acceptInProgress = true;

    try {
      while (this.acceptQueued && this.enabled) {
        this.acceptQueued = false;
        await this.tryExecuteAcceptCommands(trigger);
      }
    } finally {
      this.acceptInProgress = false;
    }
  }

  private async tryExecuteAcceptCommands(trigger: string): Promise<void> {
    await this.refreshAntigravityCommands({ force: false });

    const commandsToTry = await this.selectCommandsToTry();

    if (commandsToTry.length === 0) return;

    for (const commandId of commandsToTry) {
      try {
        await vscode.commands.executeCommand(commandId);
      } catch {
        // When there's nothing to accept, Antigravity commands may throw; ignore.
      }
    }

    // Low-noise trace for troubleshooting.
    const now = Date.now();
    if (trigger === 'enabled' || now - this.lastAcceptLogAtMs > 2500) {
      this.lastAcceptLogAtMs = now;
      this.channel.appendLine(`[AntigravityAutoAccept] accept attempted (${trigger})`);
    }
  }

  private async selectCommandsToTry(): Promise<string[]> {
    const { agentStep, command, terminalCommand } = this.resolvedCommands;

    if (!agentStep && !command && !terminalCommand) {
      return [];
    }

    const supportsContextQuery = await this.detectContextKeyQuerySupport();
    if (!supportsContextQuery) {
      const all: string[] = [];
      if (agentStep) all.push(agentStep);
      if (command) all.push(command);
      if (terminalCommand) all.push(terminalCommand);
      return all;
    }

    const editorTextFocus = await this.getContextFlag(CONTEXT_KEYS.editorTextFocus);
    const terminalFocus = await this.getContextFlag(CONTEXT_KEYS.terminalFocus);
    const canAcceptOrRejectCommand = await this.getContextFlag(
      CONTEXT_KEYS.canAcceptOrRejectCommand
    );
    const canTriggerTerminalCommandAction = await this.getContextFlag(
      CONTEXT_KEYS.canTriggerTerminalCommandAction
    );

    if (editorTextFocus === undefined || terminalFocus === undefined) {
      // Context query exists but doesn't provide core focus keys; fall back to best-effort execution.
      const all: string[] = [];
      if (agentStep) all.push(agentStep);
      if (command) all.push(command);
      if (terminalCommand) all.push(terminalCommand);
      return all;
    }

    // Mirror Antigravity keybinding "when" clauses:
    // - terminal accept: terminalFocus && antigravity.canTriggerTerminalCommandAction
    // - editor accept: editorTextFocus && antigravity.canAcceptOrRejectCommand
    // - agent step accept: !editorTextFocus
    const selected: string[] = [];

    if (terminalCommand && terminalFocus && canTriggerTerminalCommandAction === true) {
      selected.push(terminalCommand);
      return selected;
    }

    if (command && editorTextFocus && canAcceptOrRejectCommand === true) {
      selected.push(command);
      return selected;
    }

    if (agentStep && editorTextFocus === false) {
      selected.push(agentStep);
      return selected;
    }

    return [];
  }

  private async detectContextKeyQuerySupport(): Promise<boolean> {
    if (this.contextKeyQuerySupported !== undefined) {
      return this.contextKeyQuerySupported;
    }

    try {
      await vscode.commands.executeCommand('getContextKeyValue', 'editorTextFocus');
      this.contextKeyQuerySupported = true;
      return true;
    } catch {
      this.contextKeyQuerySupported = false;
      return false;
    }
  }

  private async getContextFlag(key: string): Promise<boolean | undefined> {
    if (this.contextKeyQuerySupported === false) return undefined;

    try {
      const value = await vscode.commands.executeCommand<unknown>('getContextKeyValue', key);
      if (typeof value !== 'boolean') return undefined;
      return value;
    } catch {
      return undefined;
    }
  }

  private async refreshAntigravityCommands(options: { force: boolean }): Promise<void> {
    const now = Date.now();
    if (!options.force && now - this.lastCommandRefreshAtMs < 10_000) return;
    this.lastCommandRefreshAtMs = now;

    let available: string[] = [];
    try {
      available = await vscode.commands.getCommands(true);
    } catch {
      return;
    }

    const availableLower = new Map<string, string>();
    for (const cmd of available) {
      availableLower.set(cmd.toLowerCase(), cmd);
    }

    const resolveAlias = (aliases: readonly string[]): string | undefined => {
      for (const alias of aliases) {
        const resolved = availableLower.get(alias.toLowerCase());
        if (resolved) return resolved;
      }
      return undefined;
    };

    this.resolvedCommands = {
      agentStep: resolveAlias(COMMAND_ALIASES.agentStep),
      command: resolveAlias(COMMAND_ALIASES.command),
      terminalCommand: resolveAlias(COMMAND_ALIASES.terminalCommand),
    };
  }
}
