import { BaseProcessor } from '../processors/base-processor';
import type { ProcessorResult } from '../../types/formatters.types';

/**
 * PostProcessor that performs final cleanup and normalization after main content processing.
 * Handles final whitespace management, content validation, and any last-minute formatting
 * adjustments to ensure clean, properly formatted output.
 * 
 * ## Processing Focus
 * - **Final Cleanup** - Removes trailing whitespace and normalizes final formatting
 * - **Content Validation** - Ensures output meets formatting standards
 * - **Error Recovery** - Provides fallback handling for processing failures
 * - **Minimal Changes** - Only applies necessary final adjustments
 * 
 * ## Design Philosophy
 * The PostProcessor is intentionally lightweight, focusing on final polish rather than
 * major transformations. Heavy processing should be done in earlier pipeline stages.
 * This stage ensures output consistency and handles edge cases from prior processing.
 * 
 * @extends {BaseProcessor<string>}
 * @since 1.0.0
 * @example
 * ```typescript
 * const postprocessor = new PostProcessor();
 * 
 * // Clean up formatted content
 * const formattedContent = `> [!slack]+ Message from User
 * > Content here
 * > 
 * > More content    `; // Note trailing spaces
 * 
 * const result = postprocessor.process(formattedContent);
 * // Removes trailing whitespace and ensures clean output
 * 
 * console.log(result.modified); // true if cleanup was needed
 * 
 * // Process already clean content
 * const cleanContent = `> [!slack]+ Message from User
 * > Clean content`;
 * 
 * const cleanResult = postprocessor.process(cleanContent);
 * console.log(cleanResult.modified); // false - no changes needed
 * ```
 * @see {@link BaseProcessor} - Base processor interface
 * @see {@link ProcessorResult} - Return type structure
 */
export class PostProcessor extends BaseProcessor<string> {

    /**
     * Processes formatted content through final cleanup and normalization steps.
     * Performs lightweight final adjustments to ensure clean, properly formatted output
     * without making major content transformations.
     * 
     * ## Current Processing Steps
     * 1. **Whitespace Cleanup** - Trims final trailing whitespace
     * 2. **Future Extensibility** - Framework for additional cleanup steps as needed
     * 
     * ## Error Handling
     * - Comprehensive error catching with fallback to original content
     * - Detailed error logging for debugging post-processing issues
     * - Graceful degradation when cleanup steps fail
     * 
     * @param {string} content - Formatted content from the main processing pipeline
     * @returns {ProcessorResult} Result object containing final cleaned content and modification status
     * @throws {Error} Processing errors are caught internally and logged, original content returned on failure
     * @since 1.0.0
     * @example
     * ```typescript
     * const postprocessor = new PostProcessor();
     * 
     * // Process content with trailing whitespace
     * const messyContent = `> [!slack]+ Message
     * > Content line 1   
     * > Content line 2    
     * >    `;
     * 
     * const cleaned = postprocessor.process(messyContent);
     * console.log(cleaned.modified); // true
     * console.log(cleaned.content.endsWith('   ')); // false - whitespace trimmed
     * 
     * // Process already clean content
     * const cleanContent = `> [!slack]+ Message
     * > Content line 1
     * > Content line 2`;
     * 
     * const unchanged = postprocessor.process(cleanContent);
     * console.log(unchanged.modified); // false - no changes needed
     * 
     * // Handle empty or null input
     * const empty = postprocessor.process('');
     * console.log(empty.content); // ''
     * console.log(empty.modified); // false
     * ```
     * @see {@link ProcessorResult} - Return type structure with content and modification status
     */
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