# Obsidian Slack Formatter - Technical Specification

## Overview
The Obsidian Slack Formatter is a plugin for [Obsidian](https://obsidian.md) that transforms raw Slack conversation text into formatted Markdown callouts. It handles user messages, timestamps, formatting, mentions, emojis, code blocks, threads, and other Slack-specific elements.

## Architecture

### Core Components
1. **SlackFormatPlugin** (main class)
   - Extends Obsidian's Plugin class
   - Manages settings, commands, and core functionality
   - Handles clipboard interactions and text processing

2. **ConfirmSlackModal**
   - Modal dialog for confirming Slack text conversion
   - Used when intercepting regular paste operations

3. **SlackPreviewModal**
   - Real-time preview window for Slack content before insertion
   - Supports both insertion and note creation workflows

4. **SlackFormatSettingTab**
   - Settings interface for configuring the plugin
   - Manages JSON maps, formatting options, and behavior settings

### Data Structures

#### Settings Interface
```typescript
interface SlackFormatSettings {
  enableCodeBlocks: boolean;
  enableMentions: boolean;
  enableEmoji: boolean;
  enableTimestampParsing: boolean;
  enableSubThreadLinks: boolean;
  userMapJson: string;
  emojiMapJson: string;
  channelMapJson: string;
  hotkeyMode: 'cmdShiftV' | 'interceptCmdV';
  maxLines: number;
  enablePreviewPane: boolean;
  enableConfirmationDialog: boolean;
  timeZone: string;
  collapseThreads: boolean;
  threadCollapseThreshold: number;
}
```

#### Thread Statistics
```typescript
interface ThreadStats {
  messageCount: number;
  uniqueUsers: number;
  threadCount: number;
  dateRange: string;
  mostActiveUser?: string;
}
```

### Plugin Initialization Flow
1. Load saved settings or use defaults
2. Parse JSON maps (users, emojis, channels)
3. Add settings tab to Obsidian
4. Register commands and event listeners based on settings:
   - Format-and-paste command (Cmd+Shift+V)
   - Editor paste event intercept (if enabled)
   - Create note from Slack command

## Text Processing Algorithm

### Main Processing Flow
1. Reset state variables and prepare for processing
2. Detect if input is likely Slack content
3. Split input into lines and process each line sequentially
4. Detect different line types:
   - Message starts (user + timestamp)
   - Date markers
   - Code blocks
   - Thread indicators
   - System messages
   - Message continuation lines
5. Format messages into Markdown callout format
6. Collect thread statistics
7. Return formatted result

### Key Detection Methods
1. **Message Start Detection**
   ```typescript
   private handleMessageStart(line: string): { user: string; time: string; remainder: string } | null
   ```
   - Uses regex patterns to identify user and timestamp pairs
   - Handles duplicated usernames common in Slack exports
   - Returns structured data if a message start is detected

2. **Metadata Line Detection**
   ```typescript
   private handleSlackMetadataLine(line: string): false | string | undefined
   ```
   - Identifies and handles special lines like thread indicators
   - Filters out redundant metadata lines
   - Returns thread info if relevant

3. **Date & Time Parsing**
   ```typescript
   private isDateLine(line: string): boolean
   private parseDateLine(line: string): Date | null
   private parseAndFormatTime(timeStr: string): string
   ```
   - Identifies and parses date markers in Slack conversations
   - Converts times to full timestamps using detected dates
   - Handles timezone conversions

### Text Formatting
1. **Line Formatting**
   ```typescript
   private formatLine(line: string): string
   ```
   - Main formatting function for message content
   - Handles links, mentions, emojis, code, and other elements
   - Sanitizes Markdown to avoid formatting conflicts

2. **Message Assembly**
   ```typescript
   private flushMessage()
   ```
   - Collects processed lines into a complete message
   - Formats into Obsidian callout style
   - Adds metadata like user info and timestamp
   - Adds thread information if available

3. **Markdown Sanitization**
   ```typescript
   private sanitizeMarkdown(text: string): string
   ```
   - Prevents conflicts with existing Markdown syntax
   - Handles escaping of special characters
   - Normalizes formatting

## Command Integration

### Command Registration
The plugin registers two main commands:
1. `format-slack-paste`: Format clipboard content (hotkey: Cmd+Shift+V)
2. `format-slack-create-note`: Create a new note with YAML frontmatter

### Paste Handling
Two modes are supported:
1. **Dedicated hotkey** (Cmd+Shift+V)
   - Reads clipboard content
   - Formats as Slack conversation
   - Inserts at cursor position

2. **Intercept mode**
   - Hooks into Obsidian's editor-paste event
   - Detects if pasted content appears to be Slack text
   - Optionally shows confirmation dialog
   - Returns `false` to cancel default paste behavior

## Special Features

### Link & Mention Handling
- Converts `<https://url|text>` to `[text](url)`
- Detects image URLs and formats as `![alt](url)`
- Transforms user mentions:
  - `<@U123ABC>` → `[[User Name]]` (via user map)
  - `@username` → `[[username]]`
- Formats channel mentions:
  - `#C01234` → `[[#channel-name]]` (via channel map)

### Code Block Detection
When `enableCodeBlocks` is true:
- Detects lines starting with triple backticks
- Properly handles language specifiers
- Preserves content formatting between fences

### Thread Detection
- Identifies thread indicators like "3 replies"
- Optionally collapses threads with replies exceeding threshold
- Extracts thread statistics

### YAML Frontmatter Generation
When creating notes with `format-slack-create-note`:
- Adds participants list
- Includes date range
- Provides message statistics
- Records thread count and other metadata

## Performance Considerations

1. **Line Limiting**
   - Truncates extremely large pastes at configurable threshold
   - Prevents browser/Obsidian hangs with massive Slack exports

2. **Duplicate Detection**
   - Prevents duplicate messages from being added to output
   - Handles unusual formatting in Slack exports

3. **Error Handling**
   - Graceful fallbacks for unexpected input formats
   - JSON parsing error handling for configuration maps

## Testing & Edge Cases

### Known Edge Cases
1. **Message Format Detection**
   - Falls back to simpler parsing if standard format isn't detected
   - Special handling for emoji in usernames

2. **Timestamp Formatting**
   - Handles 12/24-hour time formats
   - Accounts for time zones
   - Defaults to local timezone if not specified

3. **System Messages**
   - Filters out common system messages like "joined #channel"
   - Handles "replied to thread" messages

## Future Development Areas

1. **Parsing Improvements**
   - Enhanced handling of complex nested threads
   - Better support for Slack export formats
   - More robust handling of variations in Slack UI copy/paste formats

2. **Feature Extensions**
   - Support for Slack reactions
   - Enhanced metadata extraction
   - Optional message grouping by date/user

3. **Performance Optimization**
   - More efficient line processing for extremely large pastes
   - Incremental processing for real-time feedback

## Version History

The plugin is currently at version 0.0.7 as specified in the manifest.json and main.ts file.