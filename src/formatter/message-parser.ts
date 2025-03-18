/**
 * MessageParser.ts
 * Parses raw Slack text into structured message objects for formatting
 *
 * This module contains the core parsing logic for Slack messages, handling various
 * message formats, username patterns, timestamps, and special formatting.
 * It implements a multi-strategy approach to parsing, with fallback mechanisms
 * for different Slack export and copy/paste formats.
 */
import { FormatMode, SlackFormatterSettings } from "../types";
import { TextProcessor } from "./text-processor";

export class SlackMessage {
  username: string;
  timestamp: string | null;
  content: string[];
  reactions: string[];
  avatar: string | null;
  date: string | null;
  isThread: boolean;
  threadInfo: string | null;
  hasNesting: boolean;
  constructor() {
    this.username = "Unknown user";
    this.timestamp = null;
    this.content = [];
    this.reactions = [];
    this.avatar = null;
    this.date = null;
    this.isThread = false;
    this.threadInfo = null;
    this.hasNesting = false;
  }
}

export class MessageParser {
  // Regex pattern constants for improved readability and maintainability
  private static readonly USERNAME_PATTERN = /^[A-Z][a-z]+(?:[-'\s]*(?:Mc|Mac)?[A-Z][a-z]+)*(?::[^:]+:)?$/;
  private static readonly USERNAME_TIMESTAMP_PATTERN = /^([A-Z][a-z]+(?:[-'\s]*(?:Mc|Mac)?[A-Z][a-z]+)*)(?::[^:]+:)??\s+\[.*?(?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?\d{1,2}:\d{2}\s*(?:AM|PM).*?\]/i;
  private static readonly TIMESTAMP_PATTERN = /^\[((?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?(?:\d{1,2}:\d{2}\s*(?:AM|PM)))\]/i;
  private static readonly INDENTED_TIMESTAMP_PATTERN = /^\s+(\d{1,2}:\d{2}\s*(?:AM|PM))$/;
  private static readonly AVATAR_URL_PATTERN = /^(?:!\[[^\]]*\])?\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/;
  private static readonly DOUBLED_USERNAME_PATTERN = /^(.+?)(?:\s*\1)+$/;
  private static readonly APP_MESSAGE_PATTERN = /^([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?)\s+APP\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i;
  private static readonly DATE_PATTERN = /^(?:Yesterday|Today|\w+, \w+ \d{1,2}(?:th|st|nd|rd)?)$/;
  private static readonly THREAD_INFO_PATTERN = /^(?:View thread|Reply in thread)$/i;
  private static readonly THREAD_REPLY_COUNT_PATTERN = /^(\d+) repl(?:y|ies)$/i;
  
  private settings: SlackFormatterSettings;
  private textProcessor: TextProcessor;
  private seenMessages: Set<string>;
  private messageCache: Map<string, SlackMessage[]>;

  constructor(settings: SlackFormatterSettings) {
    this.settings = settings;
    this.textProcessor = new TextProcessor(
      settings.userMap || {},
      settings.emojiMap || {},
      settings.channelMap || {}
    );
    this.seenMessages = new Set();
    this.messageCache = new Map();
  }

  private isLikelyUsername(text: string): boolean {
    if (!text) return false;
    const commonWords = [
      'interested', 'current', 'that', 'let', 'added', 'view', 'thread',
      'replied', 'saved', 'pinned', 'posted', 'loading', 'show', 'was',
      'has', 'is', 'for', 'with', 'the', 'to', 'in', 'on', 'at', 'made',
      'good', 'news', 'mobile', 'last', 'view', 'newer', 'replies'
    ];
    
    // First, clean up the text to remove any emoji formatting
    const cleanedText = this.cleanUsername(text);
    const words = cleanedText.toLowerCase().split(/\s+/);
    
    if (commonWords.includes(words[0]) || words.length > 3) return false;
    
    // Fix doubled username pattern (e.g., "Adil SadikAdil Sadik")
    const deduped = cleanedText.replace(/([A-Z][a-z]+\s+[A-Z][a-z]+)\1/, '$1').trim();
    
    // Improved pattern for usernames that may have repeated parts
    return /^[A-Z][a-z]+(?:[-'\s]*(?:Mc|Mac)?[A-Z][a-z]+)*(?::[^:]+:)?$/.test(deduped);
  }

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

  private fixDuplicatedUsername(username: string): string {
    if (!username) return "Unknown user";
    
    // Clean the username first (remove emojis, etc.)
    let cleanUsername = this.cleanUsername(username);
    
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

  private cleanUsername(username: string): string {
    if (!username) return "";
    
    // Remove any emoji with URL formatting ![emoji](url)
    username = username.replace(/!\[:[^:]+:\]\([^)]+\)/g, '').trim();
    
    // Remove Slack text emojis :emoji:
    username = username.replace(/:[^:]+:/g, '').trim();
    
    // Remove whitespace
    username = username.replace(/\s+/g, ' ').trim();
    
    return username;
  }

  private parseTimestamp(line: string): string | null {
    if (!line) return null;
    const trimmed = line.trim();
    const hyperlinkMatch = trimmed.match(/\[(.*?)\]\(.*?\)/);
    if (hyperlinkMatch) {
      return hyperlinkMatch[1];
    }
    const patterns = [
      /^\[((?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?(?:\d{1,2}:\d{2}\s*(?:AM|PM)))\]/i,
      /^(?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM))$/i,
      /^\[([A-Z][a-z]{2}\s+\d+(?:st|nd|rd)?\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))\]/i
    ];
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    return null;
  }

  /**
   * Parses a message start from a line of text
   *
   * This method analyzes a line of text to determine if it represents the start of a new Slack message.
   * It handles multiple message formats including:
   * - Lines with avatar URLs followed by username and timestamp
   * - Lines with username and timestamp patterns
   * - Lines with app messages (e.g., "APP_NAME APP 10:30 AM")
   *
   * The method also tracks seen messages to prevent duplicates and handles
   * special cases like thread replies.
   *
   * @param line - The line of text to parse
   * @param lineIndex - The index of the line in the array of lines
   * @param lines - The complete array of lines for context
   * @returns An object containing the parsed message (or null if not a message start)
   *          and number of lines to skip in subsequent processing
   */
  private parseMessageStart(line: string, lineIndex: number, lines: string[]): {
    message: SlackMessage | null;
    skipLines: number;
  } {
    let message = new SlackMessage();
    let skipLines = 0;
    const spacedLine = line.trim();

    if (spacedLine.startsWith("replied to a thread:")) {
      return { message: null, skipLines: 0 };
    }

    if (this.isAvatarUrl(spacedLine) && lineIndex + 1 < lines.length) {
      const nextLine = lines[lineIndex + 1].trim();
      const usernameMatch = nextLine.match(/^([A-Z][a-z]+(?:[-'\s]*(?:Mc|Mac)?[A-Z][a-z]+)*)/);
      const timestampMatch = this.parseTimestamp(nextLine);

      if (usernameMatch && timestampMatch) {
        const username = this.fixDuplicatedUsername(usernameMatch[0]);
        const messageKey = `${username}|${timestampMatch}`;
        if (!this.seenMessages.has(messageKey)) {
          message.avatar = spacedLine;
          message.username = username;
          message.timestamp = timestampMatch;
          skipLines = 1;
          this.seenMessages.add(messageKey);
          return { message, skipLines };
        } else {
          skipLines = 1;
          return { message: null, skipLines };
        }
      }
    }

    const usernameTimestampPatterns = [
      /^([A-Z][a-z]+(?:[-'\s]*(?:Mc|Mac)?[A-Z][a-z]+)*)(?::[^:]+:)??\s+\[.*?(?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?\d{1,2}:\d{2}\s*(?:AM|PM).*?\]/i,
      /^([A-Z][a-z]+(?:[-'\s]*(?:Mc|Mac)?[A-Z][a-z]+)*)(?::[^:]+:)??\s+(?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?\d{1,2}:\d{2}\s*(?:AM|PM)/i
    ];

    for (const pattern of usernameTimestampPatterns) {
      const match = spacedLine.match(pattern);
      if (match) {
        const username = this.fixDuplicatedUsername(match[1]);
        const timestamp = this.parseTimestamp(spacedLine);
        if (timestamp) {
          const messageKey = `${username}|${timestamp}`;
          if (!this.seenMessages.has(messageKey)) {
            message.username = username;
            message.timestamp = timestamp;
            this.seenMessages.add(messageKey);
            return { message, skipLines: 0 };
          }
        }
        break;
      }
    }

    const appPattern: RegExp = /^([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?)\s+APP\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i;
    const appMatch = spacedLine.match(appPattern);
    if (appMatch) {
      message.username = `${appMatch[1].trim()} (APP)`;
      message.timestamp = appMatch[2];
      const contentStart = spacedLine.indexOf(appMatch[0]) + appMatch[0].length;
      if (contentStart < spacedLine.length) {
        const content = spacedLine.substring(contentStart).trim();
        if (content) {
          message.content.push(content);
        }
      }
      if (lineIndex + 1 < lines.length) {
        const nextLine = lines[lineIndex + 1].trim();
        if (nextLine && !this.isLikelyUsername(nextLine) && !this.isSystemMessage(nextLine)) {
          message.content.push(nextLine);
          skipLines = 1;
        }
      }
      return { message, skipLines };
    }

    return { message: null, skipLines: 0 };
  }

  private isAvatarUrl(line: string): boolean {
    return line.startsWith('!||') || line.match(/^https?:\/\/ca\.slack-edge\.com\//) !== null;
  }

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

  private parseMessages(text: string): SlackMessage[] {
    const lines = text.split('\n');
    const messages: SlackMessage[] = [];
    let currentMessage: SlackMessage | null = null;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      const { message, skipLines } = this.parseMessageStart(line, i, lines);
      if (message) {
        if (currentMessage && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        currentMessage = message;
        i += skipLines + 1;
        continue;
      }

      if (currentMessage) {
        if (this.isSystemMessage(line)) {
          const threadInfo = this.parseThreadInfo(line);
          if (threadInfo) {
            currentMessage.isThread = true;
            currentMessage.threadInfo = threadInfo;
          }
        } else if (!this.isLikelyUsername(line)) {
          const processedLine = this.processMessageLine(line);
          if (processedLine) {
            currentMessage.content.push(processedLine);
          }
        } else {
          const { message: newMessage } = this.parseMessageStart(line, i, lines);
          if (newMessage) {
            if (currentMessage.content.length > 0) {
              messages.push(currentMessage);
            }
            currentMessage = newMessage;
            i += skipLines + 1;
            continue;
          } else {
            const processedLine = this.processMessageLine(line);
            if (processedLine) {
              currentMessage.content.push(processedLine);
            }
          }
        }
      }
      i++;
    }

    if (currentMessage && currentMessage.content.length > 0) {
      messages.push(currentMessage);
    }

    return messages;
  }

  private processMessageLine(line: string): string {
    line = this.fixEmojiFormatting(line);
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    line = line.replace(/!\[:([^:]+):\]\([^)]+\)/g, ':$1:');
    line = line.replace(/^\]\((https:\/\/[^.]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+)/, '');
    line = line.replace(/^!\[(.*?)\]/, '$1');
    return line;
  }

  private fixEmojiFormatting(text: string): string {
    if (!text) return text;
    return text
      .replace(/!\[:([a-z0-9_\-\+]+):\]/gi, ':$1:')
      .replace(/\[:([a-z0-9_\-\+]+):\](\d+)/g, ':$1: $2')
      .replace(/\[:([a-z0-9_\-\+]+):\]/g, ':$1:')
      .replace(/:([a-z0-9_\-\+]+):\(https?:\/\/[^)]+\)/gi, ':$1:');
  }

  private isThreadView(text: string): boolean {
    if (!text) return false;
    const lines = text.split('\n');
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (line.match(/^(?:Thread with|View thread|Last reply|Reply in thread|\d+ repl(?:y|ies)$)/i)) {
        return true;
      }
    }
    return false;
  }

  private formatTimestamp(timestamp: string): string {
    if (!timestamp) return '';
    const hyperlinkMatch = timestamp.match(/\[(.*?)\]\(.*?\)/);
    if (hyperlinkMatch) {
      return this.formatTimestamp(hyperlinkMatch[1]);
    }
    return timestamp.replace(/^\[?(.*?)\]?$/, '$1');
  }

  public formatAsMarkdown(messages: SlackMessage[]): string {
    if (!messages || messages.length === 0) {
      return "No messages found to format.";
    }

    const result: string[] = [];

    messages.forEach((msg) => {
      const isApp = msg.username.includes('(APP)');
      const calloutType = isApp ? 'quote' : 'slack';
      const userLink = (!isApp && !msg.username.includes('Unknown')) ? `[[${msg.username}]]` : msg.username;

      let messageBlock = `>[!${calloutType}]+ Message from ${userLink}`;
      if (msg.timestamp) {
        messageBlock += `\n> **Time:** ${this.formatTimestamp(msg.timestamp)}`;
      }
      messageBlock += "\n>";

      let content = '';
      let inCodeBlock = false;

      msg.content.forEach((line, idx) => {
        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          content += `\n> ${line}`;
          return;
        }
        if (inCodeBlock) {
          content += `\n> ${line}`;
        } else {
          if (content && idx > 0) content += '\n> ';
          content += line;
        }
      });

      if (content) {
        messageBlock += `\n> ${content}`;
      }

      if (msg.isThread) {
        messageBlock += "\n> \n> 🧵 _This message has replies in a thread_";
      }

      result.push(messageBlock);
    });

    return result.join("\n\n");
  }

  /**
   * Parse messages using the simplified algorithm as a first pass
   * This is more effective at detecting standard Slack message formats
   */
  private parseSimpleMessages(text: string): SlackMessage[] {
    const lines = text.split('\n');
    const messages: SlackMessage[] = [];
    let currentMessage: SlackMessage | null = null;
    
    // Regex for date headers like "Friday, February 14th" or "Yesterday"
    const datePattern = /^(?:Yesterday|Today|\w+, \w+ \d{1,2}(?:th|st|nd|rd)?)$/;
    
    // Additional pattern for Guidewire-like format:
    // "Alex Mittell Feb 25th at 10:39 AM"
    const guidewirePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+([A-Z][a-z]{2}\s+\d{1,2}(?:st|nd|rd|th)?\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))$/;
    
    // Enhanced pattern for message-starting formats
    // This improved pattern better detects all name variations like
    // "Shannon Cullins Yesterday at 3:10 PM"
    const messageStartPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+((?:Yesterday|Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[A-Z][a-z]{2,3})(?:\s+\d{1,2}(?:st|nd|rd|th)?)?(?:\s+at)?\s+\d{1,2}:\d{2}\s*(?:AM|PM))$/i;
    
    // Pattern for duplicated names like "Bob KrentlerBob Krentler" 
    const duplicatedNamePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+((?:Yesterday|Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[A-Z][a-z]{2,3})(?:\s+\d{1,2}(?:st|nd|rd|th)?)?(?:\s+at)?\s+\d{1,2}:\d{2}\s*(?:AM|PM))$/i;

    // Regular pattern for user + timestamp combinations
    const messagePattern = /^([A-Z][a-z]+(?:\s*[A-Z][a-z]+)*(?:(?:!?\[:[^:]+:\](?:\([^)]+\))?)|(?::[^:]+:))?)?\s+((?:\[)?(?:(?:Today|Yesterday|[A-Z][a-z]{2,3}\s+\d+(?:st|nd|rd)?|\w+)(?:\s+at\s+)?)?\d{1,2}:\d{2}\s*(?:AM|PM)(?:\](?:\(.*?\))?)?(?:[\s*]|$))/;
    
    // Additional patterns to detect messages with images, special formatting or Slack URLs
    const avatarImagePattern = /^(?:!\[[^\]]*\])?\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/;
    const slackProfilePattern = /^\(https:\/\/(?:[^.]+\.)?slack\.com\/[^)]+\)$/;
    
    // Improved indentation pattern for timestamps that appear on their own line
    // Often seen as "  12:00 PM" on the next line after a username
    const indentedTimePattern = /^\s+(\d{1,2}:\d{2}\s*(?:AM|PM))$/;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // Check for repeated username patterns that appear on their own line
      // This is critical for fixing the guidewire-sample.txt issue
      if (line.match(/^[A-Z][a-z]+ [A-Z][a-z]+([A-Z][a-z]+ [A-Z][a-z]+)?$/) && 
          i + 1 < lines.length && 
          lines[i+1].trim().match(/^\s*(?:Yesterday|Today|[A-Z][a-z]{2,3}|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday).*\d{1,2}:\d{2}\s*(?:AM|PM)$/)) {
          
        // This looks like a username line followed by a timestamp line
        const username = this.fixDuplicatedUsername(line);
        const timestamp = lines[i+1].trim();
        
        // Save previous message if any
        if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message
        currentMessage = new SlackMessage();
        currentMessage.username = username;
        currentMessage.timestamp = timestamp;
        
        // Skip the timestamp line
        i++;
        continue;
      }
      
      // Check for date headers
      if (datePattern.test(line)) {
        if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
          messages.push(currentMessage);
          currentMessage = null;
        }
        continue; // Skip date headers in output
      }
      
      // Check for guidewire-specific format
      const guidewireMatch = line.match(guidewirePattern);
      if (guidewireMatch) {
        // Save previous message if any
        if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message with username and timestamp
        currentMessage = new SlackMessage();
        currentMessage.username = guidewireMatch[1];
        currentMessage.timestamp = guidewireMatch[2];
        
        // Save message ID to avoid duplicates
        this.seenMessages.add(`${currentMessage.username}|${currentMessage.timestamp}`);
        continue;
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
        currentMessage.username = this.fixDuplicatedUsername(duplicatedMatch[1]);
        currentMessage.timestamp = duplicatedMatch[3];
        
        // Save message ID to avoid duplicates
        this.seenMessages.add(`${currentMessage.username}|${currentMessage.timestamp}`);
        continue;
      }
      
      // Check for enhanced message start format
      const messageStartMatch = line.match(messageStartPattern);
      if (messageStartMatch) {
        // Save previous message if any
        if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Create new message with username and timestamp
        currentMessage = new SlackMessage();
        currentMessage.username = messageStartMatch[1];
        currentMessage.timestamp = messageStartMatch[2];
        
        // Save message ID to avoid duplicates
        this.seenMessages.add(`${currentMessage.username}|${currentMessage.timestamp}`);
        continue;
      }
      
      // Check for indented timestamp pattern
      if (indentedTimePattern.test(line) && i > 0) {
        const indentedMatch = line.match(indentedTimePattern);
        if (indentedMatch && lines[i-1].trim()) {
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
            currentMessage.username = this.fixDuplicatedUsername(username);
            currentMessage.timestamp = indentedMatch[1];
            
            // Skip both username and timestamp lines
            i++; 
            continue;
          }
        }
      }
      
      // Check for avatar images followed by username
      if ((avatarImagePattern.test(line) || slackProfilePattern.test(line) || this.isAvatarUrl(line)) && 
          i + 1 < lines.length) {
        
        // Look ahead to the next line for username and timestamp
        const nextLine = lines[i + 1].trim();
        
        // Try to detect if the next line contains a username + timestamp format
        const usernameMatch = nextLine.match(/^([A-Z][a-z]+(?:[-'\s]*[A-Z][a-z]+)*)/);
        const timestampMatch = this.parseTimestamp(nextLine);
        
        if (usernameMatch && timestampMatch) {
          // Save previous message if any
          if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
            messages.push(currentMessage);
          }
          
          // Create new message
          currentMessage = new SlackMessage();
          currentMessage.avatar = line;
          currentMessage.username = this.fixDuplicatedUsername(usernameMatch[0]);
          currentMessage.timestamp = timestampMatch;
          
          // Skip the next line since we've already processed it
          i++;
          continue;
        }
      }
      
      // Check for lines that look like a new message with name+timestamp
      // Special pattern for lines that have a potential username followed by a time like "3:11"
      if (currentMessage && line.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) && 
          (line.match(/\d{1,2}:\d{2}\s*$/) || 
           line.match(/\d{1,2}:\d{2}\s*(?:AM|PM)$/))) {
        
        // Try to split into username and timestamp
        const parts = line.split(/\s+(?=\d{1,2}:\d{2})/);
        if (parts.length === 2) {
          const potentialUsername = parts[0].trim();
          const potentialTimestamp = parts[1].trim();
          
          // If this looks like a valid username and timestamp
          if (this.isLikelyUsername(potentialUsername) && 
              potentialTimestamp.match(/^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/)) {
            
            // Save previous message if any
            if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
              messages.push(currentMessage);
            }
            
            // Create new message
            currentMessage = new SlackMessage();
            currentMessage.username = this.fixDuplicatedUsername(potentialUsername);
            
            // Format timestamp to ensure AM/PM
            let formattedTimestamp = potentialTimestamp;
            if (!formattedTimestamp.match(/AM|PM/i)) {
              // If no AM/PM, assume it follows the format of previous messages
              formattedTimestamp += currentMessage && currentMessage.timestamp && 
                                   currentMessage.timestamp.includes("AM") ? " AM" : " PM";
            }
            
            currentMessage.timestamp = formattedTimestamp;
            
            // Save message ID to avoid duplicates
            this.seenMessages.add(`${currentMessage.username}|${currentMessage.timestamp}`);
            continue;
          }
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
        const username = match[1].trim();
        currentMessage.username = this.fixDuplicatedUsername(username);
        currentMessage.timestamp = this.formatTimestamp(match[2]);
        
        // Check for hyperlinks in timestamps and extract the displayed text
        if (match[2].startsWith('[') && match[2].includes('](')) {
          const hyperlinkMatch = match[2].match(/\[(.*?)\]/);
          if (hyperlinkMatch) {
            currentMessage.timestamp = hyperlinkMatch[1];
          }
        }
        
        // Save message ID to avoid duplicates
        this.seenMessages.add(`${currentMessage.username}|${currentMessage.timestamp}`);
      } 
      // Handle lines that have content for the current message
      else if (currentMessage) {
        // Check if this line could be a new message (important for catching messages we'd otherwise miss)
        // Look for patterns like "Shannon Cullins Yesterday at 3:10 PM"
        if (line.match(/^[A-Z][a-z]+ [A-Z][a-z]+\s+(?:Yesterday|Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[A-Z][a-z]{2,3})/) && 
            line.match(/\d{1,2}:\d{2}\s*(?:AM|PM)$/)) {
          
          // This looks like a new message header
          const parts = line.split(/\s+(?=(?:Yesterday|Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|[A-Z][a-z]{2,3}))/);
          if (parts.length === 2) {
            // Save previous message if any
            if (currentMessage && currentMessage.content && currentMessage.content.length > 0) {
              messages.push(currentMessage);
            }
            
            // Create new message
            currentMessage = new SlackMessage();
            currentMessage.username = this.fixDuplicatedUsername(parts[0]);
            currentMessage.timestamp = parts[1];
            
            // Save message ID to avoid duplicates
            this.seenMessages.add(`${currentMessage.username}|${currentMessage.timestamp}`);
            continue;
          }
        }
        
        // Skip system messages and possible user indicators unless they're reactions
        if (this.isSystemMessage(line) && !line.match(/^[+]\d+$/) && !line.match(/^:[a-z0-9_\-]+:/)) {
          const threadInfo = this.parseThreadInfo(line);
          if (threadInfo) {
            currentMessage.isThread = true;
            currentMessage.threadInfo = threadInfo;
          }
        } else {
          // Process line content with our existing processors
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
   * Parse messages with enhanced multi-strategy approach
   *
   * This method implements a sophisticated multi-tiered parsing strategy:
   * 1. First checks the cache to see if this text has been processed before
   * 2. If not cached, tries the simple algorithm which is optimized for common Slack formats
   * 3. Falls back to the more complex algorithm if the simple one doesn't find any messages
   *
   * The multi-strategy approach ensures robust handling of various Slack formats
   * while maintaining good performance through caching.
   *
   * @param text - The raw Slack text to parse
   * @returns Array of parsed SlackMessage objects
   */
  public parse(text: string): SlackMessage[] {
    // Generate a cache key based on text content
    const cacheKey = this.generateCacheKey(text);
    
    // Check if we've already parsed this text
    if (this.messageCache.has(cacheKey)) {
      return this.messageCache.get(cacheKey) || [];
    }
    
    // Clear seen messages set for a fresh parse
    this.seenMessages.clear();
    
    // First try the simple algorithm which is faster and handles common formats
    const simpleMessages = this.parseSimpleMessages(text);
    
    // If we found messages with the simple algorithm, cache and return them
    if (simpleMessages.length > 0) {
      this.messageCache.set(cacheKey, simpleMessages);
      return simpleMessages;
    }
    
    // Fall back to the more complex algorithm if the simple one didn't find anything
    const complexMessages = this.parseMessages(text);
    
    // Cache the results before returning
    this.messageCache.set(cacheKey, complexMessages);
    return complexMessages;
  }
  
  /**
   * Generates a cache key for message parsing
   *
   * Creates a simple hash of the text content to use as a cache key.
   * This helps avoid redundant parsing of the same content.
   *
   * @param text - The text to generate a key for
   * @returns A string key for the cache
   */
  private generateCacheKey(text: string): string {
    // Simple hash function - for production, consider a more robust hashing algorithm
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `msg_${hash}_${text.length}`;
  }

  public detectFirstMessage(text: string | string[]): SlackMessage | null {
    if (!text) return null;

    const lines = Array.isArray(text) ? text : text.split('\n');
    if (lines.length === 0) return null;

    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const { message } = this.parseMessageStart(line, i, lines);
      if (message?.username) {
        return message;
      }
    }

    return null;
  }

  public isValidUsername(username: string): boolean {
    if (!username) return false;

    if (username.includes('(APP)') || username.toLowerCase().includes('unknown')) return false;

    const words = username.split(/\s+/);
    if (words.length < 1 || words.length > 3) return false;

    return words.every(word => /^[A-Z][a-z]+(?:[-'][A-Za-z]+)?$/.test(word));
  }

  public fixDuplicatedUsernamePublic(username: string): string {
    return this.fixDuplicatedUsername(username);
  }

  public isSystemMessagePublic(text: string): boolean {
    return this.isSystemMessage(text);
  }

  public parseMessageStartPublic(line: string, lineIndex: number, lines: string[]): {
    message: SlackMessage | null;
    skipLines: number;
  } {
    return this.parseMessageStart(line, lineIndex, lines);
  }

  public isLikelySlackPublic(text: string): boolean {
    return this.textProcessor.isLikelySlackFormat(text);
  }
  
  public normalizeTimeFormatPublic(time: string): string {
    return this.formatTimestamp(time);
  }
  
  public detectFirstMessagePublic(text: string[]): SlackMessage | null {
    return this.detectFirstMessage(text);
  }
  
  public isDateLinePublic(line: string): boolean {
    return /^(?:Yesterday|Today|\w+, \w+ \d{1,2}(?:th|st|nd|rd)?)$/.test(line);
  }
  
  public parseDateLinePublic(line: string): Date | null {
    if (!this.isDateLinePublic(line)) return null;
    
    // Handle "Yesterday" and "Today"
    if (line === "Yesterday") {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      return date;
    } else if (line === "Today") {
      return new Date();
    }
    
    // Handle date format like "Monday, February 5th"
    try {
      return new Date(line);
    } catch (e) {
      return null;
    }
  }
  
  public isSlackMetadataLinePublic(line: string): boolean {
    return /^(?:View thread|Reply in thread|\d+ repl(?:y|ies)|Last reply|Thread with|🧵\s+)/.test(line);
  }
  
  public parseThreadMetadataPublic(line: string): { isThreadInfo: boolean; replyCount?: number } {
    if (!this.isSlackMetadataLinePublic(line)) {
      return { isThreadInfo: false };
    }
    
    const replyMatch = line.match(/^(\d+) repl(?:y|ies)/);
    if (replyMatch) {
      return {
        isThreadInfo: true,
        replyCount: parseInt(replyMatch[1], 10)
      };
    }
    
    return { isThreadInfo: true };
  }
  
  // This method is already defined above at line 788
}