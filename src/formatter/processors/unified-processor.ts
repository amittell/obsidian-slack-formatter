import { BaseProcessor } from './base-processor';
import { UrlProcessor } from './url-processor';
import { UsernameProcessor } from './username-processor';
import { CodeBlockProcessor } from './code-block-processor';
import { EmojiProcessor } from './emoji-processor';
import { ThreadLinkProcessor } from './thread-link-processor';
import { AttachmentProcessor } from './attachment-processor';
import { Logger } from '../../utils/logger';
import {
  contentSanitizationPipeline,
  type PipelineOptions,
} from '../../utils/content-sanitization-pipeline';
import type { SlackFormatSettings } from '../../types/settings.types';
import type { ParsedMaps, ProcessorResult } from '../../types/formatters.types';

/**
 * Processing step configuration interface that defines a single transformation step
 * in the unified content processing pipeline. Each step encapsulates a specific
 * type of content transformation with its own enablement logic and fallback strategy.
 *
 * @internal
 * @since 1.0.0
 */
interface ProcessingStep {
  /** Human-readable name for the processing step (used in logging and debugging) */
  name: string;
  /** Function that determines if this step should be executed based on current settings */
  enabled: (settings: SlackFormatSettings) => boolean;
  /** The actual processor instance that performs the transformation */
  processor: BaseProcessor<string>;
  /** Main processing function that applies the transformation to text */
  process: (text: string, maps?: ParsedMaps) => string;
  /** Optional fallback function used when the main processor fails */
  fallback?: (text: string) => string;
}

/**
 * Unified content processor that orchestrates all text transformations in the Slack formatting pipeline.
 * Manages a sophisticated multi-stage processing pipeline with proper sequencing, error handling,
 * and fallback strategies for reliable content transformation.
 *
 * ## Processing Pipeline Architecture
 * Each processing step is independently configured with:
 * - Conditional enablement based on user settings
 * - Dedicated processor instance for the transformation
 * - Fallback strategy for error recovery
 * - Comprehensive error logging and debugging support
 *
 * ## Processing Order (Critical Sequence)
 * 1. **Text Sanitization** - Normalize encoding, fix character issues, ensure UTF-8 compliance
 * 2. **Code Blocks** - Preserve and protect code formatting from further processing
 * 3. **Attachments** - Process file metadata and link previews early to avoid conflicts
 * 4. **URLs** - Convert Slack URL format `<url|text>` and `<url>` to Markdown links
 * 5. **User Mentions** - Transform `<@U12345>` to wikilinks using user mapping
 * 6. **Emoji** - Replace `:emoji_code:` with Unicode characters or custom representations
 * 7. **Thread Links** - Apply highlighting and formatting to thread reference links
 *
 * ## Error Handling Strategy
 * - Each step includes robust error catching and logging
 * - Fallback functions provide graceful degradation when processors fail
 * - Original content is preserved when both primary and fallback processing fail
 * - Debug mode provides detailed step-by-step processing information
 *
 * ## Performance Considerations
 * - Pipeline steps are only executed when enabled in settings
 * - Early validation prevents unnecessary processing of invalid input
 * - Efficient processor reuse where possible
 * - Minimal memory allocation during processing
 *
 * @extends {BaseProcessor<string>}
 * @since 1.0.0
 * @example
 * ```typescript
 * // Basic usage
 * const processor = new UnifiedProcessor(settings);
 * const result = processor.process("Raw Slack content with <@U12345> and :smile:");
 *
 * // With user and emoji mappings
 * const parsedMaps = {
 *   userMap: { 'U12345': 'John Doe' },
 *   emojiMap: { ':smile:': '😊' }
 * };
 * const formatted = processor.processWithMaps(slackText, parsedMaps, true);
 *
 * // Check processing statistics
 * const stats = processor.getStats();
 * console.log('Enabled processors:', Object.keys(stats).filter(k => stats[k]));
 * ```
 * @see {@link BaseProcessor} - Base processor interface and validation
 * @see {@link UrlProcessor} - URL transformation logic
 * @see {@link UsernameProcessor} - User mention processing
 * @see {@link CodeBlockProcessor} - Code block preservation
 * @see {@link EmojiProcessor} - Emoji replacement logic
 */
