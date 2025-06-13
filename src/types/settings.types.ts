/**
 * Settings-related type definitions
 */

export interface SlackFormatSettings {
    // Core formatting options
    detectCodeBlocks: boolean;
    convertUserMentions: boolean;
    replaceEmoji: boolean;
    parseSlackTimes: boolean;
    highlightThreads: boolean;
    convertSlackLinks: boolean;
    
    // Maps (JSON strings)
    userMapJson: string;
    emojiMapJson: string;
    
    // UI options
    hotkeyMode: 'cmdShiftV' | 'interceptCmdV';
    maxLines: number;
    enablePreviewPane: boolean;
    enableConfirmationDialog: boolean;
    showSuccessMessage: boolean;
    
    // Thread options
    collapseThreads: boolean;
    threadCollapseThreshold: number;
    
    // Frontmatter options
    frontmatterCssClass: string;
    frontmatterTitle: string;
    
    // Advanced options
    timeZone: string;
    debug?: boolean;
}