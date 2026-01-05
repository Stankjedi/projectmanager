import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  fixDocsVersionSync,
  validateDocsVersionSync,
  validateReportMarkdown,
} from '../utils/reportDoctorUtils.js';

type DoctorSubcommand = 'check' | 'fix';
type DoctorOutputFormat = 'text' | 'json';

export interface DoctorCliRunOptions {
  argv: string[];
  cwd?: string;
  stdout?: Pick<Console, 'log'>;
  stderr?: Pick<Console, 'error'>;
}

function resolveRepoRootFromWorkspaceRoot(workspaceRoot: string): {
  repoRoot: string;
  extensionRoot: string;
} {
  const normalized = path.resolve(workspaceRoot);
  const isExtensionRoot = path.basename(normalized) === 'vibereport-extension';
  const repoRoot = isExtensionRoot ? path.resolve(normalized, '..') : normalized;
  const extensionRoot = isExtensionRoot
    ? normalized
    : path.join(repoRoot, 'vibereport-extension');
  return { repoRoot, extensionRoot };
}

function parseArgs(argv: string[]): {
  subcommand: DoctorSubcommand | null;
  workspace?: string;
  format: DoctorOutputFormat;
} {
  let subcommand: DoctorSubcommand | null = null;
  let workspace: string | undefined;
  let format: DoctorOutputFormat = 'text';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--json') {
      format = 'json';
      continue;
    }

    if (arg === '--format') {
      const value = argv[i + 1];
      if (!value) break;
      if (value === 'json') {
        format = 'json';
      }
      i++;
      continue;
    }

    if (arg.startsWith('--format=')) {
      const value = arg.slice('--format='.length);
      if (value === 'json') {
        format = 'json';
      }
      continue;
    }

    if (arg === '--workspace') {
      const value = argv[i + 1];
      if (!value) break;
      workspace = value;
      i++;
      continue;
    }

    if (arg.startsWith('--workspace=')) {
      workspace = arg.slice('--workspace='.length);
      continue;
    }

    if (arg.startsWith('-')) continue;

    if (arg === 'check' || arg === 'fix') {
      subcommand = arg;
      continue;
    }
  }

  return { subcommand, workspace, format };
}

async function readTextFile(filePath: string): Promise<{ content: string; exists: boolean }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content, exists: true };
  } catch (error: any) {
    if (error?.code === 'ENOENT') return { content: '', exists: false };
    throw error;
  }
}

type DoctorDocsIssue = ReturnType<typeof validateDocsVersionSync>[number];
type DoctorReportIssue = ReturnType<typeof validateReportMarkdown>[number];

export interface DoctorReportIssueSummary {
  label: string;
  filePath: string;
  exists: boolean;
  issues: DoctorReportIssue[];
}

export interface DoctorCheckResult {
  ok: boolean;
  exitCode: 0 | 1 | 2;
  issuesFound: number;
  missingFiles: string[];
  docsIssues: DoctorDocsIssue[];
  reportIssues: DoctorReportIssueSummary[];
}

