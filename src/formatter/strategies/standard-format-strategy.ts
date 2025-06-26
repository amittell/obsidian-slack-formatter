import { BaseFormatStrategy } from './base-format-strategy'; // Import base class
import { SlackFormatSettings } from '../../types/settings.types';
import { SlackMessage } from '../../models';
import { FormatStrategyType, ParsedMaps } from '../../types/formatters.types'; // Import ParsedMaps

/**
 * Standard format strategy for converting Slack messages to Obsidian callouts.
 * This is the default and most commonly used formatting strategy.
 * 
 * **Output Format:**
 * - Uses Obsidian callout syntax with `[!slack]+` type
 * - Converts usernames to Obsidian-style `[[Username]]` links
 * - Formats timestamps with timezone awareness
 * - Preserves message structure with proper indentation
 * - Thread information displayed with emoji indicators
 * - Reactions shown with Unicode emoji and counts
 * 
 * **Use Cases:**
 * - Standard Slack-to-Obsidian conversion
 * - Documentation of team conversations
 * - Meeting notes and discussion archives
 * - Knowledge base integration
 * 
 * **Performance:**
 * - Optimized for single-pass processing
 * - Memory efficient with cached processors
 * - Handles large conversation threads efficiently
 * 
 * @extends {BaseFormatStrategy}
 * 
 * @example
 * Input Slack message:
 * ```json
 * {
 *   "username": "john.doe",
 *   "text": "Let's review the **API design** for the new feature.\n\n```typescript\ninterface ApiResponse {\n  data: any;\n}\n```",
 *   "timestamp": "Feb 6th at 7:47 PM",
 *   "reactions": [{ "name": "thumbs_up", "count": 2 }]
 * }
 * ```
 * 
 * Output Obsidian format:
 * ```markdown
 * > [!slack]+ Message from [[john.doe]]
 * > **Time:** February 6, 2024 at 7:47 PM EST
 * >
 * > Let's review the **API design** for the new feature.
 * >
 * > ```typescript
 * > interface ApiResponse {
 * >   data: any;
 * > }
 * > ```
 * >
 * > 👍 2
 * ```
 * 
 * @see {@link BaseFormatStrategy} - Base class with common functionality
 * @see {@link BracketFormatStrategy} - Alternative bracket-based format
 * @see {@link MixedFormatStrategy} - Adaptive format detection
 */
export class StandardFormatStrategy extends BaseFormatStrategy {
    /**
     * Strategy type identifier for factory pattern registration.
     * @readonly
     */
    public readonly type: FormatStrategyType = 'standard';

    /**
     * Creates a new StandardFormatStrategy instance.
     * Inherits processor initialization from BaseFormatStrategy.
     * 
     * @param {SlackFormatSettings} settings - Configuration for formatting behavior
     * @param {ParsedMaps} parsedMaps - Pre-parsed maps for users, channels, and emoji
     * 
     * @example
     * ```typescript
     * const strategy = new StandardFormatStrategy({
     *   detectCodeBlocks: true,
     *   convertUserMentions: true,
     *   replaceEmoji: true,
     *   timeZone: 'America/New_York',
     *   highlightThreads: true
     * }, {
     *   userMap: new Map([['U123ABC', 'john.doe']]),
     *   channelMap: new Map([['C123DEF', 'general']]),
     *   emojiMap: new Map([[':smile:', '😊']])
     * });
     * ```
     */
    constructor(settings: SlackFormatSettings, parsedMaps: ParsedMaps) {
        super(settings, parsedMaps); // Call base constructor with maps
        // Processors are initialized in the base class using parsedMaps
    }

    /**
     * Formats the message header using standard Obsidian callout syntax.
     * Creates consistent header structure with user attribution and timestamp.
     * 
     * **Header Structure:**
     * 1. Callout title with username (converted to Obsidian link)
     * 2. Timestamp line with timezone formatting
     * 3. Special handling for thread replies
     * 
     * @param {SlackMessage} message - The Slack message to format
     * @returns {string[]} Array of header lines without '>' prefix
     * 
     * @example
     * Regular message:
     * ```typescript
     * formatHeader({ username: 'john.doe', timestamp: 'Feb 6th at 7:47 PM' })
     * // Returns: [
     * //   '[!slack]+ Message from [[john.doe]]',
     * //   '**Time:** February 6, 2024 at 7:47 PM EST'
     * // ]
     * ```
     * 
     * Thread reply:
     * ```typescript
     * formatHeader({ 
     *   username: 'jane.smith', 
     *   timestamp: 'Feb 6th at 8:15 PM',
     *   isThreadReply: true 
     * })
     * // Returns: [
     * //   '[!slack]+ Thread Reply from [[jane.smith]]',
     * //   '**Time:** February 6, 2024 at 8:15 PM EST'
     * // ]
     * ```
     */
    protected formatHeader(message: SlackMessage): string[] {
        // Use formatDisplayName which should handle mapping to [[Link]] if available, or return raw name
        const displayName = this.usernameProcessor.formatDisplayName(message.username);
        const formattedTimestamp = this.getFormattedTimestamp(message); // Use helper from base
        
        // Construct the new header lines with callout prefix
        const isThreadReply = message.isThreadReply || (message.threadInfo && message.threadInfo.includes('replied to a thread:'));
        const titleLine = isThreadReply 
            ? `[!slack]+ Thread Reply from ${displayName}`
            : `[!slack]+ Message from ${displayName}`;
        const timeLine = `**Time:** ${formattedTimestamp}`;
        
        return [titleLine, timeLine];
    }

    // Attachment processing is handled by the base class pipeline

    /**
     * Formats message reactions using Unicode emoji and counts.
     * Converts Slack reaction data to a readable format for Obsidian.
     * 
     * **Processing:**
     * - Maps Slack emoji names to Unicode characters
     * - Displays count for each reaction type
     * - Handles emoji processing errors gracefully
     * - Returns null if no reactions present
     * 
     * @param {SlackMessage} message - Message containing reaction data
     * @returns {string | null} Formatted reaction string or null if no reactions
     * 
     * @example
     * Input reactions:
     * ```typescript
     * {
     *   reactions: [
     *     { name: 'thumbs_up', count: 3 },
     *     { name: 'heart', count: 1 },
     *     { name: 'rocket', count: 2 }
     *   ]
     * }
     * ```
     * 
     * Output:
     * ```
     * "👍 3 ❤️ 1 🚀 2"
     * ```
     * 
     * Error handling:
     * ```typescript
     * // If emoji processing fails:
     * "[Error formatting reactions]"
     * ```
     */
    protected formatReactions(message: SlackMessage): string | null {
        if (!message.reactions || message.reactions.length === 0) {
            return null;
        }
        try {
            return this.emojiProcessor.processReactions(message.reactions);
        } catch (reactError) {
            this.log('error', `Error formatting reactions: ${reactError}`, { reactions: message.reactions });
            return '[Error formatting reactions]';
        }
    }

    /**
     * The main formatting logic is inherited from BaseFormatStrategy.
     * This strategy only implements the abstract methods to define its specific
     * formatting behavior while leveraging the common processing pipeline.
     * 
     * The inherited formatToMarkdown method handles:
     * - Message iteration and error handling
     * - Text processing through the processor pipeline
     * - Assembly of formatted output with proper spacing
     * - Integration of header, content, reactions, and thread info
     * 
     * @see {@link BaseFormatStrategy#formatToMarkdown} - Main formatting pipeline
     */
}