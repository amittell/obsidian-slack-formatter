/**
 * Settings-related type definitions for the Slack formatter plugin.
 * @module settings.types
 */

/**
 * Configuration settings for the Slack formatter plugin.
 * @interface SlackFormatSettings
 */
export interface SlackFormatSettings {
  // Core formatting options

  /** Enable detection and formatting of code blocks */
  detectCodeBlocks: boolean;

  /** Convert @mentions to [[wikilinks]] */
  convertUserMentions: boolean;

  /** Replace emoji codes with Unicode characters */
  replaceEmoji: boolean;

  /** Parse and format Slack timestamps */
  parseSlackTimes: boolean;

  /** Highlight thread references and links */
  highlightThreads: boolean;

  /** Convert Slack URL syntax to Markdown links */
  convertSlackLinks: boolean;

  // Maps (JSON strings)

  /** JSON string mapping user IDs to display names */
  userMapJson: string;

  /** JSON string mapping emoji codes to Unicode characters */
  emojiMapJson: string;

  // UI options

  /** Hotkey mode: 'dedicatedHotkey' for default shortcut, 'interceptCmdV' for paste intercept */
  hotkeyMode: 'dedicatedHotkey' | 'interceptCmdV';

  /** Maximum number of lines to process (for performance) */
  maxLines: number;

  /** Show preview pane before inserting formatted text */
  enablePreviewPane: boolean;

  /** Show confirmation dialog when Slack content is detected */
  enableConfirmationDialog: boolean;

  /** Show success message after formatting */
  showSuccessMessage: boolean;

  // Thread options

  /** Collapse long threads in the output */
  collapseThreads: boolean;

  /** Number of messages before collapsing a thread */
  threadCollapseThreshold: number;

  // Frontmatter options

  /** CSS class to add to frontmatter for styling */
  frontmatterCssClass: string;

  /** Title to add to frontmatter */
  frontmatterTitle: string;

  // Advanced options

  /** Timezone for parsing timestamps (e.g., 'America/New_York') */
  timeZone: string;

  /** Enable debug mode for troubleshooting */
  debug?: boolean;
}