async function runCheckData(args: {
  repoRoot: string;
  extensionRoot: string;
}): Promise<DoctorCheckResult> {
  const { repoRoot, extensionRoot } = args;

  const docsPaths = {
    packageJson: path.join(extensionRoot, 'package.json'),
    changelog: path.join(extensionRoot, 'CHANGELOG.md'),
    extReadme: path.join(extensionRoot, 'README.md'),
    rootReadme: path.join(repoRoot, 'README.md'),
  };

  const reportPaths = {
    evaluation: path.join(repoRoot, 'devplan', 'Project_Evaluation_Report.md'),
    improvement: path.join(repoRoot, 'devplan', 'Project_Improvement_Exploration_Report.md'),
    prompt: path.join(repoRoot, 'devplan', 'Prompt.md'),
  };

  const [packageResult, changelogResult, rootReadmeResult, extReadmeResult] =
    await Promise.all([
      readTextFile(docsPaths.packageJson),
      readTextFile(docsPaths.changelog),
      readTextFile(docsPaths.rootReadme),
      readTextFile(docsPaths.extReadme),
    ]);

  let packageVersion = '';
  if (packageResult.exists) {
    try {
      const parsed = JSON.parse(packageResult.content) as { version?: string };
      packageVersion = typeof parsed.version === 'string' ? parsed.version : '';
    } catch {
      packageVersion = '';
    }
  }

  const docsIssues = validateDocsVersionSync({
    packageVersion,
    readmeContent: rootReadmeResult.content,
    extReadmeContent: extReadmeResult.content,
    changelogContent: changelogResult.content,
  });

  const [evaluation, improvement, prompt] = await Promise.all([
    readTextFile(reportPaths.evaluation),
    readTextFile(reportPaths.improvement),
    readTextFile(reportPaths.prompt),
  ]);

  const reportIssues: DoctorReportIssueSummary[] = [
    {
      label: 'devplan/Project_Evaluation_Report.md',
      filePath: reportPaths.evaluation,
      exists: evaluation.exists,
      issues: validateReportMarkdown(evaluation.content, 'evaluation'),
    },
    {
      label: 'devplan/Project_Improvement_Exploration_Report.md',
      filePath: reportPaths.improvement,
      exists: improvement.exists,
      issues: validateReportMarkdown(improvement.content, 'improvement'),
    },
    {
      label: 'devplan/Prompt.md',
      filePath: reportPaths.prompt,
      exists: prompt.exists,
      issues: validateReportMarkdown(prompt.content, 'prompt'),
    },
  ];

  const missingFiles = [
    docsPaths.packageJson,
    docsPaths.changelog,
    docsPaths.rootReadme,
    docsPaths.extReadme,
    reportPaths.evaluation,
    reportPaths.improvement,
    reportPaths.prompt,
  ].filter(p => {
    const all = [packageResult, changelogResult, rootReadmeResult, extReadmeResult, evaluation, improvement, prompt];
    const idx = [
      docsPaths.packageJson,
      docsPaths.changelog,
      docsPaths.rootReadme,
      docsPaths.extReadme,
      reportPaths.evaluation,
      reportPaths.improvement,
      reportPaths.prompt,
    ].indexOf(p);
    return idx >= 0 ? !all[idx].exists : false;
  });

  let issuesFound = docsIssues.length + reportIssues.reduce((sum, r) => sum + r.issues.length, 0);

  if (missingFiles.length > 0) {
    issuesFound += missingFiles.length;
  }

  const exitCode: 0 | 1 = issuesFound === 0 ? 0 : 1;

  return {
    ok: exitCode === 0,
    exitCode,
    issuesFound,
    missingFiles,
    docsIssues,
    reportIssues,
  };
}

function printDoctorCheckResultText(args: {
  result: DoctorCheckResult;
  stdout: Pick<Console, 'log'>;
}): void {
  const { result, stdout } = args;

  if (result.exitCode === 0) {
    stdout.log('[doctor] OK: no issues found.');
    return;
  }

  stdout.log(`[doctor] Issues found: ${result.issuesFound}`);

  if (result.missingFiles.length > 0) {
    stdout.log(`[doctor] Missing files: ${result.missingFiles.length}`);
    for (const p of result.missingFiles) {
      stdout.log(`- missing: ${p}`);
    }
  }

  if (result.docsIssues.length > 0) {
    stdout.log(`[doctor] Docs issues: ${result.docsIssues.length}`);
    for (const issue of result.docsIssues) {
      stdout.log(`- [docs] ${issue.code}: ${issue.message}`);
    }
  }

  for (const report of result.reportIssues) {
    if (report.issues.length === 0) continue;
    stdout.log(`[doctor] ${report.label} issues: ${report.issues.length}`);
    for (const issue of report.issues) {
      stdout.log(`- [${report.label}] ${issue.code}: ${issue.message}`);
    }
  }
}

