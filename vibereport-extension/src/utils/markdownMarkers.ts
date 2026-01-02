/**
 * Markdown marker constants.
 *
 * @description HTML comment markers used to define auto-managed sections inside
 * report markdown files.
 */

export const MARKERS = {
  /** 세션 로그 시작 마커 */
  SESSION_LOG_START: '<!-- AUTO-SESSION-LOG-START -->',
  /** 세션 로그 종료 마커 */
  SESSION_LOG_END: '<!-- AUTO-SESSION-LOG-END -->',
  /** 요약 섹션 시작 마커 */
  SUMMARY_START: '<!-- AUTO-SUMMARY-START -->',
  /** 요약 섹션 종료 마커 */
  SUMMARY_END: '<!-- AUTO-SUMMARY-END -->',
  /** 개선 항목 목록 시작 마커 */
  IMPROVEMENT_LIST_START: '<!-- AUTO-IMPROVEMENT-LIST-START -->',
  /** 개선 항목 목록 종료 마커 */
  IMPROVEMENT_LIST_END: '<!-- AUTO-IMPROVEMENT-LIST-END -->',
  /** 기능 추가 목록 시작 마커 */
  FEATURE_LIST_START: '<!-- AUTO-FEATURE-LIST-START -->',
  /** 기능 추가 목록 종료 마커 */
  FEATURE_LIST_END: '<!-- AUTO-FEATURE-LIST-END -->',
  /** 최적화 항목 시작 마커 */
  OPTIMIZATION_START: '<!-- AUTO-OPTIMIZATION-START -->',
  /** 최적화 항목 종료 마커 */
  OPTIMIZATION_END: '<!-- AUTO-OPTIMIZATION-END -->',
  /** 점수 섹션 시작 마커 */
  SCORE_START: '<!-- AUTO-SCORE-START -->',
  /** 점수 섹션 종료 마커 */
  SCORE_END: '<!-- AUTO-SCORE-END -->',
  /** 프로젝트 개요 시작 마커 */
  OVERVIEW_START: '<!-- AUTO-OVERVIEW-START -->',
  /** 프로젝트 개요 종료 마커 */
  OVERVIEW_END: '<!-- AUTO-OVERVIEW-END -->',
  /** 적용 완료된 항목 표시 마커 */
  APPLIED_MARKER: '<!-- APPLIED -->',
  /** TL;DR 섹션 시작 마커 */
  TLDR_START: '<!-- AUTO-TLDR-START -->',
  /** TL;DR 섹션 종료 마커 */
  TLDR_END: '<!-- AUTO-TLDR-END -->',
  /** 리스크 요약 섹션 시작 마커 */
  RISK_SUMMARY_START: '<!-- AUTO-RISK-SUMMARY-START -->',
  /** 리스크 요약 섹션 종료 마커 */
  RISK_SUMMARY_END: '<!-- AUTO-RISK-SUMMARY-END -->',
  /** 점수-개선항목 매핑 시작 마커 */
  SCORE_MAPPING_START: '<!-- AUTO-SCORE-MAPPING-START -->',
  /** 점수-개선항목 매핑 종료 마커 */
  SCORE_MAPPING_END: '<!-- AUTO-SCORE-MAPPING-END -->',
  /** 평가 트렌드 시작 마커 */
  TREND_START: '<!-- AUTO-TREND-START -->',
  /** 평가 트렌드 종료 마커 */
  TREND_END: '<!-- AUTO-TREND-END -->',
  /** 오류 탐색 절차 시작 마커 */
  ERROR_EXPLORATION_START: '<!-- AUTO-ERROR-EXPLORATION-START -->',
  /** 오류 탐색 절차 종료 마커 */
  ERROR_EXPLORATION_END: '<!-- AUTO-ERROR-EXPLORATION-END -->',
} as const;

