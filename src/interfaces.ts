/**
 * Core interfaces for the Slack formatter.
 * Defines contracts for formatter implementations, strategies, and factories.
 *
 * This module contains the primary interfaces that define the architecture
 * of the Slack formatter system, including the main formatter interface,
 * format strategies, and factory patterns for strategy creation.
 *
 * @module interfaces
 * @since 1.0.0
 * @author Obsidian Slack Formatter Team
 */
import { SlackMessage, FormattedOutput } from './models';
import { SlackFormatSettings } from './types/settings.types'; // Corrected import path for settings
import { FormatStrategyType, ThreadStats, ParsedMaps } from './types/formatters.types'; // Import type directly & moved ThreadStats & ParsedMaps

/**
 * Main Slack formatter interface.
 *
 * Defines the contract for all Slack formatter implementations. This is the
 * primary interface that clients use to interact with the formatter system.
 * Implementations must provide methods for detecting Slack content, formatting
 * it to markdown, and building complete notes with frontmatter.
 *
 * @interface ISlackFormatter
 * @since 1.0.0
 * @see {@link SlackFormatter} - Main implementation
 * @see {@link SlackFormatSettings} - Configuration options
 * @see {@link FormattedOutput} - Output format
 *
 * @example
 * ```typescript
 * const formatter: ISlackFormatter = new SlackFormatter(settings, parsedMaps);
 *
 * // Check if content is from Slack
 * if (formatter.isLikelySlack(text)) {
 *   // Format the content
 *   const formatted = formatter.formatSlackContent(text);
 *
 *   // Get statistics
 *   const stats = formatter.getThreadStats();
 *   console.log(`Processed ${stats.messageCount} messages`);
 * }
 * ```
 */
export interface ISlackFormatter {
  /**
   * Check if text is likely from Slack.
   *
   * Uses pattern detection to determine if content appears to be from Slack
   * by analyzing common Slack export formats, timestamps, usernames, and
   * other characteristic markers.
   *
   * @param {string} text - The text to analyze for Slack patterns
   * @returns {boolean} True if text appears to be from Slack, false otherwise
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * const slackText = "John Doe\n2:30 PM\nHello everyone!";
   * const isSlack = formatter.isLikelySlack(slackText); // true
   *
   * const regularText = "Just some regular text";
   * const notSlack = formatter.isLikelySlack(regularText); // false
   * ```
   */
  isLikelySlack(text: string): boolean;

  /**
   * Format Slack content to markdown.
   *
   * Main entry point for converting Slack conversations to Obsidian-compatible
   * markdown. This method processes the raw Slack export text through the
   * complete formatting pipeline including parsing, strategy selection,
   * and content transformation.
   *
   * @param {string} input - Raw Slack conversation text from export
   * @returns {string} Formatted markdown content ready for Obsidian
   * @throws {Error} If input is empty or malformed
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * const rawSlackText = `
   *   John Doe
   *   2:30 PM
   *   Hello everyone! How are you doing?
   *
   *   Jane Smith
   *   2:31 PM
   *   Hi John! I'm doing well, thanks!
   * `;
   *
   * const formatted = formatter.formatSlackContent(rawSlackText);
   * // Returns:
   * // > **John Doe** - 2:30 PM
   * // > Hello everyone! How are you doing?
   * //
   * // > **Jane Smith** - 2:31 PM
   * // > Hi John! I'm doing well, thanks!
   * ```
   */
  formatSlackContent(input: string): string;

  /**
   * Get thread statistics from the last formatting operation.
   *
   * Provides detailed metrics about the most recent formatting operation,
   * including message counts, unique users, processing time, and the
   * strategy used. This data is useful for analytics and frontmatter
   * generation.
   *
   * @returns {ThreadStats} Statistics including message count, users, and format used
   * @since 1.0.0
   * @see {@link ThreadStats} - Statistics interface definition
   *
   * @example
   * ```typescript
   * formatter.formatSlackContent(slackText);
   * const stats = formatter.getThreadStats();
   *
   * console.log(`Messages: ${stats.messageCount}`);
   * console.log(`Users: ${stats.uniqueUsers}`);
   * console.log(`Strategy: ${stats.formatStrategy}`);
   * console.log(`Processing time: ${stats.processingTime}ms`);
   * ```
   */
  getThreadStats(): ThreadStats;

