import { ISlackFormatter } from '../interfaces';
import { ParsedMaps, ThreadStats } from '../types/formatters.types';
import { SlackFormatSettings } from '../types/settings.types';
import { SlackMessage } from '../models';
import { Logger } from '../utils/logger';
import { duplicateDetectionService } from '../utils/duplicate-detection-service';
import { validateFormatterOutput } from '../utils/validation-utils';

/**
 * Configuration constants for debug output formatting and input validation
 * @internal
 * @since 1.0.0
 */
const DEBUG_LINES_LIMIT = 50;
const MIN_MESSAGE_LENGTH = 10;
const MIN_TOTAL_LINES = 10;

/**
 * Performance protection constants that define safe limits for input processing
 * to prevent memory issues and UI freezing during large content processing.
 * @internal
 * @since 1.0.0
 */
const PERFORMANCE_LIMITS = {
  /** Maximum input size in characters (5MB) */
  MAX_INPUT_SIZE: 5 * 1024 * 1024,
  /** Maximum number of lines to process */
  MAX_LINES: 50000,
  /** Warn threshold for large inputs (1MB) */
  WARN_SIZE_THRESHOLD: 1024 * 1024,
  /** Line count warning threshold */
  WARN_LINES_THRESHOLD: 10000,
  /** Chunk size for processing large inputs (100KB) */
  CHUNK_SIZE: 100 * 1024,
  /** Maximum processing time per chunk (milliseconds) */
  MAX_CHUNK_PROCESSING_TIME: 5000,
  /** Minimum delay between chunks to prevent UI freezing (milliseconds) */
  CHUNK_DELAY: 10,
  /** Chunk count threshold for progress reporting */
  PROGRESS_REPORTING_THRESHOLD: 10,
  /** Maximum cache size for input + output combined (2MB) */
  MAX_CACHE_SIZE: 2 * 1024 * 1024,
} as const;

const CONTENT_DEDUP_INDICATORS = [
  /https?:\/\//i,
  /Added by/i,
  /View thread/i,
  /View newer replies/i,
  /uploaded a file/i,
  /shared a file/i,
  /📎/u,
  /image\.(?:png|jpe?g|gif|webp|heic|svg|bmp)/i,
  /Image from/i,
];

// Import new components
import { FlexibleMessageParser } from './stages/flexible-message-parser';
import { IntelligentMessageParser } from './stages/intelligent-message-parser';
import { ImprovedFormatDetector } from './stages/improved-format-detector';
import { UnifiedProcessor } from './processors/unified-processor';
import { PreProcessor } from './stages/preprocessor';
import { PostProcessor } from './stages/postprocessor';
import { MessageContinuationProcessor } from './processors/message-continuation-processor';
import { EmbeddedMessageDetector } from './processors/embedded-message-detector';
import { ContentDeduplicationProcessor } from './processors/content-deduplication-processor';
import { MessageStructureValidator } from './validators/message-structure-validator';
import { OutputFormattingStandards } from './standards/output-formatting-standards';

// Import strategies
import { StandardFormatStrategy } from './strategies/standard-format-strategy';
import { BracketFormatStrategy } from './strategies/bracket-format-strategy';
import { MixedFormatStrategy } from './strategies/mixed-format-strategy';
import { BaseFormatStrategy } from './strategies/base-format-strategy';

/**
 * Main formatter class that orchestrates the Slack-to-Markdown conversion process through
 * a comprehensive multi-stage pipeline. Handles format detection, intelligent parsing,
 * content processing, deduplication, validation, and strategic formatting.
 *
 * ## Pipeline Flow
 * 1. **Input Validation** - Size limits and preprocessing
 * 2. **Format Detection** - Identifies Slack export format type
 * 3. **Intelligent Parsing** - Extracts structured messages with fallback
 * 4. **Content Processing** - Unified content transformation pipeline
 * 5. **Deduplication** - Removes duplicate and embedded content
 * 6. **Validation** - Structure integrity and content validation
 * 7. **Strategic Formatting** - Format-specific markdown generation
 * 8. **Post-processing** - Final cleanup and optimization
 *
 * ## Caching Strategy
 * - Input/output caching with size management (2MB limit)
 * - Thread statistics caching for performance
 * - Cache invalidation on settings updates
 *
 * ## Error Handling
 * - Comprehensive error recovery with fallback formatting
 * - Graceful degradation for parsing failures
 * - Performance protection with input size limits
 *
 * @implements {ISlackFormatter}
 * @since 1.0.0
 * @example
 * ```typescript
 * const formatter = new SlackFormatter(settings, userMap, emojiMap);
 *
 * // Basic formatting
 * const markdown = formatter.formatSlackContent(slackText);
 *
 * // With frontmatter for Obsidian
 * const note = formatter.buildNoteWithFrontmatter(slackText);
 *
 * // Get processing statistics
 * const stats = formatter.getThreadStats();
 * console.log(`Processed ${stats.messageCount} messages from ${stats.uniqueUsers} users`);
 * ```
 * @see {@link ISlackFormatter} - Interface definition
 * @see {@link UnifiedProcessor} - Content transformation pipeline
 * @see {@link IntelligentMessageParser} - Message parsing strategy
 */
