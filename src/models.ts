/**
 * Core data models for Slack formatter
 */

import type { SlackReaction } from './types/messages.types'; // Removed SlackAttachment import

// Removed unused RawSlackContent interface

/**
 * Represents a parsed Slack message with its associated metadata.
 * Populated by the `SlackMessageParser`.
 */
export class SlackMessage {
  /**
   * Username of the message sender. Defaults to "Unknown user".
   * Populated by the parser when a username line is identified.
   */
  username: string = "Unknown user";

  /**
   * The timestamp string, ideally ISO format after parsing, or the original string on failure.
   * Populated by the parser from the message header or date context.
   */
  timestamp: string | null = null;

  /**
   * The main textual content of the message. Can be multi-line.
   * Populated by the parser with lines identified as message text, preserving original indentation.
   */
  text: string = "";

  /**
   * The Date object representing the *day* the message was sent, used for context.
   * Populated by the parser from date separators or inferred from timestamps.
   */
  date: Date | null = null; // Refined type

  /**
   * URL of the sender's avatar image, if available in the export format.
   * Populated by the parser if an avatar URL line is identified.
   */
  avatar: string | null = null;

  /**
   * Flag indicating specifically if this message is a reply within a thread.
   * Set by the parser if identified as a reply via `THREAD_REPLY_HEADER_REGEX`.
   */
   isThreadReply?: boolean;

  /**
   * Array of reactions associated with the message.
   * Populated by the parser when reaction lines are identified.
   */
  reactions: SlackReaction[] = [];

  /**
   * Flag indicating if this message line signifies the start of a thread (e.g., contains "X replies").
   * Set by the parser when identifying thread start indicators.
   */
  isThreadStart?: boolean;

  /**
   * Flag indicating if the message has been marked as edited in Slack (e.g., contains "(edited)").
   * Set by the parser when identifying the edited marker.
   */
  isEdited?: boolean;

  // NOTE: Properties related to attachments, specific thread IDs/levels,
  // code blocks, nesting, raw content, and continuations were previously
  // part of this model but are currently unused or handled differently
  // by the parser and formatting stages. (Removed for clarity).
} // End of SlackMessage class

/**
* Represents the final formatted output, including metadata.
*/
export interface FormattedOutput {
  /**
   * The formatted markdown text result.
   */
  text: string;
  /**
   * Optional metadata about the formatting process.
   */
  metadata?: {
    /**
     * Total number of `SlackMessage` objects processed.
     */
    messageCount: number;
    /**
     * Count of unique usernames found in the processed messages.
     */
    uniqueUsers: number;
    /**
     * The name of the `FormatStrategy` used (e.g., 'standard', 'bracket').
     */
    formatStrategy: string;
    /**
     * Time taken for the formatting process in milliseconds.
     */
    processingTime?: number;
  };
}