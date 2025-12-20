import { describe, it, expect } from 'vitest';
import { gradeToColor, scoreToGrade } from '../types.js';

describe('types score helpers', () => {
  it('maps scores to grades at boundary values', () => {
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
      [0, 'F'],
    ];

    for (const [score, grade] of cases) {
      expect(scoreToGrade(score)).toBe(grade);
    }
  });

  it('maps grades to color emoji', () => {
    expect(gradeToColor('A+')).toBe('🟢');
    expect(gradeToColor('B')).toBe('🔵');
    expect(gradeToColor('C-')).toBe('🟡');
    expect(gradeToColor('D+')).toBe('🟠');
    expect(gradeToColor('F')).toBe('🔴');
  });
});
