import * as vscode from 'vscode';
import * as fs from 'fs/promises';

const EXTENSION_ID = 'stankjedi.vibereport';

const ALLOWLIST_KEYS = [
  'reportDirectory',
  'analysisRoot',
  'snapshotFile',
  'enableGitDiff',
  'excludePatterns',
  'maxFilesToScan',
  'autoOpenReports',
  'language',
  'projectVisionMode',
  'defaultProjectType',
  'defaultQualityFocus',
  'previewBackgroundColor',
  'previewEnabled',
  'enableDirectAi',
  'enableAutoUpdateReports',
  'autoUpdateDebounceMs',
  'preferredMarkdownViewer',
  'reportOpenMode',
  'ai.customInstructions',
] as const;

type AllowlistKey = (typeof ALLOWLIST_KEYS)[number];

const LEGACY_KEY_MAP: Readonly<Record<string, AllowlistKey>> = {
  enableRealtimeAnalysis: 'enableAutoUpdateReports',
  realtimeDebounceMs: 'autoUpdateDebounceMs',
};

const ALLOWLIST_SET = new Set<string>(ALLOWLIST_KEYS as readonly string[]);

function isAllowlistKey(key: string): key is AllowlistKey {
  return ALLOWLIST_SET.has(key);
}

function getExtensionVersion(): string {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  const version = ext?.packageJSON?.version;
  return typeof version === 'string' ? version : 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function exportSettings(): Promise<void> {
  const config = vscode.workspace.getConfiguration('vibereport');

  const settings: Partial<Record<AllowlistKey, unknown>> = {};
  for (const key of ALLOWLIST_KEYS) {
    const value = config.get(key);
    if (typeof value !== 'undefined') {
      settings[key] = value;
    }
  }

  const uri = await vscode.window.showSaveDialog({
    title: 'Export Vibe Report Settings',
    filters: { JSON: ['json'] },
    saveLabel: 'Export',
  });

  if (!uri) {
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    extensionVersion: getExtensionVersion(),
    settings,
  };

  await fs.writeFile(uri.fsPath, JSON.stringify(payload, null, 2), 'utf-8');

  vscode.window.showInformationMessage(
    `✅ Settings exported: ${uri.fsPath}`
  );
}

export async function importSettings(): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    title: 'Import Vibe Report Settings',
    canSelectMany: false,
    filters: { JSON: ['json'] },
    openLabel: 'Import',
  });

  if (!uris || uris.length === 0) {
    return;
  }

  const uri = uris[0];
  const raw = await fs.readFile(uri.fsPath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    vscode.window.showErrorMessage('Invalid settings file (failed to parse JSON).');
    return;
  }

  if (!isRecord(parsed) || !isRecord(parsed.settings)) {
    vscode.window.showErrorMessage('Invalid settings file (missing "settings" object).');
    return;
  }

  const config = vscode.workspace.getConfiguration('vibereport');
  const settings = parsed.settings;

  let applied = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(settings)) {
    const resolvedKey = isAllowlistKey(key) ? key : LEGACY_KEY_MAP[key];
    if (!resolvedKey) {
      skipped++;
      continue;
    }

    await config.update(resolvedKey, value, vscode.ConfigurationTarget.Workspace);
    applied++;
  }

  vscode.window.showInformationMessage(
    `✅ Settings imported (applied: ${applied}, skipped: ${skipped})`
  );
}
