/**
 * StandardFormatHandler.ts
 * Implements the standard message format strategy
 * 
 * This handler processes the most common Slack message formats with
 * standard username and timestamp patterns.
 */
import { SlackFormatterSettings } from "../types";
import { SlackMessage } from "./message-parser";
import { BaseFormatHandler } from "./message-format-strategy";

export class StandardFormatHandler extends BaseFormatHandler {
  // Regex pattern constants for message detection
  private static readonly USERNAME_TIMESTAMP_PATTERN = /^([A-Z][a-z]+(?:[-'\s]*(?:Mc|Mac)?[A-Z][a-z]+)*)(?::[^:]+:)??\s+\[.*?(?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?\d{1,2}:\d{2}\s*(?:AM|PM).*?\]/i;
  private static readonly MESSAGE_START_PATTERN = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+((?:Yesterday|Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[A-Z][a-z]{2,3})(?:\s+\d{1,2}(?:st|nd|rd|th)?)?(?:\s+at)?\s+\d{1,2}:\d{2}\s*(?:AM|PM))$/i;
  private static readonly AVATAR_URL_PATTERN = /^(?:!\[[^\]]*\])?\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/;
  private static readonly SLACK_URL_PATTERN = /slack\.com\/archives\//;
  private static readonly EMOJI_PATTERN = /:[a-z0-9_\-\+]+:/i;
  
  /**
   * Creates a new StandardFormatHandler
   * 
   * @param settings - Formatter settings
   */
  constructor(settings: SlackFormatterSettings) {
    super(settings);
  }
  
  /**
   * Check if this handler can process the given text
   * 
   * The standard handler can process text that:
   * - Contains Slack URLs
   * - Has standard username-timestamp patterns
   * - Contains avatar URLs
   * - Has emoji patterns
   * 
   * @param text - Text to check
   * @returns True if this handler can process the text
   */
  public canHandle(text: string): boolean {
    if (!text || text.length < 20) return false;
    
    // Check for Slack URLs
    if (text.includes('slack.com/archives/') || 
        text.includes('ca.slack-edge.com/') || 
        text.includes('files.slack.com/files-')) {
      return true;
    }
    
    // Check for standard username-timestamp patterns
    const lines = text.split('\n');
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      if (StandardFormatHandler.USERNAME_TIMESTAMP_PATTERN.test(line) || 
          StandardFormatHandler.MESSAGE_START_PATTERN.test(line)) {
        return true;
      }
      
      // Check for avatar URLs
      if (StandardFormatHandler.AVATAR_URL_PATTERN.test(line)) {
        return true;
      }
    }
    
    // Check for emoji patterns
    if (StandardFormatHandler.EMOJI_PATTERN.test(text)) {
      return true;
    }
    
    // Count timestamps as a heuristic
    const timestampMatches = text.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/ig);
    if (timestampMatches && timestampMatches.length >= 3) {
      return true;
    }
    
    return false;
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
    
    // Remove note markers
    text = text.replace(/>$$ !note $$\+.*?\n/g, '');
    
    // Remove quote markers
    text = text.replace(/^>\s*/gm, '');
    
    // Remove exclamation marks
    text = text.replace(/^!+$/gm, '');
    
    // Remove thread reply markers
    text = text.replace(/^!!!!!\d*\s*replies?$/gm, '');
    
    // Remove Slack image URLs
    text = text.replace(/^$$ https:\/\/ca\.slack-edge\.com\/.* $$$/gm, '');
    text = text.replace(/^https:\/\/ca\.slack-edge\.com\/.*$/gm, '');
    
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
    
    // Regex for date headers like "Friday, February 14th" or "Yesterday"
    const datePattern = this.dateTimeProcessor.isDateLine.bind(this.dateTimeProcessor);
    
    // Pattern for duplicated names like "Bob KrentlerBob Krentler" 
    const duplicatedNamePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+((?:Yesterday|Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[A-Z][a-z]{2,3})(?:\s+\d{1,2}(?:st|nd|rd|th)?)?(?:\s+at)?\s+\d{1,2}:\d{2}\s*(?:AM|PM))$/i;
    
    // Regular pattern for user + timestamp combinations
    const messagePattern = /^([A-Z][a-z]+(?:\s*[A-Z][a-z]+)*(?:(?:!?\[:[^:]+:\](?:\([^)]+\))?)|(?::[^:]+:))?)?\s+((?:\[)?(?:(?:Today|Yesterday|[A-Z][a-z]{2,3}\s+\d+(?:st|nd|rd)?|\w+)(?:\s+at\s+)?)?\d{1,2}:\d{2}\s*(?:AM|PM)(?:\](?:\(.*?\))?)?(?:[\s*]|$))/;
    
