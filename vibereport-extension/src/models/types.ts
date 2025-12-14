/**
 * Vibe Coding Report - Type Definitions
 * 프로젝트 스냅샷, 보고서, AI 응답 관련 타입 정의
 */

// ===== Project Vision & Goals =====

/**
 * 프로젝트 목표 및 비전 정의
 * 개선 추천 시 이 정보를 기반으로 관련성 있는 항목만 제안
 */
export interface ProjectVision {
  /** 프로젝트 핵심 목표 (1-3개) */
  coreGoals: string[];
  /** 대상 사용자 */
  targetUsers: string;
  /** 프로젝트 유형 */
  projectType: ProjectType;
  /** 기술 스택 우선순위 (중요한 순서대로) */
  techStackPriorities: string[];
  /** 품질 우선순위 (개발 초기/중기/완성 단계) */
  qualityFocus: QualityFocus;
  /** 제외할 개선 카테고리 (관심 없는 영역) */
  excludeCategories: ImprovementCategory[];
  /** 집중할 개선 카테고리 */
  focusCategories: ImprovementCategory[];
  /** 커스텀 제약사항 */
  constraints?: string[];
}

/**
 * 프로젝트 유형
 */
export type ProjectType =
  | 'vscode-extension'    // VS Code 확장
  | 'web-frontend'        // 웹 프론트엔드
  | 'web-backend'         // 웹 백엔드
  | 'fullstack'           // 풀스택
  | 'cli-tool'            // CLI 도구
  | 'library'             // 라이브러리/패키지
  | 'desktop-app'         // 데스크톱 앱
  | 'mobile-app'          // 모바일 앱
  | 'api-server'          // API 서버
  | 'monorepo'            // 모노레포
  | 'other';              // 기타

/**
 * 품질 우선순위 단계
 */
export type QualityFocus =
  | 'prototype'           // 프로토타입: 빠른 구현 우선, 품질 후순위
  | 'development'         // 개발 중: 기능 완성도 + 기본 품질
  | 'stabilization'       // 안정화: 테스트, 에러 처리, 문서화 집중
  | 'production'          // 프로덕션: 보안, 성능, 모니터링 집중
  | 'maintenance';        // 유지보수: 리팩토링, 기술 부채 해소

/**
 * 개선 카테고리
 */
export type ImprovementCategory =
  | 'testing'             // 🧪 테스트
  | 'security'            // 🔒 보안
  | 'performance'         // ⚡ 성능
  | 'documentation'       // 📚 문서화
  | 'code-quality'        // 🧹 코드 품질
  | 'architecture'        // 🏗️ 아키텍처
  | 'error-handling'      // 🛡️ 에러 처리
  | 'accessibility'       // ♿ 접근성
  | 'internationalization'// 🌐 국제화
  | 'devops'              // 🔧 DevOps/CI/CD
  | 'ux-improvement'      // 🎨 UX 개선
  | 'new-feature'         // ✨ 새 기능
  | 'refactoring'         // 🔄 리팩토링
  | 'dependency-update'   // 📦 의존성 업데이트
  | 'monitoring'          // 📊 모니터링/로깅
  | 'code-optimization'   // 🚀 코드 최적화 (성능 향상 코드 개선)
  | 'performance-tuning'; // ⚙️ 성능 튜닝 (런타임 최적화)

// ===== Project Snapshot Types =====

/**
 * 프로젝트 스냅샷 - 워크스페이스 상태 캡처
 */
export interface ProjectSnapshot {
  /** 스냅샷 생성 시간 (ISO 8601) */
  generatedAt: string;
  /** 워크스페이스 루트 경로 */
  rootPath: string;
  /** 프로젝트 이름 */
  projectName: string;
  /** 총 파일 수 */
  filesCount: number;
  /** 총 디렉토리 수 */
  dirsCount: number;
  /** 언어별 파일 수 통계 */
  languageStats: Record<string, number>;
  /** 주요 설정 파일 내용 */
  mainConfigFiles: MainConfigFiles;
  /** 중요 파일 목록 (엔트리 포인트 등) */
  importantFiles: string[];
  /** 전체 파일 목록 (스냅샷 비교용) */
  fileList?: string[];
  /** 프로젝트 구조 요약 (디렉토리 트리) */
  structureSummary: DirectoryNode[];
  /** 기능 기반 프로젝트 구조 다이어그램 (마크다운) */
  structureDiagram?: string;
  /** Git 정보 (optional) */
  gitInfo?: GitInfo;
}

