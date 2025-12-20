import { describe, it, expect } from 'vitest';
import { getMessage, MESSAGES } from '../constants.js';

describe('constants', () => {
  it('returns default (ko) messages when language is omitted', () => {
    expect(getMessage('scanStarted')).toBe(MESSAGES.ko.scanStarted);
  });

  it('returns english messages when language is en', () => {
    expect(getMessage('scanStarted', 'en')).toBe(MESSAGES.en.scanStarted);
  });
});
