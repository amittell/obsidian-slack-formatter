/**
 * EmojiProcessor.ts
 * Specialized module for handling emoji processing in Slack messages
 * 
 * This module centralizes all emoji-related functionality, providing consistent
 * handling of emoji patterns across the application. It handles various emoji formats
 * found in Slack exports and copy/paste operations.
 */
import { SlackFormatterSettings } from "../types";

export class EmojiProcessor {
  // Regex pattern constants for emoji detection and processing
  private static readonly EMOJI_WITH_URL_PATTERN = /:([a-z0-9_\-\+]+):\(https?:\/\/[^)]+\)/gi;
  private static readonly EMOJI_WITH_EXCLAMATION_PATTERN = /!\[:([a-z0-9_\-\+]+):\]/gi;
  private static readonly EMOJI_WITH_BRACKETS_PATTERN = /\[:([a-z0-9_\-\+]+):\](\d+)?/g;
  private static readonly SIMPLE_EMOJI_PATTERN = /:([a-z0-9_\-\+]+):/g;
  private static readonly EMOJI_REACTION_PATTERN = /^(:[\w\-\+]+:)\s*(\d+)\s*$/;
  
  private emojiMap: Record<string, string>;
  private settings: SlackFormatterSettings;
  
  /**
   * Creates a new EmojiProcessor instance
   * 
   * @param emojiMap - Map of emoji codes to their Unicode equivalents
   * @param settings - Formatter settings
   */
  constructor(emojiMap: Record<string, string>, settings: SlackFormatterSettings) {
    this.emojiMap = emojiMap || {};
    this.settings = settings;
  }
  
  /**
   * Fix common emoji formatting issues in text
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
    
    return text
      // Fix emoji with exclamation mark pattern: ![:emoji:] -> :emoji:
      .replace(EmojiProcessor.EMOJI_WITH_EXCLAMATION_PATTERN, ':$1:')
      // Fix emoji with brackets + number pattern: [:emoji:]27 -> :emoji: 27
      .replace(EmojiProcessor.EMOJI_WITH_BRACKETS_PATTERN, ':$1: $2')
      // Fix emoji with URL pattern: :emoji-name:(url) -> :emoji-name:
      .replace(EmojiProcessor.EMOJI_WITH_URL_PATTERN, ':$1:');
  }
  
  /**
   * Process emoji codes and convert them to Unicode equivalents
   * 
   * @param text - Text containing emoji codes
   * @returns Text with emoji codes replaced by Unicode equivalents
   */
  public processEmoji(text: string): string {
    if (!text || !this.settings.enableEmoji) return text;
    
    // First fix any formatting issues
    text = this.fixEmojiFormatting(text);
    
    // Then replace emoji codes with Unicode equivalents
    return text.replace(EmojiProcessor.SIMPLE_EMOJI_PATTERN, (match, emojiName) => {
      return this.emojiMap[emojiName] || match;
    });
  }
  
  /**
   * Process emoji reactions (e.g., ":thumbsup: 3")
   * 
   * @param text - Text containing emoji reactions
   * @returns Processed emoji reaction text
   */
  public processReaction(text: string): string {
    if (!text) return text;
    
    const match = text.match(EmojiProcessor.EMOJI_REACTION_PATTERN);
    if (!match) return text;
    
    const [_, emoji, count] = match;
    const processedEmoji = this.processEmoji(emoji);
    return `${processedEmoji} ${count}`;
  }
  
  /**
   * Check if text is an emoji reaction
   * 
   * @param text - Text to check
   * @returns True if the text is an emoji reaction
   */
  public isEmojiReaction(text: string): boolean {
    if (!text) return false;
    return EmojiProcessor.EMOJI_REACTION_PATTERN.test(text);
  }
  
  /**
   * Strip emoji from text (useful for username cleaning)
   * 
   * @param text - Text containing emoji
   * @returns Text with emoji removed
   */
  public stripEmoji(text: string): string {
    if (!text) return text;
    
    return text
      .replace(/!\[:[^:]+:\]\([^)]+\)/g, '')
      .replace(/:[^:]+:/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}