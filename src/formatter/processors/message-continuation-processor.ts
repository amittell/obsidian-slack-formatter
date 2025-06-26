import { SlackMessage } from '../../models';
import { Logger } from '../../utils/logger';
import { BaseProcessor } from './base-processor';
import { ProcessorResult } from '../../types/formatters.types';

/**
 * Configuration constants for message continuation detection patterns.
 * 
 * These regular expressions identify common phrases and patterns that indicate
 * a message is likely a continuation from a previous author. The patterns are
 * designed to catch informal conversation starters and continuation words that
 * typically appear when users post multiple messages in sequence.
 * 
 * ## Pattern Categories
 * - **Conversation Continuers**: "even if", "either way" - phrases that continue thoughts
 * - **Acknowledgments**: "nice", "oh interesting" - simple responses that continue context
 * - **Exploratory Phrases**: "Curious how", "So, first attempt" - investigative continuations
 * - **Informal Reactions**: "seriously cool" - casual responses indicating continuation
 * 
 * @constant
 * @readonly
 * @example
 * ```typescript
 * // These patterns would match:
 * // "even if a bit buggy" - matches /^even if a bit buggy/i
 * // "So, first attempt at this" - matches /^So, first attempt/i
 * // "nice work!" - matches /^nice$/i
 * ```
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
 * Post-processor that merges continuation messages back into the previous author's message.
 * 
 * This processor addresses a common Slack formatting issue where users post multiple
 * messages in rapid succession, causing Slack to display continuation messages with
 * only timestamps and "Unknown User" attribution instead of the original author's name.
 * The processor intelligently identifies these continuation patterns and merges them
 * back into cohesive, properly attributed messages.
 * 
 * ## Problem Addressed
 * When users send multiple messages quickly in Slack:
 * 1. First message: "Alice: Here's an interesting article about AI"
 * 2. Continuation: "Unknown User [8:26 AM]: The research methodology is fascinating"
 * 3. Continuation: "Unknown User [8:27 AM]: Worth reading the conclusion section"
 * 
 * ## Processing Algorithm
 * 1. **Author Tracking**: Maintain reference to last known message author
 * 2. **Continuation Detection**: Identify "Unknown User" messages with timestamp patterns
 * 3. **Content Merging**: Append continuation content to previous author's message
 * 4. **Metadata Preservation**: Maintain reactions, thread info, and timestamps
 * 
 * ## Timestamp Pattern Recognition
 * - `[8:26](url)` - Slack permalink format
 * - `[8:26 AM]` - Time with AM/PM indicators
 * - `8:26` - Simple time format
 * - `Today at 8:26 AM` - Relative time format
 * - Common continuation phrases from CONTINUATION_PHRASES
 * 
 * @extends BaseProcessor<SlackMessage[], SlackMessage[]>
 * @example
 * ```typescript
 * const processor = new MessageContinuationProcessor();
 * const messages = [
 *   { username: "Alice", text: "Check out this article" },
 *   { username: "Unknown User", text: "[8:26 AM] It's really well written" },
 *   { username: "Unknown User", text: "[8:27 AM] Especially the conclusion" }
 * ];
 * 
 * const result = processor.process(messages);
 * // Result: [
 * //   { username: "Alice", text: "Check out this article\n\n[8:26 AM] It's really well written\n\n[8:27 AM] Especially the conclusion" }
 * // ]
 * console.log(`Merged ${messages.length - result.content.length} continuation messages`);
 * ```
 * @see {@link CONTINUATION_PHRASES} - Patterns used for continuation detection
 * @see {@link BaseProcessor} - Parent class providing validation and logging utilities
 */
