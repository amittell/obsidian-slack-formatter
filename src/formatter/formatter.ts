/**
 * Formatter.ts
 * Main entry point for the Slack formatter
 * 
 * This module implements the facade for the Slack formatter, using the Strategy Pattern
 * to select the appropriate formatting algorithm based on the input characteristics.
 */
import { SlackFormatterSettings, ThreadStats, ISlackFormatter } from "../types";
import { MessageFormatFactory } from "./message-format-strategy";
import { StandardFormatHandler } from "./standard-format-handler";
import { BracketFormatHandler } from "./bracket-format-handler";
import { EmojiProcessor } from "./emoji-processor";
import { DateTimeProcessor } from "./datetime-processor";
import { SlackMessage } from "./message-parser";

/**
 * Main formatter class that implements the ISlackFormatter interface
 * Uses the Strategy Pattern to select the appropriate formatting algorithm
 */
export class SlackFormatter implements ISlackFormatter {
  private settings: SlackFormatterSettings;
  private emojiProcessor: EmojiProcessor;
  private dateTimeProcessor: DateTimeProcessor;
  private threadStats: ThreadStats;
  
  /**
   * Creates a new SlackFormatter
   * 
   * @param settings - Formatter settings
   */
  constructor(settings: SlackFormatterSettings) {
    this.settings = settings || {};
    this.emojiProcessor = new EmojiProcessor(settings.emojiMap || {}, settings);
    this.dateTimeProcessor = new DateTimeProcessor(settings);
    
    // Initialize thread stats
    this.threadStats = {
      messageCount: 0,
      uniqueUsers: 0,
      threadCount: 0,
      dateRange: '',
      mostActiveUser: undefined
    };
    
    // Register format handlers with the factory
    this.registerFormatHandlers();
  }
  
  /**
   * Register format handlers with the factory
   * This allows the factory to select the appropriate handler based on the input
   */
  private registerFormatHandlers(): void {
    // Register handlers in order of preference
    MessageFormatFactory.registerHandler(new BracketFormatHandler(this.settings));
    MessageFormatFactory.registerHandler(new StandardFormatHandler(this.settings));
  }
  
