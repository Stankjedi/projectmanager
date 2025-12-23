import * as vscode from 'vscode';
import * as path from 'path';
import { resolveAnalysisRoot, selectWorkspaceRoot } from '../utils/index.js';

type Candidate = {
  relativePath: string;
  depth: number;
  hasPackageJson: boolean;
  hasTsconfig: boolean;
  hasExtensionEntrypoint: boolean;
};

type CandidatePickItem = vscode.QuickPickItem & {
  value: string;
};

const WIZARD_EXCLUDE = '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**,**/.next/**,**/coverage/**,**/.vscode/**}';
const MAX_RESULTS = 200;

function toPosixRelativePath(rootPath: string, candidateRootPath: string): string {
  const relative = path.relative(rootPath, candidateRootPath);
  return relative.replace(/\\/g, '/');
}

function getDepth(relativePath: string): number {
  if (!relativePath) return 0;
  return relativePath.split('/').filter(Boolean).length;
}

function sortCandidates(a: Candidate, b: Candidate): number {
  if (a.hasExtensionEntrypoint !== b.hasExtensionEntrypoint) {
    return a.hasExtensionEntrypoint ? -1 : 1;
  }
  if (a.hasPackageJson !== b.hasPackageJson) {
    return a.hasPackageJson ? -1 : 1;
  }
  if (a.hasTsconfig !== b.hasTsconfig) {
    return a.hasTsconfig ? -1 : 1;
  }
  if (a.depth !== b.depth) return a.depth - b.depth;
  return a.relativePath.localeCompare(b.relativePath);
}

function toPickItem(candidate: Candidate, currentAnalysisRoot: string): CandidatePickItem {
  if (!candidate.relativePath) {
    return {
      label: '$(root-folder) Workspace root',
      description: 'Use the workspace root as analysisRoot',
      picked: currentAnalysisRoot.trim() === '',
      value: '',
    };
  }

  const signals: string[] = [];
  if (candidate.hasExtensionEntrypoint) signals.push('src/extension.ts');
  if (candidate.hasPackageJson) signals.push('package.json');
  if (candidate.hasTsconfig) signals.push('tsconfig.json');

  const prefix = candidate.hasExtensionEntrypoint ? '$(extensions) ' : '$(folder) ';

  return {
    label: `${prefix}${candidate.relativePath}`,
    description: signals.join(', '),
    picked: currentAnalysisRoot.trim() === candidate.relativePath,
    value: candidate.relativePath,
  };
}

export class SetAnalysisRootWizardCommand {
  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  async execute(): Promise<void> {
    const workspaceRoot = await selectWorkspaceRoot();
    if (!workspaceRoot) return;

    const config = vscode.workspace.getConfiguration('vibereport');
    const currentAnalysisRoot = config.get<string>('analysisRoot', '');

    const candidates = await this.collectCandidates(workspaceRoot);
    const items = candidates.map((candidate) => toPickItem(candidate, currentAnalysisRoot));

    const selection = await vscode.window.showQuickPick(items, {
      title: 'Select analysisRoot',
      placeHolder: 'Pick the folder to use as analysisRoot (workspace-relative)',
      matchOnDescription: true,
    });

    if (!selection) return;

    const analysisRoot = selection.value;
    try {
      resolveAnalysisRoot(workspaceRoot, analysisRoot);
    } catch (error) {
      vscode.window.showErrorMessage(
        'analysisRoot 설정이 유효하지 않습니다. 워크스페이스 루트 하위 경로만 허용됩니다.'
      );
      this.log(`analysisRoot invalid: ${String(error)}`);
      return;
    }

    await config.update('analysisRoot', analysisRoot, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`✅ analysisRoot가 설정되었습니다: ${analysisRoot || '(workspace root)'}`);
  }

  private async collectCandidates(workspaceRoot: string): Promise<Candidate[]> {
    const byPath = new Map<string, Candidate>();

    const ensure = (relativePath: string): Candidate => {
      const existing = byPath.get(relativePath);
      if (existing) return existing;

      const created: Candidate = {
        relativePath,
        depth: getDepth(relativePath),
        hasPackageJson: false,
        hasTsconfig: false,
        hasExtensionEntrypoint: false,
      };
      byPath.set(relativePath, created);
      return created;
    };

    // Always include workspace root as an option.
    ensure('');

    const [packages, tsconfigs, extensions] = await Promise.all([
      vscode.workspace.findFiles('**/package.json', WIZARD_EXCLUDE, MAX_RESULTS),
      vscode.workspace.findFiles('**/tsconfig.json', WIZARD_EXCLUDE, MAX_RESULTS),
      vscode.workspace.findFiles('**/src/extension.ts', WIZARD_EXCLUDE, MAX_RESULTS),
    ]);

    for (const uri of packages) {
      if (!uri.fsPath.startsWith(workspaceRoot)) continue;
      const candidateRoot = path.dirname(uri.fsPath);
      const rel = toPosixRelativePath(workspaceRoot, candidateRoot);
      ensure(rel).hasPackageJson = true;
    }

    for (const uri of tsconfigs) {
      if (!uri.fsPath.startsWith(workspaceRoot)) continue;
      const candidateRoot = path.dirname(uri.fsPath);
      const rel = toPosixRelativePath(workspaceRoot, candidateRoot);
      ensure(rel).hasTsconfig = true;
    }

    for (const uri of extensions) {
      if (!uri.fsPath.startsWith(workspaceRoot)) continue;
      const candidateRoot = path.dirname(path.dirname(uri.fsPath));
      const rel = toPosixRelativePath(workspaceRoot, candidateRoot);
      ensure(rel).hasExtensionEntrypoint = true;
    }

    const candidates = [...byPath.values()].filter(
      (candidate) => candidate.hasPackageJson || candidate.hasTsconfig || candidate.hasExtensionEntrypoint || candidate.relativePath === ''
    );

    candidates.sort(sortCandidates);
    return candidates;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[SetAnalysisRootWizard] ${message}`);
  }
}

