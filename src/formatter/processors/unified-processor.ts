import { BaseProcessor } from './base-processor';
import { UrlProcessor } from './url-processor';
import { UsernameProcessor } from './username-processor';
import { CodeBlockProcessor } from './code-block-processor';
import { EmojiProcessor } from './emoji-processor';
import { ThreadLinkProcessor } from './thread-link-processor';
import { AttachmentProcessor } from './attachment-processor';
import { Logger } from '../../utils/logger';
import type { SlackFormatSettings } from '../../types/settings.types';
import type { ParsedMaps } from '../../types/formatters.types';

/**
 * Processing step configuration
 */
interface ProcessingStep {
    name: string;
    enabled: (settings: SlackFormatSettings) => boolean;
    processor: BaseProcessor<string>;
    process: (text: string, maps?: ParsedMaps) => string;
    fallback?: (text: string) => string;
}

/**
 * Unified content processor that handles all text transformations
 * with proper error handling and fallbacks
 */
export class UnifiedProcessor {
    private readonly steps: ProcessingStep[];
    // Remove instance logger - use static methods instead

    constructor(private settings: SlackFormatSettings) {
        // Initialize all processors
        const urlProcessor = new UrlProcessor();
        const usernameProcessor = new UsernameProcessor();
        const codeBlockProcessor = new CodeBlockProcessor();
        const emojiProcessor = new EmojiProcessor();
        const threadLinkProcessor = new ThreadLinkProcessor();
        const attachmentProcessor = new AttachmentProcessor();

        // Define processing pipeline
        // Order matters! Process attachments early to clean up metadata
        // Process URLs before usernames to avoid converting "slack" in URLs to wikilinks
        this.steps = [
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
     * Process content through the unified pipeline
     */
    process(text: string, parsedMaps: ParsedMaps, debug = false): string {
        if (!text) return '';

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
     * Fallback: Preserve code fences without full parsing
     */
    private preserveCodeFences(text: string): string {
        // Simple preservation of triple backticks
        return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `\`\`\`${lang}\n${code}\`\`\``;
        });
    }

    /**
     * Fallback: Simplify Slack URLs to basic markdown
     */
    private simplifyUrls(text: string): string {
        // Handle <url|text> format
        text = text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');
        
        // Handle <url> format
        text = text.replace(/<(https?:\/\/[^>]+)>/g, '$1');
        
        return text;
    }

    /**
     * Fallback: Simplify user mentions
     */
    private simplifyUserMentions(text: string): string {
        // Remove user IDs, keep just @
        text = text.replace(/<@U[A-Z0-9]+>/g, '@user');
        
        // Convert @username to [[username]]
        text = text.replace(/@(\w+)/g, '[[$1]]');
        
        return text;
    }

    /**
     * Update settings
     */
    updateSettings(settings: SlackFormatSettings): void {
        this.settings = settings;
    }

    /**
     * Get processing statistics
     */
    getStats(): { [key: string]: boolean } {
        const stats: { [key: string]: boolean } = {};
        
        for (const step of this.steps) {
            stats[step.name] = step.enabled(this.settings);
        }
        
        return stats;
    }
}