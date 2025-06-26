# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Development build with watch mode and inline sourcemaps
- `npm run build` - Production build (minified, no sourcemaps, generates metafile)
- `npm test` - Run Jest test suite
- `npm run analyze` - Build optimization analysis using meta.json

### Testing Commands
- `npm test` - Run all tests
- `npm test -- --testPathPattern=unit` - Run only unit tests
- `npm test -- --testPathPattern=integration` - Run integration tests
- `npm test -- --watch` - Run tests in watch mode
- Run single test: `npm test -- tests/unit/specific-test.test.ts`

## Architecture Overview

This is an Obsidian plugin that formats Slack conversations into Obsidian callouts using a multi-stage processing pipeline.

### Core Processing Pipeline
The formatter follows a staged processing approach:

1. **PreProcessor** (`src/formatter/stages/preprocessor.ts`) - Initial text normalization and preparation
2. **IntelligentMessageParser** (`src/formatter/stages/intelligent-message-parser.ts`) - Parses raw Slack text into structured messages
3. **ImprovedFormatDetector** (`src/formatter/stages/improved-format-detector.ts`) - Detects conversation format (DM, channel, thread)
4. **UnifiedProcessor** (`src/formatter/processors/unified-processor.ts`) - Orchestrates specialized processors:
   - AttachmentProcessor, CodeBlockProcessor, EmojiProcessor, etc.
5. **PostProcessor** (`src/formatter/stages/postprocessor.ts`) - Final formatting and output generation

### Formatting Strategies
The system uses different strategies for different conversation types:
- **StandardFormatStrategy** - Default Obsidian callout format
- **BracketFormatStrategy** - Alternative bracket-based format
- **MixedFormatStrategy** - Combines multiple approaches

### Key Components
- **SlackFormatter** (`src/formatter/slack-formatter.ts`) - Main orchestrator with performance limits and caching
- **SlackMessage** (`src/models.ts`) - Core message data structure
- **Settings** (`src/settings.ts`) - Plugin configuration with user/emoji mapping support
- **UI Components** (`src/ui/`) - Settings tab and preview/confirmation modals

### Message Processing Flow
1. Raw Slack text → PreProcessor → normalized text
2. Normalized text → IntelligentMessageParser → SlackMessage[]
3. Messages → FormatDetector → conversation metadata
4. Messages + metadata → UnifiedProcessor → processed messages
5. Processed messages → Strategy → formatted output
6. Formatted output → PostProcessor → final Obsidian content

### Performance Considerations
The formatter includes built-in performance protections:
- 5MB maximum input size
- 50,000 line processing limit
- Chunked processing for large inputs
- Caching system with 2MB limit

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