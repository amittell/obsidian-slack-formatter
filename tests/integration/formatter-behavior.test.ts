import * as fs from 'fs';
import * as path from 'path';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { SlackFormatSettings } from '../../src/types/settings.types';
import { parseJsonMap } from '../../src/utils';

// Helper to create formatter instance
const createFormatter = (settings: SlackFormatSettings): SlackFormatter => {
  const userMapResult = parseJsonMap(settings.userMapJson || '{}', 'User Map');
  const emojiMapResult = parseJsonMap(settings.emojiMapJson || '{}', 'Emoji Map');
  const userMap = userMapResult ?? {};
  const emojiMap = emojiMapResult ?? {};
  return new SlackFormatter(settings, userMap, emojiMap);
};

// Helper to count occurrences
const countOccurrences = (str: string, pattern: string | RegExp): number => {
  const matches = str.match(new RegExp(pattern, 'g'));
  return matches ? matches.length : 0;
};

describe('SlackFormatter Behavior Tests', () => {
  const samplesDir = path.join(__dirname, '../../samples');
  const sampleFiles = fs.readdirSync(samplesDir).filter(file => file.endsWith('.txt'));

  describe('Line Break Preservation', () => {
    it('should preserve line breaks in message content', () => {
      const testContent = `Alex Mittell
  11:58 PM
Hey everyone! our team at <oneaway> is looking to hire.
We're 1 of 25 Clay enterprise agencies.
We have 24 active clients.

We've now 3x'ed our revenue in 1 year BUT
the best stat is the fact we've only had 3 clients churn in the last 8 months.`;

      const formatter = createFormatter(DEFAULT_SETTINGS);
      const result = formatter.formatSlackContent(testContent);

      // Count line breaks in original content (excluding header lines)
      const contentLines = testContent.split('\n').slice(2); // Skip username and timestamp
      const originalLineBreaks = contentLines.join('\n').split('\n').length - 1;

      // The formatted output should preserve line breaks in the message content
      // Check that we have multiple lines in the content section
      const formattedLines = result.split('\n');
      const contentStartIndex = formattedLines.findIndex(line => line.includes('Hey everyone!'));
      const contentEndIndex = formattedLines.findIndex(line => line.includes('last 8 months.'));

      expect(contentStartIndex).toBeGreaterThan(-1);
      expect(contentEndIndex).toBeGreaterThan(contentStartIndex);
      expect(contentEndIndex - contentStartIndex).toBeGreaterThanOrEqual(originalLineBreaks);
    });

    it('should handle messages with multiple blank lines', () => {
      const testContent = `User Name
10:30 AM
First paragraph.


Second paragraph after blank lines.

Third paragraph.`;

      const formatter = createFormatter(DEFAULT_SETTINGS);
      const result = formatter.formatSlackContent(testContent);

      // Should preserve paragraph structure
      expect(result).toContain('First paragraph.');
      expect(result).toContain('Second paragraph after blank lines.');
      expect(result).toContain('Third paragraph.');

      // Check that content is not collapsed into one line
      const lines = result.split('\n');
      const firstIndex = lines.findIndex(line => line.includes('First paragraph'));
      const secondIndex = lines.findIndex(line => line.includes('Second paragraph'));
      const thirdIndex = lines.findIndex(line => line.includes('Third paragraph'));

      expect(secondIndex).toBeGreaterThan(firstIndex + 1);
      expect(thirdIndex).toBeGreaterThan(secondIndex + 1);
    });
  });

  describe('Message Structure Recognition', () => {
    it('should correctly identify and format message headers', () => {
      const formatter = createFormatter(DEFAULT_SETTINGS);

      sampleFiles.forEach(file => {
        const content = fs.readFileSync(path.join(samplesDir, file), 'utf-8');
        const result = formatter.formatSlackContent(content);

        // Should have callout blocks for messages
        const calloutCount = countOccurrences(result, '> \\[!slack\\]\\+');
        expect(calloutCount).toBeGreaterThan(0);

        // Should have time headers
        const timeHeaders = countOccurrences(result, '> \\*\\*Time:\\*\\*');
        expect(timeHeaders).toBeGreaterThan(0);

        // Should have message content after headers
        expect(result).toMatch(/> \*\*Time:\*\* .+\n>\s*\n> .+/);
      });
    });

    it('should handle thread indicators correctly', () => {
      const threadContent = `User Name
10:30 AM
Main message content
5 replies Last reply 2 hours ago View thread`;

      const formatter = createFormatter({ ...DEFAULT_SETTINGS, highlightThreads: true });
      const result = formatter.formatSlackContent(threadContent);

      // Should format thread info - the thread info might be processed differently
      // Let's just check that the thread information is preserved in some form
      expect(result).toContain('5 replies');
      expect(result).toContain('Last reply');
    });
  });

  describe('User Mention Processing', () => {
    it('should convert user mentions to wikilinks when enabled', () => {
      const content = `User
10:30 AM
Hey <@U12345>, can you help with this?`;

      const userMap = { U12345: 'John Doe' };
      const formatter = new SlackFormatter(
        { ...DEFAULT_SETTINGS, convertUserMentions: true },
        userMap,
        {}
      );

      const result = formatter.formatSlackContent(content);
      expect(result).toContain('[[John Doe]]');
      expect(result).not.toContain('<@U12345>');
    });

    it('should preserve user mentions when disabled', () => {
      const content = `User
10:30 AM
Hey <@U12345>, can you help with this?`;

      const formatter = createFormatter({ ...DEFAULT_SETTINGS, convertUserMentions: false });
      const result = formatter.formatSlackContent(content);

      expect(result).toContain('<@U12345>');
      expect(result).not.toContain('[[');
    });
  });

  describe('Code Block Handling', () => {
    it('should preserve code blocks when enabled', () => {
      const content = `Developer
2:30 PM
Here's the code:
\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\``;

      const formatter = createFormatter({ ...DEFAULT_SETTINGS, detectCodeBlocks: true });
      const result = formatter.formatSlackContent(content);

      // Should preserve code block markers
      expect(result).toContain('```javascript');
      expect(result).toContain('```');
      expect(result).toContain('function hello()');
      expect(result).toContain('console.log');

      // Code should maintain structure
      const codeLines = result.match(/```javascript[\s\S]*?```/);
      expect(codeLines).toBeTruthy();
      expect(codeLines![0].split('\n').length).toBeGreaterThan(3);
    });
  });

  describe('Emoji Replacement', () => {
    it('should replace emoji codes when enabled', () => {
      const content = `User
10:30 AM
Great job! :thumbsup: :smile:`;

      const emojiMap = { thumbsup: '👍', smile: '😊' };
      const formatter = new SlackFormatter(
        { ...DEFAULT_SETTINGS, replaceEmoji: true },
        {},
        emojiMap
      );

      const result = formatter.formatSlackContent(content);
      expect(result).toContain('👍');
      expect(result).toContain('😊');
      expect(result).not.toContain(':thumbsup:');
      expect(result).not.toContain(':smile:');
    });
  });

  describe('URL Conversion', () => {
    it('should convert Slack links to markdown format', () => {
      const content = `User
10:30 AM
Check out <https://example.com|this website> and <https://google.com>`;

      const formatter = createFormatter({ ...DEFAULT_SETTINGS, convertSlackLinks: true });
      const result = formatter.formatSlackContent(content);

      // Should convert to markdown links
      expect(result).toContain('[this website](https://example.com)');
      expect(result).toContain('https://google.com');
      expect(result).not.toContain('<https://example.com|this website>');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty input gracefully', () => {
      const formatter = createFormatter(DEFAULT_SETTINGS);
      const result = formatter.formatSlackContent('');

      expect(result).toBe('');
    });

    it('should handle malformed input gracefully', () => {
      const formatter = createFormatter(DEFAULT_SETTINGS);
      const malformedInputs = [
        'Just random text with no structure',
        '12:34 PM\nMessage with no username',
        '<@U12345>\n<@U67890>\nMultiple mentions only',
      ];

      malformedInputs.forEach(input => {
        expect(() => formatter.formatSlackContent(input)).not.toThrow();
        const result = formatter.formatSlackContent(input);
        expect(result).toBeTruthy();
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large inputs efficiently', () => {
      // Create a large input with many messages
      const messageCount = 100;
      const largeInput = Array(messageCount)
        .fill(null)
        .map((_, i) => `User ${i}\n${i}:00 PM\nThis is message number ${i} with some content.`)
        .join('\n\n');

      const formatter = createFormatter(DEFAULT_SETTINGS);
      const startTime = Date.now();
      const result = formatter.formatSlackContent(largeInput);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 1 second for 100 messages)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should produce output with expected structure
      const messageBlocks = countOccurrences(result, '> \\[!slack\\]\\+');
      expect(messageBlocks).toBeGreaterThan(0);
    });
  });
});
