import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({}));

import {
  inferAppliedImprovementsFromPrompt,
  mergeAppliedImprovements,
} from '../appliedImprovements.js';

const FIXED_NOW = new Date('2025-01-01T00:00:00.000Z');

function createDeps(promptContent: string | Error) {
  const readFile = vi.fn();
  if (promptContent instanceof Error) {
    readFile.mockRejectedValue(promptContent);
  } else {
    readFile.mockResolvedValue(promptContent);
  }

  return {
    fs: { readFile },
    reportService: {
      getReportPaths: vi.fn(() => ({
        evaluation: '/root/devplan/Project_Evaluation_Report.md',
        improvement: '/root/devplan/Project_Improvement_Exploration_Report.md',
        sessionHistory: '/root/devplan/Session_History.md',
        prompt: '/root/devplan/Prompt.md',
      })),
    },
    now: vi.fn(() => FIXED_NOW),
  } as any;
}

describe('inferAppliedImprovementsFromPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when Prompt.md cannot be read', async () => {
    const deps = createDeps(new Error('ENOENT'));

    const applied = await inferAppliedImprovementsFromPrompt({
      rootPath: '/root',
      config: {} as any,
      deps,
    });

    expect(applied).toEqual([]);
  });

  it('returns empty array when no execution checklist block exists', async () => {
    const deps = createDeps('# No checklist here\n');

    const applied = await inferAppliedImprovementsFromPrompt({
      rootPath: '/root',
      config: {} as any,
      deps,
    });

    expect(applied).toEqual([]);
  });

  it('parses done statuses and ignores non-done/partial statuses', async () => {
    const promptMd = `
# AI Agent Improvement Prompts

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Open bounds \`security-code-reference-001\` | P1 | ✅ Done |
| 2 | PROMPT-002 | Applied inference | P2 | completed |
| 3 | PROMPT-003 | Escape done \`escape-done-001\` | P2 | \\uC644\\uB8CC |
| 4 | PROMPT-004 | Partial should not count \`partial-001\` | P2 | ✅ partial |
| 5 | PROMPT-005 | Escape partial \`partial-002\` | P2 | \\uBD80\\uBD84\\uC644\\uB8CC |
| 6 | PROMPT-006 | In progress \`inprogress-001\` | P2 | 🟡 In Progress |
| 7 | PROMPT-007 | Pending | P3 | ⬜ Pending |
| 8 | PROMPT-008 | Not done | P3 | incomplete |
| 9 | PROMPT-009 | Korean not done escape | P3 | \\uBBF8\\uC644\\uB8CC |

---
`;
    const deps = createDeps(promptMd);

    const applied = await inferAppliedImprovementsFromPrompt({
      rootPath: '/root',
      config: {} as any,
      deps,
    });

    expect(applied).toHaveLength(3);
    expect(applied.map(item => item.id)).toEqual([
      'security-code-reference-001',
      'PROMPT-002',
      'escape-done-001',
    ]);

    for (const item of applied) {
      expect(item.appliedAt).toBe(FIXED_NOW.toISOString());
      expect(item.sessionId).toMatch(/^session_[a-z0-9]+_[a-z0-9]+$/);
    }
  });

  it('dedupes by improvement id and by case-insensitive title', async () => {
    const promptMd = `
# AI Agent Improvement Prompts

## Execution Checklist

| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Same   Title | P1 | ✅ Done |
| 2 | PROMPT-002 | same title | P2 | ✅ done |
| 3 | PROMPT-003 | Different \`dup-id-001\` | P2 | done |
| 4 | PROMPT-004 | Another \`dup-id-001\` | P2 | completed |

---
`;
    const deps = createDeps(promptMd);

    const applied = await inferAppliedImprovementsFromPrompt({
      rootPath: '/root',
      config: {} as any,
      deps,
    });

    expect(applied).toHaveLength(2);
    expect(applied.map(item => item.id)).toEqual(['PROMPT-001', 'dup-id-001']);
  });
});

describe('mergeAppliedImprovements', () => {
  it('returns existing array when inferred is empty', () => {
    const existing = [{ id: 'a', title: 'Hello', appliedAt: 't', sessionId: 's' }];
    const merged = mergeAppliedImprovements(existing, []);
    expect(merged).toBe(existing);
  });

  it('dedupes by id and by case-insensitive title', () => {
    const existing = [
      { id: 'keep', title: 'Hello', appliedAt: 't1', sessionId: 's1' },
      { id: 'same-title', title: 'Title Match', appliedAt: 't2', sessionId: 's2' },
    ];

    const inferred = [
      { id: 'keep', title: 'Different Title', appliedAt: 't3', sessionId: 's3' },
      { id: 'new-id', title: 'title match', appliedAt: 't4', sessionId: 's4' },
      { id: 'added', title: 'Fresh', appliedAt: 't5', sessionId: 's5' },
    ];

    const merged = mergeAppliedImprovements(existing, inferred);

    expect(merged.map(item => item.id)).toEqual(['keep', 'same-title', 'added']);
  });
});

