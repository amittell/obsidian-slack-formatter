import { FlexibleMessageParser } from './src/formatter/stages/flexible-message-parser.ts';

// Test content that was causing the null error
const testContent = `amittell [8:26](https://amittell.slack.com/archives/C06K1SG0C6C/p1731678397.534059)

Nice!

alex [8:26](https://amittell.slack.com/archives/C06K1SG0C6C/p1731678397.653779)

Let me try the new one

alex [8:26](https://amittell.slack.com/archives/C06K1SG0C6C/p1731678405.007929)

It looks like the intelligent parser was called but didn't parse any messages.

alex [8:26](https://amittell.slack.com/archives/C06K1SG0C6C/p1731678407.831309)

Ok so we should look at \`intelligent-message-parser.ts\` next to improve that.

alex [8:26](https://amittell.slack.com/archives/C06K1SG0C6C/p1731678421.950999)

It is too late for me now to improve the intelligent parser since it's a complex problem. But I want to at least create a simple debug script to understand the problem better.
`;

console.log('Testing FlexibleMessageParser with fixed null safety...\n');

try {
  const parser = new FlexibleMessageParser();
  const messages = parser.parse(testContent, true); // Enable debug mode
  
  console.log('SUCCESS: No null reference error!');
  console.log(`Parsed ${messages.length} messages:`);
  console.log('================');
  
  messages.forEach((msg, index) => {
    console.log(`Message ${index + 1}:`);
    console.log(`  Username: ${msg.username}`);
    console.log(`  Timestamp: ${msg.timestamp || 'N/A'}`);
    console.log(`  Text: ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`);
    console.log('');
  });
  
} catch (error) {
  console.error('ERROR:', error.message);
  console.error('Stack:', error.stack);
}