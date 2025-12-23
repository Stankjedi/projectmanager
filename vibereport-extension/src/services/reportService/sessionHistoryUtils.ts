import type { SessionRecord } from '../../models/types.js';
import { formatDateTimeKorean } from '../../utils/markdownUtils.js';
import { extractBetweenMarkersLines, hasMarkers } from '../../utils/markerUtils.js';
import { createSessionHistoryTemplate as buildSessionHistoryTemplate } from '../reportTemplates.js';

export const SESSION_HISTORY_MARKERS = {
  STATS_START: '<!-- STATS-START -->',
  STATS_END: '<!-- STATS-END -->',
  SESSION_LIST_START: '<!-- SESSION-LIST-START -->',
  SESSION_LIST_END: '<!-- SESSION-LIST-END -->',
} as const;

export function ensureManagedSessionHistoryBlocks(content: string): string {
  let next = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 빈 파일은 템플릿으로 대체
  if (next.trim().length === 0) {
    return buildSessionHistoryTemplate();
  }

  next = ensureManagedSessionHistoryStatsBlock(next);
  next = ensureManagedSessionHistorySessionListBlock(next);

  return next;
}

export function buildSessionHistoryStatsContent(
  content: string,
  totalSessions: number,
  appliedCount: number,
  sessionTimestampIso: string
): string {
  const statsStart = SESSION_HISTORY_MARKERS.STATS_START;
  const statsEnd = SESSION_HISTORY_MARKERS.STATS_END;

  const now = formatDateTimeKorean(new Date());
  const existingStatsBlock = extractBetweenMarkersLines(
    content,
    statsStart,
    statsEnd
  );

  const existingFirstSession = extractSessionHistoryFirstSession(existingStatsBlock);
  const defaultFirstSession =
    totalSessions === 1
      ? formatDateTimeKorean(new Date(sessionTimestampIso))
      : '-';
  const firstSession =
    existingFirstSession && existingFirstSession !== '-'
      ? existingFirstSession
      : defaultFirstSession;

  const lastSession =
    totalSessions > 0
      ? formatDateTimeKorean(new Date(sessionTimestampIso))
      : '-';

  const statsContent = `## 📊 세션 통계

| 항목 | 값 |
|------|-----|
| **총 세션 수** | ${totalSessions} |
| **첫 세션** | ${firstSession} |
| **마지막 세션** | ${lastSession} |
| **마지막 업데이트** | ${now} |
| **적용 완료 항목** | ${appliedCount} |`;

  return statsContent;
}

export function formatSessionEntry(session: SessionRecord): string {
  const date = new Date(session.timestamp);
  const formattedDate = formatDateTimeKorean(date);

  let entry = `### 📅 ${formattedDate}

| 항목 | 값 |
|------|-----|
| **세션 ID** | \`${session.id}\` |
| **작업** | ${session.userPrompt} |
| **새 파일** | ${session.diffSummary.newFilesCount}개 |
| **삭제 파일** | ${session.diffSummary.removedFilesCount}개 |
| **설정 변경** | ${session.diffSummary.changedConfigsCount}개 |
| **총 변경** | ${session.diffSummary.totalChanges}개 |`;

  if (session.aiMetadata) {
    entry += `
| **개선 제안** | ${session.aiMetadata.improvementsProposed || 0}개 |
| **리스크 감지** | ${session.aiMetadata.risksIdentified || 0}개 |`;

    if (session.aiMetadata.overallScore) {
      entry += `
| **품질 점수** | ${session.aiMetadata.overallScore}/100 |`;
    }
  }

  entry += '\n\n---\n';

  return entry;
}

export function buildPrependedSessionHistorySessionListBlock(
  content: string,
  entry: string,
  sessionId: string
): string | null {
  const startMarker = SESSION_HISTORY_MARKERS.SESSION_LIST_START;
  const endMarker = SESSION_HISTORY_MARKERS.SESSION_LIST_END;

  const existingBlock = extractBetweenMarkersLines(content, startMarker, endMarker);
  if (!existingBlock) {
    return null;
  }

  // idempotency: 동일 세션 ID가 이미 기록되어 있으면 중복 삽입하지 않음
  if (existingBlock.includes(`\`${sessionId}\``)) {
    return null;
  }

  const lines = existingBlock.split('\n');
  const headerLineIndex = lines.findIndex(line => line.trim().startsWith('## '));
  const safeHeaderIndex = headerLineIndex === -1 ? 0 : headerLineIndex;

  const trimmedLines = lines.filter(line => !line.includes('세션 기록이 여기에 추가됩니다'));

  // 헤더가 없으면 기본 헤더를 강제로 추가
  if (headerLineIndex === -1) {
    trimmedLines.unshift('## 🕐 전체 세션 기록', '');
  }

  // 헤더 이후 위치 계산 (헤더 다음의 공백 라인은 0~N개 허용)
  let insertAt = safeHeaderIndex + 1;
  while (insertAt < trimmedLines.length && trimmedLines[insertAt].trim().length === 0) {
    insertAt++;
  }

  const entryLines = entry.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
  const nextBlockLines = [
    ...trimmedLines.slice(0, insertAt),
    '',
    ...entryLines,
    '',
    ...trimmedLines.slice(insertAt),
  ]
    .join('\n')
    .trim();

  return nextBlockLines;
}

