/**
 * Text processing utilities for formatting Slack conversations
 */
export class TextProcessor {
  private userMap: Record<string, string>;
  private emojiMap: Record<string, string>;
  private channelMap: Record<string, string>;
  
  constructor(
    userMap: Record<string, string>,
    emojiMap: Record<string, string>,
    channelMap: Record<string, string>
  ) {
    this.userMap = userMap || {};
    this.emojiMap = emojiMap || {};
    this.channelMap = channelMap || {};
  }
  
  /**
   * Debug logging helper
   */
  private debugLog(message: string, data?: any) {
    console.log(`[SlackFormat] ${message}`, data || '');
  }
  
  /**
   * Handles mentioning users in the text
   * This converts user IDs to proper names
   */
  public processMentions(text: string): string {
    if (!text) return text;
    
    // Match <@U123456|username> or <@U123456> patterns
    return text.replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>/, (match, userId, displayName) => {
      // If we have this user in the map, return it with linking
      if (this.userMap[userId]) {
        return `[[@${this.userMap[userId]}]]`;
      }
      
      // Otherwise use the display name from the mention if available
      if (displayName) {
        return `@${displayName}`;
      }
      
      // Fall back to just the user ID
      return `@${userId}`;
    });
  }
  
  /**
   * Format emoji in text
   */
  public processEmoji(text: string): string {
    if (!text) return text;
    
    // Match :emoji: format including custom emoji
    return text.replace(/:([\w\-\+]+):/g, (match, emojiName) => {
      // If we have this emoji in our map, use that
      if (this.emojiMap[emojiName]) {
        return this.emojiMap[emojiName];
      }
      
      // Otherwise, keep the original emoji format (will render in Obsidian)
      return match;
    });
  }
  
  /**
   * Handle channel references
   */
  public processChannelRefs(text: string): string {
    if (!text) return text;
    
    // Match <#C123456|channel-name> pattern
    return text.replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/, (match, channelId, displayName) => {
      // If we have this channel in the map, return it with linking
      if (this.channelMap[channelId]) {
        return `#${this.channelMap[channelId]}`;
      }
      
      // Otherwise use the display name from the mention if available
      if (displayName) {
        return `#${displayName}`;
      }
      
      // Fall back to just the channel ID
      return `#${channelId}`;
    });
  }
  
  /**
   * Apply all text formatting to a line
   */
  public formatLine(line: string, enableMentions: boolean = true, enableEmoji: boolean = true): string {
    if (!line) return line;
    
    // Clean up any markdown-breaking characters
    let processed = line;
    
    // Fix special characters for Markdown
    processed = this.cleanCharacters(processed);
    
    if (enableMentions) {
      // Process user mentions
      processed = this.processMentions(processed);
      
      // Process channel references
      processed = this.processChannelRefs(processed);
    }
    
    if (enableEmoji) {
      // Process emoji
      processed = this.processEmoji(processed);
    }
    
    // Clean up URLs and links
    processed = this.cleanLinkFormatting(processed);
    
    return processed;
  }
  
  /**
   * Clean up characters that might interfere with Markdown
   */
  private cleanCharacters(text: string): string {
    return text
      // Fix backticks in inline code to avoid breaking Markdown
      .replace(/`([^`]+)`/g, (match, code) => {
        // Escape any backticks inside code blocks
        return `\`${code.replace(/`/g, '\\`')}\``;
      });
  }
  
  /**
   * Clean up links and URLs
   */
  public cleanLinkFormatting(text: string): string {
    if (!text) return text;
    
    return text
      // Fix escaping of square brackets in URLs
      .replace(/\\\[/g, '[')
      .replace(/\\\]/g, ']')
      // Fix link formatting with angle brackets <https://example.com>
      .replace(/<(https?:\/\/[^>]+)>/g, '$1')
      // Fix issues with auto-linked URLs
      .replace(/\[\]\((https?:\/\/[^)]+)\)/g, '$1');
  }

  /**
   * Helper to fix doubled usernames in the final output stage
   * This catches any usernames that might have slipped through earlier processing
   */
  private fixDoubledUsernames(text: string): string {
    if (!text) return text;
    
    // Fix common patterns like "Alex MittellAlex Mittell"
    return text.replace(/(\[\[)([A-Z][a-z]+\s+[A-Z][a-z]+)(\2)(\]\])/gi, '$1$2$4');
  }
  
  /**
   * Format thread info
   */
  public formatThreadInfo(
    replyCount: number,
    collapseThreads: boolean,
    collapseThreshold: number
  ): string {
    if (collapseThreads && replyCount >= collapseThreshold) {
      return `\n\n▼ ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
    }
    
    return '';
  }
  
  /**
   * Format reaction data
   */
  private formatReactions(reactions: string[]): string {
    if (!reactions || reactions.length === 0) return '';
    
    return reactions
      .map(reaction => {
        // Clean up emoji formatting in reactions
        return this.processEmoji(
          reaction
            .replace(/!?\[:([a-z0-9_\-\+]+):\]\s*(\d+)/i, ':$1: $2')
            .replace(/!?\[:([a-z0-9_\-\+]+):\]/i, ':$1:')
        );
      })
      .join(' ');
  }
  
  /**
   * Format a complete message with user info, timestamp, and content
   */
  public formatMessage(
    user: string,
    time: string,
    date: string,
    avatar: string,
    lines: string[],
    threadInfo: string,
    reactions: string[] | null,
    options: { 
      enableTimestampParsing: boolean, 
      enableEmoji: boolean, 
      enableMentions: boolean 
    },
    parseTimeCallback: (timeStr: string) => string
  ): string {
    // Ensure we're working with a clean username
    user = this.fixDoubledUsernames(user);
    
    // Create the header line
    let result = `>[!note]+ Message from ${user}`;
    
    // Add the time and date
    if (time) {
      const displayTime = options.enableTimestampParsing ? 
        parseTimeCallback(time) : time;
        
      result += `\n> **Time:** ${displayTime}`;
    }
    
    if (date) {
      result += `\n> **Date:** ${date}`;
    }
    
    // Add a blank line
    result += '\n>';
    
    // Add message content
    if (lines && lines.length > 0) {
      const formattedLines = lines
        .map(line => {
          return this.formatLine(line, options.enableMentions, options.enableEmoji);
        })
        .filter(line => line.trim() !== '')
        .join('\n> ');
      
      if (formattedLines) {
        result += `\n> ${formattedLines}`;
      }
    }
    
    // Add reactions
    if (reactions && reactions.length > 0) {
      const formattedReactions = this.formatReactions(reactions);
      if (formattedReactions) {
        result += `\n> ${formattedReactions}`;
      }
    }
    
    // Add thread info
    if (threadInfo) {
      result += threadInfo;
    }
    
    return result;
  }
}