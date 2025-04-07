import { BaseProcessor } from './base-processor';
// Removed formatSlackUrls import
import type { ProcessorResult } from '../../types/formatters.types';
import { formatSlackUrlSyntax } from '../../utils/text-utils'; // Import the utility function
import { Logger } from '../../utils/logger'; // Import Logger

export class UrlProcessor extends BaseProcessor<string> {
  private isDebugEnabled: boolean; // Added property

  constructor(options: { isDebugEnabled?: boolean } = {}) { // Updated constructor signature
    super();
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

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