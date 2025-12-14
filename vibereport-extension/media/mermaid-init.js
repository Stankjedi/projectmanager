// Mermaid.js 초기화 스크립트
// VS Code 마크다운 미리보기에서 Mermaid 다이어그램을 렌더링합니다.

(function () {
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: true,
            theme: document.body.classList.contains('vscode-dark') ? 'dark' : 'default',
            securityLevel: 'loose'
        });

        // 페이지 로드 후 렌더링
        mermaid.run();
    }
})();
