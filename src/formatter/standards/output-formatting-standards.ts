import { SlackMessage } from '../../models.js';
import { SlackFormatSettings } from '../../types/settings.types.js';

/**
 * Standard formatting configurations for different output types
 */
export const FORMATTING_STANDARDS = {
    /** Standard conversation format */
    CONVERSATION: {
        messageSpacing: '\n\n',
        timestampFormat: '> **Time:** {timestamp}',
        usernameFormat: '> [!slack]+ Message from {username}',
        textIndent: '> ',
        includeReactions: true,
        reactionFormat: '\n> {emoji} {count}',
        threadIndent: '> ',
        embedIndent: '> '
    },
    
    /** Compact format for dense conversations */
    COMPACT: {
        messageSpacing: '\n',
        timestampFormat: '`{timestamp}`',
        usernameFormat: '{username}:',
        textIndent: ' ',
        includeReactions: false,
        reactionFormat: '',
        threadIndent: '• ',
        embedIndent: '  '
    },
    
    /** Detailed format with full metadata */
    DETAILED: {
        messageSpacing: '\n\n',
        timestampFormat: '> **Time:** {timestamp}',
        usernameFormat: '> [!slack]+ Message from {username}',
        textIndent: '> ',
        includeReactions: true,
        reactionFormat: '\n> {emoji} {count}',
        threadIndent: '> ',
        embedIndent: '> ',
        includeMetadata: true,
        includeThreadInfo: true
    }
} as const;

/**
 * Content type classifications for specialized formatting
 */
export enum ContentType {
    REGULAR_MESSAGE = 'regular_message',
    THREAD_REPLY = 'thread_reply',
    THREAD_START = 'thread_start',
    FILE_ATTACHMENT = 'file_attachment',
    LINK_PREVIEW = 'link_preview',
    SYSTEM_MESSAGE = 'system_message',
    EDITED_MESSAGE = 'edited_message'
}

/**
 * Formatting context for consistent output generation
 */
export interface FormattingContext {
    settings: SlackFormatSettings;
    standardType: keyof typeof FORMATTING_STANDARDS;
    showMetadata: boolean;
    preserveFormatting: boolean;
    cleanupEmbedded: boolean;
}

/**
 * Formatted message output with metadata
 */
export interface FormattedMessage {
    content: string;
    type: ContentType;
    metadata: {
        username: string;
        timestamp?: string;
        hasReactions: boolean;
        isThread: boolean;
        hasAttachments: boolean;
    };
}

/**
 * Output formatting standards processor that ensures consistent formatting
 * across different message types and contexts.
 */
export class OutputFormattingStandards {
    private context: FormattingContext;

    constructor(settings: SlackFormatSettings, standardType: keyof typeof FORMATTING_STANDARDS = 'CONVERSATION') {
        this.context = {
            settings,
            standardType,
            showMetadata: settings.includeMetadata ?? true,
            preserveFormatting: settings.preserveFormatting ?? true,
            cleanupEmbedded: settings.cleanupEmbedded ?? true
        };
    }

    /**
     * Format a single message according to the standards
     * @param message - SlackMessage to format
     * @param context - Additional formatting context
     * @returns Formatted message output
     */
    formatMessage(message: SlackMessage, context?: Partial<FormattingContext>): FormattedMessage {
        const effectiveContext = { ...this.context, ...context };
        const standard = FORMATTING_STANDARDS[effectiveContext.standardType];
        
        // Determine content type
        const contentType = this.determineContentType(message);
        
        // Build formatted content
        const parts: string[] = [];
        
        // Add username
        if (message.username) {
            const formattedUsername = this.formatUsername(message.username, standard, contentType);
            parts.push(formattedUsername);
        }
        
        // Add timestamp
        if (message.timestamp && effectiveContext.showMetadata) {
            const formattedTimestamp = this.formatTimestamp(message.timestamp, standard, contentType);
            parts.push(formattedTimestamp);
        }
        
        // Add message text
        if (message.text) {
            const formattedText = this.formatMessageText(message.text, standard, contentType, effectiveContext);
            parts.push(formattedText);
        }
        
        // Add reactions
        if (message.reactions && message.reactions.length > 0 && standard.includeReactions) {
            const formattedReactions = this.formatReactions(message.reactions, standard);
            if (formattedReactions) {
                parts.push(formattedReactions);
            }
        }
        
        // Add thread information
        if (message.threadInfo && effectiveContext.showMetadata && standard.includeThreadInfo) {
            const formattedThreadInfo = this.formatThreadInfo(message.threadInfo, standard);
            parts.push(formattedThreadInfo);
        }
        
        // Add edit indicator
        if (message.isEdited) {
            parts.push('*(edited)*');
        }
        
        // Combine parts according to content type
        const content = this.combineMessageParts(parts, standard, contentType);
        
        return {
            content,
            type: contentType,
            metadata: {
                username: message.username || 'Unknown User',
                timestamp: message.timestamp || undefined,
                hasReactions: Boolean(message.reactions && message.reactions.length > 0),
                isThread: Boolean(message.isThreadReply || message.isThreadStart),
                hasAttachments: this.hasAttachments(message)
            }
        };
    }

