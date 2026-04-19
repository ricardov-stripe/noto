import { describe, it, expect } from 'vitest';
import { parseExtractionResponse, buildExtractionPrompt } from '../extraction';

describe('extraction', () => {
  describe('buildExtractionPrompt', () => {
    it('includes the note content and today date', () => {
      const prompt = buildExtractionPrompt('Meeting with Sarah about Q2 report', 'Meeting Notes', []);
      expect(prompt).toContain('Meeting with Sarah about Q2 report');
      expect(prompt).toContain('Meeting Notes');
      expect(prompt).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('includes existing tasks to avoid duplicates', () => {
      const prompt = buildExtractionPrompt('content', 'title', ['Send report']);
      expect(prompt).toContain('Send report');
    });
  });

  describe('parseExtractionResponse', () => {
    it('parses valid JSON response', () => {
      const raw = JSON.stringify({
        tasks: [
          { title: 'Send report', priority: 'high', suggestedDueDate: '2026-04-21', sourceText: 'send the report', reasoning: 'deadline' }
        ]
      });
      const result = parseExtractionResponse(raw);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Send report');
    });

    it('returns empty array for invalid JSON', () => {
      expect(parseExtractionResponse('not json')).toEqual([]);
    });

    it('returns empty array when tasks field is missing', () => {
      expect(parseExtractionResponse('{}')).toEqual([]);
    });

    it('filters out tasks with missing required fields', () => {
      const raw = JSON.stringify({
        tasks: [
          { title: 'Good task', priority: 'low', suggestedDueDate: null, sourceText: 'text', reasoning: 'reason' },
          { priority: 'high' },
        ]
      });
      const result = parseExtractionResponse(raw);
      expect(result).toHaveLength(1);
    });
  });
});
