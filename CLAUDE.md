# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that converts Slack conversations into clean, Markdown-formatted callouts. The plugin detects Slack-formatted text and transforms it into Obsidian-compatible markdown with proper user mentions, timestamps, links, emojis, and code blocks.

## Development Commands

### Build Commands
- `npm run build` - Production build with esbuild
- `npm run dev` - Development build with watch mode
- `npm run build:fast` - Fast production build (same as build)

### Testing
- `npm test` - Run full Jest test suite
- `npm test tests/integration/formatter.test.ts` - Run integration tests only
- `npm test tests/utils/` - Run all utility tests
- `npm test -- --watch` - Run tests in watch mode
- `npm test -- -u` - Update test snapshots

### Analysis & Deployment
- `npm run analyze` - Analyze bundle size and dependencies
- `./build-and-deploy.sh` - Build and deploy to Obsidian vault (configure path in script)

## Architecture Overview

The plugin follows a multi-stage processing pipeline with flexible parsing and pattern scoring:

### Core Components

1. **Entry Point**: `src/main.ts`
   - Obsidian plugin class handling commands, settings, and clipboard operations
   - Manages hotkeys (Cmd+Shift+V) and context menu integration

2. **Formatter Core**: `src/formatter/slack-formatter.ts`
   - Main facade with error handling and fallback formatting
   - Manages caching of formatted content and thread statistics
   - Includes debug mode for showing unparsed content

3. **Processing Pipeline** (executed in order):
   - **PreProcessor**: Line truncation for large pastes
   - **ImprovedFormatDetector**: Pattern scoring for format detection
   - **FlexibleMessageParser**: Multi-pass parser with pattern scoring
   - **UnifiedProcessor**: Centralized content processing with fallbacks
   - **Format Strategies**: Apply formatting based on detected format
     - `StandardFormatStrategy`: Default Slack export format
     - `BracketFormatStrategy`: Alternative format with bracketed timestamps
     - `MixedFormatStrategy`: Handles documents with multiple formats
   - **PostProcessor**: Final cleanup and normalization

4. **Content Processors**: All extend `BaseProcessor<string>` with error handling
   - `username-processor`: @mentions → [[wikilinks]]
   - `url-processor`: Slack URLs → markdown links
   - `emoji-processor`: :emoji: → Unicode
   - `code-block-processor`: Code fence detection
   - `thread-link-processor`: Thread reference links
   - `attachment-processor`: File uploads and link previews
   - `unified-processor`: Orchestrates all processors

### Key Technical Details

- **Pattern Scoring**: Probability-based scoring instead of rigid regex matching
- **Multi-pass Parsing**: Three-pass approach for message boundary detection
- **Error Boundaries**: All components wrapped in try-catch with graceful fallbacks
- **Datetime Parsing**: Supports 15+ timestamp formats including relative dates

### Settings Interface

Settings are managed through `SlackFormatSettings` interface:
- `userMapJson`: User ID to name mapping (JSON string)
- `emojiMapJson`: Emoji shortcode to Unicode mapping (JSON string)
- `detectCodeBlocks`: Enable code block detection
- `convertUserMentions`: Convert @mentions to wikilinks
- `replaceEmoji`: Replace emoji codes with Unicode
- `parseSlackTimes`: Parse Slack timestamps
- `highlightThreads`: Highlight thread links
- `convertSlackLinks`: Convert Slack URLs to markdown
- `debug`: Enable debug mode for troubleshooting

### Testing Strategy

- Unit tests for utilities and individual processors
- Integration tests with snapshots for full formatting pipeline
- Sample validation tests against real Slack exports
- Test files mirror source structure under `tests/`

## Important Implementation Notes

- Plugin uses esbuild for bundling with ES module output
- Build outputs to `main.js` in root directory
- No linting configuration currently set up
- Settings use JSON strings for mappings that must be parsed at runtime
- FlexibleMessageParser replaced SlackMessageParser in Jan 2025
- All timestamp parsing wrapped in try-catch for error resilience