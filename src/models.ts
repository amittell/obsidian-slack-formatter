/**
 * Core data models for Slack formatter.
 * 
 * This module defines the primary data structures used throughout the
 * Slack formatting pipeline, including message representations and
 * formatted output containers. These models serve as the foundation
 * for data flow between parsing, processing, and formatting stages.
 * 
 * @module models
 * @since 1.0.0
 * @author Obsidian Slack Formatter Team
 */

import type { SlackReaction } from './types/messages.types';


/**
 * Represents a parsed Slack message with its associated metadata.
 * 
 * This class encapsulates all the information extracted from a single
 * Slack message during the parsing process. It serves as the primary
 * data container for message information as it flows through the
 * formatting pipeline.
 * 
 * The parser populates instances of this class by analyzing raw Slack
 * export text and extracting structured data including usernames,
 * timestamps, content, reactions, and metadata flags.
 * 
 * @class SlackMessage
 * @since 1.0.0
 * @see {@link ISlackFormatter} - Main formatter interface
 * @see {@link SlackReaction} - Reaction data structure
 * @see {@link FormattedOutput} - Final output format
 * 
 * @example
 * ```typescript
 * const message = new SlackMessage();
 * message.username = 'John Doe';
 * message.timestamp = '2:30 PM';
 * message.text = 'Hello everyone!';
 * message.date = new Date('2024-01-15');
 * message.reactions = [{ name: 'thumbsup', count: 3 }];
 * message.isEdited = false;
 * ```
 */
export class SlackMessage {
  /**
   * Username of the message sender.
   * 
   * The display name of the user who sent the message. Defaults to
   * "Unknown User" when the parser cannot identify a username from
   * the export format. This field is populated during the parsing
   * stage when username patterns are detected.
   * 
   * @type {string}
   * @default 'Unknown User'
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.username = 'John Doe';
   * message.username = 'jane.smith@company.com';
   * ```
   */
  username: string = 'Unknown User';

  /**
   * The timestamp string for when the message was sent.
   * 
   * Ideally contains an ISO format timestamp after parsing, but falls
   * back to the original timestamp string if parsing fails. This field
   * is populated by the parser from message headers or date context
   * information in the Slack export.
   * 
   * @type {string | null}
   * @default null
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.timestamp = '2024-01-15T14:30:00.000Z'; // ISO format
   * message.timestamp = '2:30 PM'; // Original format fallback
   * message.timestamp = null; // No timestamp available
   * ```
   */
  timestamp: string | null = null;

  /**
   * The main textual content of the message.
   * 
   * Contains the actual message text content, which can span multiple
   * lines. The parser preserves original indentation and formatting
   * when extracting message content from the Slack export format.
   * 
   * @type {string}
   * @default ''
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.text = 'Hello everyone!';
   * message.text = `This is a multi-line message
   * with preserved formatting
   *     and indentation.`;
   * ```
   */
  text: string = "";

  /**
   * The Date object representing the day the message was sent.
   * 
   * Used for contextual grouping and date-based formatting. This field
   * is populated by the parser from date separators in the export or
   * inferred from timestamp information. Represents the calendar day
   * rather than the specific time.
   * 
   * @type {Date | null}
   * @default null
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.date = new Date('2024-01-15'); // Specific date
   * message.date = new Date(); // Today's date
   * message.date = null; // Date unavailable
   * ```
   */
  date: Date | null = null; // Refined type

  /**
   * URL of the sender's avatar image.
   * 
   * Contains the URL to the sender's profile picture if available in
   * the Slack export format. This field is optional and only populated
   * when avatar URL patterns are detected during parsing.
   * 
   * @type {string | null}
   * @default null
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.avatar = 'https://avatars.slack-edge.com/user123.jpg';
   * message.avatar = null; // No avatar available
   * ```
   */
  avatar: string | null = null;

  /**
   * Flag indicating if this message is a reply within a thread.
   * 
   * Set to true when the parser identifies this message as a thread
   * reply using thread reply header patterns. This flag helps distinguish
   * between main channel messages and threaded responses.
   * 
   * @type {boolean | undefined}
   * @optional
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.isThreadReply = true; // This is a thread reply
   * message.isThreadReply = false; // Main channel message
   * // undefined for messages where thread status is unknown
   * ```
   */
   isThreadReply?: boolean;

  /**
   * Array of reactions associated with the message.
   * 
   * Contains all emoji reactions that users have added to this message.
   * Each reaction includes the emoji name and count of users who reacted.
   * This array is populated during parsing when reaction patterns are
   * detected in the export format.
   * 
   * @type {SlackReaction[]}
   * @default []
   * @since 1.0.0
   * @see {@link SlackReaction} - Reaction data structure
   * 
   * @example
   * ```typescript
   * message.reactions = [
   *   { name: 'thumbsup', count: 3 },
   *   { name: 'heart', count: 1 },
   *   { name: 'laughing', count: 2 }
   * ];
   * ```
   */
  reactions: SlackReaction[] = [];

