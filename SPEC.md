# Slack Formatter Technical Specification

This document provides detailed technical specifications for the Obsidian Slack Formatter plugin architecture, data formats, and processing pipeline.

## Architecture Overview

### Core Components

The plugin follows a multi-stage processing pipeline architecture:

```
Raw Slack Text → PreProcessor → Parser → Detector → Processor → Strategy → PostProcessor → Formatted Output
```

### Component Hierarchy

```
SlackFormatPlugin (main.ts)
├── SlackFormatter (formatter/slack-formatter.ts)
│   ├── PreProcessor (stages/preprocessor.ts)
│   ├── IntelligentMessageParser (stages/intelligent-message-parser.ts)
│   ├── ImprovedFormatDetector (stages/improved-format-detector.ts)
│   ├── UnifiedProcessor (processors/unified-processor.ts)
│   │   ├── AttachmentProcessor
│   │   ├── CodeBlockProcessor
│   │   ├── EmojiProcessor
│   │   ├── MessageContinuationProcessor
│   │   ├── ThreadLinkProcessor
│   │   ├── UrlProcessor
│   │   └── UsernameProcessor
│   ├── FormatStrategyFactory (strategies/format-strategy-factory.ts)
│   │   ├── StandardFormatStrategy
│   │   ├── BracketFormatStrategy
│   │   └── MixedFormatStrategy
│   └── PostProcessor (stages/postprocessor.ts)
├── Settings Management (settings.ts, ui/settings-tab.ts)
├── UI Components (ui/modals.ts)
└── Utilities (utils/)
```

## Data Models

### SlackMessage Interface

```typescript
interface SlackMessage {
  id: string;                    // Unique message identifier
  username: string;              // Display username
  originalUsername?: string;     // Original Slack username
  timestamp: string;             // Formatted timestamp
  rawTimestamp?: string;         // Original timestamp
  content: string;               // Message content
  reactions?: SlackReaction[];   // Message reactions
  threadId?: string;             // Thread identifier
  isThreadReply?: boolean;       // Thread reply flag
  attachments?: SlackAttachment[]; // File attachments
  codeBlocks?: CodeBlock[];      // Code block content
  mentions?: string[];           // User mentions
  links?: SlackLink[];           // URLs and links
  edited?: boolean;              // Edit indicator
  type: 'message' | 'system' | 'thread_start'; // Message type
}
```

### SlackFormatSettings Interface

```typescript
interface SlackFormatSettings {
  // Core Features
  detectCodeBlocks: boolean;        // Code block detection
  convertUserMentions: boolean;     // @mention → [[link]] conversion
  replaceEmoji: boolean;            // Custom emoji replacement
  parseSlackTimes: boolean;         // Timestamp parsing
  highlightThreads: boolean;        // Thread formatting
  convertSlackLinks: boolean;       // Link processing
  
  // User Interface
  hotkeyMode: 'cmdShiftV' | 'interceptCmdV'; // Hotkey behavior
  enablePreviewPane: boolean;       // Preview modal
  enableConfirmationDialog: boolean; // Confirmation dialog
  showSuccessMessage: boolean;      // Success notification
  
  // Thread Management
  collapseThreads: boolean;         // Thread collapsing
  threadCollapseThreshold: number;  // Collapse threshold
  
  // Customization
  userMapJson: string;              // User ID → Name mapping
  emojiMapJson: string;             // Emoji → Unicode mapping
  frontmatterCssClass: string;      // CSS class for frontmatter
  frontmatterTitle: string;         // Title format
  timeZone: string;                 // Timezone for timestamps
  
  // Performance
  maxLines: number;                 // Processing limit
  debug: boolean;                   // Debug mode
}
```

## Processing Pipeline Specification

### Stage 1: PreProcessor

**Input**: Raw Slack conversation text  
**Output**: Normalized text with consistent line endings and encoding  

**Operations**:
- Text encoding normalization (UTF-8)
- Line ending standardization (`\n`)
- Whitespace cleanup and trimming
- Input size validation (max 5MB)
- Line count validation (max 50,000 lines)

### Stage 2: IntelligentMessageParser

**Input**: Normalized text  
**Output**: Array of `SlackMessage` objects  

**Pattern Recognition**:
- Username detection: `^[A-Za-z0-9._-]+$` at line start
- Timestamp patterns: Various formats including `HH:MM AM/PM`, `H:MM`, relative times
- Message boundary detection using username + timestamp combinations
- Thread reply identification via indentation or reply markers
- System message recognition (joins, leaves, topic changes)

