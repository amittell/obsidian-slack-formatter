import { BaseProcessor } from './base-processor';
import { formatThreadLinks } from '../../utils/text-utils';
import type { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import Logger

/**
 * Specialized processor for formatting Slack thread links into readable Markdown format.
 *
 * This processor handles the transformation of Slack's thread link syntax and threading
 * metadata into clean, readable Markdown representations. It manages thread navigation
 * links, reply counts, and other thread-related formatting while preserving the
 * conversational context and improving readability.
 *
 * ## Thread Link Transformations
 * - **Thread URLs**: Convert Slack thread URLs to readable link format
 * - **Reply Metadata**: Format reply counts and thread navigation elements
 * - **Thread Context**: Preserve threading relationships and conversation flow
 * - **Navigation Links**: Transform "View thread" and similar elements
 *
 * ## Processing Features
 * - **Configurable Processing**: Enable/disable thread link processing via options
 * - **Error Recovery**: Graceful fallback to original content on processing errors
 * - **Debug Logging**: Optional detailed logging of thread link transformations
 * - **Content Preservation**: Maintains thread structure and context information
 * - **Performance Optimization**: Efficient processing with early returns for disabled features
 *
 * ## Thread Link Patterns
 * The processor handles various Slack threading patterns:
 * - Thread permalink URLs
 * - Reply count indicators
 * - "View thread" navigation elements
 * - Thread metadata and timestamps
 * - Parent message references
 *
 * @extends BaseProcessor<string>
 * @example
 * ```typescript
 * // Create processor with thread links enabled
 * const processor = new ThreadLinkProcessor({
 *   enableThreadLinks: true,
 *   isDebugEnabled: true
 * });
 *
 * // Process thread navigation link
 * const threadNav = processor.process("View thread (5 replies)");
 * console.log(threadNav.content); // Clean Markdown thread link
 * console.log(threadNav.modified); // true if transformation applied
 *
 * // Process thread URL
 * const threadUrl = processor.process("https://workspace.slack.com/archives/C123/p1234567890123456?thread_ts=1234567890.123456");
 * console.log(threadUrl.content); // Formatted thread link
 *
 * // Disabled processing
 * const disabledProcessor = new ThreadLinkProcessor({ enableThreadLinks: false });
 * const result = disabledProcessor.process("View thread");
 * console.log(result.modified); // false (no processing performed)
 *
 * // Error handling example
 * const malformedLink = processor.process("Invalid thread syntax");
 * console.log(malformedLink.content); // Original content (fallback on error)
 * ```
 * @see {@link formatThreadLinks} - Underlying thread link formatting utility
 * @see {@link BaseProcessor} - Base processor interface and utilities
 */
export class ThreadLinkProcessor extends BaseProcessor<string> {
  private enableThreadLinks: boolean;
  private isDebugEnabled: boolean; // Added property

  /**
   * Creates a new thread link processor with configurable processing options.
   *
   * @param {Object} [options={}] - Configuration options for thread link processing
   * @param {boolean} [options.enableThreadLinks=true] - Enable/disable thread link transformations
   * @param {boolean} [options.isDebugEnabled=false] - Enable detailed debug logging
   * @example
   * ```typescript
   * // Default configuration (thread links enabled, debug disabled)
   * const defaultProcessor = new ThreadLinkProcessor();
   *
   * // Custom configuration
   * const customProcessor = new ThreadLinkProcessor({
   *   enableThreadLinks: true,  // Process thread links
   *   isDebugEnabled: true      // Enable debug logging
   * });
   *
   * // Minimal processing (disabled)
   * const minimalProcessor = new ThreadLinkProcessor({
   *   enableThreadLinks: false  // Skip thread link processing entirely
   * });
   * ```
   */
  constructor(options: { enableThreadLinks?: boolean; isDebugEnabled?: boolean } = {}) {
    // Updated constructor signature
    super();
    this.enableThreadLinks = options.enableThreadLinks ?? true;
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  /**
   * Process a line of text to convert Slack thread link syntax to Markdown format.
   *
   * This method applies thread link transformations to the input text, handling
   * various Slack threading patterns and converting them to readable Markdown
   * equivalents. The processing is configurable and includes comprehensive
   * error handling with fallback behavior.
   *
   * ## Processing Algorithm
   * 1. **Input Validation**: Ensure text is valid string input
   * 2. **Feature Check**: Skip processing if thread links are disabled
   * 3. **Transformation**: Apply formatThreadLinks utility function
   * 4. **Change Detection**: Compare input vs output to determine modification status
   * 5. **Debug Logging**: Log transformations when debug mode is enabled
   * 6. **Error Recovery**: Return original content if processing fails
   *
   * ## Thread Link Patterns Handled
   * - Slack thread permalink URLs
   * - "View thread" navigation elements
   * - Reply count indicators ("3 replies", "1 reply")
   * - Thread metadata and timestamps
   * - Parent message references
   *
   * @param {string} line - Input text line containing potential thread link syntax
   * @returns {ProcessorResult<string>} Result with processed content and modification status
   * @throws {Error} Processing errors are caught and logged, original content returned as fallback
   * @example
   * ```typescript
   * const processor = new ThreadLinkProcessor({ isDebugEnabled: true });
   *
   * // Thread navigation element
   * const result1 = processor.process("View thread (3 replies)");
   * console.log(result1.content);  // Formatted thread navigation
   * console.log(result1.modified); // true if transformation applied
   *
   * // Thread permalink URL
   * const threadUrl = "https://workspace.slack.com/archives/C123/p1234?thread_ts=1234";
   * const result2 = processor.process(threadUrl);
   * console.log(result2.modified); // true if formatting was applied
   *
   * // No thread content (pass through)
   * const result3 = processor.process("Regular message with no threading");
   * console.log(result3.modified); // false
   *
   * // Error handling (malformed thread syntax)
   * const result4 = processor.process("Malformed thread reference");
   * console.log(result4.content);  // Original input (fallback)
   * console.log(result4.modified); // false
   * ```
   * @see {@link formatThreadLinks} - Utility function that performs the actual transformation
   */
  process(line: string): ProcessorResult<string> {
    // Validate input
    const validationResult = this.validateStringInput(line);
    if (validationResult) {
      return validationResult;
    }

    if (!this.enableThreadLinks) {
      return { content: line, modified: false };
    }
    try {
      const withThreads = formatThreadLinks(line);
      const modified = withThreads !== line;
      if (modified) {
        // Changed log level to debug and pass isDebugEnabled flag
        Logger.debug(
          this.constructor.name,
          `Formatted thread link: ${line} -> ${withThreads}`,
          undefined,
          this.isDebugEnabled
        );
      }
      return { content: withThreads, modified };
    } catch (error) {
      // Keep error logging as is
      this.log('error', `Error processing thread link: ${error}`, { line });
      return { content: line, modified: false };
    }
  }
}
