/**
 * Workspace Scanner Service
 *
 * @description Scans the workspace to gather language stats, config files, important files,
 * directory structure, and optional Git info used by the report pipeline.
 *
 * @example
 * const scanner = new WorkspaceScanner(outputChannel);
 * const snapshot = await scanner.scan(config, (msg, pct) => console.log(msg, pct));
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ParseError } from 'jsonc-parser';
import type {
  ProjectSnapshot,
  DirectoryNode,
  MainConfigFiles,
  PackageJsonSummary,
  TsConfigSummary,
  TauriConfigSummary,
  CargoTomlSummary,
  GitInfo,
  ProgressCallback,
  VibeReportConfig,
} from '../models/types.js';
import { LANGUAGE_EXTENSIONS, IMPORTANT_CONFIG_FILES } from '../models/types.js';
import { OperationCancelledError } from '../models/errors.js';
import { collectFiles as collectFilesImpl } from './workspaceScanner/fileCollector.js';
import { calculateLanguageStats } from './workspaceScanner/languageStats.js';
import { scanTodoFixmeFindings } from './workspaceScanner/todoFixmeScanner.js';
import { createCacheKey, getCachedValue, setCachedValue } from './snapshotCache.js';

export class WorkspaceScanner {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * 워크스페이스 전체 스캔
   *
   * @description Collect file list, language stats, configs, structure summary, and optional Git info.
   * @param config Vibe Report 설정
   * @param onProgress 진행 상황 콜백 (선택)
   * @returns ProjectSnapshot
   */
  async scan(
    rootPath: string,
    config: VibeReportConfig,
    onProgress?: ProgressCallback,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ProjectSnapshot> {
    const projectName = path.basename(rootPath);

    onProgress?.('파일 목록 수집 중...', 10);
    this.log(`스캔 시작: ${rootPath}`);
    this.throwIfCancelled(cancellationToken, '파일 목록 수집');

    // 파일 목록 수집
    const files = await this.collectFiles(rootPath, config, cancellationToken);
    onProgress?.('언어 통계 분석 중...', 30);
    this.throwIfCancelled(cancellationToken, '언어 통계 분석');

    // 언어 통계 계산
    const languageStats = calculateLanguageStats(files);

    // 디렉토리 수 계산
    const directories = new Set<string>();
    files.forEach(f => {
      const dir = path.dirname(f);
      directories.add(dir);
    });

    onProgress?.('설정 파일 분석 중...', 50);
    this.throwIfCancelled(cancellationToken, '설정 파일 분석');

    // 주요 설정 파일 분석
    const mainConfigFiles = await this.analyzeConfigFiles(rootPath);

    // 중요 파일 식별
    const importantFiles = this.identifyImportantFiles(files, rootPath);

    onProgress?.('프로젝트 구조 생성 중...', 70);
    this.throwIfCancelled(cancellationToken, '프로젝트 구조 생성');

    // 디렉토리 구조 요약 (상위 3레벨)
    const structureSummary = await this.buildStructureSummary(rootPath, config, 3);

    // 기능 기반 프로젝트 구조 다이어그램 생성
    const structureDiagram = this.generateFunctionBasedStructure(files, rootPath, mainConfigFiles);

    onProgress?.('TODO/FIXME 스캔 중...', 80);
    this.throwIfCancelled(cancellationToken, 'TODO/FIXME 스캔');
    const todoFixmeFindings = await scanTodoFixmeFindings(rootPath, files);

    onProgress?.('Git 정보 수집 중...', 85);
    this.throwIfCancelled(cancellationToken, 'Git 정보 수집');

    // Git 정보
    let gitInfo: GitInfo | undefined;
    if (config.enableGitDiff) {
      gitInfo = await this.getGitInfo(rootPath);
    }

    onProgress?.('스냅샷 생성 완료', 100);
    this.throwIfCancelled(cancellationToken, '스냅샷 생성');

    const snapshot: ProjectSnapshot = {
      generatedAt: new Date().toISOString(),
      rootPath,
      projectName,
      filesCount: files.length,
      dirsCount: directories.size,
      languageStats,
      mainConfigFiles,
      importantFiles,
      fileList: files, // 전체 파일 목록 저장 (스냅샷 비교용)
      structureSummary,
      structureDiagram,
      gitInfo,
      todoFixmeFindings: todoFixmeFindings.length > 0 ? todoFixmeFindings : undefined,
    };

    this.log(`스캔 완료: ${files.length}개 파일, ${directories.size}개 디렉토리`);
    return snapshot;
  }

  /**
   * 파일 목록 수집 (캐시 지원)
   * 
   * @description 30초 TTL 캐시를 사용하여 연속 실행 시 성능을 향상시킵니다.
   */
  private async collectFiles(
    rootPath: string,
    config: VibeReportConfig,
    cancellationToken?: vscode.CancellationToken
  ): Promise<string[]> {
    return collectFilesImpl({
      rootPath,
      config,
      log: (message) => this.log(message),
      cancellationToken,
    });
  }

  private throwIfCancelled(
    cancellationToken: vscode.CancellationToken | undefined,
    step: string
  ): void {
    if (!cancellationToken?.isCancellationRequested) {
      return;
    }

    throw new OperationCancelledError(`Workspace scan cancelled: ${step}`);
  }

  /**
   * 주요 설정 파일 분석
   */
  private async analyzeConfigFiles(rootPath: string): Promise<MainConfigFiles> {
    const configs: MainConfigFiles = {
      otherConfigs: [],
    };

    // package.json
    try {
      const pkgPath = path.join(rootPath, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      configs.packageJson = this.parsePackageJson(pkg);
    } catch {
      // 파일 없음
    }

    // tsconfig.json
    try {
      const tscPath = path.join(rootPath, 'tsconfig.json');
      const content = await fs.readFile(tscPath, 'utf-8');
      const tsc = await this.parseJsoncObject(content);
      if (tsc) {
        configs.tsconfig = this.parseTsConfig(tsc);
      }
    } catch {
      // 파일 없음
    }

    // tauri.conf.json (다양한 위치 확인)
    const tauriPaths = [
      path.join(rootPath, 'src-tauri', 'tauri.conf.json'),
      path.join(rootPath, 'tauri.conf.json'),
    ];
    for (const tauriPath of tauriPaths) {
      try {
        const content = await fs.readFile(tauriPath, 'utf-8');
        const tauri = await this.parseJsoncObject(content);
        if (tauri) {
          configs.tauriConfig = this.parseTauriConfig(tauri);
          break;
        }
      } catch {
        // 다음 경로 시도
      }
    }

    // Cargo.toml
    const cargoPaths = [
      path.join(rootPath, 'Cargo.toml'),
      path.join(rootPath, 'src-tauri', 'Cargo.toml'),
    ];
    for (const cargoPath of cargoPaths) {
      try {
        const content = await fs.readFile(cargoPath, 'utf-8');
        configs.cargoToml = this.parseCargoToml(content);
        break;
      } catch {
        // 다음 경로 시도
      }
    }

    // docker-compose.yml
    const dockerPaths = [
      path.join(rootPath, 'docker-compose.yml'),
      path.join(rootPath, 'docker-compose.yaml'),
    ];
    for (const dockerPath of dockerPaths) {
      try {
        await fs.access(dockerPath);
        configs.dockerCompose = true;
        break;
      } catch {
        // 다음 경로 시도
      }
    }

    // 기타 설정 파일
    for (const configFile of IMPORTANT_CONFIG_FILES) {
      if (
        configFile !== 'package.json' &&
        configFile !== 'tsconfig.json' &&
        configFile !== 'tauri.conf.json' &&
        configFile !== 'Cargo.toml' &&
        !configFile.includes('docker-compose')
      ) {
        try {
          const configPath = path.join(rootPath, configFile);
          await fs.access(configPath);
          configs.otherConfigs.push(configFile);
        } catch {
          // 파일 없음
        }
      }
    }

    return configs;
  }

  private async parseJsoncObject(
    content: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const { parse } = await import('jsonc-parser');
      const errors: ParseError[] = [];
      const parsed = parse(content, errors, { allowTrailingComma: true });

      if (errors.length > 0) return null;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * package.json 파싱
   */
  private parsePackageJson(pkg: Record<string, unknown>): PackageJsonSummary {
    const scripts = Object.keys((pkg.scripts as Record<string, string>) || {});
    const deps = Object.keys((pkg.dependencies as Record<string, string>) || {});
    const devDeps = Object.keys((pkg.devDependencies as Record<string, string>) || {});
    const rawVersion = typeof pkg.version === 'string' ? pkg.version.trim() : '';
    const version = rawVersion.length > 0 ? rawVersion : undefined;

    return {
      name: (pkg.name as string) || 'unknown',
      version,
      description: pkg.description as string | undefined,
      scripts,
      dependencies: deps,
      devDependencies: devDeps,
      hasTypeScript: deps.includes('typescript') || devDeps.includes('typescript'),
      hasTest: scripts.some(s => s.includes('test')),
      hasLint: scripts.some(s => s.includes('lint')),
    };
  }

  /**
   * tsconfig.json 파싱
   */
  private parseTsConfig(tsc: Record<string, unknown>): TsConfigSummary {
    const compilerOptions = (tsc.compilerOptions as Record<string, unknown>) || {};
    return {
      target: compilerOptions.target as string | undefined,
      module: compilerOptions.module as string | undefined,
      strict: compilerOptions.strict as boolean | undefined,
      outDir: compilerOptions.outDir as string | undefined,
    };
  }

  /**
   * tauri.conf.json 파싱
   */
  private parseTauriConfig(tauri: Record<string, unknown>): TauriConfigSummary {
    return {
      productName: tauri.productName as string | undefined,
      version: tauri.version as string | undefined,
      identifier: tauri.identifier as string | undefined,
    };
  }

  /**
   * Cargo.toml 파싱 (간단한 파싱)
   */
  private parseCargoToml(content: string): CargoTomlSummary {
    const lines = content.split('\n');
    let name = 'unknown';
    let version = '0.0.0';
    const dependencies: string[] = [];

    let inDependencies = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('name = ')) {
        name = trimmed.replace('name = ', '').replace(/"/g, '');
      } else if (trimmed.startsWith('version = ')) {
        version = trimmed.replace('version = ', '').replace(/"/g, '');
      } else if (trimmed === '[dependencies]') {
        inDependencies = true;
      } else if (trimmed.startsWith('[') && inDependencies) {
        inDependencies = false;
      } else if (inDependencies && trimmed.includes('=')) {
        const depName = trimmed.split('=')[0].trim();
        if (depName) {
          dependencies.push(depName);
        }
      }
    }

    return { name, version, dependencies };
  }

  /**
   * 중요 파일 식별
   */
  private identifyImportantFiles(files: string[], rootPath: string): string[] {
    const important: string[] = [];
    const seen = new Set<string>();

    const patterns = [
      /^(?:.+\/)?src\/extension\.(ts|js)$/,
      /^src\/(main|index|app)\.(ts|tsx|js|jsx)$/,
      /^src\/lib\.(rs)$/,
      /^src\/(main|lib)\.(rs)$/,
      /^main\.(py|go|rs)$/,
      /^index\.(ts|tsx|js|jsx)$/,
      /^app\.(ts|tsx|js|jsx)$/,
      /^server\.(ts|js)$/,
      /^vite\.config\.(ts|js)$/,
      /^next\.config\.(js|mjs)$/,
      /^tailwind\.config\.(ts|js)$/,
    ];

    for (const file of files) {
      for (const pattern of patterns) {
        if (pattern.test(file)) {
          if (!seen.has(file)) {
            seen.add(file);
            important.push(file);
          }
          break;
        }
      }

      if (important.length >= 20) break;
    }

    // 최대 20개로 제한
    return important;
  }

  /**
   * 디렉토리 구조 요약 생성
   */
  private async buildStructureSummary(
    rootPath: string,
    config: VibeReportConfig,
    maxDepth: number
  ): Promise<DirectoryNode[]> {
    const excludeSet = new Set([
      'node_modules',
      '.git',
      'dist',
      'out',
      'build',
      'target',
      '.next',
      '__pycache__',
      '.venv',
      'coverage',
    ]);

    const buildNode = async (
      dirPath: string,
      depth: number
    ): Promise<DirectoryNode[]> => {
      if (depth > maxDepth) {
        return [];
      }

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const nodes: DirectoryNode[] = [];

        for (const entry of entries) {
          if (excludeSet.has(entry.name) || entry.name.startsWith('.')) {
            continue;
          }

          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            const children = await buildNode(fullPath, depth + 1);
            nodes.push({
              name: entry.name,
              type: 'directory',
              children: children.length > 0 ? children : undefined,
            });
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).slice(1);
            nodes.push({
              name: entry.name,
              type: 'file',
              extension: ext || undefined,
            });
          }
        }

        // 정렬: 디렉토리 먼저, 그 다음 파일 (알파벳순)
        nodes.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        return nodes;
      } catch (error) {
        this.log(`디렉토리 읽기 실패: ${dirPath}`);
        return [];
      }
    };

    return buildNode(rootPath, 0);
  }

  /**
   * Git 정보 수집
   */
  private async getGitInfo(rootPath: string): Promise<GitInfo | undefined> {
    const cacheKey = createCacheKey('git-info', rootPath);
    const cached = getCachedValue<GitInfo>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(rootPath);

      // Git 저장소인지 확인
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return undefined;
      }

      const branch = await git.branch();
      const status = await git.status();

      let lastCommit: { hash?: string; message?: string; date?: string } = {};
      try {
        const log = await git.log({ maxCount: 1 });
        if (log.latest) {
          lastCommit = {
            hash: log.latest.hash,
            message: log.latest.message.split('\n')[0],
            date: log.latest.date,
          };
        }
      } catch {
        // 커밋 히스토리 없음
      }

      const gitInfo: GitInfo = {
        branch: branch.current,
        currentCommit: lastCommit.hash,
        lastCommitHash: lastCommit.hash,
        lastCommitMessage: lastCommit.message,
        lastCommitDate: lastCommit.date,
        hasUncommittedChanges: !status.isClean(),
        uncommittedFilesCount: status.files.length,
      };

      setCachedValue(cacheKey, gitInfo);
      return gitInfo;
    } catch (error) {
      this.log(`Git 정보 수집 실패: ${error}`);
      return undefined;
    }
  }

  /**
   * 기능 기반 프로젝트 구조 다이어그램 생성
   *
   * @description 디렉토리 구조를 기능 단위로 분류하여 마크다운 형식의 구조도를 생성합니다.
   * @param files 전체 파일 목록
   * @param rootPath 워크스페이스 루트 경로
   * @param mainConfigFiles 주요 설정 파일 정보
   * @returns 마크다운 형식의 프로젝트 구조 다이어그램
   */
  private generateFunctionBasedStructure(
    files: string[],
    rootPath: string,
    mainConfigFiles: MainConfigFiles
  ): string {
    const lines: string[] = [];
    const projectName = path.basename(rootPath);

    type GroupKey = 'ui' | 'workflow' | 'core' | 'policy' | 'tooling' | 'misc';

    const groupMeta: Record<GroupKey, { icon: string; label: string; order: number; mermaidId: string }> = {
      ui: { icon: '🧭', label: '사용자 인터페이스', order: 1, mermaidId: 'UI' },
      workflow: { icon: '⚡', label: '명령·워크플로우', order: 2, mermaidId: 'Workflow' },
      core: { icon: '⚙️', label: '핵심 서비스', order: 3, mermaidId: 'Core' },
      policy: { icon: '🧰', label: '유틸·정책', order: 4, mermaidId: 'Policy' },
      tooling: { icon: '🛠️', label: '개발·유지보수', order: 5, mermaidId: 'Tooling' },
      misc: { icon: '📦', label: '기타/루트', order: 6, mermaidId: 'Misc' },
    };

    const categoryToGroup: Record<string, GroupKey> = {
      // 사용자 인터페이스
      views: 'ui',
      components: 'ui',
      pages: 'ui',
      hooks: 'ui',
      styles: 'ui',
      css: 'ui',
      assets: 'ui',
      public: 'ui',
      static: 'ui',
      // 명령/워크플로우
      commands: 'workflow',
      controllers: 'workflow',
      routes: 'workflow',
      api: 'workflow',
      middleware: 'workflow',
      // 핵심 서비스/도메인
      services: 'core',
      models: 'core',
      types: 'core',
      store: 'core',
      redux: 'core',
      lib: 'core',
      helpers: 'core',
      // 유틸/정책
      utils: 'policy',
      config: 'policy',
      constants: 'policy',
      // 개발/유지보수
      '__tests__': 'tooling',
      tests: 'tooling',
      test: 'tooling',
      spec: 'tooling',
      docs: 'tooling',
      devplan: 'tooling',
    };

    const categoryFiles: Record<string, string[]> = Object.keys(categoryToGroup).reduce(
      (acc, key) => {
        acc[key] = [];
        return acc;
      },
      {} as Record<string, string[]>
    );

    // 파일을 기능별로 분류
    let categorizedCount = 0;
    for (const file of files) {
      const parts = file.split('/');
      const firstDir = parts[0];

      // 워크스페이스 최상위 기능 디렉토리 우선
      if (categoryToGroup[firstDir]) {
        categoryFiles[firstDir].push(file);
        categorizedCount += 1;
        continue;
      }

      // 모노레포/서브프로젝트 지원: */src/<category>/... 형태 처리
      const srcIndex = parts.indexOf('src');
      const category = srcIndex >= 0 ? parts[srcIndex + 1] : null;
      if (category && categoryToGroup[category]) {
        categoryFiles[category].push(file);
        categorizedCount += 1;
      }
    }

    // 프로젝트 헤더
    lines.push(`### 📐 기능 기반 프로젝트 구조`);
    lines.push('');
    lines.push(`**프로젝트**: \`${projectName}\``);

    // 프로젝트 타입 추론
    const projectType = this.inferProjectType(mainConfigFiles, files);
    lines.push(`**타입**: ${projectType}`);
    lines.push('');

    lines.push('#### 기능 그룹 요약');
    lines.push('');
    lines.push('| 그룹 | 대표 영역 | 파일 수 |');
    lines.push('|:---|:---|:---:|');

    const groupRows = Object.entries(groupMeta)
      .filter(([key]) => key !== 'misc')
      .map(([key, meta]) => {
        const categories = Object.entries(categoryToGroup)
          .filter(([category, group]) => group === key && categoryFiles[category]?.length > 0)
          .map(([category]) => category);
        const fileCount = categories.reduce((sum, category) => sum + categoryFiles[category].length, 0);
        return { key: key as GroupKey, meta, categories, fileCount };
      })
      .filter((row) => row.fileCount > 0)
      .sort((a, b) => a.meta.order - b.meta.order);

    for (const row of groupRows) {
      const representative = row.categories.length > 0
        ? [...row.categories.slice(0, 4), row.categories.length > 4 ? '…' : '']
          .filter(Boolean)
          .join(', ')
        : '-';
      lines.push(`| ${row.meta.icon} **${row.meta.label}** | ${representative} | ${row.fileCount} |`);
    }

    const uncategorizedCount = Math.max(0, files.length - categorizedCount);
    if (uncategorizedCount > 0) {
      const misc = groupMeta.misc;
      lines.push(`| ${misc.icon} **${misc.label}** | 루트/기타 | ${uncategorizedCount} |`);
    }

    lines.push('');

    // 주요 엔트리포인트
    lines.push('#### 대표 진입점');
    const entryPointRegex =
      /^(?:(?:[^/]+\/)*src\/)?(main|index|app|extension|server)\.(ts|tsx|js|jsx)$/;
    const entryPoints = files.filter((f) => entryPointRegex.test(f)).slice(0, 3);

    if (entryPoints.length > 0) {
      for (const entry of entryPoints) {
        lines.push(`- \`${entry}\``);
      }
    } else {
      lines.push('- _(엔트리포인트 자동 감지 실패)_');
    }
    lines.push('');

    const mermaidGroups = [
      ...groupRows.map((row) => row.key),
      ...(uncategorizedCount > 0 ? ['misc' as GroupKey] : []),
    ];

    if (mermaidGroups.length >= 2) {
      lines.push('#### 구조 흐름');
      lines.push('');
      lines.push('```mermaid');
      lines.push('flowchart LR');

      const mermaidOrder: GroupKey[] = ['ui', 'workflow', 'core', 'policy', 'tooling', 'misc'];
      const orderedGroups = mermaidOrder.filter((key) => mermaidGroups.includes(key));

      for (const key of orderedGroups) {
        const meta = groupMeta[key];
        lines.push(`    ${meta.mermaidId}["${meta.icon} ${meta.label}"]`);
      }

      const chainOrder: GroupKey[] = ['ui', 'workflow', 'core', 'policy'];
      const chainGroups = chainOrder.filter((key) => orderedGroups.includes(key));
      for (let i = 0; i < chainGroups.length - 1; i += 1) {
        lines.push(`    ${groupMeta[chainGroups[i]].mermaidId} --> ${groupMeta[chainGroups[i + 1]].mermaidId}`);
      }

      const anchorId = chainGroups.length > 0
        ? groupMeta[chainGroups[chainGroups.length - 1]].mermaidId
        : (orderedGroups.length > 0 ? groupMeta[orderedGroups[0]].mermaidId : null);

      if (anchorId && orderedGroups.includes('tooling')) {
        lines.push(`    ${groupMeta.tooling.mermaidId} -.-> ${anchorId}`);
      }
      if (anchorId && orderedGroups.includes('misc')) {
        lines.push(`    ${groupMeta.misc.mermaidId} -.-> ${anchorId}`);
      }

      lines.push('```');
    }

    return lines.join('\n');
  }

  /**
   * 설정 파일 기반 프로젝트 타입 추론
   */
  private inferProjectType(mainConfigFiles: MainConfigFiles, files: string[]): string {
    const hasVsCodeExtension = files.some(f => f.includes('extension.ts') || f.includes('extension.js'));
    const hasTauri = !!mainConfigFiles.tauriConfig;
    const hasCargo = !!mainConfigFiles.cargoToml;
    const hasNext = files.some(f => f.includes('next.config'));
    const hasVite = files.some(f => f.includes('vite.config'));
    const hasReact = !!mainConfigFiles.packageJson?.dependencies.includes('react');
    const hasVue = !!mainConfigFiles.packageJson?.dependencies.includes('vue');

    if (hasVsCodeExtension) return '🔌 VS Code 확장';
    if (hasTauri) return '🖥️ Tauri 데스크톱 앱';
    if (hasNext) return '⚡ Next.js 앱';
    if (hasVite && hasReact) return '⚛️ React (Vite)';
    if (hasVite && hasVue) return '💚 Vue (Vite)';
    if (hasVite) return '⚡ Vite 프로젝트';
    if (hasCargo) return '🦀 Rust 프로젝트';
    if (hasReact) return '⚛️ React 앱';
    if (hasVue) return '💚 Vue 앱';

    return '📦 일반 프로젝트';
  }

  /**
   * 스냅샷을 텍스트 요약으로 변환
   *
   * @description Convert a snapshot into a human-readable summary block.
   * @param snapshot 프로젝트 스냅샷
   * @returns 요약 문자열
   */
  static snapshotToSummary(snapshot: ProjectSnapshot): string {
    const lines: string[] = [];

    lines.push(`## 프로젝트: ${snapshot.projectName}`);
    lines.push(`- 경로: ${snapshot.rootPath}`);
    lines.push(`- 파일 수: ${snapshot.filesCount}`);
    lines.push(`- 디렉토리 수: ${snapshot.dirsCount}`);
    lines.push('');

    // 언어 통계
    lines.push('### 언어 구성');
    const topLanguages = Object.entries(snapshot.languageStats).slice(0, 5);
    for (const [ext, count] of topLanguages) {
      const langName = LANGUAGE_EXTENSIONS[ext] || ext.toUpperCase();
      lines.push(`- ${langName}: ${count}개 파일`);
    }
    lines.push('');

    // 주요 설정
    lines.push('### 주요 설정');
    if (snapshot.mainConfigFiles.packageJson) {
      const pkg = snapshot.mainConfigFiles.packageJson;
      const versionLabel = pkg.version ? `@${pkg.version}` : '@unknown';
      lines.push(`- package.json: ${pkg.name}${versionLabel}`);
      if (pkg.hasTypeScript) lines.push('  - TypeScript 사용');
      if (pkg.hasTest) lines.push('  - 테스트 스크립트 있음');
      if (pkg.hasLint) lines.push('  - 린트 스크립트 있음');
    }
    if (snapshot.mainConfigFiles.tauriConfig) {
      lines.push(`- Tauri: ${snapshot.mainConfigFiles.tauriConfig.productName || '(설정됨)'}`);
    }
    if (snapshot.mainConfigFiles.cargoToml) {
      lines.push(`- Cargo.toml: ${snapshot.mainConfigFiles.cargoToml.name}`);
    }
    if (snapshot.mainConfigFiles.dockerCompose) {
      lines.push('- Docker Compose 설정 있음');
    }
    if (snapshot.mainConfigFiles.otherConfigs.length > 0) {
      lines.push(`- 기타 설정: ${snapshot.mainConfigFiles.otherConfigs.join(', ')}`);
    }
    lines.push('');

    // Git 정보
    if (snapshot.gitInfo) {
      lines.push('### Git 상태');
      lines.push(`- 브랜치: ${snapshot.gitInfo.branch}`);
      if (snapshot.gitInfo.lastCommitMessage) {
        lines.push(`- 최근 커밋: ${snapshot.gitInfo.lastCommitMessage}`);
      }
      if (snapshot.gitInfo.hasUncommittedChanges) {
        lines.push(`- 미커밋 변경: ${snapshot.gitInfo.uncommittedFilesCount}개 파일`);
      }
    }

    return lines.join('\n');
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[WorkspaceScanner] ${message}`);
  }
}
