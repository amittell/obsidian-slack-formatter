import { SlackMessage } from '../../models';
import { Logger } from '../../utils/logger';
import { BaseProcessor } from './base-processor';
import { ProcessorResult } from '../../types/formatters.types';

/**
 * Configuration constants for message continuation detection
 */
const CONTINUATION_PHRASES = [
    /^even if a bit buggy/i,
    /^So, first attempt/i,
    /^Curious how/i,
    /^either way/i,
    /^oh interesting/i,
    /^nice$/i,
    /^seriously cool/i
];

/**
 * Post-processor that merges continuation messages (Unknown User with timestamps)
 * back into the previous author's message.
 * 
 * This handles cases where users post multiple times in a row and Slack
 * shows only timestamps for continuation messages.
 */
export class MessageContinuationProcessor extends BaseProcessor<SlackMessage[], SlackMessage[]> {
    /**
     * Process an array of messages to merge continuations.
     * 
     * @param messages - Array of parsed Slack messages
     * @returns ProcessorResult with processed array and modification status
     */
    public process(messages: SlackMessage[]): ProcessorResult<SlackMessage[]> {
        // Validate input array
        const validatedMessages = this.validateArrayInput<SlackMessage>(messages);
        if (validatedMessages.length === 0) {
            return { content: validatedMessages, modified: false };
        }

        const processed: SlackMessage[] = [];
        let lastKnownAuthor: SlackMessage | null = null;
        let modified = false;

        for (let i = 0; i < validatedMessages.length; i++) {
            const message = validatedMessages[i];
            
            // Check if this is a potential continuation message
            if (this.isContinuationCandidate(message, lastKnownAuthor)) {
                // Merge with the previous author's message
                if (lastKnownAuthor) {
                    this.mergeContinuation(lastKnownAuthor, message);
                    Logger.debug('MessageContinuationProcessor', 
                        `Merged continuation message at index ${i} with previous author ${lastKnownAuthor.username}`);
                    modified = true;
                    continue; // Skip adding this as a separate message
                }
            }

            // This is a regular message or a message with a known author
            processed.push(message);
            
            // Update last known author if this message has a valid username
            if (message.username && 
                typeof message.username === 'string' && 
                message.username !== 'Unknown User') {
                lastKnownAuthor = message;
            }
        }

        return { content: processed, modified };
    }

    /**
     * Check if a message is likely a continuation from the previous author.
     * 
     * @param message - The message to check
     * @param lastKnownAuthor - The last message with a known author
     * @returns True if this appears to be a continuation
     */
    private isContinuationCandidate(message: SlackMessage, lastKnownAuthor: SlackMessage | null): boolean {
        // Must have a previous message with a known author
        if (!lastKnownAuthor) {
            return false;
        }

        // Check if this message is attributed to "Unknown User"
        if (!message.username || message.username !== 'Unknown User') {
            return false;
        }

        // Check if the message starts with a timestamp pattern
        // Add null/undefined check for message.text before string operations
        if (!message.text || typeof message.text !== 'string') {
            return false;
        }
        const text = message.text.trim();
        
        // Enhanced timestamp detection for various formats
        const timestampPatterns = [
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\/archives\/[^)]+\)/i, // [8:26](url)
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]/i,  // [8:26] or [8:26 AM]
            /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?/i,  // 8:26 or 8:26 AM
            /^Today at \d{1,2}:\d{2}\s*(?:AM|PM)?/i, // Today at 8:26 AM
            /^Yesterday at \d{1,2}:\d{2}\s*(?:AM|PM)?/i, // Yesterday at 8:26 AM
            ...CONTINUATION_PHRASES  // Common continuation phrases
        ];

        // Check if the text starts with any timestamp pattern
        const startsWithTimestamp = timestampPatterns.some(pattern => pattern.test(text));
        
        // Also check if the entire message is just a timestamp followed by content on next line
        const lines = text.split('\n');
        const firstLine = lines[0]?.trim() || '';
        const isTimestampWithContent = timestampPatterns.some(pattern => pattern.test(firstLine)) && lines.length > 1;
        
        // Also check if the message has a timestamp but no real content
        // (just the timestamp line itself)
        // Add null/undefined check for message.timestamp before string operations
        const isJustTimestamp = message.timestamp && 
                               typeof message.timestamp === 'string' && 
                               (!text || text === message.timestamp);

        return startsWithTimestamp || isTimestampWithContent || isJustTimestamp;
    }

    /**
     * Merge a continuation message into the previous author's message.
     * 
     * @param targetMessage - The message to merge into
     * @param continuation - The continuation message to merge
     */
    private mergeContinuation(targetMessage: SlackMessage, continuation: SlackMessage): void {
        // Add null/undefined checks for message objects and their text properties
        if (!targetMessage || typeof targetMessage !== 'object') {
            return;
        }
        if (!continuation || typeof continuation !== 'object') {
            return;
        }
        if (!continuation.text || typeof continuation.text !== 'string') {
            return;
        }
        
        // Enhanced timestamp patterns for detection
        const timestampPatterns = [
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\/archives\/[^)]+\)/i, // [8:26](url)
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]/i,  // [8:26] or [8:26 AM]
            /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?/i,  // 8:26 or 8:26 AM
            /^Today at \d{1,2}:\d{2}\s*(?:AM|PM)?/i, // Today at 8:26 AM
            /^Yesterday at \d{1,2}:\d{2}\s*(?:AM|PM)?/i // Yesterday at 8:26 AM
        ];
        
        // Check if the continuation starts with a timestamp
        const lines = continuation.text.split('\n');
        const firstLine = lines[0]?.trim() || '';
        const startsWithTimestamp = timestampPatterns.some(pattern => pattern.test(firstLine));
        
        // Initialize targetMessage.text if it's null/undefined
        if (!targetMessage.text || typeof targetMessage.text !== 'string') {
            targetMessage.text = '';
        }
        
        // Add a blank line separator if the target already has content
        if (targetMessage.text) {
            targetMessage.text += '\n\n';
        }

        // If the continuation starts with a timestamp, include it and the content
        if (startsWithTimestamp) {
            targetMessage.text += continuation.text.trim();
        }
        // If the continuation has a timestamp in metadata, add it
        else if (continuation.timestamp && 
                 typeof continuation.timestamp === 'string' && 
                 continuation.timestamp !== targetMessage.timestamp) {
            targetMessage.text += continuation.timestamp;
            if (continuation.text && 
                typeof continuation.text === 'string' && 
                continuation.text !== continuation.timestamp) {
                targetMessage.text += '\n\n' + continuation.text;
            }
        } else {
            // Just add the text
            targetMessage.text += continuation.text;
        }

        // Merge reactions if any
        if (continuation.reactions && 
            Array.isArray(continuation.reactions) && 
            continuation.reactions.length > 0) {
            if (!targetMessage.reactions || !Array.isArray(targetMessage.reactions)) {
                targetMessage.reactions = [];
            }
            targetMessage.reactions.push(...continuation.reactions);
        }

        // Update thread info if the continuation has it
        if (continuation.threadInfo && 
            typeof continuation.threadInfo === 'string') {
            targetMessage.threadInfo = continuation.threadInfo;
        }
    }
}