**Parsing Algorithm**:
1. Split text into logical sections
2. Identify message boundaries using username/timestamp patterns
3. Extract message metadata (user, time, type)
4. Group multi-line content under single messages
5. Detect and parse thread relationships
6. Handle edge cases (missing timestamps, system messages)

### Stage 3: ImprovedFormatDetector

**Input**: Array of `SlackMessage` objects  
**Output**: Conversation metadata and format classification  

**Detection Capabilities**:
- **Channel Format**: Multiple users, topic/purpose, channel operations
- **DM Format**: 2-3 participants, direct conversation style
- **Thread Format**: Parent message with nested replies
- **Mixed Format**: Combination of formats

**Metadata Extraction**:
```typescript
interface ConversationMetadata {
  format: 'channel' | 'dm' | 'thread' | 'mixed';
  participants: string[];
  messageCount: number;
  threadCount: number;
  timeRange: { start: string; end: string };
  channelInfo?: { name: string; topic?: string };
}
```

### Stage 4: UnifiedProcessor

**Input**: Messages + metadata  
**Output**: Processed messages with enhanced content  

#### Sub-Processors

**AttachmentProcessor**:
- File attachment recognition and formatting
- Image, document, and media handling
- Link preview processing

**CodeBlockProcessor**:
- Inline code detection: `` `code` ``
- Multi-line code blocks: ``` blocks
- Language detection and syntax highlighting preservation
- Slack code formatting → Markdown conversion

**EmojiProcessor**:
- Unicode emoji preservation
- Custom emoji replacement using `emojiMapJson`
- Reaction processing and formatting
- Emoji shortcode handling (`:emoji_name:`)

**MessageContinuationProcessor**:
- Multi-part message detection
- "See more" continuation handling
- Message thread reconstruction
- Content deduplication

**ThreadLinkProcessor**:
- Thread link detection and formatting
- Reply-to relationships
- Thread navigation preservation

**UrlProcessor**:
- URL detection and validation
- Slack link format conversion
- Link preview handling
- Markdown link formatting

**UsernameProcessor**:
- @mention detection: `@username` or `<@USER_ID>`
- User mapping via `userMapJson`
- Obsidian link conversion: `[[username]]`
- Display name resolution

### Stage 5: FormatStrategy

**Input**: Processed messages + settings  
**Output**: Formatted text blocks  

#### StandardFormatStrategy (Default)

Output format:
```markdown
> [!slack]+ Message from {username}
> **Time:** {timestamp}
> {content}
```

#### BracketFormatStrategy

Output format:
```markdown
**[{username}]** *{timestamp}*
{content}
```

#### MixedFormatStrategy

Combines multiple strategies based on context:
- Channel messages: Standard format
- DM messages: Bracket format
- Thread replies: Indented format

### Stage 6: PostProcessor

**Input**: Formatted text blocks  
**Output**: Final Obsidian-compatible content  

**Operations**:
- YAML frontmatter generation
- Thread statistics compilation
- Content validation and sanitization
- Final formatting touches
- Performance metrics collection

## Performance Specifications

### Processing Limits

```typescript
const PERFORMANCE_LIMITS = {
  MAX_INPUT_SIZE: 5 * 1024 * 1024,        // 5MB
  MAX_LINES: 50000,                       // 50k lines
  WARN_SIZE_THRESHOLD: 1024 * 1024,       // 1MB warning
  WARN_LINES_THRESHOLD: 10000,            // 10k lines warning
  CHUNK_SIZE: 100 * 1024,                 // 100KB chunks
  MAX_CHUNK_PROCESSING_TIME: 5000,        // 5s per chunk
  CHUNK_DELAY: 10,                        // 10ms between chunks
  PROGRESS_REPORTING_THRESHOLD: 10,       // Progress after 10 chunks
  MAX_CACHE_SIZE: 2 * 1024 * 1024        // 2MB cache limit
};
```

### Memory Management

- **Input Caching**: LRU cache for parsed messages
- **Output Caching**: Formatted content cache with size limits
- **Garbage Collection**: Automatic cleanup of large objects
- **Chunked Processing**: Large inputs processed in smaller segments

### Processing Time Targets

- **Small conversations** (< 100 messages): < 100ms
- **Medium conversations** (100-1000 messages): < 500ms
- **Large conversations** (1000+ messages): < 2000ms with progress indicators

## Error Handling Specification

### Error Categories

1. **Input Validation Errors**
   - Invalid input format
   - Size/line limit exceeded
   - Encoding issues

2. **Parsing Errors**
   - Malformed message structure
   - Invalid timestamp formats
   - Missing required fields

3. **Processing Errors**
   - Processor failures
   - Memory allocation issues
   - Timeout errors

4. **Configuration Errors**
   - Invalid JSON in settings
   - Missing required mappings
   - Invalid regex patterns

### Error Recovery

- **Graceful Degradation**: Continue processing with reduced functionality
- **Fallback Formatting**: Use basic format when advanced processing fails
- **User Notification**: Clear error messages with suggested actions
- **Debug Information**: Detailed logging when debug mode enabled

## Extension Points

### Custom Processors

Implement `BaseProcessor` interface:

```typescript
interface BaseProcessor {
  process(messages: SlackMessage[], settings: SlackFormatSettings): SlackMessage[];
  validate(input: any): boolean;
  getName(): string;
}
```

### Custom Format Strategies

Implement `BaseFormatStrategy` interface:

```typescript
interface BaseFormatStrategy {
  format(messages: SlackMessage[], metadata: ConversationMetadata): string;
  supports(format: ConversationFormat): boolean;
  getPriority(): number;
}
```

### Custom Validators

Implement validation interfaces for input/output validation:

```typescript
interface MessageValidator {
  validate(message: SlackMessage): ValidationResult;
  getErrorMessage(error: ValidationError): string;
}
```

## API Reference

### SlackFormatter Public Methods

```typescript
class SlackFormatter {
  constructor(settings: SlackFormatSettings, userMap: Record<string, string>, emojiMap: Record<string, string>);
  
