import { replaceEmoji, formatReactions } from '../../src/utils/emoji-utils';
import type { SlackReaction } from '../../src/types/messages.types';

describe('Emoji Utils', () => {
  const emojiMap = {
    "smile": "😄",
    "+1": "👍",
    "tada": "🎉",
    "bufo-thumbsup": "👍", // Custom emoji example
  };

  describe('replaceEmoji', () => {
    it('should replace known emoji codes', () => {
      expect(replaceEmoji('Hello :smile: world :+1:', emojiMap)).toBe('Hello 😄 world 👍');
    });

    it('should handle multiple occurrences of the same code', () => {
      expect(replaceEmoji(':smile::smile:', emojiMap)).toBe('😄😄');
    });

    it('should ignore unknown emoji codes', () => {
      expect(replaceEmoji('Hello :unknown_emoji: world', emojiMap)).toBe('Hello :unknown_emoji: world');
    });

    it('should handle codes adjacent to text', () => {
      expect(replaceEmoji('Party time!:tada:', emojiMap)).toBe('Party time!🎉');
    });

    it('should handle codes with hyphens and underscores', () => {
      expect(replaceEmoji(':bufo-thumbsup:', emojiMap)).toBe('👍');
      // Assuming an underscore emoji might exist
      const mapWithUnderscore = { ...emojiMap, "under_score": "✔️" };
      expect(replaceEmoji(':under_score:', mapWithUnderscore)).toBe('✔️');
    });

    it('should return the original string if no codes are present', () => {
      expect(replaceEmoji('Hello world', emojiMap)).toBe('Hello world');
    });

    it('should use default emoji map if the custom map is empty', () => {
      expect(replaceEmoji('Hello :smile:', {})).toBe('Hello 😄');
    });

    it('should handle empty string input', () => {
      expect(replaceEmoji('', emojiMap)).toBe('');
    });

    it('should handle Slack standard emoji image URLs', () => {
      const textWithSlackEmoji = 'Hello ![:no_entry:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/26d4.png) world';
      expect(replaceEmoji(textWithSlackEmoji, {})).toBe('Hello ⛔ world');
    });

    it('should handle Slack custom emoji image URLs', () => {
      const textWithCustomEmoji = 'Check this ![:bufo-wow:](https://emoji.slack-edge.com/T0181S17H6Z/bufo-wow/b6ec3fdfceb99b54.png) out';
      expect(replaceEmoji(textWithCustomEmoji, {})).toBe('Check this :bufo-wow: out');
    });

    it('should handle broken Slack emoji images', () => {
      const textWithBrokenEmoji = 'Broken emoji ![](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/1f64f@2x.png) here';
      expect(replaceEmoji(textWithBrokenEmoji, {})).toBe('Broken emoji 🙏 here');
    });

    it('should preserve user avatar images', () => {
      const textWithAvatar = 'User ![](https://ca.slack-edge.com/E0181S17H6Z-U02V3H43GGZ-f7b4fc673f58-48) said';
      expect(replaceEmoji(textWithAvatar, {})).toBe('User ![](https://ca.slack-edge.com/E0181S17H6Z-U02V3H43GGZ-f7b4fc673f58-48) said');
    });

    it('should use custom mapping for known Slack emoji URLs', () => {
      const customMap = { 'pray': '🛐' };
      const textWithSlackEmoji = '![:pray:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/1f64f@2x.png)';
      expect(replaceEmoji(textWithSlackEmoji, customMap)).toBe('🛐');
    });

    it('should handle mixed emoji formats', () => {
      const text = 'Mix :smile: and ![:heart:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/2764-fe0f@2x.png) and ![](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/1f44d.png)';
      expect(replaceEmoji(text, {})).toBe('Mix 😄 and ❤️ and 👍');
    });
  });

  describe('formatReactions', () => {
    it('should format a list of reactions', () => {
      const reactions: SlackReaction[] = [
        { name: '+1', count: 3 },
        { name: 'tada', count: 1 },
      ];
      expect(formatReactions(reactions, emojiMap)).toBe('👍 3 🎉 1');
    });

    it('should use emoji code if not found in map', () => {
      const reactions: SlackReaction[] = [
        { name: 'unknown', count: 2 },
      ];
      expect(formatReactions(reactions, emojiMap)).toBe(':unknown: 2');
    });
    
    it('should handle custom emoji names from map', () => {
       const reactions: SlackReaction[] = [
        { name: 'bufo-thumbsup', count: 5 },
      ];
      expect(formatReactions(reactions, emojiMap)).toBe('👍 5');
    });

    it('should return an empty string for an empty reactions array', () => {
      expect(formatReactions([], emojiMap)).toBe('');
    });

    it('should return an empty string if reactions array is null or undefined', () => {
      expect(formatReactions(null as any, emojiMap)).toBe('');
      expect(formatReactions(undefined as any, emojiMap)).toBe('');
    });
    
    it('should use default emoji map if the custom map is empty', () => {
       const reactions: SlackReaction[] = [
        { name: '+1', count: 3 },
        { name: 'tada', count: 1 },
      ];
      expect(formatReactions(reactions, {})).toBe('👍 3 :tada: 1');
    });
  });

  describe('Slack emoji URL handling', () => {
    it('should extract codepoint from production asset URLs', () => {
      const text = '![:no_entry:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/26d4.png)';
      expect(replaceEmoji(text, {})).toBe('⛔');
    });

    it('should handle @2x retina URLs', () => {
      const text = '![:pray:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-small/1f64f@2x.png)';
      expect(replaceEmoji(text, {})).toBe('🙏');
    });

    it('should handle compound emoji codepoints', () => {
      const text = '![:heart:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/2764-fe0f@2x.png)';
      expect(replaceEmoji(text, {})).toBe('❤️');
    });

    it('should handle unknown production asset URLs gracefully', () => {
      const text = '![:unknown:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/9999.png)';
      expect(replaceEmoji(text, {})).toBe(':unknown:');
    });

    it('should handle custom emoji URLs from workspace', () => {
      const text = '![:custom-emoji:](https://emoji.slack-edge.com/T123/custom-emoji/abc123.png)';
      expect(replaceEmoji(text, {})).toBe(':custom-emoji:');
    });

    it('should prefer custom mapping over URL detection', () => {
      const customMap = { 'no_entry': '🚫' };
      const text = '![:no_entry:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/26d4.png)';
      expect(replaceEmoji(text, customMap)).toBe('🚫');
    });
  });
});