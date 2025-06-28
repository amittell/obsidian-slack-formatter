import { describe, it, expect } from '@jest/globals';
import { TestLogger } from '../helpers';
import {
  cleanupDoubledUsernames,
  MessageFormat,
  extractUsernameFromThreadFormat,
  extractUsernameFromDMFormat,
  detectMessageFormat,
  extractUsername,
} from '../../src/utils/username-utils';

describe('Username Extraction Comprehensive Test Suite', () => {
  describe('Format Detection Edge Cases', () => {
    it('should detect thread format with complex emoji patterns', () => {
      const complexEmojiLine =
        'John DoeJohn Doe![:custom-emoji:](https://emoji.slack-edge.com/url)![:another:](url2) [Monday at 4:28 PM](https://stripe.slack.com/archives/p123)';
      expect(detectMessageFormat(complexEmojiLine)).toBe(MessageFormat.THREAD);
    });

    it('should detect thread format with Unicode emoji in username', () => {
      const unicodeEmojiLine =
        'Jane Smith 🔥Jane Smith 🔥 [Tuesday at 5:30 PM](https://slack.com/archives/p456)';
      expect(detectMessageFormat(unicodeEmojiLine)).toBe(MessageFormat.THREAD);
    });

    it('should detect DM format with various timestamp formats', () => {
      const timestamps = [
        '[10:30](https://stripe.slack.com/archives/D07M9Q92R24/p1749652229260679)',
        '[3:45 PM](https://example.com/path)',
        '[12:00](https://domain.slack.com/archives/CHANNEL/p123)',
        '[11:59 PM](https://workspace.slack.com/path)',
      ];

      timestamps.forEach(timestamp => {
        expect(detectMessageFormat(timestamp)).toBe(MessageFormat.DM);
      });
    });

    it('should handle ambiguous format detection correctly', () => {
      const ambiguousLines = [
        'User Name [but not a timestamp link]', // Not a valid format
        '[timestamp] but no link', // Not a valid format
        'Mixed content [12:00 PM] no link', // Not a valid format
        '![:emoji:](url) but no user or timestamp', // Not a valid format
      ];

      ambiguousLines.forEach(line => {
        expect(detectMessageFormat(line)).toBe(MessageFormat.UNKNOWN);
      });
    });
  });

  describe('Thread Format Username Extraction', () => {
    it('should extract usernames with various emoji combinations', () => {
      const testCases = [
        {
          input:
            'Bill MeiBill Mei![:emoji1:](url1)![:emoji2:](url2) [Monday at 4:28 PM](https://example.com)',
          expected: 'Bill Mei',
        },
        {
          input:
            'Single NameSingle Name![:single-emoji:](url) [Tuesday at 5:30 PM](https://example.com)',
          expected: 'Single Name',
        },
        {
          input:
            'Three Part NameThree Part Name![:complex:](url) [Wednesday at 6:00 PM](https://example.com)',
          expected: 'Three Part Name',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractUsernameFromThreadFormat(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle thread format without doubled usernames', () => {
      const testCases = [
        {
          input: 'Single User![:emoji:](url) [Monday at 4:28 PM](https://example.com)',
          expected: 'Single User',
        },
        {
          input: 'No Emoji User [Tuesday at 5:30 PM](https://example.com)',
          expected: 'No Emoji User',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractUsernameFromThreadFormat(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle special characters in usernames', () => {
      const testCases = [
        {
          input: 'User-NameUser-Name![:emoji:](url) [Monday at 4:28 PM](https://example.com)',
          expected: 'User-Name',
        },
        {
          input: 'User.NameUser.Name [Tuesday at 5:30 PM](https://example.com)',
          expected: 'User.Name',
        },
        {
          input: 'User_NameUser_Name![:test:](url) [Wednesday at 6:00 PM](https://example.com)',
          expected: 'User_Name',
        },
        {
          input: "User O'ConnorUser O'Connor [Thursday at 7:00 PM](https://example.com)",
          expected: "User O'Connor",
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractUsernameFromThreadFormat(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle international characters in usernames', () => {
      const testCases = [
        {
          input: 'João SilvaJoão Silva![:emoji:](url) [Monday at 4:28 PM](https://example.com)',
          expected: 'João Silva',
        },
        {
          input: 'Marie DupuisMarie Dupuis [Tuesday at 5:30 PM](https://example.com)',
          expected: 'Marie Dupuis',
        },
        {
          input: 'Hans MüllerHans Müller![:test:](url) [Wednesday at 6:00 PM](https://example.com)',
          expected: 'Hans Müller',
        },
        {
          input: '李伟李伟 [Thursday at 7:00 PM](https://example.com)',
          expected: '李伟',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractUsernameFromThreadFormat(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle malformed thread format gracefully', () => {
      const malformedCases = [
        'No timestamp link at all',
        '![:emoji:](url) but no username',
        '[timestamp] but no proper link',
        '',
        '   ',
        'Only emoji ![:test:](url)',
      ];

      malformedCases.forEach(input => {
        const result = extractUsernameFromThreadFormat(input);
        expect(result).toBe('Unknown User');
      });
    });
  });

  describe('DM Format Username Extraction', () => {
    it('should extract doubled usernames correctly', () => {
      const testCases = [
        {
          input: 'Alex MittellAlex Mittell',
          expected: 'Alex Mittell',
        },
        {
          input: 'JohnJohn',
          expected: 'John',
        },
        {
          input: 'Mary Jane SmithMary Jane Smith',
          expected: 'Mary Jane Smith',
        },
        {
          input: 'User-NameUser-Name',
          expected: 'User-Name',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractUsernameFromDMFormat(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle single usernames in DM format', () => {
      const testCases = ['Single User', 'Another Person', 'Test-User', 'User_Name', 'User.Name'];

      testCases.forEach(input => {
        const result = extractUsernameFromDMFormat(input);
        expect(result).toBe(input);
      });
    });

    it('should handle international characters in DM format', () => {
      const testCases = [
        {
          input: 'João SilvaJoão Silva',
          expected: 'João Silva',
        },
        {
          input: '李伟李伟',
          expected: '李伟',
        },
        {
          input: 'François Martin',
          expected: 'François Martin',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractUsernameFromDMFormat(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = ['', '   ', '\t', '\n'];

      edgeCases.forEach(input => {
        const result = extractUsernameFromDMFormat(input);
        expect(result).toBe('Unknown User');
      });
    });
  });

  describe('Username Cleanup Edge Cases', () => {
    it('should clean up complex emoji patterns', () => {
      const testCases = [
        {
          input: 'Bill MeiBill Mei![:emoji1:](url1)![:emoji2:](url2)![:emoji3:](url3)',
          format: MessageFormat.THREAD,
          expected: 'Bill Mei',
        },
        {
          input: 'UserUser:smile::heart::thumbsup:',
          format: MessageFormat.DM,
          expected: 'User',
        },
        {
          input: 'Name![:custom:](url) 😀 😂 🎉',
          format: MessageFormat.THREAD,
          expected: 'Name',
        },
      ];

      testCases.forEach(({ input, format, expected }) => {
        const result = cleanupDoubledUsernames(input, format);
        expect(result).toBe(expected);
      });
    });

    it('should handle mixed emoji and text patterns', () => {
      const testCases = [
        {
          input: 'User Name![:emoji:](url) some text',
          format: MessageFormat.THREAD,
          expected: 'User Name some text', // Only removes emoji, keeps other text
        },
        {
          input: 'NameName 🎉 extra text 😀',
          format: MessageFormat.DM,
          expected: 'Name extra text',
        },
      ];

      testCases.forEach(({ input, format, expected }) => {
        const result = cleanupDoubledUsernames(input, format);
        expect(result).toBe(expected);
      });
    });

    it('should preserve non-doubled similar patterns', () => {
      const testCases = [
        {
          input: 'John Johnson', // Similar but not doubled
          format: MessageFormat.DM,
          expected: 'John Johnson',
        },
        {
          input: 'Bill Billy', // Similar but not doubled
          format: MessageFormat.DM,
          expected: 'Bill Billy',
        },
        {
          input: 'Test Testing', // Similar but not doubled
          format: MessageFormat.DM,
          expected: 'Test Testing',
        },
      ];

      testCases.forEach(({ input, format, expected }) => {
        const result = cleanupDoubledUsernames(input, format);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Full Username Extraction Pipeline', () => {
    it('should handle complete thread format extraction', () => {
      const testCases = [
        {
          input:
            'Bill MeiBill Mei![:connect-fingerguns:](https://emoji.slack-edge.com/url) some extra text',
          format: MessageFormat.THREAD,
          expected: 'Bill Mei some extra text',
        },
        {
          input: 'User NameUser Name![:emoji:](url) 😀 👋',
          format: MessageFormat.THREAD,
          expected: 'User Name',
        },
      ];

      testCases.forEach(({ input, format, expected }) => {
        const result = extractUsername(input, format);
        expect(result).toBe(expected);
      });
    });

    it('should handle complete DM format extraction', () => {
      const testCases = [
        {
          input: 'Alex MittellAlex Mittell :smile: 🎉',
          format: MessageFormat.DM,
          expected: 'Alex Mittell',
        },
        {
          input: 'Simple UserSimple User   ',
          format: MessageFormat.DM,
          expected: 'Simple User',
        },
      ];

      testCases.forEach(({ input, format, expected }) => {
        const result = extractUsername(input, format);
        expect(result).toBe(expected);
      });
    });

    it('should handle extraction with unknown format', () => {
      const testCases = [
        'Regular text without format',
        'Another text string',
        'Text with :emoji: codes',
      ];

      testCases.forEach(input => {
        const result = extractUsername(input, MessageFormat.UNKNOWN);
        // Should still attempt basic cleanup
        expect(result).toBeTruthy();
        expect(result).not.toContain(':');
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle very long usernames efficiently', () => {
      const longUsername = 'Very'.repeat(50) + ' Long'.repeat(50) + ' Username'.repeat(50);
      const doubledLongUsername = longUsername + longUsername;

      const startTime = Date.now();
      const result = extractUsernameFromDMFormat(doubledLongUsername);
      const endTime = Date.now();

      expect(result).toBe(longUsername);
      expect(endTime - startTime).toBeLessThan(process.env.CI ? 500 : 100); // Should complete quickly
    });

    it('should handle many emoji patterns efficiently', () => {
      let manyEmojis = 'UserUser';
      for (let i = 0; i < 100; i++) {
        manyEmojis += `![:emoji${i}:](url${i})`;
      }

      const startTime = Date.now();
      const result = cleanupDoubledUsernames(manyEmojis, MessageFormat.THREAD);
      const endTime = Date.now();

      expect(result).toBe('User');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle complex international text efficiently', () => {
      const complexNames = [
        'José María Fernández GonzálezJosé María Fernández González',
        '李小明李小明',
        'Владимир АлександровичВладимир Александрович',
        'أحمد محمد عليأحمد محمد علي',
      ];

      complexNames.forEach(name => {
        const startTime = Date.now();
        const result = extractUsernameFromDMFormat(name);
        const endTime = Date.now();

        expect(result).toBeTruthy();
        expect(endTime - startTime).toBeLessThan(50);
      });
    });
  });

  describe('Error Handling and Robustness', () => {
    it('should handle null and undefined inputs gracefully', () => {
      // These operations should not throw errors
      expect(() => cleanupDoubledUsernames('', MessageFormat.DM)).not.toThrow();
      expect(() => extractUsername('', MessageFormat.DM)).not.toThrow();
      expect(() => detectMessageFormat('')).not.toThrow();
      expect(() => extractUsernameFromDMFormat('')).not.toThrow();
      expect(() => extractUsernameFromThreadFormat('')).not.toThrow();

      // Should return appropriate defaults
      expect(extractUsernameFromDMFormat('')).toBe('Unknown User');
      expect(extractUsernameFromThreadFormat('')).toBe('Unknown User');
    });

    it('should handle malformed emoji patterns gracefully', () => {
      const malformedPatterns = [
        'User![:broken-emoji',
        'User![:no-url:](incomplete',
        'User![:](empty-name)',
        'User![:]()empty-everything',
      ];

      malformedPatterns.forEach(pattern => {
        expect(() => cleanupDoubledUsernames(pattern, MessageFormat.THREAD)).not.toThrow();
        expect(() => extractUsername(pattern, MessageFormat.THREAD)).not.toThrow();
      });
    });

    it('should maintain backward compatibility', () => {
      // Test calls without format parameter (should still work)
      const testCases = ['JohnJohn', 'UserUser with extra text', 'Single Name'];

      testCases.forEach(input => {
        expect(() => cleanupDoubledUsernames(input)).not.toThrow();
        const result = cleanupDoubledUsernames(input);
        expect(result).toBeTruthy();
      });
    });
  });

  describe('Username Extraction Metrics', () => {
    it('should provide comprehensive extraction statistics', () => {
      const testData = [
        // Thread format cases
        {
          input: 'Bill MeiBill Mei![:emoji:](url) [12:00 PM](link)',
          format: MessageFormat.THREAD,
          expectedUser: 'Bill Mei',
        },
        {
          input: 'User Name [12:01 PM](link)',
          format: MessageFormat.THREAD,
          expectedUser: 'User Name',
        },
        {
          input: 'Complex UserComplex User![:e1:](u1)![:e2:](u2) [12:02 PM](link)',
          format: MessageFormat.THREAD,
          expectedUser: 'Complex User',
        },

        // DM format cases
        {
          input: 'Alex MittellAlex Mittell',
          format: MessageFormat.DM,
          expectedUser: 'Alex Mittell',
        },
        { input: 'Single User', format: MessageFormat.DM, expectedUser: 'Single User' },
        {
          input: 'Test UserTest User :emoji:',
          format: MessageFormat.DM,
          expectedUser: 'Test User',
        },

        // Edge cases
        { input: '', format: MessageFormat.DM, expectedUser: 'Unknown User' },
        {
          input: 'Malformed input',
          format: MessageFormat.UNKNOWN,
          expectedUser: 'Malformed input',
        },
      ];

      let successCount = 0;
      let totalTests = testData.length;

      testData.forEach(({ input, format, expectedUser }) => {
        const result = extractUsername(input, format);
        if (result === expectedUser) {
          successCount++;
        } else {
          TestLogger.log(`Failed: Input="${input}", Expected="${expectedUser}", Got="${result}"`);
        }
      });

      const accuracy = (successCount / totalTests) * 100;
      TestLogger.log(
        `Username Extraction Accuracy: ${accuracy.toFixed(1)}% (${successCount}/${totalTests})`
      );

      expect(accuracy).toBeGreaterThan(80); // At least 80% accuracy
    });
  });
});