  // Main formatting method
  formatSlackContent(input: string): string;
  
  // Format detection
  isLikelySlack(input: string): boolean;
  
  // Advanced formatting with frontmatter
  buildNoteWithFrontmatter(input: string): string;
  
  // Configuration updates
  updateSettings(settings: SlackFormatSettings): void;
  updateUserMap(userMap: Record<string, string>): void;
  updateEmojiMap(emojiMap: Record<string, string>): void;
}
```

### Utility Functions

```typescript
// JSON parsing with error handling
function parseJsonMap(jsonString: string, mapName: string): Record<string, string> | null;

// Text processing utilities
function normalizeText(input: string): string;
function extractUsernames(content: string): string[];
function parseTimestamp(timestamp: string, timezone?: string): Date | null;

// Validation utilities
function validateFormatterOutput(output: string): ValidationResult;
function sanitizeContent(content: string): string;
```

## Testing Specification

### Test Categories

1. **Unit Tests** (`tests/unit/`)
   - Individual component testing
   - Processor validation
   - Utility function testing

2. **Integration Tests** (`tests/integration/`)
   - End-to-end pipeline testing
   - Multi-component interaction
   - Performance validation

3. **Snapshot Tests**
   - Output format validation
   - Regression prevention
   - Configuration testing

### Test Data

Sample conversations located in `/samples/`:
- `duckcreek-sample.txt` - Channel conversation
- `multi-person-dm-sample.txt` - DM conversation
- `emoji-channel-sample.txt` - Emoji-heavy content
- Various edge case samples

### Coverage Requirements

- **Line Coverage**: > 90%
- **Branch Coverage**: > 80%
- **Function Coverage**: > 95%

## Security Considerations

### Input Sanitization

- HTML entity encoding for user content
- XSS prevention in formatted output
- URL validation and sanitization
- File path validation for attachments

### Privacy

- No data transmission to external services
- Local processing only
- Optional logging with user consent
- Secure handling of user mappings

## Deployment Specification

### Build Process

1. TypeScript compilation (`tsc`)
2. ESBuild bundling with tree shaking
3. Minification for production builds
4. Source map generation (development only)
5. Manifest validation

### Distribution

- Single `main.js` file output
- Obsidian plugin manifest (`manifest.json`)
- Styles file (`styles.css`) if needed
- Documentation and examples

### Version Management

- Semantic versioning (MAJOR.MINOR.PATCH)
- Compatibility with Obsidian API versions
- Migration scripts for settings changes
- Backward compatibility preservation

---

This specification serves as the authoritative technical reference for the Slack Formatter plugin architecture and implementation details.