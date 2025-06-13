# Obsidian Slack Formatter - Technical Specification
Last Updated: January 18, 2025

## Overview
The Obsidian Slack Formatter is a plugin for [Obsidian](https://obsidian.md) that transforms raw Slack conversation text into formatted Markdown callouts. It handles user messages, timestamps, formatting, mentions, emojis, code blocks, threads, and other Slack-specific elements.

## Project Structure

```
obsidian-slack-formatter/
├── src/                      # Source code
│   ├── formatter/           # Core formatting logic
│   │   ├── processors/      # Content processors
│   │   ├── stages/          # Processing pipeline stages
│   │   └── strategies/      # Format strategies
│   ├── types/               # TypeScript type definitions
│   ├── ui/                  # UI components (modals, settings)
│   ├── utils/               # Utility functions
│   ├── interfaces.ts        # Core interfaces
│   ├── main.ts             # Plugin entry point
│   ├── models.ts           # Data models
│   └── settings.ts         # Default settings
├── tests/                   # Test suites
│   ├── integration/        # Integration tests
│   ├── utils/              # Unit tests for utilities
│   └── validation/         # Sample validation tests
├── main.js                 # Built plugin file (git-ignored)
├── manifest.json           # Obsidian plugin manifest
├── package.json            # NPM package configuration
├── tsconfig.json           # TypeScript configuration
├── esbuild.config.mjs      # Build configuration
├── jest.config.mjs         # Test configuration
├── styles.css              # Plugin styles
├── CLAUDE.md              # AI assistant instructions
├── README.md              # User documentation
├── SPEC.md                # This technical specification
└── LICENSE                # MIT license
```

Note: Build artifacts, logs, test outputs, and other temporary files are excluded from version control via `.gitignore`.

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
    -   Coordinates the processing pipeline: `PreProcessor` -> `ImprovedFormatDetector` -> `FlexibleMessageParser` -> content processing -> `FormatStrategy` -> `PostProcessor`.
    -   Manages strategies directly (no factory pattern currently used).
    -   Includes `UnifiedProcessor` for content transformation.
    -   Manages settings, parsed maps (`ParsedMaps`), and caches last results.
    -   Provides methods like `formatSlackContent`, `isLikelySlack`, `getThreadStats`, `buildNoteWithFrontmatter`, `updateSettings`.

3.  **FlexibleMessageParser** (`src/formatter/stages/flexible-message-parser.ts`)
    -   Multi-pass parser using pattern scoring and probability-based detection.
    -   Three-pass approach: identify blocks, refine boundaries, extract metadata.
    -   Parses text into an array of `SlackMessage` objects.
    -   Uses pattern scoring instead of rigid regex matching for flexibility.
    -   Maintains date context and handles various Slack export formats.

4.  **ImprovedFormatDetector** (`src/formatter/stages/improved-format-detector.ts`)
    -   Detects the format using pattern scoring and probability-based analysis.
    -   Supports 'standard', 'bracket', and 'mixed' formats.
    -   Analyzes first 50 lines for pattern density.
    -   Provides `isLikelySlack` for quick detection using multiple indicators.

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
    -   **StandardFormatStrategy**: Handles "Username timestamp" format.
    -   **BracketFormatStrategy**: Handles "[Message from username]" format.
    -   **MixedFormatStrategy**: Handles documents with multiple formats.
    -   Extend `BaseFormatStrategy` and implement abstract methods.

10. **FormatStrategyFactory** (`src/formatter/strategies/format-strategy-factory.ts`)
    -   Factory for creating and retrieving `FormatStrategy` instances.
    -   Currently not actively used - strategies are instantiated directly in `SlackFormatter`.
    -   Supports registration and on-demand instantiation of strategies.

11. **Processor Interfaces & Base Class** (`src/formatter/processors/base-processor.ts`)
    - Defines the `Processor` interface (`process`).
    - Provides `BaseProcessor` for common functionality (optional).

12. **Specialized Processors** (`src/formatter/processors/*.ts`)
    -   Perform specific transformations on text content.
    -   **UnifiedProcessor**: Orchestrates all processors in correct order.
    -   **CodeBlockProcessor**: Detects and formats code blocks.
    -   **EmojiProcessor**: Handles emoji codes, URLs, and reaction formatting.
    -   **ThreadLinkProcessor**: Formats thread reply links.
    -   **UrlProcessor**: Converts Slack URL syntax to Markdown.
    -   **UsernameProcessor**: Formats usernames and converts mentions to wikilinks.
    -   **AttachmentProcessor**: Handles file uploads and link previews.

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
  detectCodeBlocks: boolean;
  convertUserMentions: boolean;
  replaceEmoji: boolean;
  parseSlackTimes: boolean;
  highlightThreads: boolean;
  convertSlackLinks: boolean;
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
  debug?: boolean;
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
  formatStrategy?: string; // Type identifier ('standard', 'bracket', 'mixed', 'fallback')
  processingTime?: number;
  mostActiveUser?: string;
}
```

### Plugin Initialization Flow (`SlackFormatPlugin.onload`)
1.  Load saved settings (`loadData`) or use `DEFAULT_SETTINGS`.
2.  Call `initFormatter`.
    -   Parse `userMapJson` and `emojiMapJson` using `parseJsonMap` utility. Handle errors.
    -   Create `SlackFormatter` instance, passing `settings` and the parsed maps.
    -   `SlackFormatter` constructor initializes its components (`FlexibleMessageParser`, `ImprovedFormatDetector`, `UnifiedProcessor`, `Pre/PostProcessors`, and strategies).
3.  Add `SlackFormatSettingTab` to Obsidian.
4.  Register commands (hotkey, palette) and context menu listener.

## Message Processing Algorithm (`SlackFormatter.formatSlackContent`)

The message processing follows these steps:

1.  **Preprocessing (`PreProcessor.process`)**
    -   Input: Raw Slack text.
    -   Actions: Initial cleanup, truncate lines based on `maxLines`.
    -   Output: Cleaned text with metadata about modifications.

2.  **Format Detection (`ImprovedFormatDetector.detectFormat`)**
    -   Input: Preprocessed text.
    -   Actions: Pattern scoring analysis to determine format ('standard', 'bracket', or 'mixed').
    -   Output: `FormatStrategyType`.

3.  **Message Parsing (`FlexibleMessageParser.parse`)**
    -   Input: Preprocessed text.
    -   Actions: Multi-pass parsing with pattern scoring.
    -   Three passes: identify blocks, refine boundaries, extract metadata.
    -   Output: `SlackMessage[]`.

4.  **Content Processing (`UnifiedProcessor` applied to each message)**
    -   Input: Message text from parsed messages.
    -   Actions: Apply processors in order:
        - Code blocks (preserve formatting)
        - Attachments (handle file/link metadata)
        - URLs (convert Slack syntax)
        - User mentions (convert to wikilinks)
        - Emoji (replace codes with Unicode)
        - Thread links (highlight references)
    -   Output: Processed message text.

5.  **Formatting (`FormatStrategy.formatToMarkdown`)**
    -   Input: Processed `SlackMessage[]`.
    -   Actions: Apply strategy-specific formatting for headers, reactions, and layout.
    -   Output: Formatted Markdown string.

6.  **Postprocessing (`PostProcessor.process`)**
    -   Input: Formatted Markdown string.
    -   Actions: Final cleanup and normalization.
    -   Output: Final Markdown string.

7.  **Error Handling**
    -   Fallback formatting creates warning callout with original content.
    -   All processors have individual error handling with fallbacks.

## Performance Optimizations

1.  **Preprocessing Limit (`maxLines`)**: Limits the amount of text initially processed.
2.  **On-Demand Strategy Instantiation**: Factory only creates strategy instances when needed.
3.  **Result Caching (`SlackFormatter`)**: `buildNoteWithFrontmatter` reuses the results of the last `formatSlackContent` call if the input text is identical.
4.  **Specialized Processors**: Focused algorithms optimized for specific processing tasks within the formatting loop.

## Future Development Areas

1.  **Additional Strategy Implementations**: Support more Slack export/copy formats.
2.  **Enhanced Threading**: Collapsible threads, metadata preservation.
3.  **Enhanced Attachment Handling**: Basic support exists via `AttachmentProcessor`. Could be expanded for richer file/image previews.
4.  **Integration Improvements**: Dynamic linking, custom CSS.
5.  **Performance Profiling**: Optimization for very large conversations, regex tuning.
6.  **Testing**: Expand unit and integration tests, especially for the parser and processors.