/**
 * Markdown Utilities
 *
 * @description 마크다운 섹션 파싱, 삽입, 수정을 위한 유틸리티 함수들을 제공합니다.
 * 보고서 파일의 마커 기반 섹션 관리, 개선 항목 파싱, 점수 테이블 생성 등의 기능을 포함합니다.
 *
 * @module markdownUtils
 */

export { MARKERS } from './markdownMarkers.js';

export {
  appendBetweenMarkers,
  extractBetweenMarkers,
  prependBetweenMarkers,
  replaceBetweenMarkers,
} from './markdownUtils/markerOps.js';

export {
  createSessionLogEntry,
  formatDateTimeKorean,
  formatRelativeTime,
} from './markdownUtils/time.js';

export {
  extractImprovementIdFromText,
  filterAppliedImprovements,
  formatImprovementAsPrompt,
  generateImprovementId,
  parseImprovementItems,
  type ParsedImprovementItem,
} from './markdownUtils/improvements.js';

export {
  createChecklist,
  createCollapsible,
  createMarkdownTable,
  extractCodeBlocks,
  extractHeaders,
  extractSection,
} from './markdownUtils/markdownBasics.js';

export {
  calculateAverageScore,
  formatScoreChange,
  formatScoreTable,
  gradeEmoji,
  parseScoresFromAIResponse,
  scoreToGrade,
  createDefaultScores,
} from './markdownUtils/scores.js';
