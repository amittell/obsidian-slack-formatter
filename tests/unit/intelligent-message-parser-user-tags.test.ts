import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { SlackFormatterSettings } from '../../src/models';

describe('IntelligentMessageParser - User Tags', () => {
  let parser: IntelligentMessageParser;

  beforeEach(() => {
    const settings: SlackFormatterSettings = {
      userMap: '{}',
      emojiMap: '{}',
      format: 'standard',
      includeReactions: true,
      includeThreadInfo: true,
      includeEmojiAliases: true,
      debugMode: false,
      mergeConsecutiveMessages: false,
      minCharsPerChunk: 5000,
      maxCharsPerChunk: 20000,
      maxProcessingTime: 30000,
      cachingEnabled: true,
      maxCacheSize: 2097152,
    };

    parser = new IntelligentMessageParser(settings);
  });

  describe('should handle user tags between username and timestamp', () => {
    it('should correctly parse messages with "New hire" tag', () => {
      // This is the exact format from the user's example
      const input = `Mehar Abbas
Mehar Abbas
  6:06 PM
its a big mess, so itll take some time and planning to get that fixed. Stephanie has a plan for us to start cleaning up the Leads object though
hopefully soon 😊

Ally Long
Ally Long
New hire  6:10 PM
i'm very excited about this Leads object clean up haha
😀 1    👍 1    🔁`;

      const messages = parser.parse(input);

      expect(messages).toHaveLength(2);

      // First message from Mehar Abbas
      expect(messages[0].username).toBe('Mehar Abbas');
      expect(messages[0].timestamp).toBe('6:06 PM');
      // The message should only contain the actual content, not "Ally Long"
      expect(messages[0].text).not.toContain('Ally Long');
      expect(messages[0].text).toBe(
        'its a big mess, so itll take some time and planning to get that fixed. Stephanie has a plan for us to start cleaning up the Leads object though\nhopefully soon 😊'
      );
      expect(messages[0].reactions).toHaveLength(0);

      // Second message from Ally Long
      expect(messages[1].username).toBe('Ally Long');
      expect(messages[1].timestamp).toBe('6:10 PM');
      // The message text should not include emoji reactions
      expect(messages[1].text).toBe("i'm very excited about this Leads object clean up haha");
      // Reactions should be parsed separately
      expect(messages[1].reactions).toHaveLength(3);
      expect(messages[1].reactions?.[0]).toMatchObject({ name: '😀', count: 1 });
      expect(messages[1].reactions?.[1]).toMatchObject({ name: '👍', count: 1 });
      expect(messages[1].reactions?.[2]).toMatchObject({ name: '🔁', count: 1 });
    });

    it('should handle various user tags', () => {
      const input = `John Doe
John Doe
Admin  3:15 PM
This is a test message

Jane Smith
Jane Smith
Team Lead  3:20 PM
Another test message

Bob Wilson
Bob Wilson
New member  3:25 PM
Hello everyone!`;

      const messages = parser.parse(input);

      expect(messages).toHaveLength(3);

      expect(messages[0].username).toBe('John Doe');
      expect(messages[0].timestamp).toBe('3:15 PM');
      expect(messages[0].text).toBe('This is a test message');

      expect(messages[1].username).toBe('Jane Smith');
      expect(messages[1].timestamp).toBe('3:20 PM');
      expect(messages[1].text).toBe('Another test message');

      expect(messages[2].username).toBe('Bob Wilson');
      expect(messages[2].timestamp).toBe('3:25 PM');
      expect(messages[2].text).toBe('Hello everyone!');
    });

    it('should handle tags with emojis correctly', () => {
      const input = `Sarah Connor
Sarah Connor
Manager 🌟  4:00 PM
Team meeting at 5

Kyle Reese
Kyle Reese
Engineer 🔧  4:05 PM
I'll be there`;

      const messages = parser.parse(input);

      expect(messages).toHaveLength(2);

      expect(messages[0].username).toBe('Sarah Connor');
      expect(messages[0].timestamp).toBe('4:00 PM');
      expect(messages[0].text).toBe('Team meeting at 5');

      expect(messages[1].username).toBe('Kyle Reese');
      expect(messages[1].timestamp).toBe('4:05 PM');
      expect(messages[1].text).toBe("I'll be there");
    });
  });

  describe('should handle emoji reactions correctly', () => {
    it('should not truncate message content when emoji reactions are present', () => {
      const input = `User One
User One
  10:00 AM
This is a message that ends with haha
😀 1    👍 1    🔁`;

      const messages = parser.parse(input);

      expect(messages).toHaveLength(1);
      expect(messages[0].text).toBe('This is a message that ends with haha');
      expect(messages[0].reactions).toHaveLength(3);
    });
  });
});
