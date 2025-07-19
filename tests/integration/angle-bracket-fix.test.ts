import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('Angle Bracket Fix - Real World Example', () => {
  it("should escape <oneaway> in Alex's message to prevent it from disappearing in Obsidian", () => {
    const alexMessage = `Alex Mittell
11:58 PM
Hey everyone! our team at <oneaway> is looking to hire.
We're 1 of 25 Clay enterprise agencies.
We have 24 active clients.

We've now 3x'ed our revenue in 1 year BUT
the best stat is the fact we've only had 3 clients churn in the last 8 months.`;

    const formatter = new SlackFormatter(DEFAULT_SETTINGS, {}, {});
    const result = formatter.formatSlackContent(alexMessage);

    // The formatted output should contain escaped angle brackets
    expect(result).toContain('&lt;oneaway&gt;');
    expect(result).not.toContain('<oneaway>');

    // Verify it's in a callout block
    expect(result).toContain('> [!slack]+ Message from Alex Mittell');
    expect(result).toContain('> **Time:** 11:58 PM');

    // Verify the message content is preserved with proper formatting
    expect(result).toContain('> Hey everyone! our team at &lt;oneaway&gt; is looking to hire.');
    expect(result).toContain("> We're 1 of 25 Clay enterprise agencies.");
    expect(result).toContain('> We have 24 active clients.');

    // Verify line breaks are preserved (should have multiple lines)
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(5); // More flexible assertion
  });

  it('should handle mixed content with both escapable and non-escapable angle brackets', () => {
    const mixedContent = `Developer
2:30 PM
Check out <https://example.com|our website> for <product> info.
Contact <@U12345> or visit <docs>.
The <#C12345|general> channel has more <details>.`;

    const formatter = new SlackFormatter(DEFAULT_SETTINGS, { U12345: 'John Doe' }, {});
    const result = formatter.formatSlackContent(mixedContent);

    // Verify angle brackets are escaped for non-Slack content
    expect(result).toContain('&lt;product&gt;');
    expect(result).toContain('&lt;docs&gt;');
    expect(result).toContain('&lt;details&gt;');

    // Verify Slack syntax is processed correctly
    expect(result).toContain('[our website](https://example.com)');
    expect(result).toContain('[[John Doe]]');
    expect(result).toContain('<#C12345|general>'); // Channel mentions are preserved
  });

  it('should not break existing functionality while fixing angle brackets', () => {
    const complexMessage = `Team Lead
10:00 AM
Our <startup> is using:
- Code blocks: \`\`\`js
const config = { name: '<app>' };
\`\`\`
- Links: <https://github.com|GitHub>
- Mentions: <@U99999> please review`;

    const formatter = new SlackFormatter(DEFAULT_SETTINGS, { U99999: 'Alice' }, {});

    const result = formatter.formatSlackContent(complexMessage);

    // Verify angle bracket escaping
    expect(result).toContain('&lt;startup&gt;');

    // Verify code blocks are preserved (angle brackets inside code blocks should not be double-escaped)
    expect(result).toContain('```js');
    expect(result).toContain("const config = { name: '<app>' };");
    expect(result).toContain('```');

    // Verify other features still work
    expect(result).toContain('[GitHub](https://github.com)');
    expect(result).toContain('[[Alice]]');
  });
});
