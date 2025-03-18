# Obsidian Slack Formatter - Technical Specification
Last Updated: March 17, 2025

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

5. **MessageParser**
   - Specialized component for parsing raw Slack messages
   - Handles detection and extraction of usernames, timestamps, and content
   - Fixes common formatting issues like duplicated usernames
   - Implements caching for improved performance

6. **TextProcessor**
   - Processes message content with rich formatting
   - Handles links, code blocks, emojis, and mentions

7. **EmojiProcessor**
   - Specialized module for handling emoji-related functionality
   - Processes emoji codes and converts them to Unicode equivalents
   - Fixes emoji formatting issues in various contexts

8. **DateTimeProcessor**
   - Specialized module for date and time handling
   - Parses and formats timestamps consistently
   - Handles various date formats from Slack exports

9. **MessageFormatStrategy**
   - Implements the Strategy Pattern for message formatting
   - Provides interface and base class for format handlers
   - Includes factory for selecting appropriate handler

10. **StandardFormatHandler**
    - Concrete strategy for handling common Slack formats
    - Processes standard username and timestamp patterns

11. **BracketFormatHandler**
    - Concrete strategy for bracket-style timestamps
    - Handles formats like "[10:42 AM] User: Message"

12. **SimpleFormatter**
    - Legacy formatter for specific Slack formats
    - Maintained for backward compatibility

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
  showSuccessMessage: boolean;
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

#### Message Interface
```typescript
interface SlackMessage {
  author: string;
  timestamp: string | null;
  content: string;
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
The plugin now uses a Strategy Pattern approach with specialized processors:

1. **Format Strategy Selection**
   - Uses the `MessageFormatFactory` to determine the appropriate formatter
   - Selects between `StandardFormatHandler`, `BracketFormatHandler`, etc.
   - Falls back to a default handler if no specific format is detected

2. **Specialized Processing**
   - `EmojiProcessor` handles all emoji-related formatting
   - `DateTimeProcessor` manages timestamp and date parsing
   - Each format handler implements its own parsing logic
   - Caching prevents redundant processing of the same content

3. **Message Parsing**
   - The selected strategy processes text line by line
   - Identifies message boundaries based on format-specific patterns
   - Extracts usernames, timestamps, and content
   - Handles special cases like thread dividers

4. **Content Processing**
   - Processes message content with specialized handlers
   - Fixes emoji formatting with `EmojiProcessor`
   - Normalizes timestamps with `DateTimeProcessor`
   - Handles code blocks, mentions, and other formatting

5. **Output Formatting**
   - Transforms parsed messages into Obsidian-compatible markdown
   - Creates wiki links for usernames
   - Formats timestamps consistently
   - Handles thread formatting based on settings

### Key Processing Components

1. **MessageFormatStrategy Interface**
   ```typescript
   interface MessageFormatHandler {
     canHandle(text: string): boolean;
     format(input: string): SlackMessage[];
     formatAsMarkdown(messages: SlackMessage[]): string;
   }
   ```
   - Defines the contract for all format handlers
   - Allows for flexible handling of different Slack formats
   - Enables easy addition of new format support

2. **Format Handlers**
   ```typescript
   class StandardFormatHandler implements MessageFormatHandler {
     // Implementation for standard Slack formats
   }
   
   class BracketFormatHandler implements MessageFormatHandler {
     // Implementation for bracket-style timestamps
   }
   ```
   - Each handler specializes in a specific format
   - Implements format-specific parsing logic
   - Handles edge cases for its format type

3. **Specialized Processors**
   ```typescript
   class EmojiProcessor {
     processEmoji(text: string): string;
     stripEmoji(text: string): string;
     // Other emoji-related methods
   }
   
   class DateTimeProcessor {
     parseTimestamp(line: string): string | null;
     formatTimestamp(timestamp: string): string;
     // Other date/time methods
   }
   ```
   - Focused modules for specific processing concerns
   - Improves separation of concerns
   - Enhances maintainability and testability

### Username Processing Architecture
```typescript
class MessageParser {
    // Public API method for basic username fixes
    public fixDuplicatedUsername(username: string): string {
        return this._fixDoubledUsername(username);
    }

    // Private implementation for username deduplication
    private _fixDoubledUsername(username: string): string {
        // Handle various doubled username patterns
        const patterns = [
            /^(.+)\1$/,                    // Exact doubling
            /^(.+?)\s+\1$/,               // Space-separated doubling
            /^(.+?)(?:\s+.+?){0,1}\1$/,   // Partial name doubling
            /^(.+?)([\u{1F300}-\u{1F9FF}]|[[\]:])$/u  // Name with emoji
        ];
        // ...pattern matching implementation...
    }

