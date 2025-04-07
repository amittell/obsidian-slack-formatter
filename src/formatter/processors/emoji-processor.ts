import { BaseProcessor } from './base-processor';
import { replaceEmoji, formatReactions } from '../../utils/emoji-utils';
import type { ProcessorResult } from '../../types/formatters.types';
import type { SlackReaction } from '../../types/messages.types';
import { Logger } from '../../utils/logger'; // Import Logger

export class EmojiProcessor extends BaseProcessor<string> {
  private emojiMap: Record<string, string>;
  private isDebugEnabled: boolean; // Added property

  constructor(options: { emojiMap?: Record<string, string>; isDebugEnabled?: boolean } = {}) { // Updated constructor signature
    super();
    this.emojiMap = options.emojiMap ?? {};
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  process(line: string): ProcessorResult {
    try {
      const processed = replaceEmoji(line, this.emojiMap);
      const modified = processed !== line;
      if (modified) {
        // Changed log level to debug and pass isDebugEnabled flag
        Logger.debug(this.constructor.name, `Emoji processing: ${line} -> ${processed}`, { modified }, this.isDebugEnabled);
      }
      return { content: processed, modified };
    } catch (error) {
      // Keep error logging as is
      this.log('error', `Error processing emoji: ${error}`, { line });
      return { content: line, modified: false }; // Return original on error
    }
  }

  processReactions(reactions: SlackReaction[]): string {
    if (!reactions || reactions.length === 0) {
      return '';
    }

    try {
      return formatReactions(reactions, this.emojiMap);
    } catch (error) {
      // Keep error logging as is
      this.log('error', 'Error processing reactions', { error, reactions });
      return ''; // Or some other fallback
    }
  }

  updateEmojiMap(newMap: Record<string, string>): void {
    this.emojiMap = newMap;
  }

  // Added method to update debug flag if needed, though likely set at construction
  updateDebugFlag(isDebugEnabled: boolean): void {
      this.isDebugEnabled = isDebugEnabled;
  }
}