/**
 * Markdown Preview Mermaid Plugin
 * 
 * @description VS Code 기본 마크다운 미리보기에 Mermaid 다이어그램 렌더링 기능을 추가합니다.
 * 이 파일은 package.json의 markdown.markdownItPlugins contribution point에 의해 로드됩니다.
 */

import type MarkdownIt from 'markdown-it';

export function activate() {
    return {
        extendMarkdownIt(md: MarkdownIt) {
            const defaultFence = md.renderer.rules.fence;

            md.renderer.rules.fence = (tokens, idx, options, env, self) => {
                const token = tokens[idx];

                if (token.info.trim() === 'mermaid') {
                    // Mermaid 코드블록을 pre.mermaid로 변환
                    // VS Code markdown preview에서 mermaid.js가 자동으로 렌더링
                    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>`;
                }

                // 다른 코드블록은 기본 렌더러 사용
                if (defaultFence) {
                    return defaultFence(tokens, idx, options, env, self);
                }
                return '';
            };

            return md;
        }
    };
}
