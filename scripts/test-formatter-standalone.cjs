#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read test text
const testText = fs.readFileSync(path.join(__dirname, '..', 'test-slack-conversation.txt'), 'utf8');

console.log('=== Testing Slack Formatter ===\n');
console.log('Input text sample:');
console.log(testText.substring(0, 500) + '...\n');

// Load and process the formatter code directly
const sourceDir = path.join(__dirname, '..', 'src', 'formatter');

// Import the core formatter components
const { SlackFormatter } = require(path.join(__dirname, '..', 'dist', 'slack-formatter.js'));

// Create formatter instance
const formatter = new SlackFormatter({
    userMapJson: '{}',
    emojiMapJson: '{}',
    detectCodeBlocks: true,
    convertUserMentions: true,
    replaceEmoji: true,
    parseSlackTimes: true,
    highlightThreads: true,
    convertSlackLinks: true,
    debug: true
});

// Format the text
const result = formatter.format(testText);

console.log('=== Formatted Result ===\n');
console.log(result);

// Save the result
fs.writeFileSync(path.join(__dirname, '..', 'test-result.md'), result);
console.log('\n=== Result saved to test-result.md ===');