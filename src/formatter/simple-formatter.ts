/**
 * Simple Slack Message Formatter
 * Based on pattern matching for consistent message boundaries
 * Focuses on doubled username detection and message grouping
 *
 * This formatter is specialized for handling Slack messages with bracket-timestamp formats
 * like "[10:42 AM] User: Message" or "User [10:42 AM]: Message". It uses a simpler algorithm
 * than the main formatter, focusing on reliable timestamp detection to identify message boundaries.
 */
import { TextProcessor } from './text-processor';
import { MessageParser } from './message-parser';
import { SlackFormatSettings } from '../types';

/**
 * Message interface representing a parsed Slack message
 */
interface ParsedMessage {
  author: string;
  timestamp: string;
  date?: string;
  lines: string[];
  reactions?: string[];
  threadInfo?: string;
}

export class SimpleFormatter {
  private settings: SlackFormatSettings;
  private userMap: Record<string, string>;
  private emojiMap: Record<string, string>;
  private channelMap: Record<string, string>;
  private textProcessor: TextProcessor;
  private messageParser: MessageParser;
  
  constructor(
    settings: SlackFormatSettings, 
    userMap: Record<string, string>,
    emojiMap: Record<string, string>,
    channelMap: Record<string, string>
  ) {
    this.settings = settings || {};
    this.userMap = userMap || {};
    this.emojiMap = emojiMap || {};
    this.channelMap = channelMap || {};
    this.textProcessor = new TextProcessor(
      this.userMap,
      this.emojiMap,
      this.channelMap
    );
    this.messageParser = new MessageParser(this.settings);
  }
  
  /**
   * Debug logging helper
   * Provides consistent logging format for SimpleFormatter operations
   *
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  private debug(message: string, data?: any): void {
    console.log(`[SlackFormat:Simple] ${message}`, data || '');
  }
  
  /**
   * Format a string of Slack content into a Markdown callout format
   * This is the main entry point for the SimpleFormatter
   *
   * This method:
   * 1. Preprocesses the input to fix common formatting issues (emojis, etc.)
   * 2. Splits the text into lines and handles large inputs with truncation
   * 3. Processes the lines to identify message boundaries and content
   * 4. Formats the extracted messages into Obsidian-friendly markdown
   * 5. Includes error handling to provide user-friendly error messages
   *
   * @param input - Raw Slack text to format
   * @returns Formatted markdown text with messages as callouts
   */
  public formatSlackContent(input: string): string {
    if (!input) return '';
    
    // First apply some common fixes (emoji cleanup)
    input = this.fixEmojiFormatting(input);
    
    // Split into lines and process
    const lines = input.split('\n');
    const maxLines = this.settings.maxLines || 1000;
    
    // Process in batches if very large
    if (lines.length > maxLines) {
      console.warn(`SlackFormatter: Large input (${lines.length} lines) truncating to ${maxLines}`);
      const truncatedLines = lines.slice(0, maxLines);
      return this.processLines(truncatedLines);
    }
    
    try {
      return this.processLines(lines);
    } catch (error) {
      console.error('[SlackFormat] Error processing lines:', error);
      // Return a formatted error message that will be visible in the preview
      return `>[!error]+ Error Processing Slack Content
> An error occurred while processing the Slack content:
> ${error.message}
>
> Please try again or report this issue if it persists.`;
    }
  }
  
