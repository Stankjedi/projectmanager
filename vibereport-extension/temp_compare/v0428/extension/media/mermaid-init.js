// Mermaid.js 초기화 스크립트
// VS Code 마크다운 미리보기에서 Mermaid 다이어그램을 렌더링합니다.

(function () {
    if (typeof mermaid !== 'undefined') {
        const isDark = document.body.classList.contains('vscode-dark');

        mermaid.initialize({
            startOnLoad: true,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'loose',
            themeVariables: isDark ? {
                // 다크 테마에서 subgraph 배경색을 명시적으로 설정하여 검은색 문제 해결
                background: '#1e1e1e',
                primaryColor: '#3794ff',
                primaryTextColor: '#d4d4d4',
                primaryBorderColor: '#454545',
                lineColor: '#858585',
                secondaryColor: '#3a3d41',
                tertiaryColor: '#2d2d2d',
                // Subgraph 관련 색상
                mainBkg: '#2d2d2d',
                nodeBorder: '#454545',
                clusterBkg: '#2d2d2d',
                clusterBorder: '#454545',
                titleColor: '#d4d4d4',
                edgeLabelBackground: '#2d2d2d'
            } : {
                // 라이트 테마
                background: '#ffffff',
                primaryColor: '#0066cc',
                primaryTextColor: '#1a1a1a',
                primaryBorderColor: '#e0e0e0',
                lineColor: '#666666',
                secondaryColor: '#f5f5f5',
                tertiaryColor: '#ffffff',
                mainBkg: '#f5f5f5',
                nodeBorder: '#e0e0e0',
                clusterBkg: '#f5f5f5',
                clusterBorder: '#e0e0e0',
                titleColor: '#1a1a1a',
                edgeLabelBackground: '#ffffff'
            }
        });

        // 페이지 로드 후 렌더링
        mermaid.run();
    }
})();
