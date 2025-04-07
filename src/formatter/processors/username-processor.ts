import { BaseProcessor } from './base-processor';
import { formatUserMentions, cleanupDoubledUsernames, formatUsername } from '../../utils/username-utils';
import type { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import Logger

export class UsernameProcessor extends BaseProcessor<string> {
  private userMap: Record<string, string>;
  private enableMentions: boolean;
  private isDebugEnabled: boolean; // Added property

  constructor(options: { userMap?: Record<string, string>; enableMentions?: boolean; isDebugEnabled?: boolean } = {}) { // Updated constructor signature
    super();
    this.userMap = options.userMap ?? {};
    this.enableMentions = options.enableMentions ?? true;
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  process(line: string): ProcessorResult {
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

  formatDisplayName(username: string): string {
    try {
      return formatUsername(username);
    } catch (error) {
      // Keep error logging as is
      this.log('error', `Error formatting display name: ${error}`, { username });
      return username; // Return original on error
    }
  }

  updateUserMap(newMap: Record<string, string>): void {
    this.userMap = newMap;
  }

  // Added method to update debug flag if needed
  updateDebugFlag(isDebugEnabled: boolean): void {
      this.isDebugEnabled = isDebugEnabled;
  }
}