/**
 * 주요 설정 파일들
 */
export interface MainConfigFiles {
  packageJson?: PackageJsonSummary;
  tsconfig?: TsConfigSummary;
  tauriConfig?: TauriConfigSummary;
  cargoToml?: CargoTomlSummary;
  dockerCompose?: boolean;
  otherConfigs: string[];
}

/**
 * package.json 요약 정보
 */
export interface PackageJsonSummary {
  name: string;
  version: string;
  description?: string;
  scripts: string[];
  dependencies: string[];
  devDependencies: string[];
  hasTypeScript: boolean;
  hasTest: boolean;
  hasLint: boolean;
}

/**
 * tsconfig.json 요약
 */
export interface TsConfigSummary {
  target?: string;
  module?: string;
  strict?: boolean;
  outDir?: string;
}

/**
 * tauri.conf.json 요약
 */
export interface TauriConfigSummary {
  productName?: string;
  version?: string;
  identifier?: string;
}

/**
 * Cargo.toml 요약
 */
export interface CargoTomlSummary {
  name: string;
  version: string;
  dependencies: string[];
}

/**
 * Git 저장소 정보
 */
export interface GitInfo {
  branch: string;
  lastCommitHash?: string;
  lastCommitMessage?: string;
  lastCommitDate?: string;
  hasUncommittedChanges: boolean;
  uncommittedFilesCount: number;
}

/**
 * 디렉토리 트리 노드
 */
export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  extension?: string;
  size?: number;
}

// ===== Snapshot Diff Types =====

/**
 * 스냅샷 간 차이점
 */
export interface SnapshotDiff {
  /** 비교 기준 시간 */
  previousSnapshotTime: string | null;
  /** 현재 스냅샷 시간 */
  currentSnapshotTime: string;
  /** 초기 생성 여부 */
  isInitial: boolean;
  /** 새로 추가된 파일 */
  newFiles: string[];
  /** 삭제된 파일 */
  removedFiles: string[];
  /** 변경된 설정 파일 */
  changedConfigs: string[];
  /** 언어별 파일 수 변화 */
  languageStatsDiff: Record<string, number>;
  /** Git 변경사항 (enableGitDiff 시) */
  gitChanges?: GitChanges;
  /** 총 변경 파일 수 */
  totalChanges: number;
  /** 파일 수 변화량 */
  filesCountDiff?: number;
  /** 디렉토리 수 변화량 */
  dirsCountDiff?: number;
  /** 총 추가된 라인 수 (Git diff 기준) */
  linesAdded?: number;
  /** 총 삭제된 라인 수 (Git diff 기준) */
  linesRemoved?: number;
  /** 총 변경 라인 수 (linesAdded + linesRemoved) */
  linesTotal?: number;
}

/**
 * Git 기반 변경사항
 */
export interface GitChanges {
  /** 수정된 파일 */
  modified: string[];
  /** 새 파일 */
  added: string[];
  /** 삭제된 파일 */
  deleted: string[];
  /** 이름 변경된 파일 */
  renamed: Array<{ from: string; to: string }>;
  /** 총 변경 줄 수 (대략적) */
  linesChanged?: number;
  /** 파일별 라인 메트릭 */
  lineMetrics?: GitLineMetric[];
}

/**
 * Git 파일별 라인 변경 메트릭
 * 
 * @description 파일별로 추가/삭제된 라인 수를 추적하여
 * 변경 규모를 수치로 파악할 수 있게 합니다.
 */
export interface GitLineMetric {
  /** 파일 경로 */
  filePath: string;
  /** 추가된 라인 수 */
  added: number;
  /** 삭제된 라인 수 */
  deleted: number;
  /** 총 변경 라인 수 (added + deleted) */
  total: number;
}

// ===== Report Types =====

