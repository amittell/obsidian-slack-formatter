# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build Commands

- **Development build**: `npm run dev` (watch mode with inline sourcemaps)
- **Production build**: `npm run build` (minified, no sourcemaps, generates meta.json)
- **Fast build**: `npm run build:fast` (production mode, optimized)

### Testing Commands

- **All tests**: `npm test`
- **Unit tests only**: `npm test -- --testPathPattern=unit`
- **Integration tests only**: `npm test -- --testPathPattern=integration`
- **Watch mode**: `npm test -- --watch`
- **Single test file**: `npm test -- tests/unit/specific-test.test.ts`
- **Quick test**: `npm run test:quick` (CI-optimized subset)
- **Core tests**: `npm run test:core` (essential functionality)
- **Coverage**: `npm run test:coverage`

### Code Quality

- **Format check**: `npm run format:check`
- **Format fix**: `npm run format`
- **Lint check**: `npm run lint`
- **Lint fix**: `npm run lint:fix`
- **Type check**: `npm run type-check`
- **Quick CI validation**: `npm run ci:quick`
- **Full CI**: `npm run ci`

### Documentation

- **Generate docs**: `npm run docs:generate`
- **Validate docs**: `npm run docs:validate`
- **Check docs**: `npm run docs:check`

### Deploy

- **Deploy script**: `./build-and-deploy.sh` (requires `OBSIDIAN_PLUGIN_DIR` environment variable)
- **Git hooks setup**: `./setup-hooks.sh` (one-time setup)

## Architecture Overview

This is an Obsidian plugin that formats Slack conversations into Obsidian callouts using a comprehensive multi-stage processing pipeline.

### Processing Pipeline

Raw Slack Text → PreProcessor → Parser → FormatDetector → UnifiedProcessor → Strategy → PostProcessor → Formatted Output

**Pipeline Stages**:

1. **PreProcessor** (`src/formatter/stages/preprocessor.ts`) - Text normalization and validation with performance limits
2. **IntelligentMessageParser** (`src/formatter/stages/intelligent-message-parser.ts`) - Advanced structural analysis and message extraction
3. **FlexibleMessageParser** (`src/formatter/stages/flexible-message-parser.ts`) - Fallback parser for unusual formats
4. **ImprovedFormatDetector** (`src/formatter/stages/improved-format-detector.ts`) - Format detection with caching
5. **UnifiedProcessor** (`src/formatter/processors/unified-processor.ts`) - Orchestrates specialized content processors
6. **Content Processing** - Multiple specialized processors:
   - AttachmentProcessor
   - CodeBlockProcessor
   - EmojiProcessor
   - MessageContinuationProcessor
   - ThreadLinkProcessor
   - UrlProcessor
   - UsernameProcessor
   - ContentDeduplicationProcessor
   - EmbeddedMessageDetector
7. **Validation** (`src/formatter/validators/message-structure-validator.ts`) - Structure integrity validation
8. **Strategic Formatting** (`src/formatter/strategies/`) - Format-specific output generation
9. **PostProcessor** (`src/formatter/stages/postprocessor.ts`) - Final formatting and YAML frontmatter

### Formatting Strategies

The system uses different strategies based on detected conversation format:

- **StandardFormatStrategy** - Default Obsidian callout format
- **BracketFormatStrategy** - Alternative bracket-based format
- **MixedFormatStrategy** - Combines multiple approaches based on context

### Performance Limits

- Hard caps: **5 MB** maximum input size and **50,000** line limit (requests above these bounds are rejected)
- Warning thresholds at **1 MB** or **10,000** lines to surface potential slowdowns before processing
- Result caching bounded to **2 MB** combined input/output to avoid excess memory growth
- Synchronous processing with early validation/fallback formatting to keep the UI responsive without chunking
- Logger-driven progress notes in debug mode to aid troubleshooting of large conversions

## Key Components

