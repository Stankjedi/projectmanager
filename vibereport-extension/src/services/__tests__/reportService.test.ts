/**
 * ReportService Unit Tests
 * 
 * @description Tests for report creation, reading, and marker-based updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ProjectSnapshot, VibeReportConfig, SessionRecord, SnapshotDiff } from '../../models/types.js';
import { MARKERS } from '../../utils/markdownUtils.js';

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
    snapshotFile: '.vscode/vibereport-state.json',
    enableGitDiff: true,
    excludePatterns: [],
    maxFilesToScan: 5000,
    autoOpenReports: true,
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
      const template = service.createEvaluationTemplate(mockSnapshot, 'ko');

      expect(template).toContain('# 📊 프로젝트 종합 평가 보고서');
      expect(template).toContain(mockSnapshot.projectName);
      expect(template).toContain(MARKERS.OVERVIEW_START);
      expect(template).toContain(MARKERS.OVERVIEW_END);
      expect(template).toContain(MARKERS.SCORE_START);
      expect(template).toContain(MARKERS.SCORE_END);
      expect(template).toContain(MARKERS.SUMMARY_START);
      expect(template).toContain(MARKERS.SUMMARY_END);
      expect(template).toContain(MARKERS.SESSION_LOG_START);
      expect(template).toContain(MARKERS.SESSION_LOG_END);
    });

    it('should create English template when language is en', () => {
      const template = service.createEvaluationTemplate(mockSnapshot, 'en');

      expect(template).toContain('# 📊 Project Evaluation Report');
      expect(template).toContain('Project Overview');
      expect(template).toContain('Score Summary');
    });

    it('should include project version from package.json', () => {
      const template = service.createEvaluationTemplate(mockSnapshot, 'ko');

      expect(template).toContain('1.0.0');
    });

    it('should handle missing package.json version', () => {
      const snapshotWithoutVersion = {
        ...mockSnapshot,
        mainConfigFiles: {
          otherConfigs: [],
        },
      };
      const template = service.createEvaluationTemplate(snapshotWithoutVersion, 'ko');

      expect(template).toContain('| **버전** | - |');
    });
  });

  describe('createImprovementTemplate', () => {
    it('should create Korean improvement template with correct markers', () => {
      const template = service.createImprovementTemplate(mockSnapshot, 'ko');

      expect(template).toContain('# 🚀 프로젝트 개선 탐색 보고서');
      expect(template).toContain(mockSnapshot.projectName);
      expect(template).toContain(MARKERS.SUMMARY_START);
      expect(template).toContain(MARKERS.SUMMARY_END);
      expect(template).toContain(MARKERS.IMPROVEMENT_LIST_START);
      expect(template).toContain(MARKERS.IMPROVEMENT_LIST_END);
      expect(template).toContain(MARKERS.SESSION_LOG_START);
      expect(template).toContain(MARKERS.SESSION_LOG_END);
    });

    it('should create English template when language is en', () => {
      const template = service.createImprovementTemplate(mockSnapshot, 'en');

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

  describe('updateSessionHistoryFile', () => {
    const mockSession: SessionRecord = {
      id: 'session-001',
      timestamp: new Date().toISOString(),
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
    });

    it('should prepend new session to existing history', async () => {
      const existingContent = `# 📜 세션 히스토리

<!-- STATS-START -->
## 📊 통계 요약

| 항목 | 값 |
|------|-----|
| **총 세션 수** | 1 |
| **적용 완료** | 0 |
| **마지막 업데이트** | 2025-01-01 |
<!-- STATS-END -->

---

<!-- SESSION-LIST-START -->
## 📝 세션 기록

### 📅 이전 세션

이전 내용

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
      // Stats should be updated
      expect(writtenContent).toContain('| **총 세션 수** | 2 |');
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
      expect(writtenContent).toContain('| **적용 완료** | 3 |');
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
    it('should correctly replace content between markers', async () => {
      const templateWithMarkers = `# Report

${MARKERS.SUMMARY_START}
Old summary content
${MARKERS.SUMMARY_END}

Other content`;

      const readFileMock = vi.mocked(fs.readFile);
      const writeFileMock = vi.mocked(fs.writeFile);
      const mkdirMock = vi.mocked(fs.mkdir);

      readFileMock.mockResolvedValue(templateWithMarkers);
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