  /**
   * Core processing algorithm for formatting Slack messages
   *
   * This method:
   * 1. Iterates through each line of text
   * 2. Identifies message boundaries based on timestamp patterns
   * 3. Groups content lines with their corresponding messages
   * 4. Handles edge cases like messages without clear authors
   *
   * @param lines - Array of text lines to process
   * @returns Formatted markdown string with messages as callouts
   */
  private processLines(lines: string[]): string {
    // Initialize state
    const messages: { 
      author: string; 
      timestamp: string; 
      date?: string;
      content: string[];
    }[] = [];
    
    let currentMessage: { 
      author: string; 
      timestamp: string; 
      date?: string;
      content: string[]; 
    } | null = null;
    
    // Track message boundaries based on timestamp patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        if (currentMessage) {
          currentMessage.content.push('');
        }
        continue;
      }
      
      // Check if this line starts a new message
      const timestampMatch = this.findTimestampInLine(line);
      
      if (timestampMatch) {
        // This line contains a timestamp, likely a new message
        
        // If we have a current message in progress, save it
        if (currentMessage && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Extract author and timestamp
        const { author, timestamp, date, remainingContent } = timestampMatch;
        
        // Start a new message
        currentMessage = {
          author,
          timestamp,
          date,
          content: []
        };
        
        // Add any content after the timestamp
        if (remainingContent) {
          currentMessage.content = [remainingContent];
        } else {
          currentMessage.content = [];
        }
        
      } else if (currentMessage) {
        // This is a continuation of the current message
        currentMessage.content.push(line);
      } else {
        // This is content before any message starts
        // Try to create an initial message with no clear timestamp
        if (!currentMessage) {
          const firstUserMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
          const authorName = firstUserMatch ?
            this.messageParser.fixDuplicatedUsernamePublic(firstUserMatch[1]) : 'Unknown user';
          
          currentMessage = {
            author: authorName,
            timestamp: 'Unknown',
            content: [line]
          };
        }
      }
    }
    
    // Don't forget to add the last message
    if (currentMessage && currentMessage.content.length > 0) {
      messages.push(currentMessage);
    }
    
    // Now format all the messages into Markdown callouts
    return this.formatMessagesToMarkdown(messages);
  }
  
  /**
   * Find a timestamp in a line and extract author info if possible
   *
   * This method identifies different timestamp patterns in Slack messages:
   * - Username followed by bracketed timestamp: "Alex Mittell [2:45 PM]"
   * - Bracketed timestamp followed by username: "[2:45 PM] Username"
   * - Timestamp with date information: "Alex Mittell [Feb 7th at 2:45 PM]"
   * - Timestamp-only lines: "[2:45 PM]"
   *
   * For each pattern, it extracts:
   * - Author name (with doubled username fixes)
   * - Timestamp
   * - Optional date information
   * - Remaining content after the timestamp
   *
   * @param line - Line to analyze for timestamp patterns
   * @returns Parsed message components or null if no timestamp found
   */
  private findTimestampInLine(line: string): {
    author: string;
    timestamp: string;
    date?: string;
    remainingContent?: string;
  } | null {
    // Check for the most common pattern - username followed by bracketed timestamp
    // Example: "Alex Mittell [2:45 PM]" or "Alex Mittell [Feb 7th at 2:45 PM]"
    // Regex breakdown:
    // ^([A-Za-z0-9][\w\s]+?) - Capture username starting with letter/number followed by word chars and spaces (non-greedy)
    // \s+\[ - Whitespace followed by opening bracket
    // (?:(?:[A-Za-z]+\s+\d+(?:st|nd|rd|th)?\s+at\s+)? - Optional date part like "Feb 7th at" (non-capturing)
    // (\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)) - Capture the time part (1-2 digits, colon, 2 digits, optional space, AM/PM)
    // \] - Closing bracket
    const nameWithTimestamp = line.match(/^([A-Za-z0-9][\w\s]+?)\s+\[(?:(?:[A-Za-z]+\s+\d+(?:st|nd|rd|th)?\s+at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)))\]/i);
    if (nameWithTimestamp) {
      const authorName = this.messageParser.fixDuplicatedUsernamePublic(nameWithTimestamp[1]);
      const timestamp = nameWithTimestamp[2];
      
      // Extract optional date info
      const dateMatch = line.match(/\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?)\s+at/i);
      const date = dateMatch ? dateMatch[1] : undefined;
      
      // Get the remainder of the line after the timestamp
      const closeBracketPos = line.indexOf(']');
      const remainder = closeBracketPos > 0 ? line.substring(closeBracketPos + 1).trim() : '';
      
      return {
        author: authorName,
        timestamp,
        date,
        remainingContent: remainder
      };
    }
    
    // Check for the bracketed timestamp first pattern - "[2:45 PM] Username"
    // Regex breakdown:
    // ^\[ - Start with opening bracket
    // (\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)) - Capture time format (1-2 digits, colon, 2 digits, optional space, AM/PM)
    // \]\s* - Closing bracket followed by optional whitespace
    // ([A-Za-z0-9][\w\s]+?) - Capture username (non-greedy)
    // (?::|$) - Followed by either a colon or end of line
    const timestampWithName = line.match(/^\[(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]\s*([A-Za-z0-9][\w\s]+?)(?::|$)/i);
    if (timestampWithName) {
      const authorName = this.messageParser.fixDuplicatedUsernamePublic(timestampWithName[2]);
      const timestamp = timestampWithName[1];
      
      // Get content after the username and colon if present
      const colonPos = line.indexOf(':', line.indexOf(timestampWithName[2]));
      const remainder = colonPos > 0 ? line.substring(colonPos + 1).trim() : '';
      
      return {
        author: authorName,
        timestamp,
        remainingContent: remainder
      };
    }
    
    // Check for timestamp only pattern (no clear username)
    // Regex breakdown:
    // ^\[ - Start with opening bracket
    // (\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)) - Capture time format
    // \] - Closing bracket
    // (.*) - Capture any remaining content after the timestamp
    // $ - End of line
    const timestampOnly = line.match(/^\[(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\](.*)$/i);
    if (timestampOnly) {
      const timestamp = timestampOnly[1];
      const remainder = timestampOnly[2].trim();
      
      return {
        author: 'Unknown', // No author identified
        timestamp,
        remainingContent: remainder
      };
    }
    
    return null;
  }
  
  /**
   * Format the extracted messages into markdown callout format
   *
   * This method:
   * 1. Converts each parsed message into an Obsidian callout block
   * 2. Formats author names as wiki links when appropriate
   * 3. Adds timestamp and date information as metadata
   * 4. Processes message content with emoji and mention formatting
   * 5. Ensures proper formatting of multi-line content
   *
   * @param messages - Array of parsed message objects to format
   * @returns Formatted markdown string with callout blocks for each message
   */
  private formatMessagesToMarkdown(messages: {
    author: string;
    timestamp: string;
    date?: string;
    content: string[];
  }[]): string {
    const formatted: string[] = [];
    
    for (const message of messages) {
      // Skip empty messages
      if (message.content.length === 0) continue;
      
      // Format the author name
      const userDisplay = this.messageParser.isValidUsername(message.author) ? 
        `[[${message.author}]]` : message.author;
      
      // Create the callout header
      let callout = `>[!note]+ Message from ${userDisplay}`;
      formatted.push(callout);
      
      // Add timestamp and date
      formatted.push(`> **Time:** ${message.timestamp}`);
      if (message.date) {
        formatted.push(`> **Date:** ${message.date}`);
      }
      formatted.push('>');
      
      // Process content - ensure content is always an array
      const contentArray = Array.isArray(message.content) ? message.content : [message.content];
      // Add safety checks for null/undefined content and ensure every line is a string
      const processedContent = (contentArray || [])
        .map(line => {
          if (!line) return '>';
          
          // Apply emoji fixes
          const fixedLine = this.fixEmojiFormatting(line);
          // Format the line with the text processor
          const formattedLine = this.textProcessor.formatLine(
            fixedLine, 
            this.settings.enableMentions, 
            this.settings.enableEmoji
          );
          
          return `> ${formattedLine}`;
        })
        .join('\n');
      
      formatted.push(processedContent);
      formatted.push('');  // Add blank line between messages
    }
    
    return formatted.join('\n');
  }
  
  /**
   * Specialized method for fixing doubled usernames
   * Enhanced algorithm focusing on common doubled username patterns in Slack
   *
   * This method handles cases where usernames are duplicated in Slack pastes, such as:
   * - "John SmithJohn Smith" -> "John Smith"
   * - "John Smith John Smith" -> "John Smith"
   *
   * It delegates to the MessageParser's implementation for consistency across formatters
   *
   * @param username - Username string that may contain duplications
   * @returns Cleaned username with duplications removed
   */
  private fixDoubledUsername(username: string): string {
    return this.messageParser.fixDuplicatedUsernamePublic(username);
  }
  
  /**
   * Fix common emoji formatting issues in text
   * This is a pre-processing step before normal parsing
   *
   * Handles several emoji format patterns that appear in Slack pastes:
   * 1. Exclamation mark pattern: ![:emoji:] -> :emoji:
   * 2. Brackets with numbers: [:emoji:]27 -> :emoji: 27
   * 3. Simple bracketed emoji: [:emoji:] -> :emoji:
   * 4. Emoji with URL: :emoji-name:(url) -> :emoji-name:
   *
   * @param text - Text to process
   * @returns Text with fixed emoji formatting
   */
  public fixEmojiFormatting(text: string): string {
    if (!text) return text;
    
    // Fix various emoji formats
    return text
      // Fix emoji with exclamation mark pattern: ![:emoji:] -> :emoji:
      .replace(/!\[:([a-z0-9_\-\+]+):\]/gi, ':$1:')
      // Fix emoji with brackets + number pattern: [:emoji:]27 -> :emoji: 27
      .replace(/\[:([a-z0-9_\-\+]+):\](\d+)/g, ':$1: $2')
      // Fix bracketed emoji with no numbers: [:emoji:] -> :emoji:
      .replace(/\[:([a-z0-9_\-\+]+):\]/g, ':$1:')
      // Fix emoji with URL pattern: :emoji-name:(url) -> :emoji-name:
      .replace(/:([a-z0-9_\-\+]+):\(https?:\/\/[^)]+\)/gi, ':$1:');
  }
}
