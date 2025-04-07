/**
 * Core interfaces for the Slack formatter
 */
import { SlackMessage, FormattedOutput } from './models';
import { SlackFormatSettings } from './types/settings.types'; // Corrected import path for settings
import { FormatStrategyType, ThreadStats, ParsedMaps } from './types/formatters.types'; // Import type directly & moved ThreadStats & ParsedMaps

/**
 * Main Slack formatter interface
 */
export interface ISlackFormatter {
  /**
   * Check if text is likely from Slack
   */
  isLikelySlack(text: string): boolean;
  
  /**
   * Format Slack content to markdown
   */
  formatSlackContent(input: string): string;
  
  /**
   * Get thread statistics
   */
  getThreadStats(): ThreadStats;
  
  /**
   * Build a note with frontmatter
   */
  buildNoteWithFrontmatter(text: string): string;
  
  /**
   * Update formatter settings and parsed maps
   */
   updateSettings(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void;
}


/**
 * Format strategy interface
 */
export interface FormatStrategy {
/**
 * Strategy type identifier
 */
readonly type: FormatStrategyType;

/**
 * Format messages to markdown
 */
formatToMarkdown(messages: SlackMessage[]): string;

}

// Define a type for strategy constructors
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