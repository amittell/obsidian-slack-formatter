# Obsidian Slack Formatter - Tasks

## Current Issues to Fix

1. **Username Detection**
   - [x] Fix doubled usernames (e.g., "Alex MittellAlex Mittell")
   - [x] Improve detection of message author from Slack pastes
   - [x] Handle cases where usernames have emoji

2. **Message Boundary Detection**
   - [x] Improve algorithm to detect message boundaries more accurately
   - [x] Handle timestamps/dates in different formats
   - [x] Better identify separate messages vs. continuations

3. **Content Processing**
   - [x] Fix handling of initial content with no clear author
   - [ ] Improve image and file attachment formatting
   - [x] Better emoji handling and conversion
   - [ ] Fix URL formatting and link structure

4. **Thread Handling**
   - [x] Properly format thread replies
   - [ ] Handle thread metadata consistently

## Enhancement Tasks

1. **Debug & Diagnostics**
   - [x] Add more detailed debug logging
   - [x] Improve error handling with clear messages

2. **Performance Optimization**
   - [ ] Optimize regex patterns for better performance
   - [ ] Improve handling of large pastes

3. **Testing**
   - [ ] Add more test cases for different Slack paste formats
   - [ ] Create automated test harness

4. **Documentation**
   - [ ] Update readme with usage examples
   - [ ] Document common patterns and issues

## Recently Fixed Issues

1. **User Interface**
   - [x] Fix preview pane implementation to work with current formatter
   - [x] Ensure hotkey (Cmd+Shift+V) reliably captures and formats Slack content

2. **Detection Improvements** 
   - [x] Enhanced detection patterns for various Slack content formats
   - [x] Added robust handling for emoji with brackets pattern (![:emoji:])
   - [x] Improved detection of small avatar thumbnails common in reactions