/**
 * 보고서 업데이트 요청
 */
export interface ReportUpdateRequest {
  /** 사용자 입력 프롬프트 */
  userPrompt: string;
  /** 현재 프로젝트 스냅샷 */
  snapshot: ProjectSnapshot;
  /** 스냅샷 차이 */
  diff: SnapshotDiff;
  /** 기존 평가 보고서 요약 */
  existingEvaluationSummary?: string;
  /** 기존 개선 보고서 요약 */
  existingImprovementSummary?: string;
  /** 이전에 적용된 개선 항목 목록 */
  appliedImprovements?: AppliedImprovement[];
}

/**
 * 이미 적용된 개선 항목
 */
export interface AppliedImprovement {
  /** 개선 항목 ID (해시) */
  id: string;
  /** 개선 항목 제목 */
  title: string;
  /** 적용 날짜 */
  appliedAt: string;
  /** 적용 세션 */
  sessionId: string;
}

/**
 * AI 응답 구조
 */
export interface AIReportResponse {
  /** 평가 보고서 업데이트 내용 */
  evaluationUpdate: string;
  /** 개선 보고서 업데이트 내용 */
  improvementUpdate: string;
  /** 요약 (optional) */
  summary?: string;
  /** 메타데이터 */
  metadata?: AIResponseMetadata;
}

/**
 * AI 응답 메타데이터
 */
export interface AIResponseMetadata {
  /** 분석된 리스크 항목 수 */
  risksIdentified: number;
  /** 제안된 개선 항목 수 */
  improvementsProposed: number;
  /** 전체 품질 점수 (0-100) */
  overallScore?: number;
  /** 우선순위 개선 항목 */
  priorityItems?: string[];
  /** 상세 평가 점수 */
  evaluationScores?: ProjectEvaluationScores;
}

// ===== 점수 평가 시스템 =====

/**
 * 프로젝트 종합 평가 점수
 */
export interface ProjectEvaluationScores {
  /** 코드 품질 (0-100) */
  codeQuality: EvaluationScore;
  /** 아키텍처 설계 (0-100) */
  architecture: EvaluationScore;
  /** 보안 (0-100) */
  security: EvaluationScore;
  /** 성능 (0-100) */
  performance: EvaluationScore;
  /** 테스트 커버리지 (0-100) */
  testCoverage: EvaluationScore;
  /** 에러 처리 (0-100) */
  errorHandling: EvaluationScore;
  /** 문서화 (0-100) */
  documentation: EvaluationScore;
  /** 확장성 (0-100) */
  scalability: EvaluationScore;
  /** 유지보수성 (0-100) */
  maintainability: EvaluationScore;
  /** 프로덕션 준비도 (0-100) */
  productionReadiness: EvaluationScore;
  /** 총점 평균 */
  totalAverage: EvaluationScore;
}

/**
 * 개별 평가 점수
 */
export interface EvaluationScore {
  /** 점수 (0-100) */
  score: number;
  /** 등급 */
  grade: ScoreGrade;
  /** 이전 점수 (변화 추적용) */
  previousScore?: number;
  /** 변화량 */
  change?: number;
}

/**
 * 점수 등급
 */
export type ScoreGrade =
  | 'A+' | 'A' | 'A-'
  | 'B+' | 'B' | 'B-'
  | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-'
  | 'F';

/**
 * 점수-등급 매핑 기준
 * 점수 범위에 따른 등급 및 색상 정의
 */
export const SCORE_GRADE_CRITERIA = {
  'A+': { min: 97, max: 100, color: '🟢', label: '최우수' },
  'A': { min: 93, max: 96, color: '🟢', label: '우수' },
  'A-': { min: 90, max: 92, color: '🟢', label: '우수' },
  'B+': { min: 87, max: 89, color: '🔵', label: '양호' },
  'B': { min: 83, max: 86, color: '🔵', label: '양호' },
  'B-': { min: 80, max: 82, color: '🔵', label: '양호' },
  'C+': { min: 77, max: 79, color: '🟡', label: '보통' },
  'C': { min: 73, max: 76, color: '🟡', label: '보통' },
  'C-': { min: 70, max: 72, color: '🟡', label: '보통' },
  'D+': { min: 67, max: 69, color: '🟠', label: '미흡' },
  'D': { min: 63, max: 66, color: '🟠', label: '미흡' },
  'D-': { min: 60, max: 62, color: '🟠', label: '미흡' },
  'F': { min: 0, max: 59, color: '🔴', label: '부족' },
} as const;

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
 * 등급에 해당하는 색상 이모지 반환
 */
