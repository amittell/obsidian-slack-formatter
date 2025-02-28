# Obsidian Slack Formatter - Tasks

## Current Issues to Fix

1. **Username Detection**
   - [x] Fix doubled usernames (e.g., "Alex MittellAlex Mittell")
   - [ ] Improve detection of message author from Slack pastes
   - [ ] Handle cases where usernames have emoji

2. **Message Boundary Detection**
   - [ ] Improve algorithm to detect message boundaries more accurately
   - [ ] Handle timestamps/dates in different formats
   - [ ] Better identify separate messages vs. continuations

3. **Content Processing**
   - [ ] Fix handling of initial content with no clear author
   - [ ] Improve image and file attachment formatting
   - [ ] Better emoji handling and conversion
   - [ ] Fix URL formatting and link structure

4. **Thread Handling**
   - [ ] Properly format thread replies
   - [ ] Handle thread metadata consistently

## Enhancement Tasks

1. **Debug & Diagnostics**
   - [x] Add more detailed debug logging
   - [ ] Improve error handling with clear messages

2. **Performance Optimization**
   - [ ] Optimize regex patterns for better performance
   - [ ] Improve handling of large pastes

3. **Testing**
   - [ ] Add more test cases for different Slack paste formats
   - [ ] Create automated test harness

4. **Documentation**
   - [ ] Update readme with usage examples
   - [ ] Document common patterns and issues