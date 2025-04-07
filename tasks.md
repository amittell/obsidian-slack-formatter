# Obsidian Slack Formatter - Tasks
Last Updated: March 27, 2025

## Current Issues to Fix (Updated March 25, 2025)

1. **Type Safety & Structure**
   - [x] Fix interface duplication in index.ts
   - [x] Resolve constructor initialization issues
   - [x] Improve state management type safety
   - [x] Add proper type guards for nullable values
   - [x] Implement Strategy Pattern for message formatting

2. **Code Organization**
   - [x] Centralize interface definitions
   - [x] Separate type declarations from implementation
   - [x] Improve state management architecture
   - [x] Clean up formatter class implementation
   - [x] Break down large methods into smaller, focused ones
   - [x] Extract utility functions to dedicated files
   - [x] Create specialized modules for specific concerns
   - [x] Implement clean architecture with proper separation of concerns
   - [x] Remove orphaned/redundant files (`image-utils.ts`, `datetime-processor.ts`)
   - [x] Remove orphaned comments/imports

3. **Documentation**
   - [x] Add comprehensive JSDoc comments to methods
   - [x] Document complex regex patterns with explanations (`message-parser.ts`, `format-detector.ts`)
   - [x] Improve inline comments for complex logic
   - [x] Create dedicated utils.ts file for common functions
   - [x] Document new architecture with Strategy Pattern
   - [x] Update technical specification (`SPEC.md`) with architecture details & current state

4. **Username Detection**
   - [x] Fix doubled usernames (e.g., "Alex MittellAlex Mittell")
   - [x] Improve detection of message author from Slack pastes
   - [x] Handle cases where usernames have emoji
   - [x] Remove hard-coded username fragments in code

5. **Message Boundary Detection**
   - [x] Improve algorithm to detect message boundaries more accurately
   - [x] Handle timestamps/dates in different formats
   - [x] Better identify separate messages vs. continuations
   - [x] Fix indented timestamp format detection

6. **Content Processing**
   - [x] Fix handling of initial content with no clear author
   - [x] Improve image and file attachment formatting *(Marked as Out of Scope)*
   - [x] Better emoji handling and conversion
   - [x] Fix URL formatting and link structure (Completed via Remediation Plan I.1/J.2)

7. **Thread Handling**
   - [x] Properly format thread replies
   - [ ] Handle thread metadata consistently

## Enhancement Tasks

1. **Architecture Improvements**
   - [x] Implement Strategy Pattern for format handlers
   - [x] Create specialized processor classes
   - [x] Centralize interface definitions
   - [x] Implement Factory pattern for strategy selection
   - [x] Consolidate duplicate implementations
   - [x] Clean up module structure and organization
   - [x] Create logical folder structure

2. **Debug & Diagnostics**
   - [x] Add more detailed debug logging
   - [x] Improve error handling with clear messages
   - [ ] Add comprehensive logging throughout processing pipeline

3. **Performance Optimization**
   - [ ] Optimize regex patterns for better performance
   - [ ] Improve handling of large pastes
   - [ ] Add caching mechanisms for repeated operations
   - [ ] Implement lazy processing for large conversations
 
 4. **Testing**
    - [x] Fix failing utility tests (`text-utils`, `image-utils`, `json-utils`) after refactoring/cleanup.
    - [x] Create initial unit test suite for `SlackMessageParser` (`tests/formatter/stages/message-parser.test.ts`).
    - [x] Add basic test cases for `SlackMessageParser` (single/multiple messages, dates, reactions, edited, threads, avatars, emojis, blanks, edge cases).
    - [ ] Add more comprehensive test cases for `SlackMessageParser` (complex inputs, varied formats).
    - [ ] Add more test cases for different Slack paste formats (overall integration).
    - [ ] Create automated test harness (if needed beyond `npm test`).
    - [ ] Create unit tests for processor implementations.
    - [x] Add integration tests for end-to-end processing (`SlackFormatter`).
        - [x] Implement integration tests for `duckcreek-sample.txt`.
        - [x] Implement integration tests for `emoji-channel-sample.txt`.
        - [x] Implement integration tests for `fireside-sample.txt`.
        - [x] Implement integration tests for `guidewire-sample.txt`.
        - [x] Implement integration tests for `multi-person-dm-sample.txt`.
        - [x] Implement integration tests for `test-content.txt`.
        - [x] Implement integration tests for `test-new-content.txt`.
        - [x] Implement integration tests for `ERROR_INVALID_JSON` case.
        - [x] Implement integration tests for `FORMAT_UNKNOWN` case.

5. **Documentation**
   - [x] Update readme with usage examples
   - [x] Document common patterns and issues
   - [x] Add comprehensive JSDoc comments to methods
   - [x] Document complex regex patterns with explanations
   - [x] Improve inline comments for complex logic
   - [x] Update technical specification with latest changes
   - [x] Add processor and strategy documentation

6. **Build & Compilation**
   - [x] Fix duplicate method definition errors
   - [x] Resolve regex syntax errors in patterns
   - [x] Fix recursive method calls causing potential infinite loops
   - [x] Enhance type safety across the codebase
   - [x] Fix linter errors and warnings

## Recently Fixed Issues

1. **Rationalization Project (March 25, 2025)**
   - [x] Implemented comprehensive architecture rationalization
   - [x] Created clean Strategy Pattern implementation
   - [x] Developed specialized processors with clear responsibilities
   - [x] Implemented proper factory pattern for strategy selection
   - [x] Consolidated duplicate code and removed redundancy
   - [x] Fixed typing errors and improved overall type safety
   - [x] Enhanced error handling and debugging capabilities
   - [x] Created logical folder structure and module organization
   - [x] Updated technical documentation to reflect new architecture
   - [x] Implemented barrel exports through index.ts