export class UnifiedProcessor extends BaseProcessor<string> {
  private readonly steps: ProcessingStep[];
  // Remove instance logger - use static methods instead
  private readonly cachedPipelineOptions: PipelineOptions;

  /**
   * Creates a new UnifiedProcessor instance and initializes the complete processing pipeline.
   * Sets up all individual processors and configures their execution order, enablement conditions,
   * and fallback strategies based on the provided settings.
   *
   * ## Pipeline Initialization
   * - Creates instances of all specialized processors (URL, Username, CodeBlock, etc.)
   * - Configures processing steps with proper ordering and dependencies
   * - Sets up enablement logic based on settings flags
   * - Establishes fallback strategies for each transformation type
   *
   * ## Processing Order Rationale
   * - Text sanitization comes first to ensure clean input for all other processors
   * - Code blocks are processed early to protect code content from other transformations
   * - Attachments are handled before URLs to prevent conflicts with link metadata
   * - URLs are processed before usernames to avoid converting "slack" in URLs
   * - Emoji processing comes after mentions to avoid conflicts with user display names
   * - Thread links are processed last as they depend on clean content structure
   *
   * @param {SlackFormatSettings} settings - Plugin settings configuration that controls which processing steps are enabled and their behavior
   * @throws {Error} If any required processor fails to initialize (logged but does not prevent construction)
   * @since 1.0.0
   * @example
   * ```typescript
   * const settings = {
   *   convertSlackLinks: true,
   *   convertUserMentions: true,
   *   replaceEmoji: true,
   *   detectCodeBlocks: true,
   *   highlightThreads: false,
   *   enableTextSanitization: true,
   *   debug: false
   * };
   *
   * const processor = new UnifiedProcessor(settings);
   *
   * // The processor is now ready to transform Slack content
   * const result = processor.process(slackText);
   * ```
   * @internal Constructor implementation details are subject to change
   */
  constructor(private settings: SlackFormatSettings) {
    super();

    // Cache pipeline options to avoid repeated creation
    this.cachedPipelineOptions = this.createPipelineOptions();

    // Initialize all processors
    const urlProcessor = new UrlProcessor();
    const usernameProcessor = new UsernameProcessor();
    const codeBlockProcessor = new CodeBlockProcessor();
    const emojiProcessor = new EmojiProcessor();
    const threadLinkProcessor = new ThreadLinkProcessor();
    const attachmentProcessor = new AttachmentProcessor();

    // Define processing pipeline
    // Order matters! Sanitize text first, then process attachments early to clean up metadata
    // Process URLs before usernames to avoid converting "slack" in URLs to wikilinks
    this.steps = [
      {
        name: 'Text Sanitization',
        enabled: s => s.enableTextSanitization !== false, // Default to enabled
        processor: this, // Use self as processor for sanitization
        process: text => this.sanitizeText(text),
        fallback: text => text, // Keep original if sanitization fails
      },
      {
        name: 'Code Blocks',
        enabled: s => s.detectCodeBlocks,
        processor: codeBlockProcessor,
        process: text => codeBlockProcessor.process(text).content,
        fallback: text => this.preserveCodeFences(text),
      },
      {
        name: 'Attachments',
        enabled: s => true, // Always process attachments
        processor: attachmentProcessor,
        process: text => attachmentProcessor.process(text).content,
        fallback: text => text, // Keep original attachment text
      },
      {
        name: 'URLs',
        enabled: s => s.convertSlackLinks,
        processor: urlProcessor,
        process: text => urlProcessor.process(text).content,
        fallback: text => this.simplifyUrls(text),
      },
      {
        name: 'User Mentions',
        enabled: s => s.convertUserMentions,
        processor: usernameProcessor,
        process: (text, maps) => {
          const userProcessor = this.createUsernameProcessor(maps?.userMap || {});
          return userProcessor.process(text).content;
        },
        fallback: text => this.simplifyUserMentions(text),
      },
      {
        name: 'Emoji',
        enabled: s => s.replaceEmoji,
        processor: emojiProcessor,
        process: (text, maps) => {
          const emojiProc = this.createEmojiProcessor(maps?.emojiMap || {});
          return emojiProc.process(text).content;
        },
        fallback: text => text, // Keep original emoji codes
      },
      {
        name: 'Thread Links',
        enabled: s => s.highlightThreads,
        processor: threadLinkProcessor,
        process: text => threadLinkProcessor.process(text).content,
        fallback: text => text, // Keep original thread text
      },
    ];
  }

