import { BaseProcessor } from './base-processor';
import { replaceEmoji, formatReactions } from '../../utils/emoji-utils';
import type { ProcessorResult } from '../../types/formatters.types';
import type { SlackReaction } from '../../types/messages.types';
import { Logger } from '../../utils/logger';

/**
 * Processor for converting Slack emoji codes to Unicode characters.
 * Handles both standard and custom emoji mappings.
 * @extends {BaseProcessor<string>}
 */
export class EmojiProcessor extends BaseProcessor<string> {
  /** Map of emoji codes to Unicode characters */
  private emojiMap: Record<string, string>;

  /** Debug mode flag */
  private isDebugEnabled: boolean; // Added property

  /**
   * Creates a new EmojiProcessor instance.
   * @param {Object} options - Configuration options
   * @param {Record<string, string>} [options.emojiMap={}] - Custom emoji mappings
   * @param {boolean} [options.isDebugEnabled=false] - Enable debug logging
   */
  constructor(options: { emojiMap?: Record<string, string>; isDebugEnabled?: boolean } = {}) {
    // Updated constructor signature
    super();
    this.emojiMap = options.emojiMap ?? {};
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  /**
   * Process a line to replace emoji codes with Unicode characters.
   * @param {string} line - The line to process
   * @returns {ProcessorResult} Processed content and modification flag
   */
  process(line: string): ProcessorResult {
    // Validate input
    const validationResult = this.validateStringInput(line);
    if (validationResult) {
      return validationResult;
    }

    try {
      const processed = replaceEmoji(line, this.emojiMap);
      const modified = processed !== line;
      if (modified) {
        Logger.debug(this.constructor.name, `Emoji processing: ${line} -> ${processed}`, {
          modified,
        });
      }
      return { content: processed, modified };
    } catch (error) {
      this.log('error', `Error processing emoji: ${error}`, { line });
      return { content: line, modified: false };
    }
  }

  /**
   * Process Slack reactions to format them as a string.
   * @param {SlackReaction[]} reactions - Array of reactions to process
   * @returns {string} Formatted reaction string or empty string on error
   */
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

  /**
   * Update the emoji mapping dictionary.
   * @param {Record<string, string>} newMap - New emoji code to Unicode mappings
   * @returns {void}
   */
  updateEmojiMap(newMap: Record<string, string>): void {
    this.emojiMap = newMap;
  }

  /**
   * Update the debug flag for logging.
   * @param {boolean} isDebugEnabled - New debug flag value
   * @returns {void}
   */
  updateDebugFlag(isDebugEnabled: boolean): void {
    this.isDebugEnabled = isDebugEnabled;
  }
}
