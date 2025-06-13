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
});