    /**
     * Format multiple messages with consistent spacing and structure
     * @param messages - Array of SlackMessage objects
     * @param context - Formatting context
     * @returns Array of formatted messages
     */
    formatMessages(messages: SlackMessage[], context?: Partial<FormattingContext>): FormattedMessage[] {
        const effectiveContext = { ...this.context, ...context };
        
        return messages.map(message => this.formatMessage(message, effectiveContext));
    }

    /**
     * Combine formatted messages into a single output string
     * @param formattedMessages - Array of formatted messages
     * @returns Combined output string
     */
    combineMessages(formattedMessages: FormattedMessage[]): string {
        const standard = FORMATTING_STANDARDS[this.context.standardType];
        const parts: string[] = [];
        
        formattedMessages.forEach((formattedMessage, index) => {
            parts.push(formattedMessage.content);
            
            // Add spacing between messages (except for the last one)
            if (index < formattedMessages.length - 1) {
                parts.push(standard.messageSpacing);
            }
        });
        
        return parts.join('');
    }

    /**
     * Determine content type for a message
     */
    private determineContentType(message: SlackMessage): ContentType {
        if (message.isThreadReply) return ContentType.THREAD_REPLY;
        if (message.isThreadStart) return ContentType.THREAD_START;
        if (message.isEdited) return ContentType.EDITED_MESSAGE;
        if (this.hasAttachments(message)) return ContentType.FILE_ATTACHMENT;
        if (this.hasLinkPreview(message)) return ContentType.LINK_PREVIEW;
        if (this.isSystemMessage(message)) return ContentType.SYSTEM_MESSAGE;
        
        return ContentType.REGULAR_MESSAGE;
    }

    /**
     * Format username according to standards
     */
    private formatUsername(username: string, standard: any, contentType: ContentType): string {
        let formattedUsername = standard.usernameFormat.replace('{username}', username);
        
        // Apply content-type specific formatting
        switch (contentType) {
            case ContentType.THREAD_REPLY:
                formattedUsername = standard.threadIndent + formattedUsername;
                break;
            case ContentType.SYSTEM_MESSAGE:
                formattedUsername = `*${username}*`;
                break;
        }
        
        return formattedUsername;
    }

    /**
     * Format timestamp according to standards
     */
    private formatTimestamp(timestamp: string, standard: any, contentType: ContentType): string {
        const formattedTimestamp = standard.timestampFormat.replace('{timestamp}', timestamp);
        
        // Apply content-type specific adjustments
        switch (contentType) {
            case ContentType.THREAD_REPLY:
                return standard.threadIndent + formattedTimestamp;
            default:
                return formattedTimestamp;
        }
    }

    /**
     * Format message text with proper indentation and cleanup
     */
    private formatMessageText(
        text: string, 
        standard: any, 
        contentType: ContentType, 
        context: FormattingContext
    ): string {
        let formattedText = text;
        
        // Apply cleanup if enabled
        if (context.cleanupEmbedded) {
            formattedText = this.cleanupEmbeddedContent(formattedText);
        }
        
        // Apply indentation based on content type
        const lines = formattedText.split('\n');
        let indent = standard.textIndent;
        
        switch (contentType) {
            case ContentType.THREAD_REPLY:
                indent = standard.threadIndent + indent;
                break;
            case ContentType.LINK_PREVIEW:
                indent = standard.embedIndent;
                break;
        }
        
        if (indent) {
            const indentedLines = lines.map(line => {
                if (!line.trim()) {
                    // For empty lines, just return the callout marker
                    return standard.usernameFormat.startsWith('> [!slack]') ? '>' : '';
                }
                return indent + line;
            });
            formattedText = indentedLines.join('\n');
        }
        
        return formattedText;
    }

