import { SlackFormatSettings } from './types/settings.types'; // Corrected import path

/**
 * Default settings for the Slack Formatter plugin
 */
export const DEFAULT_SETTINGS: SlackFormatSettings = {
  detectCodeBlocks: true,
  convertUserMentions: true,
  replaceEmoji: true,
  parseSlackTimes: true,
  highlightThreads: true,
  convertSlackLinks: true,
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
  showSuccessMessage: true,
  collapseThreads: true,
  threadCollapseThreshold: 10,
  frontmatterCssClass: 'slack-conversation',
  frontmatterTitle: '# Slack Conversation',
  timeZone: '',
  debug: true
};
