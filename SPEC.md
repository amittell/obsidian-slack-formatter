# Obsidian Slack Formatter - Technical Specification
Last Updated: March 27, 2025

## Overview
The Obsidian Slack Formatter is a plugin for [Obsidian](https://obsidian.md) that transforms raw Slack conversation text into formatted Markdown callouts. It handles user messages, timestamps, formatting, mentions, emojis, code blocks, threads, and other Slack-specific elements.

## Architecture

### Core Components
1.  **SlackFormatPlugin** (`src/main.ts`)
    -   Extends Obsidian's `Plugin` class.
    -   Manages settings loading/saving (`loadSettings`, `saveSettings`).
    -   Registers commands (hotkey, palette, context menu) and the settings tab.
    -   Orchestrates the formatting process via `SlackFormatter`.
    -   Handles user interactions (clipboard reading, confirmation/preview modals).

2.  **SlackFormatter** (`src/formatter/slack-formatter.ts`)
    -   Implements `ISlackFormatter`.
    -   Serves as the main facade for the formatting system.
    -   Coordinates the processing pipeline: `PreProcessor` -> `FormatDetector` -> `SlackMessageParser` -> `FormatStrategy` -> `PostProcessor`.
    -   Uses `FormatStrategyFactory` to get the appropriate formatting strategy.
    -   Manages settings, parsed maps (`ParsedMaps`), and caches last results (`lastFormattedContent`, `lastThreadStats`).
    -   Provides methods like `formatSlackContent`, `isLikelySlack`, `getThreadStats`, `buildNoteWithFrontmatter`, `updateSettings`.

3.  **SlackMessageParser** (`src/formatter/stages/message-parser.ts`)
    -   Parses preprocessed text line-by-line into an array of `SlackMessage` objects.
    -   Identifies message boundaries, usernames, timestamps, reactions, thread indicators, etc.
    -   Maintains date context during parsing.

4.  **FormatDetector** (`src/formatter/stages/format-detector.ts`)
    -   Detects the likely format of the Slack paste (e.g., 'standard', 'bracket') based on patterns.
    -   Provides `isLikelySlack` for quick checks.

5.  **PreProcessor** (`src/formatter/stages/preprocessor.ts`)
    -   Performs initial cleanup and normalization of the raw input text.
    -   Limits the number of lines processed based on settings (`maxLines`).

6.  **PostProcessor** (`src/formatter/stages/postprocessor.ts`)
    -   Performs final cleanup on the formatted Markdown output (e.g., trimming whitespace).

7.  **FormatStrategy Interface** (`src/interfaces.ts`)
    -   Defines the contract for formatting strategies (`formatToMarkdown`).

8.  **BaseFormatStrategy** (`src/formatter/strategies/base-format-strategy.ts`)
    -   Abstract base class implementing common formatting logic.
    -   Instantiates and manages the sequence of `Processor` calls within `formatToMarkdown`.
    -   Provides abstract methods (`formatHeader`, `formatReactions`) for strategy-specific parts.

9.  **Concrete Format Strategies** (`src/formatter/strategies/*.ts`)
    -   **StandardFormatStrategy**: Handles "Username [timestamp]" format.
    -   **BracketFormatStrategy**: Handles "[timestamp] Username" format.
    -   Extend `BaseFormatStrategy` and implement abstract methods.

10. **FormatStrategyFactory** (`src/formatter/strategies/format-strategy-factory.ts`)
    -   Singleton factory for creating and retrieving `FormatStrategy` instances.
    -   Registers strategy constructors (`registerStrategy`).
    -   Instantiates strategies on demand (`getStrategyByType`), injecting dependencies (`settings`, `parsedMaps`).
    -   Updates dependencies when settings change (`updateDependencies`).

11. **Processor Interfaces & Base Class** (`src/formatter/processors/base-processor.ts`)
    - Defines the `Processor` interface (`process`).
    - Provides `BaseProcessor` for common functionality (optional).

12. **Specialized Processors** (`src/formatter/processors/*.ts`)
    -   Perform specific transformations on `SlackMessage` objects during the formatting stage within a strategy.
    -   **CodeBlockProcessor**: Formats code blocks.
    -   **EmojiProcessor**: Handles emoji codes and reaction formatting.
    -   **ThreadLinkProcessor**: Formats thread reply links.
    -   **UrlProcessor**: Formats URLs.
    -   **UsernameProcessor**: Formats usernames and mentions using `userMap`.
    -   *(Note: `AttachmentProcessor` and `DateTimeProcessor` were removed).*

13. **UI Components** (`src/ui/*.ts`)
    -   **ConfirmSlackModal**: Modal dialog for confirming Slack text conversion.
    -   **SlackPreviewModal**: Real-time preview window for Slack content before insertion.
    -   **SlackFormatSettingTab**: Settings interface for configuring the plugin.

14. **Utilities** (`src/utils/*.ts`)
    -   Provide helper functions for various tasks (datetime parsing, JSON parsing, logging, text manipulation, etc.).

### Data Structures

#### SlackMessage Class (`src/models.ts`)
```typescript
export class SlackMessage {
  username: string = "Unknown user";
  timestamp: string | null = null; // ISO string if parsed, original otherwise
  text: string = ""; // Multi-line message content
  date: Date | null = null; // Date object for the day (context)
  avatar: string | null = null; // URL of avatar image
  isThreadReply?: boolean; // True if message is a reply in a thread
  reactions: SlackReaction[] = []; // Array of reactions { name: string, count: number }
  isThreadStart?: boolean; // True if message indicates start of a thread
  isEdited?: boolean; // True if message has "(edited)" marker

  // NOTE: Properties related to attachments, specific thread IDs/levels,
  // code blocks, nesting, raw content, and continuations were previously
  // part of this model but are currently unused or handled differently.
}
```

#### Settings Interface (`src/types/settings.types.ts`)
```typescript
export interface SlackFormatSettings {
  enableCodeBlocks: boolean;
  enableMentions: boolean;
  enableEmoji: boolean;
  enableTimestampParsing: boolean;
  enableSubThreadLinks: boolean;
  userMapJson: string; // JSON string
  emojiMapJson: string; // JSON string
  hotkeyMode: 'cmdShiftV' | 'interceptCmdV';
  maxLines: number;
  enablePreviewPane: boolean;
  enableConfirmationDialog: boolean;
  timeZone: string;
  collapseThreads: boolean;
  threadCollapseThreshold: number;
  showSuccessMessage: boolean;
  frontmatterCssClass: string;
  frontmatterTitle: string;
  debug: boolean;
}
```

#### Parsed Maps (`src/types/formatters.types.ts`)
```typescript
export interface ParsedMaps {
  userMap: Record<string, string>;
  emojiMap: Record<string, string>;
}
```

#### Thread Statistics (`src/types/formatters.types.ts`)
```typescript
export interface ThreadStats {
  messageCount: number;
  uniqueUsers: number;
  threadReplies?: number;
  formatStrategy: string; // Type identifier ('standard', 'bracket', 'unknown', 'error')
  processingTime?: number;
  mostActiveUser?: string;
}
```

### Plugin Initialization Flow (`SlackFormatPlugin.onload`)
1.  Load saved settings (`loadData`) or use `DEFAULT_SETTINGS`.
2.  Call `initFormatter`.
    -   Parse `userMapJson` and `emojiMapJson` using `parseJsonMap` utility. Handle errors.
    -   Create `SlackFormatter` instance, passing `settings` and the parsed maps.
    -   `SlackFormatter` constructor initializes its components (`Parser`, `Detector`, `Pre/PostProcessors`, `StrategyFactory`) and registers strategies.
3.  Add `SlackFormatSettingTab` to Obsidian.
4.  Register commands (hotkey, palette) and context menu listener.

## Message Processing Algorithm (`SlackFormatter.formatSlackContent`)

The message processing follows these steps:

1.  **Preprocessing (`PreProcessor.process`)**
    -   Input: Raw Slack text.
    -   Actions: Initial cleanup (e.g., normalize line endings), truncate lines based on `maxLines`.
    -   Output: Cleaned text.

2.  **Format Detection (`FormatDetector.detectFormat`)**
    -   Input: Preprocessed text.
    -   Actions: Analyze text patterns to determine the likely format ('standard', 'bracket', or 'unknown').
    -   Output: `FormatStrategyType`.

3.  **Strategy Retrieval (`FormatStrategyFactory.getStrategyByType`)**
    -   Input: Detected `FormatStrategyType`.
    -   Actions: Get or instantiate the required strategy, injecting dependencies (`settings`, `parsedMaps`).
    -   Output: `FormatStrategy` instance or `null`.

4.  **Parsing (`SlackMessageParser.parse`)**
    -   Input: Preprocessed text.
    -   Actions: Parse text line-by-line into `SlackMessage` objects. Identify usernames, timestamps, reactions, text content, thread markers, etc.
    -   Output: `SlackMessage[]`.

5.  **Formatting (`FormatStrategy.formatToMarkdown`)**
    -   Input: `SlackMessage[]`.
    -   Actions (within `BaseFormatStrategy` and concrete implementations):
        -   Iterate through `SlackMessage` objects.
        -   Call strategy-specific methods (e.g., `formatHeader`).
        -   Apply sequence of `Processor` instances (`UsernameProcessor`, `EmojiProcessor`, `UrlProcessor`, etc.) to message text.
        -   Format reactions (using `EmojiProcessor`).
        -   Assemble the final Markdown string for each message.
    -   Output: Formatted Markdown string.

6.  **Postprocessing (`PostProcessor.process`)**
    -   Input: Formatted Markdown string from the strategy.
    -   Actions: Final cleanup (e.g., trim whitespace).
    -   Output: Final Markdown string to be inserted into the editor.

## Performance Optimizations

1.  **Preprocessing Limit (`maxLines`)**: Limits the amount of text initially processed.
2.  **On-Demand Strategy Instantiation**: Factory only creates strategy instances when needed.
3.  **Result Caching (`SlackFormatter`)**: `buildNoteWithFrontmatter` reuses the results of the last `formatSlackContent` call if the input text is identical.
4.  **Specialized Processors**: Focused algorithms optimized for specific processing tasks within the formatting loop.

## Future Development Areas

1.  **Additional Strategy Implementations**: Support more Slack export/copy formats.
2.  **Enhanced Threading**: Collapsible threads, metadata preservation.
3.  **Attachment Handling**: Currently out of scope. Attachment/file link formatting was removed due to complexity and lack of robust parsing.
4.  **Integration Improvements**: Dynamic linking, custom CSS.
5.  **Performance Profiling**: Optimization for very large conversations, regex tuning.
6.  **Testing**: Expand unit and integration tests, especially for the parser and processors.