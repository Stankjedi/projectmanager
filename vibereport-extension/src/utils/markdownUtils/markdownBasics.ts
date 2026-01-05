/**
 * Basic markdown parsing / formatting helpers.
 */

/**
 * 마크다운 문자열에서 코드 블록을 추출합니다.
 *
 * @description 백틱 3개로 감싸진 코드 블록을 모두 찾아서
 * 언어와 코드 내용을 포함하는 배열로 반환합니다.
 *
 * @param content - 파싱할 마크다운 문자열
 * @returns 언어와 코드를 포함하는 객체 배열
 *
 * @example
 * ```typescript
 * const blocks = extractCodeBlocks('```typescript\nconst x = 1;\n```');
 * // blocks: [{ language: 'typescript', code: 'const x = 1;' }]
 * ```
 */
export function extractCodeBlocks(
  content: string
): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const pattern = /```(\w*)\n([\s\S]*?)```/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  return blocks;
}

/**
 * 마크다운 문자열에서 모든 헤더를 추출합니다.
 *
 * @description #으로 시작하는 모든 마크다운 헤더를 찾아서
 * 레벨, 텍스트, 라인 번호를 포함하는 배열로 반환합니다.
 *
 * @param content - 파싱할 마크다운 문자열
 * @returns 헤더 정보 객체 배열 (레벨 1-6, 텍스트, 라인 번호)
 *
 * @example
 * ```typescript
 * const headers = extractHeaders('# Title\n## Subtitle');
 * // headers: [
 * //   { level: 1, text: 'Title', line: 1 },
 * //   { level: 2, text: 'Subtitle', line: 2 }
 * // ]
 * ```
 */
export function extractHeaders(
  content: string
): Array<{ level: number; text: string; line: number }> {
  const headers: Array<{ level: number; text: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headers.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return headers;
}

/**
 * 특정 헤더부터 다음 동일/상위 레벨 헤더까지의 섹션을 추출합니다.
 *
 * @description 지정된 헤더 텍스트와 레벨을 가진 섹션을 찾아서
 * 해당 헤더부터 다음 동일 또는 상위 레벨 헤더 직전까지의 내용을 반환합니다.
 *
 * @param content - 검색할 마크다운 문자열
 * @param headerText - 찾을 헤더 텍스트
 * @param headerLevel - 헤더 레벨 (1-6)
 * @returns 추출된 섹션 내용 또는 찾지 못한 경우 null
 *
 * @example
 * ```typescript
 * const section = extractSection(content, '설치 방법', 2);
 * // ## 설치 방법 부터 다음 ## 헤더 전까지의 내용
 * ```
 */
export function extractSection(
  content: string,
  headerText: string,
  headerLevel: number
): string | null {
  const lines = content.split('\n');
  const headerPattern = new RegExp(
    `^#{${headerLevel}}\\s+${escapeRegex(headerText)}\\s*$`
  );

  let startLine = -1;
  let endLine = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i])) {
      startLine = i;
      continue;
    }

    if (startLine !== -1) {
      // 동일하거나 상위 레벨의 헤더를 찾으면 종료
      const nextHeaderMatch = lines[i].match(/^(#{1,6})\s+/);
      if (nextHeaderMatch && nextHeaderMatch[1].length <= headerLevel) {
        endLine = i;
        break;
      }
    }
  }

  if (startLine === -1) {
    return null;
  }

  return lines.slice(startLine, endLine).join('\n').trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 마크다운 테이블을 생성합니다.
 *
 * @description 헤더 배열과 행 데이터 배열을 받아서
 * 파이프로 구분된 마크다운 테이블 문자열을 생성합니다.
 *
 * @param headers - 테이블 헤더 문자열 배열
 * @param rows - 각 행의 셀 데이터 배열의 배열
 * @returns 마크다운 테이블 문자열
 *
 * @example
 * ```typescript
 * const table = createMarkdownTable(
 *   ['이름', '나이'],
 *   [['홍길동', '30'], ['김철수', '25']]
 * );
 * // | 이름 | 나이 |
 * // | --- | --- |
 * // | 홍길동 | 30 |
 * // | 김철수 | 25 |
 * ```
 */
export function createMarkdownTable(headers: string[], rows: string[][]): string {
  const headerRow = '| ' + headers.join(' | ') + ' |';
  const separator = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const dataRows = rows.map(row => '| ' + row.join(' | ') + ' |');

  return [headerRow, separator, ...dataRows].join('\n');
}

/**
 * 마크다운 체크리스트를 생성합니다.
 *
 * @description 텍스트와 체크 상태를 가진 아이템 배열을 받아서
 * GitHub Flavored Markdown 체크리스트 형식으로 변환합니다.
 *
 * @param items - 텍스트와 체크 상태를 가진 아이템 배열
 * @returns 마크다운 체크리스트 문자열
 *
 * @example
 * ```typescript
 * const checklist = createChecklist([
 *   { text: '완료된 작업', checked: true },
 *   { text: '미완료 작업', checked: false }
 * ]);
 * // - [x] 완료된 작업
 * // - [ ] 미완료 작업
 * ```
 */
export function createChecklist(
  items: Array<{ text: string; checked: boolean }>
): string {
  return items
    .map(item => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}

/**
 * HTML details/summary 태그를 사용한 접기 가능한 섹션을 생성합니다.
 *
 * @description GitHub에서 지원하는 접기 가능한 섹션 HTML을 생성합니다.
 * 기본적으로 접힌 상태로 표시되며, 클릭하여 펼칠 수 있습니다.
 *
 * @param summary - 접힌 상태에서 표시될 제목
 * @param content - 펼쳤을 때 표시될 내용
 * @returns HTML details 요소 문자열
 *
 * @example
 * ```typescript
 * const collapsible = createCollapsible('자세한 내용', '여기에 상세 정보...');
 * // <details>
 * // <summary>자세한 내용</summary>
 * // 여기에 상세 정보...
 * // </details>
 * ```
 */
export function createCollapsible(summary: string, content: string): string {
  return `<details>
<summary>${summary}</summary>

${content}

</details>`;
}

