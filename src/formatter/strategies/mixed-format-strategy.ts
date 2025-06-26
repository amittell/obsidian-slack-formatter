import { BaseFormatStrategy } from './base-format-strategy';
import { SlackMessage } from '../../models';
import type { SlackFormatSettings } from '../../types/settings.types';
import type { ParsedMaps } from '../../types/formatters.types';
import { Logger } from '../../utils/logger';

/**
 * Strategy for handling mixed format Slack exports
 * Adapts to different message formats within the same document
 */
export class MixedFormatStrategy extends BaseFormatStrategy {
    public readonly type = 'mixed' as const;

    constructor(settings: SlackFormatSettings, parsedMaps: ParsedMaps) {
        super(settings, parsedMaps);
    }

    /**
     * Format header - delegates to appropriate format method
     */
    protected formatHeader(message: SlackMessage): string[] {
        // This is handled by individual format methods
        return [];
    }

    /**
     * Format reactions - delegates to appropriate format method
     */
    protected formatReactions(message: SlackMessage): string | null {
        if (!message.reactions || message.reactions.length === 0) {
            return null;
        }
        
        const reactionText = message.reactions
            .map(r => `${r.name} ${r.count}`)
            .join(' ');
        
        return `> ${reactionText}`;
    }

    /**
     * Format messages with mixed formats
     */
    formatToMarkdown(messages: SlackMessage[]): string {
        if (!messages || messages.length === 0) {
            return '';
        }

        const formattedMessages: string[] = [];
        
        for (const message of messages) {
            // Detect the format for each message individually
            const format = this.detectMessageFormat(message);
            
            switch (format) {
                case 'standard':
                    formattedMessages.push(this.formatStandardMessage(message));
                    break;
                case 'bracket':
                    formattedMessages.push(this.formatBracketMessage(message));
                    break;
                case 'minimal':
                    formattedMessages.push(this.formatMinimalMessage(message));
                    break;
                default:
                    // Fallback to standard format
                    formattedMessages.push(this.formatStandardMessage(message));
            }
        }

        return formattedMessages.join('\n\n');
    }

    /**
     * Detect format for individual message
     */
    private detectMessageFormat(message: SlackMessage): 'standard' | 'bracket' | 'minimal' {
        // Check for bracket format indicators
        if (message.text.includes('[Message from') || message.text.includes('[Time:')) {
            return 'bracket';
        }
        
        // Check if it's a minimal message (just content, no clear headers)
        if (!message.username || message.username === 'Unknown User') {
            return 'minimal';
        }
        
        // Default to standard
        return 'standard';
    }

    /**
     * Format standard style message
     */
    private formatStandardMessage(message: SlackMessage): string {
        const lines: string[] = [];
        
        // Header with username
        const userLink = `[[${message.username}]]`;
        lines.push(`>[!note]+ Message from ${userLink}`);
        
        // Timestamp
        if (message.timestamp) {
            const formattedTime = this.getFormattedTimestamp(message);
            lines.push(`> **Time:** ${formattedTime}`);
        }
        
        // Content
        if (message.text) {
            const processedText = this.processContent(message.text);
            const contentLines = processedText.split('\n');
            
            // Add first line on same line as metadata if short
            if (contentLines.length === 1 && contentLines[0].length < 50) {
                if (lines.length > 1) {
                    lines[lines.length - 1] += ` — ${contentLines[0]}`;
                } else {
                    lines.push(`> ${contentLines[0]}`);
                }
            } else {
                lines.push('>');
                contentLines.forEach(line => {
                    lines.push(`> ${line}`);
                });
            }
        }
        
        // Reactions
        if (message.reactions && message.reactions.length > 0) {
            const reactionsStr = this.formatReactions(message);
            if (reactionsStr) {
                lines.push(`> **Reactions:** ${reactionsStr}`);
            }
        }
        
        // Thread info
        if (message.threadInfo) {
            lines.push(`> **Thread:** ${message.threadInfo}`);
        }
        
        return lines.join('\n');
    }

