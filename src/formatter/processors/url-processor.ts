import { BaseProcessor } from './base-processor';
// Removed formatSlackUrls import
import type { ProcessorResult } from '../../types/formatters.types';
import { formatSlackUrlSyntax } from '../../utils/text-utils'; // Import the utility function
import { Logger } from '../../utils/logger'; // Import Logger

/**
 * Processor for converting Slack URL syntax to Markdown format.
 * Handles <url>, <url|text>, and email formats.
 * @extends {BaseProcessor<string>}
 */
export class UrlProcessor extends BaseProcessor<string> {
  /** Debug mode flag */
  private isDebugEnabled: boolean; // Added property

  /**
   * Creates a new UrlProcessor instance.
   * @param {Object} options - Configuration options
   * @param {boolean} [options.isDebugEnabled=false] - Enable debug logging
   */
  constructor(options: { isDebugEnabled?: boolean } = {}) { // Updated constructor signature
    super();
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  /**
   * Process a line to convert Slack URL syntax to Markdown.
   * Delegates to formatSlackUrlSyntax utility for the actual conversion.
   * @param {string} line - The line to process
   * @returns {ProcessorResult} Processed content with Markdown-formatted URLs
   */
  process(line: string): ProcessorResult {
    try {
      // Call the utility function
      const withUrls = formatSlackUrlSyntax(line);
      const modified = withUrls !== line;
       if (modified) {
        // Changed log level to debug and pass isDebugEnabled flag
        Logger.debug(this.constructor.name, `Formatted URL: ${line} -> ${withUrls}`, undefined, this.isDebugEnabled);
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