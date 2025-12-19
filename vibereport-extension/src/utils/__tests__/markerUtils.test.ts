import { describe, it, expect } from 'vitest';
import {
  findMarkerRange,
  replaceBetweenMarkersLines,
  prependBetweenMarkers,
  appendBetweenMarkers,
  replaceManyBetweenMarkersLines,
  hasMarkers,
  extractBetweenMarkersLines,
} from '../markerUtils.js';

describe('markerUtils', () => {
  it('findMarkerRange returns start/end indices when markers exist in order', () => {
    const lines = ['a', '<!-- START -->', 'b', '<!-- END -->', 'c'];
    expect(findMarkerRange(lines, '<!-- START -->', '<!-- END -->')).toEqual({
      start: 1,
      end: 3,
    });
  });

  it('findMarkerRange returns null when markers are missing or invalid', () => {
    expect(findMarkerRange(['a', 'b'], '<!-- START -->', '<!-- END -->')).toBe(
      null
    );
    expect(
      findMarkerRange(['<!-- END -->', '<!-- START -->'], '<!-- START -->', '<!-- END -->')
    ).toBe(null);
  });

  it('replaceBetweenMarkersLines replaces content between markers', () => {
    const content = ['x', '<!-- START -->', 'old', '<!-- END -->', 'y'].join('\n');
    const result = replaceBetweenMarkersLines(
      content,
      '<!-- START -->',
      '<!-- END -->',
      'new1\nnew2\n'
    );
    expect(result).toBe(['x', '<!-- START -->', 'new1', 'new2', '<!-- END -->', 'y'].join('\n'));
  });

  it('prependBetweenMarkers prepends content after start marker', () => {
    const content = ['<s>', '<!-- START -->', 'a', 'b', '<!-- END -->', '</s>'].join('\n');
    const result = prependBetweenMarkers(content, '<!-- START -->', '<!-- END -->', 'p');
    expect(result).toBe(['<s>', '<!-- START -->', 'p', 'a', 'b', '<!-- END -->', '</s>'].join('\n'));
  });

  it('appendBetweenMarkers appends content before end marker', () => {
    const content = ['<s>', '<!-- START -->', 'a', 'b', '<!-- END -->', '</s>'].join('\n');
    const result = appendBetweenMarkers(content, '<!-- START -->', '<!-- END -->', 'q');
    expect(result).toBe(['<s>', '<!-- START -->', 'a', 'b', 'q', '<!-- END -->', '</s>'].join('\n'));
  });

  it('hasMarkers detects marker pairs in correct order', () => {
    const ok = 'before\n<!-- START -->\ninside\n<!-- END -->\nafter';
    const badOrder = '<!-- END -->\n<!-- START -->';
    const missing = 'no markers';

    expect(hasMarkers(ok, '<!-- START -->', '<!-- END -->')).toBe(true);
    expect(hasMarkers(badOrder, '<!-- START -->', '<!-- END -->')).toBe(false);
    expect(hasMarkers(missing, '<!-- START -->', '<!-- END -->')).toBe(false);
  });

  it('extractBetweenMarkersLines extracts trimmed content between markers', () => {
    const content = ['x', '<!-- START -->', '  a  ', 'b', '<!-- END -->', 'y'].join('\n');
    expect(extractBetweenMarkersLines(content, '<!-- START -->', '<!-- END -->')).toBe('a  \nb');
    expect(extractBetweenMarkersLines('no markers', '<!-- START -->', '<!-- END -->')).toBe(null);
  });

  it('replaceManyBetweenMarkersLines matches sequential replaceBetweenMarkersLines calls', () => {
    const content = [
      'before',
      '<!-- A-START -->',
      'old-a',
      '<!-- A-END -->',
      'between',
      '<!-- B-START -->',
      'old-b-1',
      'old-b-2',
      '<!-- B-END -->',
      'after',
    ].join('\n');

    const sequential = replaceBetweenMarkersLines(
      replaceBetweenMarkersLines(
        content,
        '<!-- A-START -->',
        '<!-- A-END -->',
        'new-a'
      ),
      '<!-- B-START -->',
      '<!-- B-END -->',
      'new-b-1\nnew-b-2\n'
    );

    const batched = replaceManyBetweenMarkersLines(content, [
      {
        startMarker: '<!-- A-START -->',
        endMarker: '<!-- A-END -->',
        newBlock: 'new-a',
      },
      {
        startMarker: '<!-- B-START -->',
        endMarker: '<!-- B-END -->',
        newBlock: 'new-b-1\nnew-b-2\n',
      },
    ]);

    expect(batched).toBe(sequential);
  });

  it('replaceManyBetweenMarkersLines leaves content unchanged when markers are missing', () => {
    const content = 'before\n<!-- START -->\ninside\n<!-- END -->\nafter';

    expect(
      replaceManyBetweenMarkersLines(content, [
        {
          startMarker: '<!-- MISSING-START -->',
          endMarker: '<!-- MISSING-END -->',
          newBlock: 'new',
        },
      ])
    ).toBe(content);
  });
});
