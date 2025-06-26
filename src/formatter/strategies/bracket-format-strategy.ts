import { BaseFormatStrategy } from './base-format-strategy'; // Import base class
import { SlackFormatSettings } from '../../types/settings.types';
import { SlackMessage } from '../../models';
import { FormatStrategyType, ParsedMaps } from '../../types/formatters.types'; // Import ParsedMaps

/**
 * Bracket-based format strategy for Slack message conversion.
 * Alternative formatting approach using bracket notation for metadata.
 * 
 * **Key Differences from Standard Format:**
 * - Uses bracket notation `[Message from user]` instead of callouts
 * - Metadata enclosed in brackets: `[Time: timestamp]`
 * - More compact header presentation
 * - Compatible with systems that don't support Obsidian callouts
 * - Maintains readability in plain text editors
 * 
 * **Output Format:**
 * - Headers: `[!slack]+ [Message from username]`
 * - Timestamps: `[Time: formatted_time]`
 * - Thread info: `[Thread info]`
 * - Reactions: `[Reactions: emoji counts]`
 * - Preserved message content with proper indentation
 * 
 * **Use Cases:**
 * - Legacy system compatibility
 * - Plain text documentation
 * - Reduced visual noise preference
 * - Integration with non-Obsidian markdown systems
 * - Automated processing where bracket parsing is easier
 * 
 * **Migration Path:**
 * - Can be converted to standard format via regex patterns
 * - Maintains semantic structure for easy transformation
 * - Preserves all original message data
 * 
 * @extends {BaseFormatStrategy}
 * 
 * @example
 * Input Slack message:
 * ```json
 * {
 *   "username": "alice.cooper",
 *   "text": "Here's the updated **design mockup**\n\n![design.png](attachment)",
 *   "timestamp": "Feb 7th at 9:23 AM",
 *   "reactions": [{ "name": "art", "count": 1 }],
 *   "threadInfo": "3 replies Last reply 1 hour ago"
 * }
 * ```
 * 
 * Output bracket format:
 * ```markdown
 * > [!slack]+ [Message from [[alice.cooper]]]
 * > [Time: February 7, 2024 at 9:23 AM EST]
 * >
 * > Here's the updated **design mockup**
 * >
 * > ![design.png](attachment)
 * >
 * > [Reactions: 🎨 1]
 * >
 * > [📊 **3 replies** • Last reply 1 hour ago]
 * ```
 * 
 * @see {@link BaseFormatStrategy} - Base class with common functionality
 * @see {@link StandardFormatStrategy} - Standard Obsidian callout format
 * @see {@link MixedFormatStrategy} - Adaptive format detection
 */
export class BracketFormatStrategy extends BaseFormatStrategy {
    /**
     * Strategy type identifier for factory pattern registration.
     * @readonly
     */
    public readonly type: FormatStrategyType = 'bracket';

    /**
     * Creates a new BracketFormatStrategy instance.
     * Inherits all processor initialization from BaseFormatStrategy.
     * 
     * @param {SlackFormatSettings} settings - Configuration for formatting behavior
     * @param {ParsedMaps} parsedMaps - Pre-parsed maps for users, channels, and emoji
     * 
     * @example
     * ```typescript
     * const bracketStrategy = new BracketFormatStrategy({
     *   detectCodeBlocks: true,
     *   convertUserMentions: true,
     *   replaceEmoji: true,
     *   timeZone: 'UTC',
     *   highlightThreads: false  // Different preference
     * }, {
     *   userMap: new Map([['U456DEF', 'alice.cooper']]),
     *   channelMap: new Map([['C789GHI', 'design-team']]),
     *   emojiMap: new Map([[':art:', '🎨']])
     * });
     * ```
     */
    constructor(settings: SlackFormatSettings, parsedMaps: ParsedMaps) {
        super(settings, parsedMaps); // Call base constructor with maps
        // Processors are initialized in the base class using parsedMaps
    }

