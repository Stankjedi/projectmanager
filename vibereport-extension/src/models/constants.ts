/**
 * Centralized Constants and Messages
 */

export const MESSAGES = {
  ko: {
    noWorkspace: '워크스페이스가 열려있지 않습니다.',
    scanStarted: '프로젝트 스캔 시작...',
    scanComplete: '스캔 완료!',
    promptCopied: '프롬프트가 클립보드에 복사되었습니다.',
    reportUpdated: '보고서가 업데이트되었습니다.',
    noReports: '보고서 파일이 없습니다. 먼저 업데이트를 실행해주세요.',
    initialAnalysis: '초기 분석 프롬프트가 클립보드에 복사되었습니다!',
    updateAnalysis: '업데이트 프롬프트가 클립보드에 복사되었습니다!',
    pasteInstruction: 'Copilot Chat에 붙여넣기(Ctrl+V)하여 분석을 시작하세요.',
    openCopilotChat: 'Copilot Chat 열기',
    openEvalReport: '평가 보고서 열기',
    openImproveReport: '개선 보고서 열기',
    analyzing: '분석 중...',
    generating: '생성 중...',
  },
  en: {
    noWorkspace: 'No workspace is open.',
    scanStarted: 'Starting project scan...',
    scanComplete: 'Scan complete!',
    promptCopied: 'Prompt copied to clipboard.',
    reportUpdated: 'Reports have been updated.',
    noReports: 'No report files found. Please run update first.',
    initialAnalysis: 'Initial analysis prompt copied to clipboard!',
    updateAnalysis: 'Update prompt copied to clipboard!',
    pasteInstruction: 'Paste (Ctrl+V) into Copilot Chat to start analysis.',
    openCopilotChat: 'Open Copilot Chat',
    openEvalReport: 'Open Evaluation Report',
    openImproveReport: 'Open Improvement Report',
    analyzing: 'Analyzing...',
    generating: 'Generating...',
  },
} as const;

export const DEFAULTS = {
  reportDirectory: 'devplan',
  snapshotFile: '.vscode/vibereport-state.json',
  maxFilesToScan: 5000,
  language: 'ko' as const,
} as const;

export const FILE_NAMES = {
  evaluation: 'Project_Evaluation_Report.md',
  improvement: 'Project_Improvement_Exploration_Report.md',
  prompt: 'Prompt.md',
} as const;

export type Language = 'ko' | 'en';

export function getMessage(key: keyof typeof MESSAGES.ko, lang: Language = 'ko'): string {
  return MESSAGES[lang][key];
}
