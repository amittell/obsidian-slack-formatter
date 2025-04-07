import { BaseProcessor } from '../processors/base-processor';
import type { ProcessorResult } from '../../types/formatters.types';

export class PostProcessor extends BaseProcessor<string> {

    process(content: string): ProcessorResult {
        if (!content) {
            return { content: '', modified: false };
        }

        let modified = false; // Initialize modified as false
        let processedContent = content;
        const originalContent = content; // Keep for comparison if needed later

        try {
            // Add any other final cleanup steps here if needed
            // Example: Trim final whitespace (though PreProcessor might handle initial/final)
            const trimmedContent = processedContent.trim();
            if (trimmedContent !== processedContent) {
                processedContent = trimmedContent;
                modified = true;
            }

        } catch (error) {
            this.log('error', 'Error during postprocessing', { error, content: originalContent });
            // Return original content on error
            return { content: originalContent, modified: false };
        }

        // Ensure 'modified' reflects any changes made in this processor
        // If only trimming was done, 'modified' will be set correctly above.
        // If no steps modify the content, 'modified' remains false.
        return {
            content: processedContent,
            modified
        };
    }
}