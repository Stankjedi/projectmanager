/**
 * Prompt.md checklist parsing utilities.
 *
 * Supports both:
 * - ## 📋 Execution Checklist
 * - ## Execution Checklist
 */

export const EXECUTION_CHECKLIST_HEADING_REGEX =
  /^##\s*(?:📋\s*)?Execution Checklist\b/;

export const EXECUTION_CHECKLIST_BLOCK_REGEX =
  /##\s*(?:📋\s*)?Execution Checklist[\s\S]*?(?=\n---|\n\n##|\n\*\*Total|$)/;

export function findExecutionChecklistHeadingIndex(lines: string[]): number {
  return lines.findIndex(line => EXECUTION_CHECKLIST_HEADING_REGEX.test(line.trim()));
}

export function extractExecutionChecklistBlock(content: string): string | null {
  const match = content.match(EXECUTION_CHECKLIST_BLOCK_REGEX);
  return match ? match[0] : null;
}

