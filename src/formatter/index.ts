/**
 * Slack Formatter Main Module
 * Handles processing and formatting of Slack conversations
 */
import { Notice } from 'obsidian';
import { ThreadStats, FormatterState, SlackFormatSettings } from '../types';
import { MessageParser } from './message-parser';
import { TextProcessor } from './text-processor';
import { SimpleFormatter } from './simple-formatter';

export class SlackFormatter {
  private settings: SlackFormatSettings;
  private parser: MessageParser;
  private processor: TextProcessor;
  private simpleFormatter: SimpleFormatter;

  // State variables for the formatter
  private state: FormatterState = {
    detectedDates: [],
    participantSet: new Set(),
    result: [],
    threadInfo: '',
    currentMessageNumber: 0,
    threadStats: {
      messageCount: 0,
      uniqueUsers: 0,
      threadCount: 0,
      dateRange: '',
      mostActiveUser: undefined
    },
    userMessageCounts: {},
    currentUser: '',
    currentTime: '',
    messageLines: [],
    lastKnownUser: '',
    lastMessageTime: '',
    isMessageContinuation: false,
    inCodeBlock: false,
    inQuotedBlock: false,
    initialContent: [],
    hasInitialContent: false,
    messageStarted: false,
    currentAvatar: '',
    lastDateLine: '',
    inReactionBlock: false,
    reactionLines: [],
    unknownUserActive: false,
    processedMessages: new Set() // Track processed messages to prevent duplicates
  };

  constructor(
    settings: SlackFormatSettings,
    userMap: Record<string, string>,
    emojiMap: Record<string, string>,
    channelMap: Record<string, string>
  ) {
    this.settings = settings;
    this.parser = new MessageParser();
    this.processor = new TextProcessor(userMap, emojiMap, channelMap);
    this.simpleFormatter = new SimpleFormatter(settings, userMap, emojiMap, channelMap);
  }

  /**
   * Debug logging helper
   */
  private debugLog(message: string, data?: any) {
    console.log(`[SlackFormat] ${message}`, data || '');
  }

