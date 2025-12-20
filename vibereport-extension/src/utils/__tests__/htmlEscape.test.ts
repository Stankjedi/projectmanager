import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeHtmlAttribute } from '../htmlEscape.js';

describe('htmlEscape', () => {
  it('escapes basic HTML characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('handles mixed content without dropping characters', () => {
    expect(escapeHtml('A&B <tag> "quote"')).toBe(
      'A&amp;B &lt;tag&gt; &quot;quote&quot;'
    );
  });
});

describe('htmlEscapeAttribute', () => {
  it('escapes newlines for safe attribute insertion', () => {
    expect(escapeHtmlAttribute('line1\r\nline2')).toBe('line1&#13;&#10;line2');
  });

  it('escapes quotes and ampersands', () => {
    expect(escapeHtmlAttribute('Tom & "Jerry"')).toBe(
      'Tom &amp; &quot;Jerry&quot;'
    );
  });
});
