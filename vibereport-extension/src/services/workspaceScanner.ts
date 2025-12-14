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
import { getCachedValue, setCachedValue, createCacheKey } from './snapshotCache.js';

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
    onProgress?: ProgressCallback
  ): Promise<ProjectSnapshot> {
    const projectName = path.basename(rootPath);

    onProgress?.('파일 목록 수집 중...', 10);
    this.log(`스캔 시작: ${rootPath}`);

    // 파일 목록 수집
    const files = await this.collectFiles(rootPath, config);
    onProgress?.('언어 통계 분석 중...', 30);

    // 언어 통계 계산
    const languageStats = this.calculateLanguageStats(files);

    // 디렉토리 수 계산
    const directories = new Set<string>();
    files.forEach(f => {
      const dir = path.dirname(f);
      directories.add(dir);
    });

    onProgress?.('설정 파일 분석 중...', 50);

    // 주요 설정 파일 분석
    const mainConfigFiles = await this.analyzeConfigFiles(rootPath);

    // 중요 파일 식별
    const importantFiles = this.identifyImportantFiles(files, rootPath);

    onProgress?.('프로젝트 구조 생성 중...', 70);

    // 디렉토리 구조 요약 (상위 3레벨)
    const structureSummary = await this.buildStructureSummary(rootPath, config, 3);

    // 기능 기반 프로젝트 구조 다이어그램 생성
    const structureDiagram = this.generateFunctionBasedStructure(files, rootPath, mainConfigFiles);

    onProgress?.('Git 정보 수집 중...', 85);

    // Git 정보
    let gitInfo: GitInfo | undefined;
    if (config.enableGitDiff) {
      gitInfo = await this.getGitInfo(rootPath);
    }

    onProgress?.('스냅샷 생성 완료', 100);

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
    config: VibeReportConfig
  ): Promise<string[]> {
    const cacheKey = createCacheKey('file-list', rootPath, config.maxFilesToScan);
    const cached = getCachedValue<string[]>(cacheKey);

    if (cached) {
      this.log(`[WorkspaceScanner] Using cached file list for ${rootPath}`);
      return cached;
    }

    const excludePattern = `{${config.excludePatterns.join(',')}}`;

    const uris = await vscode.workspace.findFiles(
      '**/*',
      excludePattern,
      config.maxFilesToScan
    );

    const files = uris
      .filter(uri => uri.fsPath.startsWith(rootPath))
      .map(uri => path.relative(rootPath, uri.fsPath).replace(/\\/g, '/'));

    setCachedValue(cacheKey, files);
    return files;
  }

  /**
   * 언어별 파일 수 통계
   */
  private calculateLanguageStats(files: string[]): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const file of files) {
      const ext = path.extname(file).slice(1).toLowerCase();
      if (ext && LANGUAGE_EXTENSIONS[ext]) {
        stats[ext] = (stats[ext] || 0) + 1;
      }
    }

    // 내림차순 정렬
    const sorted = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, number>);

    return sorted;
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
      const tsc = JSON.parse(content);
      configs.tsconfig = this.parseTsConfig(tsc);
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
        const tauri = JSON.parse(content);
        configs.tauriConfig = this.parseTauriConfig(tauri);
        break;
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

  /**
   * package.json 파싱
   */
  private parsePackageJson(pkg: Record<string, unknown>): PackageJsonSummary {
    const scripts = Object.keys((pkg.scripts as Record<string, string>) || {});
    const deps = Object.keys((pkg.dependencies as Record<string, string>) || {});
    const devDeps = Object.keys((pkg.devDependencies as Record<string, string>) || {});

    return {
      name: (pkg.name as string) || 'unknown',
      version: (pkg.version as string) || '0.0.0',
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

    const patterns = [
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
          important.push(file);
          break;
        }
      }
    }

    // 최대 20개로 제한
    return important.slice(0, 20);
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
            hash: log.latest.hash.substring(0, 7),
            message: log.latest.message.split('\n')[0],
            date: log.latest.date,
          };
        }
      } catch {
        // 커밋 히스토리 없음
      }

      return {
        branch: branch.current,
        lastCommitHash: lastCommit.hash,
        lastCommitMessage: lastCommit.message,
        lastCommitDate: lastCommit.date,
        hasUncommittedChanges: !status.isClean(),
        uncommittedFilesCount: status.files.length,
      };
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

    // 기능별 디렉토리 분류 (일반적인 프로젝트 구조)
    const functionalCategories: Record<string, { icon: string; description: string; files: string[] }> = {
      // 핵심 소스 코드
      'commands': { icon: '⚡', description: '명령 처리 및 액션', files: [] },
      'services': { icon: '⚙️', description: '비즈니스 로직 및 서비스', files: [] },
      'controllers': { icon: '🎮', description: '요청 처리 컨트롤러', files: [] },
      'routes': { icon: '🛤️', description: 'API 라우트 정의', files: [] },
      'api': { icon: '🌐', description: 'API 엔드포인트', files: [] },
      'views': { icon: '👁️', description: 'UI 뷰 컴포넌트', files: [] },
      'components': { icon: '🧩', description: 'UI 컴포넌트', files: [] },
      'pages': { icon: '📄', description: '페이지 컴포넌트', files: [] },
      'models': { icon: '📦', description: '데이터 모델 및 타입', files: [] },
      'types': { icon: '📝', description: '타입 정의', files: [] },
      'utils': { icon: '🔧', description: '유틸리티 함수', files: [] },
      'helpers': { icon: '🤝', description: '헬퍼 함수', files: [] },
      'lib': { icon: '📚', description: '라이브러리 및 공통 모듈', files: [] },
      'hooks': { icon: '🪝', description: 'React 훅', files: [] },
      'store': { icon: '🗄️', description: '상태 관리', files: [] },
      'redux': { icon: '🗄️', description: 'Redux 상태 관리', files: [] },
      'middleware': { icon: '🔌', description: '미들웨어', files: [] },
      'config': { icon: '🔧', description: '설정 파일', files: [] },
      'constants': { icon: '📋', description: '상수 정의', files: [] },
      // 테스트
      '__tests__': { icon: '🧪', description: '테스트 파일', files: [] },
      'tests': { icon: '🧪', description: '테스트 파일', files: [] },
      'test': { icon: '🧪', description: '테스트 파일', files: [] },
      'spec': { icon: '🧪', description: '테스트 스펙', files: [] },
      // 리소스
      'assets': { icon: '🖼️', description: '정적 리소스', files: [] },
      'public': { icon: '🌍', description: '공개 정적 파일', files: [] },
      'static': { icon: '📁', description: '정적 파일', files: [] },
      'styles': { icon: '🎨', description: '스타일 파일', files: [] },
      'css': { icon: '🎨', description: 'CSS 스타일', files: [] },
      // 문서
      'docs': { icon: '📖', description: '문서', files: [] },
      'devplan': { icon: '📊', description: '개발 계획 및 보고서', files: [] },
    };

    // 파일을 기능별로 분류
    for (const file of files) {
      const parts = file.split('/');
      const firstDir = parts[0];
      const secondDir = parts.length > 1 ? parts[1] : null;

      // src 하위 디렉토리 우선 확인
      if (firstDir === 'src' && secondDir && functionalCategories[secondDir]) {
        functionalCategories[secondDir].files.push(file);
      } else if (functionalCategories[firstDir]) {
        functionalCategories[firstDir].files.push(file);
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

    // 기능별 구조 테이블
    lines.push('| 기능 영역 | 설명 | 파일 수 |');
    lines.push('|:---|:---|:---:|');

    // 파일이 있는 카테고리만 표시 (파일 수 내림차순)
    const sortedCategories = Object.entries(functionalCategories)
      .filter(([_, info]) => info.files.length > 0)
      .sort((a, b) => b[1].files.length - a[1].files.length);

    for (const [category, info] of sortedCategories) {
      lines.push(`| ${info.icon} **${category}/** | ${info.description} | ${info.files.length} |`);
    }

    lines.push('');

    // 주요 엔트리포인트
    lines.push('#### 주요 진입점');
    const entryPoints = files.filter(f =>
      /^(src\/)?(main|index|app|extension|server)\.(ts|tsx|js|jsx)$/.test(f)
    ).slice(0, 5);

    if (entryPoints.length > 0) {
      for (const entry of entryPoints) {
        lines.push(`- \`${entry}\``);
      }
    } else {
      lines.push('- _(엔트리포인트 자동 감지 실패)_');
    }
    lines.push('');

    // 데이터 흐름 요약 (Mermaid flowchart)
    if (sortedCategories.length >= 2) {
      lines.push('#### 데이터 흐름');
      lines.push('');
      const hasCommands = functionalCategories['commands'].files.length > 0;
      const hasServices = functionalCategories['services'].files.length > 0;
      const hasViews = functionalCategories['views'].files.length > 0 ||
        functionalCategories['components'].files.length > 0;
      const hasModels = functionalCategories['models'].files.length > 0 ||
        functionalCategories['types'].files.length > 0;
      const hasControllers = functionalCategories['controllers'].files.length > 0;
      const hasRoutes = functionalCategories['routes'].files.length > 0 ||
        functionalCategories['api'].files.length > 0;

      // Mermaid flowchart 생성
      lines.push('```mermaid');
      lines.push('flowchart LR');

      // 노드 정의 (존재하는 것만)
      const nodes: { id: string; label: string }[] = [];
      if (hasViews) nodes.push({ id: 'Views', label: '👁️ Views/Components' });
      if (hasCommands) nodes.push({ id: 'Commands', label: '⚡ Commands' });
      if (hasControllers) nodes.push({ id: 'Controllers', label: '🎮 Controllers' });
      if (hasRoutes) nodes.push({ id: 'Routes', label: '🛤️ Routes/API' });
      if (hasServices) nodes.push({ id: 'Services', label: '⚙️ Services' });
      if (hasModels) nodes.push({ id: 'Models', label: '📦 Models/Types' });

      if (nodes.length >= 2) {
        // 노드 정의
        for (const node of nodes) {
          lines.push(`    ${node.id}["${node.label}"]`);
        }
        // 연결 (순서대로)
        for (let i = 0; i < nodes.length - 1; i++) {
          lines.push(`    ${nodes[i].id} --> ${nodes[i + 1].id}`);
        }
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
      lines.push(`- package.json: ${pkg.name}@${pkg.version}`);
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
