import { describe, it, expect } from 'vitest';
import { isSensitivePath } from '../sensitiveFilesUtils.js';

describe('sensitiveFilesUtils', () => {
  it('detects common sensitive paths and exceptions', () => {
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('.env.local')).toBe(true);
    expect(isSensitivePath('.env.example')).toBe(false);

    expect(isSensitivePath('vsctoken.txt')).toBe(true);
    expect(isSensitivePath('api_token.json')).toBe(true);

    expect(isSensitivePath('private.pem')).toBe(true);
    expect(isSensitivePath('id_rsa.key')).toBe(true);

    expect(isSensitivePath('README.md')).toBe(false);
    expect(isSensitivePath('docs\\\\README.md')).toBe(false);
  });
});
