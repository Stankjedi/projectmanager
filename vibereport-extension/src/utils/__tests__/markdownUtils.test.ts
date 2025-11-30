import { describe, it, expect } from 'vitest';
import {
  scoreToGrade,
  generateImprovementId,
  extractBetweenMarkers,
  replaceBetweenMarkers,
  formatScoreChange,
  gradeEmoji,
  formatDateTimeKorean,
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
});
