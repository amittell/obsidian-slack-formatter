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

/**
 * SimpleFormatter class for Slack messages
 * Focuses on parsing the core structure of Slack messages by
 * detecting doubled usernames and using timestamp markers as delimiters
 */
export class SimpleFormatter {
  private textProcessor: TextProcessor;
  private messageParser: MessageParser;
  private settings: SlackFormatSettings;

  constructor(
    settings: SlackFormatSettings,
    userMap: Record<string, string>,
    emojiMap: Record<string, string>,
    channelMap: Record<string, string>
  ) {
    this.settings = settings;
    this.messageParser = new MessageParser();
    this.textProcessor = new TextProcessor(userMap, emojiMap, channelMap);
  }

  /**
   * Main formatting function to convert Slack text to Markdown
   */
  public formatSlackContent(input: string): string {
    if (!input) return '';
    
    // Fix common formatting issues like emoji before parsing
    input = this.fixFormatting(input);
    
    // Use timestamp-based algorithm to parse messages
    const messages = this.parseWithTimestampBoundaries(input);
    
    // Format the messages to Markdown
    return this.formatMessagesToMarkdown(messages);
  }

  /**
   * Improved parsing that focuses on timestamp boundaries first,
   * then processes usernames and content
   */
  private parseWithTimestampBoundaries(input: string): ParsedMessage[] {
    const lines = input.split('\n');
    
    // First identify all timestamps to find message boundaries
    const timestampIndices: {index: number, timestamp: string}[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Look for timestamps in the format [HH:MM AM/PM]
      const timestampMatch = line.match(/\[(\d{1,2}:\d{2}\s*(?:AM|PM))\]/i);
      
      if (timestampMatch) {
        timestampIndices.push({
          index: i,
          timestamp: timestampMatch[1]
        });
      }
      
      // Also check for date headers to keep track of the conversation timeline
      if (this.isDateHeader(line)) {
        timestampIndices.push({
          index: i,
          timestamp: "DATE_HEADER"
        });
      }
    }
    
    // Now process each section between timestamps
    const messages: ParsedMessage[] = [];
    
    for (let i = 0; i < timestampIndices.length; i++) {
      const currentIndex = timestampIndices[i].index;
      const nextIndex = i + 1 < timestampIndices.length ? 
        timestampIndices[i + 1].index : lines.length;
      
      // Skip date headers
      if (timestampIndices[i].timestamp === "DATE_HEADER") {
        continue;
      }
      
      // Extract the chunk of lines for this message
      const messageLines = lines.slice(currentIndex, nextIndex);
      
      // Process the message
      const message = this.extractMessageFromLines(messageLines, timestampIndices[i].timestamp);
      
      if (message) {
        messages.push(message);
      }
    }
    
    return messages;
  }

