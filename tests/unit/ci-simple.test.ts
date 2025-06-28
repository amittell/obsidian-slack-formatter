import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('CI Simple Test', () => {
  it('should format basic slack content without errors', () => {
    const userMap = {};
    const emojiMap = {};
    const formatter = new SlackFormatter(DEFAULT_SETTINGS, userMap, emojiMap);

    const simpleContent = `User1  [12:00 PM](https://example.com/p1)
This is a test message`;

    const result = formatter.formatSlackContent(simpleContent);

    // Basic validation
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('User1');
    expect(result).toContain('test message');
  });

  it('should handle empty content gracefully', () => {
    const userMap = {};
    const emojiMap = {};
    const formatter = new SlackFormatter(DEFAULT_SETTINGS, userMap, emojiMap);

    const result = formatter.formatSlackContent('');

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});
