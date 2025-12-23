import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { linkifyCodeReferences, linkifyTableFilePaths } from '../reportLinkify.js';

function parseFirstCommandArgs(markdown: string): unknown[] | null {
  const match = markdown.match(/command:vibereport\.openFunctionInFile\?([^)]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

describe('reportLinkify', () => {
  it('linkifies safe relative code references', () => {
    const rootPath = '/root/project';
    const input = 'See `src/file.ts`#myFunc for details.';
    const output = linkifyCodeReferences(rootPath, input);

    expect(output).toContain('[src/file.ts#myFunc](command:vibereport.openFunctionInFile?');

    const args = parseFirstCommandArgs(output);
    expect(args).toEqual([path.resolve(rootPath, 'src/file.ts'), 'myFunc']);
  });

  it('does not linkify traversal paths', () => {
    const rootPath = '/root/project';
    const input = 'See `../secrets.ts` for details.';
    const output = linkifyCodeReferences(rootPath, input);

    expect(output).toBe(input);
    expect(output).not.toContain('command:vibereport.openFunctionInFile');
  });

  it('does not linkify absolute paths', () => {
    const rootPath = '/root/project';
    const input = 'See `/etc/secrets.ts` for details.';
    const output = linkifyCodeReferences(rootPath, input);

    expect(output).toBe(input);
    expect(output).not.toContain('command:vibereport.openFunctionInFile');
  });

  it('linkifies table target paths but leaves unsafe paths unchanged', () => {
    const rootPath = '/root/project';
    const input =
      '| **대상 파일** | `src/ok.ts`, `../bad.ts`, `/etc/nope.ts`, `C:\\abs.ts` |';
    const output = linkifyTableFilePaths(rootPath, input);

    expect(output).toContain('[src/ok.ts](command:vibereport.openFunctionInFile?');
    expect(output).toContain('`../bad.ts`');
    expect(output).toContain('`/etc/nope.ts`');
    expect(output).toContain('`C:\\abs.ts`');
  });
});