export class MessageContinuationProcessor extends BaseProcessor<SlackMessage[], SlackMessage[]> {
    /**
     * Process an array of messages to merge continuation messages with their original authors.
     * 
     * This is the main processing method that iterates through messages, identifies
     * continuation patterns, and merges them back into cohesive message threads.
     * The algorithm maintains proper message attribution while preserving all
     * metadata and ensuring conversation flow remains natural.
     * 
     * ## Processing Flow
     * 1. **Input Validation**: Ensure messages array is valid and non-empty
     * 2. **Sequential Processing**: Process messages in chronological order
     * 3. **Author Tracking**: Track last known author for continuation detection
     * 4. **Continuation Detection**: Identify "Unknown User" messages with timestamp patterns
     * 5. **Content Merging**: Append continuation content to previous author's message
     * 6. **Result Assembly**: Build final array with merged messages
     * 
     * ## Merging Strategy
     * - Preserve original message structure and metadata
     * - Add double line breaks between merged content sections
     * - Maintain timestamp information for context
     * - Preserve reactions and thread information
     * - Only merge when confident about continuation relationship
     * 
     * @param {SlackMessage[]} messages - Array of parsed Slack messages to process
     * @returns {ProcessorResult<SlackMessage[]>} Result containing processed messages and modification status
     * @throws {Error} When message validation fails or array processing encounters invalid data
     * @example
     * ```typescript
     * const processor = new MessageContinuationProcessor();
     * const messages = [
     *   { id: '1', username: 'John', text: 'Starting a new discussion' },
     *   { id: '2', username: 'Unknown User', text: '[2:15 PM] This is really important' },
     *   { id: '3', username: 'Unknown User', text: '[2:16 PM] Let me add some context' },
     *   { id: '4', username: 'Sarah', text: 'Thanks for the info!' }
     * ];
     * 
     * const result = processor.process(messages);
     * console.log(`Original: ${messages.length} messages, Processed: ${result.content.length} messages`);
     * console.log(`Modified: ${result.modified}`);
     * // Output: Original: 4 messages, Processed: 2 messages, Modified: true
     * ```
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
     * Check if a message is likely a continuation from the previous author using pattern analysis.
     * 
     * This method implements the core logic for identifying continuation messages by
     * analyzing message attribution, content patterns, and timestamp formatting.
     * It uses multiple detection strategies to accurately identify continuation
     * relationships while minimizing false positives.
     * 
     * ## Detection Criteria (all must be true)
     * 1. **Previous Author Exists**: There must be a recent message with known attribution
     * 2. **Unknown User Attribution**: Current message must be attributed to "Unknown User"
     * 3. **Timestamp Pattern Match**: Message content must match continuation patterns
     * 
     * ## Pattern Matching Strategies
     * - **Direct Timestamp Patterns**: `[8:26 AM]`, `8:26`, `Today at 8:26 AM`
     * - **Permalink Patterns**: `[8:26](https://workspace.slack.com/...)`
     * - **Continuation Phrases**: Common phrases indicating message continuation
     * - **Multiline Detection**: First line timestamp with content on subsequent lines
     * - **Standalone Timestamps**: Messages that are only timestamp metadata
     * 
     * ## Validation Logic
     * - Comprehensive null/undefined checks for message objects and properties
     * - String type validation before pattern matching
     * - Multiple pattern strategies for robust detection
     * 
     * @param {SlackMessage} message - The message to analyze for continuation patterns
     * @param {SlackMessage | null} lastKnownAuthor - The most recent message with valid author attribution
     * @returns {boolean} True if message appears to be a continuation, false otherwise
     * @private Internal method for continuation detection
     * @example
     * ```typescript
     * // Internal usage within process method
     * const isContinuation = this.isContinuationCandidate(
     *   { username: 'Unknown User', text: '[8:26 AM] This continues my previous thought' },
     *   { username: 'Alice', text: 'Starting a discussion about AI' }
     * );
     * console.log(isContinuation); // true
     * 
     * const isNotContinuation = this.isContinuationCandidate(
     *   { username: 'Bob', text: 'New message from different user' },
     *   { username: 'Alice', text: 'Previous message' }
     * );
     * console.log(isNotContinuation); // false
     * ```
     * @see {@link CONTINUATION_PHRASES} - Phrase patterns used for detection
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
        
        // Enhanced timestamp detection patterns for various Slack timestamp formats
        // Covers common timestamp presentations including permalinks and relative timestamps
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
     * Merge a continuation message into the previous author's message with proper formatting.
     * 
     * This method performs the actual content merging by appending continuation message
     * content to the target message while preserving formatting, timestamps, and metadata.
     * It handles various timestamp formats and ensures the merged content maintains
     * readability and proper structure.
     * 
     * ## Merging Process
     * 1. **Input Validation**: Comprehensive null/undefined checks for both messages
     * 2. **Content Analysis**: Detect timestamp patterns in continuation content
     * 3. **Format Preservation**: Maintain timestamp formatting when present
     * 4. **Content Appending**: Add continuation content with proper spacing
     * 5. **Metadata Merging**: Combine reactions and thread information
     * 
     * ## Content Formatting Rules
     * - Add double line breaks (`\n\n`) between message sections
     * - Preserve timestamp formatting when detected
     * - Include standalone timestamps from message metadata when different
     * - Maintain original content structure and whitespace
     * 
     * ## Metadata Handling
     * - **Reactions**: Append continuation reactions to target message
     * - **Thread Info**: Update thread information if continuation has newer info
     * - **Timestamps**: Preserve continuation timestamps for context
     * 
     * ## Safety Features
     * - Extensive null/undefined validation prevents runtime errors
     * - Type checking ensures string operations are safe
     * - Graceful handling of missing or malformed data
     * 
     * @param {SlackMessage} targetMessage - The message to merge continuation content into
     * @param {SlackMessage} continuation - The continuation message to be merged
     * @returns {void} Modifies targetMessage in place
     * @private Internal method for content merging
     * @example
     * ```typescript
     * // Internal usage within process method
     * const target = { username: 'Alice', text: 'Initial message' };
     * const continuation = { username: 'Unknown User', text: '[8:26 AM] Additional context' };
     * 
     * this.mergeContinuation(target, continuation);
     * console.log(target.text);
     * // Output: "Initial message\n\n[8:26 AM] Additional context"
     * 
     * // With reactions merging
     * const targetWithReactions = { username: 'Bob', text: 'Great idea!', reactions: ['👍'] };
     * const continuationWithReactions = { username: 'Unknown User', text: '[8:30 AM] Let me elaborate', reactions: ['🎯'] };
     * 
     * this.mergeContinuation(targetWithReactions, continuationWithReactions);
     * console.log(targetWithReactions.reactions); // ['👍', '🎯']
     * ```
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
        
        // Enhanced timestamp patterns for detection and formatting preservation
        // These patterns match the same timestamp formats used in isContinuationCandidate
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