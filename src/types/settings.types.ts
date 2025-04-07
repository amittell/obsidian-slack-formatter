/**
 * Settings-related type definitions
 */

export interface SlackFormatSettings {
    enableCodeBlocks: boolean;
    enableMentions: boolean;
    enableEmoji: boolean;
    enableTimestampParsing: boolean;
    enableSubThreadLinks: boolean;
    userMapJson: string;
    emojiMapJson: string;
    // channelMapJson: string; // Removed - Unused feature
    hotkeyMode: 'cmdShiftV' | 'interceptCmdV';
    maxLines: number;
    enablePreviewPane: boolean;
    enableConfirmationDialog: boolean;
    timeZone: string;
    collapseThreads: boolean;
    threadCollapseThreshold: number;
    showSuccessMessage: boolean;
    frontmatterCssClass: string; // Added: CSS class for frontmatter
    frontmatterTitle: string; // Added: Title for frontmatter section
    // userMap?: Record<string, string>; // Removed: Parsed maps handled separately
    // emojiMap?: Record<string, string>; // Removed: Parsed maps handled separately
    // channelMap?: Record<string, string>; // Removed - Unused feature
    debug?: boolean; // Add optional debug property
}