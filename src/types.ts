/**
 * Type definitions for Slack Formatter plugin
 */

/**
 * Format mode enum 
 */
export enum FormatMode {
  Slack = 'slack',
  Markdown = 'markdown',
  Auto = 'auto'
}

/**
 * Thread statistics for YAML frontmatter metadata
 */
export interface ThreadStats {
  messageCount: number;
  uniqueUsers: number;
  threadCount: number;
  dateRange: string;
  mostActiveUser?: string;
}

/**
 * Plugin settings interface
 */
export interface SlackFormatSettings {
  enableCodeBlocks: boolean;
  enableMentions: boolean;
  enableEmoji: boolean;
  enableTimestampParsing: boolean;
  enableSubThreadLinks: boolean;
  userMap?: Record<string, string>;
  emojiMap?: Record<string, string>;
  channelMap?: Record<string, string>;
  hotkeyMode: 'cmdShiftV' | 'interceptCmdV';
  maxLines: number;
  enablePreviewPane: boolean;
  enableConfirmationDialog: boolean;
  timeZone: string;
  collapseThreads: boolean;
  threadCollapseThreshold: number;
  showSuccessMessage: boolean;
}

/**
 * Extended settings for the formatter
 */
export interface SlackFormatterSettings extends SlackFormatSettings {
  formatMode?: FormatMode;
}

/**
 * Parsed message start interface
 */
export interface ParsedMessageStart {
  user: string; 
  time: string;
  remainder: string;
  date?: string; // Date information if available (e.g. "Feb 6th")
}

/**
 * Formatter state interface for tracking formatting process
 */
export interface FormatterState {
    detectedDates: Date[];
    participantSet: Set<string>;
    result: string[];
    threadInfo: string;
    currentMessageNumber: number;
    threadStats: ThreadStats;
    userMessageCounts: Record<string, number>;
    currentUser: string;
    currentTime: string;
    messageLines: string[];
    lastKnownUser: string;
    lastMessageTime: string;
    isMessageContinuation: boolean;
    inCodeBlock: boolean;
    inQuotedBlock: boolean;
    initialContent: string[];
    hasInitialContent: boolean;
    messageStarted: boolean;
    currentAvatar: string;
    lastDateLine: string;
    inReactionBlock: boolean;
    reactionLines: string[];
    unknownUserActive: boolean;
    lines: string[];
    isPreFormatted: boolean;
    currentDate: string;
    reactionText: string;
    reactions: string[];
    processedMessageKeys: Set<string>;
}