/**
 * Markdown Utilities
 * 마크다운 섹션 파싱, 삽입, 수정 유틸리티
 */

import * as crypto from 'crypto';
import type { ProjectEvaluationScores, EvaluationScore, ScoreGrade, EvaluationCategory } from '../models/types.js';
import { EVALUATION_CATEGORY_LABELS } from '../models/types.js';

// 마커 상수
export const MARKERS = {
  SESSION_LOG_START: '<!-- AUTO-SESSION-LOG-START -->',
  SESSION_LOG_END: '<!-- AUTO-SESSION-LOG-END -->',
  SUMMARY_START: '<!-- AUTO-SUMMARY-START -->',
  SUMMARY_END: '<!-- AUTO-SUMMARY-END -->',
  IMPROVEMENT_LIST_START: '<!-- AUTO-IMPROVEMENT-LIST-START -->',
  IMPROVEMENT_LIST_END: '<!-- AUTO-IMPROVEMENT-LIST-END -->',
  SCORE_START: '<!-- AUTO-SCORE-START -->',
  SCORE_END: '<!-- AUTO-SCORE-END -->',
  OVERVIEW_START: '<!-- AUTO-OVERVIEW-START -->',
  OVERVIEW_END: '<!-- AUTO-OVERVIEW-END -->',
  APPLIED_MARKER: '<!-- APPLIED -->',
} as const;

/**
 * 마커 사이의 내용 추출
 */
export function extractBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string
): string | null {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return null;
  }

  return content.substring(
    startIndex + startMarker.length,
    endIndex
  ).trim();
}

/**
 * 마커 사이의 내용 교체
 */
export function replaceBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    // 마커가 없으면 내용 끝에 마커와 함께 추가
    return content + '\n\n' + startMarker + '\n' + newContent + '\n' + endMarker;
  }

  const before = content.substring(0, startIndex + startMarker.length);
  const after = content.substring(endIndex);

  return before + '\n' + newContent + '\n' + after;
}

/**
 * 마커 사이에 내용 추가 (append)
 */
export function appendBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const existing = extractBetweenMarkers(content, startMarker, endMarker);
  
  if (existing === null) {
    // 마커가 없으면 새로 생성
    return content + '\n\n' + startMarker + '\n' + newContent + '\n' + endMarker;
  }

  const combined = existing + '\n\n' + newContent;
  return replaceBetweenMarkers(content, startMarker, endMarker, combined);
}

/**
 * 마커 사이에 내용 앞에 추가 (prepend)
 */
export function prependBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const existing = extractBetweenMarkers(content, startMarker, endMarker);
  
  if (existing === null) {
    return content + '\n\n' + startMarker + '\n' + newContent + '\n' + endMarker;
  }

  const combined = newContent + '\n\n' + existing;
  return replaceBetweenMarkers(content, startMarker, endMarker, combined);
}

/**
 * 세션 로그 엔트리 생성
 */
export function createSessionLogEntry(
  timestamp: string,
  userPrompt: string,
  changesSummary: string,
  aiContent: string
): string {
  const date = new Date(timestamp);
  const formattedDate = formatDateTimeKorean(date);

  return `### 📋 [${formattedDate}] 세션

**사용자 요약:**
> ${userPrompt}

**변경 사항:**
${changesSummary}

**분석 결과:**
${aiContent}

---`;
}

/**
 * 개선 항목 ID 생성 (내용 기반 해시)
 */
export function generateImprovementId(title: string, description: string): string {
  const content = `${title}:${description}`.toLowerCase().trim();
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return hash.substring(0, 12);
}

/**
 * 개선 항목 마크다운 파싱
 */
export interface ParsedImprovementItem {
  id: string;
  priority: 'P1' | 'P2' | 'P3';
  title: string;
  description: string;
  applied: boolean;
  rawContent: string;
}

/**
 * 개선 항목 목록 파싱
 */