  /**
   * Check if a line is a date header
   */
  private isDateHeader(line: string): boolean {
    // Check for common date header formats
    const dateHeaderPatterns = [
      /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i,
      /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i,
      /^(?:Today|Yesterday)/i,
      /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i
    ];
    
    return dateHeaderPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Extract message details from a group of lines
   */
  private extractMessageFromLines(lines: string[], timestamp: string): ParsedMessage | null {
    if (!lines.length) return null;
    
    // Find the author from the first line with the timestamp
    const firstLine = lines[0].trim();
    
    // Extract author name from before the timestamp
    let author = "";
    const beforeTimestamp = firstLine.substring(0, firstLine.indexOf('['));
    
    if (beforeTimestamp.trim()) {
      // Username is before the timestamp
      author = this.fixDoubledUsername(beforeTimestamp.trim());
    } else {
      // Username might be after the timestamp
      const afterTimestamp = firstLine.substring(firstLine.indexOf(']') + 1).trim();
      
      if (afterTimestamp) {
        const nameMatch = afterTimestamp.match(/^([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)+)/);
        if (nameMatch) {
          author = this.fixDoubledUsername(nameMatch[1]);
        } else {
          author = "Unknown User";
        }
      } else {
        author = "Unknown User";
      }
    }
    
    // Extract date information if available
    let date: string | undefined;
    const dateMatch = firstLine.match(/\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?)\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)\]/i);
    if (dateMatch) {
      date = dateMatch[1]; // e.g., "Feb 6th"
    }
    
    // Process the content lines
    const contentLines: string[] = [];
    let reactionLines: string[] = [];
    let threadInfo: string | undefined;
    let inReactionBlock = false;
    
    // Skip the first line as it contains the author and timestamp
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        contentLines.push('');
        continue;
      }
      
      // Check for thread info lines
      if (/^\d+ repl(?:y|ies)$/i.test(line) || /^Last reply/i.test(line) || /^View thread/i.test(line)) {
        threadInfo = line;
        continue;
      }
      
      // Check for reaction lines
      if (/^(?:!?\[:[\w\-]+:\]|:[\w\-]+:)\s*\d+/.test(line)) {
        inReactionBlock = true;
        reactionLines.push(line);
        continue;
      }
      
      // Skip lines that contain only avatar images
      if (/^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/.test(line)) {
        continue;
      }
      
      // Skip lines that are just small user avatars (typically showing reactions/replies)
      if (/^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\-\d+\)/.test(line)) {
        continue;
      }
      
      // If we're in a reaction block, continue collecting reactions
      if (inReactionBlock && /^(?:!?\[:[\w\-]+:\]|:[\w\-]+:)/.test(line)) {
        reactionLines.push(line);
        continue;
      }
      
      // Regular content line
      contentLines.push(line);
    }
    
    return {
      author,
      timestamp,
      date,
      lines: contentLines,
      reactions: reactionLines.length > 0 ? reactionLines : undefined,
      threadInfo
    };
  }

  /**
   * Specialized method for fixing doubled usernames
   * Enhanced algorithm focusing on common doubled username patterns in Slack
   */
  private fixDoubledUsername(username: string): string {
    if (!username) return username;
    
    // NEW PATTERN: Look for usernames followed by emoji indicators
    // Like "Byron LukByron Luk![:no_entry:]"
    const emojiMatch = username.match(/^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)!?\[:/i);
    if (emojiMatch) {
      // Extract the username part before the emoji indicator
      return this.fixBasicDoubledUsername(emojiMatch[1] + emojiMatch[2]);
    }
    
    // Pattern for exact duplication with emoji: "Clement MiaoClement Miao![:no_entry:]"
    const exactEmojiMatch = username.match(/^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)!?\[:/i);
    if (exactEmojiMatch) {
      const name1 = exactEmojiMatch[1].toLowerCase().replace(/\s+/g, '');
      const name2 = exactEmojiMatch[2].toLowerCase().replace(/\s+/g, '');
      if (name1 === name2) {
        return exactEmojiMatch[1];
      }
    }
    
    // Handle cases with no emoji
    return this.fixBasicDoubledUsername(username);
  }
  
  /**
   * Core duplicate username detection and fixing
   */
  private fixBasicDoubledUsername(username: string): string {
    if (!username) return username;
    
    // Check for exact doubled username pattern (e.g., "John SmithJohn Smith")
    // For users with two-part names
    const exactDupePattern = /^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)$/i;
    const exactDupeMatch = username.match(exactDupePattern);
    if (exactDupeMatch) {
      // Compare the two parts by removing spaces and converting to lowercase
      const name1 = exactDupeMatch[1].toLowerCase().replace(/\s+/g, '');
      const name2 = exactDupeMatch[2].toLowerCase().replace(/\s+/g, '');
      
      // If they're the same, return just the first occurrence
      if (name1 === name2) {
        return exactDupeMatch[1];
      }
      
      // If they're not exactly the same but very similar (possible missing space)
      if (name1.includes(name2) || name2.includes(name1)) {
        return exactDupeMatch[1].length > exactDupeMatch[2].length ? 
          exactDupeMatch[1] : exactDupeMatch[2];
      }
    }
    
    // Handle case: "First LastFirst Last" (missing space between)
    const noSpaceMatch = username.match(/^([A-Za-z]+)\s+([A-Za-z]+)([A-Za-z]+)\s+([A-Za-z]+)$/i);
    if (noSpaceMatch) {
      const firstName1 = noSpaceMatch[1].toLowerCase();
      const lastName1 = noSpaceMatch[2].toLowerCase();
      const firstName2 = noSpaceMatch[3].toLowerCase();
      const lastName2 = noSpaceMatch[4].toLowerCase();
      
      if (firstName1 === firstName2 && lastName1 === lastName2) {
        return `${noSpaceMatch[1]} ${noSpaceMatch[2]}`;
      }
    }
    
    // Look for two-part names (e.g., "First Last")
    const namePattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)/;
    const nameMatch = username.match(namePattern);
    if (nameMatch) {
      return nameMatch[1];
    }
    
    // Fallback to original username if no pattern matches
    return username;
  }

  /**
   * Format parsed messages into Markdown
   */
  private formatMessagesToMarkdown(messages: ParsedMessage[]): string {
    if (messages.length === 0) return '';
    
    return messages.map(message => {
      // Format the username - add wiki link if it's a valid username
      const userDisplay = this.messageParser.isValidUsername(message.author) ? 
        `[[${message.author}]]` : message.author;
      
      // Format the message with the text processor
      return this.textProcessor.formatMessage(
        userDisplay,
        message.timestamp,
        message.date || '',
        '',  // No avatar handling in simple formatter
        message.lines,
        message.threadInfo || '',
        message.reactions || null,
        {
          enableTimestampParsing: this.settings.enableTimestampParsing,
          enableEmoji: this.settings.enableEmoji,
          enableMentions: this.settings.enableMentions
        },
        (timeStr) => this.normalizeTimeFormat(timeStr)
      );
    }).join('\n\n');
  }

  /**
   * Fix common formatting issues in text
   */
  private fixFormatting(text: string): string {
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

  /**
   * Normalize time format for consistent display
   */
  private normalizeTimeFormat(timeStr: string): string {
    if (!timeStr) return timeStr;
    
    // First check if we have a valid time format with AM/PM
    const timePattern = /^(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?$/i;
    const match = timeStr.match(timePattern);
    
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = match[2];
      let ampm = match[3];
      
      // If no AM/PM specified but hour is 0-11, assume AM; if 12-23, convert to 12-hour format PM
      if (!ampm) {
        if (hour >= 12) {
          // Convert 24-hour to 12-hour format
          const hour12 = hour === 12 ? 12 : hour - 12;
          ampm = 'PM';
          return `${hour12}:${minute} ${ampm}`;
        } else if (hour === 0) {
          // Special case for midnight
          return `12:${minute} AM`;
        } else {
          // Assume AM for morning hours without AM/PM
          return `${hour}:${minute} AM`;
        }
      } else {
        // Ensure consistent capitalization for AM/PM
        ampm = ampm.toUpperCase();
        return `${hour}:${minute} ${ampm}`;
      }
    }
    
    return timeStr;
  }
}
