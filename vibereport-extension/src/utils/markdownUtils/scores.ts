import type {
  EvaluationCategory,
  EvaluationScore,
  ProjectEvaluationScores,
  ScoreGrade,
} from '../../models/types.js';
import { EVALUATION_CATEGORY_LABELS } from '../../models/types.js';
import { createMarkdownTable } from './markdownBasics.js';

function normalizeMarkdownText(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * 숫자 점수를 학점 등급으로 변환합니다.
 *
 * @description 100점 만점 기준으로 A+부터 F까지의 등급을 반환합니다.
 * - A+: 97-100, A: 93-96, A-: 90-92
 * - B+: 87-89, B: 83-86, B-: 80-82
 * - C+: 77-79, C: 73-76, C-: 70-72
 * - D+: 67-69, D: 63-66, D-: 60-62
 * - F: 0-59
 *
 * @param score - 0-100 사이의 점수
 * @returns 등급 문자열 (A+, A, A-, B+, ..., F)
 *
 * @example
 * ```typescript
 * scoreToGrade(95); // 'A'
 * scoreToGrade(85); // 'B'
 * scoreToGrade(55); // 'F'
 * ```
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
 * 점수 변화량을 화살표와 함께 포맷합니다.
 *
 * @description 양수면 ⬆️ +N, 음수면 ⬇️ -N, 0이거나 undefined면 '-'를 반환합니다.
 *
 * @param change - 이전 대비 변화량 (양수/음수/undefined)
 * @returns 화살표와 숫자가 포함된 문자열
 *
 * @example
 * ```typescript
 * formatScoreChange(5);  // '⬆️ +5'
 * formatScoreChange(-3); // '⬇️ -3'
 * formatScoreChange(0);  // '-'
 * ```
 */
export function formatScoreChange(change: number | undefined): string {
  if (change === undefined || change === 0) return '-';
  if (change > 0) return `⬆️ +${change}`;
  return `⬇️ ${change}`;
}

/**
 * 등급에 따른 색상 이모지를 반환합니다.
 *
 * @description A등급은 녹색, B등급은 파란색, C등급은 노란색,
 * D등급은 주황색, F등급은 빨간색 원을 반환합니다.
 *
 * @param grade - 학점 등급 (A+, A, A-, B+, ..., F)
 * @returns 색상 원 이모지 (🟢, 🔵, 🟡, 🟠, 🔴)
 *
 * @example
 * ```typescript
 * gradeEmoji('A');  // '🟢'
 * gradeEmoji('B+'); // '🔵'
 * gradeEmoji('F');  // '🔴'
 * ```
 */
export function gradeEmoji(grade: ScoreGrade): string {
  if (grade.startsWith('A')) return '🟢';
  if (grade.startsWith('B')) return '🔵';
  if (grade.startsWith('C')) return '🟡';
  if (grade.startsWith('D')) return '🟠';
  return '🔴';
}

/**
 * 프로젝트 평가 점수를 마크다운 테이블로 포맷합니다.
 *
 * @description 10개 카테고리(코드 품질, 아키텍처, 보안 등)의 점수와
 * 총점 평균을 포함하는 마크다운 테이블을 생성합니다.
 * 언어 설정에 따라 한국어 또는 영어 라벨을 사용합니다.
 *
 * @param scores - 프로젝트 평가 점수 객체
 * @param language - 출력 언어 ('ko' | 'en')
 * @returns 마크다운 테이블 문자열
 *
 * @example
 * ```typescript
 * const table = formatScoreTable(scores, 'ko');
 * // | 항목 | 점수 (100점 만점) | 등급 | 변화 |
 * // | --- | --- | --- | --- |
 * // | **코드 품질** | 85 | 🔵 B | ⬆️ +5 |
 * // ...
 * ```
 */
export function formatScoreTable(scores: ProjectEvaluationScores, language: 'ko' | 'en'): string {
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

  const headers =
    language === 'ko'
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
 * 여러 카테고리 점수의 평균을 계산합니다.
 *
 * @description 유효한 점수(0 이상)들의 평균을 계산하고,
 * 이전 점수가 있으면 변화량도 함께 계산합니다.
 *
 * @param scores - 평가 점수 객체 배열
 * @returns 평균 점수, 등급, 변화량을 포함하는 객체
 *
 * @example
 * ```typescript
 * const avg = calculateAverageScore([
 *   { score: 80, grade: 'B-' },
 *   { score: 90, grade: 'A-' }
 * ]);
 * // avg: { score: 85, grade: 'B', change: undefined }
 * ```
 */
export function calculateAverageScore(scores: EvaluationScore[]): EvaluationScore {
  const validScores = scores.filter(s => s.score >= 0);
  if (validScores.length === 0) {
    return { score: 0, grade: 'F' };
  }

  const avg = Math.round(validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length);

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
 * 모든 카테고리가 0점인 기본 점수 객체를 생성합니다.
 *
 * @description 10개 평가 카테고리와 총점 평균 모두 0점/F등급으로 초기화된
 * ProjectEvaluationScores 객체를 반환합니다. 초기화 또는 파싱 실패 시 사용됩니다.
 *
 * @returns 기본값으로 초기화된 평가 점수 객체
 *
 * @example
 * ```typescript
 * const defaultScores = createDefaultScores();
 * // 모든 카테고리가 { score: 0, grade: 'F' }
 * ```
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function isScoreGrade(value: unknown): value is ScoreGrade {
  if (typeof value !== 'string') return false;
  return /^[A-F][+\-]?$/.test(value.trim().toUpperCase());
}

function tryParseJsonCodeFence(content: string): unknown | null {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].trim().toLowerCase();
    if (!fence.startsWith('```json')) continue;

    const jsonLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '```') {
        const rawJson = jsonLines.join('\n').trim();
        if (!rawJson) return null;
        try {
          return JSON.parse(rawJson) as unknown;
        } catch {
          return null;
        }
      }
      jsonLines.push(lines[j]);
    }

    return null;
  }

  return null;
}

