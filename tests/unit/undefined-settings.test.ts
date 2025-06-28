import { SlackFormatter } from '../../src/formatter/slack-formatter';

describe('SlackFormatter with undefined settings', () => {
  const slackText = `Alex MittellAlex Mittell  [Feb 6th at 7:47 PM](https://stripe.slack.com/archives/C039S5CGKEJ/p1738889253251969)  

Hey all, I've been annoyed for a while by trying to copy and paste Slack conversations into Obsidian 'nicely' so I knocked up a quick plug-in to make it easier.`;

  it('should handle undefined settings without throwing', () => {
    // This was causing "Cannot read properties of undefined (reading 'debug')" error
    const formatter = new SlackFormatter(undefined as any, {}, {});

    expect(() => {
      formatter.formatSlackContent(slackText);
    }).not.toThrow();
  });

  it('should handle null settings without throwing', () => {
    const formatter = new SlackFormatter(null as any, {}, {});

    expect(() => {
      formatter.formatSlackContent(slackText);
    }).not.toThrow();
  });

  it('should handle empty settings object', () => {
    const formatter = new SlackFormatter({} as any, {}, {});
    const result = formatter.formatSlackContent(slackText);

    expect(result).toBeTruthy();
    expect(result).toContain('Alex Mittell');
  });

  it('should format slack content correctly with undefined settings', () => {
    const formatter = new SlackFormatter(undefined as any, {}, {});
    const result = formatter.formatSlackContent(slackText);

    expect(result).toContain('[!slack]');
    expect(result).toContain('Message from Alex Mittell');
    expect(result).toContain('7:47 PM');
  });
});