  /**
   * Check if text is likely from Slack
   * Added to the formatter for easier access from main plugin
   */
  public isLikelySlack(text: string): boolean {
    return this.parser.isLikelySlack(text);
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

  /**
   * Process raw text before normal parsing to fix common formatting issues
   * Focuses on fixing emoji formats that cause problems
   */
  private preprocessText(text: string): string {
    // Fix various emoji formats
    return text
      // Fix emoji with exclamation mark pattern: ![:emoji:] -> :emoji:
      .replace(/!\[:([a-z0-9_\-\+]+):\]/gi, ':$1:')
      // Fix emoji with brackets + number pattern: [:emoji:]27 -> :emoji: 27
      .replace(/\[:([a-z0-9_\-\+]+):\](\d+)/g, ':$1: $2');
  }

  /**
   * Formats a chunk of Slack text into Obsidian Markdown
   * Now with improved support for doubled usernames and message boundaries
   */
  public formatSlackContent(input: string): string {
    if (!input) return '';
    
    this.debugLog("Starting to format slack content");
    
    // First, check if this looks like a bracket-timestamp format that the SimpleFormatter is better at handling
    if (this.shouldUseSimpleFormatter(input)) {
      this.debugLog("Using SimpleFormatter for bracket-timestamp format");
      return this.simpleFormatter.formatSlackContent(input);
    }
    
    // Reset state for standard formatting approach
    this.resetState();
    
    // Apply preprocessing to fix common format issues
    input = this.fixEmojiFormatting(input);
    
    let lines = input.split('\n');
    
    // Truncate if too many lines
    if (lines.length > this.settings.maxLines) {
      new Notice(`SlackFormatPlugin: Pasted text has ${lines.length} lines, truncating to ${this.settings.maxLines}.`);
      lines = lines.slice(0, this.settings.maxLines);
    }
    
    // NEW: Pre-parse approach inspired by Grok - look for message patterns first
    // This helps us better identify message boundaries before detailed parsing
    const parsedMessages: {
      startIndex: number;
      lineCount: number;
      user: string;
      time: string;
      date?: string;
      content: string[];
    }[] = [];
    
    // First pass - clean up and pre-identify message boundaries
    let preprocessed: string[] = [];
    let i = 0;
    while (i < lines.length) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        preprocessed.push('');
        i++;
        continue;
      }
      
      // Skip broken archive URLs
      if (line.match(/^\]\((https:\/\/[^.]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+)/)) {
        i++;
        continue;
      }
      
      // Fix emoji format in each line
      line = this.fixEmojiFormatting(line);
      preprocessed.push(line);
      
      // Check if this line is a message start
      const firstMessage = this.parser.detectFirstMessage([line]);
      const messageStart = firstMessage || this.parser.parseMessageStart(line);
      
      if (messageStart) {
        // We found what appears to be the start of a message
        let userName = messageStart.user;
        // Check for doubled username pattern and fix it
        userName = this.parser.fixDuplicatedUsername(userName);
        
        // Start collecting content for this message
        const messageContent: string[] = [];
        
        // If there's content in the remainder, add it
        if (messageStart.remainder) {
          messageContent.push(messageStart.remainder);
        }
        
        // Look ahead for content lines until we find the next message start or thread separator
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          
          // If empty line, add it and continue
          if (!nextLine) {
            messageContent.push('');
            j++;
            continue;
          }
          
          // Check if next line starts a new message
          const nextMsgStart = this.parser.parseMessageStart(nextLine);
          if (nextMsgStart) {
            // Found the next message, stop collecting content
            break;
          }
          
          // Check for thread separators
          if (nextLine === '---') {
            break;
          }
          
          // Add this line to the message content
          messageContent.push(this.fixEmojiFormatting(nextLine));
          j++;
        }
        
        // Record this parsed message
        parsedMessages.push({
          startIndex: i,
          lineCount: j - i,
          user: userName,
          time: messageStart.time,
          date: messageStart.date,
          content: messageContent
        });
        
        // Jump ahead to the next potential message
        i = j;
      } else {
        // Not a message start, just move to the next line
        i++;
      }
    }
    
    // If we found messages in the pre-parse phase, use those directly
    if (parsedMessages.length > 0) {
      this.debugLog(`Pre-parsing found ${parsedMessages.length} messages`);
      
      // Process each message we identified
      for (const msg of parsedMessages) {
        const userDisplay = this.parser.isValidUsername(msg.user) ? 
          `[[${msg.user}]]` : msg.user;
        
        // Format the message with the text processor
        const formattedMessage = this.processor.formatMessage(
          userDisplay,
          msg.time,
          msg.date || '',
          '',  // No avatar handling here
          msg.content,
          '',  // No thread info
          null, // No reactions
          {
            enableTimestampParsing: this.settings.enableTimestampParsing,
            enableEmoji: this.settings.enableEmoji,
            enableMentions: this.settings.enableMentions
          },
          (timeStr) => this.parseAndFormatTime(timeStr)
        );
        
        // Add to results and track to avoid duplication
        const messageKey = this.generateMessageKey(msg.user, msg.time, msg.content.join(''));
        if (!this.state.processedMessages.has(messageKey)) {
          this.state.result.push(formattedMessage);
          this.state.processedMessages.add(messageKey);
          
          // Update stats
          this.state.participantSet.add(msg.user);
          this.state.userMessageCounts[msg.user] = 
            (this.state.userMessageCounts[msg.user] || 0) + 1;
          this.state.threadStats.messageCount++;
        }
      }
      
      // Finalize and return
      this.updateThreadStatistics();
      return this.state.result.join('\n\n');
    }
    
    // Fallback to original algorithm if pre-parsing didn't work
    lines = preprocessed;
    
    // Special handling for first message
    const firstMessage = this.parser.detectFirstMessage(lines);
    if (firstMessage) {
      // Create a formatted first message callout
      const userName = firstMessage.user;
      const userDisplay = this.parser.isValidUsername(userName) ? 
        `[[${userName}]]` : userName;
      
      // Generate the content, starting from the second line (after the header) 
      const messageContent = lines.slice(firstMessage.lineCount).filter(line => {
        // Filter out lines that might be part of other messages
        const possibleMsgStart = this.parser.parseMessageStart(line);
        return !possibleMsgStart;
      }).map(line => {
        // Fix emoji in content
        line = this.fixEmojiFormatting(line);
        return line;
      });
      
      // Format the message with the text processor
      const formattedFirstMessage = this.processor.formatMessage(
        userDisplay,
        firstMessage.time,
        firstMessage.date,
        '',  // No avatar for first message
        messageContent,
        '',  // No thread info
        null, // No reactions
        {
          enableTimestampParsing: this.settings.enableTimestampParsing,
          enableEmoji: this.settings.enableEmoji,
          enableMentions: this.settings.enableMentions
        },
        (timeStr) => this.parseAndFormatTime(timeStr)
      );
      
      // Add this message at the beginning of the result
      this.state.result.push(formattedFirstMessage);
      
      // Track this message as processed to avoid duplication
      this.state.processedMessages.add(this.generateMessageKey(userName, firstMessage.time, messageContent.join('')));
      
      // Adjust lines to exclude the first message (already processed)
      const restOfConversation = lines.slice(firstMessage.lineCount);
      
      // Process the rest of the conversation as normal
      this.processLines(restOfConversation);
    } else {
      // Check if we can detect any messages using the standard approach
      let messageFound = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        
        const messageStart = this.parser.parseMessageStart(line);
        if (messageStart) {
          messageFound = true;
          break;
        }
      }
      
      // Fallback handling for undetectable message structure
      if (!messageFound && lines.length > 0) {
        this.debugLog("No message structure detected, using fallback parsing");
        
        // Try simpler Grok-inspired pattern matching
        const simplifiedMessages = this.parseSimplifiedMessageFormat(lines);
        if (simplifiedMessages.length > 0) {
          for (const msg of simplifiedMessages) {
            const userDisplay = this.parser.isValidUsername(msg.author) ? 
              `[[${msg.author}]]` : msg.author;
            
            const formattedMessage = this.processor.formatMessage(
              userDisplay,
              msg.timestamp,
              '',  // No date info
              '',  // No avatar
              msg.lines,
              '',  // No thread info
              null, // No reactions
              {
                enableTimestampParsing: this.settings.enableTimestampParsing,
                enableEmoji: this.settings.enableEmoji,
                enableMentions: this.settings.enableMentions
              },
              (timeStr) => this.parseAndFormatTime(timeStr)
            );
            
            this.state.result.push(formattedMessage);
            
            // Update stats
            this.state.participantSet.add(msg.author);
            this.state.userMessageCounts[msg.author] = 
              (this.state.userMessageCounts[msg.author] || 0) + 1;
            this.state.threadStats.messageCount++;
          }
        } else {
          // Last resort fallback
          const firstLine = lines[0].trim();
          const userPattern = firstLine.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
          this.state.currentUser = userPattern ? this.parser.fixDuplicatedUsername(userPattern[1]) : 'Unknown user';
          this.state.currentTime = '???:??';
          this.state.messageLines = lines;
          this.flushMessage();
        }
        
        return this.state.result.join('\n\n');
      }
      
      // Main processing loop for standard message format
      this.processLines(lines);
    }
    
    // Process any unprocessed data
    this.finalizeProcessing();
    
    // Post-process results
    return this.postProcessResults();
  }

  /**
   * Check if the input format is better handled by the SimpleFormatter
   * This looks for consistent timestamp patterns in [HH:MM AM/PM] format
   */
  private shouldUseSimpleFormatter(input: string): boolean {
    if (!input) return false;

    // Count brackets-style timestamps [HH:MM AM/PM]
    const bracketTimestampCount = (input.match(/\[\d{1,2}:\d{2}\s*(?:AM|PM)\]/gi) || []).length;
    
    // If we have multiple bracket timestamps, this is likely a format 
    // that the SimpleFormatter can handle well
    return bracketTimestampCount >= 2;
  }

  /**
   * Simplified message parser inspired by Grok's approach
   * This provides a fallback for formats that the main parser has trouble with
   */
  private parseSimplifiedMessageFormat(lines: string[]): { author: string; timestamp: string; lines: string[] }[] {
    const messages: { author: string; timestamp: string; lines: string[] }[] = [];
    let currentMessage: { author: string; timestamp: string; lines: string[] } | null = null;
    
    // Common Slack message patterns
    const messagePatterns = [
      // [10:42 AM] User: Message
      /^\[(\d{1,2}:\d{2}\s*(?:AM|PM))\]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?::|!?\[:[\w\-]+:\])?\s*(.*)/i,
      
      // User [10:42 AM]: Message
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\[(\d{1,2}:\d{2}\s*(?:AM|PM))\](?::|!?\[:[\w\-]+:\])?\s*(.*)/i,
      
      // User [Feb 6th at 10:42 AM]: Message
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\[(?:[A-Za-z]+\s+\d+(?:st|nd|rd|th)?\s+at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM))\](?::|!?\[:[\w\-]+:\])?\s*(.*)/i,
      
      // User 10:42 AM: Message
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))(?::|!?\[:[\w\-]+:\])?\s*(.*)/i
    ];
    
    for (let line of lines) {
      line = line.trim();
      if (!line) {
        if (currentMessage) {
          currentMessage.lines.push('');
        }
        continue;
      }
      
      let matched = false;
      
      // Try each pattern until we find a match
      for (const pattern of messagePatterns) {
        const match = line.match(pattern);
        if (match) {
          matched = true;
          
          // If there's an existing message, save it
          if (currentMessage && currentMessage.lines.length > 0) {
            messages.push(currentMessage);
          }
          
          // Extract parts based on the pattern's capturing groups
          // The last group is always the message content
          const timestamp = pattern === messagePatterns[0] ? match[1] : match[2];
          const author = pattern === messagePatterns[0] ? match[2] : match[1];
          const content = pattern === messagePatterns[0] ? match[3] : match[3] || '';
          
          // Fix doubled username issues
          const fixedAuthor = this.parser.fixDuplicatedUsername(author);
          
          // Start a new message
          currentMessage = {
            timestamp: timestamp,
            author: fixedAuthor,
            lines: content ? [content] : []
          };
          
          break; // Stop checking patterns once we've found a match
        }
      }
      
      // If line didn't match any pattern, append to current message if one exists
      if (!matched && currentMessage) {
        currentMessage.lines.push(line);
      }
    }
    
    // Save the last message if it exists
    if (currentMessage && currentMessage.lines.length > 0) {
      messages.push(currentMessage);
    }
    
    return messages;
  }

  /**
   * Process each line of Slack text
   */
  private processLines(lines: string[]) {
    let currentDate: string | undefined = undefined;
    
    // First, pre-analyze the message structure to better detect message boundaries
    let messageStartIndices: number[] = [];
    let previousMessageUsernames: { index: number; username: string }[] = [];
    
    // IMPROVED analysis pass to detect doubled usernames and message boundaries
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Detect doubled usernames specifically
      const doubledNamePattern = /^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)/i;
      const doubledNameMatch = line.match(doubledNamePattern);
      if (doubledNameMatch) {
        // Check if first and last name match
        const firstName1 = doubledNameMatch[1].match(/^([A-Za-z]+)/i)?.[1].toLowerCase();
        const firstName2 = doubledNameMatch[2].match(/^([A-Za-z]+)/i)?.[1].toLowerCase();
        
        if (firstName1 && firstName2 && firstName1 === firstName2) {
          messageStartIndices.push(i);
          const fixedUsername = this.parser.fixDuplicatedUsername(doubledNameMatch[1] + doubledNameMatch[2]);
          previousMessageUsernames.push({
            index: i,
            username: fixedUsername
          });
          continue;
        }
      }
      
      // Detect regular message starts
      const messageStart = this.parser.parseMessageStart(line);
      if (messageStart) {
        messageStartIndices.push(i);
        
        // Fix doubled username and store for future reference
        if (messageStart.user) {
          const fixedUsername = this.parser.fixDuplicatedUsername(messageStart.user);
          previousMessageUsernames.push({
            index: i,
            username: fixedUsername
          });
        }
        continue;
      }
      
      // Detect doubled usernames in other formats
      const doubledNameWithTimestampMatch = line.match(/^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)\s*(\[[A-Za-z]+\s+\d+(?:st|nd|rd|th)?\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)\])/i);
      if (doubledNameWithTimestampMatch) {
        messageStartIndices.push(i);
        const fixedUsername = this.parser.fixDuplicatedUsername(doubledNameWithTimestampMatch[1] + doubledNameWithTimestampMatch[2]);
        previousMessageUsernames.push({
          index: i,
          username: fixedUsername
        });
      }
    }
    
    // Now process each line with better awareness of message boundaries
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '') continue;
      
      // Check if current line is the start of a new message
      const isMessageStart = messageStartIndices.includes(i);
      
      // If we're starting a new message and we have content from previous message, flush it
      if (isMessageStart && this.state.currentUser) {
        this.flushMessage();
      }
      
      // Handle date lines first
      if (this.parser.isDateLine(line)) {
        if (this.state.currentUser) {
          this.flushMessage();
        }
        
        // Store date info
        this.state.lastDateLine = line;
        currentDate = line;
        
        // Parse date
        const dateObj = this.parser.parseDateLine(line);
        if (dateObj) {
          this.state.detectedDates.push(dateObj);
        }
        
        continue;
      }
      
      // Handle code blocks
      if (this.settings.enableCodeBlocks) {
        const fenceMatch = line.match(/^```(\w+)?/);
        if (fenceMatch) {
          this.flushMessage();
          if (!this.state.inCodeBlock) {
            this.state.inCodeBlock = true;
            this.state.result.push(`\`\`\`${fenceMatch[1] || ''}`.trimEnd());
            continue;
          } else {
            this.state.inCodeBlock = false;
            this.state.result.push('```');
            continue;
          }
        }
        if (this.state.inCodeBlock) {
          this.state.result.push(line);
          continue;
        }
      }
      
      // Handle multi-line quotes
      const tripleQuote = line.match(/^>>>(.*)/);
      if (tripleQuote) {
        this.flushMessage();
        if (!this.state.inQuotedBlock) {
          this.state.inQuotedBlock = true;
          const after = tripleQuote[1].trim();
          if (after) this.state.result.push(`> ${this.processor.formatLine(after, this.settings.enableMentions, this.settings.enableEmoji)}`);
        } else {
          this.state.inQuotedBlock = false;
        }
        continue;
      }
      if (this.state.inQuotedBlock) {
        this.state.result.push(`> ${this.processor.formatLine(line, this.settings.enableMentions, this.settings.enableEmoji)}`);
        continue;
      }
      
      // Check for metadata
      if (this.parser.isSlackMetadataLine(line)) {
        // Special handling for thread metadata
        const threadMetadata = this.parser.parseThreadMetadata(line);
        if (threadMetadata.isThreadInfo) {
          if (threadMetadata.replyCount !== undefined) {
            this.state.threadStats.threadCount++;
            this.state.threadInfo = this.processor.formatThreadInfo(
              threadMetadata.replyCount,
              this.settings.collapseThreads,
              this.settings.threadCollapseThreshold
            );
          }
        } else if (/!?\[:[\w_-]+:\]\s*\d+/.test(line.trim())) {
          // Reaction line
          this.state.inReactionBlock = true;
          // Fix emoji in reaction line before adding it
          this.state.reactionLines.push(this.fixEmojiFormatting(line));
        }
        continue;
      }
      
      // IMPROVED: Handle doubled usernames in message start patterns
      // Try to detect message start with various doubled username patterns
      const messageStart = this.detectMessageStartWithDoubledNames(line);
      if (messageStart) {
        // Special handling for thread dividers
        if (messageStart.user === "THREAD_DIVIDER") {
          this.flushMessage();
          this.state.result.push("\n---\n");
          continue;
        }
        
        // Set the current message details with fixed username
        this.state.currentUser = this.parser.fixDuplicatedUsername(messageStart.user);
        
        // IMPROVED: Normalize time format consistently
        this.state.currentTime = this.parser.normalizeTimeFormat(messageStart.time);
        
        // Store date information if available
        if (messageStart.date) {
          currentDate = messageStart.date;
          this.state.lastDateLine = currentDate;
        }
        
        // Update tracking variables
        this.state.lastKnownUser = this.parser.isValidUsername(this.state.currentUser) ? 
          this.state.currentUser : this.state.lastKnownUser;
        this.state.lastMessageTime = this.state.currentTime;
        this.state.messageStarted = true;
        
        // IMPROVED: Handle "Thread message" or "Chat message" by trying to find a more appropriate username
        if (this.state.currentUser === "Thread message" || this.state.currentUser === "Chat message" || this.state.currentUser === "Timestamp marker") {
          // Look for a previous known username to attribute this message to
          if (this.state.lastKnownUser && this.parser.isValidUsername(this.state.lastKnownUser)) {
            this.state.currentUser = this.state.lastKnownUser;
          } else {
            // Find the nearest previous username
            const previousUsernames = previousMessageUsernames
              .filter(item => item.index < i)
              .sort((a, b) => b.index - a.index); // Sort by most recent first
            
            if (previousUsernames.length > 0) {
              this.state.currentUser = previousUsernames[0].username;
            }
          }
        }
        
        if (messageStart.remainder) {
          // Fix emoji in remainder before adding it
          this.state.messageLines.push(this.fixEmojiFormatting(messageStart.remainder));
        }
        continue;
      }
      
      // Handle timestamp-only lines
      const timeOnlyMatch = line.match(/^(\d{1,2}:\d{2}(?:\s?[AaPp]\.?[Mm]\.?)?)\s*$/);
      if (timeOnlyMatch) {
        if (this.state.lastKnownUser && this.state.currentUser !== this.state.lastKnownUser) {
          this.flushMessage();
          this.state.currentUser = this.state.lastKnownUser;
        }
        this.state.currentTime = this.parser.normalizeTimeFormat(timeOnlyMatch[1]);
        continue;
      }
      
      // Handle avatar-only lines
      if (/^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/.test(line)) {
        this.state.currentAvatar = line;
        continue;
      }
      
      // If we have a current user, add the line to current message
      if (this.state.currentUser) {
        this.state.messageLines.push(line);
        continue;
      }
      
      // If we have a lastKnownUser, treat as continuation
      if (this.state.lastKnownUser) {
        this.state.currentUser = this.state.lastKnownUser;
        this.state.currentTime = this.state.lastMessageTime;
        this.state.messageLines.push(line);
        continue;
      }
      
      // Collect unattributed content if we haven't started messages
      if (!this.state.messageStarted) {
        this.state.initialContent.push(line);
        this.state.hasInitialContent = true;
        continue;
      }
      
      // Last resort fallback
      if (!this.state.unknownUserActive) {
        this.flushMessage();
        this.state.currentUser = 'Unknown user';
        this.state.currentTime = '???:??';
        this.state.unknownUserActive = true;
      }
      this.state.messageLines.push(line);
    }
  }

  /**
   * NEW: Enhanced detection of message starts with doubled usernames
   */
  private detectMessageStartWithDoubledNames(line: string): { user: string; time: string; date?: string; remainder?: string } | null {
    // First use the standard parser
    const standardStart = this.parser.parseMessageStart(line);
    if (standardStart) {
      // Fix doubled username if present
      standardStart.user = this.parser.fixDuplicatedUsername(standardStart.user);
      return standardStart;
    }
    
    // Check for doubled username pattern with archive link: "Name NameName Name [Date at Time(Link)"
    const doubledNameWithArchivePattern = /^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)\s*\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?)\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\]\(https:\/\/[^)]+\)\s*(.*)/i;
    const archiveMatch = line.match(doubledNameWithArchivePattern);
    if (archiveMatch) {
      // Extract components
      const fullUsername = archiveMatch[1] + archiveMatch[2];
      const fixedUsername = this.parser.fixDuplicatedUsername(fullUsername);

      return {
        user: fixedUsername,
        time: archiveMatch[4],
        date: archiveMatch[3],
        remainder: archiveMatch[5]
      };
    }
    
    // Check for doubled username pattern: "Name NameName Name [Date at Time"
    const doubledNamePattern1 = /^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)\s*\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?)\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\](.*)/i;
    const match1 = line.match(doubledNamePattern1);
    if (match1) {
      return {
        user: this.parser.fixDuplicatedUsername(match1[1] + match1[2]),
        time: match1[4],
        date: match1[3],
        remainder: match1[5].trim()
      };
    }
    
    // Check for avatar followed by doubled username
    const avatarDoubledName = /^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)\s+([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)/i;
    const match3 = line.match(avatarDoubledName);
    if (match3) {
      return {
        user: this.parser.fixDuplicatedUsername(match3[1] + match3[2]),
        time: "Unknown",
        remainder: line.substring(line.indexOf(match3[1] + match3[2]) + (match3[1] + match3[2]).length).trim()
      };
    }
    
    return null;
  }

  /**
   * Finalize processing by handling any remaining data
   */
  private finalizeProcessing() {
    // Flush any pending message
    this.flushMessage();
    
    // Close any open code block
    if (this.state.inCodeBlock) {
      this.state.result.push('```');
    }
    
    // Enhanced message boundary detection - split large initial content blocks
    if (this.state.initialContent.length > 0) {
      this.processInitialContent();
    }
    
    // Fallback for empty results
    if (this.state.result.length === 0) {
      this.debugLog("No messages found, creating fallback format");
      this.createFallbackContent();
    }
    
    // Update thread statistics
    this.updateThreadStatistics();
  }

  /**
   * Format any initial content that couldn't be attributed to a user
   * ENHANCED: Now attempts to detect message boundaries within initial content
   */
  private processInitialContent() {
    if (!this.state.hasInitialContent || this.state.initialContent.length === 0) return;
    
    // First, attempt to detect if the first line is a message start that wasn't properly detected
    if (this.state.initialContent.length > 0) {
      const firstLine = this.state.initialContent[0];
      
      // NEW: Special handling for common Slack format with doubled usernames at top of paste
      const userDatePattern = /^([A-Za-z]+\s+[A-Za-z]+)(?:[A-Za-z]+\s+[A-Za-z]+)?\s+\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?) at (\d{1,2}:\d{2}\s*(?:AM|PM))]/i;
      const firstLineMatch = firstLine.match(userDatePattern);
      
      if (firstLineMatch) {
        // Extract user information from the first line
        const userName = this.parser.fixDuplicatedUsername(firstLineMatch[1]);
        const date = firstLineMatch[2];
        const time = firstLineMatch[3];
        
        // Create a new message with this user and timestamp
        const messageLines = [...this.state.initialContent];
        
        this.state.result.unshift(
          `>[!note]+ Message from [[${userName}]]`,
          `> **Time:** ${time}`,
          `> **Date:** ${date}`,
          `>`,
          `> ${messageLines.map(line => {
            // Fix emoji in content
            line = this.fixEmojiFormatting(line);
            const formatted = this.processor.formatLine(line, this.settings.enableMentions, this.settings.enableEmoji);
            return formatted;
          }).join('\n> ')}`
        );
        
        return; // Exit early as we've handled the content
      }
    }
    
    // Filter out irrelevant content
    const filteredContent = this.state.initialContent
      .filter(line => {
        // Skip avatar-only lines
        if (/^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/.test(line)) {
          return false;
        }
        // Skip broken Slack URLs
        if (line.match(/^\]\((https:\/\/[^.]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+)/)) {
          return false;
        }
        // Skip pure emoji reactions
        if (/^!?\[:[\w-]+:\]\d*$/.test(line)) {
          return false;
        }
        // Skip thread metadata
        if (/(view thread)|(replies?)|(\d+ repl(y|ies))|(Last reply)/i.test(line)) {
          return false;
        }
        return line.trim().length > 0;
      });
    
    if (filteredContent.length === 0) return;
    
    // IMPROVED: Try to detect message boundaries in the initial content
    const messages: { user: string; time: string; content: string[] }[] = [];
    let currentMessage: { user: string; time: string; content: string[] } | null = null;
    
    // First pass - try to identify message boundaries
    for (let i = 0; i < filteredContent.length; i++) {
      const line = filteredContent[i];
      
      // Try to detect if this line starts a new message
      const potentialMessageStart = this.detectMessageStartInLine(line);
      
      if (potentialMessageStart) {
        // If we have an active message, save it
        if (currentMessage && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }
        
        // Start a new message
        currentMessage = {
          user: potentialMessageStart.user,
          time: potentialMessageStart.time,
          content: []
        };
        
        // If there's content after the username/timestamp, add it
        if (potentialMessageStart.remainder) {
          currentMessage.content.push(potentialMessageStart.remainder);
        }
      } else if (currentMessage) {
        // Add to current message
        currentMessage.content.push(line);
      } else {
        // No active message and not a message start - create a generic one
        currentMessage = {
          user: "Unknown User",
          time: "Unknown",
          content: [line]
        };
      }
    }
    
    // Add the last message if we have one
    if (currentMessage && currentMessage.content.length > 0) {
      messages.push(currentMessage);
    }
    
    // Now format each detected message
    if (messages.length > 0) {
      for (const message of messages) {
        // Format the message content
        const formattedContent = message.content
          .map(line => {
            // Fix emoji in content
            line = this.fixEmojiFormatting(line);
            const formatted = this.processor.formatLine(line, this.settings.enableMentions, this.settings.enableEmoji);
            return formatted ? `> ${formatted}` : '>';
          })
          .join('\n');
        
        // Add the message callout
        this.state.result.unshift(
          `>[!note]+ Message from ${message.user}`,
          `> **Time:** ${message.time}`,
          `>`,
          formattedContent
        );
      }
    } else {
      // Fallback if we couldn't detect message boundaries
      const formattedInitialContent = filteredContent
        .map(line => {
          // Fix emoji in initial content
          line = this.fixEmojiFormatting(line);
          const formatted = this.processor.formatLine(line, this.settings.enableMentions, this.settings.enableEmoji);
          return formatted ? `> ${formatted}` : '';
        })
        .filter(Boolean)
        .join('\n');
      
      if (formattedInitialContent) {
        // Insert at the beginning of the result
        this.state.result.unshift(
          `>[!note]+ Message from Missing author`,
          `> **Time:** Unknown`,
          `>`,
          formattedInitialContent
        );
      }
    }
  }

  /**
   * NEW: Helper method to detect message boundaries in unstructured content
   */
  private detectMessageStartInLine(line: string): { user: string; time: string; remainder: string } | null {
    // First try using the full parser
    const messageStart = this.parser.parseMessageStart(line);
    if (messageStart) return messageStart;
    
    // Check for username pattern followed by timestamp pattern
    const userTimePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:!?\[:[\w\-]+:\])?\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
    const match = line.match(userTimePattern);
    if (match) {
      return {
        user: this.parser.fixDuplicatedUsername(match[1]),
        time: match[2],
        remainder: match[3]
      };
    }
    
    // Check for lines with avatar images followed by a name
    if (line.includes('](https://ca.slack-edge.com/')) {
      const avatarNameMatch = line.match(/!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
      if (avatarNameMatch) {
        return {
          user: this.parser.fixDuplicatedUsername(avatarNameMatch[1]),
          time: "Unknown",
          remainder: line.substring(line.indexOf(avatarNameMatch[1]) + avatarNameMatch[1].length)
        };
      }
    }
    
    return null;
  }

  /**
   * Create fallback content if no messages were found
   */
  private createFallbackContent() {
    const lines = this.state.initialContent.length > 0 ? 
      this.state.initialContent : ['No parsable Slack content found'];
      
    // Apply emoji fixes to fallback content
    const cleanedLines = lines.map(line => this.fixEmojiFormatting(line));
      
    this.state.result.push(
      `>[!note]+ Slack Conversation`,
      `> **Note:** Could not parse message format`,
      `>`,
      `> ${cleanedLines.join('\n> ')}`
    );
  }

  /**
   * Update thread statistics based on parsing results
   */
  private updateThreadStatistics() {
    this.state.threadStats.uniqueUsers = this.state.participantSet.size;
    
    if (this.state.detectedDates.length > 0) {
      const earliest = this.state.detectedDates.reduce((a, b) => (a < b ? a : b));
      const latest = this.state.detectedDates.reduce((a, b) => (a > b ? a : b));
      this.state.threadStats.dateRange = `${this.formatDateYMD(earliest)} to ${this.formatDateYMD(latest)}`;
    }
    
    // Find most active user
    let maxMessages = 0;
    for (const [user, count] of Object.entries(this.state.userMessageCounts)) {
      if (count > maxMessages) {
        maxMessages = count;
        this.state.threadStats.mostActiveUser = user;
      }
    }
  }

  /**
   * Process results to ensure consistent formatting and resolve date headers
   */
  private postProcessResults(): string {
    // Clean up links and emoji in all results
    const cleanedResults = this.state.result.map(item => {
      // Apply final emoji cleanup
      let cleanedItem = this.fixEmojiFormatting(item);
      cleanedItem = this.processor.cleanLinkFormatting(cleanedItem);
      return cleanedItem;
    });
    
    return cleanedResults.join('\n\n');
  }

  /**
   * Reset state for a new formatting operation
   */
  private resetState() {
    this.state = {
      detectedDates: [],
      participantSet: new Set(),
      result: [],
      threadInfo: '',
      currentMessageNumber: 0,
      threadStats: {
        messageCount: 0,
        uniqueUsers: 0,
        threadCount: 0,
        dateRange: '',
        mostActiveUser: undefined
      },
      userMessageCounts: {},
      currentUser: '',
      currentTime: '',
      messageLines: [],
      lastKnownUser: '',
      lastMessageTime: '',
      isMessageContinuation: false,
      inCodeBlock: false,
      inQuotedBlock: false,
      initialContent: [],
      hasInitialContent: false,
      messageStarted: false,
      currentAvatar: '',
      lastDateLine: '',
      inReactionBlock: false,
      reactionLines: [],
      unknownUserActive: false,
      processedMessages: new Set() // Track processed messages
    };
  }

  /**
   * Process a message and add it to results
   */
  private flushMessage() {
    if (!this.state.currentUser || !this.state.currentTime) {
      this.resetMessage();
      return;
    }
    
    // Skip join/leave messages
    if (this.state.messageLines.every(line => this.parser.isSystemMessage(line))) {
      this.resetMessage();
      return;
    }
    
    // Filter lines
    const lines = this.state.messageLines
      .map(ln => ln.trim())
      .filter(ln => {
        // Skip broken Slack archive URLs
        if (ln.match(/^\]\((https:\/\/[^.]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+)/)) {
          return false;
        }
        return ln.length > 0 && !this.parser.isSystemMessage(ln);
      });
    
    if (lines.length > 0) {
      // Fix doubled usernames and ensure full names are preserved
      let displayUser = this.state.currentUser;
      
      // Check for truncated usernames that need fixing
      if (displayUser.endsWith('Ale') || displayUser.endsWith('Dav') || displayUser.endsWith('Tra') || 
          displayUser.endsWith('Phi') || displayUser.endsWith('Cle')) {
        // Search for a more complete version of this name in previousMessageUsernames
        const nameStart = displayUser.substring(0, displayUser.length - 3);
        
        // Look through all tracked usernames for a more complete version
        const usernames = Object.keys(this.state.userMessageCounts);
        const betterMatch = usernames
          .find(name => name && name.startsWith(nameStart) && name.length > displayUser.length);
        
        if (betterMatch) {
          displayUser = betterMatch;
        }
      }
      
      // Apply the doubled username fix
      displayUser = this.parser.fixDuplicatedUsername(displayUser);
      
      // Generate a key to check for duplicate messages
      const messageKey = this.generateMessageKey(displayUser, this.state.currentTime, lines.join(''));
      
      // Skip if this is a duplicate message
      if (this.state.processedMessages.has(messageKey)) {
        this.resetMessage();
        return;
      }
      
      // Format message
      const userDisplay = this.parser.isValidUsername(displayUser) ? 
        `[[${displayUser}]]` : displayUser;
        
      // Clean up any emoji formatting issues in reactions
      if (this.state.inReactionBlock) {
        this.state.reactionLines = this.state.reactionLines.map(line => 
          this.fixEmojiFormatting(line)
        );
      }
        
      // Format using the text processor
      const messageContent = this.processor.formatMessage(
        userDisplay,
        this.state.currentTime,
        this.state.lastDateLine,
        this.state.currentAvatar,
        lines.map(line => this.fixEmojiFormatting(line)), // Fix emoji formatting in message lines
        this.state.threadInfo,
        this.state.inReactionBlock ? this.state.reactionLines : null,
        {
          enableTimestampParsing: this.settings.enableTimestampParsing,
          enableEmoji: this.settings.enableEmoji,
          enableMentions: this.settings.enableMentions
        },
        (timeStr) => this.parseAndFormatTime(timeStr)
      );
      
      // Update stats
      this.state.participantSet.add(displayUser);
      this.state.userMessageCounts[displayUser] = 
        (this.state.userMessageCounts[displayUser] || 0) + 1;
      this.state.threadStats.messageCount++;
      
      // Add to results if not a duplicate
      if (!this.isDuplicateMessage(messageContent)) {
        this.state.result.push(messageContent);
        // Mark this message as processed
        this.state.processedMessages.add(messageKey);
      }
      
      // Clear reaction data
      if (this.state.inReactionBlock) {
        this.state.reactionLines = [];
        this.state.inReactionBlock = false;
      }
      
      // Keep thread info for future use
      this.state.threadInfo = '';
    }
    
    this.resetMessage();
  }

  /**
   * Reset message state for the next message
   */
  private resetMessage() {
    this.state.currentUser = '';
    this.state.currentTime = '';
    this.state.messageLines = [];
    this.state.unknownUserActive = false;
    this.state.threadInfo = '';
    this.state.isMessageContinuation = false;
    this.state.currentAvatar = '';
  }

  /**
   * Check if a message is a duplicate of recent messages
   */
  private isDuplicateMessage(message: string): boolean {
    const lastMessages = this.state.result.slice(-3);
    return lastMessages.some(msg => msg === message);
  }

  /**
   * Generate a unique key for a message to avoid duplication
   */
  private generateMessageKey(user: string, time: string, contentSample: string): string {
    const contentHash = contentSample.substring(0, 50); // Use first 50 chars as content hash
    return `${user}|${time}|${contentHash}`;
  }

  /**
   * Parse and format a time string
   * IMPROVED: Better handling of AM/PM and time zone consistency
   */
  private parseAndFormatTime(timeStr: string): string {
    // First normalize the time format
    timeStr = this.parser.normalizeTimeFormat(timeStr);
    
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s?([AaPp]\.?[Mm]\.?))?/);
    if (!match) return timeStr;
    
    let [_, hh, mm, ampm] = match;
    let hour = parseInt(hh, 10);
    const minute = parseInt(mm, 10);
    
    if (ampm) {
      ampm = ampm.toLowerCase().replace(/\./g, '');
      
      // Ensure proper 12/24 hour conversion
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
    } else {
      // No AM/PM specified - make a reasonable guess based on hour
      if (hour < 12) {
        ampm = 'am';
      } else {
        ampm = 'pm';
        if (hour > 12) hour -= 12;
      }
    }
    
    let baseDate: Date;
    if (this.state.detectedDates.length > 0) {
      baseDate = this.state.detectedDates.reduce((a, b) => (a < b ? a : b));
    } else {
      baseDate = new Date();
    }
    
    const newDate = new Date(baseDate.getTime());
    newDate.setHours(hour, minute, 0, 0);
    
    const userTz = this.settings.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return newDate.toLocaleString('en-US', {
      timeZone: userTz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDateYMD(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Build a note with YAML frontmatter
   */
  public buildNoteWithFrontmatter(rawText: string): string {
    if (!rawText) return '';
    
    // Reset state
    this.resetState();
    
    // Preprocess to fix emoji issues
    rawText = this.fixEmojiFormatting(rawText);
    
    // Format the content
    const body = this.formatSlackContent(rawText);
    
    // Get date range
    let earliest: Date = new Date();
    let latest: Date = new Date();
    
    if (this.state.detectedDates.length > 0) {
      earliest = this.state.detectedDates.reduce((a, b) => (a < b ? a : b));
      latest = this.state.detectedDates.reduce((a, b) => (a > b ? a : b));
    }
    
    const earliestStr = this.formatDateYMD(earliest);
    const latestStr = this.formatDateYMD(latest);
    const participants = Array.from(this.state.participantSet).join(', ');
    
    return `---
participants: [${participants}]
earliest_date: ${earliestStr}
latest_date: ${latestStr}
thread: true
statistics:
  message_count: ${this.state.threadStats.messageCount}
  unique_users: ${this.state.threadStats.uniqueUsers}
  thread_count: ${this.state.threadStats.threadCount}
  date_range: ${this.state.threadStats.dateRange}
  most_active_user: ${this.state.threadStats.mostActiveUser || 'N/A'}
---
${body}`;
  }
  
  /**
   * Get the parsed thread stats
   */
  public getThreadStats(): ThreadStats {
    return this.state.threadStats;
  }

  /**
   * Process text and identify possible thread dividers
   * This helps organize the conversation better
   */
  private handleThreadDividers(text: string): string {
    // Replace divider lines with a standard marker that can be detected easily
    const lines = text.split('\n');
    const processedLines = [];
    let skipNext = false;

    for (let i = 0; i < lines.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }

      const line = lines[i].trim();
      
      // Detect common thread divider patterns
      if (line === '---') {
        // Instead of keeping the divider as a pseudo-message, we'll skip it
        // The avatar information that typically follows will now be used to identify the user
        continue;
      }
      
      // Check if current line is an avatar line and next line has a username
      if (line.match(/^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/) && 
          i + 1 < lines.length && 
          lines[i+1].match(/^[A-Z][a-z]+\s+[A-Z][a-z]+/)) {
        // This is an avatar line followed by username - keep them together
        processedLines.push(line);
        processedLines.push(lines[i+1]);
        skipNext = true; // Skip the next line since we've added it already
      } else {
        processedLines.push(line);
      }
    }

    return processedLines.join('\n');
  }
}