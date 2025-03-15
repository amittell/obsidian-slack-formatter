/**
 * Simple Slack Message Formatter
 * Based on pattern matching for consistent message boundaries
 * Focuses on doubled username detection and message grouping
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
  
  // Debug logging helper
  private debug(message: string, data?: any): void {
    console.log(`[SlackFormat:Simple] ${message}`, data || '');
  }
  
  /**
   * Format a string of Slack content into a Markdown callout format
   * This uses a simpler algorithm focused on timestamp detection
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
    
    return this.processLines(lines);
  }
  
  /**
   * Core processing algorithm
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
          currentMessage.content.push(remainingContent);
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
            this.messageParser.fixDuplicatedUsername(firstUserMatch[1]) : 'Unknown user';
          
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
   */
  private findTimestampInLine(line: string): { 
    author: string; 
    timestamp: string; 
    date?: string;
    remainingContent?: string; 
  } | null {
    // Check for the most common pattern - username followed by bracketed timestamp
    // Example: "Alex Mittell [2:45 PM]" or "Alex Mittell [Feb 7th at 2:45 PM]"
    const nameWithTimestamp = line.match(/^([A-Za-z0-9][\w\s]+?)\s+\[(?:(?:[A-Za-z]+\s+\d+(?:st|nd|rd|th)?\s+at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)))\]/i);
    if (nameWithTimestamp) {
      const authorName = this.messageParser.fixDuplicatedUsername(nameWithTimestamp[1]);
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
    const timestampWithName = line.match(/^\[(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]\s*([A-Za-z0-9][\w\s]+?)(?::|$)/i);
    if (timestampWithName) {
      const authorName = this.messageParser.fixDuplicatedUsername(timestampWithName[2]);
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
    
    // Check for timestamp only pattern
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
      
      // Process content
      const processedContent = message.content
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
   */
  private fixDoubledUsername(username: string): string {
    return this.messageParser.fixDuplicatedUsername(username);
  }
  
  /**
   * Fix common emoji formatting issues in text
   * This is a pre-processing step before normal parsing
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