export function parseImprovementItems(content: string): ParsedImprovementItem[] {
  const items: ParsedImprovementItem[] = [];
  
  // 패턴: ### [P1] 제목 또는 - [P1] 제목
  const itemPattern = /(?:###|-)\s*\[?(P[123])\]?\s*([^\n]+)\n([\s\S]*?)(?=(?:###|-)\s*\[?P[123]\]?|$)/gi;
  
  let match;
  while ((match = itemPattern.exec(content)) !== null) {
    const priority = match[1].toUpperCase() as 'P1' | 'P2' | 'P3';
    const title = match[2].trim();
    const description = match[3].trim();
    const rawContent = match[0];
    
    // 적용됨 마커 확인
    const applied = rawContent.includes(MARKERS.APPLIED_MARKER) || 
                   rawContent.includes('✅') ||
                   rawContent.toLowerCase().includes('[완료]') ||
                   rawContent.toLowerCase().includes('[적용됨]');
    
    const id = generateImprovementId(title, description);
    
    items.push({
      id,
      priority,
      title,
      description,
      applied,
      rawContent,
    });
  }

  return items;
}

/**
 * 적용된 항목을 필터링한 개선 보고서 생성
 */
export function filterAppliedImprovements(
  content: string,
  appliedIds: Set<string>
): string {
  const items = parseImprovementItems(content);
  
  // 적용되지 않은 항목만 필터링
  const pendingItems = items.filter(item => !appliedIds.has(item.id) && !item.applied);
  
  if (pendingItems.length === 0) {
    return '모든 개선 항목이 적용되었습니다! 🎉';
  }

  // 우선순위별 그룹화
  const byPriority: Record<string, ParsedImprovementItem[]> = {
    P1: [],
    P2: [],
    P3: [],
  };

  for (const item of pendingItems) {
    byPriority[item.priority].push(item);
  }

  const lines: string[] = [];
  
  for (const priority of ['P1', 'P2', 'P3'] as const) {
    const priorityItems = byPriority[priority];
    if (priorityItems.length > 0) {
      lines.push(`\n## ${getPriorityLabel(priority)} (${priorityItems.length}개)`);
      lines.push('');
      
      for (const item of priorityItems) {
        lines.push(`### [${priority}] ${item.title}`);
        lines.push('');
        lines.push(item.description);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * 개선 항목을 복사-붙여넣기 가능한 프롬프트로 포맷
 */
export function formatImprovementAsPrompt(item: ParsedImprovementItem): string {
  return `## ${item.title}

${item.description}

---
우선순위: ${item.priority}
항목 ID: ${item.id}

위 개선 사항을 현재 프로젝트에 적용해주세요.`;
}

/**
 * 우선순위 라벨
 */
function getPriorityLabel(priority: 'P1' | 'P2' | 'P3'): string {
  switch (priority) {
    case 'P1':
      return '🔴 긴급 (P1)';
    case 'P2':
      return '🟡 중요 (P2)';
    case 'P3':
      return '🟢 개선 (P3)';
  }
}

/**
 * 날짜를 한국어 형식으로 포맷 (YYYY-MM-DD HH:mm)
 * 시스템 로컬 시간을 그대로 사용
 */
export function formatDateTimeKorean(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 상대 시간 표시
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return '방금 전';
  } else if (diffMins < 60) {
    return `${diffMins}분 전`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전`;
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return formatDateTimeKorean(date);
  }
}

/**
 * 마크다운 코드 블록 추출
 */
export function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const pattern = /```(\w*)\n([\s\S]*?)```/g;
  
  let match;
  while ((match = pattern.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  return blocks;
}

/**
 * 마크다운 헤더 레벨 추출
 */
export function extractHeaders(content: string): Array<{ level: number; text: string; line: number }> {
  const headers: Array<{ level: number; text: string; line: number }> = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headers.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return headers;
}

/**
 * 마크다운 섹션 추출 (특정 헤더부터 다음 동일/상위 헤더까지)
 */
export function extractSection(
  content: string,
  headerText: string,
  headerLevel: number
): string | null {
  const lines = content.split('\n');
  const headerPattern = new RegExp(`^#{${headerLevel}}\\s+${escapeRegex(headerText)}\\s*$`);
  
  let startLine = -1;
  let endLine = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i])) {
      startLine = i;
      continue;
    }
    
    if (startLine !== -1) {
      // 동일하거나 상위 레벨의 헤더를 찾으면 종료
      const nextHeaderMatch = lines[i].match(/^(#{1,6})\s+/);
      if (nextHeaderMatch && nextHeaderMatch[1].length <= headerLevel) {
        endLine = i;
        break;
      }
    }
  }

  if (startLine === -1) {
    return null;
  }

  return lines.slice(startLine, endLine).join('\n').trim();
}

/**
 * 정규식 이스케이프
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 마크다운 테이블 생성
 */
export function createMarkdownTable(
  headers: string[],
  rows: string[][]
): string {
  const headerRow = '| ' + headers.join(' | ') + ' |';
  const separator = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const dataRows = rows.map(row => '| ' + row.join(' | ') + ' |');

  return [headerRow, separator, ...dataRows].join('\n');
}

/**
 * 체크리스트 아이템 생성
 */
export function createChecklist(items: Array<{ text: string; checked: boolean }>): string {
  return items
    .map(item => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}

/**
 * 접기(Collapsible) 섹션 생성
 */
export function createCollapsible(summary: string, content: string): string {
  return `<details>
<summary>${summary}</summary>

${content}

</details>`;
}

// ===== 점수 평가 관련 유틸리티 =====

/**
 * 점수를 등급으로 변환
 */
export function scoreToGrade(score: number): ScoreGrade {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

/**
 * 변화량 포맷 (화살표 포함)
 */
export function formatScoreChange(change: number | undefined): string {
  if (change === undefined || change === 0) return '-';
  if (change > 0) return `⬆️ +${change}`;
  return `⬇️ ${change}`;
}

/**
 * 등급에 따른 이모지 반환
 */
export function gradeEmoji(grade: ScoreGrade): string {
  if (grade.startsWith('A')) return '🟢';
  if (grade.startsWith('B')) return '🔵';
  if (grade.startsWith('C')) return '🟡';
  if (grade.startsWith('D')) return '🟠';
  return '🔴';
}

/**
 * 점수 테이블 마크다운 생성
 */
export function formatScoreTable(
  scores: ProjectEvaluationScores,
  language: 'ko' | 'en'
): string {
  const categories: EvaluationCategory[] = [
    'codeQuality',
    'architecture',
    'security',
    'performance',
    'testCoverage',
    'errorHandling',
    'documentation',
    'scalability',
    'maintainability',
    'productionReadiness',
  ];

  const headers = language === 'ko'
    ? ['항목', '점수 (100점 만점)', '등급', '변화']
    : ['Category', 'Score (out of 100)', 'Grade', 'Change'];

  const rows: string[][] = categories.map(cat => {
    const score = scores[cat];
    const label = EVALUATION_CATEGORY_LABELS[cat][language];
    const emoji = gradeEmoji(score.grade);
    return [
      `**${label}**`,
      String(score.score),
      `${emoji} ${score.grade}`,
      formatScoreChange(score.change),
    ];
  });

  // 총점 행 추가
  const total = scores.totalAverage;
  const totalLabel = language === 'ko' ? '**총점 평균**' : '**Total Average**';
  const totalEmoji = gradeEmoji(total.grade);
  rows.push([
    totalLabel,
    `**${total.score}**`,
    `${totalEmoji} **${total.grade}**`,
    formatScoreChange(total.change),
  ]);

  return createMarkdownTable(headers, rows);
}

/**
 * 점수 배열에서 평균 계산
 */
export function calculateAverageScore(scores: EvaluationScore[]): EvaluationScore {
  const validScores = scores.filter(s => s.score >= 0);
  if (validScores.length === 0) {
    return { score: 0, grade: 'F' };
  }

  const avg = Math.round(
    validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length
  );

  // 이전 점수가 있으면 변화량 계산
  const prevScores = validScores.filter(s => s.previousScore !== undefined);
  let change: number | undefined;
  if (prevScores.length > 0) {
    const prevAvg = Math.round(
      prevScores.reduce((sum, s) => sum + (s.previousScore || 0), 0) / prevScores.length
    );
    change = avg - prevAvg;
  }

  return {
    score: avg,
    grade: scoreToGrade(avg),
    change,
  };
}

/**
 * 기본 점수 객체 생성 (초기화용)
 */
export function createDefaultScores(): ProjectEvaluationScores {
  const defaultScore: EvaluationScore = { score: 0, grade: 'F' };
  return {
    codeQuality: { ...defaultScore },
    architecture: { ...defaultScore },
    security: { ...defaultScore },
    performance: { ...defaultScore },
    testCoverage: { ...defaultScore },
    errorHandling: { ...defaultScore },
    documentation: { ...defaultScore },
    scalability: { ...defaultScore },
    maintainability: { ...defaultScore },
    productionReadiness: { ...defaultScore },
    totalAverage: { ...defaultScore },
  };
}

/**
 * AI 응답에서 점수 파싱
 * JSON 블록 또는 테이블 형식 파싱
 */
export function parseScoresFromAIResponse(content: string): ProjectEvaluationScores | null {
  // JSON 블록 파싱 시도
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.evaluationScores) {
        return validateAndNormalizeScores(parsed.evaluationScores);
      }
    } catch {
      // JSON 파싱 실패, 테이블 파싱 시도
    }
  }

  // 마크다운 테이블 파싱 시도
  const tablePattern = /\|\s*\*?\*?(.+?)\*?\*?\s*\|\s*(\d+)\s*\|\s*([A-F][+\-]?)\s*\|/g;
  const scores = createDefaultScores();
  const categoryMap: Record<string, EvaluationCategory> = {
    '코드 품질': 'codeQuality',
    'code quality': 'codeQuality',
    '아키텍처 설계': 'architecture',
    'architecture': 'architecture',
    'architecture design': 'architecture',
    '보안': 'security',
    'security': 'security',
    '성능': 'performance',
    'performance': 'performance',
    '테스트 커버리지': 'testCoverage',
    'test coverage': 'testCoverage',
    '에러 처리': 'errorHandling',
    'error handling': 'errorHandling',
    '문서화': 'documentation',
    'documentation': 'documentation',
    '확장성': 'scalability',
    'scalability': 'scalability',
    '유지보수성': 'maintainability',
    'maintainability': 'maintainability',
    '프로덕션 준비도': 'productionReadiness',
    'production readiness': 'productionReadiness',
  };

  let hasMatch = false;
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    const label = match[1].toLowerCase().trim();
    const score = parseInt(match[2], 10);
    const grade = match[3] as ScoreGrade;

    for (const [key, category] of Object.entries(categoryMap)) {
      if (label.includes(key)) {
        scores[category] = { score, grade };
        hasMatch = true;
        break;
      }
    }
  }

  if (!hasMatch) {
    return null;
  }

  // 총점 계산
  const allScores = [
    scores.codeQuality,
    scores.architecture,
    scores.security,
    scores.performance,
    scores.testCoverage,
    scores.errorHandling,
    scores.documentation,
    scores.scalability,
    scores.maintainability,
    scores.productionReadiness,
  ];
  scores.totalAverage = calculateAverageScore(allScores);

  return scores;
}

/**
 * 점수 유효성 검사 및 정규화
 */
function validateAndNormalizeScores(raw: any): ProjectEvaluationScores {
  const scores = createDefaultScores();
  const categories: EvaluationCategory[] = [
    'codeQuality', 'architecture', 'security', 'performance',
    'testCoverage', 'errorHandling', 'documentation',
    'scalability', 'maintainability', 'productionReadiness',
  ];

  for (const cat of categories) {
    if (raw[cat] && typeof raw[cat].score === 'number') {
      const score = Math.max(0, Math.min(100, raw[cat].score));
      scores[cat] = {
        score,
        grade: raw[cat].grade || scoreToGrade(score),
        previousScore: raw[cat].previousScore,
        change: raw[cat].change,
      };
    }
  }

  // 총점 계산
  const allScores = categories.map(c => scores[c]);
  scores.totalAverage = calculateAverageScore(allScores);

  return scores;
}

