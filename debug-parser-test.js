// Debug why the first test is failing
import { IntelligentMessageParser } from './src/formatter/stages/intelligent-message-parser.ts';

const input = `Clement MiaoClement Miao  [Feb 7th at 8:25 AM](https://slack.com/archives/123)  

this is AMAZING omg

[8:26](https://slack.com/archives/456)

even if a bit buggy, this is going to be great

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)  

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

const parser = new IntelligentMessageParser(
    { debug: true },
    { userMap: {}, emojiMap: {} }
);

console.log('=== DEBUGGING PARSER OUTPUT ===\n');
const messages = parser.parse(input);

console.log(`\nParsed ${messages.length} messages:\n`);
messages.forEach((msg, idx) => {
    console.log(`Message ${idx + 1}:`);
    console.log(`  Username: "${msg.username}"`);
    console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
    console.log(`  Text: "${msg.text}"`);
    console.log('');
});