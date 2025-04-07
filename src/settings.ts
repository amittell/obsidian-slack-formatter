import { SlackFormatSettings } from './types/settings.types'; // Corrected import path

/**
 * Default settings for the Slack Formatter plugin
 */
export const DEFAULT_SETTINGS: SlackFormatSettings = {
  enableCodeBlocks: true,
  enableMentions: true,
  enableEmoji: true,
  enableTimestampParsing: true,
  enableSubThreadLinks: true,
  userMapJson: '{}',
  emojiMapJson: JSON.stringify({
    "bufo-ty": "🙏",
    "bufo-thinking": "🤔",
    "bufo-lol-cry": "😭",
    "pika-aww": "😍",
    "so-beautiful": "🤩",
    "nice5": "👍",
    "bufo-cowboy": "🤠",
    "bufoyes": "👍",
    "pray": "🙏",
    "no_entry": "⛔"
  }, null, 2),
  hotkeyMode: 'cmdShiftV',
  maxLines: 5000,
  enablePreviewPane: true,
  enableConfirmationDialog: true,
  timeZone: '',
  collapseThreads: true,
  threadCollapseThreshold: 10,
  showSuccessMessage: true,
  frontmatterCssClass: 'slack-conversation', // Default CSS class
  frontmatterTitle: '# Slack Conversation', // Default title
  debug: true // Add debug flag, default to false -> RE-ENABLED FOR DEBUGGING
};