    /**
     * Formats the message header using bracket notation for metadata.
     * Creates a distinctive bracket-based structure for message attribution.
     * 
     * **Bracket Format Structure:**
     * - Title: `[!slack]+ [Message from username]` or `[Thread Reply from username]`
     * - Time: `[Time: formatted_timestamp]`
     * - Brackets provide visual separation and parsing consistency
     * - Compatible with text processing tools that expect structured metadata
     * 
     * @param {SlackMessage} message - The Slack message to format
     * @returns {string[]} Array of header lines without '>' prefix
     * 
     * @example
     * Regular message header:
     * ```typescript
     * formatHeader({ username: 'alice.cooper', timestamp: 'Feb 7th at 9:23 AM' })
     * // Returns: [
     * //   '[!slack]+ [Message from [[alice.cooper]]]',
     * //   '[Time: February 7, 2024 at 9:23 AM UTC]'
     * // ]
     * ```
     * 
     * Thread reply header:
     * ```typescript
     * formatHeader({ 
     *   username: 'bob.wilson', 
     *   timestamp: 'Feb 7th at 10:45 AM',
     *   threadInfo: 'replied to a thread: …' 
     * })
     * // Returns: [
     * //   '[!slack]+ [Thread Reply from [[bob.wilson]]]',
     * //   '[Time: February 7, 2024 at 10:45 AM UTC]'
     * // ]
     * ```
     */
    protected formatHeader(message: SlackMessage): string[] {
        // Use formatDisplayName which should handle mapping to [[Link]] if available, or return raw name
        const displayName = this.usernameProcessor.formatDisplayName(message.username);
        const formattedTimestamp = this.getFormattedTimestamp(message); // Use helper from base

        // Construct the header lines with bracket notation
        const isThreadReply = message.isThreadReply || (message.threadInfo && message.threadInfo.includes('replied to a thread:'));
        const titleLine = isThreadReply 
            ? `[!slack]+ [Thread Reply from ${displayName}]`
            : `[!slack]+ [Message from ${displayName}]`;
        const timeLine = `[Time: ${formattedTimestamp}]`;

        return [titleLine, timeLine];
    }

    // Attachment processing handled by base class with consistent bracket formatting

    /**
     * Formats message reactions using bracket notation for consistency.
     * Wraps reaction data in brackets to match the overall bracket theme.
     * 
     * **Bracket Reaction Format:**
     * - Enclosed in brackets: `[Reactions: emoji counts]`
     * - Maintains visual consistency with header format
     * - Easy to parse programmatically
     * - Graceful error handling with bracketed error messages
     * 
     * @param {SlackMessage} message - Message containing reaction data
     * @returns {string | null} Bracketed reaction string or null if no reactions
     * 
     * @example
     * Standard reactions:
     * ```typescript
     * {
     *   reactions: [
     *     { name: 'thumbs_up', count: 2 },
     *     { name: 'fire', count: 1 }
     *   ]
     * }
     * // Output: "[Reactions: 👍 2 🔥 1]"
     * ```
     * 
     * Error case:
     * ```typescript
     * // If emoji processing fails:
     * "[Error formatting reactions]"
     * ```
     * 
     * No reactions:
     * ```typescript
     * // Returns: null (no output)
     * ```
     */
    protected formatReactions(message: SlackMessage): string | null {
        if (!message.reactions || message.reactions.length === 0) {
            return null;
        }
        try {
            const processedReactions = this.emojiProcessor.processReactions(message.reactions);
            return `[Reactions: ${processedReactions}]`;
        } catch (reactError) {
            this.log('error', `Error formatting reactions: ${reactError}`, { reactions: message.reactions });
            return '[Error formatting reactions]'; // Bracketed error message
        }
    }

    /**
     * Inherits the main formatting pipeline from BaseFormatStrategy.
     * The bracket strategy leverages the same text processing pipeline
     * but applies bracket-specific formatting to headers and metadata.
     * 
     * **Processing Flow:**
     * 1. Message iteration with error handling (inherited)
     * 2. Bracket-style header formatting (this class)
     * 3. Content processing through processor pipeline (inherited)
     * 4. Bracket-wrapped reactions formatting (this class)
     * 5. Thread info formatting with consistent styling (inherited)
     * 
     * **Bracket Format Benefits:**
     * - Consistent metadata encapsulation
     * - Enhanced parseability for automated tools
     * - Reduced visual complexity
     * - Better compatibility with plain text systems
     * 
     * @see {@link BaseFormatStrategy#formatToMarkdown} - Main formatting pipeline
     * @see {@link formatHeader} - Bracket-specific header formatting
     * @see {@link formatReactions} - Bracket-wrapped reaction formatting
     */
}