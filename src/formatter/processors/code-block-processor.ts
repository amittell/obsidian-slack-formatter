import { BaseProcessor } from './base-processor';
import { formatCodeBlocks } from '../../utils/text-utils';
import type { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import Logger

export class CodeBlockProcessor extends BaseProcessor<string> {
  private enableCodeBlocks: boolean;
  private isDebugEnabled: boolean; // Added property

  constructor(options: { enableCodeBlocks?: boolean; isDebugEnabled?: boolean } = {}) { // Updated constructor signature
    super();
    this.enableCodeBlocks = options.enableCodeBlocks ?? true;
    this.isDebugEnabled = options.isDebugEnabled ?? false; // Added initialization
  }

  process(line: string): ProcessorResult {
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
        Logger.debug(this.constructor.name, `Formatted code block: ${line} -> ${withCode}`, undefined, this.isDebugEnabled);
      }
      return { content: withCode, modified };
    } catch (error) {
      // Keep error logging as is, using the inherited log method which calls Logger.error
      this.log('error', `Error processing code block: ${error}`, { line });
      return { content: line, modified: false };
    }
  }
}