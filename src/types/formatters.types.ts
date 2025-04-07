/**
 * Format strategy types and interfaces
 */

/**
 * Available format strategy types
 */
export type FormatStrategyType = 'standard' | 'bracket';

/**
 * Result from processing stages
 */
export interface ProcessorResult<T = string> {
    content: T;
    modified: boolean;
}

/**
 * Thread statistics for YAML frontmatter metadata
 */
export interface ThreadStats {
  /** Number of messages in the thread */
  messageCount: number;

  /** Number of unique users in the thread */
  uniqueUsers: number;

  /** Number of thread replies */
  threadReplies?: number;

  /** Format strategy used to process the content */
  formatStrategy?: string;

  /** Processing time in milliseconds */
  processingTime?: number;

  /** Most active user in the thread */
  mostActiveUser?: string;
}

/**
 * Type definition for the parsed JSON maps (users, emojis, channels).
 */
export type ParsedMaps = {
  userMap: Record<string, string>;
  emojiMap: Record<string, string>;
  // channelMap: Record<string, string>; // Removed - Unused feature
};