2. **User Interface**
   - [x] Fix preview pane implementation to work with current formatter
   - [x] Ensure hotkey (Cmd+Shift+V) reliably captures and formats Slack content

3. **Detection Improvements** 
   - [x] Enhanced detection patterns for various Slack content formats
   - [x] Added robust handling for emoji with brackets pattern (![:emoji:])
   - [x] Improved detection of small avatar thumbnails common in reactions
   - [x] Fixed issue with indented timestamp formats being trimmed too early
    
4. **Code Quality**
   - [x] Removed hard-coded username fragments for better maintainability
   - [x] Implemented generic algorithm for truncated username detection
   - [x] Fixed whitespace preservation for indented timestamp formats
   - [x] Resolved duplicate method implementations causing build errors
   - [x] Fixed regex syntax errors in character class patterns
   - [x] Implemented proper separation of public API and private implementation methods

5. **Emoji & Special Character Handling**
    - [x] Added support for usernames with emoji characters (e.g., "Byron LukByron Luk⛔")
    - [x] Enhanced regex patterns to properly handle emoji in various contexts
    - [x] Implemented proper emoji stripping for username comparison
6. **Core File Remediation (March 27, 2025)**
   - [x] Updated `ISlackFormatter.updateSettings` interface signature (`src/interfaces.ts`).
   - [x] Updated `SlackFormatter.updateSettings` implementation (`src/formatter/slack-formatter.ts`).
   - [x] Refactored clipboard reading logic in `src/main.ts` into `getClipboardContent` helper.
   - [x] Removed commented-out properties from `SlackMessage` class (`src/models.ts`).
   - [x] Removed commented-out `channelMapJson` from `DEFAULT_SETTINGS` (`src/settings.ts`).

## Remediation Plan Tasks (March 27, 2025)

*Based on analysis performed in Architect mode & subsequent cleanup.*

- **Models (`src/models.ts`, `src/types/messages.types.ts`)**
    - [x] C.1: Update `SPEC.md` `SlackMessage` example.
    - [x] C.2 / F.3: Remove unused `users` property from `SlackReaction`. *(Done previously)*
- **Formatter (`src/formatter/slack-formatter.ts`)**
    - [ ] E.1: Improve error handling in `formatSlackContent`. *(Low Priority - Current handling acceptable)*
    - [x] E.2: Update `SPEC.md` to remove `channelMap` references.
- **Parser (`src/formatter/stages/message-parser.ts`)**
    - [x] F.1: Pass and use `isDebugEnabled` flag in `log` method. *(Done previously)*
    - [x] F.2: Mark attachment parsing as out of scope in docs (`goals.md`, `tasks.md`, `SPEC.md`). Verify no code remnants.
    - [x] F.3: Remove `users: []` from reaction creation (related to C.2). *(Done previously)*
    - [x] F.4: Add comments to complex regexes.
    - [x] Remove orphaned `cleanupDoubledUsernames` import.
- **Detector (`src/formatter/stages/format-detector.ts`)**
    - [ ] P.1: Enhance `detectFormat` robustness. *(Medium Priority - Future enhancement)*
    - [x] Add comments to regexes.
- **Strategies (`src/formatter/strategies/*`)**
    - [ ] H.1: Verify processor order in `BaseFormatStrategy`. *(Medium Priority - Current order seems okay)*
    - [x] H.2: Refactor attachment handling to use `AttachmentProcessor`. *(Done previously - Refactor involved removing it)*
    - [x] H.3: Use `parseSlackTimestamp` in `BaseFormatStrategy.getFormattedTimestamp`. *(Done previously)*
    - [x] Remove orphaned `formatAttachmentsUtil` imports.
- **Processors (`src/formatter/processors/*`)**
    - [x] I.1: Move URL formatting logic from `UrlProcessor` to `text-utils`. *(Done previously)*
    - [x] Remove redundant `DateTimeProcessor`.
- **Utilities (`src/utils/*`)**
    - [x] J.1: Review `formatAttachments` robustness in `text-utils`. *(N/A - Function removed)*
    - [x] J.2: Add `formatSlackUrlSyntax` function to `text-utils`. *(Done previously)*
    - [ ] K.1: Review `cleanupDoubledUsernames` necessity/regex in `username-utils`. *(Low Priority - Keep for now)*
    - [ ] M.1: Consider stricter value type validation in `parseJsonMap`. *(Low Priority - Current validation sufficient)*
    - [ ] O.1: Remove redundant cleanup in `PreProcessor`. *(Low Priority - No action needed)*
    - [ ] O.2: Fix error return value in `PreProcessor`. *(Low Priority - No action needed)*
    - [ ] P.1: Enhance `detectFormat` robustness in `FormatDetector`. *(Covered by item 158)*
    - [x] Q.1: Remove commented-out image URL filtering in `PostProcessor`.
    - [x] Remove orphaned `image-utils.ts` file and export.
- **Testing**
    - [x] S.1: Fix failing utility tests after refactoring.
    - [x] S.2: Create initial unit tests for `SlackMessageParser`. (High Priority)
    - [ ] S.3: Add more comprehensive tests for `SlackMessageParser`. (High Priority)
    - [x] S.4: Add integration tests for `SlackFormatter`. (High Priority)
    - [ ] S.5: Add unit tests for Processors/Strategies. (Medium Priority)
- **UI (`src/ui/*`)**
    - [ ] T: Review UI for necessary updates based on core changes. (Medium Priority)