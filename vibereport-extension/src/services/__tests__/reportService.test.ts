/**
 * ReportService Unit Tests
 * 
 * @description Tests for report creation, reading, and marker-based updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  AppliedImprovement,
  ProjectSnapshot,
  VibeReportConfig,
  SessionRecord,
  SnapshotDiff,
} from '../../models/types.js';
import { MARKERS, formatDateTimeKorean } from '../../utils/markdownUtils.js';
import * as markerUtils from '../../utils/markerUtils.js';
import {
  createEvaluationTemplate,
  createImprovementTemplate,
} from '../reportTemplates.js';

// Mock vscode
vi.mock('vscode', () => ({
  Uri: {
    file: vi.fn((p: string) => ({ fsPath: p })),
  },
  workspace: {
    openTextDocument: vi.fn(),
  },
  window: {
    showTextDocument: vi.fn(),
    showErrorMessage: vi.fn(),
  },
}));

// Mock fs/promises
vi.mock('fs/promises');

// Mock OutputChannel
const mockOutputChannel = {
  appendLine: vi.fn(),
  show: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
  hide: vi.fn(),
  name: 'test',
  replace: vi.fn(),
};

// Import after mocking
import { ReportService } from '../reportService.js';

describe('ReportService', () => {
  let service: ReportService;
  const mockRootPath = '/test/workspace';
	  const mockConfig: VibeReportConfig = {
	    reportDirectory: 'devplan',
	    analysisRoot: '',
	    snapshotFile: '.vscode/vibereport-state.json',
	    snapshotStorageMode: 'workspaceFile',
	    enableGitDiff: true,
	    respectGitignore: true,
	    includeSensitiveFiles: false,
	    excludePatternsIncludeDefaults: true,
	    excludePatterns: [],
	    maxFilesToScan: 5000,
	    autoOpenReports: true,
	    enableDirectAi: false,
	    language: 'ko',
    projectVisionMode: 'auto',
    defaultProjectType: 'auto-detect',
    defaultQualityFocus: 'development',
  };

  const mockSnapshot: ProjectSnapshot = {
    projectName: 'test-project',
    generatedAt: new Date().toISOString(),
    rootPath: '/test/workspace',
    filesCount: 10,
    dirsCount: 3,
    languageStats: { ts: 8, json: 2 },
    importantFiles: [],
    structureSummary: [],
    mainConfigFiles: {
      packageJson: {
        name: 'test-project',
        version: '1.0.0',
        dependencies: ['typescript', 'vscode'],
        devDependencies: [],
        scripts: [],
        hasTypeScript: true,
        hasTest: true,
        hasLint: false,
      },
      otherConfigs: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportService(mockOutputChannel as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getReportPaths', () => {
    it('should return correct paths for evaluation and improvement reports', () => {
      const paths = service.getReportPaths(mockRootPath, mockConfig);

      expect(paths.evaluation).toBe(
        path.join(mockRootPath, 'devplan', 'Project_Evaluation_Report.md')
      );
      expect(paths.improvement).toBe(
        path.join(mockRootPath, 'devplan', 'Project_Improvement_Exploration_Report.md')
      );
      expect(paths.sessionHistory).toBe(
        path.join(mockRootPath, 'devplan', 'Session_History.md')
      );
    });

    it('should use custom report directory from config', () => {
      const customConfig = { ...mockConfig, reportDirectory: 'custom-reports' };
      const paths = service.getReportPaths(mockRootPath, customConfig);

      expect(paths.evaluation).toContain('custom-reports');
      expect(paths.improvement).toContain('custom-reports');
    });
  });

  describe('ensureReportDirectory', () => {
    it('should create report directory with recursive option', async () => {
      const mkdirMock = vi.mocked(fs.mkdir);
      mkdirMock.mockResolvedValue(undefined);

      await service.ensureReportDirectory(mockRootPath, mockConfig);

      expect(mkdirMock).toHaveBeenCalledWith(
        path.join(mockRootPath, 'devplan'),
        { recursive: true }
      );
    });

    it('should not throw if directory already exists', async () => {
      const mkdirMock = vi.mocked(fs.mkdir);
      mkdirMock.mockRejectedValue(new Error('EEXIST'));

      await expect(
        service.ensureReportDirectory(mockRootPath, mockConfig)
      ).resolves.not.toThrow();
    });
  });

  describe('createEvaluationTemplate', () => {
    it('should create Korean template with correct markers', () => {
      const template = createEvaluationTemplate({
        snapshot: mockSnapshot,
        language: 'ko',
        mainLanguage: (service as any).getMainLanguage(mockSnapshot),
        framework: (service as any).getFramework(mockSnapshot),
      });

      expect(template).toContain('# 📊 프로젝트 종합 평가 보고서');
      expect(template).toContain(mockSnapshot.projectName);
      expect(template).toContain(MARKERS.OVERVIEW_START);
      expect(template).toContain(MARKERS.OVERVIEW_END);
      expect(template).toContain(MARKERS.SCORE_START);
      expect(template).toContain(MARKERS.SCORE_END);
      // 프로젝트 구조 섹션 추가됨
      expect(template).toContain('<!-- AUTO-STRUCTURE-START -->');
      expect(template).toContain('<!-- AUTO-TREND-START -->');
    });

    it('should create English template when language is en', () => {
      const template = createEvaluationTemplate({
        snapshot: mockSnapshot,
        language: 'en',
        mainLanguage: (service as any).getMainLanguage(mockSnapshot),
        framework: (service as any).getFramework(mockSnapshot),
      });

      expect(template).toContain('# 📊 Project Evaluation Report');
      expect(template).toContain('Project Overview');
      expect(template).toContain('Score Summary');
    });

    it('should include project version from package.json', () => {
      const template = createEvaluationTemplate({
        snapshot: mockSnapshot,
        language: 'ko',
        mainLanguage: (service as any).getMainLanguage(mockSnapshot),
        framework: (service as any).getFramework(mockSnapshot),
      });

      expect(template).toContain('1.0.0');
    });

    it('should handle missing package.json version', () => {
      const snapshotWithoutVersion = {
        ...mockSnapshot,
        mainConfigFiles: {
          otherConfigs: [],
        },
      };
      const template = createEvaluationTemplate({
        snapshot: snapshotWithoutVersion,
        language: 'ko',
        mainLanguage: (service as any).getMainLanguage(snapshotWithoutVersion),
        framework: (service as any).getFramework(snapshotWithoutVersion),
      });

      expect(template).toContain('| **버전** | - |');
    });
  });

  describe('createImprovementTemplate', () => {
    it('should create Korean improvement template with correct markers', () => {
      const template = createImprovementTemplate({
        snapshot: mockSnapshot,
        language: 'ko',
      });

      expect(template).toContain('# 🚀 프로젝트 개선 탐색 보고서');
      expect(template).toContain(mockSnapshot.projectName);
      expect(template).toContain(MARKERS.SUMMARY_START);
      expect(template).toContain(MARKERS.SUMMARY_END);
      expect(template).toContain(MARKERS.IMPROVEMENT_LIST_START);
      expect(template).toContain(MARKERS.IMPROVEMENT_LIST_END);
      // 분석 이력 섹션은 제거됨
    });

    it('should create English template when language is en', () => {
      const template = createImprovementTemplate({
        snapshot: mockSnapshot,
        language: 'en',
      });

      expect(template).toContain('# 🚀 Project Improvement Exploration Report');
      expect(template).toContain('How to Use');
    });
  });

  describe('readEvaluationReport', () => {
    it('should return content when file exists', async () => {
      const mockContent = '# Test Evaluation Report';
      const readFileMock = vi.mocked(fs.readFile);
      readFileMock.mockResolvedValue(mockContent);

      const result = await service.readEvaluationReport(mockRootPath, mockConfig);

      expect(result).toBe(mockContent);
    });

    it('should return null when file does not exist', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      readFileMock.mockRejectedValue(new Error('ENOENT'));

      const result = await service.readEvaluationReport(mockRootPath, mockConfig);

      expect(result).toBeNull();
    });
  });

  describe('readImprovementReport', () => {
    it('should return content when file exists', async () => {
      const mockContent = '# Test Improvement Report';
      const readFileMock = vi.mocked(fs.readFile);
      readFileMock.mockResolvedValue(mockContent);

      const result = await service.readImprovementReport(mockRootPath, mockConfig);

      expect(result).toBe(mockContent);
    });

    it('should return null when file does not exist', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      readFileMock.mockRejectedValue(new Error('ENOENT'));

      const result = await service.readImprovementReport(mockRootPath, mockConfig);

      expect(result).toBeNull();
    });
  });

  describe('reportsExist', () => {
    it('should return true when both reports exist', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockResolvedValue(undefined);

      const result = await service.reportsExist(mockRootPath, mockConfig);

      expect(result).toBe(true);
      expect(accessMock).toHaveBeenCalledTimes(2);
    });

    it('should return false when evaluation report does not exist', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock.mockRejectedValue(new Error('ENOENT'));

      const result = await service.reportsExist(mockRootPath, mockConfig);

      expect(result).toBe(false);
    });

    it('should return false when improvement report does not exist', async () => {
      const accessMock = vi.mocked(fs.access);
      accessMock
        .mockResolvedValueOnce(undefined) // evaluation exists
        .mockRejectedValueOnce(new Error('ENOENT')); // improvement doesn't

      const result = await service.reportsExist(mockRootPath, mockConfig);

      expect(result).toBe(false);
    });
  });

  describe('cleanupAppliedItems', () => {
    it('removes applied items from both improvement report and Prompt.md', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);

      const improvementContent = [
        '# 🚀 프로젝트 개선 탐색 보고서',
        '',
        '### 적용 완료 항목 (테스트용)',
        '',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **ID** | `test-commands-001` |',
        '',
        '이 항목은 제거되어야 합니다.',
        '',
        '## 다음 섹션',
        'keep',
      ].join('\n');

      const promptContent = [
        '# AI Agent Improvement Prompts',
        '',
        '## Execution Checklist',
        '',
        '| # | Prompt ID | Title | Priority | Status |',
        '|:---:|:---|:---|:---:|:---:|',
        '| 1 | PROMPT-001 | My Prompt Title | P1 | ✅ Done |',
        '',
        '**Total: 1 prompts** | **Completed: 0** | **Remaining: 1**',
        '',
        '### [PROMPT-001] My Prompt Title',
        '',
        'Execute this prompt now.',
        '',
        '### [PROMPT-002] Keep Me',
        '',
        'Do not remove.',
      ].join('\n');

      readFileMock.mockImplementation(async (filePath: any) => {
        const file = String(filePath);
        if (file.endsWith('Project_Improvement_Exploration_Report.md')) {
          return improvementContent;
        }
        if (file.endsWith('Prompt.md')) {
          return promptContent;
        }
        throw new Error(`unexpected read: ${file}`);
      });
      writeFileMock.mockResolvedValue(undefined);

      const applied: AppliedImprovement[] = [
        {
          id: 'test-commands-001',
          title: 'My Prompt Title',
          appliedAt: '2025-01-01T00:00:00.000Z',
          sessionId: 'session-001',
        },
      ];

      const result = await service.cleanupAppliedItems(mockRootPath, mockConfig, applied);

      expect(result.improvementRemoved).toBeGreaterThan(0);
      expect(result.promptRemoved).toBeGreaterThan(0);
      expect(writeFileMock).toHaveBeenCalledTimes(2);

      const promptWrite = writeFileMock.mock.calls.find(call => String(call[0]).endsWith('Prompt.md'));
      expect(promptWrite?.[1]).not.toContain('### [PROMPT-001] My Prompt Title');
      expect(promptWrite?.[1]).toContain('### [PROMPT-002] Keep Me');
    });

    it('removes multiple applied IDs and prompt titles in a single pass', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);

      const improvementContent = [
        '# 개선 보고서',
        '',
        '### 🔴 중요 (P1) 첫 항목',
        '',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **ID** | `test-commands-001` |',
        '',
        '내용',
        '',
        '### 🟡 중요 (P2) 두 번째 항목',
        '',
        '| 항목 | 내용 |',
        '|------|------|',
        '| **ID** | `dev-eol-standardize-001` |',
        '',
        '내용',
        '',
        '## 다음 섹션',
        'keep',
      ].join('\n');

      const promptContent = [
        '# AI Agent Improvement Prompts',
        '',
        '## Execution Checklist',
        '',
        '| # | Prompt ID | Title | Priority | Status |',
        '|:---:|:---|:---|:---:|:---:|',
        '| 1 | PROMPT-001 | First Item | P1 | ⬜ Pending |',
        '| 2 | PROMPT-002 | Keep Me | P2 | ⬜ Pending |',
        '| 3 | PROMPT-003 | EOL Standardize | P2 | ⬜ Pending |',
        '',
        '**Total: 3 prompts** | **Completed: 0** | **Remaining: 3**',
        '',
        '### [PROMPT-001] First Item',
        '',
        'Execute this prompt now.',
        '',
        '### [PROMPT-002] Keep Me',
        '',
        'Do not remove.',
        '',
        '### [PROMPT-003] EOL Standardize',
        '',
        'Remove me.',
      ].join('\n');

      readFileMock.mockImplementation(async (filePath: any) => {
        const file = String(filePath);
        if (file.endsWith('Project_Improvement_Exploration_Report.md')) {
          return improvementContent;
        }
        if (file.endsWith('Prompt.md')) {
          return promptContent;
        }
        throw new Error(`unexpected read: ${file}`);
      });
      writeFileMock.mockResolvedValue(undefined);

      const applied: AppliedImprovement[] = [
        {
          id: 'test-commands-001',
          title: 'First Item',
          appliedAt: '2025-01-01T00:00:00.000Z',
          sessionId: 'session-001',
        },
        {
          id: 'dev-eol-standardize-001',
          title: 'EOL Standardize',
          appliedAt: '2025-01-02T00:00:00.000Z',
          sessionId: 'session-002',
        },
      ];

      const result = await service.cleanupAppliedItems(mockRootPath, mockConfig, applied);

      expect(result.improvementRemoved).toBeGreaterThanOrEqual(2);
      expect(result.promptRemoved).toBeGreaterThanOrEqual(2);

      const promptWrite = writeFileMock.mock.calls.find(call =>
        String(call[0]).endsWith('Prompt.md')
      );
      const nextPrompt = String(promptWrite?.[1] ?? '');
      expect(nextPrompt).toContain('### [PROMPT-002] Keep Me');
      expect(nextPrompt).not.toContain('### [PROMPT-001] First Item');
      expect(nextPrompt).not.toContain('### [PROMPT-003] EOL Standardize');
      expect(nextPrompt).toContain('**Total: 1 prompts**');
    });

    it('handles large Prompt.md content and updates checklist summary', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);

      const rows = Array.from({ length: 50 }, (_, index) => {
        const number = String(index + 1).padStart(3, '0');
        return `| ${index + 1} | PROMPT-${number} | Title ${index + 1} | P2 | ⬜ Pending |`;
      });
      const sections = Array.from({ length: 50 }, (_, index) => {
        const number = String(index + 1).padStart(3, '0');
        return [
          `### [PROMPT-${number}] Title ${index + 1}`,
          '',
          'Execute.',
          '',
        ].join('\n');
      }).join('\n');

      const promptContent = [
        '# AI Agent Improvement Prompts',
        '',
        '## Execution Checklist',
        '',
        '| # | Prompt ID | Title | Priority | Status |',
        '|:---:|:---|:---|:---:|:---:|',
        ...rows,
        '',
        '**Total: 50 prompts** | **Completed: 0** | **Remaining: 50**',
        '',
        sections,
      ].join('\n');

      readFileMock.mockImplementation(async (filePath: any) => {
        const file = String(filePath);
        if (file.endsWith('Project_Improvement_Exploration_Report.md')) {
          return '';
        }
        if (file.endsWith('Prompt.md')) {
          return promptContent;
        }
        throw new Error(`unexpected read: ${file}`);
      });
      writeFileMock.mockResolvedValue(undefined);

      const applied: AppliedImprovement[] = [
        {
          id: 'unused-001',
          title: 'Title 10',
          appliedAt: '2025-01-01T00:00:00.000Z',
          sessionId: 'session-001',
        },
        {
          id: 'unused-002',
          title: 'Title 20',
          appliedAt: '2025-01-02T00:00:00.000Z',
          sessionId: 'session-002',
        },
      ];

      await service.cleanupAppliedItems(mockRootPath, mockConfig, applied);

      const promptWrite = writeFileMock.mock.calls.find(call =>
        String(call[0]).endsWith('Prompt.md')
      );
      const nextPrompt = String(promptWrite?.[1] ?? '');
      expect(nextPrompt).not.toContain('### [PROMPT-010] Title 10');
      expect(nextPrompt).not.toContain('### [PROMPT-020] Title 20');
      expect(nextPrompt).toContain('**Total: 48 prompts**');
    });

    it('skips cleanup when there are no applied items', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);

      const result = await service.cleanupAppliedItems(mockRootPath, mockConfig, []);

      expect(result).toEqual({ improvementRemoved: 0, promptRemoved: 0 });
      expect(readFileMock).not.toHaveBeenCalled();
      expect(writeFileMock).not.toHaveBeenCalled();
    });
  });

  describe('updateImprovementReport', () => {
    const mockDiff: SnapshotDiff = {
      isInitial: false,
      newFiles: [],
      removedFiles: [],
      changedConfigs: [],
      gitChanges: undefined,
      totalChanges: 0,
      previousSnapshotTime: new Date().toISOString(),
      currentSnapshotTime: new Date().toISOString(),
      languageStatsDiff: {},
    };

    it('should update summary + list with one batched marker replacement', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockRejectedValue(new Error('ENOENT'));
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      const replaceManySpy = vi.spyOn(markerUtils, 'replaceManyBetweenMarkersLines');

      const aiContent = `### [P2] JSONC parsing support

> 항목 ID: \`aaaaaaaaaaaa\`

Enable JSONC parsing for \`src/utils/jsonc.ts\`:parseJsonc and \`src/utils/reader.ts\`.

| 항목 | 값 |
|------|-----|
| **대상 파일** | src/utils/jsonc.ts, src/utils/reader.ts(신규) |`;

      const todoFixmeFindings = Array.from({ length: 22 }, (_, index) => ({
        file: `src/todo-${index + 1}.ts`,
        line: index + 1,
        tag: 'TODO' as const,
        text: `Fix item ${index + 1}`,
      }));

      await service.updateImprovementReport(
        mockRootPath,
        mockConfig,
        { ...mockSnapshot, todoFixmeFindings },
        mockDiff,
        'user prompt',
        aiContent,
        []
      );

      expect(replaceManySpy).toHaveBeenCalledTimes(1);
      const replacements = replaceManySpy.mock.calls[0]?.[1] ?? [];
      expect(replacements).toHaveLength(2);
      expect(replacements.map(r => r.startMarker)).toContain(MARKERS.SUMMARY_START);
      expect(replacements.map(r => r.startMarker)).toContain(MARKERS.IMPROVEMENT_LIST_START);

      expect(writeFileMock).toHaveBeenCalled();
      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent).toContain(MARKERS.SUMMARY_START);
      expect(writtenContent).toContain('## 📊 개선 현황 요약');
      expect(writtenContent).toContain('| 🟡 중요 (P2) | 1 |');
      expect(writtenContent).toContain(MARKERS.IMPROVEMENT_LIST_START);
      expect(writtenContent).toContain('### 🟡 중요 (P2)');
      expect(writtenContent).toContain('#### [P2] JSONC parsing support');
      expect(writtenContent).toContain('> 항목 ID: `aaaaaaaaaaaa`');
      expect(writtenContent).toContain('[src/utils/jsonc.ts#parseJsonc](command:vibereport.openFunctionInFile?');
      expect(writtenContent).toContain('| **대상 파일** | [src/utils/jsonc.ts](command:vibereport.openFunctionInFile?');
      expect(writtenContent).toContain('## 🧾 TODO/FIXME 발견 요약');
      expect(writtenContent).toContain('| src/todo-1.ts | 1 | TODO | Fix item 1 |');
      expect(writtenContent).toContain('| ... | - | - | 그리고 2개 더... |');
    });

    it('renders a clear empty state when TODO/FIXME findings are empty', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockRejectedValue(new Error('ENOENT'));
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateImprovementReport(
        mockRootPath,
        mockConfig,
        { ...mockSnapshot, todoFixmeFindings: [] },
        mockDiff,
        'user prompt',
        '',
        []
      );

      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent).toContain('## 🧾 TODO/FIXME 발견 요약');
      expect(writtenContent).toContain('*TODO/FIXME 항목이 없습니다.*');
    });
  });

  describe('updateSessionHistoryFile', () => {
    const mockSession: SessionRecord = {
      id: 'session-001',
      timestamp: '2025-01-02T03:04:00.000Z',
      userPrompt: '보고서 업데이트',
      changesSummary: '새 파일 2개 추가',
      diffSummary: {
        newFilesCount: 2,
        removedFilesCount: 0,
        changedConfigsCount: 1,
        totalChanges: 3,
      },
    };

    it('should create new session history file when it does not exist', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockRejectedValue(new Error('ENOENT'));
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        1,
        0
      );

      expect(writeFileMock).toHaveBeenCalled();
      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent).toContain('# 📜 세션 히스토리');
      expect(writtenContent).toContain('session-001');
      expect(writtenContent).toContain('<!-- STATS-START -->');
      expect(writtenContent).toContain('<!-- SESSION-LIST-START -->');
      expect(writtenContent).toContain('| **총 세션 수** | 1 |');
      expect(writtenContent).toContain('| **적용 완료 항목** | 0 |');
    });

    it('should prepend new session to existing history', async () => {
      const existingContent = `# 📜 세션 히스토리

<!-- STATS-START -->
## 📊 세션 통계

| 항목 | 값 |
|------|-----|
| **총 세션 수** | 1 |
| **첫 세션** | 2025-01-01 00:00 |
| **마지막 세션** | 2025-01-01 00:00 |
| **마지막 업데이트** | 2025-01-01 00:00 |
| **적용 완료 항목** | 0 |
<!-- STATS-END -->

---

<!-- SESSION-LIST-START -->
## 🕐 전체 세션 기록

### 📅 이전 세션

| 항목 | 값 |
|------|-----|
| **세션 ID** | \`session-000\` |
| **작업** | 보고서 업데이트 |

---
<!-- SESSION-LIST-END -->`;

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockResolvedValue(existingContent);
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        2,
        0
      );

      expect(writeFileMock).toHaveBeenCalled();
      const writtenContent = writeFileMock.mock.calls[0][1] as string;

      // New session should be at the top
      expect(writtenContent).toContain('session-001');
      expect(writtenContent.indexOf('`session-001`')).toBeLessThan(
        writtenContent.indexOf('`session-000`')
      );
      // Stats should be updated
      expect(writtenContent).toContain('| **총 세션 수** | 2 |');
      expect(writtenContent).toContain('| **적용 완료 항목** | 0 |');
      // First session should be preserved
      expect(writtenContent).toContain('| **첫 세션** | 2025-01-01 00:00 |');
      // Old content should still be there
      expect(writtenContent).toContain('이전 세션');
    });

    it('should update stats correctly', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockRejectedValue(new Error('ENOENT'));
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        5,
        3
      );

      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent).toContain('| **총 세션 수** | 5 |');
      expect(writtenContent).toContain('| **적용 완료 항목** | 3 |');
    });

    it('should migrate legacy session history without markers and keep markdown valid', async () => {
      const legacyContent = `# 📜 세션 히스토리

---

## 📊 세션 통계

| 항목 | 값 |
|------|-----|
| **총 세션 수** | 9 |
| **첫 세션** | 2025-01-01 00:00 |
| **마지막 세션** | 2025-01-01 00:00 |
| **적용 완료 항목** | 12 |

---

## 🕐 전체 세션 기록

### 📅 2025-01-01 00:00

| 항목 | 값 |
|------|-----|
| **세션 ID** | \`session-legacy\` |
| **작업** | 보고서 업데이트 |

---
`;

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockResolvedValue(legacyContent);
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        10,
        13
      );

      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent.split('<!-- STATS-START -->').length - 1).toBe(1);
      expect(writtenContent.split('<!-- STATS-END -->').length - 1).toBe(1);
      expect(writtenContent.split('<!-- SESSION-LIST-START -->').length - 1).toBe(1);
      expect(writtenContent.split('<!-- SESSION-LIST-END -->').length - 1).toBe(1);
      expect(writtenContent).toContain('| **총 세션 수** | 10 |');
      expect(writtenContent).toContain('| **적용 완료 항목** | 13 |');
      // Legacy first-session should be preserved
      expect(writtenContent).toContain('| **첫 세션** | 2025-01-01 00:00 |');
      // New session should be inserted (and legacy session preserved)
      expect(writtenContent).toContain('`session-001`');
      expect(writtenContent).toContain('`session-legacy`');
    });

    it('should be idempotent when re-running with the same session id', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T03:04:00.000Z'));

      const legacyContent = `# 📜 세션 히스토리

## 📊 세션 통계

| 항목 | 값 |
|------|-----|
| **총 세션 수** | 0 |
| **첫 세션** | - |
| **마지막 세션** | - |
| **마지막 업데이트** | - |
| **적용 완료 항목** | 0 |

## 🕐 전체 세션 기록
`;

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockResolvedValueOnce(legacyContent);
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        1,
        0
      );

      const firstWritten = writeFileMock.mock.calls[0][1] as string;
      readFileMock.mockResolvedValueOnce(firstWritten);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        1,
        0
      );

      const secondWritten = writeFileMock.mock.calls[1][1] as string;
      expect(secondWritten).toBe(firstWritten);

      vi.useRealTimers();
    });

    it('should repair partially corrupted marker blocks', async () => {
      const corruptedContent = `# 📜 세션 히스토리

<!-- STATS-START -->
## 📊 세션 통계

| 항목 | 값 |
|------|-----|
| **총 세션 수** | 1 |

---

<!-- SESSION-LIST-START -->
## 🕐 전체 세션 기록
<!-- SESSION-LIST-START -->

### 📅 이전 세션

| 항목 | 값 |
|------|-----|
| **세션 ID** | \`session-000\` |
| **작업** | 보고서 업데이트 |

<!-- SESSION-LIST-END -->`;

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockResolvedValue(corruptedContent);
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        2,
        1
      );

      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent.split('<!-- STATS-START -->').length - 1).toBe(1);
      expect(writtenContent.split('<!-- STATS-END -->').length - 1).toBe(1);
      expect(writtenContent.split('<!-- SESSION-LIST-START -->').length - 1).toBe(1);
      expect(writtenContent.split('<!-- SESSION-LIST-END -->').length - 1).toBe(1);
      expect(writtenContent).toContain('`session-001`');
      expect(writtenContent).toContain('`session-000`');
    });

    it('should insert missing managed blocks when history has no markers/headers', async () => {
      const minimalContent = '# 📜 세션 히스토리\n';

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockResolvedValue(minimalContent);
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        1,
        0
      );

      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent).toContain('<!-- STATS-START -->');
      expect(writtenContent).toContain('## 📊 세션 통계');
      expect(writtenContent).toContain('<!-- SESSION-LIST-START -->');
      expect(writtenContent).toContain('## 🕐 전체 세션 기록');
    });

    it('should add a missing session list header when markers exist but block is malformed', async () => {
      const malformed = `# 📜 세션 히스토리

<!-- STATS-START -->
## 📊 세션 통계

| 항목 | 값 |
|------|-----|
| **총 세션 수** | 1 |
| **첫 세션** | - |
| **마지막 세션** | - |
| **마지막 업데이트** | - |
| **적용 완료 항목** | 0 |
<!-- STATS-END -->

<!-- SESSION-LIST-START -->
*세션 기록이 여기에 추가됩니다.*
<!-- SESSION-LIST-END -->`;

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockResolvedValue(malformed);
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(
        mockRootPath,
        mockConfig,
        mockSession,
        2,
        0
      );

      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent).toContain('## 🕐 전체 세션 기록');
      expect(writtenContent).toContain('`session-001`');
    });

    it('should avoid writing when updateSessionHistoryFile result is unchanged', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T03:04:00.000Z'));

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      // First run: create content and write once.
      readFileMock.mockRejectedValueOnce(new Error('ENOENT'));
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      await service.updateSessionHistoryFile(mockRootPath, mockConfig, mockSession, 1, 0);
      const firstWritten = writeFileMock.mock.calls[0][1] as string;

      // Second run: both reads (file read + write-if-changed read) should return the same content.
      writeFileMock.mockClear();
      readFileMock.mockResolvedValue(firstWritten);

      await service.updateSessionHistoryFile(mockRootPath, mockConfig, mockSession, 1, 0);

      expect(writeFileMock).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('readSessionHistory', () => {
    it('should return content when file exists', async () => {
      const mockContent = '# 📜 세션 히스토리\n\n내용';
      const readFileMock = vi.mocked(fs.readFile);
      readFileMock.mockResolvedValue(mockContent);

      const result = await service.readSessionHistory(mockRootPath, mockConfig);

      expect(result).toBe(mockContent);
    });

    it('should return null when file does not exist', async () => {
      const readFileMock = vi.mocked(fs.readFile);
      readFileMock.mockRejectedValue(new Error('ENOENT'));

      const result = await service.readSessionHistory(mockRootPath, mockConfig);

      expect(result).toBeNull();
    });
  });

  describe('marker-based content updates', () => {
    it('should wrap legacy overview section with markers and preserve first analyzed date', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-03T04:05:06.000Z'));

      const legacyContent = `# 📊 프로젝트 종합 평가 보고서

## 📋 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **프로젝트명** | legacy-project |
| **버전** | 0.0.1 |
| **최초 분석일** | 2025-01-01 00:00 |
| **최근 분석일** | 2025-01-01 00:00 |
| **파일 수** | 1 |
| **디렉토리 수** | 1 |
| **주요 언어** | TS |
| **프레임워크** | - |

---

## 다음 섹션
Legacy content`;

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockResolvedValue(legacyContent);
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      const mockDiff: SnapshotDiff = {
        isInitial: false,
        newFiles: [],
        removedFiles: [],
        changedConfigs: [],
        gitChanges: undefined,
        totalChanges: 0,
        previousSnapshotTime: new Date().toISOString(),
        currentSnapshotTime: new Date().toISOString(),
        languageStatsDiff: {},
      };

      const now = formatDateTimeKorean(new Date());

      await service.updateEvaluationReport(
        mockRootPath,
        mockConfig,
        mockSnapshot,
        mockDiff,
        '테스트 프롬프트',
        'AI 응답 내용'
      );

      const writtenContent = writeFileMock.mock.calls[0][1] as string;
      expect(writtenContent).toContain(MARKERS.OVERVIEW_START);
      expect(writtenContent).toContain(MARKERS.OVERVIEW_END);
      expect(writtenContent).toContain(`| **최초 분석일** | ${now} |`);
      expect(writtenContent).toContain(`| **최근 분석일** | ${now} |`);
      expect(writtenContent).toContain(
        `| **프로젝트명** | ${mockSnapshot.projectName} |`
      );

      vi.useRealTimers();
    });

    it('should keep existing first analyzed date when re-running updates', async () => {
      vi.useFakeTimers();
      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      const legacyContent = `# 📊 프로젝트 종합 평가 보고서

## 📋 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **프로젝트명** | legacy-project |
| **버전** | 0.0.1 |
| **최초 분석일** | 2025-01-01 00:00 |
| **최근 분석일** | 2025-01-01 00:00 |
| **파일 수** | 1 |
| **디렉토리 수** | 1 |
| **주요 언어** | TS |
| **프레임워크** | - |

---

## 다음 섹션
Legacy content`;

      const mockDiff: SnapshotDiff = {
        isInitial: false,
        newFiles: [],
        removedFiles: [],
        changedConfigs: [],
        gitChanges: undefined,
        totalChanges: 0,
        previousSnapshotTime: new Date().toISOString(),
        currentSnapshotTime: new Date().toISOString(),
        languageStatsDiff: {},
      };

      vi.setSystemTime(new Date('2025-02-03T04:05:06.000Z'));
      const firstNow = formatDateTimeKorean(new Date());
      readFileMock.mockResolvedValueOnce(legacyContent);
      await service.updateEvaluationReport(
        mockRootPath,
        mockConfig,
        mockSnapshot,
        mockDiff,
        '테스트 프롬프트',
        'AI 응답 내용'
      );

      const firstWritten = writeFileMock.mock.calls[0][1] as string;

      vi.setSystemTime(new Date('2025-02-04T07:08:09.000Z'));
      readFileMock.mockResolvedValueOnce(firstWritten);
      const now = formatDateTimeKorean(new Date());

      await service.updateEvaluationReport(
        mockRootPath,
        mockConfig,
        mockSnapshot,
        mockDiff,
        '테스트 프롬프트',
        'AI 응답 내용'
      );

      const secondWritten = writeFileMock.mock.calls[1][1] as string;
      expect(secondWritten).toContain(`| **최초 분석일** | ${firstNow} |`);
      expect(secondWritten).toContain(`| **최근 분석일** | ${now} |`);

      vi.useRealTimers();
    });

    it('should correctly replace content between markers', async () => {        
      const templateWithMarkers = `# Report

${MARKERS.SUMMARY_START}
Old summary content
${MARKERS.SUMMARY_END}

Other content`;

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock
        .mockResolvedValueOnce(templateWithMarkers)
        .mockResolvedValueOnce('stale report content');
      writeFileMock.mockResolvedValue(undefined);
      mkdirMock.mockResolvedValue(undefined);

      const mockDiff: SnapshotDiff = {
        isInitial: false,
        newFiles: ['file1.ts', 'file2.ts'],
        removedFiles: [],
        changedConfigs: [],
        gitChanges: undefined,
        totalChanges: 2,
        previousSnapshotTime: new Date().toISOString(),
        currentSnapshotTime: new Date().toISOString(),
        languageStatsDiff: {},
      };

      await service.updateEvaluationReport(
        mockRootPath,
        mockConfig,
        mockSnapshot,
        mockDiff,
        '테스트 프롬프트',
        'AI 응답 내용'
      );

      expect(writeFileMock).toHaveBeenCalled();
    });
  });
});