export function gradeToColor(grade: ScoreGrade): string {
  return SCORE_GRADE_CRITERIA[grade].color;
}

/**
 * 평가 카테고리 키
 */
export type EvaluationCategory = keyof Omit<ProjectEvaluationScores, 'totalAverage'>;

/**
 * 평가 카테고리 라벨 (한/영)
 */
export const EVALUATION_CATEGORY_LABELS: Record<EvaluationCategory, { ko: string; en: string }> = {
  codeQuality: { ko: '코드 품질', en: 'Code Quality' },
  architecture: { ko: '아키텍처 설계', en: 'Architecture Design' },
  security: { ko: '보안', en: 'Security' },
  performance: { ko: '성능', en: 'Performance' },
  testCoverage: { ko: '테스트 커버리지', en: 'Test Coverage' },
  errorHandling: { ko: '에러 처리', en: 'Error Handling' },
  documentation: { ko: '문서화', en: 'Documentation' },
  scalability: { ko: '확장성', en: 'Scalability' },
  maintainability: { ko: '유지보수성', en: 'Maintainability' },
  productionReadiness: { ko: '프로덕션 준비도', en: 'Production Readiness' },
};

// ===== Session Types =====

/**
 * 세션 기록
 */
export interface SessionRecord {
  /** 세션 ID */
  id: string;
  /** 세션 시작 시간 */
  timestamp: string;
  /** 사용자 입력 프롬프트 */
  userPrompt: string;
  /** 변경 요약 */
  changesSummary: string;
  /** 스냅샷 diff 요약 */
  diffSummary: SnapshotDiffSummary;
  /** AI 응답 메타데이터 */
  aiMetadata?: AIResponseMetadata;
  /** 이 세션에서 마킹된 적용 완료 항목 */
  appliedImprovementIds?: string[];
}

/**
 * 스냅샷 diff 요약 (저장용)
 */
export interface SnapshotDiffSummary {
  newFilesCount: number;
  removedFilesCount: number;
  changedConfigsCount: number;
  totalChanges: number;
  /** 총 추가된 라인 수 (Git diff 기준) */
  linesAdded?: number;
  /** 총 삭제된 라인 수 (Git diff 기준) */
  linesRemoved?: number;
  /** 총 변경 라인 수 (linesAdded + linesRemoved) */
  linesTotal?: number;
}

// ===== State Types =====

/**
 * 확장 상태 (저장용)
 */
export interface VibeReportState {
  /** 마지막 스냅샷 */
  lastSnapshot: ProjectSnapshot | null;
  /** 세션 히스토리 */
  sessions: SessionRecord[];
  /** 적용된 개선 항목 목록 */
  appliedImprovements: AppliedImprovement[];
  /** 마지막 업데이트 시간 */
  lastUpdated: string;
  /** 상태 버전 (마이그레이션용) */
  version: number;
  /** 프로젝트 목표 및 비전 (개선 추천 필터링용) */
  projectVision?: ProjectVision;
}

// ===== Improvement Item Types =====

/**
 * 개선 항목 원인/출처 유형
 */
export type ImprovementOrigin =
  | 'test-failure'       // 테스트 실패에서 파생
  | 'build-error'        // 빌드 오류에서 파생
  | 'runtime-error'      // 런타임 오류에서 파생
  | 'static-analysis'    // 정적 분석(lint, type-check 등)에서 파생
  | 'manual-idea'        // 수동 아이디어/제안
  | 'performance-issue'  // 성능 문제에서 파생
  | 'security-scan'      // 보안 스캔에서 파생
  | 'dependency-audit';  // 의존성 감사에서 파생

/**
 * 리스크 레벨
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * 개선 항목 (파싱된)
 */
