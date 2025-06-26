#!/usr/bin/env ts-node

/**
 * Demo script to show the debug boundary detection functionality
 * 
 * Usage:
 *   # Run with debug logging enabled
 *   DEBUG_BOUNDARY_DETECTION=true npx ts-node demo-debug-boundary.ts
 * 
 *   # Run without debug logging
 *   npx ts-node demo-debug-boundary.ts
 */

import { IntelligentMessageParser } from './src/formatter/stages/intelligent-message-parser.js';

// Sample Slack conversation with various complexity
const sampleContent = `Clay
Yesterday at 3:45 PM
This is Clay's first message with some content.

Alex
Yesterday at 3:46 PM
This is Alex's response to Clay.
It has multiple lines to test continuation detection.

Clay
Yesterday at 3:47 PM
Clay responds back with some more content.
This is a continuation of Clay's message.

Alex
Yesterday at 3:48 PM
Final message from Alex with a URL: https://example.com
🎉 1`;

console.log('=== Debug Boundary Detection Demo ===\n');

const debugEnabled = process.env.DEBUG_BOUNDARY_DETECTION === 'true';
console.log(`Debug mode: ${debugEnabled ? 'ENABLED' : 'DISABLED'}`);
console.log('To enable debug output, run with: DEBUG_BOUNDARY_DETECTION=true npx ts-node demo-debug-boundary.ts\n');

console.log('Sample Slack conversation:');
console.log('=====================================');
console.log(sampleContent);
console.log('=====================================\n');

if (!debugEnabled) {
    console.log('Running parser (no debug output)...\n');
}

// Create parser instance
const parser = new IntelligentMessageParser();

// Parse with debug logging controlled by environment variable
const messages = parser.parse(sampleContent);

if (!debugEnabled) {
    console.log('Parsing completed!\n');
}

console.log(`Total messages parsed: ${messages.length}\n`);

// Show summary of results
console.log('=== Parsed Messages Summary ===');
messages.forEach((msg, idx) => {
    console.log(`Message ${idx + 1}:`);
    console.log(`  Username: ${msg.username}`);
    console.log(`  Timestamp: ${msg.timestamp || 'none'}`);
    console.log(`  Content: "${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}"`);
    console.log(`  Reactions: ${msg.reactions.length > 0 ? msg.reactions.map(r => `${r.emoji}:${r.count}`).join(', ') : 'none'}`);
    console.log('');
});

console.log('=== Demo Complete ===');

if (!debugEnabled) {
    console.log('\nWant to see detailed boundary detection debug output?');
    console.log('Run: DEBUG_BOUNDARY_DETECTION=true npx ts-node demo-debug-boundary.ts');
}