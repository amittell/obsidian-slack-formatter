import { ISlackFormatter } from '../interfaces';
// Import ParsedMaps and ThreadStats from the centralized types file
import { ParsedMaps, ThreadStats } from '../types/formatters.types'; 
import { SlackFormatSettings } from '../types/settings.types'; // Corrected import path for settings
import { SlackMessage } from '../models';
import { FormatStrategyFactory } from './strategies/format-strategy-factory';
import { StandardFormatStrategy } from './strategies/standard-format-strategy';
import { BracketFormatStrategy } from './strategies/bracket-format-strategy';
// Corrected import path for the parser
import { SlackMessageParser } from './stages/message-parser';
import { FormatDetector } from './stages/format-detector'; // Import FormatDetector
import { PreProcessor } from './stages/preprocessor'; // Import PreProcessor
import { PostProcessor } from './stages/postprocessor'; // Import PostProcessor
import { Logger } from '../utils/logger'; // Import the Logger

// Removed local ParsedMaps type definition

/**
 * Main SlackFormatter class
 * Serves as the facade for the formatting system
 */
export class SlackFormatter implements ISlackFormatter {
  private settings: SlackFormatSettings;
  private parsedMaps: ParsedMaps; // Store parsed maps separately - Now uses imported type
  private strategyFactory: FormatStrategyFactory;
  private debug: boolean;
  private parser: SlackMessageParser;
  private formatDetector: FormatDetector;
  private preprocessor: PreProcessor;
  private postprocessor: PostProcessor;

  // Store results of the last format operation
  private lastInputText: string | null = null; // Store the input text for caching
  private lastFormattedContent: string | null = null;
  private lastThreadStats: ThreadStats | null = null;

  /**
   * Creates a new SlackFormatter
   *
   * @param settings Formatter settings (JSON strings for maps)
   * @param userMap Parsed user map
   * @param emojiMap Parsed emoji map
   * @param channelMap Parsed channel map - REMOVED
   */
  constructor(
    settings: SlackFormatSettings,
    userMap: Record<string, string>,
    emojiMap: Record<string, string>
    // channelMap: Record<string, string> // Removed
  ) {
    this.settings = settings;
    this.parsedMaps = { userMap, emojiMap }; // Store parsed maps (channelMap removed)
    this.debug = settings.debug || false;

    // Initialize the parser
    this.parser = new SlackMessageParser();

    // Initialize strategy factory
    this.strategyFactory = FormatStrategyFactory.getInstance();
    this.strategyFactory.clearStrategies(); // Clear any previous registrations/cache
    this.registerFormatStrategies(); // Register constructors
    // Update factory dependencies *after* registration
    this.strategyFactory.updateDependencies(this.settings, this.parsedMaps);

    this.formatDetector = new FormatDetector();
    this.preprocessor = new PreProcessor(settings.maxLines); // Initialize with maxLines
    this.postprocessor = new PostProcessor(); // Initialize
  }

  /**
  * Register format strategy constructors - called once on initialization
  */
  private registerFormatStrategies(): void {
      // Register the constructors with their type identifiers
      this.strategyFactory.registerStrategy('standard', StandardFormatStrategy);
      this.strategyFactory.registerStrategy('bracket', BracketFormatStrategy);
      // Dependencies (settings, maps) are now passed via updateDependencies
  }

  /**
   * Check if text is likely from Slack
   *
   * @param text Text to check
   * @returns True if the text appears to be from Slack
   */
  public isLikelySlack(text: string): boolean {
    // Delegate to FormatDetector
    return this.formatDetector.isLikelySlack(text);
  }

  /**
   * Format Slack content to markdown
   *
   * @param input Raw Slack input text
   * @returns Formatted markdown text
   */
  public formatSlackContent(input: string): string {
    if (!input) return '';

    try {
      const startTime = Date.now();
      this.lastInputText = input; // Store input text for caching
      this.lastFormattedContent = null; // Reset last results
      this.lastThreadStats = null;

      // 1. Preprocessing
      let preprocessedResult = this.preprocessor.process(input);
      let processedText = preprocessedResult.content;
      this.debugLog('After Preprocessing', { modified: preprocessedResult.modified, content: processedText.substring(0, 200) + '...' });

      // 2. Format Detection
      const strategyType = this.formatDetector.detectFormat(processedText);

      // Get the strategy based on the detected type
      const strategy = this.strategyFactory.getStrategyByType(strategyType);

      if (!strategy) {
        this.debugLog('No suitable strategy found for input');
        // Store preprocessed text as the result if no strategy found
        this.lastFormattedContent = processedText;
        this.lastThreadStats = { messageCount: 0, uniqueUsers: 0, formatStrategy: 'unknown' };
        return processedText;
      }

      this.debugLog(`Selected strategy: ${strategy.type}`);

      // 3. Parsing
      const messages: SlackMessage[] = this.parser.parse(processedText, this.debug); // Pass debug flag
      this.debugLog(`Parsed ${messages.length} messages`);
      this.debugLog(`Parsed ${messages.length} messages`, messages.slice(0, 2)); // Log first 2 messages as sample

      // 4. Formatting
      const formattedMarkdown = strategy.formatToMarkdown(messages);
      this.debugLog('After Formatting Strategy', { content: formattedMarkdown.substring(0, 200) + '...' });

      // 5. Post-processing
      const postprocessedResult = this.postprocessor.process(formattedMarkdown);
      this.debugLog('After Postprocessing', { modified: postprocessedResult.modified, content: postprocessedResult.content.substring(0, 200) + '...' });

      // Calculate and store thread stats
      const stats = this.calculateThreadStats(messages);
      const endTime = Date.now();
      stats.processingTime = endTime - startTime;
      stats.formatStrategy = strategy.type;
      this.lastThreadStats = stats; // Store calculated stats

      // Store formatted content
      this.lastFormattedContent = postprocessedResult.content;

      return this.lastFormattedContent;

    } catch (error) {
      this.debugLog('Error formatting Slack content', error);
      // Store error message as content and default stats
      // Removed raw input from the error message
      const errorContent = `Error formatting Slack content: ${error.message}`; 
      this.lastFormattedContent = errorContent;
      this.lastThreadStats = { messageCount: 0, uniqueUsers: 0, formatStrategy: 'error' };
      return errorContent;
    }
  }

