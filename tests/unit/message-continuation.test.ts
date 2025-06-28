import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { MessageContinuationProcessor } from '../../src/formatter/processors/message-continuation-processor';
import { SlackMessage } from '../../src/models';

describe('Message Continuation Handling', () => {
  describe('FlexibleMessageParser', () => {
    const parser = new FlexibleMessageParser();

    it('should merge continuation messages with linked timestamps', () => {
      const input = `Clement Miao  [Feb 7th at 8:25 AM](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934758764809?thread_ts=1738889253.251969&cid=C039S5CGKEJ)  

this is AMAZING omg

[8:26](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934765553959?thread_ts=1738889253.251969&cid=C039S5CGKEJ)

even if a bit buggy, this is going to be great`;

      const messages = parser.parse(input);

      expect(messages).toHaveLength(1);
      expect(messages[0].username).toBe('Clement Miao');
      expect(messages[0].text).toContain('this is AMAZING omg');
      expect(messages[0].text).toContain('[8:26]');
      expect(messages[0].text).toContain('even if a bit buggy, this is going to be great');
    });

    it('should merge continuation messages with simple timestamps', () => {
      const input = `Alex Mittell  8:00 PM
First message from Alex

8:05 PM
This is a continuation from Alex

Bob Smith  8:10 PM
New message from Bob`;

      const messages = parser.parse(input);

      expect(messages).toHaveLength(2);
      expect(messages[0].username).toBe('Alex Mittell');
      expect(messages[0].text).toContain('First message from Alex');
      expect(messages[0].text).toContain('8:05 PM');
      expect(messages[0].text).toContain('This is a continuation from Alex');

      expect(messages[1].username).toBe('Bob Smith');
      expect(messages[1].text).toContain('New message from Bob');
    });

    it('should handle multiple continuations from same user', () => {
      const input = `Trajan McGill  [Feb 7th at 9:18 AM](https://stripe.slack.com/archives/C039S5CGKEJ/p1738937902183979?thread_ts=1738889253.251969&cid=C039S5CGKEJ)  

Yeah, this is going to be fantastic.

[9:18](https://stripe.slack.com/archives/C039S5CGKEJ/p1738937929874099?thread_ts=1738889253.251969&cid=C039S5CGKEJ)

So, first attempt was copying and pasting this very thread, and looks good, but it doesn't seem to detect where all the messages start and end. I get one big message containing the first three messages.

[9:23](https://stripe.slack.com/archives/C039S5CGKEJ/p1738938227881789?thread_ts=1738889253.251969&cid=C039S5CGKEJ)

Curious how the clipboard works on Slack copies; are there image objects along with the text, where eventually we could get pasted embedded images to just paste right in there, too?`;

      const messages = parser.parse(input);

      expect(messages).toHaveLength(1);
      expect(messages[0].username).toBe('Trajan McGill');
      expect(messages[0].text).toContain('Yeah, this is going to be fantastic');
      expect(messages[0].text).toContain('[9:18]');
      expect(messages[0].text).toContain('So, first attempt');
      expect(messages[0].text).toContain('[9:23]');
      expect(messages[0].text).toContain('Curious how the clipboard works');
    });

    it('should preserve linked timestamps in continuations', () => {
      const input = `Clement Miao  [Feb 7th at 8:25 AM](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934758764809?thread_ts=1738889253.251969&cid=C039S5CGKEJ)  

this is AMAZING omg

[8:26](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934765553959?thread_ts=1738889253.251969&cid=C039S5CGKEJ)

even if a bit buggy, this is going to be great`;

      const messages = parser.parse(input);

      expect(messages).toHaveLength(1);
      expect(messages[0].username).toBe('Clement Miao');
      expect(messages[0].text).toContain('this is AMAZING omg');
      expect(messages[0].text).toContain('[8:26]');
      expect(messages[0].text).toContain('even if a bit buggy');
    });
  });

  describe('IntelligentMessageParser', () => {
    const parser = new IntelligentMessageParser();

    it('should not treat standalone timestamps as new messages', () => {
      const input = `Clement Miao  8:25 AM
this is AMAZING omg

[8:26](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934765553959)
even if a bit buggy, this is going to be great

Trajan McGill  9:18 AM
Yeah, this is going to be fantastic.`;

      const messages = parser.parse(input);

      // Should have 2 messages, not 3
      expect(messages.length).toBeLessThanOrEqual(2);

      // First message should include both parts
      const clementMessage = messages.find(m => m.username === 'Clement Miao');
      expect(clementMessage).toBeDefined();
      if (clementMessage) {
        expect(clementMessage.text).toContain('this is AMAZING omg');
        // The continuation content should be included
        expect(clementMessage.text.toLowerCase()).toContain('buggy');
      }
    });
  });

  describe('MessageContinuationProcessor', () => {
    const processor = new MessageContinuationProcessor();

    it('should merge Unknown User messages with timestamps', () => {
      const messages: SlackMessage[] = [
        {
          username: 'Clement Miao',
          text: 'this is AMAZING omg',
          timestamp: '8:25 AM',
        } as SlackMessage,
        {
          username: 'Unknown User',
          text: '[8:26](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934765553959)\n\neven if a bit buggy, this is going to be great',
          timestamp: undefined,
        } as SlackMessage,
      ];

      const result = processor.process(messages);

      expect(result.content).toHaveLength(1);
      expect(result.modified).toBe(true);
      expect(result.content[0].username).toBe('Clement Miao');
      expect(result.content[0].text).toContain('this is AMAZING omg');
      expect(result.content[0].text).toContain('[8:26]');
      expect(result.content[0].text).toContain('even if a bit buggy');
    });

    it('should handle continuation phrases', () => {
      const messages: SlackMessage[] = [
        {
          username: 'David Brownman',
          text: 'FYI our rule is that we can use stripe-employee developed plugins',
          timestamp: '1:31 PM',
        } as SlackMessage,
        {
          username: 'Unknown User',
          text: 'either way, seriously cool plugin!',
          timestamp: undefined,
        } as SlackMessage,
      ];

      const result = processor.process(messages);

      expect(result.content).toHaveLength(1);
      expect(result.modified).toBe(true);
      expect(result.content[0].text).toContain('FYI our rule');
      expect(result.content[0].text).toContain('either way, seriously cool plugin!');
    });
  });
});
