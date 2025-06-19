import { IntelligentMessageParser } from './src/formatter/stages/intelligent-message-parser.ts';

// Just the second message to isolate the issue
const input = `Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

const parser = new IntelligentMessageParser();
const messages = parser.parse(input);

console.log('Messages:', messages.length);
messages.forEach((msg, i) => {
    console.log(`\nMessage ${i}:`);
    console.log('Username:', msg.username);
    console.log('Text:', JSON.stringify(msg.text));
    console.log('Text includes "So, first":', msg.text.includes('So, first'));
});