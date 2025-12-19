import { describe, it, expect } from 'vitest';
import { MARKERS } from '../markdownUtils.js';
import { repairReportMarkdown, validateReportMarkdown } from '../reportDoctorUtils.js';

describe('reportDoctorUtils', () => {
  it('detects missing marker end tags', () => {
    const content = [
      '# 📊 Project Evaluation Report',
      '',
      MARKERS.OVERVIEW_START,
      '| Item | Value |',
      '|------|-------|',
      '| A | B |',
      MARKERS.OVERVIEW_END,
      '',
      '<!-- AUTO-STRUCTURE-START -->',
      '## 📐 Project Structure',
      '<!-- AUTO-STRUCTURE-END -->',
      '',
      MARKERS.SCORE_START,
      '## 📊 Score Summary',
      '| Category | Score | Grade | Change |',
      '|----------|-------|-------|--------|',
      '| **Code Quality** | - | - | - |',
      '',
      '<!-- AUTO-DETAIL-START -->',
      '## 🔍 Detailed Feature Evaluation',
      '<!-- AUTO-DETAIL-END -->',
      '',
      MARKERS.TREND_START,
      '| Version | Date | Total | Major Changes |',
      '|---------|------|-------|---------------|',
      '| - | - | - | - |',
      MARKERS.TREND_END,
    ].join('\n');

    const issues = validateReportMarkdown(content, 'evaluation');
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_END_MARKER',
          sectionId: 'score',
        }),
      ])
    );
  });

  it('detects duplicate markers for single-instance sections', () => {
    const content = [
      '# 🚀 Project Improvement Exploration Report',
      '',
      MARKERS.ERROR_EXPLORATION_START,
      '...content...',
      MARKERS.ERROR_EXPLORATION_END,
      '',
      MARKERS.SUMMARY_START,
      '## 📊 Improvement Status Summary',
      '| Status | Count |',
      '|--------|-------|',
      '| A | 1 |',
      MARKERS.SUMMARY_END,
      '',
      MARKERS.SUMMARY_START,
      '## 📊 Improvement Status Summary (duplicate)',
      '| Status | Count |',
      '|--------|-------|',
      '| B | 2 |',
      MARKERS.SUMMARY_END,
      '',
      MARKERS.IMPROVEMENT_LIST_START,
      '*items*',
      MARKERS.IMPROVEMENT_LIST_END,
      '',
      MARKERS.OPTIMIZATION_START,
      '*opt*',
      MARKERS.OPTIMIZATION_END,
    ].join('\n');

    const issues = validateReportMarkdown(content, 'improvement');
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DUPLICATE_START_MARKER',
          sectionId: 'summary',
        }),
        expect.objectContaining({
          code: 'DUPLICATE_END_MARKER',
          sectionId: 'summary',
        }),
      ])
    );
  });

  it('repairs corrupted marker blocks and produces valid markdown', () => {
    const content = [
      '# 🚀 Project Improvement Exploration Report',
      '',
      MARKERS.ERROR_EXPLORATION_START,
      '...content...',
      MARKERS.ERROR_EXPLORATION_END,
      '',
      MARKERS.SUMMARY_START,
      '## 📊 Improvement Status Summary',
      '| Status | Count |',
      '|--------|-------|',
      '| A | 1 |',
      MARKERS.SUMMARY_END,
      '',
      MARKERS.SUMMARY_START,
      '## 📊 Improvement Status Summary (duplicate)',
      '| Status | Count |',
      '|--------|-------|',
      '| B | 2 |',
      MARKERS.SUMMARY_END,
      '',
      MARKERS.IMPROVEMENT_LIST_START,
      '*items*',
      MARKERS.IMPROVEMENT_LIST_END,
      '',
      MARKERS.OPTIMIZATION_START,
      '*opt*',
      MARKERS.OPTIMIZATION_END,
    ].join('\n');

    const template = [
      '# Template',
      '',
      MARKERS.ERROR_EXPLORATION_START,
      '...template...',
      MARKERS.ERROR_EXPLORATION_END,
      '',
      MARKERS.SUMMARY_START,
      '## 📊 Improvement Status Summary',
      '| Status | Count |',
      '|--------|-------|',
      '| 🔴 Critical (P1) | 0 |',
      '| 🟡 Important (P2) | 0 |',
      '| 🟢 Nice to have (P3) | 0 |',
      '| 🚀 Optimization | 0 |',
      MARKERS.SUMMARY_END,
      '',
      MARKERS.IMPROVEMENT_LIST_START,
      '*template items*',
      MARKERS.IMPROVEMENT_LIST_END,
      '',
      MARKERS.OPTIMIZATION_START,
      '*template opt*',
      MARKERS.OPTIMIZATION_END,
    ].join('\n');

    const repaired = repairReportMarkdown({
      content,
      template,
      type: 'improvement',
    });

    expect(repaired.issuesBefore.length).toBeGreaterThan(0);
    expect(repaired.issuesAfter).toEqual([]);
    expect(repaired.changed).toBe(true);
    expect(repaired.content.split(MARKERS.SUMMARY_START).length - 1).toBe(1);
    expect(repaired.content.split(MARKERS.SUMMARY_END).length - 1).toBe(1);
  });
});