async function runFixData(args: {
  repoRoot: string;
  extensionRoot: string;
}): Promise<{ updatedFiles: string[]; check: DoctorCheckResult }> {
  const { repoRoot, extensionRoot } = args;

  const docsPaths = {
    packageJson: path.join(extensionRoot, 'package.json'),
    changelog: path.join(extensionRoot, 'CHANGELOG.md'),
    extReadme: path.join(extensionRoot, 'README.md'),
    rootReadme: path.join(repoRoot, 'README.md'),
  };

  const [packageResult, changelogResult, rootReadmeResult, extReadmeResult] =
    await Promise.all([
      readTextFile(docsPaths.packageJson),
      readTextFile(docsPaths.changelog),
      readTextFile(docsPaths.rootReadme),
      readTextFile(docsPaths.extReadme),
    ]);

  let packageVersion = '';
  if (packageResult.exists) {
    try {
      const parsed = JSON.parse(packageResult.content) as { version?: string };
      packageVersion = typeof parsed.version === 'string' ? parsed.version : '';
    } catch {
      packageVersion = '';
    }
  }

  const updatedFiles: string[] = [];
  if (packageVersion && changelogResult.exists && rootReadmeResult.exists) {
    const fixedRoot = fixDocsVersionSync({
      packageVersion,
      readmeContent: rootReadmeResult.content,
      changelogContent: changelogResult.content,
    });

    if (fixedRoot.changed.readme) {
      await fs.writeFile(docsPaths.rootReadme, fixedRoot.readmeContent, 'utf-8');
      updatedFiles.push(docsPaths.rootReadme);
    }
    if (fixedRoot.changed.changelog) {
      await fs.writeFile(docsPaths.changelog, fixedRoot.changelogContent, 'utf-8');
      updatedFiles.push(docsPaths.changelog);
    }

    if (extReadmeResult.exists) {
      const fixedExt = fixDocsVersionSync({
        packageVersion,
        readmeContent: extReadmeResult.content,
        changelogContent: fixedRoot.changelogContent,
      });

      if (fixedExt.changed.readme) {
        await fs.writeFile(docsPaths.extReadme, fixedExt.readmeContent, 'utf-8');
        updatedFiles.push(docsPaths.extReadme);
      }
    }
  }

  const check = await runCheckData({ repoRoot, extensionRoot });
  return { updatedFiles, check };
}

export async function runDoctorCli(options: DoctorCliRunOptions): Promise<0 | 1 | 2> {
  const stdout = options.stdout ?? console;
  const stderr = options.stderr ?? console;
  const cwd = options.cwd ?? process.cwd();

  const parsed = parseArgs(options.argv);
  if (!parsed.subcommand) {
    stderr.error('[doctor] Usage: doctorCli.js <check|fix> [--workspace <path>]');

    if (parsed.format === 'json') {
      stdout.log(
        JSON.stringify({
          ok: false,
          exitCode: 2,
          issuesFound: 0,
          missingFiles: [],
          docsIssues: [],
          reportIssues: [],
        } satisfies DoctorCheckResult)
      );
    }

    return 2;
  }

  const workspaceRoot = parsed.workspace ? path.resolve(cwd, parsed.workspace) : cwd;
  const { repoRoot, extensionRoot } = resolveRepoRootFromWorkspaceRoot(workspaceRoot);

  try {
    if (parsed.subcommand === 'check') {
      const result = await runCheckData({ repoRoot, extensionRoot });
      if (parsed.format === 'json') {
        stdout.log(JSON.stringify(result));
      } else {
        printDoctorCheckResultText({ result, stdout });
      }
      return result.exitCode;
    }

    const fixResult = await runFixData({ repoRoot, extensionRoot });
    if (parsed.format === 'json') {
      stdout.log(JSON.stringify(fixResult.check));
    } else {
      if (fixResult.updatedFiles.length > 0) {
        stdout.log(
          `[doctor] Updated ${fixResult.updatedFiles.length} file(s): ${fixResult.updatedFiles.join(', ')}`
        );
      } else {
        stdout.log('[doctor] No safe fixes applied.');
      }

      printDoctorCheckResultText({ result: fixResult.check, stdout });
    }

    return fixResult.check.exitCode;
  } catch (error) {
    stderr.error(`[doctor] Unexpected error: ${String(error)}`);
    if (parsed.format === 'json') {
      stdout.log(
        JSON.stringify({
          ok: false,
          exitCode: 2,
          issuesFound: 0,
          missingFiles: [],
          docsIssues: [],
          reportIssues: [],
        } satisfies DoctorCheckResult)
      );
    }
    return 2;
  }
}

function shouldRunAsCliEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return entry.endsWith(`${path.sep}doctorCli.js`) || entry.endsWith(`${path.sep}doctorCli.ts`);
}

async function main(): Promise<void> {
  const exitCode = await runDoctorCli({ argv: process.argv.slice(2) });
  process.exitCode = exitCode;
}

if (shouldRunAsCliEntrypoint()) {
  void main();
}
