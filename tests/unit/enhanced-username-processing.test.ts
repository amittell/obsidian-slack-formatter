import { describe, it, expect } from '@jest/globals';
import {
  extractUsername,
  normalizeUsername,
  isValidUsername,
  isAppMessage,
  extractAppUsername,
  removeAllDecorations,
  detectMessageFormat,
  MessageFormat,
  USERNAME_CONFIG,
  APP_MESSAGE_PATTERNS,
} from '../../src/utils/username-utils.js';

describe('Enhanced Username Processing', () => {
  describe('App Message Detection and Extraction', () => {
    it('should detect app messages with URL prefix', () => {
      const appLine = ' (https://app.slack.com/services/B071TQU3SAH)Clay';
      expect(isAppMessage(appLine)).toBe(true);
    });

    it('should detect app messages without parentheses', () => {
      const appLine = 'https://app.slack.com/services/B123 GitHub';
      expect(isAppMessage(appLine)).toBe(true);
    });

    it('should extract app usernames correctly', () => {
      const testCases = [
        { input: ' (https://app.slack.com/services/B071TQU3SAH)Clay', expected: 'Clay' },
        { input: '(https://app.slack.com/services/B123)GitHub App', expected: 'GitHub App' },
        { input: 'https://slack.com/services/B456 Zapier', expected: 'Zapier' },
        { input: 'ClayClayAPP', expected: 'Clay' }, // Doubled app name
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractAppUsername(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle app message format in extractUsername', () => {
      const appLine = ' (https://app.slack.com/services/B071TQU3SAH)Clay';
      const result = extractUsername(appLine, MessageFormat.APP);
      expect(result).toBe('Clay');
    });
  });

  describe('Username Validation', () => {
    it('should validate proper usernames', () => {
      const validUsernames = [
        'John Doe',
        'Alice',
        'Bob Smith Jr',
        'María García',
        'John123',
        'Alex-Johnson',
      ];

      validUsernames.forEach(username => {
        expect(isValidUsername(username)).toBe(true);
      });
    });

    it('should reject invalid usernames', () => {
      const invalidUsernames = [
        '', // Empty
        'unknown user', // Invalid name
        'bot', // Invalid name
        '123', // All numbers
        '!!!', // No letters
        '10:30', // Time pattern
        'A'.repeat(USERNAME_CONFIG.MAX_LENGTH + 1), // Too long
        'Word '.repeat(USERNAME_CONFIG.MAX_WORDS + 1).trim(), // Too many words
      ];

      invalidUsernames.forEach(username => {
        expect(isValidUsername(username)).toBe(false);
      });
    });

    it('should handle edge cases in validation', () => {
      expect(isValidUsername('Monday')).toBe(false); // Day name
      expect(isValidUsername('Jan')).toBe(false); // Month name
      expect(isValidUsername('Unknown')).toBe(false); // Invalid name
    });
  });

  describe('Username Normalization', () => {
    it('should normalize usernames correctly', () => {
      const testCases = [
        { input: '  John Doe  ', expected: 'John Doe' },
        { input: '!!!Alice!!!', expected: 'Alice' },
        { input: 'Bob@#$%Smith', expected: 'Bob Smith' }, // Special chars become spaces
        { input: 'Jane   Multiple   Spaces', expected: 'Jane Multiple Spaces' },
        { input: 'A'.repeat(150), expected: 'A'.repeat(150) },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = normalizeUsername(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle empty and invalid inputs', () => {
      expect(normalizeUsername('')).toBe('');
      expect(normalizeUsername(null as any)).toBe('');
      expect(normalizeUsername(undefined as any)).toBe('');
    });
  });

  describe('Decoration Removal', () => {
    it('should remove all types of decorations', () => {
      const testCases = [
        { input: 'John :smile: Doe', expected: 'John Doe' },
        { input: 'Alice![:custom-emoji:](url)', expected: 'Alice' },
        { input: 'Bob 👋 Smith', expected: 'Bob Smith' },
        { input: 'Jane [link](https://example.com)', expected: 'Jane' },
        { input: 'Tom APP Smith', expected: 'Tom Smith' },
        { input: 'User <tag> Name', expected: 'User tag Name' },
        { input: 'Final!!!', expected: 'Final' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = removeAllDecorations(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle complex emoji patterns', () => {
      const input = 'John :+1::skin-tone-2: Doe![:custom:](url) 👍';
      const result = removeAllDecorations(input);
      expect(result).toBe('John Doe');
    });
  });

  describe('Enhanced Format Detection', () => {
    it('should detect app message format', () => {
      const appLine = ' (https://app.slack.com/services/B071TQU3SAH)Clay';
      expect(detectMessageFormat(appLine)).toBe(MessageFormat.APP);
    });

    it('should detect thread format with emoji', () => {
      const threadLine =
        'Bill MeiBill Mei![:connect-fingerguns:](url) [Monday at 4:28 PM](https://example.com)';
      expect(detectMessageFormat(threadLine)).toBe(MessageFormat.THREAD);
    });

    it('should detect DM format with standalone timestamp', () => {
      const dmLine = '[10:30](https://example.slack.com/archives/D123/p456)';
      expect(detectMessageFormat(dmLine)).toBe(MessageFormat.DM);
    });

    it('should return UNKNOWN for unrecognized patterns', () => {
      const unknownLine = 'Just some regular text without special patterns';
      expect(detectMessageFormat(unknownLine)).toBe(MessageFormat.UNKNOWN);
    });
  });

  describe('Comprehensive Username Extraction', () => {
    it('should extract usernames from various formats', () => {
      const testCases = [
        {
          input: 'Bill MeiBill Mei![:emoji:](url)',
          format: MessageFormat.THREAD,
          expected: 'Bill Mei',
        },
        {
          input: 'Alex MittellAlex Mittell',
          format: MessageFormat.DM,
          expected: 'Alex Mittell',
        },
        {
          input: ' (https://app.slack.com/services/B123)GitHub',
          format: MessageFormat.APP,
          expected: 'GitHub',
        },
        {
          input: 'John Doe :smile: 👋 !!!',
          format: undefined,
          expected: 'John Doe',
        },
      ];

      testCases.forEach(({ input, format, expected }) => {
        const result = extractUsername(input, format);
        expect(result).toBe(expected);
      });
    });

    it('should return Unknown User for invalid extractions', () => {
      const invalidCases = ['', ':smile: :wave:', '123456', 'unknown user', '!!@#$%'];

      invalidCases.forEach(input => {
        const result = extractUsername(input);
        expect(result).toBe('Unknown User');
      });
    });

    it('should handle edge cases gracefully', () => {
      expect(extractUsername(null as any)).toBe('Unknown User');
      expect(extractUsername(undefined as any)).toBe('Unknown User');
      expect(extractUsername('   ')).toBe('Unknown User');
    });
  });

  describe('Fallback Strategy', () => {
    it('should handle malformed patterns without crashing', () => {
      const malformedInputs = [
        'Bill Mei![:broken-emoji',
        '(https://incomplete-url',
        'UserUser[invalid-timestamp',
        'Text with\n\ninvalid newlines',
      ];

      malformedInputs.forEach(input => {
        expect(() => extractUsername(input)).not.toThrow();
        expect(() => isAppMessage(input)).not.toThrow();
        expect(() => normalizeUsername(input)).not.toThrow();
      });
    });

    it('should provide intelligent fallbacks for app messages', () => {
      // Test cases where app detection might fail but we still get reasonable results
      const fallbackCases = [
        { input: 'GitHub malformed pattern', expected: 'GitHub malformed pattern' },
        { input: 'Valid Username', expected: 'Valid Username' },
      ];

      fallbackCases.forEach(({ input, expected }) => {
        const result = extractUsername(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should have proper configuration constants', () => {
      expect(USERNAME_CONFIG.MIN_LENGTH).toBeGreaterThan(0);
      expect(USERNAME_CONFIG.MAX_LENGTH).toBeGreaterThan(USERNAME_CONFIG.MIN_LENGTH);
      expect(USERNAME_CONFIG.MAX_WORDS).toBeGreaterThan(0);
      expect(USERNAME_CONFIG.INVALID_NAMES.size).toBeGreaterThan(0);
    });

    it('should have working app message patterns', () => {
      expect(APP_MESSAGE_PATTERNS.URL_PREFIX).toBeInstanceOf(RegExp);
      expect(APP_MESSAGE_PATTERNS.NO_PARENS).toBeInstanceOf(RegExp);
      expect(APP_MESSAGE_PATTERNS.SERVICES_URL).toBeInstanceOf(RegExp);
      expect(APP_MESSAGE_PATTERNS.DOUBLED_APP).toBeInstanceOf(RegExp);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle large inputs efficiently', () => {
      const largeInput = 'A'.repeat(1000) + ' User Name ' + 'B'.repeat(1000);

      const start = Date.now();
      const result = extractUsername(largeInput);
      const end = Date.now();

      expect(end - start).toBeLessThan(process.env.CI ? 500 : 100); // Should complete in under 100ms (500ms in CI)
      // Large input gets truncated to max length, so we just verify it's processed
      expect(result.length).toBeLessThanOrEqual(USERNAME_CONFIG.MAX_LENGTH);
    });

    it('should be consistent across multiple calls', () => {
      const input = 'Bill MeiBill Mei![:emoji:](url)';
      const firstResult = extractUsername(input, MessageFormat.THREAD);

      // Call multiple times
      for (let i = 0; i < 10; i++) {
        const result = extractUsername(input, MessageFormat.THREAD);
        expect(result).toBe(firstResult);
      }
    });
  });
});