  /**
   * Flag indicating if this message starts a thread.
   * 
   * Set to true when the message contains thread start indicators such as
   * "X replies" or "View thread". This helps identify messages that have
   * spawned discussion threads and may need special formatting treatment.
   * 
   * @type {boolean | undefined}
   * @optional
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.isThreadStart = true; // Message has replies
   * message.threadInfo = '5 replies'; // Additional thread context
   * ```
   */
  isThreadStart?: boolean;

  /**
   * Flag indicating if the message has been edited.
   * 
   * Set to true when the parser detects editing markers such as "(edited)"
   * in the message content. This flag preserves the edit history information
   * from the original Slack conversation.
   * 
   * @type {boolean | undefined}
   * @optional
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.isEdited = true; // Message was edited
   * message.text = 'Original message content (edited)';
   * ```
   */
  isEdited?: boolean;

  /**
   * Thread information string.
   * 
   * Contains descriptive text about thread activity such as "5 replies",
   * "View thread", or other thread-related metadata. This field provides
   * additional context about threaded conversations and is used for
   * generating appropriate formatting output.
   * 
   * @type {string | undefined}
   * @optional
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * message.threadInfo = '5 replies';
   * message.threadInfo = 'View thread';
   * message.threadInfo = '1 reply Last reply today at 3:45 PM';
   * ```
   */
  threadInfo?: string;

} // End of SlackMessage class

/**
 * Represents the final formatted output, including metadata.
 * 
 * This interface defines the structure of the complete formatting result,
 * containing both the formatted markdown text and optional metadata about
 * the formatting process. It serves as the final output contract for
 * the formatting pipeline.
 * 
 * @interface FormattedOutput
 * @since 1.0.0
 * @see {@link SlackMessage} - Input message structure
 * @see {@link ThreadStats} - Statistics interface
 * @see {@link ISlackFormatter} - Main formatter interface
 * 
 * @example
 * ```typescript
 * const output: FormattedOutput = {
 *   text: '> **John Doe** - 2:30 PM\n> Hello everyone!',
 *   metadata: {
 *     messageCount: 5,
 *     uniqueUsers: 3,
 *     formatStrategy: 'standard',
 *     processingTime: 45
 *   }
 * };
 * ```
 */
export interface FormattedOutput {
  /**
   * The formatted markdown text result.
   * 
   * Contains the final Obsidian-compatible markdown output after processing
   * the input Slack conversation through the complete formatting pipeline.
   * This text is ready for insertion into an Obsidian note.
   * 
   * @type {string}
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * output.text = `> **John Doe** - 2:30 PM
   * > Hello everyone! How are you doing?
   * 
   * > **Jane Smith** - 2:31 PM
   * > Hi John! I'm doing well, thanks!`;
   * ```
   */
  text: string;
  /**
   * Optional metadata about the formatting process.
   * 
   * Contains statistical and diagnostic information about the formatting
   * operation, including performance metrics, message counts, and strategy
   * information. This metadata can be used for analytics, debugging, or
   * frontmatter generation.
   * 
   * @type {object | undefined}
   * @optional
   * @since 1.0.0
   * 
   * @example
   * ```typescript
   * output.metadata = {
   *   messageCount: 15,
   *   uniqueUsers: 4,
   *   formatStrategy: 'bracket',
   *   processingTime: 67
   * };
   * ```
   */
  metadata?: {
    /**
     * Total number of SlackMessage objects processed.
     * 
     * The count of individual message objects that were parsed and
     * formatted during the processing operation. This includes all
     * messages regardless of sender or thread status.
     * 
     * @type {number}
     * @since 1.0.0
     * 
     * @example
     * ```typescript
     * metadata.messageCount = 25; // 25 messages processed
     * ```
     */
    messageCount: number;
    /**
     * Count of unique usernames found in the processed messages.
     * 
     * The number of distinct users who participated in the conversation.
     * This count helps identify the scope and diversity of participation
     * in the Slack conversation.
     * 
     * @type {number}
     * @since 1.0.0
     * 
     * @example
     * ```typescript
     * metadata.uniqueUsers = 6; // 6 different people participated
     * ```
     */
    uniqueUsers: number;
    /**
     * The name of the FormatStrategy used for processing.
     * 
     * Identifies which formatting strategy was selected and applied
     * to process the conversation. This information helps track
     * format detection accuracy and strategy usage patterns.
     * 
     * @type {string}
     * @since 1.0.0
     * @see {@link FormatStrategyType} - Available strategy types
     * 
     * @example
     * ```typescript
     * metadata.formatStrategy = 'standard'; // Standard format used
     * metadata.formatStrategy = 'bracket'; // Bracket format detected
     * metadata.formatStrategy = 'dm'; // Direct message format
     * ```
     */
    formatStrategy: string;
    /**
     * Time taken for the formatting process in milliseconds.
     * 
     * Performance metric indicating how long the complete formatting
     * pipeline took to process the input. Useful for performance
     * monitoring and optimization analysis.
     * 
     * @type {number | undefined}
     * @optional
     * @since 1.0.0
     * 
     * @example
     * ```typescript
     * metadata.processingTime = 123; // 123ms processing time
     * metadata.processingTime = undefined; // Not measured
     * ```
     */
    processingTime?: number;
  };
}