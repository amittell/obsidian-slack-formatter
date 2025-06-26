import { BaseProcessor } from './base-processor';
import { UrlProcessor } from './url-processor';
import { UsernameProcessor } from './username-processor';
import { CodeBlockProcessor } from './code-block-processor';
import { EmojiProcessor } from './emoji-processor';
import { ThreadLinkProcessor } from './thread-link-processor';
import { AttachmentProcessor } from './attachment-processor';
import { Logger } from '../../utils/logger';
import { contentSanitizationPipeline, type PipelineOptions } from '../../utils/content-sanitization-pipeline';
import type { SlackFormatSettings } from '../../types/settings.types';
import type { ParsedMaps, ProcessorResult } from '../../types/formatters.types';

/**
 * Processing step configuration.
 * Defines a single transformation step in the processing pipeline.
 */
interface ProcessingStep {
    name: string;
    enabled: (settings: SlackFormatSettings) => boolean;
    processor: BaseProcessor<string>;
    process: (text: string, maps?: ParsedMaps) => string;
    fallback?: (text: string) => string;
}

/**
 * Unified content processor that handles all text transformations.
 * Orchestrates multiple processors in a defined pipeline order with
 * proper error handling and fallback strategies for each step.
 * 
 * Processing order:
 * 0. Text Sanitization - Clean up encoding issues and normalize text
 * 1. Code blocks - Preserve code formatting
 * 2. Attachments - Handle file and link preview metadata
 * 3. URLs - Convert Slack URL format to Markdown
 * 4. User mentions - Convert @mentions to wikilinks
 * 5. Emoji - Replace emoji codes with Unicode
 * 6. Thread links - Highlight thread references
 */
export class UnifiedProcessor extends BaseProcessor<string> {
    private readonly steps: ProcessingStep[];
    // Remove instance logger - use static methods instead

    /**
     * Creates a new UnifiedProcessor instance.
     * Initializes all sub-processors and defines the processing pipeline.
     * @param {SlackFormatSettings} settings - Plugin settings configuration
     */
    constructor(private settings: SlackFormatSettings) {
        super();
        // Initialize all processors
        const urlProcessor = new UrlProcessor();
        const usernameProcessor = new UsernameProcessor();
        const codeBlockProcessor = new CodeBlockProcessor();
        const emojiProcessor = new EmojiProcessor();
        const threadLinkProcessor = new ThreadLinkProcessor();
        const attachmentProcessor = new AttachmentProcessor();

        // Define processing pipeline
        // Order matters! Sanitize text first, then process attachments early to clean up metadata
        // Process URLs before usernames to avoid converting "slack" in URLs to wikilinks
        this.steps = [
            {
                name: 'Text Sanitization',
                enabled: (s) => s.enableTextSanitization !== false, // Default to enabled
                processor: this, // Use self as processor for sanitization
                process: (text) => this.sanitizeText(text),
                fallback: (text) => text, // Keep original if sanitization fails
            },
            {
                name: 'Code Blocks',
                enabled: (s) => s.detectCodeBlocks,
                processor: codeBlockProcessor,
                process: (text) => codeBlockProcessor.process(text).content,
                fallback: (text) => this.preserveCodeFences(text),
            },
            {
                name: 'Attachments',
                enabled: (s) => true, // Always process attachments
                processor: attachmentProcessor,
                process: (text) => attachmentProcessor.process(text).content,
                fallback: (text) => text, // Keep original attachment text
            },
            {
                name: 'URLs',
                enabled: (s) => s.convertSlackLinks,
                processor: urlProcessor,
                process: (text) => urlProcessor.process(text).content,
                fallback: (text) => this.simplifyUrls(text),
            },
            {
                name: 'User Mentions',
                enabled: (s) => s.convertUserMentions,
                processor: usernameProcessor,
                process: (text, maps) => {
                    const userProcessor = new UsernameProcessor({
                        userMap: maps?.userMap || {},
                        enableMentions: true,
                        isDebugEnabled: false
                    });
                    return userProcessor.process(text).content;
                },
                fallback: (text) => this.simplifyUserMentions(text),
            },
            {
                name: 'Emoji',
                enabled: (s) => s.replaceEmoji,
                processor: emojiProcessor,
                process: (text, maps) => {
                    const emojiProc = new EmojiProcessor({
                        customEmojis: maps?.emojiMap || {},
                        isDebugEnabled: false
                    });
                    return emojiProc.process(text).content;
                },
                fallback: (text) => text, // Keep original emoji codes
            },
            {
                name: 'Thread Links',
                enabled: (s) => s.highlightThreads,
                processor: threadLinkProcessor,
                process: (text) => threadLinkProcessor.process(text).content,
                fallback: (text) => text, // Keep original thread text
            },
        ];
    }

    /**
     * Process content through the unified pipeline.
     * This method is called by the BaseProcessor framework.
     * @param {string} input - The text to process
     * @returns {ProcessorResult<string>} Processed result with modification status
     */
    process(input: string): ProcessorResult<string> {
        // For backward compatibility, delegate to the original method
        const result = this.processWithMaps(input, { userMap: {}, emojiMap: {} }, false);
        return { content: result, modified: result !== input };
    }

