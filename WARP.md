# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

- **Development build**: `npm run dev` (watch mode with inline sourcemaps)
- **Production build**: `npm run build` (minified, no sourcemaps, generates meta.json)
- **Testing**:
  - All tests: `npm test`
  - Unit tests only: `npm test -- --testPathPattern=unit`
  - Integration tests only: `npm test -- --testPathPattern=integration`
  - Watch mode: `npm test -- --watch`
  - Single test file: `npm test -- tests/unit/specific-test.test.ts`
  - Quick test: `npm run test:quick`
  - Core tests: `npm run test:core`
- **Code quality**:
  - Format check: `npm run format:check`
  - Format fix: `npm run format`
  - Type check: `npm run type-check`
  - Quick CI validation: `npm run ci:quick`
- **Deploy**: `./build-and-deploy.sh` (requires `OBSIDIAN_PLUGIN_DIR` environment variable pointing to your vault's plugins directory)
- **Git hooks**: `./setup-hooks.sh` (one-time setup to enable pre-commit checks that prevent CI failures)

## Architecture Overview

This is an Obsidian plugin that formats Slack conversations into Obsidian callouts using a multi-stage processing pipeline.

### Processing Pipeline

Raw Slack Text → PreProcessor → Parser → FormatDetector → UnifiedProcessor → Strategy → PostProcessor → Formatted Output

**Pipeline Stages**:

1. **PreProcessor** (`src/formatter/stages/preprocessor.ts`) - Text normalization and validation
2. **IntelligentMessageParser** (`src/formatter/stages/intelligent-message-parser.ts`) - Parses raw Slack text into structured `SlackMessage[]` objects
3. **ImprovedFormatDetector** (`src/formatter/stages/improved-format-detector.ts`) - Detects conversation format (DM, channel, thread, mixed)
4. **UnifiedProcessor** (`src/formatter/processors/unified-processor.ts`) - Orchestrates specialized content processors:
   - AttachmentProcessor
   - CodeBlockProcessor
   - EmojiProcessor
   - MessageContinuationProcessor
   - ThreadLinkProcessor
   - UrlProcessor
   - UsernameProcessor
5. **FormatStrategyFactory** (`src/formatter/strategies/format-strategy-factory.ts`) - Selects formatting strategy:
   - StandardFormatStrategy (default Obsidian callout format)
   - BracketFormatStrategy (alternative bracket-based format)
   - MixedFormatStrategy (combines multiple approaches)
6. **PostProcessor** (`src/formatter/stages/postprocessor.ts`) - Final formatting and YAML frontmatter generation

### Performance Limits

- Max input size: 5 MB
- Max lines: 50,000
- Chunked processing for large inputs (100 KB chunks)
- Cache limit: 2 MB (LRU cache for parsed messages)

## Key Components

- **SlackFormatter** (`src/formatter/slack-formatter.ts`) - Main orchestrator with performance limits and caching
- **SlackFormatPlugin** (`src/main.ts`) - Obsidian plugin entry point, command registration, settings management
- **Settings** (`src/settings.ts`, `src/ui/settings-tab.ts`) - Plugin configuration with JSON-based user and emoji mapping support
- **UI Components** (`src/ui/`) - Modal dialogs for preview and confirmation
- **Utilities** (`src/utils/`) - Logger, text processing, validation, and infrastructure utilities

### Directory Structure

```
src/
├── main.ts                 # Plugin entry point
├── formatter/
│   ├── slack-formatter.ts  # Main formatter orchestrator
│   ├── stages/             # Pipeline stages
│   ├── processors/         # Content processors
│   ├── strategies/         # Output formatting strategies
│   ├── validators/         # Message validation
│   └── standards/          # Output formatting standards
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
└── ui/                     # Obsidian UI components

tests/
├── unit/                   # Individual component tests
├── integration/            # End-to-end pipeline tests
├── manual/                 # Manual testing utilities
└── helpers/                # Test utilities and fixtures
```

## Testing Strategy

- **Unit tests** (`tests/unit/`): Individual component and processor testing
- **Integration tests** (`tests/integration/`): End-to-end pipeline validation
- **Sample conversations** (`samples/`): Real Slack conversation samples for testing
- **Test helpers** (`tests/helpers/`): Assertion utilities, parser setup, performance testing

Run specific test patterns using Jest's `--testPathPattern`:

```bash
npm test -- --testPathPattern=intelligent-message-parser
npm test -- --testPathPattern=clay-conversation
```

## Build System

- **esbuild** (`esbuild.config.mjs`): Bundles TypeScript to single `main.js` file
  - CommonJS format for Node-like Obsidian environment
  - Tree shaking enabled
  - Production: minified, no sourcemaps, generates `meta.json` for analysis
  - Development: inline sourcemaps, watch mode
- **TypeScript**: ES2018 target with ESNext modules
- **Jest**: ESM-compatible test runner with ts-jest
- **GitHub Actions**: Cost-optimized CI/CD workflow
  - Quick checks on all branches (~2 min)
  - Full test suite on main branch and PRs only (~4 min)
  - Multiple Node.js versions (18, 20) for important branches

## Plugin Integration

- **Plugin ID**: `slack-formatter`
- **Commands**:
  - Format hotkey command: "Format Slack paste with hotkey" (no default binding; assign via Obsidian Hotkeys)
  - Command palette: "Format Slack paste"
  - Context menu: "Format as Slack conversation"
- **Settings**:
  - Core features: code blocks, user mentions, emoji replacement, timestamp parsing, thread highlighting, link conversion
  - User mapping: JSON map of Slack user IDs to display names
  - Emoji mapping: JSON map of custom emoji names to Unicode equivalents
  - UI options: hotkey mode, preview pane, confirmation dialog, success messages
  - Thread management: collapsible threads with configurable threshold
  - Advanced: max lines, timezone, CSS class, title format, debug mode
- **Settings changes**: Trigger automatic formatter reinitialization

## Pre-commit Hooks (Cost Savings)

This repository uses git pre-commit hooks to catch issues locally before pushing to CI, saving GitHub Actions minutes and money.

### Setup (One-time)

```bash
./setup-hooks.sh
```

This configures git to use `.githooks/pre-commit` which runs before each commit.

### What the Hook Checks

The pre-commit hook runs the same checks as CI to prevent failed builds:

1. **Code formatting** - Prettier format check on staged files
2. **TypeScript compilation** - Type checking with `tsc --noEmit`
3. **ESLint** - Linting (if configured)
4. **Build** - `npm run build` to catch build failures
5. **Quick tests** - `npm run test:quick` (critical tests only, ~10s)
6. **Common issues** - Checks for console.log, large files, TODO comments

### Bypassing Hooks

In emergencies, skip the hook with:

```bash
git commit --no-verify
```

Or temporarily disable TypeScript checks:

```bash
SKIP_TS_CHECK=1 git commit
```

### Why This Saves Money

- Pre-commit checks take ~30-60 seconds locally
- Failed CI builds waste ~2-4 minutes of GitHub Actions time
- At $0.008/minute, preventing 10 failed builds saves ~$0.20/month
- More importantly: faster feedback loop and cleaner git history

## Important Notes

- The plugin runs entirely locally - no external API calls
- All processing happens in the Obsidian environment
- Settings include JSON-based mappings that must be valid JSON
- Error handling includes graceful degradation and user-friendly notices
- Debug mode enables detailed logging (set in plugin settings)