    // Improved indentation pattern for timestamps that appear on their own line
    const isIndentedTimestamp = this.dateTimeProcessor.isIndentedTimestamp.bind(this.dateTimeProcessor);
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      
      // Check for date headers
      if (datePattern(line)) {
        if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
          messages.push(currentMessage);
          currentMessage = null;
        }
        continue; // Skip date headers in output
      }
      
      // Check for duplicated name pattern first
      const duplicatedMatch = line.match(duplicatedNamePattern);
      if (duplicatedMatch) {
        // Save previous message if any
        if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message with username and timestamp
        currentMessage = new SlackMessage();
        // Use only one instance of the name
        const username = this.fixDuplicatedUsername(duplicatedMatch[1]);
        currentMessage.username = username;
        currentMessage.timestamp = duplicatedMatch[3];
        
        // Save message ID to avoid duplicates
        this.seenMessages.add(this.generateMessageKey(username, currentMessage.timestamp, ''));
        continue;
      }
      
      // Check for enhanced message start format
      const messageStartMatch = line.match(StandardFormatHandler.MESSAGE_START_PATTERN);
      if (messageStartMatch) {
        // Save previous message if any
        if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message with username and timestamp
        currentMessage = new SlackMessage();
        const username = this.fixDuplicatedUsername(messageStartMatch[1]);
        currentMessage.username = username;
        currentMessage.timestamp = messageStartMatch[2];
        
        // Save message ID to avoid duplicates
        this.seenMessages.add(this.generateMessageKey(username, currentMessage.timestamp, ''));
        continue;
      }
      
      // Check for indented timestamp pattern
      if (isIndentedTimestamp(line) && i > 0) {
        const indentedTimestamp = this.dateTimeProcessor.extractIndentedTimestamp(line);
        if (indentedTimestamp && lines[i-1].trim()) {
          // The previous line is likely the username
          const username = lines[i-1].trim();
          
          // Only process if this looks like a valid username
          if (this.isLikelyUsername(username)) {
            // Save previous message if any
            if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
              messages.push(currentMessage);
            }
            
            // Create new message
            currentMessage = new SlackMessage();
            const cleanUsername = this.fixDuplicatedUsername(username);
            currentMessage.username = cleanUsername;
            currentMessage.timestamp = indentedTimestamp;
            
            // Save message ID to avoid duplicates
            this.seenMessages.add(this.generateMessageKey(cleanUsername, indentedTimestamp, ''));
            
            // Skip both username and timestamp lines
            i++; 
            continue;
          }
        }
      }
      
      // Check for avatar images followed by username
      if (StandardFormatHandler.AVATAR_URL_PATTERN.test(line) && i + 1 < lines.length) {
        // Look ahead to the next line for username and timestamp
        const nextLine = lines[i + 1].trim();
        
        // Try to detect if the next line contains a username + timestamp format
        const usernameMatch = nextLine.match(/^([A-Z][a-z]+(?:[-'\s]*[A-Z][a-z]+)*)/);
        const timestampMatch = this.dateTimeProcessor.parseTimestamp(nextLine);
        
        if (usernameMatch && timestampMatch) {
          // Save previous message if any
          if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
            messages.push(currentMessage);
          }
          
          // Create new message
          currentMessage = new SlackMessage();
          currentMessage.avatar = line;
          const username = this.fixDuplicatedUsername(usernameMatch[0]);
          currentMessage.username = username;
          currentMessage.timestamp = timestampMatch;
          
          // Save message ID to avoid duplicates
          this.seenMessages.add(this.generateMessageKey(username, timestampMatch, ''));
          
          // Skip the next line since we've already processed it
          i++;
          continue;
        }
      }
      
      // Check for normal message pattern as last resort
      const match = line.match(messagePattern);
      
      if (match && match[1] && match[2]) {
        // Save previous message if any
        if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message with cleaned username and timestamp
        currentMessage = new SlackMessage();
        
        // Fix duplicated username
        const username = this.fixDuplicatedUsername(match[1].trim());
        currentMessage.username = username;
        currentMessage.timestamp = this.dateTimeProcessor.formatTimestamp(match[2]);
        
        // Save message ID to avoid duplicates
        this.seenMessages.add(this.generateMessageKey(username, currentMessage.timestamp, ''));
      } 
      // Handle lines that have content for the current message
      else if (currentMessage) {
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
    if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
      messages.push(currentMessage);
    }
    
    return messages;
  }
  
  /**
   * Check if a string is likely a username
   * 
   * @param text - Text to check
   * @returns True if the text is likely a username
   */
  private isLikelyUsername(text: string): boolean {
    if (!text) return false;
    
    const commonWords = [
      'interested', 'current', 'that', 'let', 'added', 'view', 'thread',
      'replied', 'saved', 'pinned', 'posted', 'loading', 'show', 'was',
      'has', 'is', 'for', 'with', 'the', 'to', 'in', 'on', 'at', 'made',
      'good', 'news', 'mobile', 'last', 'view', 'newer', 'replies'
    ];
    
    // First, clean up the text to remove any emoji formatting
    const cleanedText = this.emojiProcessor.stripEmoji(text);
    const words = cleanedText.toLowerCase().split(/\s+/);
    
    if (commonWords.includes(words[0]) || words.length > 3) return false;
    
    // Fix doubled username pattern (e.g., "Adil SadikAdil Sadik")
    const deduped = cleanedText.replace(/([A-Z][a-z]+\s+[A-Z][a-z]+)\1/, '$1').trim();
    
    // Improved pattern for usernames that may have repeated parts
    return /^[A-Z][a-z]+(?:[-'\s]*(?:Mc|Mac)?[A-Z][a-z]+)*(?::[^:]+:)?$/.test(deduped);
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
      /^\+\d*$/,
      /^[A-Z][a-z]+,\s+[A-Z][a-z]+\s+\d+(?:st|nd|rd|th)$/i,
      /^Yesterday$/i,
      /^Language$/i,
      /^Last updated$/i,
      /^\d+\s+minutes\s+ago$/i,
      /^https?:\/\/ca\.slack-edge\.com\//i,
      /^\d+ repl(y|ies)$/i,
      /^\(https:\/\/ca\.slack-edge\.com\/.*\)$/
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