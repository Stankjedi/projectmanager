import { describe, it, expect } from 'vitest';
import {
  ConfigurationError,
  FileOperationError,
  ReportGenerationError,
  WorkspaceScanError,
  formatErrorMessage,
} from '../errors.js';

describe('errors', () => {
  it('formats WorkspaceScanError with and without details', () => {
    const simple = new WorkspaceScanError('Scan failed');
    expect(simple.message).toBe('Scan failed');
    expect(simple.code).toBe('WORKSPACE_SCAN_ERROR');

    const withDetails = new WorkspaceScanError('Scan failed', 'No folder');
    expect(withDetails.message).toBe('Scan failed: No folder');
  });

  it('formats ReportGenerationError with optional details', () => {
    const simple = new ReportGenerationError('Generate failed');
    expect(simple.message).toBe('Generate failed');

    const withDetails = new ReportGenerationError('Generate failed', 'Timeout');
    expect(withDetails.message).toBe('Generate failed: Timeout');
  });

  it('formats ConfigurationError with optional details', () => {
    const simple = new ConfigurationError('Bad config');
    expect(simple.message).toBe('Bad config');

    const withDetails = new ConfigurationError('Bad config', 'Missing field');
    expect(withDetails.message).toBe('Bad config: Missing field');
  });

  it('includes file path in FileOperationError', () => {
    const err = new FileOperationError('Cannot open', '/tmp/file.txt');
    expect(err.message).toBe('Cannot open: /tmp/file.txt');
    expect(err.code).toBe('FILE_OPERATION_ERROR');
  });

  it('formats standardized error messages', () => {
    expect(formatErrorMessage('UpdateReports', 'Failed')).toBe(
      '[VibeReport] UpdateReports: Failed'
    );
  });
});
