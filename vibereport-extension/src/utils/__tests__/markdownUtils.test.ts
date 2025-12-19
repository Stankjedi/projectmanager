import { describe, it, expect } from 'vitest';
import {
  scoreToGrade,
  generateImprovementId,
  extractImprovementIdFromText,
  parseImprovementItems,
  parseScoresFromAIResponse,
  extractBetweenMarkers,
  replaceBetweenMarkers,
  formatScoreChange,
  gradeEmoji,
  formatDateTimeKorean,
  MARKERS,
  createMarkdownTable,
} from '../markdownUtils.js';

describe('markdownUtils', () => {
  describe('scoreToGrade', () => {
    it('should return A+ for score >= 97', () => {
      expect(scoreToGrade(97)).toBe('A+');
      expect(scoreToGrade(100)).toBe('A+');
    });

    it('should return A for score >= 93', () => {
      expect(scoreToGrade(93)).toBe('A');
      expect(scoreToGrade(96)).toBe('A');
    });

    it('should return A- for score >= 90', () => {
      expect(scoreToGrade(90)).toBe('A-');
      expect(scoreToGrade(92)).toBe('A-');
    });

    it('should return B+ for score >= 87', () => {
      expect(scoreToGrade(87)).toBe('B+');
      expect(scoreToGrade(89)).toBe('B+');
    });

    it('should return B for score >= 83', () => {
      expect(scoreToGrade(83)).toBe('B');
      expect(scoreToGrade(86)).toBe('B');
    });

    it('should return F for score < 60', () => {
      expect(scoreToGrade(59)).toBe('F');
      expect(scoreToGrade(0)).toBe('F');
    });

    it('should map boundary scores correctly', () => {
      const cases: Array<[number, string]> = [
        [97, 'A+'],
        [93, 'A'],
        [90, 'A-'],
        [87, 'B+'],
        [83, 'B'],
        [80, 'B-'],
        [77, 'C+'],
        [73, 'C'],
        [70, 'C-'],
        [67, 'D+'],
        [63, 'D'],
        [60, 'D-'],
      ];

      for (const [score, grade] of cases) {
        expect(scoreToGrade(score)).toBe(grade);
      }
    });
  });

  describe('generateImprovementId', () => {
    it('should generate consistent hash for same input', () => {
      const id1 = generateImprovementId('Test Title', 'Test Description');
      const id2 = generateImprovementId('Test Title', 'Test Description');
      expect(id1).toBe(id2);
    });

    it('should generate different hash for different input', () => {
      const id1 = generateImprovementId('Title A', 'Desc A');
      const id2 = generateImprovementId('Title B', 'Desc B');
      expect(id1).not.toBe(id2);
    });

    it('should return 12 character hash', () => {
      const id = generateImprovementId('Test', 'Test');
      expect(id.length).toBe(12);
      expect(id).toMatch(/^[0-9a-f]{12}$/);
    });
  });

  describe('extractImprovementIdFromText', () => {
    it('should extract an explicit ID from a markdown table row', () => {
      const text = '| **ID** | `bug-mark-applied-parse-001` |';
      expect(extractImprovementIdFromText(text)).toBe('bug-mark-applied-parse-001');
    });

    it('should extract an explicit ID from a linked-ID line format', () => {
      const text = 'Linked Improvement ID: `bug-eval-history-grade-001`';
      expect(extractImprovementIdFromText(text)).toBe('bug-eval-history-grade-001');
    });

    it('should pick the only matching backticked token when multiple exist', () => {
      const text = 'Tokens: `not-a-match` `bug-mark-applied-parse-001` `also_not`';
      expect(extractImprovementIdFromText(text)).toBe('bug-mark-applied-parse-001');
    });

    it('should return null when no explicit ID exists', () => {
      const text = 'No usable tokens here: `a1b2c3d4e5f6` and `not-an-id`.';
      expect(extractImprovementIdFromText(text)).toBeNull();
    });
  });

  describe('extractBetweenMarkers', () => {
    it('should extract content between markers', () => {
      const content = '<!-- START -->Hello World<!-- END -->';
      const result = extractBetweenMarkers(content, '<!-- START -->', '<!-- END -->');
      expect(result).toBe('Hello World');
    });

    it('should return null if start marker not found', () => {
      const content = 'No markers here<!-- END -->';
      const result = extractBetweenMarkers(content, '<!-- START -->', '<!-- END -->');
      expect(result).toBeNull();
    });

    it('should return null if end marker not found', () => {
      const content = '<!-- START -->No end marker';
      const result = extractBetweenMarkers(content, '<!-- START -->', '<!-- END -->');
      expect(result).toBeNull();
    });

    it('should return null if markers are in wrong order', () => {
      const content = '<!-- END -->Wrong order<!-- START -->';
      const result = extractBetweenMarkers(content, '<!-- START -->', '<!-- END -->');
      expect(result).toBeNull();
    });

    it('should trim whitespace from extracted content', () => {
      const content = '<!-- START -->   Trimmed   <!-- END -->';
      const result = extractBetweenMarkers(content, '<!-- START -->', '<!-- END -->');
      expect(result).toBe('Trimmed');
    });
  });

  describe('replaceBetweenMarkers', () => {
    it('should replace content between markers', () => {
      const content = '<!-- START -->Old Content<!-- END -->';
      const result = replaceBetweenMarkers(content, '<!-- START -->', '<!-- END -->', 'New Content');
      expect(result).toContain('New Content');
      expect(result).not.toContain('Old Content');
    });

    it('should add markers if they do not exist', () => {
      const content = 'No markers here';
      const result = replaceBetweenMarkers(content, '<!-- START -->', '<!-- END -->', 'New Content');
      expect(result).toContain('<!-- START -->');
      expect(result).toContain('<!-- END -->');
      expect(result).toContain('New Content');
    });
  });

  describe('formatScoreChange', () => {
    it('should format positive change with up arrow', () => {
      expect(formatScoreChange(5)).toBe('⬆️ +5');
      expect(formatScoreChange(10)).toBe('⬆️ +10');
    });

    it('should format negative change with down arrow', () => {
      expect(formatScoreChange(-3)).toBe('⬇️ -3');
      expect(formatScoreChange(-15)).toBe('⬇️ -15');
    });

    it('should return dash for zero', () => {
      expect(formatScoreChange(0)).toBe('-');
    });

    it('should return dash for undefined', () => {
      expect(formatScoreChange(undefined)).toBe('-');
    });
  });

  describe('gradeEmoji', () => {
    it('should return green emoji for A grades', () => {
      expect(gradeEmoji('A+')).toBe('🟢');
      expect(gradeEmoji('A')).toBe('🟢');
      expect(gradeEmoji('A-')).toBe('🟢');
    });

    it('should return blue emoji for B grades', () => {
      expect(gradeEmoji('B+')).toBe('🔵');
      expect(gradeEmoji('B')).toBe('🔵');
      expect(gradeEmoji('B-')).toBe('🔵');
    });

    it('should return yellow emoji for C grades', () => {
      expect(gradeEmoji('C+')).toBe('🟡');
      expect(gradeEmoji('C')).toBe('🟡');
      expect(gradeEmoji('C-')).toBe('🟡');
    });

    it('should return orange emoji for D grades', () => {
      expect(gradeEmoji('D+')).toBe('🟠');
      expect(gradeEmoji('D')).toBe('🟠');
      expect(gradeEmoji('D-')).toBe('🟠');
    });

    it('should return red emoji for F grade', () => {
      expect(gradeEmoji('F')).toBe('🔴');
    });
  });

  describe('formatDateTimeKorean', () => {
    it('should format date correctly', () => {
      const date = new Date(2025, 10, 30, 14, 30); // 2025-11-30 14:30 (로컬)
      const result = formatDateTimeKorean(date);
      expect(result).toBe('2025-11-30 14:30');
    });

    it('should pad single digit months and days', () => {
      const date = new Date(2025, 0, 5, 9, 5); // 2025-01-05 09:05 (로컬)
      const result = formatDateTimeKorean(date);
      expect(result).toBe('2025-01-05 09:05');
    });
  });

  describe('createMarkdownTable', () => {
    it('should create a valid markdown table', () => {
      const headers = ['Name', 'Value'];
      const rows = [
        ['Item 1', '100'],
        ['Item 2', '200'],
      ];
      const result = createMarkdownTable(headers, rows);
      
      expect(result).toContain('| Name | Value |');
      expect(result).toContain('| --- | --- |');
      expect(result).toContain('| Item 1 | 100 |');
      expect(result).toContain('| Item 2 | 200 |');
    });

    it('should handle empty rows', () => {
      const headers = ['Header'];
      const rows: string[][] = [];
      const result = createMarkdownTable(headers, rows);
      
      expect(result).toContain('| Header |');
      expect(result).toContain('| --- |');
    });
  });

  describe('parseImprovementItems', () => {
    it('should parse mixed P1/P2/P3/OPT items (Windows newlines)', () => {
      const content = [
        MARKERS.IMPROVEMENT_LIST_START,
        '## 📝 Improvement Items',
        '',
        '#### [P1-1] Fix security',
        'Add validation and auth hardening.',
        '',
        '---',
        '',
        '#### [P2-1] Add tests',
        '- Increase core coverage',
        '',
        '- [P3] Improve docs',
        'Write clearer README sections.',
        MARKERS.IMPROVEMENT_LIST_END,
        '',
        MARKERS.OPTIMIZATION_START,
        '## 🚀 Optimization',
        '',
        '### 🚀 Faster build (OPT-1)',
        'Enable caching and incremental builds.',
        MARKERS.OPTIMIZATION_END,
        '',
        '#### [P3-999] Outside block (ignored)',
        'This should not be parsed when managed blocks exist.',
      ].join('\r\n');

      const items = parseImprovementItems(content);
      const priorities = items.map(i => i.priority);

      expect(priorities).toEqual(expect.arrayContaining(['P1', 'P2', 'P3', 'OPT']));
      expect(items.some(i => i.title.includes('Outside block'))).toBe(false);
    });

    it('should prefer explicit item IDs and strip ID lines from descriptions', () => {
      const content = [
        MARKERS.IMPROVEMENT_LIST_START,
        '#### [P1] Fix security',
        '   >  항목 ID:   `a1b2c3d4e5f6`   ',
        'Add validation and auth hardening.',
        '',
        '#### [P2] Add tests',
        '> Item ID: `NOT-A-HASH`',
        'Increase core coverage.',
        MARKERS.IMPROVEMENT_LIST_END,
      ].join('\r\n');

      const items = parseImprovementItems(content);
      const p1 = items.find(i => i.priority === 'P1');
      const p2 = items.find(i => i.priority === 'P2');

      expect(p1).toBeDefined();
      expect(p1?.id).toBe('a1b2c3d4e5f6');
      expect(p1?.description).toContain('Add validation and auth hardening.');
      expect(p1?.description).not.toContain('항목 ID');

      expect(p2).toBeDefined();
      expect(p2?.id).toMatch(/^[0-9a-f]{12}$/);
      expect(p2?.description).toContain('Increase core coverage.');
      expect(p2?.description).not.toContain('Item ID');
    });

    it('should ignore outside items when managed blocks are empty', () => {
      const content = [
        MARKERS.IMPROVEMENT_LIST_START,
        MARKERS.IMPROVEMENT_LIST_END,
        '',
        '#### [P1] Outside block (ignored)',
        'This should not be parsed when markers exist.',
      ].join('\n');

      expect(parseImprovementItems(content)).toEqual([]);
    });
  });

  describe('parseScoresFromAIResponse', () => {
    it('should parse scores from JSON code fence (Windows newlines)', () => {
      const json = {
        evaluationScores: {
          codeQuality: { score: 97 },
          architecture: { score: 93 },
          security: { score: 90 },
          performance: { score: 87 },
          testCoverage: { score: 83 },
          errorHandling: { score: 80 },
          documentation: { score: 77 },
          scalability: { score: 73 },
          maintainability: { score: 70 },
          productionReadiness: { score: 60 },
        },
      };

      const content = ['```json', JSON.stringify(json), '```'].join('\r\n');
      const scores = parseScoresFromAIResponse(content);

      expect(scores).not.toBeNull();
      expect(scores?.codeQuality.score).toBe(97);
      expect(scores?.codeQuality.grade).toBe('A+');
      expect(scores?.architecture.grade).toBe('A');
      expect(scores?.security.grade).toBe('A-');
      expect(scores?.performance.grade).toBe('B+');
      expect(scores?.totalAverage.score).toBeTypeOf('number');
    });

    it('should parse scores from embedded JSON without a code fence', () => {
      const json = {
        evaluationScores: {
          codeQuality: { score: 97 },
          security: { score: 90 },
          testCoverage: { score: 83 },
        },
      };

      const content = [
        'Here are the evaluation scores:',
        '',
        JSON.stringify(json, null, 2),
        '',
        'Done.',
      ].join('\r\n');

      const scores = parseScoresFromAIResponse(content);
      expect(scores).not.toBeNull();
      expect(scores?.codeQuality.grade).toBe('A+');
      expect(scores?.security.grade).toBe('A-');
      expect(scores?.testCoverage.grade).toBe('B');
    });

    it('should parse scores from a markdown table', () => {
      const content = [
        '| Category | Score | Grade | Change |',
        '|----------|-------|-------|--------|',
        '| **Code Quality** | 97 | 🟢 A+ | - |',
        '| Security | 90 | A- | - |',
        '| Test Coverage | 83 | B | - |',
      ].join('\n');

      const scores = parseScoresFromAIResponse(content);
      expect(scores).not.toBeNull();
      expect(scores?.codeQuality.score).toBe(97);
      expect(scores?.codeQuality.grade).toBe('A+');
      expect(scores?.security.grade).toBe('A-');
      expect(scores?.testCoverage.grade).toBe('B');
    });

    it('should parse a markdown table with extra whitespace and clamp out-of-range scores', () => {
      const content = [
        '| Category | Score | Grade | Change |',
        '|----------|-------|-------|--------|',
        '|  **Code Quality**  |  97  |  A+  | - |',
        '| Security | 120 | A+ | - |',
        '| Test Coverage | 83 | B | - |',
      ].join('\r\n');

      const scores = parseScoresFromAIResponse(content);
      expect(scores).not.toBeNull();
      expect(scores?.codeQuality.score).toBe(97);
      expect(scores?.security.score).toBe(100);
      expect(scores?.testCoverage.score).toBe(83);
    });
  });
});
