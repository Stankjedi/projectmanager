/**
 * Custom Error Classes for Vibe Report Extension
 */

export class VibeReportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = 'VibeReportError';
    Object.setPrototypeOf(this, VibeReportError.prototype);
  }
}

export class OperationCancelledError extends Error {
  constructor(message = 'Operation cancelled') {
    super(message);
    this.name = 'OperationCancelledError';
    Object.setPrototypeOf(this, OperationCancelledError.prototype);
  }
}

export class WorkspaceScanError extends VibeReportError {
  constructor(message: string, details?: string) {
    super(
      details ? `${message}: ${details}` : message,
      'WORKSPACE_SCAN_ERROR',
      '워크스페이스 스캔 중 오류가 발생했습니다. 폴더가 열려있는지 확인하세요.'
    );
    this.name = 'WorkspaceScanError';
    Object.setPrototypeOf(this, WorkspaceScanError.prototype);
  }
}

export class ReportGenerationError extends VibeReportError {
  constructor(message: string, details?: string) {
    super(
      details ? `${message}: ${details}` : message,
      'REPORT_GENERATION_ERROR',
      '보고서 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
    );
    this.name = 'ReportGenerationError';
    Object.setPrototypeOf(this, ReportGenerationError.prototype);
  }
}

export class ConfigurationError extends VibeReportError {
  constructor(message: string, details?: string) {
    super(
      details ? `${message}: ${details}` : message,
      'CONFIGURATION_ERROR',
      '설정 오류입니다. VS Code 설정을 확인해주세요.'
    );
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class FileOperationError extends VibeReportError {
  constructor(message: string, filePath: string) {
    super(
      `${message}: ${filePath}`,
      'FILE_OPERATION_ERROR',
      `파일 작업 중 오류가 발생했습니다: ${filePath}`
    );
    this.name = 'FileOperationError';
    Object.setPrototypeOf(this, FileOperationError.prototype);
  }
}

/**
 * Standardized error message formatter for consistent UX across the extension.
 * 
 * @param area - The area or component where the error occurred (e.g., 'UpdateReports', 'WorkspaceScan')
 * @param message - The specific error message
 * @returns Formatted error message with [VibeReport] prefix
 * 
 * @example
 * ```typescript
 * const msg = formatErrorMessage('UpdateReports', 'Failed to create directory');
 * // Returns: "[VibeReport] UpdateReports: Failed to create directory"
 * ```
 */
export function formatErrorMessage(area: string, message: string): string {
  return `[VibeReport] ${area}: ${message}`;
}
