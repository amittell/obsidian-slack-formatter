import { SlackFormatSettings } from './types/settings.types'; // Corrected import path

/**
 * Default settings for the Slack Formatter plugin.
 *
 * This configuration object provides sensible defaults for all plugin
 * settings, ensuring the formatter works out-of-the-box while allowing
 * users to customize behavior through the settings UI. The defaults
 * balance functionality with performance and usability.
 *
 * These settings control all aspects of the formatting pipeline including
 * content processing, UI behavior, performance limits, and output formatting.
 * They serve as the base configuration that users can override through
 * the Obsidian settings interface.
 *
 * @constant {SlackFormatSettings} DEFAULT_SETTINGS
 * @since 1.0.0
 * @see {@link SlackFormatSettings} - Settings interface definition
 * @see {@link ISlackFormatter} - Main formatter interface
 *
 * @example
 * ```typescript
 * // Use defaults directly
 * const formatter = new SlackFormatter(DEFAULT_SETTINGS, parsedMaps);
 *
 * // Override specific settings
 * const customSettings = {
 *   ...DEFAULT_SETTINGS,
 *   replaceEmoji: false,
 *   maxLines: 10000
 * };
 * ```
 */
export const DEFAULT_SETTINGS: SlackFormatSettings = {
  /**
   * Enable detection and formatting of code blocks.
   *
   * When enabled, the formatter will identify code blocks in Slack messages
   * and format them using appropriate markdown syntax. This includes both
   * inline code (backticks) and multi-line code blocks (triple backticks).
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   */
  detectCodeBlocks: true,
  /**
   * Convert @mentions to [[wikilinks]].
   *
   * When enabled, user mentions in Slack messages (@username) are converted
   * to Obsidian wikilink format ([[username]]) for better integration with
   * Obsidian's linking system. Requires user mapping configuration.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   * @see {@link ParsedMaps.userMap} - User ID to name mapping
   */
  convertUserMentions: true,
  /**
   * Replace emoji codes with Unicode characters.
   *
   * When enabled, custom Slack emoji codes (:emoji_name:) are replaced
   * with their corresponding Unicode characters using the emoji mapping.
   * Standard Unicode emoji are preserved regardless of this setting.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   * @see {@link ParsedMaps.emojiMap} - Emoji code to Unicode mapping
   * @see {@link DEFAULT_SETTINGS.emojiMapJson} - Default emoji mappings
   */
  replaceEmoji: true,
  /**
   * Parse and format Slack timestamps.
   *
   * When enabled, the formatter attempts to parse and standardize
   * timestamp formats from Slack exports. This includes converting
   * various time formats to consistent, readable formats.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   * @see {@link DEFAULT_SETTINGS.timeZone} - Timezone configuration
   */
  parseSlackTimes: true,
  /**
   * Highlight thread references and links.
   *
   * When enabled, thread-related content such as "View thread" links
   * and reply indicators are given special formatting treatment to
   * make threaded conversations more visually distinct.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   * @see {@link DEFAULT_SETTINGS.collapseThreads} - Thread collapsing option
   */
  highlightThreads: true,
  /**
   * Convert Slack URL syntax to Markdown links.
   *
   * When enabled, Slack's link format <url|text> is converted to
   * standard Markdown link format [text](url) for better compatibility
   * with Obsidian and other Markdown processors.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   */
  convertSlackLinks: true,
  /**
   * JSON string mapping user IDs to display names.
   *
   * Contains a JSON object mapping Slack user IDs (U1234567) to
   * human-readable display names. Used for converting user mentions
   * and improving readability of formatted output.
   *
   * @type {string}
   * @default '{}'
   * @since 1.0.0
   * @validation Must be valid JSON string
   * @constraint Keys should be Slack user ID format (U followed by alphanumeric)
   * @constraint Values should be non-empty display names
   *
   * @example
   * ```json
   * {
   *   "U1234567": "John Doe",
   *   "U7654321": "Jane Smith",
   *   "UABCDEFG": "alex.johnson@company.com"
   * }
   * ```
   */
  userMapJson: '{}',
  /**
   * JSON string mapping emoji codes to Unicode characters.
   *
   * Contains a JSON object mapping custom Slack emoji names to their
   * corresponding Unicode characters. Used for replacing custom emoji
   * codes with displayable Unicode when formatting messages.
   *
   * @type {string}
   * @default JSON string with common emoji mappings
   * @since 1.0.0
   * @validation Must be valid JSON string
   * @constraint Keys should be emoji names without colons
   * @constraint Values should be valid Unicode emoji characters
   *
   * @example
   * ```json
   * {
   *   "thumbsup": "👍",
   *   "heart": "❤️",
   *   "laughing": "😂",
   *   "custom-emoji": "🎉"
   * }
   * ```
   */
  emojiMapJson: JSON.stringify(
    {
      'bufo-ty': '🙏',
      'bufo-thinking': '🤔',
      'bufo-lol-cry': '😭',
      'pika-aww': '😍',
      'so-beautiful': '🤩',
      nice5: '👍',
      'bufo-cowboy': '🤠',
      bufoyes: '👍',
      pray: '🙏',
      no_entry: '⛔',
    },
    null,
    2
  ),
  /**
   * Hotkey mode for triggering the formatter.
   *
   * Determines how the formatter is activated:
   * - 'dedicatedHotkey': Enables the plugin's command for use with a
   *   user-assigned hotkey (no default binding)
   * - 'interceptCmdV': Intercepts normal paste operations (Cmd/Ctrl+V)
   *
   * @type {'dedicatedHotkey' | 'interceptCmdV'}
   * @default 'dedicatedHotkey'
   * @since 1.0.0
   * @constraint Must be one of the defined hotkey modes
   */
  hotkeyMode: 'dedicatedHotkey',
  /**
   * Maximum number of lines to process.
   *
   * Performance safeguard that limits the number of input lines processed
   * to prevent performance issues with extremely large Slack exports.
   * Content exceeding this limit will be truncated with a warning.
   *
   * @type {number}
   * @default 5000
   * @since 1.0.0
   * @constraint Must be positive integer
   * @constraint Recommended range: 1000-50000
   * @performance Higher values may impact processing speed
   */
  maxLines: 5000,
  /**
   * Show preview pane before inserting formatted text.
   *
   * When enabled, displays a preview modal showing the formatted output
   * before inserting it into the current note. Allows users to review
   * and confirm the formatting before committing changes.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   * @ux Improves user experience by preventing unwanted insertions
   */
  enablePreviewPane: true,
  /**
   * Show confirmation dialog when Slack content is detected.
   *
   * When enabled, displays a confirmation dialog when the formatter
   * detects Slack content in clipboard data, asking the user whether
   * to proceed with formatting. Prevents accidental formatting.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   * @ux Prevents accidental activation on non-Slack content
   */
  enableConfirmationDialog: true,
  /**
   * Show success message after formatting.
   *
   * When enabled, displays a brief success notification after
   * successfully formatting and inserting Slack content. Provides
   * user feedback about the completion of the formatting operation.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   * @ux Provides confirmation of successful operations
   */
  showSuccessMessage: true,
  /**
   * Collapse long threads in the output.
   *
   * When enabled, threads exceeding the collapse threshold are
   * automatically collapsed using Obsidian's collapsible syntax
   * to improve readability of long conversations.
   *
   * @type {boolean}
   * @default true
   * @since 1.0.0
   * @see {@link DEFAULT_SETTINGS.threadCollapseThreshold} - Collapse threshold
   * @formatting Improves readability of long threaded conversations
   */
  collapseThreads: true,
  /**
   * Number of messages before collapsing a thread.
   *
   * Threads containing more than this many messages will be collapsed
   * when the collapseThreads option is enabled. Lower values create
   * more compact output, higher values preserve more detail.
   *
   * @type {number}
   * @default 10
   * @since 1.0.0
   * @constraint Must be positive integer
   * @constraint Recommended range: 3-50
   * @see {@link DEFAULT_SETTINGS.collapseThreads} - Thread collapse toggle
   */
  threadCollapseThreshold: 10,
  /**
   * CSS class to add to frontmatter for styling.
   *
   * CSS class name added to the YAML frontmatter's cssclass field.
   * This allows custom styling of Slack conversation notes through
   * Obsidian CSS snippets or themes.
   *
   * @type {string}
   * @default 'slack-conversation'
   * @since 1.0.0
   * @constraint Must be valid CSS class name
   * @constraint Should not contain spaces (use hyphens or underscores)
   *
   * @example
   * ```yaml
   * ---
   * cssclass: slack-conversation
   * ---
   * ```
   */
  frontmatterCssClass: 'slack-conversation',
  /**
   * Title to add to frontmatter and note content.
   *
   * The title text added to both the YAML frontmatter title field
   * and as a heading at the beginning of the formatted content.
   * Provides consistent naming for Slack conversation notes.
   *
   * @type {string}
   * @default '# Slack Conversation'
   * @since 1.0.0
   * @constraint Should include markdown heading syntax if desired
   *
   * @example
   * ```yaml
   * ---
   * title: "Slack Conversation"
   * ---
   *
   * # Slack Conversation
   * ```
   */
  frontmatterTitle: '# Slack Conversation',
  /**
   * Timezone for parsing timestamps.
   *
   * IANA timezone identifier used for interpreting and formatting
   * timestamps from Slack exports. Empty string uses system timezone.
   * This ensures consistent timestamp interpretation across different
   * environments and user locations.
   *
   * @type {string}
   * @default ''
   * @since 1.0.0
   * @constraint Must be valid IANA timezone identifier or empty string
   * @constraint Empty string defaults to system timezone
   *
   * @example
   * ```typescript
   * timeZone: 'America/New_York'
   * timeZone: 'Europe/London'
   * timeZone: 'Asia/Tokyo'
   * timeZone: '' // Use system timezone
   * ```
   */
  timeZone: '',
  /**
   * Enable debug mode for troubleshooting.
   *
   * When enabled, the formatter outputs detailed diagnostic information
   * to the console including parsing decisions, strategy selection,
   * and processing steps. Useful for troubleshooting formatting issues
   * but should be disabled in production for performance.
   *
   * @type {boolean | undefined}
   * @default false
   * @since 1.0.0
   * @optional Can be undefined (treated as false)
   * @performance Enabling debug mode may impact processing speed
   * @security Debug output may contain sensitive conversation content
   */
  debug: false,
};
