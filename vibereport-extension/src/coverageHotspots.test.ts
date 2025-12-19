import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('vscode', () => ({}));

describe('coverage hotspots', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('loads core barrel exports without throwing', async () => {
    const commands = await import('./commands/index.js');
    expect(commands).toHaveProperty('UpdateReportsCommand');
    expect(commands).toHaveProperty('ReportDoctorCommand');

    const services = await import('./services/index.js');
    expect(services).toHaveProperty('ReportService');
    expect(services).toHaveProperty('SnapshotService');

    const models = await import('./models/index.js');
    expect(models).toHaveProperty('REPORT_FILE_NAMES');
  });

  it('markdown plugin renders mermaid fences and falls back for others', async () => {
    const { activate } = await import('./markdownPlugin.js');

    const defaultFence = vi.fn().mockReturnValue('default');
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const md: any = {
      renderer: { rules: { fence: defaultFence } },
      utils: { escapeHtml },
    };

    const extended = activate().extendMarkdownIt(md);
    const fence = extended.renderer.rules.fence as unknown as (
      ...args: any[]
    ) => string;

    const mermaid = fence(
      [{ info: 'mermaid', content: '<graph>&</graph>' }] as any,
      0,
      {},
      {},
      {}
    );
    expect(mermaid).toBe(
      '<pre class="mermaid">&lt;graph&gt;&amp;&lt;/graph&gt;</pre>'
    );

    const nonMermaid = fence(
      [{ info: 'ts', content: 'console.log(1)' }] as any,
      0,
      {},
      {},
      {}
    );
    expect(nonMermaid).toBe('default');
    expect(defaultFence).toHaveBeenCalled();
  });
});