  /**
   * Build a note with YAML frontmatter.
   *
   * Formats the content and prepends YAML frontmatter metadata for Obsidian.
   * This creates a complete note ready for insertion into an Obsidian vault,
   * including metadata about the conversation, participants, and formatting
   * statistics.
   *
   * @param {string} text - Raw Slack conversation text from export
   * @returns {string} Complete note with YAML frontmatter and formatted content
   * @throws {Error} If text cannot be processed or formatted
   * @since 1.0.0
   * @see {@link SlackFormatSettings} - Frontmatter configuration options
   *
   * @example
   * ```typescript
   * const note = formatter.buildNoteWithFrontmatter(slackText);
   * // Returns:
   * // ---
   * // title: "Slack Conversation"
   * // cssclass: "slack-conversation"
   * // messageCount: 5
   * // uniqueUsers: 3
   * // formatStrategy: "standard"
   * // processingTime: 45
   * // ---
   * //
   * // # Slack Conversation
   * //
   * // > **John Doe** - 2:30 PM
   * // > Hello everyone!
   * ```
   */
  buildNoteWithFrontmatter(text: string): string;

  /**
   * Update formatter settings and parsed maps.
   *
   * Allows runtime configuration changes without recreating the formatter
   * instance. This is useful for dynamic settings updates from the UI
   * or when user/emoji mappings change.
   *
   * @param {SlackFormatSettings} settings - New settings configuration
   * @param {ParsedMaps} parsedMaps - New user and emoji mappings
   * @returns {void}
   * @since 1.0.0
   * @see {@link SlackFormatSettings} - Settings structure
   * @see {@link ParsedMaps} - Mapping structures
   *
   * @example
   * ```typescript
   * const newSettings: SlackFormatSettings = {
   *   ...currentSettings,
   *   replaceEmoji: false,
   *   convertUserMentions: true
   * };
   *
   * const newMaps: ParsedMaps = {
   *   userMap: { "U123456": "John Doe" },
   *   emojiMap: { "smile": "😊" }
   * };
   *
   * formatter.updateSettings(newSettings, newMaps);
   * ```
   */
  updateSettings(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void;
}

/**
 * Format strategy interface.
 *
 * Defines the contract for different Slack export format handlers.
 * Each strategy handles a specific type of Slack export format
 * (standard, bracket, mixed, DM, thread, channel) and provides
 * specialized formatting logic for that format type.
 *
 * This follows the Strategy pattern to allow dynamic selection
 * of formatting behavior based on detected content characteristics.
 *
 * @interface FormatStrategy
 * @since 1.0.0
 * @see {@link FormatStrategyType} - Available strategy types
 * @see {@link FormatStrategyFactory} - Strategy creation and management
 * @see {@link ISlackFormatter} - Main formatter interface
 *
 * @example
 * ```typescript
 * class CustomFormatStrategy implements FormatStrategy {
 *   readonly type: FormatStrategyType = 'custom';
 *
 *   formatToMarkdown(messages: SlackMessage[]): string {
 *     return messages.map(msg =>
 *       `**${msg.username}**: ${msg.text}`
 *     ).join('\n');
 *   }
 * }
 * ```
 */
export interface FormatStrategy {
  /**
   * Strategy type identifier.
   *
   * Used to select the appropriate strategy based on detected format.
   * This readonly property uniquely identifies the strategy type and
   * is used by the factory for strategy registration and retrieval.
   *
   * @readonly
   * @type {FormatStrategyType}
   * @since 1.0.0
   * @see {@link FormatStrategyType} - Available type values
   *
   * @example
   * ```typescript
   * const strategy = new StandardFormatStrategy(settings, maps);
   * console.log(strategy.type); // 'standard'
   * ```
   */
  readonly type: FormatStrategyType;