function tryParseLooseJsonObject(content: string): unknown | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      // fall through
    }
  }

  let startIndex = trimmed.indexOf('{');
  while (startIndex !== -1) {
    const candidate = extractBalancedJsonObject(trimmed, startIndex);
    if (candidate) {
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        // try the next '{'
      }
    }

    startIndex = trimmed.indexOf('{', startIndex + 1);
  }

  return null;
}

function extractBalancedJsonObject(content: string, startIndex: number): string | null {
  if (content[startIndex] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth++;
      continue;
    }
    if (char === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;

  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = withoutEdges.split('|').map(c => c.trim());
  return cells.length > 0 ? cells : null;
}

function extractFirstInteger(text: string): number | null {
  const match = text.match(/(-?\d+)/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function extractScoreGrade(text: string): ScoreGrade | null {
  const cleaned = text.replace(/\*\*/g, '').toUpperCase();
  const match = cleaned.match(/([A-F][+\-]?)/);
  if (!match) return null;
  const candidate = match[1].toUpperCase();
  return isScoreGrade(candidate) ? (candidate as ScoreGrade) : null;
}

function normalizeLabel(label: string): string {
  return label.replace(/\*\*/g, '').toLowerCase().trim();
}

const SCORE_CATEGORY_KEYWORDS: Array<{
  keyword: string;
  category: EvaluationCategory;
}> = [
  { keyword: '코드 품질', category: 'codeQuality' },
  { keyword: 'code quality', category: 'codeQuality' },
  { keyword: '아키텍처 설계', category: 'architecture' },
  { keyword: 'architecture', category: 'architecture' },
  { keyword: 'architecture design', category: 'architecture' },
  { keyword: '보안', category: 'security' },
  { keyword: 'security', category: 'security' },
  { keyword: '성능', category: 'performance' },
  { keyword: 'performance', category: 'performance' },
  { keyword: '테스트 커버리지', category: 'testCoverage' },
  { keyword: 'test coverage', category: 'testCoverage' },
  { keyword: '에러 처리', category: 'errorHandling' },
  { keyword: 'error handling', category: 'errorHandling' },
  { keyword: '문서화', category: 'documentation' },
  { keyword: 'documentation', category: 'documentation' },
  { keyword: '확장성', category: 'scalability' },
  { keyword: 'scalability', category: 'scalability' },
  { keyword: '유지보수성', category: 'maintainability' },
  { keyword: 'maintainability', category: 'maintainability' },
  { keyword: '프로덕션 준비도', category: 'productionReadiness' },
  { keyword: 'production readiness', category: 'productionReadiness' },
];

/**
 * AI 응답에서 평가 점수를 파싱합니다.
 *
 * @description AI가 생성한 텍스트에서 점수 정보를 추출합니다.
 * JSON 코드 블록 또는 마크다운 테이블 형식을 지원합니다.
 * 파싱에 실패하면 null을 반환합니다.
 *
 * @param content - AI 응답 텍스트
 * @returns 파싱된 점수 객체 또는 파싱 실패 시 null
 *
 * @example
 * ```typescript
 * // JSON 블록에서 파싱
 * const content = '```json\n{"evaluationScores": {...}}\n```';
 * const scores = parseScoresFromAIResponse(content);
 *
 * // 또는 마크다운 테이블에서 파싱
 * const tableContent = '| 코드 품질 | 85 | B |';
 * const scores = parseScoresFromAIResponse(tableContent);
 * ```
 */
export function parseScoresFromAIResponse(content: string): ProjectEvaluationScores | null {
  const normalized = normalizeMarkdownText(content);

  // JSON fenced code block (```json ... ```)
  const parsedJson = tryParseJsonCodeFence(normalized) ?? tryParseLooseJsonObject(normalized);
  if (parsedJson && isRecord(parsedJson)) {
    const maybeScores = parsedJson['evaluationScores'];
    if (maybeScores !== undefined) {
      const validated = validateAndNormalizeScores(maybeScores);
      if (validated) return validated;
    }
  }

  // Markdown table parsing
  const scores = createDefaultScores();
  let hasMatch = false;

  for (const line of normalized.split('\n')) {
    const row = parseMarkdownTableRow(line);
    if (!row || row.length < 3) continue;

    const label = normalizeLabel(row[0]);
    const scoreValue = extractFirstInteger(row[1]);
    if (scoreValue === null) continue;

    const score = clampScore(scoreValue);
    const gradeValue = extractScoreGrade(row[2]) ?? scoreToGrade(score);

    for (const { keyword, category } of SCORE_CATEGORY_KEYWORDS) {
      if (label.includes(keyword)) {
        scores[category] = { score, grade: gradeValue };
        hasMatch = true;
        break;
      }
    }
  }

  if (!hasMatch) {
    return null;
  }

  const allScores: EvaluationScore[] = [
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

function validateAndNormalizeScores(raw: unknown): ProjectEvaluationScores | null {
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

  if (!isRecord(raw)) {
    return null;
  }

  const scores = createDefaultScores();
  let hasMatch = false;

  for (const cat of categories) {
    const entry = raw[cat];
    if (!isRecord(entry)) continue;

    const rawScore = toFiniteNumber(entry['score']);
    if (rawScore === null) continue;

    const score = clampScore(rawScore);
    const maybeGrade = entry['grade'];
    const grade = isScoreGrade(maybeGrade) ? maybeGrade : scoreToGrade(score);
    const previousScoreValue = toFiniteNumber(entry['previousScore']);
    const previousScore = previousScoreValue === null ? undefined : clampScore(previousScoreValue);
    const change = toFiniteNumber(entry['change']) ?? undefined;

    scores[cat] = {
      score,
      grade,
      previousScore,
      change,
    };
    hasMatch = true;
  }

  if (!hasMatch) {
    return null;
  }

  // 총점 계산
  const allScores = categories.map(c => scores[c]);
  scores.totalAverage = calculateAverageScore(allScores);

  return scores;
}

