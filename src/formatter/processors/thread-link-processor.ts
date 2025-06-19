import { BaseProcessor } from './base-processor';
import { formatThreadLinks } from '../../utils/text-utils';
import type { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import Logger

export class ThreadLinkProcessor extends BaseProcessor<string> {
  private enableThreadLinks: boolean;
  private isDebugEnabled: boolean; // Added property

  constructor(options: { enableThreadLinks?: boolean; isDebugEnabled?: boolean } = {}) { // Updated constructor signature
    super();
    this.enableThreadLinks = options.enableThreadLinks ?? true;
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  process(line: string): ProcessorResult {
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
        Logger.debug(this.constructor.name, `Formatted thread link: ${line} -> ${withThreads}`, undefined, this.isDebugEnabled);
      }
      return { content: withThreads, modified };
    } catch (error) {
      // Keep error logging as is
      this.log('error', `Error processing thread link: ${error}`, { line });
      return { content: line, modified: false };
    }
  }
}