import { BaseProcessor } from './base-processor';
// Removed formatSlackUrls import
import type { ProcessorResult } from '../../types/formatters.types';
import { formatSlackUrlSyntax } from '../../utils/text-utils'; // Import the utility function
import { Logger } from '../../utils/logger'; // Import Logger

/**
 * Specialized processor for converting Slack URL syntax to standard Markdown link format.
 * Handles multiple Slack URL patterns including simple URLs, labeled links, and email addresses
 * with comprehensive error handling and optional debug logging.
 *
 * ## Supported URL Formats
 * - **Simple URLs**: `<https://example.com>` → `https://example.com`
 * - **Labeled Links**: `<https://example.com|Click here>` → `[Click here](https://example.com)`
 * - **Email Addresses**: `<mailto:user@example.com>` → `user@example.com`
 * - **Email with Labels**: `<mailto:user@example.com|Contact us>` → `[Contact us](mailto:user@example.com)`
 *
 * ## Processing Features
 * - Preserves original content when no URLs are found
 * - Handles multiple URLs within a single line
 * - Maintains URL integrity and escaping
 * - Provides detailed debug logging for URL transformations
 * - Graceful error recovery with fallback to original content
 *
 * @extends {BaseProcessor<string>}
 * @since 1.0.0
 * @example
 * ```typescript
 * const processor = new UrlProcessor({ isDebugEnabled: true });
 *
 * // Simple URL conversion
 * const simple = processor.process("Check out <https://example.com>");
 * console.log(simple.content); // "Check out https://example.com"
 *
 * // Labeled link conversion
 * const labeled = processor.process("Visit <https://example.com|our website> for more info");
 * console.log(labeled.content); // "Visit [our website](https://example.com) for more info"
 *
 * // Multiple URLs in one line
 * const multiple = processor.process("See <https://docs.com|docs> and <https://api.com>");
 * console.log(multiple.content); // "See [docs](https://docs.com) and https://api.com"
 *
 * // Email handling
 * const email = processor.process("Contact <mailto:support@example.com|support team>");
 * console.log(email.content); // "Contact [support team](mailto:support@example.com)"
 * ```
 * @see {@link formatSlackUrlSyntax} - Underlying URL transformation utility
 * @see {@link BaseProcessor} - Base processor interface
 */
export class UrlProcessor extends BaseProcessor<string> {
  /** Debug mode flag */
  private isDebugEnabled: boolean; // Added property

  /**
   * Creates a new UrlProcessor instance with optional debug configuration.
   *
   * @param {Object} [options={}] - Configuration options for the processor
   * @param {boolean} [options.isDebugEnabled=false] - Enable detailed debug logging for URL transformations
   * @since 1.0.0
   * @example
   * ```typescript
   * // Basic processor (no debug logging)
   * const processor = new UrlProcessor();
   *
   * // Processor with debug logging enabled
   * const debugProcessor = new UrlProcessor({ isDebugEnabled: true });
   * ```
   */
  constructor(options: { isDebugEnabled?: boolean } = {}) {
    // Updated constructor signature
    super();
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  /**
   * Processes a text line to convert all Slack URL syntax to standard Markdown link format.
   * Identifies and transforms various Slack URL patterns while preserving the rest of the content.
   *
   * ## Processing Steps
   * 1. **Input Validation** - Ensures input is valid string content
   * 2. **URL Detection** - Identifies Slack URL patterns in the text
   * 3. **Format Conversion** - Transforms URLs to Markdown format
   * 4. **Debug Logging** - Logs transformations when debug mode is enabled
   * 5. **Result Generation** - Returns processed content with modification status
   *
   * ## Error Handling
   * - Input validation with automatic fallback for invalid inputs
   * - Comprehensive error catching with detailed logging
   * - Graceful degradation returns original content on processing failure
   *
   * @param {string} line - The text line containing potential Slack URL syntax
   * @returns {ProcessorResult} Result object with processed content and modification status
   * @throws {Error} Processing errors are caught internally and logged, original content returned on failure
   * @since 1.0.0
   * @example
   * ```typescript
   * const processor = new UrlProcessor({ isDebugEnabled: true });
   *
   * // Process line with multiple URL types
   * const text = "Visit <https://example.com|our site> or email <mailto:info@example.com>";
   * const result = processor.process(text);
   *
   * console.log(result.content);
   * // "Visit [our site](https://example.com) or email info@example.com"
   * console.log(result.modified); // true
   *
   * // Process line with no URLs
   * const plain = processor.process("Just regular text here");
   * console.log(plain.modified); // false - no changes made
   * ```
   * @see {@link formatSlackUrlSyntax} - Underlying URL transformation logic
   */
  process(line: string): ProcessorResult {
    // Validate input
    const validationResult = this.validateStringInput(line);
    if (validationResult) {
      return validationResult;
    }

    try {
      // Call the utility function
      const withUrls = formatSlackUrlSyntax(line);
      const modified = withUrls !== line;
      if (modified) {
        Logger.debug(this.constructor.name, `Formatted URL: ${line} -> ${withUrls}`);
      }
      return { content: withUrls, modified };
    } catch (error) {
      // Keep error logging as is
      this.log('error', `Error processing URL: ${error}`, { line });
      return { content: line, modified: false };
    }
  }

  // Removed private _formatSlackUrls method. Logic moved to text-utils.ts.
}