  /**
   * Format messages to markdown.
   *
   * Converts an array of parsed messages to Obsidian-compatible markdown
   * using the strategy's specific formatting rules. Each strategy implements
   * this method differently to handle various Slack export formats.
   *
   * @param {SlackMessage[]} messages - Array of parsed Slack messages
   * @returns {string} Formatted markdown content ready for Obsidian
   * @throws {Error} If messages array is empty or contains invalid data
   * @since 1.0.0
   * @see {@link SlackMessage} - Message data structure
   *
   * @example
   * ```typescript
   * const messages: SlackMessage[] = [
   *   {
   *     username: 'John Doe',
   *     timestamp: '2:30 PM',
   *     text: 'Hello everyone!',
   *     date: new Date(),
   *     reactions: []
   *   }
   * ];
   *
   * const markdown = strategy.formatToMarkdown(messages);
   * // Output varies by strategy type
   * ```
   */
  formatToMarkdown(messages: SlackMessage[]): string;
}

/**
 * Type definition for format strategy constructors.
 *
 * Ensures all strategies follow the same constructor signature for
 * consistent instantiation by the factory. This type constraint
 * guarantees that all strategy classes can be created with the
 * same dependency injection pattern.
 *
 * @typedef {new (settings: SlackFormatSettings, parsedMaps: ParsedMaps) => FormatStrategy} FormatStrategyConstructor
 * @since 1.0.0
 * @see {@link FormatStrategy} - Strategy interface
 * @see {@link FormatStrategyFactory} - Factory implementation
 *
 * @example
 * ```typescript
 * const StrategyClass: FormatStrategyConstructor = StandardFormatStrategy;
 * const strategy = new StrategyClass(settings, parsedMaps);
 * ```
 */
export type FormatStrategyConstructor = new (
  settings: SlackFormatSettings,
  parsedMaps: ParsedMaps
) => FormatStrategy;

/**
 * Format strategy factory interface.
 *
 * Defines the contract for managing format strategy creation, registration,
 * and retrieval. The factory pattern allows for dynamic strategy selection
 * and lazy instantiation of strategies based on detected content format.
 *
 * This interface supports dependency injection and provides a clean
 * separation between strategy creation and usage.
 *
 * @interface FormatStrategyFactory
 * @since 1.0.0
 * @see {@link FormatStrategy} - Strategy interface
 * @see {@link FormatStrategyConstructor} - Constructor type
 * @see {@link FormatStrategyType} - Available strategy types
 *
 * @example
 * ```typescript
 * const factory: FormatStrategyFactory = new ConcreteStrategyFactory();
 *
 * // Register a new strategy
 * factory.registerStrategy('custom', CustomStrategy);
 *
 * // Update dependencies
 * factory.updateDependencies(newSettings, newMaps);
 *
 * // Get strategy instance
 * const strategy = factory.getStrategyByType('standard');
 * ```
 */
export interface FormatStrategyFactory {
  /**
   * Registers a new formatting strategy constructor.
   *
   * Associates a strategy type with its constructor function for later
   * instantiation. This allows the factory to create strategy instances
   * on-demand when requested by type.
   *
   * @param {FormatStrategyType} type - The type identifier for the strategy
   * @param {FormatStrategyConstructor} constructor - The strategy constructor function
   * @throws {Error} If type is already registered or constructor is invalid
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * factory.registerStrategy('bracket', BracketFormatStrategy);
   * factory.registerStrategy('dm', DMFormatStrategy);
   * ```
   */
  registerStrategy(type: FormatStrategyType, constructor: FormatStrategyConstructor): void;

  /**
   * Updates the dependencies (settings, maps) used for instantiating strategies.
   *
   * Updates the factory's internal dependencies that are injected into
   * strategy constructors. This allows runtime configuration changes
   * without re-registering strategies.
   *
   * @param {SlackFormatSettings} settings - The current formatter settings
   * @param {ParsedMaps} parsedMaps - The current parsed maps (users, emojis)
   * @since 1.0.0
   * @see {@link SlackFormatSettings} - Settings structure
   * @see {@link ParsedMaps} - Parsed maps structure
   *
   * @example
   * ```typescript
   * const updatedSettings = { ...settings, replaceEmoji: false };
   * const updatedMaps = { userMap: {...}, emojiMap: {...} };
   *
   * factory.updateDependencies(updatedSettings, updatedMaps);
   * ```
   */
  updateDependencies(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void;

  /**
   * Retrieves a strategy instance by its type identifier.
   *
   * Returns an existing strategy instance or creates a new one if needed.
   * Uses lazy instantiation to avoid creating unused strategies and
   * caches instances for performance.
   *
   * @param {FormatStrategyType} type - The type of the strategy to retrieve
   * @returns {FormatStrategy | null} The strategy instance, or null if type not registered
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * const standardStrategy = factory.getStrategyByType('standard');
   * if (standardStrategy) {
   *   const formatted = standardStrategy.formatToMarkdown(messages);
   * }
   * ```
   */
  getStrategyByType(type: FormatStrategyType): FormatStrategy | null;

  // Removed getAllStrategies as instantiation is now on-demand

  /**
   * Removes all registered strategy constructors and clears cached instances.
   *
   * Completely resets the factory state by removing all registered
   * strategy constructors and clearing any cached strategy instances.
   * This is primarily used for testing or complete reinitialization.
   *
   * @since 1.0.0
   *
   * @example
   * ```typescript
   * // Clear all strategies for testing
   * factory.clearStrategies();
   *
   * // Re-register strategies
   * factory.registerStrategy('standard', StandardStrategy);
   * factory.registerStrategy('bracket', BracketStrategy);
   * ```
   */
  clearStrategies(): void;
}
