import { SlackFormatSettings } from './types';

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
  channelMapJson: '{}',
  hotkeyMode: 'cmdShiftV',
  maxLines: 5000,
  enablePreviewPane: true,
  enableConfirmationDialog: true,
  timeZone: '',
  collapseThreads: true,
  threadCollapseThreshold: 10,
  showSuccessMessage: true
};

/**
 * Load settings from storage
 */
export async function loadSettings(plugin: any): Promise<SlackFormatSettings> {
  return Object.assign({}, DEFAULT_SETTINGS, await plugin.loadData());
}

/**
 * Save settings to storage
 */
export async function saveSettings(plugin: any, settings: SlackFormatSettings): Promise<void> {
  await plugin.saveData(settings);
}