  /**
   * Check if text is likely from Slack
   * 
   * @param text - Text to check
   * @returns True if the text is likely from Slack
   */
  public isLikelySlack(text: string): boolean {
    if (!text || text.length < 20) return false;
    
    // Check for Slack URLs
    if (text.includes('slack.com/archives/') || 
        text.includes('ca.slack-edge.com/') || 
        text.includes('files.slack.com/files-')) {
      return true;
    }
    
    // Check for doubled usernames
    if (/([A-Z][a-z]+\s+[A-Z][a-z]+)([A-Z][a-z]+\s+[A-Z][a-z]+)/i.test(text)) {
      return true;
    }
    
    // Check for bracket timestamps
    if (/\[\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\]/i.test(text)) {
      return true;
    }
    
    // Check for thread indicators
    if (text.includes('replied to thread') || 
        text.includes('View thread') || 
        /\d+ repl(?:y|ies)/.test(text)) {
      return true;
    }
    
    // Check for emoji patterns
    if (/!?$$ :[\w\-]+: $$/i.test(text)) {
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
   * Fix emoji formatting in text
   * 
   * @param text - Text to process
   * @returns Text with fixed emoji formatting
   */
  public fixEmojiFormatting(text: string): string {
    return this.emojiProcessor.fixEmojiFormatting(text);
  }
  
  /**
   * Format Slack content into markdown
   * 
   * @param input - Raw Slack text to format
   * @returns Formatted markdown text
   */
  public formatSlackContent(input: string): string {
    if (!input) return '';
    
    // Log start of formatting
    this.debugLog("Starting to format slack content");
    
    // Preprocess the input
    input = this.preprocessText(input);
    
    // Check if the input exceeds the maximum line limit
    const lines = input.split('\n');
    if (lines.length > this.settings.maxLines) {
      console.warn(`SlackFormatter: Large input (${lines.length} lines) truncating to ${this.settings.maxLines}`);
      input = lines.slice(0, this.settings.maxLines).join('\n');
    }
    
    try {
      // Get the appropriate handler for this input
      const handler = MessageFormatFactory.getHandler(input, this.settings);
      
      if (!handler) {
        this.debugLog("No suitable handler found for input");
        return this.createFallbackContent(input);
      }
      
      // Parse the messages
      const messages = handler.format(input);
      
      // Update thread statistics
      this.updateThreadStats(messages);
      
      // Format the messages as markdown
      const formattedText = handler.formatAsMarkdown(messages);
      
      // Post-process the formatted text
      return this.postProcessResults(formattedText);
    } catch (error) {
      console.error("Error formatting Slack content:", error);
      return this.createFallbackContent(input);
    }
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
   * Create fallback content when no handler can process the input
   * 
   * @param input - Raw input text
   * @returns Formatted fallback content
   */
  private createFallbackContent(input: string): string {
    const lines = input.split('\n');
    const cleanedLines = lines.map(line => this.emojiProcessor.fixEmojiFormatting(line));
    
    return [
      `>[!note]+ Slack Conversation`,
      `> **Note:** Could not parse message format`,
      `>`,
      `> ${cleanedLines.join('\n> ')}`
    ].join('\n');
  }
  
  /**
   * Update thread statistics based on parsed messages
   * 
   * @param messages - Array of parsed SlackMessage objects
   */
  private updateThreadStats(messages: SlackMessage[]): void {
    // Reset thread stats
    this.threadStats = {
      messageCount: messages.length,
      uniqueUsers: 0,
      threadCount: 0,
      dateRange: '',
      mostActiveUser: undefined
    };
    
    // Collect unique users and thread count
    const users = new Set<string>();
    const userMessageCounts: Record<string, number> = {};
    const dates: Date[] = [];
    
    for (const message of messages) {
      // Count unique users
      if (message.username && !message.username.includes('Unknown')) {
        users.add(message.username);
        userMessageCounts[message.username] = (userMessageCounts[message.username] || 0) + 1;
      }
      
      // Count threads
      if (message.isThread) {
        this.threadStats.threadCount++;
      }
      
      // Collect dates
      if (message.date) {
        try {
          const date = new Date(message.date);
          if (!isNaN(date.getTime())) {
            dates.push(date);
          }
        } catch (e) {
          // Ignore invalid dates
        }
      }
    }
    
    // Update thread stats
    this.threadStats.uniqueUsers = users.size;
    
    // Find most active user
    let maxMessages = 0;
    for (const [user, count] of Object.entries(userMessageCounts)) {
      if (count > maxMessages) {
        maxMessages = count;
        this.threadStats.mostActiveUser = user;
      }
    }
    
    // Calculate date range
    if (dates.length > 0) {
      const earliest = dates.reduce((a, b) => (a < b ? a : b));
      const latest = dates.reduce((a, b) => (a > b ? a : b));
      this.threadStats.dateRange = `${this.dateTimeProcessor.formatDateYMD(earliest)} to ${this.dateTimeProcessor.formatDateYMD(latest)}`;
    }
  }
  
  /**
   * Post-process the formatted text
   * 
   * @param text - Formatted text
   * @returns Post-processed text
   */
  private postProcessResults(text: string): string {
    if (!text) return text;
    
    // Fix emoji formatting
    text = this.emojiProcessor.fixEmojiFormatting(text);
    
    // Clean link formatting
    text = text.replace(/\\$$ /g, '[')
      .replace(/\\ $$/g, ']')
      .replace(/<(https?:\/\/[^>]+)>/g, '$1')
      .replace(/$$  $$$$ (https?:\/\/[^)]+) $$/g, '$1');
    
    return text;
  }
  
  /**
   * Get thread statistics
   * 
   * @returns Thread statistics
   */
  public getThreadStats(): ThreadStats {
    return this.threadStats;
  }
  
  /**
   * Build a note with frontmatter
   * 
   * @param text - Formatted text
   * @returns Text with frontmatter
   */
  public buildNoteWithFrontmatter(text: string): string {
    const stats = this.getThreadStats();
    
    const frontmatter = [
      '---',
      'type: slack-conversation',
      `date: ${new Date().toISOString().split('T')[0]}`,
      `messages: ${stats.messageCount}`,
      `users: ${stats.uniqueUsers}`,
      `threads: ${stats.threadCount}`,
      stats.dateRange ? `dateRange: "${stats.dateRange}"` : '',
      stats.mostActiveUser ? `mostActive: "[[${stats.mostActiveUser}]]"` : '',
      '---',
      ''
    ].filter(Boolean).join('\n');
    
    return frontmatter + text;
  }
  
  /**
   * Debug logging helper
   * 
   * @param message - Message to log
   * @param data - Optional data to include
   */
  private debugLog(message: string, data?: any): void {
    if (this.settings.debug) {
      console.log(`[SlackFormat] ${message}`, data || '');
    }
  }
}