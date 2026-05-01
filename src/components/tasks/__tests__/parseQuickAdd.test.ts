import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { parseQuickAdd } from '../parseQuickAdd';

const NOTES = [
  { id: 1, title: 'Meeting Notes' },
  { id: 2, title: 'Client Emails' },
];

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-30T12:00:00Z')); }); // Thu
afterEach(() => { vi.useRealTimers(); });

describe('parseQuickAdd', () => {
  it('parses title only → defaults', () => {
    expect(parseQuickAdd('Buy milk', NOTES)).toEqual({
      title: 'Buy milk', priority: 'medium', dueDate: null, sourceNoteId: null,
    });
  });

  it('parses !high priority', () => {
    expect(parseQuickAdd('Urgent task !high', NOTES)!.priority).toBe('high');
  });

  it('parses !h short form', () => {
    expect(parseQuickAdd('!h Urgent', NOTES)!.priority).toBe('high');
  });

  it('parses tomorrow', () => {
    const r = parseQuickAdd('Call vendor tomorrow', NOTES)!;
    expect(r.dueDate?.slice(0, 10)).toBe('2026-05-01');
    expect(r.title).toBe('Call vendor');
  });

  it('parses weekday name (forward only)', () => {
    // Today is Thursday; "mon" → next Monday (May 4).
    const r = parseQuickAdd('Email team mon', NOTES)!;
    expect(r.dueDate?.slice(0, 10)).toBe('2026-05-04');
  });

  it('parses MM/DD', () => {
    const r = parseQuickAdd('Submit form 5/15', NOTES)!;
    expect(r.dueDate?.slice(0, 10)).toBe('2026-05-15');
  });

  it('parses #note slug', () => {
    const r = parseQuickAdd('Reply #meeting-notes', NOTES)!;
    expect(r.sourceNoteId).toBe(1);
    expect(r.title).toBe('Reply');
  });

  it('strips all tokens from title', () => {
    const r = parseQuickAdd('Send Q2 report !h fri #meeting-notes', NOTES)!;
    expect(r.title).toBe('Send Q2 report');
    expect(r.priority).toBe('high');
    expect(r.dueDate?.slice(0, 10)).toBe('2026-05-01');
    expect(r.sourceNoteId).toBe(1);
  });

  it('multiple priorities: last wins', () => {
    expect(parseQuickAdd('!l !h test', NOTES)!.priority).toBe('high');
  });

  it('empty input returns null', () => {
    expect(parseQuickAdd('   ', NOTES)).toBeNull();
  });

  it('unknown #slug → no source note, slug is preserved in title (so user notices)', () => {
    const r = parseQuickAdd('foo #nonexistent', NOTES)!;
    expect(r.sourceNoteId).toBeNull();
    expect(r.title).toBe('foo #nonexistent');
  });
});
