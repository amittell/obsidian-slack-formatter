/**
 * Core interfaces for the Slack formatter.
 * Defines contracts for formatter implementations, strategies, and factories.
 * @module interfaces
 */
import { SlackMessage, FormattedOutput } from './models';
import { SlackFormatSettings } from './types/settings.types'; // Corrected import path for settings
import { FormatStrategyType, ThreadStats, ParsedMaps } from './types/formatters.types'; // Import type directly & moved ThreadStats & ParsedMaps

/**
 * Main Slack formatter interface.
 * Defines the contract for all Slack formatter implementations.
 * @interface ISlackFormatter
 */
export interface ISlackFormatter {
  /**
   * Check if text is likely from Slack.
   * Uses pattern detection to determine if content appears to be from Slack.
   * @param {string} text - The text to analyze
   * @returns {boolean} True if text appears to be from Slack
   */
  isLikelySlack(text: string): boolean;
  
  /**
   * Format Slack content to markdown.
   * Main entry point for converting Slack conversations to Obsidian-compatible markdown.
   * @param {string} input - Raw Slack conversation text
   * @returns {string} Formatted markdown content
   */
  formatSlackContent(input: string): string;
  
  /**
   * Get thread statistics from the last formatting operation.
   * @returns {ThreadStats} Statistics including message count, users, and format used
   */
  getThreadStats(): ThreadStats;
  
  /**
   * Build a note with YAML frontmatter.
   * Formats the content and prepends metadata for Obsidian.
   * @param {string} text - Raw Slack conversation text
   * @returns {string} Complete note with frontmatter and formatted content
   */
  buildNoteWithFrontmatter(text: string): string;
  
  /**
   * Update formatter settings and parsed maps.
   * Allows runtime configuration changes.
   * @param {SlackFormatSettings} settings - New settings configuration
   * @param {ParsedMaps} parsedMaps - New user and emoji mappings
   * @returns {void}
   */
   updateSettings(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void;
}


/**
 * Format strategy interface.
 * Defines the contract for different Slack export format handlers.
 * @interface FormatStrategy
 */
export interface FormatStrategy {
  /**
   * Strategy type identifier.
   * Used to select the appropriate strategy based on detected format.
   * @readonly
   * @type {FormatStrategyType}
   */
  readonly type: FormatStrategyType;

  /**
   * Format messages to markdown.
   * Converts an array of parsed messages to Obsidian-compatible markdown.
   * @param {SlackMessage[]} messages - Array of parsed Slack messages
   * @returns {string} Formatted markdown content
   */
  formatToMarkdown(messages: SlackMessage[]): string;
}

/**
 * Type definition for format strategy constructors.
 * Ensures all strategies follow the same constructor signature.
 * @typedef {new (settings: SlackFormatSettings, parsedMaps: ParsedMaps) => FormatStrategy} FormatStrategyConstructor
 */
export type FormatStrategyConstructor = new (settings: SlackFormatSettings, parsedMaps: ParsedMaps) => FormatStrategy;

/**
 * Format strategy factory interface
 */
export interface FormatStrategyFactory {
  /**
   * Registers a new formatting strategy constructor.
   * @param type The type identifier for the strategy.
   * @param constructor The strategy constructor function.
   */
  registerStrategy(type: FormatStrategyType, constructor: FormatStrategyConstructor): void;

  /**
   * Updates the dependencies (settings, maps) used for instantiating strategies.
   * @param settings The current formatter settings.
   * @param parsedMaps The current parsed maps.
   */
  updateDependencies(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void;
  
  /**
   * Retrieves a strategy instance by its type identifier. Instantiates if needed.
   * @param type The type of the strategy to retrieve.
   * @returns The strategy instance, or null if the type is not registered.
   */
  getStrategyByType(type: FormatStrategyType): FormatStrategy | null;
  
  // Removed getAllStrategies as instantiation is now on-demand
  
  /**
   * Removes all registered strategy constructors and clears cached instances.
   */
  clearStrategies(): void;
}