export class SlackFormatter implements ISlackFormatter {
  /** Plugin settings configuration */
  private settings: SlackFormatSettings;

  /** Parsed user and emoji mappings */
  private parsedMaps: ParsedMaps;

  /** Message parser for extracting structured data from raw text */
  private parser: FlexibleMessageParser;

  /** Intelligent message parser using structural analysis */
  private intelligentParser: IntelligentMessageParser;

  /** Format detector for identifying Slack export formats */
  private formatDetector: ImprovedFormatDetector;

  /** Unified processor for content transformation */
  private unifiedProcessor: UnifiedProcessor;

  /** Preprocessor for input validation and line truncation */
  private preprocessor: PreProcessor;

  /** Postprocessor for final cleanup and normalization */
  private postprocessor: PostProcessor;

  /** Message continuation processor for merging split messages */
  private continuationProcessor: MessageContinuationProcessor;

  /** Embedded message detector for identifying embedded content */
  private embeddedDetector: EmbeddedMessageDetector;

  /** Content deduplication processor for removing duplicate content */
  private deduplicationProcessor: ContentDeduplicationProcessor;

  /** Message structure validator for integrity checks */
  private structureValidator: MessageStructureValidator;

  /** Output formatting standards processor for consistent formatting */
  private formattingStandards: OutputFormattingStandards;

  /** Map of formatting strategies by format type */
  private strategies: Map<string, BaseFormatStrategy>;

  // Cache for performance
  /** Cached input string for performance optimization */
  private lastInput: string | null = null;

  /** Cached output string for performance optimization */
  private lastOutput: string | null = null;

  /** Cached thread statistics from last formatting operation */
  private lastStats: ThreadStats | null = null;

  /** Debug mode flag for verbose logging and debug output */
  private debugMode: boolean;

  /**
   * Creates a new SlackFormatter instance and initializes all pipeline components.
   * Sets up the complete processing pipeline including parsers, processors, strategies,
   * and validation components based on the provided configuration.
   *
   * @param {SlackFormatSettings} settings - Plugin settings configuration including format preferences, debug flags, and processing limits
   * @param {Record<string, string>} userMap - Mapping of Slack user IDs (e.g., "U12345") to human-readable display names
   * @param {Record<string, string>} emojiMap - Mapping of Slack emoji codes (e.g., ":smile:") to Unicode characters or custom emoji representations
   * @throws {Error} If required components fail to initialize (caught internally and logged)
   * @since 1.0.0
   * @example
   * ```typescript
   * const settings = {
   *   debug: true,
   *   maxLines: 1000,
   *   frontmatterCssClass: 'slack-conversation'
   * };
   * const userMap = { 'U12345': 'John Doe', 'U67890': 'Jane Smith' };
   * const emojiMap = { ':smile:': '😊', ':thumbsup:': '👍' };
   *
   * const formatter = new SlackFormatter(settings, userMap, emojiMap);
   * ```
   */
  constructor(
    settings: SlackFormatSettings,
    userMap: Record<string, string>,
    emojiMap: Record<string, string>
  ) {
    this.settings = settings || {};
    this.parsedMaps = { userMap, emojiMap };
    this.debugMode = settings?.debug || false;

    // Initialize components
    this.parser = new FlexibleMessageParser();
    this.intelligentParser = new IntelligentMessageParser(this.settings, { userMap, emojiMap });
    this.formatDetector = new ImprovedFormatDetector();
    this.unifiedProcessor = new UnifiedProcessor(this.settings);
    this.preprocessor = new PreProcessor(settings?.maxLines || 1000);
    this.postprocessor = new PostProcessor();
    this.continuationProcessor = new MessageContinuationProcessor();

    // Initialize message structure and deduplication components
    this.embeddedDetector = new EmbeddedMessageDetector(this.debugMode);
    this.deduplicationProcessor = new ContentDeduplicationProcessor(this.debugMode);
    this.structureValidator = new MessageStructureValidator(this.debugMode);
    this.formattingStandards = new OutputFormattingStandards(this.settings);

    // Initialize strategies
    this.strategies = new Map();
    const standardStrategy = new StandardFormatStrategy(this.settings, this.parsedMaps);
    this.strategies.set('standard', standardStrategy);
    this.strategies.set('bracket', new BracketFormatStrategy(this.settings, this.parsedMaps));
    this.strategies.set('mixed', new MixedFormatStrategy(this.settings, this.parsedMaps));
    // Map DM format to standard strategy for now
    this.strategies.set('dm', standardStrategy);
    this.strategies.set('thread', standardStrategy);
    this.strategies.set('channel', standardStrategy);
  }

  /**
   * Analyzes text content to determine if it appears to be from Slack export.
   * Uses advanced pattern detection including user mentions, timestamps, format indicators,
   * and structural patterns characteristic of Slack conversations.
   *
   * @param {string} text - The raw text content to analyze for Slack patterns
   * @returns {boolean} True if text contains sufficient Slack-like patterns to warrant processing
   * @since 1.0.0
   * @example
   * ```typescript
   * const slackText = "10:30 AM\n<@U12345> Hello everyone!\n10:31 AM\n<@U67890> Hi there!";
   * const regularText = "Just some regular conversation text";
   *
   * console.log(formatter.isLikelySlack(slackText)); // true
   * console.log(formatter.isLikelySlack(regularText)); // false
   * ```
   * @see {@link ImprovedFormatDetector.isLikelySlack} - Underlying detection logic
   */
  isLikelySlack(text: string): boolean {
    return this.formatDetector.isLikelySlack(text);
  }