  /**
   * Get thread statistics
   *
   * @returns Thread statistics from the last format operation, or default if none.
   */
  public getThreadStats(): ThreadStats {
    return this.lastThreadStats || { messageCount: 0, uniqueUsers: 0, formatStrategy: 'unknown' };
  }

  /**
   * Build a note with frontmatter
   *
   * @param text Raw Slack input text
   * @returns Formatted text with YAML frontmatter. Uses cached results if available.
   */
  public buildNoteWithFrontmatter(text: string): string {
      if (!text) return '';
  
      let formattedContent: string;
      let stats: ThreadStats;
  
      // Check if the input text is the same as the last formatted one
      if (text === this.lastInputText && this.lastFormattedContent !== null && this.lastThreadStats !== null) {
          // Reuse cached results
          formattedContent = this.lastFormattedContent;
          stats = this.lastThreadStats;
          this.debugLog('Using cached content for frontmatter generation');
      } else {
          // Format the content if it's different or not cached
          formattedContent = this.formatSlackContent(text);
          // Get stats associated with the *just* formatted content
          stats = this.getThreadStats();
      }
      
      // Build frontmatter lines dynamically
      const frontmatterLines = [
          '---',
          `cssclasses: ${this.settings.frontmatterCssClass || 'slack-conversation'}`, // Use setting, fallback to default
          `participants: ${stats.uniqueUsers || 0}`,
          `messages: ${stats.messageCount || 0}`,
          `date: ${new Date().toISOString().split('T')[0]}`,
          // Add other stats if desired
          '---',
          ''
      ];
      
      // Add title only if it's defined in settings
      if (this.settings.frontmatterTitle) {
          frontmatterLines.push(this.settings.frontmatterTitle);
          frontmatterLines.push(''); // Add blank line after title
      }
      
      // Combine frontmatter, title (if any), and content
      const frontmatter = [
          ...frontmatterLines,
          formattedContent
      ].join('\n');

    return frontmatter;
  }
 
  private calculateThreadStats(messages: SlackMessage[]): ThreadStats {
   const stats: ThreadStats = {
    messageCount: 0,
        uniqueUsers: 0,
        threadReplies: 0,
        formatStrategy: 'unknown', // Will be set later
        processingTime: 0 // Will be set later
    };

    if (!messages || messages.length === 0) {
        return stats;
    }

    const users = new Set<string>();
    const userMessageCounts: Record<string, number> = {};
    let threadReplies = 0;

    for (const message of messages) {
        if (message.username) {
            users.add(message.username);
            userMessageCounts[message.username] = (userMessageCounts[message.username] || 0) + 1;
        }
        if (message.isThreadReply) { // Assuming isThreadReply exists
            threadReplies++;
        }
    }

    stats.uniqueUsers = users.size;
    stats.messageCount = messages.length;
    stats.threadReplies = threadReplies;

    // Find most active user (simple example)
    let mostActiveUser = '';
    let maxMessages = 0;
    for (const [user, count] of Object.entries(userMessageCounts)) {
        if (count > maxMessages) {
            maxMessages = count;
            mostActiveUser = user;
        }
    }
    if (mostActiveUser) {
        stats.mostActiveUser = mostActiveUser;
    }
    return stats;
  }

  /**
   * Debug logging
   *
   * @param message Message to log
   * @param data Optional data to log
   */
  private debugLog(message: string, data?: any): void {
    // Use the centralized Logger, passing the debug flag
    Logger.debug(this.constructor.name, message, data, this.debug);
  }

  /**
   * Update the formatter settings and parsed maps
   *
   * @param settings New settings (JSON strings for maps)
   * @param userMap Newly parsed user map
   * @param emojiMap Newly parsed emoji map
   * @param channelMap Newly parsed channel map - REMOVED
   */
   public updateSettings(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void {
       this.settings = settings;
       this.parsedMaps = parsedMaps; // Update parsed maps using the provided object
       this.debug = settings.debug || false;

       // Update preprocessor settings
       this.preprocessor.updateMaxLines(settings.maxLines);

       // Update factory dependencies instead of re-registering
       this.strategyFactory.updateDependencies(this.settings, this.parsedMaps);
   }
}