- **SlackFormatter** (`src/formatter/slack-formatter.ts`) - Main orchestrator with comprehensive pipeline
- **SlackFormatPlugin** (`src/main.ts`) - Obsidian plugin entry point, command registration, settings
- **Settings** (`src/settings.ts`, `src/ui/settings-tab.ts`) - Plugin configuration with JSON mappings
- **UI Components** (`src/ui/`) - Modal dialogs for preview, confirmation, and settings
- **Type Definitions** (`src/types/`) - Comprehensive TypeScript interfaces
- **Utilities** (`src/utils/`) - Logger, text processing, validation, and performance monitoring

### Directory Structure

```text
src/
├── main.ts                 # Plugin entry point
├── interfaces.ts           # Core interfaces
├── models.ts              # Data models (SlackMessage, etc.)
├── settings.ts            # Default settings
├── formatter/
│   ├── slack-formatter.ts  # Main formatter orchestrator
│   ├── stages/             # Pipeline stages
│   │   ├── preprocessor.ts
│   │   ├── intelligent-message-parser.ts
│   │   ├── flexible-message-parser.ts
│   │   ├── improved-format-detector.ts
│   │   └── postprocessor.ts
│   ├── processors/         # Content processors
│   │   ├── unified-processor.ts
│   │   ├── attachment-processor.ts
│   │   ├── code-block-processor.ts
│   │   ├── emoji-processor.ts
│   │   ├── message-continuation-processor.ts
│   │   ├── thread-link-processor.ts
│   │   ├── url-processor.ts
│   │   ├── username-processor.ts
│   │   ├── content-deduplication-processor.ts
│   │   └── embedded-message-detector.ts
│   ├── strategies/         # Output formatting strategies
│   │   ├── base-format-strategy.ts
│   │   ├── standard-format-strategy.ts
│   │   ├── bracket-format-strategy.ts
│   │   ├── mixed-format-strategy.ts
│   │   └── format-strategy-factory.ts
│   ├── validators/         # Message validation
│   │   └── message-structure-validator.ts
│   └── standards/          # Output formatting standards
│       └── output-formatting-standards.ts
├── types/                  # TypeScript type definitions
│   ├── index.ts
│   ├── settings.types.ts
│   ├── messages.types.ts
│   └── formatters.types.ts
├── utils/                  # Utility functions
│   ├── logger.ts
│   ├── text-utils.ts
│   ├── validation-utils.ts
│   └── [many other utilities]
└── ui/                     # Obsidian UI components
    ├── settings-tab.ts
    ├── modals.ts
    └── base-modal.ts

tests/
├── unit/                   # Individual component tests
├── integration/            # End-to-end pipeline tests
├── manual/                 # Manual testing utilities
└── helpers/                # Test utilities and fixtures
```

## File Organization

- `src/main.ts` - Obsidian plugin entry point and command registration
- `src/formatter/` - Core formatting logic
  - `stages/` - Pipeline stages (parser, detector, pre-/post-processor)
  - `processors/` - Specialized content processors
  - `strategies/` - Output formatting strategies
  - `validators/` - Message structure validation
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions (logger, text processing, validation)
- `src/ui/` - Obsidian UI components (settings, modals)
- `tests/` - Comprehensive test suite
  - `unit/` - Individual component tests
  - `integration/` - End-to-end pipeline tests
  - `manual/` - Manual testing utilities

## Build System

- **esbuild** (`esbuild.config.mjs`) - Bundles TypeScript to single `main.js` file
- **TypeScript** (`tsconfig.json`) - ES2018 target with ESNext modules
- **Jest** (`jest.config.mjs`) - ESM-compatible test runner with ts-jest

## Development Patterns

### Error Handling

All major components use the centralized Logger utility and display user-friendly notices through Obsidian's Notice API.

### Settings Management

Plugin settings include JSON-based user and emoji mappings. Settings changes trigger formatter reinitialization.

### Testing Strategy

- Unit tests for individual processors and utilities
- Integration tests for complete pipeline workflows
- Snapshot testing for output format validation
- Manual tests for complex conversation scenarios

## Obsidian Plugin Integration

- Plugin ID: `slack-formatter`
- Main commands: Format hotkey (Cmd+Shift+V), palette command, context menu
- Settings tab for configuration
- Modal dialogs for preview and confirmation
- Context menu integration for selected text and clipboard content
