import { BaseProcessor } from './base-processor';
import { formatUserMentions, cleanupDoubledUsernames, formatUsername } from '../../utils/username-utils';
import type { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import Logger

/**
 * Processor for handling Slack user mentions and username formatting.
 * Converts user IDs to display names and formats mentions as wikilinks.
 * @extends {BaseProcessor<string>}
 */
export class UsernameProcessor extends BaseProcessor<string> {
  /** Map of user IDs to display names */
  private userMap: Record<string, string>;
  
  /** Whether to convert @mentions to [[wikilinks]] */
  private enableMentions: boolean;
  
  /** Debug mode flag */
  private isDebugEnabled: boolean; // Added property

  /**
   * Creates a new UsernameProcessor instance.
   * @param {Object} options - Configuration options
   * @param {Record<string, string>} [options.userMap={}] - User ID to name mappings
   * @param {boolean} [options.enableMentions=true] - Enable mention formatting
   * @param {boolean} [options.isDebugEnabled=false] - Enable debug logging
   */
  constructor(options: { userMap?: Record<string, string>; enableMentions?: boolean; isDebugEnabled?: boolean } = {}) { // Updated constructor signature
    super();
    this.userMap = options.userMap ?? {};
    this.enableMentions = options.enableMentions ?? true;
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  /**
   * Process a line to handle username formatting and mentions.
   * Performs two operations:
   * 1. Cleans up doubled usernames (e.g., "JohnJohn" -> "John")
   * 2. Converts user mentions to wikilinks if enabled
   * @param {string} line - The line to process
   * @returns {ProcessorResult} Processed content with formatted usernames
   */
  process(line: string): ProcessorResult {
    // Validate input
    const validationResult = this.validateStringInput(line);
    if (validationResult) {
      return validationResult;
    }

    try {
      let content = line;
      let modified = false;

      // Clean up doubled usernames
      const cleanedContent = cleanupDoubledUsernames(content);
      if (cleanedContent !== content) {
        content = cleanedContent;
        modified = true;
        // Keep this log as debug
        Logger.debug(this.constructor.name, `Cleaned doubled username: ${line} -> ${content}`, undefined, this.isDebugEnabled);
      }

      // Format mentions if enabled
      if (this.enableMentions) {
        const processedContent = formatUserMentions(content, this.userMap);
        if (processedContent !== content) {
          content = processedContent;
          modified = true;
          // Keep this log as debug
          Logger.debug(this.constructor.name, `Formatted user mention: ${line} -> ${content}`, undefined, this.isDebugEnabled);
        }
      }

      // Removed the overall 'info' log for username processing result

      return { content, modified };
    } catch (error) {
      // Keep error logging as is
      this.log('error', `Error processing username: ${error}`, { line });
      return { content: line, modified: false }; // Return original on error
    }
  }

  /**
   * Format a username for display.
   * Delegates to formatUsername utility for consistent formatting.
   * @param {string} username - The username to format
   * @returns {string} Formatted username or original on error
   */
  formatDisplayName(username: string): string {
    try {
      return formatUsername(username);
    } catch (error) {
      // Keep error logging as is
      this.log('error', `Error formatting display name: ${error}`, { username });
      return username; // Return original on error
    }
  }

  /**
   * Update the user ID to display name mapping.
   * @param {Record<string, string>} newMap - New user ID to name mappings
   * @returns {void}
   */
  updateUserMap(newMap: Record<string, string>): void {
    this.userMap = newMap;
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