  /**
   * Validates input size to prevent performance issues with extremely large texts.
   * Provides warnings for large inputs and rejects inputs that exceed safe limits.
   * @param {string} input - Input text to validate
   * @returns {string | null} Error message if input is too large, null if valid
   * @private
   */
  private validateInputSize(input: string): string | null {
    const inputSize = input.length;
    const lineCount = input.split('\n').length;

    // Check for extremely large inputs that could cause performance issues
    if (inputSize > PERFORMANCE_LIMITS.MAX_INPUT_SIZE) {
      const sizeMB = (inputSize / (1024 * 1024)).toFixed(2);
      const maxMB = (PERFORMANCE_LIMITS.MAX_INPUT_SIZE / (1024 * 1024)).toFixed(2);
      Logger.error('SlackFormatter', `Input too large: ${sizeMB}MB exceeds maximum of ${maxMB}MB`, {
        inputSize,
        maxSize: PERFORMANCE_LIMITS.MAX_INPUT_SIZE,
      });
      return `❌ **Input too large**: ${sizeMB}MB exceeds maximum limit of ${maxMB}MB.\n\nPlease break the content into smaller chunks or reduce the text size.`;
    }

    // Check for too many lines
    if (lineCount > PERFORMANCE_LIMITS.MAX_LINES) {
      Logger.error(
        'SlackFormatter',
        `Too many lines: ${lineCount} exceeds maximum of ${PERFORMANCE_LIMITS.MAX_LINES}`,
        {
          lineCount,
          maxLines: PERFORMANCE_LIMITS.MAX_LINES,
        }
      );
      return `❌ **Too many lines**: ${lineCount} lines exceeds maximum limit of ${PERFORMANCE_LIMITS.MAX_LINES}.\n\nPlease reduce the content or split into smaller sections.`;
    }

    // Warn for large but acceptable inputs
    if (inputSize > PERFORMANCE_LIMITS.WARN_SIZE_THRESHOLD) {
      const sizeMB = (inputSize / (1024 * 1024)).toFixed(2);
      Logger.warn('SlackFormatter', `Large input detected: ${sizeMB}MB - processing may be slow`, {
        inputSize,
        warnThreshold: PERFORMANCE_LIMITS.WARN_SIZE_THRESHOLD,
      });
    }

    if (lineCount > PERFORMANCE_LIMITS.WARN_LINES_THRESHOLD) {
      Logger.warn(
        'SlackFormatter',
        `Large line count detected: ${lineCount} lines - processing may be slow`,
        {
          lineCount,
          warnThreshold: PERFORMANCE_LIMITS.WARN_LINES_THRESHOLD,
        }
      );
    }

    // Input is within acceptable limits
    return null;
  }

