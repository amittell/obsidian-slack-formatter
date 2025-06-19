import { FlexibleMessageParser } from './src/formatter/stages/flexible-message-parser.ts';

const parser = new FlexibleMessageParser();

const input = `User One  10:30 AM

First message

10:31 AM

Continuation of first message

User Two  10:35 AM

Second message`;

console.log('=== DEBUGGING FLEXIBLE MESSAGE PARSER ===\n');
console.log('Input:');
console.log(input);
console.log('\n---\n');

const messages = parser.parse(input, true);  // Enable debug mode

console.log(`\nParsed ${messages.length} messages:\n`);
messages.forEach((msg, idx) => {
    console.log(`Message ${idx + 1}:`);
    console.log(`  Username: "${msg.username}"`);
    console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
    console.log(`  Text: "${msg.text}"`);
    console.log('');
});