import { SlackFormatter } from './main.js';

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

const settings = {
  userMapJson: '{}',
  emojiMapJson: '{}',
  detectCodeBlocks: true,
  convertUserMentions: true,
  replaceEmoji: true,
  parseSlackTimes: true,
  highlightThreads: true,
  convertSlackLinks: true,
  debug: true // Enable debug mode
};

console.log('Testing FlexibleMessageParser with fixed null safety...\n');

try {
  const formatter = new SlackFormatter(settings);
  const result = formatter.format(testContent);
  
  console.log('SUCCESS: No null reference error!');
  console.log('Formatted result:');
  console.log('================');
  console.log(result);
  
} catch (error) {
  console.error('ERROR:', error.message);
  console.error('Stack:', error.stack);
}