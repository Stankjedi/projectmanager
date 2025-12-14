/**
 * Snapshot Service
 * 스냅샷 저장, 로드, 비교 기능
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  ProjectSnapshot,
  SnapshotDiff,
  VibeReportState,
  SessionRecord,
  AppliedImprovement,
  GitChanges,
  GitLineMetric,
  VibeReportConfig,
} from '../models/types.js';
import { STATE_VERSION } from '../models/types.js';

export class SnapshotService {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * 상태 파일 경로 계산
   */
  private getStatePath(rootPath: string, config: VibeReportConfig): string {
    return path.join(rootPath, config.snapshotFile);
  }

  /**
   * 이전 상태 로드
   */
  async loadState(
    rootPath: string,
    config: VibeReportConfig
  ): Promise<VibeReportState | null> {
    const statePath = this.getStatePath(rootPath, config);

    try {
      const content = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(content) as VibeReportState;

      // 버전 체크 및 마이그레이션 (필요시)
      if (state.version !== STATE_VERSION) {
        this.log(`상태 파일 버전 불일치: ${state.version} → ${STATE_VERSION}`);
        return this.migrateState(state);
      }

      this.log(`상태 로드 완료: ${state.sessions.length}개 세션`);
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.log('이전 상태 파일 없음 - 초기 상태 생성');
        return null;
      }
      this.log(`상태 로드 실패: ${error}`);
      return null;
    }
  }

  /**
   * 상태 저장
   */
  async saveState(
    rootPath: string,
    config: VibeReportConfig,
    state: VibeReportState
  ): Promise<void> {
    const statePath = this.getStatePath(rootPath, config);

    // .vscode 디렉토리 확인/생성
    const stateDir = path.dirname(statePath);
    try {
      await fs.mkdir(stateDir, { recursive: true });
    } catch {
      // 이미 존재
    }

    // 상태 저장
    const content = JSON.stringify(state, null, 2);
    await fs.writeFile(statePath, content, 'utf-8');
    this.log(`상태 저장 완료: ${statePath}`);
  }

  /**
   * 초기 상태 생성
   */
  createInitialState(): VibeReportState {
    return {
      lastSnapshot: null,
      sessions: [],
      appliedImprovements: [],
      lastUpdated: new Date().toISOString(),
      version: STATE_VERSION,
    };
  }

  /**
   * 스냅샷 비교
   */
  async compareSnapshots(
    previous: ProjectSnapshot | null,
    current: ProjectSnapshot,
    rootPath: string,
    config: VibeReportConfig
  ): Promise<SnapshotDiff> {
    // 초기 생성인 경우
    if (!previous) {
      return {
        previousSnapshotTime: null,
        currentSnapshotTime: current.generatedAt,
        isInitial: true,
        newFiles: [],
        removedFiles: [],
        changedConfigs: [],
        languageStatsDiff: {},
        totalChanges: 0,
        filesCountDiff: current.filesCount,
        dirsCountDiff: current.dirsCount,
      };
    }

    // 파일 목록 비교를 위해 현재 파일 목록 수집
    const currentFiles = await this.collectFileList(rootPath, config);

    // 이전 파일 목록 로드 (저장된 목록이 있으면 사용, 없으면 importantFiles 사용)
    const previousFileList = previous.fileList || previous.importantFiles;
    const previousFilesSet = new Set(previousFileList);
    const currentFilesSet = new Set(currentFiles);

    // 새 파일 (현재에는 있지만 이전에는 없는 파일)
    const newFiles = currentFiles
      .filter(f => !previousFilesSet.has(f))
      .slice(0, 50);

    // 삭제된 파일 (이전에는 있었지만 현재에는 없는 파일)
    const removedFiles = previousFileList
      .filter(f => !currentFilesSet.has(f))
      .slice(0, 50);

    // 파일/디렉토리 수 변화
    const filesCountDiff = current.filesCount - previous.filesCount;
    const dirsCountDiff = current.dirsCount - previous.dirsCount;

    // 설정 파일 변경 감지
    const changedConfigs = this.detectConfigChanges(previous, current);

    // 언어 통계 변화
    const languageStatsDiff: Record<string, number> = {};
    const allLangs = new Set([
      ...Object.keys(previous.languageStats),
      ...Object.keys(current.languageStats),
    ]);
    for (const lang of allLangs) {
      const prev = previous.languageStats[lang] || 0;
      const curr = current.languageStats[lang] || 0;
      const diff = curr - prev;
      if (diff !== 0) {
        languageStatsDiff[lang] = diff;
      }
    }

    // Git 변경사항
    let gitChanges: GitChanges | undefined;
    if (config.enableGitDiff) {
      gitChanges = await this.getGitChanges(rootPath);
    }

    // Compute aggregate line metrics from Git diff
    let linesAdded: number | undefined;
    let linesRemoved: number | undefined;
    let linesTotal: number | undefined;

    if (gitChanges?.lineMetrics && gitChanges.lineMetrics.length > 0) {
      linesAdded = gitChanges.lineMetrics.reduce((sum, m) => sum + m.added, 0);
      linesRemoved = gitChanges.lineMetrics.reduce((sum, m) => sum + m.deleted, 0);
      linesTotal = linesAdded + linesRemoved;
    }

    const totalChanges =
      newFiles.length +
      removedFiles.length +
      changedConfigs.length +
      (gitChanges?.modified.length || 0);

    return {
      previousSnapshotTime: previous.generatedAt,
      currentSnapshotTime: current.generatedAt,
      isInitial: false,
      newFiles,
      removedFiles,
      changedConfigs,
      languageStatsDiff,
      gitChanges,
      totalChanges,
      linesAdded,
      linesRemoved,
      linesTotal,
    };
  }

  /**
   * 파일 목록 수집 (비교용)
   */
  private async collectFileList(
    rootPath: string,
    config: VibeReportConfig
  ): Promise<string[]> {
    const excludePattern = `{${config.excludePatterns.join(',')}}`;

    const uris = await vscode.workspace.findFiles(
      '**/*',
      excludePattern,
      config.maxFilesToScan
    );

    return uris
      .filter(uri => uri.fsPath.startsWith(rootPath))
      .map(uri => path.relative(rootPath, uri.fsPath).replace(/\\/g, '/'));
  }

  /**
   * 설정 파일 변경 감지
   */
  private detectConfigChanges(
    previous: ProjectSnapshot,
    current: ProjectSnapshot
  ): string[] {
    const changes: string[] = [];

    // package.json 비교
    if (
      JSON.stringify(previous.mainConfigFiles.packageJson) !==
      JSON.stringify(current.mainConfigFiles.packageJson)
    ) {
      changes.push('package.json');
    }

    // tsconfig.json 비교
    if (
      JSON.stringify(previous.mainConfigFiles.tsconfig) !==
      JSON.stringify(current.mainConfigFiles.tsconfig)
    ) {
      changes.push('tsconfig.json');
    }

    // tauri.conf.json 비교
    if (
      JSON.stringify(previous.mainConfigFiles.tauriConfig) !==
      JSON.stringify(current.mainConfigFiles.tauriConfig)
    ) {
      changes.push('tauri.conf.json');
    }

    // Cargo.toml 비교
    if (
      JSON.stringify(previous.mainConfigFiles.cargoToml) !==
      JSON.stringify(current.mainConfigFiles.cargoToml)
    ) {
      changes.push('Cargo.toml');
    }

    return changes;
  }

  /**
   * Git 변경사항 수집
   */
  private async getGitChanges(rootPath: string): Promise<GitChanges | undefined> {
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(rootPath);

      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return undefined;
      }

      const status = await git.status();

      const changes: GitChanges = {
        modified: [],
        added: [],
        deleted: [],
        renamed: [],
      };

      for (const file of status.files) {
        const filePath = file.path;

        switch (file.working_dir) {
          case 'M':
          case ' ':
            if (file.index === 'M') {
              changes.modified.push(filePath);
            } else if (file.index === 'A') {
              changes.added.push(filePath);
            } else if (file.index === 'D') {
              changes.deleted.push(filePath);
            } else if (file.index === 'R') {
              // 이름 변경은 복잡하므로 수정으로 처리
              changes.modified.push(filePath);
            }
            break;
          case '?':
            changes.added.push(filePath);
            break;
          case 'D':
            changes.deleted.push(filePath);
            break;
          default:
            if (file.working_dir === 'M') {
              changes.modified.push(filePath);
            }
        }
      }

      // 중복 제거
      changes.modified = [...new Set(changes.modified)];
      changes.added = [...new Set(changes.added)];
      changes.deleted = [...new Set(changes.deleted)];

      // 라인 메트릭 수집
      try {
        const diffSummary = await git.diffSummary();
        const lineMetrics: GitLineMetric[] = diffSummary.files
          .filter((file): file is typeof file & { insertions: number; deletions: number } =>
            'insertions' in file && 'deletions' in file
          )
          .map((file) => ({
            filePath: file.file,
            added: file.insertions,
            deleted: file.deletions,
            total: file.insertions + file.deletions,
          }));
        changes.lineMetrics = lineMetrics;
        changes.linesChanged = lineMetrics.reduce((sum, m) => sum + m.total, 0);
      } catch (diffError) {
        this.log(`Git diff summary 수집 실패: ${diffError}`);
        // 라인 메트릭은 선택적이므로 실패해도 계속 진행
      }

      return changes;
    } catch (error) {
      this.log(`Git 변경사항 수집 실패: ${error}`);
      return undefined;
    }
  }

  /**
   * 세션 기록 추가
   */
  addSession(
    state: VibeReportState,
    session: SessionRecord
  ): VibeReportState {
    return {
      ...state,
      sessions: [...state.sessions, session],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 적용된 개선 항목 추가
   */
  addAppliedImprovement(
    state: VibeReportState,
    improvement: AppliedImprovement
  ): VibeReportState {
    // 이미 존재하는지 확인
    if (state.appliedImprovements.some(i => i.id === improvement.id)) {
      return state;
    }

    return {
      ...state,
      appliedImprovements: [...state.appliedImprovements, improvement],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 스냅샷 업데이트
   */
  updateSnapshot(
    state: VibeReportState,
    snapshot: ProjectSnapshot
  ): VibeReportState {
    return {
      ...state,
      lastSnapshot: snapshot,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 상태 마이그레이션
   */
  private migrateState(oldState: VibeReportState): VibeReportState {
    // 향후 버전 업그레이드 시 마이그레이션 로직 추가
    return {
      ...oldState,
      version: STATE_VERSION,
      appliedImprovements: oldState.appliedImprovements || [],
    };
  }

  /**
   * 세션 ID 생성
   */
  static generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${random}`;
  }

  /**
   * 메이저 버전 변경 여부 확인
   * 
   * @description 0.X.Y → 0.Z.W 형태에서 X !== Z 인 경우 메이저 변경으로 판단
   * 패치 버전 변경(0.3.26 → 0.3.27)은 false, 마이너 버전 변경(0.3.27 → 0.4.0)은 true
   * 
   * @param oldVersion 이전 버전 문자열
   * @param newVersion 새 버전 문자열
   * @returns 메이저 버전 변경 여부
   */
  static isMajorVersionChange(oldVersion: string | undefined, newVersion: string | undefined): boolean {
    if (!oldVersion || !newVersion) {
      return false;
    }

    // 버전 파싱: 0.X.Y 형식
    const parseVersion = (v: string): { major: number; minor: number; patch: number } | null => {
      const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
      if (!match) return null;
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
      };
    };

    const oldParsed = parseVersion(oldVersion);
    const newParsed = parseVersion(newVersion);

    if (!oldParsed || !newParsed) {
      return false;
    }

    // major가 다르거나 (예: 0.x → 1.x), minor가 다르면 (예: 0.3.x → 0.4.x) 메이저 변경
    return oldParsed.major !== newParsed.major || oldParsed.minor !== newParsed.minor;
  }

  /**
   * Diff를 텍스트 요약으로 변환
   */
  static diffToSummary(diff: SnapshotDiff): string {
    if (diff.isInitial) {
      return '초기 보고서 생성 (이전 스냅샷 없음)';
    }

    const lines: string[] = [];

    lines.push(`### 변경 요약 (${diff.previousSnapshotTime} 이후)`);
    lines.push('');

    if (diff.newFiles.length > 0) {
      lines.push(`**새 파일 (${diff.newFiles.length}개):**`);
      diff.newFiles.slice(0, 10).forEach(f => lines.push(`- ${f}`));
      if (diff.newFiles.length > 10) {
        lines.push(`- ... 외 ${diff.newFiles.length - 10}개`);
      }
      lines.push('');
    }

    if (diff.removedFiles.length > 0) {
      lines.push(`**삭제된 파일 (${diff.removedFiles.length}개):**`);
      diff.removedFiles.slice(0, 10).forEach(f => lines.push(`- ${f}`));
      if (diff.removedFiles.length > 10) {
        lines.push(`- ... 외 ${diff.removedFiles.length - 10}개`);
      }
      lines.push('');
    }

    if (diff.changedConfigs.length > 0) {
      lines.push(`**변경된 설정 파일:** ${diff.changedConfigs.join(', ')}`);
      lines.push('');
    }

    if (Object.keys(diff.languageStatsDiff).length > 0) {
      lines.push('**언어별 파일 수 변화:**');
      for (const [lang, count] of Object.entries(diff.languageStatsDiff)) {
        const sign = count > 0 ? '+' : '';
        lines.push(`- ${lang}: ${sign}${count}`);
      }
      lines.push('');
    }

    if (diff.gitChanges) {
      const gc = diff.gitChanges;
      const total = gc.modified.length + gc.added.length + gc.deleted.length;
      if (total > 0) {
        lines.push(`**Git 변경사항:** 수정 ${gc.modified.length}, 추가 ${gc.added.length}, 삭제 ${gc.deleted.length}`);
        lines.push('');
      }
    }

    // Display aggregate line metrics when available
    if (diff.linesTotal !== undefined && diff.linesTotal > 0) {
      lines.push(`**라인 변경:** +${diff.linesAdded ?? 0} / -${diff.linesRemoved ?? 0} (총 ${diff.linesTotal}줄)`);
      lines.push('');
    }

    if (lines.length === 2) {
      return '변경사항 없음';
    }

    return lines.join('\n');
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[SnapshotService] ${message}`);
  }
}
