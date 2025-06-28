import {
  cleanupDoubledUsernames,
  MessageFormat,
  extractUsernameFromThreadFormat,
  extractUsernameFromDMFormat,
  detectMessageFormat,
  extractUsername,
} from '../../src/utils/username-utils.js';

describe('Format-Aware Username Processing', () => {
  describe('detectMessageFormat', () => {
    it('should detect thread format with emoji and timestamp', () => {
      const line =
        'Bill MeiBill Mei![:connect-fingerguns:](https://slack-imgs.com/url) [Monday at 4:28 PM](https://stripe.slack.com/archives/p123)';
      expect(detectMessageFormat(line)).toBe(MessageFormat.THREAD);
    });

    it('should detect DM format with standalone timestamp', () => {
      const line = '[10:30](https://stripe.slack.com/archives/D07M9Q92R24/p1749652229260679)';
      expect(detectMessageFormat(line)).toBe(MessageFormat.DM);
    });

    it('should detect thread format without emoji but with combined user and timestamp', () => {
      const line =
        'Raghav JhavarRaghav Jhavar [Monday at 4:30 PM](https://stripe.slack.com/archives/p123)';
      expect(detectMessageFormat(line)).toBe(MessageFormat.THREAD);
    });

    it('should return UNKNOWN for unrecognized patterns', () => {
      const line = 'Just some random text without format';
      expect(detectMessageFormat(line)).toBe(MessageFormat.UNKNOWN);
    });
  });

  describe('cleanupDoubledUsernames with format awareness', () => {
    it('should clean thread format doubled usernames with emoji', () => {
      const input = 'Bill MeiBill Mei![:connect-fingerguns:](url)';
      const result = cleanupDoubledUsernames(input, MessageFormat.THREAD);
      expect(result).toBe('Bill Mei');
    });

    it('should clean DM format doubled usernames', () => {
      const input = 'Alex MittellAlex Mittell';
      const result = cleanupDoubledUsernames(input, MessageFormat.DM);
      expect(result).toBe('Alex Mittell');
    });

    it('should handle simple doubled names', () => {
      const input = 'JohnJohn';
      const result = cleanupDoubledUsernames(input, MessageFormat.DM);
      expect(result).toBe('John');
    });

    it('should handle spaced doubled names', () => {
      const input = 'John Smith John Smith';
      const result = cleanupDoubledUsernames(input, MessageFormat.DM);
      expect(result).toBe('John Smith');
    });

    it('should leave non-doubled names unchanged', () => {
      const input = 'John Smith';
      const result = cleanupDoubledUsernames(input, MessageFormat.DM);
      expect(result).toBe('John Smith');
    });

    it('should handle thread format with emoji but no doubling', () => {
      const input = 'John Doe![:smile:](url)';
      const result = cleanupDoubledUsernames(input, MessageFormat.THREAD);
      expect(result).toBe('John Doe');
    });
  });

  describe('extractUsernameFromThreadFormat', () => {
    it('should extract username from thread format line', () => {
      const line =
        'Bill MeiBill Mei![:connect-fingerguns:](url) [Monday at 4:28 PM](https://stripe.slack.com/archives/p123)';
      const result = extractUsernameFromThreadFormat(line);
      expect(result).toBe('Bill Mei');
    });

    it('should handle thread format without doubled username', () => {
      const line =
        'John Doe![:smile:](url) [Monday at 4:28 PM](https://stripe.slack.com/archives/p123)';
      const result = extractUsernameFromThreadFormat(line);
      expect(result).toBe('John Doe');
    });

    it('should handle thread format without emoji', () => {
      const line = 'Raghav Jhavar [Monday at 4:30 PM](https://stripe.slack.com/archives/p123)';
      const result = extractUsernameFromThreadFormat(line);
      expect(result).toBe('Raghav Jhavar');
    });

    it('should return Unknown User for malformed input', () => {
      const line = 'Invalid format without timestamp link';
      const result = extractUsernameFromThreadFormat(line);
      expect(result).toBe('Unknown User');
    });
  });

  describe('extractUsernameFromDMFormat', () => {
    it('should extract doubled username from DM format', () => {
      const line = 'Alex MittellAlex Mittell';
      const result = extractUsernameFromDMFormat(line);
      expect(result).toBe('Alex Mittell');
    });

    it('should handle single username in DM format', () => {
      const line = 'John Doe';
      const result = extractUsernameFromDMFormat(line);
      expect(result).toBe('John Doe');
    });

    it('should handle empty input', () => {
      const line = '';
      const result = extractUsernameFromDMFormat(line);
      expect(result).toBe('Unknown User');
    });
  });

  describe('extractUsername with format awareness', () => {
    it('should extract thread format username with emoji', () => {
      const input = 'Bill MeiBill Mei![:connect-fingerguns:](url)';
      const result = extractUsername(input, MessageFormat.THREAD);
      expect(result).toBe('Bill Mei');
    });

    it('should extract DM format doubled username', () => {
      const input = 'Alex MittellAlex Mittell';
      const result = extractUsername(input, MessageFormat.DM);
      expect(result).toBe('Alex Mittell');
    });

    it('should remove emoji codes and Unicode emoji', () => {
      const input = 'John Doe :smile: 👋';
      const result = extractUsername(input, MessageFormat.DM);
      expect(result).toBe('John Doe');
    });

    it('should remove trailing punctuation', () => {
      const input = 'John Doe!!!';
      const result = extractUsername(input, MessageFormat.DM);
      expect(result).toBe('John Doe');
    });

    it('should clean up extra spaces', () => {
      const input = '  John   Doe  ';
      const result = extractUsername(input, MessageFormat.DM);
      expect(result).toBe('John Doe');
    });

    it('should return Unknown User for empty result', () => {
      const input = ':smile: 👋 !!!';
      const result = extractUsername(input, MessageFormat.DM);
      expect(result).toBe('Unknown User');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed emoji patterns', () => {
      const input = 'Bill Mei![:broken-emoji';
      const result = cleanupDoubledUsernames(input, MessageFormat.THREAD);
      expect(result).toBe('Bill Mei![:broken-emoji');
    });

    it('should handle null or undefined input gracefully', () => {
      // These should not throw errors
      expect(() => cleanupDoubledUsernames('', MessageFormat.DM)).not.toThrow();
      expect(() => extractUsername('', MessageFormat.DM)).not.toThrow();
    });

    it('should maintain backward compatibility without format parameter', () => {
      const input = 'John DoeJohn Doe';
      const result = cleanupDoubledUsernames(input);
      expect(result).toBe('John Doe');
    });
  });
});