  /**
   * Creates a configured username processor with user mappings.
   * @private
   * @param userMap - User ID to display name mapping
   * @returns Configured UsernameProcessor instance
   */
  private createUsernameProcessor(userMap: Record<string, string>): UsernameProcessor {
    return new UsernameProcessor({
      userMap: userMap || {},
      enableMentions: true,
      isDebugEnabled: this.settings?.debug || false,
    });
  }

  /**
   * Creates a configured emoji processor with custom emoji mappings.
   * @private
   * @param emojiMap - Emoji code to Unicode/custom mapping
   * @returns Configured EmojiProcessor instance
   */
  private createEmojiProcessor(emojiMap: Record<string, string>): EmojiProcessor {
    return new EmojiProcessor({
      customEmojis: emojiMap || {},
      isDebugEnabled: this.settings?.debug || false,
    });
  }

  /**
   * Processes content through the unified pipeline using the BaseProcessor interface.
   * This method provides compatibility with the BaseProcessor framework and delegates
   * to the more comprehensive `processWithMaps` method.
   *
   * @param {string} input - The raw text content to process through the pipeline
   * @returns {ProcessorResult<string>} Result object containing the processed content and modification status
   * @since 1.0.0
   * @example
   * ```typescript
   * const processor = new UnifiedProcessor(settings);
   * const result = processor.process("Hello <@U12345>! Check out <https://example.com|this link>");
   *
   * console.log(result.content); // "Hello @user! Check out [this link](https://example.com)"
   * console.log(result.modified); // true
   * ```
   * @see {@link processWithMaps} - Full processing method with user/emoji mappings
   */
  process(input: string): ProcessorResult<string> {
    // For backward compatibility, delegate to the original method
    const result = this.processWithMaps(input, { userMap: {}, emojiMap: {} }, false);
    return { content: result, modified: result !== input };
  }

