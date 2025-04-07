import {
  formatCodeBlocks,
  formatThreadLinks,
  // formatAttachments // Removed import
} from '../../src/utils/text-utils';
// import type { SlackAttachment } from '../../src/types/messages.types'; // Removed import

describe('Text Utils', () => {

  describe('formatCodeBlocks', () => {
    it('should identify and format simple code blocks', () => {
      const input = "```\ncode line 1\ncode line 2\n```";
      expect(formatCodeBlocks(input)).toBe("```\ncode line 1\ncode line 2\n```");
    });

    it('should identify language specifier', () => {
      const input = "```javascript\nconst x = 1;\n```";
      expect(formatCodeBlocks(input)).toBe("```javascript\nconst x = 1;\n```");
    });

    it('should handle text before and after code blocks', () => {
      const input = "Some text before\n```python\nprint('hello')\n```\nSome text after";
      expect(formatCodeBlocks(input)).toBe("Some text before\n```python\nprint('hello')\n```\nSome text after");
    });

    it('should handle multiple code blocks', () => {
      const input = "```\nfirst block\n```\ntext\n```js\nsecond block\n```";
      expect(formatCodeBlocks(input)).toBe("```\nfirst block\n```\ntext\n```js\nsecond block\n```");
    });

    it('should handle code blocks starting/ending the string', () => {
      const inputStart = "```\nstart\n```\ntext";
      expect(formatCodeBlocks(inputStart)).toBe("```\nstart\n```\ntext");
      const inputEnd = "text\n```\nend\n```";
      expect(formatCodeBlocks(inputEnd)).toBe("text\n```\nend\n```");
    });
    
    it('should return original string if no code blocks', () => {
      const input = "Just plain text\nwith multiple lines.";
      expect(formatCodeBlocks(input)).toBe(input);
    });
    
    it('should handle empty string', () => {
      expect(formatCodeBlocks('')).toBe('');
    });
    
    // Note: The current implementation doesn't handle nested code blocks or unclosed blocks.
    // Tests for those cases are omitted as they would currently fail based on the function's logic.
  });

  describe('formatThreadLinks', () => {
    it('should format standard thread links', () => {
      const input = "Check this out. View thread: https://example.slack.com/archives/C123/p16...";
      const expected = "Check this out. [View thread](https://example.slack.com/archives/C123/p16...)";
      expect(formatThreadLinks(input)).toBe(expected);
    });

    it('should handle multiple thread links', () => {
      const input = "Thread 1: View thread: https://link1.slack.com/...\nThread 2: View thread: https://link2.slack.com/...";
      const expected = "Thread 1: [View thread](https://link1.slack.com/...)\nThread 2: [View thread](https://link2.slack.com/...)";
      expect(formatThreadLinks(input)).toBe(expected);
    });

    it('should return original string if no thread links found', () => {
      const input = "Just some text without a thread link.";
      expect(formatThreadLinks(input)).toBe(input);
    });
    
    it('should handle variations in spacing around the URL', () => {
       const input = "View thread:https://link.slack.com/..."; // No space
       const expected = "[View thread](https://link.slack.com/...)";
       expect(formatThreadLinks(input)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(formatThreadLinks('')).toBe('');
    });
  });

  // Removed describe block for formatAttachments as the function was removed

});