function extractSessionHistoryFirstSession(statsBlock: string | null): string | null {
  if (!statsBlock) {
    return null;
  }

  for (const line of statsBlock.split('\n')) {
    const row = parseMarkdownTableRow(line);
    if (!row) {
      continue;
    }

    const [label, value] = row;
    if (label.includes('첫 세션') || label.toLowerCase().includes('first session')) {
      return value;
    }
  }

  return null;
}

function parseMarkdownTableRow(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) {
    return null;
  }

  const cells = trimmed
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell.length > 0);

  if (cells.length < 2) {
    return null;
  }

  return [cells[0], cells[1]];
}

function ensureManagedSessionHistoryStatsBlock(content: string): string {
  const startMarker = SESSION_HISTORY_MARKERS.STATS_START;
  const endMarker = SESSION_HISTORY_MARKERS.STATS_END;

  const startCount = content.split(startMarker).length - 1;
  const endCount = content.split(endMarker).length - 1;
  if (startCount === 1 && endCount === 1 && hasMarkers(content, startMarker, endMarker)) {
    return content;
  }

  // 깨진/중복 마커 제거 후 레거시 섹션을 감싸거나 기본 블록 삽입
  const cleaned = content
    .split('\n')
    .filter(line => !line.includes(startMarker) && !line.includes(endMarker))
    .join('\n');

  const lines = cleaned.split('\n');
  const headerIndex = lines.findIndex(line => {
    const t = line.trim();
    return t.startsWith('##') && (t.includes('세션 통계') || t.includes('통계 요약'));
  });

  if (headerIndex !== -1) {
    let endIndex = lines.length;
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t === '---' || t.startsWith('## ')) {
        endIndex = i;
        break;
      }
    }

    const before = lines.slice(0, headerIndex);
    const middle = lines.slice(headerIndex, endIndex);
    const after = lines.slice(endIndex);
    return [...before, startMarker, ...middle, endMarker, ...after].join('\n');
  }

  // 레거시 섹션이 없으면 SESSION-LIST 시작 마커 앞 또는 파일 끝에 기본 블록 삽입
  const defaultStatsBlock = [
    startMarker,
    '## 📊 세션 통계',
    '',
    '| 항목 | 값 |',
    '|------|-----|',
    '| **총 세션 수** | 0 |',
    '| **첫 세션** | - |',
    '| **마지막 세션** | - |',
    '| **마지막 업데이트** | - |',
    '| **적용 완료 항목** | 0 |',
    endMarker,
  ].join('\n');

  const insertBeforeIndex = lines.findIndex(line => line.includes(SESSION_HISTORY_MARKERS.SESSION_LIST_START));
  if (insertBeforeIndex !== -1) {
    const before = lines.slice(0, insertBeforeIndex);
    const after = lines.slice(insertBeforeIndex);
    return [...before, '', defaultStatsBlock, '', ...after].join('\n');
  }

  return `${cleaned}\n\n${defaultStatsBlock}`;
}

function ensureManagedSessionHistorySessionListBlock(content: string): string {
  const startMarker = SESSION_HISTORY_MARKERS.SESSION_LIST_START;
  const endMarker = SESSION_HISTORY_MARKERS.SESSION_LIST_END;

  const startCount = content.split(startMarker).length - 1;
  const endCount = content.split(endMarker).length - 1;
  if (startCount === 1 && endCount === 1 && hasMarkers(content, startMarker, endMarker)) {
    return content;
  }

  const cleaned = content
    .split('\n')
    .filter(line => !line.includes(startMarker) && !line.includes(endMarker))
    .join('\n');

  const lines = cleaned.split('\n');
  const headerIndex = lines.findIndex(line => {
    const t = line.trim();
    return t.startsWith('##') && (t.includes('전체 세션 기록') || t.includes('세션 기록'));
  });

  if (headerIndex !== -1) {
    let endIndex = lines.length;
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('## ')) {
        endIndex = i;
        break;
      }
    }

    const before = lines.slice(0, headerIndex);
    const middle = lines.slice(headerIndex, endIndex);
    const after = lines.slice(endIndex);
    return [...before, startMarker, ...middle, endMarker, ...after].join('\n');
  }

  const defaultListBlock = [
    startMarker,
    '## 🕐 전체 세션 기록',
    '',
    '*세션 기록이 여기에 추가됩니다.*',
    endMarker,
  ].join('\n');

  return `${cleaned}\n\n${defaultListBlock}`;
}