  /**
   * Processes content through the complete unified pipeline with user and emoji mappings.
   * This is the primary processing method that applies all enabled transformations in the
   * correct order with comprehensive error handling and debugging support.
   *
   * ## Processing Flow
   * 1. **Input Validation** - Validates input and returns early if invalid
   * 2. **Sequential Processing** - Applies each enabled step in configured order
   * 3. **Error Handling** - Catches errors and applies fallback strategies
   * 4. **Debug Logging** - Tracks processing steps and modifications when enabled
   * 5. **Result Return** - Returns fully processed text with all transformations
   *
   * ## Error Recovery
   * - Each processing step is wrapped in try-catch blocks
   * - Failed steps attempt to use configured fallback functions
   * - If both primary and fallback processing fail, original content is preserved
   * - All errors are logged with context for debugging
   *
   * @param {string} text - The raw Slack content to process through the pipeline
   * @param {ParsedMaps} parsedMaps - Object containing userMap (Slack user ID to display name) and emojiMap (emoji codes to Unicode)
   * @param {boolean} [debug=false] - Enable detailed debug logging and step-by-step processing information
   * @returns {string} Fully processed text with all enabled transformations applied
   * @throws {Error} Validation errors for invalid input (empty, null, or non-string values)
   * @since 1.0.0
   * @example
   * ```typescript
   * const slackContent = `Hey <@U12345>! :wave:
   * Check out this code:
   * \`\`\`javascript
   * console.log('Hello world');
   * \`\`\`
   * And visit <https://example.com|our website>`;
   *
   * const maps = {
   *   userMap: { 'U12345': 'John Doe' },
   *   emojiMap: { ':wave:': '👋' }
   * };
   *
   * const result = processor.processWithMaps(slackContent, maps, true);
   * // Returns formatted markdown with:
   * // - User mentions converted to wikilinks: [[John Doe]]
   * // - Emoji codes replaced: 👋
   * // - URLs converted to markdown links
   * // - Code blocks preserved and properly formatted
   * // - Debug information logged to console
   *
   * // Minimal processing (disabled emoji and mentions)
   * const minimalSettings = { convertUserMentions: false, replaceEmoji: false };
   * const minimalProcessor = new UnifiedProcessor(minimalSettings);
   * const minimalResult = minimalProcessor.processWithMaps(text, maps);
   * // Only URL and code block processing applied
   * ```
   * @see {@link ParsedMaps} - Structure of user and emoji mappings
   * @see {@link ProcessingStep} - Individual step configuration
   */
  processWithMaps(text: string, parsedMaps: ParsedMaps, debug = false): string {
    // Validate input
    const validationResult = this.validateStringInput(text);
    if (validationResult) {
      return validationResult.content;
    }

    let processed = text;
    const debugInfo: string[] = [];

    for (const step of this.steps) {
      if (!step.enabled(this.settings)) {
        if (debug) {
          debugInfo.push(`Skipped: ${step.name} (disabled)`);
        }
        continue;
      }

      try {
        const before = processed;
        processed = step.process(processed, parsedMaps);

        if (debug && before !== processed) {
          debugInfo.push(`Applied: ${step.name}`);
        }
      } catch (error) {
        Logger.warn('UnifiedProcessor', `Error in ${step.name} processor`, error);

        // Try fallback
        if (step.fallback) {
          try {
            processed = step.fallback(processed);
            if (debug) {
              debugInfo.push(`Fallback: ${step.name}`);
            }
          } catch (fallbackError) {
            Logger.error('UnifiedProcessor', `Fallback failed for ${step.name}`, fallbackError);
            // Keep original text for this step
            if (debug) {
              debugInfo.push(`Failed: ${step.name}`);
            }
          }
        }
      }
    }

    if (debug && debugInfo.length > 0) {
      Logger.debug('UnifiedProcessor', 'Processing steps', debugInfo, debug);
    }

    return processed;
  }

