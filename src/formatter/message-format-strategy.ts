/**
 * MessageFormatStrategy.ts
 * Implements the Strategy Pattern for handling different Slack message formats
 * 
 * This module defines the interfaces and concrete implementations for different
 * message formatting strategies. This pattern allows the system to dynamically
 * select the appropriate formatting algorithm based on the input characteristics.
 */
import { SlackFormatterSettings } from "../types";
import { SlackMessage } from "./message-parser";
import { EmojiProcessor } from "./emoji-processor";
import { DateTimeProcessor } from "./datetime-processor";
import { TextProcessor } from "./text-processor";

/**
 * Interface for message format handlers
 * Defines the contract that all format strategies must implement
 */
export interface MessageFormatHandler {
  /**
   * Check if this handler can process the given text
   * 
   * @param text - Text to check
   * @returns True if this handler can process the text
   */
  canHandle(text: string): boolean;
  
  /**
   * Format the input text into structured messages
   * 
   * @param input - Raw Slack text to format
   * @returns Array of parsed SlackMessage objects
   */
  format(input: string): SlackMessage[];
  
  /**
   * Convert parsed messages to markdown format
   * 
   * @param messages - Array of parsed SlackMessage objects
   * @returns Formatted markdown text
   */
  formatAsMarkdown(messages: SlackMessage[]): string;
}

/**
 * Base class for message format handlers
 * Provides common functionality for all format strategies
 */
export abstract class BaseFormatHandler implements MessageFormatHandler {
  protected settings: SlackFormatterSettings;
  protected textProcessor: TextProcessor;
  protected emojiProcessor: EmojiProcessor;
  protected dateTimeProcessor: DateTimeProcessor;
  protected seenMessages: Set<string>;
  
  constructor(settings: SlackFormatterSettings) {
    this.settings = settings;
    this.textProcessor = new TextProcessor(
      settings.userMap || {},
      settings.emojiMap || {},
      settings.channelMap || {}
    );
    this.emojiProcessor = new EmojiProcessor(settings.emojiMap || {}, settings);
    this.dateTimeProcessor = new DateTimeProcessor(settings);
    this.seenMessages = new Set();
  }
  
  /**
   * Abstract method to check if this handler can process the given text
   * Must be implemented by concrete strategy classes
   */
  abstract canHandle(text: string): boolean;
  
  /**
   * Abstract method to format the input text
   * Must be implemented by concrete strategy classes
   */
  abstract format(input: string): SlackMessage[];
  
  /**
   * Format parsed messages as markdown
   * Common implementation shared by all strategies
   * 
   * @param messages - Array of parsed SlackMessage objects
   * @returns Formatted markdown text
   */
  public formatAsMarkdown(messages: SlackMessage[]): string {
    if (!messages || messages.length === 0) {
      return "No messages found to format.";
    }

    const result: string[] = [];

    messages.forEach((msg) => {
      const isApp = msg.username.includes('(APP)');
      const calloutType = isApp ? 'quote' : 'slack';
      const userLink = (!isApp && !msg.username.includes('Unknown')) ? 
        `[[${msg.username}]]` : msg.username;

      let messageBlock = `>[!${calloutType}]+ Message from ${userLink}`;
      if (msg.timestamp) {
        messageBlock += `\n> **Time:** ${this.dateTimeProcessor.formatTimestamp(msg.timestamp)}`;
      }
      if (msg.date) {
        messageBlock += `\n> **Date:** ${msg.date}`;
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
   * Generate a unique key for a message to avoid duplication
   * 
   * @param username - Message author
   * @param timestamp - Message timestamp
   * @param contentSample - Sample of message content
   * @returns Unique message key
   */
  protected generateMessageKey(username: string, timestamp: string, contentSample: string): string {
    const contentHash = contentSample.substring(0, 50); // Use first 50 chars as content hash
    return `${username}|${timestamp}|${contentHash}`;
  }
}

/**
 * Factory for creating message format handlers
 * Determines the appropriate handler based on input characteristics
 */
export class MessageFormatFactory {
  private static handlers: MessageFormatHandler[] = [];
  
  /**
   * Register a new format handler
   * 
   * @param handler - Handler to register
   */
  public static registerHandler(handler: MessageFormatHandler): void {
    this.handlers.push(handler);
  }
  
  /**
   * Get the appropriate handler for the given text
   * 
   * @param text - Text to process
   * @param settings - Formatter settings
   * @returns The appropriate handler or null if none found
   */
  public static getHandler(text: string, settings: SlackFormatterSettings): MessageFormatHandler | null {
    // Try each handler in order
    for (const handler of this.handlers) {
      if (handler.canHandle(text)) {
        return handler;
      }
    }
    
    // If no handler is found, return null
    return null;
  }
}