export interface ImprovementItem {
  /** 항목 ID (내용 해시) */
  id: string;
  /** 우선순위 */
  priority: 'P1' | 'P2' | 'P3';
  /** 제목 */
  title: string;
  /** 상세 설명 */
  description: string;
  /** 대상 파일/모듈 */
  targetFiles?: string[];
  /** 카테고리 */
  category: ImprovementCategory;
  /** 예상 복잡도 */
  complexity: 'low' | 'medium' | 'high';
  /** 적용 여부 */
  applied: boolean;
  /** 세션 ID */
  sessionId: string;
  /** 생성 시간 */
  createdAt: string;
  /** 예상 성능/품질 영향 */
  expectedImpact?: {
    /** 성능 영향 (예: '메모리 사용량 20% 감소', 'API 응답 시간 50% 단축') */
    performance?: string;
    /** 코드 품질 영향 (예: '유지보수성 향상', '가독성 개선') */
    quality?: string;
    /** 측정 가능한 지표 */
    metrics?: string[];
  };
  /** 개선 항목의 원인/출처 */
  origin?: ImprovementOrigin;
  /** 관련 오류/로그 메시지 요약 */
  relatedErrors?: string[];
  /** 관련 평가 점수 카테고리 (이 개선이 영향을 주는 평가 항목) */
  relatedScoreCategories?: EvaluationCategory[];
  /** 리스크 레벨 */
  riskLevel?: RiskLevel;
  /** Definition of Done 체크리스트 */
  definitionOfDone?: string[];
}

// ===== Utility Types =====

/**
 * 진행 상태 콜백
 */
export interface ProgressCallback {
  (message: string, increment?: number): void;
}

/**
 * 설정 값
 */
export interface VibeReportConfig {
  reportDirectory: string;
  snapshotFile: string;
  enableGitDiff: boolean;
  excludePatterns: string[];
  maxFilesToScan: number;
  autoOpenReports: boolean;
  enableDirectAi: boolean;
  language: 'ko' | 'en';
  /** 프로젝트 비전 모드: 'auto'는 전체 파일 기반 자동 분석, 'custom'은 사용자 설정 비전 사용 */
  projectVisionMode: 'auto' | 'custom';
  /** 기본 프로젝트 유형 (auto-detect이면 자동 감지) */
  defaultProjectType: ProjectType | 'auto-detect';
  /** 기본 품질 우선순위 단계 */
  defaultQualityFocus: QualityFocus;
}

/**
 * 보고서 파일 경로
 */
export interface ReportPaths {
  evaluation: string;
  improvement: string;
}

// ===== Constants =====

export const REPORT_FILE_NAMES = {
  evaluation: 'Project_Evaluation_Report.md',
  improvement: 'Project_Improvement_Exploration_Report.md',
} as const;

export const STATE_VERSION = 1;

export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/out/**',
  '**/build/**',
  '**/.git/**',
  '**/target/**',
  '**/.next/**',
  '**/__pycache__/**',
  '**/.venv/**',
  '**/coverage/**',
  '**/*.log',
  '**/*.lock',
];

export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript (React)',
  js: 'JavaScript',
  jsx: 'JavaScript (React)',
  py: 'Python',
  rs: 'Rust',
  go: 'Go',
  java: 'Java',
  kt: 'Kotlin',
  swift: 'Swift',
  cs: 'C#',
  cpp: 'C++',
  c: 'C',
  rb: 'Ruby',
  php: 'PHP',
  vue: 'Vue',
  svelte: 'Svelte',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  md: 'Markdown',
  sql: 'SQL',
  sh: 'Shell',
  ps1: 'PowerShell',
  dockerfile: 'Dockerfile',
};

export const IMPORTANT_CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'tauri.conf.json',
  'Cargo.toml',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'webpack.config.js',
  'rollup.config.js',
  'esbuild.config.js',
  'jest.config.js',
  'vitest.config.ts',
  'playwright.config.ts',
  '.eslintrc.js',
  '.eslintrc.json',
  'eslint.config.js',
  '.prettierrc',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Makefile',
  'CMakeLists.txt',
];
