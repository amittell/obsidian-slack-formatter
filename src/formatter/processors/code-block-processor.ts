import { BaseProcessor } from './base-processor';
import { formatCodeBlocks } from '../../utils/text-utils';
import type { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import Logger

/**
 * Specialized processor for converting Slack code block syntax to Markdown format.
 *
 * This processor handles the transformation of Slack's code block and inline code
 * formatting syntax into standard Markdown equivalents. It provides configurable
 * code block processing with comprehensive error handling and debug logging.
 *
 * ## Code Block Transformations
 * - **Slack Triple Backticks**: ```code``` → ```code``` (preservation)
 * - **Slack Single Backticks**: `code` → `code` (preservation)
 * - **Language Specification**: ```javascript\ncode``` → ```javascript\ncode```
 * - **Multi-line Code**: Handles complex code structures with proper formatting
 *
 * ## Processing Features
 * - **Configurable Processing**: Enable/disable code block processing via options
 * - **Error Recovery**: Graceful fallback to original content on processing errors
 * - **Debug Logging**: Optional detailed logging of code transformations
 * - **Content Preservation**: Maintains code integrity and formatting structure
 * - **Language Detection**: Preserves language specifications in code blocks
 *
 * ## Performance Considerations
 * - Efficient regex-based processing for code block detection
 * - Early return for disabled processing to minimize overhead
 * - Error handling prevents processing pipeline failures
 *
 * @extends BaseProcessor<string>
 * @example
 * ```typescript
 * // Create processor with all features enabled
 * const processor = new CodeBlockProcessor({
 *   enableCodeBlocks: true,
 *   isDebugEnabled: true
 * });
 *
 * // Process inline code
 * const inline = processor.process("Use `console.log()` for debugging");
 * console.log(inline.content); // "Use `console.log()` for debugging"
 * console.log(inline.modified); // true if transformation occurred
 *
 * // Process code block with language
 * const codeBlock = processor.process("```javascript\nconsole.log('Hello World');\n```");
 * console.log(codeBlock.content); // Properly formatted Markdown code block
 *
 * // Disabled processing
 * const disabledProcessor = new CodeBlockProcessor({ enableCodeBlocks: false });
 * const result = disabledProcessor.process("`code`");
 * console.log(result.modified); // false (no processing performed)
 *
 * // Error handling example
 * const malformedCode = processor.process("```unclosed code block");
 * console.log(malformedCode.content); // Original content (fallback on error)
 * ```
 * @see {@link formatCodeBlocks} - Underlying code block formatting utility
 * @see {@link BaseProcessor} - Base processor interface and utilities
 */
export class CodeBlockProcessor extends BaseProcessor<string> {
  private enableCodeBlocks: boolean;
  private isDebugEnabled: boolean; // Added property

  /**
   * Creates a new code block processor with configurable processing options.
   *
   * @param {Object} [options={}] - Configuration options for code block processing
   * @param {boolean} [options.enableCodeBlocks=true] - Enable/disable code block transformations
   * @param {boolean} [options.isDebugEnabled=false] - Enable detailed debug logging
   * @example
   * ```typescript
   * // Default configuration (code blocks enabled, debug disabled)
   * const defaultProcessor = new CodeBlockProcessor();
   *
   * // Custom configuration
   * const customProcessor = new CodeBlockProcessor({
   *   enableCodeBlocks: true,  // Process code blocks
   *   isDebugEnabled: true     // Enable debug logging
   * });
   *
   * // Minimal processing (disabled)
   * const minimalProcessor = new CodeBlockProcessor({
   *   enableCodeBlocks: false  // Skip code block processing entirely
   * });
   * ```
   */
  constructor(options: { enableCodeBlocks?: boolean; isDebugEnabled?: boolean } = {}) {
    // Updated constructor signature
    super();
    this.enableCodeBlocks = options.enableCodeBlocks ?? true;
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  /**
   * Process a line of text to convert Slack code block syntax to Markdown format.
   *
   * This method applies code block transformations to the input text, handling
   * various Slack code formatting patterns and converting them to standard
   * Markdown equivalents. The processing is configurable and includes comprehensive
   * error handling with fallback behavior.
   *
   * ## Processing Algorithm
   * 1. **Input Validation**: Ensure text is valid string input
   * 2. **Feature Check**: Skip processing if code blocks are disabled
   * 3. **Transformation**: Apply formatCodeBlocks utility function
   * 4. **Change Detection**: Compare input vs output to determine modification status
   * 5. **Debug Logging**: Log transformations when debug mode is enabled
   * 6. **Error Recovery**: Return original content if processing fails
   *
   * ## Code Block Patterns Handled
   * - Inline code with single backticks
   * - Multi-line code blocks with triple backticks
   * - Language-specific code blocks
   * - Nested code structures
   * - Mixed code and text content
   *
   * @param {string} line - Input text line containing potential code block syntax
   * @returns {ProcessorResult<string>} Result with processed content and modification status
   * @throws {Error} Processing errors are caught and logged, original content returned as fallback
   * @example
   * ```typescript
   * const processor = new CodeBlockProcessor({ isDebugEnabled: true });
   *
   * // Simple inline code
   * const result1 = processor.process("Use the `Array.map()` method");
   * console.log(result1.content);  // "Use the `Array.map()` method"
   * console.log(result1.modified); // true if transformation applied
   *
   * // Multi-line code block
   * const codeText = "```typescript\ninterface User {\n  name: string;\n}\n```";
   * const result2 = processor.process(codeText);
   * console.log(result2.modified); // true if formatting was applied
   *
   * // No code blocks (pass through)
   * const result3 = processor.process("Regular text with no code");
   * console.log(result3.modified); // false
   *
   * // Error handling (malformed code)
   * const result4 = processor.process("```unclosed");
   * console.log(result4.content);  // Original input (fallback)
   * console.log(result4.modified); // false
   * ```
   * @see {@link formatCodeBlocks} - Utility function that performs the actual transformation
   */
  process(line: string): ProcessorResult<string> {
    // Validate input
    const validationResult = this.validateStringInput(line);
    if (validationResult) {
      return validationResult;
    }

    if (!this.enableCodeBlocks) {
      return { content: line, modified: false };
    }
    try {
      const withCode = formatCodeBlocks(line);
      const modified = withCode !== line;
      if (modified) {
        // Changed log level to debug and pass isDebugEnabled flag
        if (this.isDebugEnabled) {
          Logger.debug(this.constructor.name, `Formatted code block: ${line} -> ${withCode}`);
        }
      }
      return { content: withCode, modified };
    } catch (error) {
      // Keep error logging as is, using the inherited log method which calls Logger.error
      this.log('error', `Error processing code block: ${error}`, { line });
      return { content: line, modified: false };
    }
  }
}
