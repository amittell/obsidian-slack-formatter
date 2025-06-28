import { BaseProcessor } from '../processors/base-processor';
// Removed imports for cleanSlackText, sanitizeInput
// import { cleanupDoubledUsernames } from '../../utils/username-utils'; // This was already commented/removed previously, keeping it out.
import type { ProcessorResult } from '../../types/formatters.types';
import { duplicateDetectionService } from '../../utils/duplicate-detection-service';

/**
 * Configuration constants for message pattern detection during preprocessing.
 * These patterns help identify and remove duplicate content blocks.
 * @internal
 * @since 1.0.0
 */
const MESSAGE_START_PATTERNS = [
  /^[A-Za-z\s]+\s+\[.+\]\(https?:\/\/.+\)/, // Username with linked timestamp
  /^[A-Za-z\s]+\s+\d{1,2}:\d{2}\s*(?:AM|PM)?/, // Username with time
];

/**
 * Preprocessor that performs input validation, sanitization, and cleanup before main processing.
 * Handles text normalization, character encoding issues, content deduplication, and size limiting
 * to ensure clean input for the formatting pipeline.
 *
 * ## Processing Steps
 * 1. **Input Sanitization** - Removes null characters, normalizes line endings, removes invisible characters
 * 2. **Content Cleaning** - Trims whitespace, reduces excessive newlines
 * 3. **Deduplication** - Removes duplicate content blocks using pattern matching
 * 4. **Size Limiting** - Truncates content to maximum line count for performance protection
 *
 * ## Content Safety
 * - Preserves original content structure while normalizing encoding issues
 * - Handles malformed input gracefully with error recovery
 * - Provides detailed logging for debugging preprocessing issues
 * - Maintains content integrity during truncation operations
 *
 * @extends {BaseProcessor<string>}
 * @since 1.0.0
 * @example
 * ```typescript
 * // Basic preprocessing
 * const preprocessor = new PreProcessor(1000); // Max 1000 lines
 * const result = preprocessor.process(rawSlackContent);
 *
 * if (result.modified) {
 *   console.log('Content was cleaned and normalized');
 * }
 *
 * // Handle large content with custom limits
 * const largeContentProcessor = new PreProcessor(5000);
 * const cleaned = largeContentProcessor.process(largeSlackExport);
 *
 * // Update limits dynamically
 * preprocessor.updateMaxLines(2000);
 * ```
 * @see {@link BaseProcessor} - Base processor interface
 * @see {@link duplicateDetectionService} - Content deduplication logic
 */
export class PreProcessor extends BaseProcessor<string> {
  private maxLines: number;

  /**
   * Creates a new PreProcessor instance with configurable line limits.
   *
   * @param {number} [maxLines=5000] - Maximum number of lines to process before truncating content
   * @since 1.0.0
   * @example
   * ```typescript
   * // Default limit (5000 lines)
   * const preprocessor = new PreProcessor();
   *
   * // Custom limit for large content
   * const largeProcessor = new PreProcessor(10000);
   *
   * // Strict limit for performance
   * const strictProcessor = new PreProcessor(1000);
   * ```
   */
  constructor(maxLines: number = 5000) {
    super();
    this.maxLines = maxLines;
  }

