/**
 * Set Project Vision Command
 *
 * 프로젝트 목표와 비전을 설정하여 개선 추천의 관련성을 높입니다.
 */

import * as vscode from 'vscode';
import type {
  ProjectVision,
  ProjectType,
  QualityFocus,
  ImprovementCategory,
  VibeReportConfig,
} from '../models/types.js';
import { SnapshotService } from '../services/index.js';
import { loadConfig, selectWorkspaceRoot } from '../utils/index.js';

export class SetProjectVisionCommand {
  private snapshotService: SnapshotService;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.snapshotService = new SnapshotService(outputChannel);
  }

  /**
   * 프로젝트 비전 설정 실행
   */
  async execute(): Promise<void> {
    const rootPath = await selectWorkspaceRoot();
    if (!rootPath) {
      this.log('워크스페이스 선택이 취소되었습니다.');
      return;
    }
    const config = loadConfig();

    // 기존 상태 로드
    let state = await this.snapshotService.loadState(rootPath, config);
    if (!state) {
      state = this.snapshotService.createInitialState();
    }

    // 기존 비전 또는 기본값
    const existingVision = state.projectVision;

    try {
      // 1. 프로젝트 유형 선택
      const projectType = await this.selectProjectType(existingVision?.projectType);
      if (!projectType) return;

      // 2. 핵심 목표 입력
      const coreGoals = await this.inputCoreGoals(existingVision?.coreGoals);
      if (!coreGoals) return;

      // 3. 대상 사용자 입력
      const targetUsers = await this.inputTargetUsers(existingVision?.targetUsers);
      if (!targetUsers) return;

      // 4. 품질 우선순위 단계 선택
      const qualityFocus = await this.selectQualityFocus(existingVision?.qualityFocus);
      if (!qualityFocus) return;

      // 5. 집중할 카테고리 선택
      const focusCategories = await this.selectCategories(
        '집중할 개선 카테고리를 선택하세요 (복수 선택)',
        existingVision?.focusCategories
      );
      if (!focusCategories) return;

      // 6. 제외할 카테고리 선택
      const excludeCategories = await this.selectCategories(
        '제외할 카테고리를 선택하세요 (복수 선택, 없으면 빈 상태로 확인)',
        existingVision?.excludeCategories
      );
      if (excludeCategories === undefined) return;

      // 7. 기술 스택 우선순위 입력
      const techStackPriorities = await this.inputTechStack(existingVision?.techStackPriorities);
      if (!techStackPriorities) return;

      // 비전 객체 생성
      const projectVision: ProjectVision = {
        projectType,
        coreGoals,
        targetUsers,
        qualityFocus,
        focusCategories,
        excludeCategories: excludeCategories || [],
        techStackPriorities,
      };

      // 상태 저장
      state.projectVision = projectVision;
      await this.snapshotService.saveState(rootPath, config, state);

      // projectVisionMode를 'custom'으로 변경
      const vsConfig = vscode.workspace.getConfiguration('vibereport');
      const currentMode = vsConfig.get<string>('projectVisionMode', 'auto');
      
      if (currentMode !== 'custom') {
        await vsConfig.update('projectVisionMode', 'custom', vscode.ConfigurationTarget.Workspace);
        this.log('projectVisionMode가 custom으로 변경됨');
      }

      this.log('프로젝트 비전 저장 완료');
      
      const summary = this.formatVisionSummary(projectVision);
      const modeInfo = currentMode !== 'custom' 
        ? '\n\n💡 프로젝트 비전 모드가 "custom"으로 변경되었습니다.'
        : '';
      vscode.window.showInformationMessage(
        `✅ 프로젝트 비전이 설정되었습니다!${modeInfo}\n\n${summary}`,
        '확인'
      );

    } catch (error) {
      this.log(`오류 발생: ${error}`);
      vscode.window.showErrorMessage(`프로젝트 비전 설정 실패: ${error}`);
    }
  }

  /**
   * 프로젝트 유형 선택
   */
  private async selectProjectType(current?: ProjectType): Promise<ProjectType | undefined> {
    const options: Array<{ label: string; description: string; value: ProjectType }> = [
      { label: '$(extensions) VS Code Extension', description: 'VS Code 확장 프로그램', value: 'vscode-extension' },
      { label: '$(browser) Web Frontend', description: 'React, Vue, Angular 등 웹 프론트엔드', value: 'web-frontend' },
      { label: '$(server) Web Backend', description: 'Express, NestJS, FastAPI 등 백엔드', value: 'web-backend' },
      { label: '$(server-process) Full Stack', description: '프론트엔드 + 백엔드', value: 'fullstack' },
      { label: '$(terminal) CLI Tool', description: '커맨드라인 도구', value: 'cli-tool' },
      { label: '$(package) Library', description: '라이브러리 / npm 패키지', value: 'library' },
      { label: '$(desktop-download) Desktop App', description: 'Electron, Tauri 등 데스크톱 앱', value: 'desktop-app' },
      { label: '$(device-mobile) Mobile App', description: 'React Native, Flutter 등', value: 'mobile-app' },
      { label: '$(cloud) API Server', description: 'REST/GraphQL API 서버', value: 'api-server' },
      { label: '$(folder-library) Monorepo', description: '다중 패키지 모노레포', value: 'monorepo' },
      { label: '$(question) Other', description: '기타 유형', value: 'other' },
    ];

    const currentIndex = current ? options.findIndex(o => o.value === current) : -1;
    if (currentIndex >= 0) {
      options[currentIndex].label = `$(check) ${options[currentIndex].label}`;
    }

    const selected = await vscode.window.showQuickPick(options, {
      title: '프로젝트 유형 선택',
      placeHolder: '이 프로젝트의 유형을 선택하세요',
    });

    return selected?.value;
  }

  /**
   * 핵심 목표 입력
   */
  private async inputCoreGoals(current?: string[]): Promise<string[] | undefined> {
    const input = await vscode.window.showInputBox({
      title: '프로젝트 핵심 목표',
      prompt: '핵심 목표를 쉼표(,)로 구분하여 입력하세요 (1-3개 권장)',
      placeHolder: '예: AI 기반 코드 분석, 자동 보고서 생성, 개발 생산성 향상',
      value: current?.join(', ') || '',
      validateInput: (value) => {
        if (!value.trim()) return '최소 1개의 목표를 입력하세요';
        const goals = value.split(',').filter(g => g.trim());
        if (goals.length > 5) return '목표는 5개 이하로 입력하세요';
        return null;
      },
    });

    if (input === undefined) return undefined;
    return input.split(',').map(g => g.trim()).filter(g => g);
  }

  /**
   * 대상 사용자 입력
   */
  private async inputTargetUsers(current?: string): Promise<string | undefined> {
    return await vscode.window.showInputBox({
      title: '대상 사용자',
      prompt: '이 프로젝트의 주 사용자는 누구인가요?',
      placeHolder: '예: AI 페어 프로그래밍을 활용하는 개발자',
      value: current || '',
      validateInput: (value) => {
        if (!value.trim()) return '대상 사용자를 입력하세요';
        return null;
      },
    });
  }

  /**
   * 품질 우선순위 선택
   */
  private async selectQualityFocus(current?: QualityFocus): Promise<QualityFocus | undefined> {
    const options: Array<{ label: string; description: string; value: QualityFocus }> = [
      { 
        label: '$(zap) Prototype', 
        description: '빠른 구현 우선, 품질은 후순위', 
        value: 'prototype' 
      },
      { 
        label: '$(tools) Development', 
        description: '기능 완성도 + 기본 품질 (개발 중)', 
        value: 'development' 
      },
      { 
        label: '$(shield) Stabilization', 
        description: '테스트, 에러 처리, 문서화 집중 (안정화)', 
        value: 'stabilization' 
      },
      { 
        label: '$(verified) Production', 
        description: '보안, 성능, 모니터링 집중 (프로덕션)', 
        value: 'production' 
      },
      { 
        label: '$(wrench) Maintenance', 
        description: '리팩토링, 기술 부채 해소 (유지보수)', 
        value: 'maintenance' 
      },
    ];

    const currentIndex = current ? options.findIndex(o => o.value === current) : -1;
    if (currentIndex >= 0) {
      options[currentIndex].label = `$(check) ${options[currentIndex].label}`;
    }

    const selected = await vscode.window.showQuickPick(options, {
      title: '현재 개발 단계',
      placeHolder: '프로젝트의 현재 단계에 맞는 품질 우선순위를 선택하세요',
    });

    return selected?.value;
  }

  /**
   * 카테고리 선택 (복수)
   */
  private async selectCategories(
    title: string,
    current?: ImprovementCategory[]
  ): Promise<ImprovementCategory[] | undefined> {
    const options: Array<{ label: string; description: string; value: ImprovementCategory; picked?: boolean }> = [
      { label: '🧪 Testing', description: '테스트 추가/개선', value: 'testing' },
      { label: '🔒 Security', description: '보안 취약점 수정', value: 'security' },
      { label: '⚡ Performance', description: '성능 최적화', value: 'performance' },
      { label: '📚 Documentation', description: '문서화 개선', value: 'documentation' },
      { label: '🧹 Code Quality', description: '코드 품질 개선', value: 'code-quality' },
      { label: '🏗️ Architecture', description: '아키텍처 개선', value: 'architecture' },
      { label: '🛡️ Error Handling', description: '에러 처리 강화', value: 'error-handling' },
      { label: '♿ Accessibility', description: '접근성 개선', value: 'accessibility' },
      { label: '🌐 Internationalization', description: '다국어 지원', value: 'internationalization' },
      { label: '🔧 DevOps', description: 'CI/CD, 배포 자동화', value: 'devops' },
      { label: '🎨 UX Improvement', description: 'UX/UI 개선', value: 'ux-improvement' },
      { label: '✨ New Feature', description: '새 기능 추가', value: 'new-feature' },
      { label: '🔄 Refactoring', description: '코드 리팩토링', value: 'refactoring' },
      { label: '📦 Dependency Update', description: '의존성 업데이트', value: 'dependency-update' },
      { label: '📊 Monitoring', description: '로깅/모니터링', value: 'monitoring' },
    ];

    // 기존 선택 표시
    if (current && current.length > 0) {
      options.forEach(opt => {
        if (current.includes(opt.value)) {
          opt.picked = true;
        }
      });
    }

    const selected = await vscode.window.showQuickPick(options, {
      title,
      placeHolder: 'Space로 선택, Enter로 확인',
      canPickMany: true,
    });

    if (selected === undefined) return undefined;
    return selected.map(s => s.value);
  }

  /**
   * 기술 스택 입력
   */
  private async inputTechStack(current?: string[]): Promise<string[] | undefined> {
    const input = await vscode.window.showInputBox({
      title: '기술 스택 우선순위',
      prompt: '중요한 기술 스택을 쉼표로 구분하여 입력하세요 (중요도 순)',
      placeHolder: '예: TypeScript, VS Code API, Vitest',
      value: current?.join(', ') || '',
    });

    if (input === undefined) return undefined;
    return input.split(',').map(t => t.trim()).filter(t => t);
  }

  /**
   * 비전 요약 포맷
   */
  private formatVisionSummary(vision: ProjectVision): string {
    const parts: string[] = [];
    parts.push(`📦 유형: ${vision.projectType}`);
    parts.push(`🎯 목표: ${vision.coreGoals.join(', ')}`);
    parts.push(`📊 단계: ${vision.qualityFocus}`);
    parts.push(`✅ 집중: ${vision.focusCategories.join(', ')}`);
    if (vision.excludeCategories.length > 0) {
      parts.push(`❌ 제외: ${vision.excludeCategories.join(', ')}`);
    }
    return parts.join('\n');
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[SetProjectVision] ${message}`);
  }
}