    /**
     * Format reactions according to standards
     */
    private formatReactions(reactions: any[], standard: any): string {
        if (!reactions || reactions.length === 0) return '';
        
        const formattedReactions = reactions.map(reaction => {
            const emoji = reaction.emoji || reaction.name || '👍';
            const count = reaction.count || 1;
            return standard.reactionFormat.replace('{emoji}', emoji).replace('{count}', count.toString());
        });
        
        return formattedReactions.join('');
    }

    /**
     * Format thread information
     */
    private formatThreadInfo(threadInfo: string, standard: any): string {
        return `*${threadInfo}*`;
    }

    /**
     * Combine message parts according to content type
     */
    private combineMessageParts(parts: string[], standard: any, contentType: ContentType): string {
        // For callout formats, combine parts properly with newlines
        if (standard.usernameFormat.startsWith('> [!slack]')) {
            // First part should be the username header
            // Second part should be the timestamp line  
            // Remaining parts should be message content with proper callout prefixes
            const result: string[] = [];
            
            if (parts.length > 0) {
                result.push(parts[0]); // Username header: > [!slack]+ Message from ...
                
                if (parts.length > 1) {
                    result.push(parts[1]); // Timestamp: > **Time:** ...
                    
                    // Add blank line if there's content
                    if (parts.length > 2) {
                        result.push('>');
                        
                        // Add remaining parts (content, reactions, etc.)
                        for (let i = 2; i < parts.length; i++) {
                            result.push(parts[i]);
                        }
                    }
                }
            }
            
            return result.join('\n');
        }
        
        // Standard combination for other formats
        return parts.join(' ');
    }

    /**
     * Check if message has file attachments
     */
    private hasAttachments(message: SlackMessage): boolean {
        if (!message.text) return false;
        
        const attachmentIndicators = [
            'files.slack.com',
            '.pdf',
            '.doc',
            '.docx',
            '.zip',
            'download/',
            'PDF',
            'Google Doc'
        ];
        
        return attachmentIndicators.some(indicator => 
            message.text.includes(indicator)
        );
    }

    /**
     * Check if message contains link previews
     */
    private hasLinkPreview(message: SlackMessage): boolean {
        if (!message.text) return false;
        
        const urlCount = (message.text.match(/https?:\/\/[^\s]+/g) || []).length;
        return urlCount > 0;
    }

    /**
     * Check if message is a system message
     */
    private isSystemMessage(message: SlackMessage): boolean {
        if (!message.username) return false;
        
        const systemUsernames = [
            'Slackbot',
            'System',
            'Bot',
            'Integration'
        ];
        
        return systemUsernames.some(systemUser => 
            message.username.toLowerCase().includes(systemUser.toLowerCase())
        );
    }

    /**
     * Clean up embedded content from message text
     */
    private cleanupEmbeddedContent(text: string): string {
        let cleaned = text;
        
        // Remove standalone URLs that are likely link previews
        const lines = cleaned.split('\n');
        const cleanedLines = lines.filter(line => {
            const trimmed = line.trim();
            // Keep URL if it's part of a sentence
            if (trimmed.match(/^https?:\/\/[^\s]+$/) && 
                lines.some(otherLine => otherLine.trim() && otherLine !== line)) {
                return false;
            }
            return true;
        });
        
        cleaned = cleanedLines.join('\n');
        
        // Remove file attachment metadata lines
        const fileMetadataPatterns = [
            /^\s*(PDF|Doc|Google Doc|Zip)\s*$/gm,
            /^\s*\d+ files?\s*$/gm,
            /^\s*\[\s*\]\s*$/gm
        ];
        
        fileMetadataPatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });
        
        // Clean up extra whitespace
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
        
        return cleaned;
    }

    /**
     * Update formatting context
     * @param newContext - Partial context to merge
     */
    updateContext(newContext: Partial<FormattingContext>): void {
        this.context = { ...this.context, ...newContext };
    }

    /**
     * Get current formatting context
     * @returns Current formatting context
     */
    getContext(): FormattingContext {
        return { ...this.context };
    }

    /**
     * Apply formatting standards to raw message content
     * @param messages - Array of SlackMessage objects
     * @param context - Optional formatting context override
     * @returns Formatted markdown string
     */
    applyStandards(messages: SlackMessage[], context?: Partial<FormattingContext>): string {
        const formattedMessages = this.formatMessages(messages, context);
        return this.combineMessages(formattedMessages);
    }
}