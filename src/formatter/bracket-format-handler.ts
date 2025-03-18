/**
 * BracketFormatHandler.ts
 * Implements the bracket timestamp format strategy
 * 
 * This handler processes Slack messages with bracket-style timestamps
 * like "[10:42 AM] User: Message" or "User [10:42 AM]: Message".
 */
import { SlackFormatterSettings } from "../types";
import { SlackMessage } from "./message-parser";
import { BaseFormatHandler } from "./message-format-strategy";

export class BracketFormatHandler extends BaseFormatHandler {
  // Regex pattern constants for bracket timestamp format detection
  private static readonly BRACKET_TIMESTAMP_PATTERN = /\[\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\]/i;
  private static readonly NAME_WITH_TIMESTAMP_PATTERN = /^([A-Za-z0-9][\w\s]+?)\s+\[(?:(?:[A-Za-z]+\s+\d+(?:st|nd|rd|th)?\s+at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)))\]/i;
  private static readonly TIMESTAMP_WITH_NAME_PATTERN = /^\[(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]\s*([A-Za-z0-9][\w\s]+?)(?::|$)/i;
  private static readonly TIMESTAMP_ONLY_PATTERN = /^\[(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\](.*)$/i;
  
  /**
   * Creates a new BracketFormatHandler
   * 
   * @param settings - Formatter settings
   */
  constructor(settings: SlackFormatterSettings) {
    super(settings);
  }
  
  /**
   * Check if this handler can process the given text
   * 
   * The bracket handler can process text that:
   * - Contains multiple bracket-style timestamps [10:42 AM]
   * - Has consistent bracket timestamp patterns
   * 
   * @param text - Text to check
   * @returns True if this handler can process the text
   */
  public canHandle(text: string): boolean {
    if (!text) return false;
    
    // Count bracket timestamps as a heuristic
    const bracketTimestampCount = (text.match(BracketFormatHandler.BRACKET_TIMESTAMP_PATTERN) || []).length;
    return bracketTimestampCount >= 2;
  }
  
  /**
   * Format the input text into structured messages
   * 
   * @param input - Raw Slack text to format
   * @returns Array of parsed SlackMessage objects
   */
  public format(input: string): SlackMessage[] {
    if (!input) return [];
    
    // Clear seen messages for a fresh parse
    this.seenMessages.clear();
    
    // Preprocess the input
    input = this.preprocessText(input);
    
    // Parse the messages
    return this.parseMessages(input);
  }
  
  /**
   * Preprocess the input text to fix common formatting issues
   * 
   * @param text - Text to preprocess
   * @returns Preprocessed text
   */
  private preprocessText(text: string): string {
    if (!text) return text;
    
    // Fix emoji formatting
    return this.emojiProcessor.fixEmojiFormatting(text);
  }
  
  /**
   * Parse messages from the input text
   * 
   * @param text - Text to parse
   * @returns Array of parsed SlackMessage objects
   */
  private parseMessages(text: string): SlackMessage[] {
    const lines = text.split('\n');
    const messages: SlackMessage[] = [];
    let currentMessage: SlackMessage | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check for the most common pattern - username followed by bracketed timestamp
      // Example: "Alex Mittell [2:45 PM]" or "Alex Mittell [Feb 7th at 2:45 PM]"
      const nameWithTimestamp = line.match(BracketFormatHandler.NAME_WITH_TIMESTAMP_PATTERN);
      if (nameWithTimestamp) {
        // Save previous message if any
        if (currentMessage && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message
        currentMessage = new SlackMessage();
        const username = this.fixDuplicatedUsername(nameWithTimestamp[1]);
        currentMessage.username = username;
        currentMessage.timestamp = nameWithTimestamp[2];
        
        // Extract optional date info
        const dateMatch = line.match(/\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?)\s+at/i);
        if (dateMatch) {
          currentMessage.date = dateMatch[1];
        }
        
        // Get the remainder of the line after the timestamp
        const closeBracketPos = line.indexOf(']');
        const remainder = closeBracketPos > 0 ? line.substring(closeBracketPos + 1).trim() : '';
        
        if (remainder) {
          currentMessage.content.push(remainder);
        }
        
        continue;
      }
      
      // Check for the bracketed timestamp first pattern - "[2:45 PM] Username"
      const timestampWithName = line.match(BracketFormatHandler.TIMESTAMP_WITH_NAME_PATTERN);
      if (timestampWithName) {
        // Save previous message if any
        if (currentMessage && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message
        currentMessage = new SlackMessage();
        const username = this.fixDuplicatedUsername(timestampWithName[2]);
        currentMessage.username = username;
        currentMessage.timestamp = timestampWithName[1];
        
        // Get content after the username and colon if present
        const colonPos = line.indexOf(':', line.indexOf(timestampWithName[2]));
        const remainder = colonPos > 0 ? line.substring(colonPos + 1).trim() : '';
        
        if (remainder) {
          currentMessage.content.push(remainder);
        }
        
        continue;
      }
      
      // Check for timestamp only pattern (no clear username)
      const timestampOnly = line.match(BracketFormatHandler.TIMESTAMP_ONLY_PATTERN);
      if (timestampOnly) {
        // Save previous message if any
        if (currentMessage && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message
        currentMessage = new SlackMessage();
        currentMessage.username = "Unknown";
        currentMessage.timestamp = timestampOnly[1];
        
        const remainder = timestampOnly[2].trim();
        if (remainder) {
          currentMessage.content.push(remainder);
        }
        
        continue;
      }
      
      // If none of the above patterns match and we have a current message,
      // add this line to the current message's content
      if (currentMessage) {
        // Skip system messages and possible user indicators unless they're reactions
        if (this.isSystemMessage(line) && !line.match(/^[+]\d+$/) && !line.match(/^:[a-z0-9_\-]+:/)) {
          const threadInfo = this.parseThreadInfo(line);
          if (threadInfo) {
            currentMessage.isThread = true;
            currentMessage.threadInfo = threadInfo;
          }
        } else {
          // Process line content
          const processedLine = this.processMessageLine(line);
          if (processedLine) {
            currentMessage.content.push(processedLine);
          }
        }
      }
    }
    
    // Add the last message if any
    if (currentMessage && currentMessage.content.length > 0) {
      messages.push(currentMessage);
    }
    
    return messages;
  }
  
  /**
   * Check if a line is a system message
   * 
   * @param text - Text to check
   * @returns True if the text is a system message
   */
  private isSystemMessage(text: string): boolean {
    const systemPatterns = [
      /^Added by/i,
      /^Current users/i,
      /^Thread with/i,
      /^View (thread|repl(y|ies))/i,
      /^Last reply/i,
      /^Show more/i,
      /^Loading more/i,
      /^Pinned by/i,
      /^Saved by/i,
      /^Only visible to/i,
      /^This message/i,
      /^Posted in/i,
      /^\d+ repl(y|ies)/i,
      /^Reply in thread/i,
      /^\[!note\]/i,
      /^!+$/,
      /^\+\d*$/
    ];
    return systemPatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Parse thread info from a line
   * 
   * @param line - Line to parse
   * @returns Thread info or null if not found
   */
  private parseThreadInfo(line: string): string | null {
    if (!line) return null;
    const trimmedLine = line.trim();
    const threadPatterns = [
      /^(?:View thread|Reply in thread)$/i,
      /^(\d+) repl(?:y|ies)$/i,
      /^(\d+) messages? in thread$/i,
      /^Last reply/i,
      /^Thread with/i,
      /^🧵\s+(.+)$/i
    ];
    for (const pattern of threadPatterns) {
      if (pattern.test(trimmedLine)) {
        return trimmedLine;
      }
    }
    return null;
  }
  
  /**
   * Process a message line
   * 
   * @param line - Line to process
   * @returns Processed line
   */
  private processMessageLine(line: string): string {
    line = this.emojiProcessor.fixEmojiFormatting(line);
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    line = line.replace(/!\[:([^:]+):\]\([^)]+\)/g, ':$1:');
    line = line.replace(/^\]\((https:\/\/[^.]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+)/, '');
    line = line.replace(/^!\[(.*?)\]/, '$1');
    return line;
  }
  
  /**
   * Fix duplicated usernames
   * 
   * @param username - Username to fix
   * @returns Fixed username
   */
  private fixDuplicatedUsername(username: string): string {
    if (!username) return "Unknown user";
    
    // Clean the username first (remove emojis, etc.)
    let cleanUsername = this.emojiProcessor.stripEmoji(username);
    
    // Look for exact duplicates like "Adil SadikAdil Sadik"
    const exactDuplicatePattern = /^(.+?)(?:\s*\1)+$/;
    const exactMatch = cleanUsername.match(exactDuplicatePattern);
    if (exactMatch) {
      return exactMatch[1];
    }
    
    // Check for repeating name patterns without space
    // Like "AdilSadikAdilSadik" -> "Adil Sadik"
    const nameParts = cleanUsername.match(/^([A-Z][a-z]+)([A-Z][a-z]+)\1\2$/);
    if (nameParts) {
      return `${nameParts[1]} ${nameParts[2]}`;
    }
    
    // Check for repeating first/last name combinations
    // Like "Adil Sadik Adil Sadik" -> "Adil Sadik"
    const words = cleanUsername.split(/\s+/);
    if (words.length >= 4 && words.length % 2 === 0) {
      const firstHalf = words.slice(0, words.length/2).join(' ');
      const secondHalf = words.slice(words.length/2).join(' ');
      
      if (firstHalf === secondHalf) {
        return firstHalf;
      }
    }
    
    // Remove duplicate words (keep order)
    if (words.length >= 2) {
      const uniqueParts = [...new Set(words)];
      return uniqueParts.join(' ');
    }
    
    return cleanUsername;
  }
}