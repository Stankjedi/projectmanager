import { describe, it, expect } from 'vitest';
import {
  EXECUTION_CHECKLIST_HEADING_REGEX,
  extractExecutionChecklistBlock,
  findExecutionChecklistHeadingIndex,
} from '../promptChecklistUtils.js';

const clipboardEmoji = String.fromCodePoint(0x1f4cb);

describe('promptChecklistUtils', () => {
  it('matches execution checklist header with or without emoji', () => {
    expect(EXECUTION_CHECKLIST_HEADING_REGEX.test('## Execution Checklist')).toBe(true);
    expect(
      EXECUTION_CHECKLIST_HEADING_REGEX.test(`## ${clipboardEmoji} Execution Checklist`)
    ).toBe(true);
  });

  it('finds checklist header index in a list of lines', () => {
    const lines = ['# Title', '## Execution Checklist', '| # | Prompt ID |'];
    expect(findExecutionChecklistHeadingIndex(lines)).toBe(1);
  });

  it('extracts checklist block and stops before divider or next heading', () => {
    const content = [
      '# Title',
      '',
      `## ${clipboardEmoji} Execution Checklist`,
      '',
      '| # | Prompt ID | Title |',
      '|:---:|:---|:---|',
      '| 1 | PROMPT-001 | Sample |',
      '',
      '---',
      '',
      '## Next Section',
    ].join('\n');

    const block = extractExecutionChecklistBlock(content);
    expect(block).toContain('##');
    expect(block).toContain('Execution Checklist');
    expect(block).toContain('| 1 | PROMPT-001 | Sample |');
    expect(block).not.toContain('## Next Section');
  });

  it('returns null when no checklist header is present', () => {
    const content = ['# Title', '', '## Not a Checklist', 'Nothing here.'].join('\n');
    expect(extractExecutionChecklistBlock(content)).toBeNull();
  });
});
