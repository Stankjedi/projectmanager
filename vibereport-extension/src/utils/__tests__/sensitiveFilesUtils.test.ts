import { describe, it, expect } from 'vitest';
import { isSensitivePath } from '../sensitiveFilesUtils.js';

describe('sensitiveFilesUtils', () => {
  it('detects env file rules', () => {
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('.env.local')).toBe(true);
    expect(isSensitivePath('.env.example')).toBe(false);
  });

  it('detects common sensitive file patterns', () => {
    expect(isSensitivePath('vsctoken.txt')).toBe(true);
    expect(isSensitivePath('api_token.json')).toBe(true);
    expect(isSensitivePath('token.json')).toBe(true);

    expect(isSensitivePath('private.pem')).toBe(true);
    expect(isSensitivePath('id_rsa.key')).toBe(true);
    expect(isSensitivePath('id_rsa')).toBe(true);
    expect(isSensitivePath('id_ed25519')).toBe(true);

    expect(isSensitivePath('secret.txt')).toBe(true);
    expect(isSensitivePath('secrets.json')).toBe(true);
    expect(isSensitivePath('credential.ini')).toBe(true);
    expect(isSensitivePath('credentials.yml')).toBe(true);
    expect(isSensitivePath('password.conf')).toBe(true);
    expect(isSensitivePath('passwd')).toBe(true);

    expect(isSensitivePath('api-key.txt')).toBe(true);
    expect(isSensitivePath('api_key.json')).toBe(true);
    expect(isSensitivePath('apikey.conf')).toBe(true);
  });

  it('avoids common false positives', () => {
    expect(isSensitivePath('README.md')).toBe(false);
    expect(isSensitivePath('docs\\\\README.md')).toBe(false);

    expect(isSensitivePath('tokenizer.json')).toBe(false);
    expect(isSensitivePath('monkey.ts')).toBe(false);
    expect(isSensitivePath('monkey.txt')).toBe(false);
    expect(isSensitivePath('keynote.json')).toBe(false);
    expect(isSensitivePath('api-keyboard.txt')).toBe(false);
    expect(isSensitivePath('secretsManager.ts')).toBe(false);
    expect(isSensitivePath('id_rsa.pub')).toBe(false);
  });
});