  /**
   * Fallback: Preserve code fences without full parsing.
   * Simple regex-based preservation when the full parser fails.
   * @private
   * @param {string} text - The text to process
   * @returns {string} Text with code fences preserved
   */
  private preserveCodeFences(text: string): string {
    // Simple preservation of triple backticks
    return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `\`\`\`${lang}\n${code}\`\`\``;
    });
  }

  /**
   * Fallback: Simplify Slack URLs to basic markdown.
   * Handles both <url|text> and <url> formats.
   * @private
   * @param {string} text - The text to process
   * @returns {string} Text with simplified URL formatting
   */
  private simplifyUrls(text: string): string {
    // Handle <url|text> format
    text = text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');

    // Handle <url> format
    text = text.replace(/<(https?:\/\/[^>]+)>/g, '$1');

    return text;
  }

  /**
   * Fallback: Simplify user mentions.
   * Converts user IDs to generic @user and @mentions to wikilinks.
   * @private
   * @param {string} text - The text to process
   * @returns {string} Text with simplified user mentions
   */
  private simplifyUserMentions(text: string): string {
    // Remove user IDs, keep just @
    text = text.replace(/<@U[A-Z0-9]+>/g, '@user');

    // Convert @username to [[username]]
    text = text.replace(/@(\w+)/g, '[[$1]]');

    return text;
  }

  /**
   * Create pipeline configuration options based on current settings.
   * @private
   * @returns {PipelineOptions} Configured pipeline options
   */
  private createPipelineOptions(): PipelineOptions {
    return {
      validatePreservation: this.settings?.debug || false,
      validationStrictness: 'normal',
      stopOnError: false,
      collectTiming: this.settings?.debug || false,
    };
  }

  /**
   * Sanitize text using the content sanitization pipeline.
   * @private
   * @param {string} text - The text to sanitize
   * @returns {string} Sanitized text
   */
  private sanitizeText(text: string): string {
    try {
      // Use cached pipeline options to avoid repeated creation
      const pipelineOptions = this.cachedPipelineOptions;

      // Use quick sanitize for performance in production
      if (this.settings?.debug) {
        const result = contentSanitizationPipeline.process(text, pipelineOptions);

        if (result.validation && !result.validation.isValid) {
          Logger.warn(
            'UnifiedProcessor',
            'Text sanitization validation issues:',
            result.validation.issues
          );
        }

        if (result.errors.length > 0) {
          Logger.warn('UnifiedProcessor', 'Text sanitization errors:', result.errors);
        }

        return result.text;
      } else {
        return contentSanitizationPipeline.quickSanitize(text);
      }
    } catch (error) {
      Logger.warn('UnifiedProcessor', 'Error in text sanitization:', error);
      return text; // Return original text if sanitization fails
    }
  }

  /**
   * Updates the processor configuration and propagates changes to all processing steps.
   * This method allows dynamic reconfiguration without recreating the processor instance.
   *
   * @param {SlackFormatSettings} settings - New settings configuration that will affect which processing steps are enabled
   * @returns {void}
   * @since 1.0.0
   * @example
   * ```typescript
   * const processor = new UnifiedProcessor(initialSettings);
   *
   * // Later, update settings to disable emoji processing
   * const updatedSettings = { ...initialSettings, replaceEmoji: false };
   * processor.updateSettings(updatedSettings);
   *
   * // Next processing call will skip emoji replacement
   * const result = processor.processWithMaps(text, maps);
   * ```
   */
  updateSettings(settings: SlackFormatSettings): void {
    this.settings = settings;
    // Update cached pipeline options when settings change
    (this as any).cachedPipelineOptions = this.createPipelineOptions();
  }

  /**
   * Retrieves comprehensive statistics about the current processor configuration.
   * Returns the enabled/disabled state of each processing step based on current settings,
   * useful for debugging, UI display, and configuration validation.
   *
   * @returns {{ [key: string]: boolean }} Map of processing step names to their enabled states
   * @since 1.0.0
   * @example
   * ```typescript
   * const processor = new UnifiedProcessor(settings);
   * const stats = processor.getStats();
   *
   * console.log('Processing capabilities:');
   * Object.entries(stats).forEach(([step, enabled]) => {
   *   console.log(`  ${step}: ${enabled ? 'enabled' : 'disabled'}`);
   * });
   *
   * // Example output:
   * // Processing capabilities:
   * //   Text Sanitization: enabled
   * //   Code Blocks: enabled
   * //   Attachments: enabled
   * //   URLs: enabled
   * //   User Mentions: disabled
   * //   Emoji: enabled
   * //   Thread Links: disabled
   *
   * // Use for conditional processing decisions
   * if (stats['User Mentions']) {
   *   console.log('User mentions will be processed');
   * }
   * ```
   */
  getStats(): { [key: string]: boolean } {
    const stats: { [key: string]: boolean } = {};

    for (const step of this.steps) {
      stats[step.name] = step.enabled(this.settings);
    }

    return stats;
  }
}