    /**
     * Process content through the unified pipeline with maps.
     * Applies each enabled processor in sequence with error handling.
     * @param {string} text - The text to process
     * @param {ParsedMaps} parsedMaps - User and emoji mappings
     * @param {boolean} [debug=false] - Enable debug logging
     * @returns {string} Processed text with all transformations applied
     */
    processWithMaps(text: string, parsedMaps: ParsedMaps, debug = false): string {
        // Validate input
        const validationResult = this.validateStringInput(text);
        if (validationResult) {
            return validationResult.content;
        }

        let processed = text;
        const debugInfo: string[] = [];

        for (const step of this.steps) {
            if (!step.enabled(this.settings)) {
                if (debug) {
                    debugInfo.push(`Skipped: ${step.name} (disabled)`);
                }
                continue;
            }

            try {
                const before = processed;
                processed = step.process(processed, parsedMaps);
                
                if (debug && before !== processed) {
                    debugInfo.push(`Applied: ${step.name}`);
                }
            } catch (error) {
                Logger.warn('UnifiedProcessor', `Error in ${step.name} processor`, error);
                
                // Try fallback
                if (step.fallback) {
                    try {
                        processed = step.fallback(processed);
                        if (debug) {
                            debugInfo.push(`Fallback: ${step.name}`);
                        }
                    } catch (fallbackError) {
                        Logger.error('UnifiedProcessor', `Fallback failed for ${step.name}`, fallbackError);
                        // Keep original text for this step
                        if (debug) {
                            debugInfo.push(`Failed: ${step.name}`);
                        }
                    }
                }
            }
        }

        if (debug && debugInfo.length > 0) {
            Logger.debug('UnifiedProcessor', 'Processing steps', debugInfo, debug);
        }

        return processed;
    }

    /**
     * Fallback: Preserve code fences without full parsing.
     * Simple regex-based preservation when the full parser fails.
     * @private
     * @param {string} text - The text to process
     * @returns {string} Text with code fences preserved
     */
    private preserveCodeFences(text: string): string {
        // Simple preservation of triple backticks
        return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `\`\`\`${lang}\n${code}\`\`\``;
        });
    }

    /**
     * Fallback: Simplify Slack URLs to basic markdown.
     * Handles both <url|text> and <url> formats.
     * @private
     * @param {string} text - The text to process
     * @returns {string} Text with simplified URL formatting
     */
    private simplifyUrls(text: string): string {
        // Handle <url|text> format
        text = text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');
        
        // Handle <url> format
        text = text.replace(/<(https?:\/\/[^>]+)>/g, '$1');
        
        return text;
    }

    /**
     * Fallback: Simplify user mentions.
     * Converts user IDs to generic @user and @mentions to wikilinks.
     * @private
     * @param {string} text - The text to process
     * @returns {string} Text with simplified user mentions
     */
    private simplifyUserMentions(text: string): string {
        // Remove user IDs, keep just @
        text = text.replace(/<@U[A-Z0-9]+>/g, '@user');
        
        // Convert @username to [[username]]
        text = text.replace(/@(\w+)/g, '[[$1]]');
        
        return text;
    }

    /**
     * Sanitize text using the content sanitization pipeline.
     * @private
     * @param {string} text - The text to sanitize
     * @returns {string} Sanitized text
     */
    private sanitizeText(text: string): string {
        try {
            // Configure sanitization based on settings
            const pipelineOptions: PipelineOptions = {
                validatePreservation: this.settings?.debug || false,
                validationStrictness: 'normal',
                stopOnError: false,
                collectTiming: this.settings?.debug || false
            };

            // Use quick sanitize for performance in production
            if (this.settings?.debug) {
                const result = contentSanitizationPipeline.process(text, pipelineOptions);
                
                if (result.validation && !result.validation.isValid) {
                    Logger.warn('UnifiedProcessor', 'Text sanitization validation issues:', result.validation.issues);
                }
                
                if (result.errors.length > 0) {
                    Logger.warn('UnifiedProcessor', 'Text sanitization errors:', result.errors);
                }
                
                return result.text;
            } else {
                return contentSanitizationPipeline.quickSanitize(text);
            }
        } catch (error) {
            Logger.warn('UnifiedProcessor', 'Error in text sanitization:', error);
            return text; // Return original text if sanitization fails
        }
    }

    /**
     * Update processor settings.
     * @param {SlackFormatSettings} settings - New settings configuration
     * @returns {void}
     */
    updateSettings(settings: SlackFormatSettings): void {
        this.settings = settings;
    }

    /**
     * Get processing statistics.
     * Returns the enabled/disabled state of each processing step.
     * @returns {{ [key: string]: boolean }} Map of step names to enabled states
     */
    getStats(): { [key: string]: boolean } {
        const stats: { [key: string]: boolean } = {};
        
        for (const step of this.steps) {
            stats[step.name] = step.enabled(this.settings);
        }
        
        return stats;
    }
}