  /**
   * FUTURE ENHANCEMENT: Processes large input text in chunks to prevent UI freezing.
   *
   * NOTE: This method is intentionally not called anywhere in the codebase.
   * It serves as a framework for future implementation when async processing
   * is needed throughout the formatting pipeline. Currently, the formatter
   * operates synchronously, but this method demonstrates how chunked processing
   * could be implemented to handle very large inputs without blocking the UI.
   *
   * Uses memory-efficient streaming approach to avoid storing all results in memory.
   * @param {string} input - Large input text to process in chunks
   * @returns {Promise<string>} Formatted content from all processed chunks
   * @private
   * @unused This is placeholder code for future enhancement
   */
  private async processInChunks(input: string): Promise<string> {
    // NOTE: This is a conceptual framework for future implementation
    // It would require async/await support throughout the formatting pipeline

    try {
      const chunks: string[] = [];

      // Split input into manageable chunks by line boundaries
      let currentChunk = '';
      const lines = input.split('\n');

      for (const line of lines) {
        if (currentChunk.length + line.length > PERFORMANCE_LIMITS.CHUNK_SIZE) {
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = '';
          }
        }
        currentChunk += (currentChunk ? '\n' : '') + line;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      Logger.info('SlackFormatter', `Processing ${chunks.length} chunks for large input`, {
        inputSize: input.length,
        chunkCount: chunks.length,
        avgChunkSize: Math.round(input.length / chunks.length),
      });

      // Memory-efficient streaming approach: process chunks one at a time
      // and build result incrementally to avoid storing all chunks in memory
      let result = '';

      // Process each chunk with rate limiting
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const startTime = Date.now();

        try {
          // Process chunk using internal pipeline to avoid infinite recursion
          const chunkResult = this.formatSlackContentInternal(chunk);

          // Append to result immediately instead of storing in array
          if (result) {
            result += '\n\n---\n\n';
          }
          result += chunkResult;

          const processingTime = Date.now() - startTime;

          // Add delay if processing was too fast to prevent UI blocking
          if (processingTime < PERFORMANCE_LIMITS.CHUNK_DELAY && i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, PERFORMANCE_LIMITS.CHUNK_DELAY));
          }

          // Report progress for large operations
          if (chunks.length > PERFORMANCE_LIMITS.PROGRESS_REPORTING_THRESHOLD) {
            Logger.debug(
              'SlackFormatter',
              `Processed chunk ${i + 1}/${chunks.length} (${processingTime}ms)`,
              {
                progress: Math.round(((i + 1) / chunks.length) * 100),
              }
            );
          }
        } catch (chunkError) {
          Logger.error('SlackFormatter', `Error processing chunk ${i + 1}/${chunks.length}`, {
            chunkIndex: i,
            chunkSize: chunk.length,
            error: chunkError instanceof Error ? chunkError.message : 'Unknown error',
          });

          // Add fallback result for failed chunk directly to result
          if (result) {
            result += '\n\n---\n\n';
          }
          result += `<!-- Chunk ${i + 1} failed to process: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'} -->\n\n${chunk}`;
        }
      }

      return result;
    } catch (error) {
      Logger.error('SlackFormatter', 'Critical error in processInChunks', {
        inputSize: input.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback to non-chunked processing
      Logger.info('SlackFormatter', 'Falling back to non-chunked processing due to error');
      return this.formatSlackContentInternal(input);
    }
  }

  /**
   * Internal formatting method that processes content without input size validation or chunking.
   * Used by processInChunks to avoid infinite recursion.
   * @param {string} input - Raw Slack conversation text (pre-validated)
   * @returns {string} Formatted Markdown content
   * @private
   */
  private formatSlackContentInternal(input: string): string {
    try {
      const startTime = Date.now();
      const debugInfo: string[] = [];

      // 1. Preprocessing
      const preprocessed = this.preprocessor.process(input);
      if (preprocessed.modified) {
        debugInfo.push(`Preprocessed: truncated to ${this.settings?.maxLines || 1000} lines`);
      }

      // 2. Format detection
      const formatType = this.formatDetector.detectFormat(preprocessed.content);
      debugInfo.push(`Detected format: ${formatType}`);

      // 3. Parse messages with intelligent parser as primary (with detected format)
      // Recreate parser with detected format for context-aware parsing
      this.intelligentParser = new IntelligentMessageParser(this.settings, this.parsedMaps);
      let messages = this.intelligentParser.parse(preprocessed.content, this.debugMode);
      let parsingMethod = 'intelligent';

      // Use flexible parser as fallback if intelligent parser produces poor results
      if (this.shouldUseFallbackParser(messages, preprocessed.content)) {
        messages = this.parser.parse(preprocessed.content, this.debugMode);
        parsingMethod = 'flexible-fallback';
        debugInfo.push(`Switched to flexible parser as fallback`);
      }

      // Remove duplicate messages that might occur from malformed input.
      // Avoid invoking the more expensive deduplication pass when every message
      // has unique username/timestamp/content fingerprints. This provides a
      // noticeable speed-up for large well-formed conversations (e.g. the
      // performance regression test that pastes 100 distinct messages).
      const hasPotentialDuplicates =
        new Set(
          messages.map(msg => `${msg.username ?? ''}|${msg.timestamp ?? ''}|${msg.text ?? ''}`)
        ).size !== messages.length;

      if (hasPotentialDuplicates) {
        messages = duplicateDetectionService.deduplicateMessages(messages, this.debugMode);
      }

      const shouldRunContentDedup =
        hasPotentialDuplicates || this.shouldRunContentDeduplication(messages);

      if (shouldRunContentDedup) {
        const deduplicationResult = this.deduplicationProcessor.process(messages);
        messages = deduplicationResult.messages;

        if (deduplicationResult.removedDuplicates > 0) {
          debugInfo.push(
            `Removed ${deduplicationResult.removedDuplicates} duplicate content blocks`
          );
        }
      }

      // Merge continuation messages (Unknown User with timestamps)
      const beforeMergeCount = messages.length;
      const requiresContinuationMerge = messages.some(
        msg => !msg.username || msg.username === 'Unknown User'
      );

      if (requiresContinuationMerge) {
        const continuationResult = this.continuationProcessor.process(messages);
        messages = continuationResult.content;
        const afterMergeCount = messages.length;

        if (continuationResult.modified && beforeMergeCount !== afterMergeCount) {
          debugInfo.push(`Merged ${beforeMergeCount - afterMergeCount} continuation messages`);
        }
      }

      // Validate message structure integrity
      const needsStructureValidation = messages.some(
        msg =>
          !msg.username || msg.username === 'Unknown User' || !msg.text || msg.text.trim() === ''
      );

      if (needsStructureValidation) {
        const validationResult = this.structureValidator.validateMessages(messages);
        if (!validationResult.isValid) {
          const errorCount = validationResult.errors.length;
          debugInfo.push(
            `Structure validation: ${errorCount} errors, ${validationResult.warnings.length} warnings`
          );
        }
      }

      debugInfo.push(`Processed ${messages.length} messages (${parsingMethod})`);

      // Debug: Log parsed messages
      if (this.debugMode) {
        messages.forEach((msg, idx) => {
          Logger.debug(
            'SlackFormatter',
            `Message ${idx}: username="${msg.username}", text="${msg.text}"`
          );
        });
      }

      // 4. Process message content
      const processedMessages = messages.map(msg => {
        const processed = { ...msg };
        if (processed.text) {
          processed.text = this.unifiedProcessor.processWithMaps(
            processed.text,
            this.parsedMaps,
            this.debugMode
          );
        }
        return processed;
      });

      // 5. Apply formatting standards and strategy
      this.formattingStandards.updateContext({
        settings: this.settings,
        standardType: this.getFormattingStandardType(formatType),
      });

      const strategy = this.strategies.get(formatType) || this.strategies.get('standard')!;
      let formatted = strategy.formatToMarkdown(processedMessages);

      // Note: Removed OutputFormattingStandards override that was breaking callout format
      // The strategies already handle proper formatting with > [!slack]+ Message from format

      // 6. Postprocessing
      const postprocessed = this.postprocessor.process(formatted);
      if (postprocessed.modified) {
        debugInfo.push('Applied postprocessing');
        formatted = postprocessed.content;
      }

      // 7. Add debug info if enabled
      if (this.debugMode && debugInfo.length > 0) {
        formatted = this.addDebugInfo(formatted, debugInfo, messages);
      }

      // Validate output before returning
      const validation = validateFormatterOutput(processedMessages);
      if (!validation.isValid) {
        Logger.warn('SlackFormatter', 'Validation issues found in output', {
          unknownUsers: validation.unknownUsers.unknownUserCount,
          structureIssues: validation.structure.issues.length,
        });

        if (this.debugMode) {
          // Add validation warnings to debug info
          const validationWarnings = [
            ...validation.unknownUsers.issues,
            ...validation.structure.issues,
          ];
          if (validationWarnings.length > 0) {
            formatted += '\n\n### ⚠️ Validation Warnings\n';
            formatted += validationWarnings.map(w => `- ${w}`).join('\n');
          }
        }
      }

      // Calculate and store stats
      const endTime = Date.now();
      const stats = this.calculateStats(processedMessages, formatType, endTime - startTime);
      this.lastStats = stats;

      return formatted;
    } catch (error) {
      Logger.error('SlackFormatter', 'Error formatting content (internal)', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Fallback formatting
      return this.fallbackFormat(input, error);
    }
  }

  /**
   * Main entry point for Slack-to-Markdown conversion. Processes raw Slack export content
   * through the complete formatting pipeline with comprehensive error handling, caching,
   * and performance protection.
   *
   * ## Processing Pipeline
   * 1. Input validation and size checks (5MB/50k lines max)
   * 2. Cache lookup for previously processed content
   * 3. Format detection (standard/bracket/mixed/dm/thread)
   * 4. Intelligent message parsing with flexible fallback
   * 5. Content deduplication and continuation merging
   * 6. Message structure validation
   * 7. Unified content processing (links, mentions, formatting)
   * 8. Strategic formatting based on detected type
   * 9. Post-processing cleanup and normalization
   * 10. Cache update and statistics calculation
   *
   * ## Performance Features
   * - Input size validation with informative error messages
   * - Result caching with 2MB size management
   * - Graceful fallback for parsing failures
   * - Processing time tracking and optimization
   *
   * @param {string} input - Raw Slack conversation text from export or copy-paste
   * @returns {string} Formatted Markdown content optimized for Obsidian with proper callout formatting
   * @throws {Error} All errors are caught internally and handled with fallback formatting that preserves original content
   * @since 1.0.0
   * @example
   * ```typescript
   * // Basic usage
   * const slackExport = `10:30 AM
   * <@U12345> Hey team, here's the update:
   * • Project is on track
   * • Testing phase starts Monday
   *
   * 10:32 AM
   * <@U67890> Sounds good! Any blockers?`;
   *
   * const markdown = formatter.formatSlackContent(slackExport);
   * // Returns:
   * // > [!slack]+ Message from John Doe
   * // > **10:30 AM**
   * // >
   * // > Hey team, here's the update:
   * // > • Project is on track
   * // > • Testing phase starts Monday
   * //
   * // > [!slack]+ Message from Jane Smith
   * // > **10:32 AM**
   * // >
   * // > Sounds good! Any blockers?
   *
   * // Handle large inputs
   * const largeContent = "..."; // 3MB of Slack content
   * const result = formatter.formatSlackContent(largeContent);
   * // Processes with performance warnings but completes successfully
   *
   * // Handle malformed input
   * const malformedContent = "Not really Slack content...";
   * const fallback = formatter.formatSlackContent(malformedContent);
   * // Returns formatted error callout with original content preserved
   * ```
   * @see {@link formatSlackContentInternal} - Internal processing without validation
   * @see {@link buildNoteWithFrontmatter} - For complete Obsidian notes with metadata
   * @see {@link getThreadStats} - For processing statistics
   */
  formatSlackContent(input: string): string {
    if (!input) return '';

    // Validate input size for performance protection
    const validationResult = this.validateInputSize(input);
    if (validationResult !== null) {
      return validationResult;
    }

    // Check cache
    if (input === this.lastInput && this.lastOutput !== null) {
      Logger.debug('SlackFormatter', 'Using cached result');
      return this.lastOutput;
    }

    // Clear any previous output to prevent duplication
    this.lastOutput = null;

    try {
      // Use internal method for actual processing
      const formatted = this.formatSlackContentInternal(input);

      // Update cache with size management
      this.updateCache(input, formatted);

      return formatted;
    } catch (error) {
      Logger.error('SlackFormatter', 'Error in formatSlackContent', error);

      // Clear cache to prevent returning partial/invalid results
      this.lastInput = null;
      this.lastOutput = null;

      return this.fallbackFormat(input, error);
    }
  }

  /**
   * Retrieves comprehensive statistics from the most recent formatting operation.
   * Statistics are automatically calculated and cached during each formatSlackContent call.
   *
   * @returns {ThreadStats} Detailed thread statistics object containing:
   *   - messageCount: Number of successfully parsed messages
   *   - uniqueUsers: Count of distinct users who participated
   *   - threadReplies: Number of messages identified as thread replies
   *   - formatStrategy: The format strategy used ('standard', 'bracket', 'mixed', etc.)
   *   - processingTime: Time taken for processing in milliseconds (if available)
   * @since 1.0.0
   * @example
   * ```typescript
   * const slackContent = "..."; // Slack conversation
   * formatter.formatSlackContent(slackContent);
   *
   * const stats = formatter.getThreadStats();
   * console.log(`Processed conversation with:
   *   - ${stats.messageCount} messages
   *   - ${stats.uniqueUsers} participants
   *   - ${stats.threadReplies} thread replies
   *   - Format: ${stats.formatStrategy}
   *   - Processing time: ${stats.processingTime}ms`);
   *
   * // Use stats for UI feedback or analytics
   * if (stats.messageCount > 100) {
   *   console.log('Large conversation detected');
   * }
   * ```
   */
  getThreadStats(): ThreadStats {
    return (
      this.lastStats || {
        messageCount: 0,
        uniqueUsers: 0,
        formatStrategy: 'unknown',
        threadReplies: 0,
      }
    );
  }

  /**
   * Creates a complete Obsidian note with YAML frontmatter and formatted Slack content.
   * Combines the full formatting pipeline with metadata generation for seamless
   * integration into Obsidian vaults. Includes conversation statistics and custom CSS classes.
   *
   * ## Generated Frontmatter
   * - cssclasses: Custom CSS class for styling (default: 'slack-conversation')
   * - participants: Number of unique users in the conversation
   * - messages: Total number of processed messages
   * - format: Detected format strategy used for processing
   * - date: Current date in ISO format (YYYY-MM-DD)
   * - Custom title: If specified in settings
   *
   * @param {string} text - Raw Slack conversation text to format and wrap
   * @returns {string} Complete Obsidian note with YAML frontmatter followed by formatted Markdown content
   * @since 1.0.0
   * @example
   * ```typescript
   * const slackConversation = `10:30 AM
   * <@U12345> Let's discuss the project timeline
   * 10:31 AM
   * <@U67890> Sounds good, when can we start?`;
   *
   * const note = formatter.buildNoteWithFrontmatter(slackConversation);
   * // Returns:
   * // ---
   * // cssclasses: slack-conversation
   * // participants: 2
   * // messages: 2
   * // format: standard
   * // date: 2024-01-15
   * // ---
   * //
   * // > [!slack]+ Message from John Doe
   * // > **10:30 AM**
   * // >
   * // > Let's discuss the project timeline
   * //
   * // > [!slack]+ Message from Jane Smith
   * // > **10:31 AM**
   * // >
   * // > Sounds good, when can we start?
   *
   * // With custom settings
   * const formatterWithTitle = new SlackFormatter({
   *   frontmatterCssClass: 'team-chat',
   *   frontmatterTitle: '# Team Discussion'
   * }, userMap, emojiMap);
   *
   * const noteWithTitle = formatterWithTitle.buildNoteWithFrontmatter(slackConversation);
   * // Includes "# Team Discussion" after the frontmatter
   * ```
   * @see {@link formatSlackContent} - For content formatting without frontmatter
   * @see {@link getThreadStats} - For statistics included in frontmatter
   */
  buildNoteWithFrontmatter(text: string): string {
    const formatted = this.formatSlackContent(text);
    const stats = this.getThreadStats();

    const frontmatter = [
      '---',
      `cssclasses: ${this.settings.frontmatterCssClass || 'slack-conversation'}`,
      `participants: ${stats.uniqueUsers}`,
      `messages: ${stats.messageCount}`,
      `format: ${stats.formatStrategy}`,
      `date: ${new Date().toISOString().split('T')[0]}`,
      '---',
      '',
    ];

    if (this.settings.frontmatterTitle) {
      frontmatter.push(this.settings.frontmatterTitle);
      frontmatter.push('');
    }

    return frontmatter.join('\n') + formatted;
  }

  /**
   * Update cache with size management to prevent memory issues.
   * Clears cache if combined size exceeds the limit.
   * @private
   * @param {string} input - The input string to cache
   * @param {string} output - The output string to cache
   * @returns {void}
   */
  private updateCache(input: string, output: string): void {
    // Calculate combined size of new cache entries
    const cacheSize = input.length + output.length;

    // Clear cache if it would exceed the limit
    if (cacheSize > PERFORMANCE_LIMITS.MAX_CACHE_SIZE) {
      Logger.info('SlackFormatter', 'Cache size would exceed limit, not caching', {
        inputSize: input.length,
        outputSize: output.length,
        limit: PERFORMANCE_LIMITS.MAX_CACHE_SIZE,
      });
      this.lastInput = null;
      this.lastOutput = null;
      return;
    }

    // Update cache
    this.lastInput = input;
    this.lastOutput = output;
  }

  /**
   * Updates formatter configuration and propagates changes throughout the entire pipeline.
   * Reinitializes all components with new settings, clears caches, and ensures
   * consistent behavior across all processors and strategies.
   *
   * ## Updated Components
   * - All format strategies (standard, bracket, mixed)
   * - Unified content processor
   * - Intelligent and flexible message parsers
   * - Preprocessing and postprocessing stages
   * - Validation and deduplication processors
   * - Output formatting standards
   *
   * ## Cache Management
   * - Clears input/output cache to prevent stale results
   * - Resets thread statistics
   * - Forces re-detection of format types
   *
   * @param {SlackFormatSettings} settings - New settings configuration with updated preferences, limits, and formatting options
   * @param {ParsedMaps} parsedMaps - Updated user and emoji mappings containing new user IDs and emoji codes
   * @returns {void}
   * @since 1.0.0
   * @example
   * ```typescript
   * // Initial setup
   * const formatter = new SlackFormatter(initialSettings, userMap, emojiMap);
   *
   * // Update settings with new preferences
   * const updatedSettings = {
   *   ...initialSettings,
   *   debug: true,
   *   maxLines: 2000,
   *   frontmatterCssClass: 'updated-slack-style'
   * };
   *
   * // Add new users discovered in recent exports
   * const updatedUserMap = {
   *   ...userMap,
   *   'U98765': 'New Team Member',
   *   'U54321': 'Another User'
   * };
   *
   * // Update the formatter
   * formatter.updateSettings(updatedSettings, {
   *   userMap: updatedUserMap,
   *   emojiMap: emojiMap
   * });
   *
   * // Next formatting operation will use new settings
   * const result = formatter.formatSlackContent(newContent);
   * ```
   * @see {@link SlackFormatSettings} - Settings object structure
   * @see {@link ParsedMaps} - User and emoji mapping structure
   */
  updateSettings(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void {
    this.settings = settings;
    this.parsedMaps = parsedMaps;
    this.debugMode = settings?.debug || false;

    // Update components
    this.unifiedProcessor.updateSettings(settings);
    this.preprocessor.updateMaxLines(settings?.maxLines || 1000);

    // Update parsers with new settings
    // FlexibleMessageParser is stateless, so recreate it
    this.parser = new FlexibleMessageParser();
    // IntelligentMessageParser has updateSettings method
    this.intelligentParser.updateSettings(settings, parsedMaps);
    // Note: Format detection will be performed during actual parsing to ensure context-aware parsing

    // Update message structure and deduplication components
    this.embeddedDetector = new EmbeddedMessageDetector(this.debugMode);
    this.deduplicationProcessor = new ContentDeduplicationProcessor(this.debugMode);
    this.structureValidator = new MessageStructureValidator(this.debugMode);
    this.formattingStandards = new OutputFormattingStandards(settings);

    // Update strategies
    this.strategies.forEach(strategy => {
      strategy.updateSettings(settings, parsedMaps);
    });

    // Clear cache
    this.lastInput = null;
    this.lastOutput = null;
    this.lastStats = null;
  }

  /**
   * Calculate statistics from parsed messages.
   * @private
   * @param {SlackMessage[]} messages - Array of parsed Slack messages
   * @param {string} formatStrategy - The format strategy used
   * @param {number} processingTime - Time taken to process in milliseconds
   * @returns {ThreadStats} Calculated thread statistics
   */
  private calculateStats(
    messages: SlackMessage[],
    formatStrategy: string,
    processingTime: number
  ): ThreadStats {
    const users = new Set<string>();
    let threadReplies = 0;

    messages.forEach(msg => {
      if (msg.username) {
        users.add(msg.username);
      }
      if (msg.threadInfo) {
        threadReplies++;
      }
    });

    return {
      messageCount: messages.length,
      uniqueUsers: users.size,
      threadReplies,
      formatStrategy,
      processingTime,
    };
  }

  /**
   * Add debug information section to the formatted output.
   * Includes processing steps and unparsed content for troubleshooting.
   * @private
   * @param {string} content - The formatted content
   * @param {string[]} debugInfo - Array of debug messages from processing
   * @param {SlackMessage[]} messages - Array of successfully parsed messages
   * @returns {string} Content with appended debug section
   */
  private addDebugInfo(content: string, debugInfo: string[], messages: SlackMessage[]): string {
    const debugSection = [
      '',
      '---',
      '',
      '## Debug Information',
      '',
      '### Processing Steps',
      ...debugInfo.map(info => `- ${info}`),
      '',
      '### Unparsed Content',
      '',
    ];

    // Find lines that weren't parsed into messages
    const messageTexts = new Set(messages.map(m => m.text.trim()));
    const originalLines = this.lastInput?.split('\n') || [];
    const unparsedLines = originalLines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !messageTexts.has(trimmed);
    });

    if (unparsedLines.length > 0) {
      debugSection.push('```');
      debugSection.push(...unparsedLines.slice(0, DEBUG_LINES_LIMIT)); // Limit to DEBUG_LINES_LIMIT lines
      if (unparsedLines.length > DEBUG_LINES_LIMIT) {
        debugSection.push(`... and ${unparsedLines.length - DEBUG_LINES_LIMIT} more lines`);
      }
      debugSection.push('```');
    } else {
      debugSection.push('*All content was successfully parsed*');
    }

    return content + '\n' + debugSection.join('\n');
  }

  private shouldRunContentDeduplication(messages: SlackMessage[]): boolean {
    if (!messages || messages.length === 0) {
      return false;
    }

    for (const message of messages) {
      const text = message.text;
      if (!text) {
        continue;
      }

      if (text.length > 500) {
        return true;
      }

      if (CONTENT_DEDUP_INDICATORS.some(pattern => pattern.test(text))) {
        return true;
      }

      const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      if (lines.length > 1 && new Set(lines).size !== lines.length) {
        return true;
      }
    }

    return false;
  }

  /**
   * Fallback formatting when normal parsing fails.
   * Creates a warning callout with the original content and error details.
   * @private
   * @param {string} input - The original input that failed to parse
   * @param {any} error - The error that occurred during parsing
   * @returns {string} Fallback formatted content with error information
   */
  private fallbackFormat(input: string, error: any): string {
    Logger.warn('SlackFormatter', 'Using fallback formatting');

    const lines = input.split('\n');
    const output: string[] = [
      '>[!warning]+ Slack Formatting Error',
      `> Failed to parse this content as Slack conversation.`,
      `> Error: ${error.message || 'Unknown error'}`,
      '>',
      '> **Original Content:**',
      '>',
    ];

    // Add original content in a code block
    output.push('> ```');
    lines.slice(0, 100).forEach(line => {
      output.push(`> ${line}`);
    });
    if (lines.length > 100) {
      output.push(`> ... and ${lines.length - 100} more lines`);
    }
    output.push('> ```');

    // Still try to extract some information
    const userMatches = input.match(/<@U[A-Z0-9]+>/g) || [];
    const timeMatches = input.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi) || [];

    if (userMatches.length > 0 || timeMatches.length > 0) {
      output.push('>');
      output.push('> **Detected Elements:**');
      if (userMatches.length > 0) {
        output.push(`> - User mentions: ${userMatches.length}`);
      }
      if (timeMatches.length > 0) {
        output.push(`> - Timestamps: ${timeMatches.length}`);
      }
    }

    this.lastStats = {
      messageCount: 0,
      uniqueUsers: userMatches.length,
      formatStrategy: 'fallback',
      processingTime: 0,
    };

    return output.join('\n');
  }

  /**
   * Determine whether to use the flexible parser as fallback instead of the intelligent parser.
   * Analyzes the quality of parsing results to decide if fallback is needed.
   * @private
   * @param {SlackMessage[]} messages - Messages parsed by intelligent parser
   * @param {string} content - Original content
   * @returns {boolean} True if flexible parser should be used as fallback
   */
  private shouldUseFallbackParser(messages: SlackMessage[], content: string): boolean {
    // Count lines in original content (excluding empty lines)
    const totalLines = content.split('\n').filter(line => line.trim()).length;

    // If no messages were parsed, try flexible parser as fallback
    if (messages.length === 0) {
      return true;
    }

    // Check for obviously bad parsing results
    const badIndicators = [
      // Too many very short messages (likely fragmented)
      messages.filter(m => m.text && m.text.length < MIN_MESSAGE_LENGTH).length / messages.length >
        0.5,

      // Messages with single-character usernames (likely misidentified)
      messages.filter(m => m.username && m.username.length <= 2).length > 0,

      // Messages with obviously wrong usernames (numbers, metadata)
      messages.filter(
        m => m.username && /^\d+$|^(Language|TypeScript|Last updated)$/i.test(m.username)
      ).length > 0,

      // Too many messages relative to content (over-fragmentation)
      totalLines > MIN_TOTAL_LINES && messages.length > totalLines * 0.8,

      // Messages with no content (empty messages shouldn't be created)
      messages.filter(m => !m.text || m.text.trim() === '').length > 0,
    ];

    // Use flexible parser fallback if any bad indicators are present
    const shouldSwitch = badIndicators.some(indicator => indicator);

    if (this.debugMode && shouldSwitch) {
      Logger.debug(
        'SlackFormatter',
        'Switching to flexible parser due to poor intelligent parser results',
        {
          messageCount: messages.length,
          totalLines,
          badIndicators: badIndicators.map((indicator, i) => ({ index: i, active: indicator })),
        }
      );
    }

    return shouldSwitch;
  }

  /**
   * Determine the appropriate formatting standard type based on detected format
   * @private
   * @param {string} formatType - The detected format type
   * @returns {string} The formatting standard type to use
   */
  private getFormattingStandardType(formatType: string): 'CONVERSATION' | 'COMPACT' | 'DETAILED' {
    // Note: formattingStyle is not part of SlackFormatSettings interface
    // Default based on format type
    switch (formatType) {
      case 'dm':
        return 'COMPACT';
      case 'thread':
        return 'DETAILED';
      default:
        return 'CONVERSATION';
    }
  }
}