    // NEW: Content-aware username deduplication
    private fixDoubledUsernamesInContent(text: string): string {
        if (!text) return text;
        
        // Define patterns to match doubled usernames within content
        const patterns = [
            // Full doubled name: "Alex MittellAlex Mittell"
            /([A-Z][a-z]+\s+[A-Z][a-z]+)([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
            
            // First name repeat: "Alex MittellAlex" 
            /([A-Z][a-z]+)\s+([A-Z][a-z]+)(\1)/g,
            
            // Last name with first: "Alex MittellMittell"
            /([A-Z][a-z]+)\s+([A-Z][a-z]+)(\2)/g
        ];
        
        // Apply each pattern and fix doubled usernames
        let fixedText = text;
        for (const pattern of patterns) {
            fixedText = fixedText.replace(pattern, (match) => {
                return this._fixDoubledUsername(match);
            });
        }
        
        return fixedText;
    }
}
```

### Special Character Handling
```typescript
interface EmojiProcessor {
    // Handle emoji directly attached to usernames
    processUsernameEmoji(text: string): {
        username: string,
        emoji: string | null
    };
    
    // Fix various emoji formats
    normalizeEmoji(text: string): string;
}
```

### Message Format Detection
```typescript
interface FormatDetector {
    isIndentedTimestamp(line: string): boolean;
    preserveWhitespace: boolean;
    normalizeTimeFormat(timestamp: string): string;
}
```

### Message Content Processing
The plugin now includes enhanced handling for doubled usernames that appear within message content, not just at message boundaries. This is implemented through a multi-stage approach:

1. **Initial Message Parsing**
   - Basic message structure detection
   - Primary username and timestamp extraction
   - Initial content collection

2. **Content-Aware Username Processing**
   - Secondary pass to detect doubled usernames in message content
   - Pattern matching for various doubling formats within text
   - Application of fixes while preserving surrounding content

3. **Integration Points**
   - Applied during message content processing
   - Used in preview generation
   - Applied during final markdown rendering

## Performance Optimizations

### Pre-parsing Optimization
- Uses a two-pass approach to identify message boundaries first
- Preserves whitespace for format-sensitive content
- Reduces the need for complex line-by-line state tracking
- More efficient processing of large conversations

### Format-Specific Processing
- Different processing algorithms for different Slack formats
- Optimizes performance by using the most appropriate parser

### Duplicate Prevention
- Advanced message key generation to avoid duplicates
- Content hashing to identify similar messages
- Tracking of processed messages to prevent redundancy

### Content Processing Optimizations
- Efficient pattern matching for embedded username detection
- Single-pass content processing with multiple pattern application
- Reuse of existing username deduplication logic
- Caching of processed content to prevent redundant operations

## Edge Cases and Handling

1. **Undetectable Messages**
   - Fallback to pattern-based detection for non-standard formats
   - Creates "Unknown" author blocks when attribution is impossible
   - Preserves message content even when structure can't be determined

2. **Indented Timestamp Format**
   - Handles format where timestamps are indented on a separate line:
   ```
   Username
     10:30 AM
   Message content
   ```
   - Preserves whitespace during initial parsing to detect this pattern
   - Properly associates timestamp with username from previous line

3. **Timestamp Normalization**
   ```typescript
   public normalizeTimeFormat(timeStr: string): string
   ```
   - Handles various timestamp formats from Slack
   - Normalizes AM/PM formats and removes brackets
   - Ensures consistent time representation

4. **System Message Filtering**
   ```typescript
   public isSystemMessage(line: string): boolean
   ```
   - Identifies and filters out system messages
   - Prevents clutter from join/leave notices and other system events
   - Improves readability of the final output

5. **Content-Embedded Usernames**
   - Handles doubled usernames appearing within message content
   - Fixes cases like "Trajan McGillTrajan McGill" in quoted text
   - Preserves surrounding message content and formatting
   - Maintains emoji and special character handling

## Future Development Areas

1. **Enhanced Format Detection**
   - Support for more Slack export and copy/paste formats
   - Adaptive processing based on detected format
   - Better handling of thread structures

2. **Code Block Improvements**
   - Better detection of multi-line code blocks
   - Syntax highlighting preservation
   - Handling of inline code vs. block code

3. **Reaction Support**
   - Preserve and display message reactions
   - Format emoji reactions in a readable way
   - Count and summarize frequent reactions

4. **Integration Enhancements**
   - Better integration with Obsidian's dataview
   - Enhanced YAML frontmatter for better querying
   - Dynamic linking to related notes

5. **Testing Framework**
   - Use actual parser implementation in the test framework
   - Expand test coverage for all supported formats
   - Add automated validation for parsing edge cases

## Version History

The plugin has been significantly improved with enhancements to the message parsing algorithm, including better handling of indented timestamp formats, generic username handling algorithms, and preservation of whitespace for format-sensitive content.

Recent updates (as of March 17, 2025):
- Implemented Strategy Pattern for message formatting with specialized handlers
- Created dedicated modules for emoji processing and date/time handling
- Added caching to improve performance for repeated operations
- Enhanced username detection with improved emoji handling
- Added content-aware username deduplication for embedded names
- Fixed build errors related to duplicate method implementations
- Resolved regex syntax issues in pattern matching
- Implemented clean separation of public API and private implementation methods
- Added comprehensive handling for doubled usernames in message content
- Improved type safety across the codebase
- Eliminated recursive method calls that could potentially cause infinite loops
- Enhanced documentation with detailed JSDoc comments explaining purpose and behavior
- Added inline comments to complex logic, especially regex patterns
- Improved code organization with better modularization
- Created a dedicated utils.ts file for common utility functions
- Broke down large methods into smaller, single-responsibility methods
- Improved error handling with more specific error messages