    /**
     * Format bracket style message
     */
    private formatBracketMessage(message: SlackMessage): string {
        const lines: string[] = [];
        
        // Header
        lines.push(`>[!note]+ [Message from ${message.username}]`);
        
        // Time in bracket format
        if (message.timestamp) {
            const formattedTime = this.getFormattedTimestamp(message);
            lines.push(`> [Time: ${formattedTime}]`);
        }
        
        // Content
        if (message.text) {
            const processedText = this.processContent(message.text);
            lines.push('>');
            processedText.split('\n').forEach(line => {
                lines.push(`> ${line}`);
            });
        }
        
        // Metadata in bracket format
        if (message.reactions && message.reactions.length > 0) {
            const reactionsStr = this.formatReactions(message);
            if (reactionsStr) {
                lines.push(`> [Reactions: ${reactionsStr}]`);
            }
        }
        
        if (message.threadInfo) {
            lines.push(`> [${message.threadInfo}]`);
        }
        
        return lines.join('\n');
    }

    /**
     * Formats a message with minimal or incomplete information.
     * Applied when message lacks clear structure or complete metadata.
     * 
     * **Minimal Message Features:**
     * - Simplified `[!info]` callout for reduced visual noise
     * - Graceful handling of missing usernames
     * - Optional timestamp inclusion when available
     * - Content-focused presentation
     * - Inline reactions without heavy formatting
     * 
     * @private
     * @param {SlackMessage} message - Message with incomplete or minimal data
     * @returns {string} Formatted message optimized for minimal information
     * 
     * @example
     * ```typescript
     * formatMinimalMessage({
     *   text: 'System notification or incomplete message',
     *   username: 'Unknown User'
     * })
     * // Returns:
     * // >[!info]
     * // > System notification or incomplete message
     * 
     * formatMinimalMessage({
     *   text: 'Bot message',
     *   timestamp: 'Feb 8th at 5:00 PM'
     * })
     * // Returns:
     * // >[!info]
     * // > February 8, 2024 at 5:00 PM
     * // > 
     * // > Bot message
     * ```
     */
    private formatMinimalMessage(message: SlackMessage): string {
        const lines: string[] = [];
        
        // Use a simpler callout for minimal messages
        lines.push(`>[!info]`);
        
        // Include username if available
        if (message.username && message.username !== 'Unknown User') {
            lines.push(`> **${message.username}**`);
        }
        
        // Include timestamp if available
        if (message.timestamp) {
            const formattedTime = this.getFormattedTimestamp(message);
            lines.push(`> ${formattedTime}`);
        }
        
        // Content
        if (message.text) {
            const processedText = this.processContent(message.text);
            if (message.username || message.timestamp) {
                lines.push('>'); // Blank line separator
            }
            processedText.split('\n').forEach(line => {
                lines.push(`> ${line}`);
            });
        }
        
        // Reactions inline
        if (message.reactions && message.reactions.length > 0) {
            const reactionsStr = this.formatReactions(message);
            if (reactionsStr) {
                lines.push(`> ${reactionsStr}`);
            }
        }
        
        return lines.join('\n');
    }

    /**
     * Process content with mixed format awareness
     */
    protected processContent(text: string): string {
        if (!text) return '';
        
        let processed = text;
        
        // Apply processors in order with fallback handling
        try {
            // URLs
            if (this.settings.convertSlackLinks) {
                processed = this.safeProcess(processed, p => this.urlProcessor.process(p).content);
            }
            
            // Usernames
            if (this.settings.convertUserMentions) {
                processed = this.safeProcess(processed, p => this.usernameProcessor.process(p).content);
            }
            
            // Code blocks
            if (this.settings.detectCodeBlocks) {
                processed = this.safeProcess(processed, p => this.codeBlockProcessor.process(p).content);
            }
            
            // Emoji
            if (this.settings.replaceEmoji) {
                processed = this.safeProcess(processed, p => this.emojiProcessor.process(p).content);
            }
            
            // Thread links
            if (this.settings.highlightThreads) {
                processed = this.safeProcess(processed, p => this.threadLinkProcessor.process(p).content);
            }
        } catch (error) {
            Logger.warn('MixedFormatStrategy', 'Error processing content, returning original', error);
            return text;
        }
        
        return processed;
    }

    /**
     * Safely process text with fallback
     */
    private safeProcess(text: string, processor: (text: string) => string): string {
        try {
            return processor(text);
        } catch (error) {
            Logger.warn('MixedFormatStrategy', 'Processor failed, returning original text', error);
            return text;
        }
    }
}