  /**
   * Processes raw input content through comprehensive sanitization and normalization pipeline.
   * Performs multi-stage cleaning including character encoding fixes, content deduplication,
   * and size limiting with detailed modification tracking.
   *
   * ## Processing Pipeline
   * 1. **Character Sanitization** - Removes null bytes, normalizes line endings, strips invisible characters
   * 2. **Content Normalization** - Reduces excessive newlines, trims whitespace
   * 3. **Duplicate Removal** - Identifies and removes duplicate content blocks using pattern matching
   * 4. **Size Management** - Truncates content exceeding maximum line limits
   *
   * ## Error Handling
   * - Comprehensive error catching with fallback to original content
   * - Detailed error logging with context information
   * - Graceful degradation when specific processing steps fail
   *
   * @param {string} content - Raw input content to preprocess and clean
   * @returns {ProcessorResult} Result object containing cleaned content and modification status
   * @throws {Error} Processing errors are caught internally and logged, original content returned on failure
   * @since 1.0.0
   * @example
   * ```typescript
   * const preprocessor = new PreProcessor(1000);
   *
   * // Clean malformed content
   * const malformedContent = "Line 1\r\n\u200BLine 2\0\n\n\n\nToo many newlines";
   * const result = preprocessor.process(malformedContent);
   *
   * console.log(result.content); // "Line 1\nLine 2\n\nToo many newlines"
   * console.log(result.modified); // true
   *
   * // Handle large content
   * const largeContent = "line\n".repeat(5000); // 5000 lines
   * const truncated = preprocessor.process(largeContent);
   * // Content truncated to 1000 lines, result.modified = true
   *
   * // Process clean content (no changes)
   * const cleanContent = "Already clean content";
   * const unchanged = preprocessor.process(cleanContent);
   * console.log(unchanged.modified); // false
   * ```
   * @see {@link ProcessorResult} - Return type structure
   * @see {@link duplicateDetectionService} - Deduplication implementation
   */
  process(content: string): ProcessorResult {
    if (!content) {
      return { content: '', modified: false };
    }

    let originalContent = content; // Keep original for comparison
    let processedContent = content;
    let modified = false;

    try {
      // 1. Sanitize Input Steps (from sanitizeInput)
      // Remove null characters
      let sanitized = processedContent.replace(/\0/g, '');
      if (sanitized !== processedContent) modified = true;
      processedContent = sanitized;

      // Convert Windows line endings to Unix
      sanitized = processedContent.replace(/\r\n/g, '\n');
      if (sanitized !== processedContent) modified = true;
      processedContent = sanitized;

      // Remove any zero-width spaces or other invisible characters
      sanitized = processedContent.replace(/[\u200B-\u200D\uFEFF]/g, '');
      if (sanitized !== processedContent) modified = true;
      processedContent = sanitized;

      // Remove any excessive newlines (more than 2 in a row) - also part of cleanSlackText
      sanitized = processedContent.replace(/\n{3,}/g, '\n\n');
      if (sanitized !== processedContent) modified = true;
      processedContent = sanitized;

      // 2. Clean Slack Text Steps (from cleanSlackText)
      // Note: Zero-width spaces and excessive newlines handled in step 1.

      // Trim leading/trailing whitespace
      sanitized = processedContent.trim();
      if (sanitized !== processedContent) modified = true;
      processedContent = sanitized;

      // 2.5. Remove duplicate content blocks
      const deduplicated = duplicateDetectionService.removeDuplicateBlocks(
        processedContent,
        MESSAGE_START_PATTERNS
      );
      if (deduplicated !== processedContent) {
        modified = true;
        processedContent = deduplicated;
        this.log('info', 'Removed duplicate content blocks');
      }

      // 3. Truncate if exceeds max lines
      const lines = processedContent.split('\n');
      if (lines.length > this.maxLines) {
        processedContent = lines.slice(0, this.maxLines).join('\n');
        // Ensure truncation doesn't leave trailing whitespace if the last kept line had it
        processedContent = processedContent.trimEnd();
        modified = true;
        this.log('info', `Truncated input to ${this.maxLines} lines.`);
      }

      // Final check if anything actually changed
      modified = modified || processedContent !== originalContent;
    } catch (error) {
      this.log('error', 'Error during preprocessing', { error, content: originalContent });
      // In case of error, return the original content; it wasn't modified by this processor.
      return { content: originalContent, modified: false };
    }

    return {
      content: processedContent,
      modified,
    };
  }

  /**
   * Updates the maximum line limit for content truncation.
   * Allows dynamic reconfiguration of preprocessing behavior without creating a new instance.
   *
   * @param {number} maxLines - New maximum number of lines to process before truncation
   * @returns {void}
   * @since 1.0.0
   * @example
   * ```typescript
   * const preprocessor = new PreProcessor(1000);
   *
   * // Handle larger content temporarily
   * preprocessor.updateMaxLines(5000);
   * const result = preprocessor.process(largeContent);
   *
   * // Reset to stricter limit
   * preprocessor.updateMaxLines(500);
   * ```
   */
  updateMaxLines(maxLines: number): void {
    this.maxLines = maxLines;
  }
}
