import type { TodoFixmeFinding } from '../../models/types.js';
import { linkifyCodeReferences } from '../reportLinkify.js';

export function formatImprovementList(
  items: Array<{
    id: string;
    priority: 'P1' | 'P2' | 'P3' | 'OPT';
    title: string;
    description: string;
  }>,
  language: 'ko' | 'en',
  rootPath: string
): string {
  if (items.length === 0) {
    return language === 'ko'
      ? '모든 개선 항목이 적용되었습니다! 🎉\n\n다음 분석에서 새로운 개선점이 발견될 수 있습니다.'
      : 'All improvements have been applied! 🎉\n\nNew improvements may be found in the next analysis.';
  }

  const lines: string[] = [];

  // 우선순위별 그룹
  const byPriority: Record<string, typeof items> = { P1: [], P2: [], P3: [], OPT: [] };
  items.forEach(item => {
    if (byPriority[item.priority]) {
      byPriority[item.priority].push(item);
    }
  });

  const priorityLabels = {
    ko: { P1: '🔴 긴급 (P1)', P2: '🟡 중요 (P2)', P3: '🟢 개선 (P3)', OPT: '🚀 최적화 (OPT)' },
    en: {
      P1: '🔴 Critical (P1)',
      P2: '🟡 Important (P2)',
      P3: '🟢 Nice to have (P3)',
      OPT: '🚀 Optimization (OPT)',
    },
  };

  for (const priority of ['P1', 'P2', 'P3', 'OPT'] as const) {
    const priorityItems = byPriority[priority];
    if (priorityItems && priorityItems.length > 0) {
      lines.push(`\n### ${priorityLabels[language][priority]}`);
      lines.push('');

      for (const item of priorityItems) {
        lines.push(`#### [${priority}] ${item.title}`);
        lines.push('');
        lines.push(`> 항목 ID: \`${item.id}\``);
        lines.push('');
        lines.push(linkifyCodeReferences(rootPath, item.description));
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

export function formatImprovementSummary(
  pendingItems: Array<{ priority: 'P1' | 'P2' | 'P3' | 'OPT' }>,
  _appliedCount: number,
  language: 'ko' | 'en'
): string {
  const counts: Record<string, number> = { P1: 0, P2: 0, P3: 0, OPT: 0 };
  pendingItems.forEach(item => {
    if (counts[item.priority] !== undefined) {
      counts[item.priority]++;
    }
  });

  const total = counts.P1 + counts.P2 + counts.P3 + counts.OPT;

  if (language === 'ko') {
    return `## 📊 개선 현황 요약

| 우선순위 | 미적용 개수 |
|----------|------------|
| 🔴 긴급 (P1) | ${counts.P1} |
| 🟡 중요 (P2) | ${counts.P2} |
| 🟢 개선 (P3) | ${counts.P3} |
| 🚀 최적화 (OPT) | ${counts.OPT} |
| **총 미적용** | **${total}** |`;
  }

  return `## 📊 Improvement Status Summary

| Priority | Pending Count |
|----------|---------------|
| 🔴 Critical (P1) | ${counts.P1} |
| 🟡 Important (P2) | ${counts.P2} |
| 🟢 Nice to have (P3) | ${counts.P3} |
| 🚀 Optimization (OPT) | ${counts.OPT} |
| **Total Pending** | **${total}** |`;
}

export function formatTodoFixmeFindingsSection(findings: TodoFixmeFinding[], language: 'ko' | 'en'): string {
  const escapeTableCell = (value: string): string => {
    return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
  };

  const maxRows = 20;
  const shown = findings.slice(0, maxRows);
  const remaining = findings.length - shown.length;

  if (language === 'ko') {
    if (findings.length === 0) {
      return `## 🧾 TODO/FIXME 발견 요약

*TODO/FIXME 항목이 없습니다.*`;
    }

    const lines = [
      '## 🧾 TODO/FIXME 발견 요약',
      '',
      '| 파일 | 라인 | 태그 | 내용 |',
      '|------|------|------|------|',
      ...shown.map((finding) => {
        return `| ${escapeTableCell(finding.file)} | ${finding.line} | ${finding.tag} | ${escapeTableCell(finding.text)} |`;
      }),
    ];

    if (remaining > 0) {
      lines.push(`| ... | - | - | 그리고 ${remaining}개 더... |`);
    }

    return lines.join('\n');
  }

  if (findings.length === 0) {
    return `## 🧾 TODO/FIXME Findings Summary

*No TODO/FIXME findings.*`;
  }

  const lines = [
    '## 🧾 TODO/FIXME Findings Summary',
    '',
    '| File | Line | Tag | Text |',
    '|------|------|-----|------|',
    ...shown.map((finding) => {
      return `| ${escapeTableCell(finding.file)} | ${finding.line} | ${finding.tag} | ${escapeTableCell(finding.text)} |`;
    }),
  ];

  if (remaining > 0) {
    lines.push(`| ... | - | - | and ${remaining} more... |`);
  }

  return lines.join('\n');
}

