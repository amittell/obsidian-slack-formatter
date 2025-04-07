import { BaseProcessor } from '../processors/base-processor';
// Removed imports for cleanSlackText, sanitizeInput
// import { cleanupDoubledUsernames } from '../../utils/username-utils'; // This was already commented/removed previously, keeping it out.
import type { ProcessorResult } from '../../types/formatters.types';

export class PreProcessor extends BaseProcessor<string> {
    private maxLines: number;

    constructor(maxLines: number = 5000) {
        super();
        this.maxLines = maxLines;
    }

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
            modified = modified || (processedContent !== originalContent);

        } catch (error) {
            this.log('error', 'Error during preprocessing', { error, content: originalContent });
            // In case of error, return the original content; it wasn't modified by this processor.
            return { content: originalContent, modified: false };
        }

        return {
            content: processedContent,
            modified
        };
    }

    updateMaxLines(maxLines: number): void {
        this.maxLines = maxLines;
    }
}