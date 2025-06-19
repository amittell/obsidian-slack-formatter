// Test the IntelligentMessageParser with continuation timestamps
import { IntelligentMessageParser } from './src/formatter/stages/intelligent-message-parser.ts';

const testInput = `Clement MiaoClement Miao![:no_entry:](https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/26d4.png)  [Feb 7th at 8:25 AM](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934758764809?thread_ts=1738889253.251969&cid=C039S5CGKEJ)  

this is AMAZING omg

[8:26](https://stripe.slack.com/archives/C039S5CGKEJ/p1738934765553959?thread_ts=1738889253.251969&cid=C039S5CGKEJ)

even if a bit buggy, this is going to be great

![](https://ca.slack-edge.com/E0181S17H6Z-U06JYDE02GY-a46bd4440a89-48)

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://stripe.slack.com/archives/C039S5CGKEJ/p1738937902183979?thread_ts=1738889253.251969&cid=C039S5CGKEJ)  

Yeah, this is going to be fantastic.

[9:18](https://stripe.slack.com/archives/C039S5CGKEJ/p1738937929874099?thread_ts=1738889253.251969&cid=C039S5CGKEJ)

So, first attempt was copying and pasting this very thread, and looks good, but it doesn't seem to detect where all the messages start and end. I get one big message containing the first three messages.

[9:23](https://stripe.slack.com/archives/C039S5CGKEJ/p1738938227881789?thread_ts=1738889253.251969&cid=C039S5CGKEJ)

Curious how the clipboard works on Slack copies; are there image objects along with the text, where eventually we could get pasted embedded images to just paste right in there, too?`;

const parser = new IntelligentMessageParser({ debug: false }, { userMap: {}, emojiMap: {} });
const messages = parser.parse(testInput);

console.log('=== INTELLIGENT PARSER TEST RESULTS ===\n');
console.log(`Parsed ${messages.length} messages:\n`);

messages.forEach((msg, idx) => {
    console.log(`Message ${idx + 1}:`);
    console.log(`  Username: ${msg.username}`);
    console.log(`  Timestamp: ${msg.timestamp || 'none'}`);
    console.log(`  Text length: ${msg.text.length} chars`);
    console.log(`  Text preview: "${msg.text.substring(0, 80).replace(/\n/g, '\\n')}..."`);
    console.log(`  Contains "[8:26]": ${msg.text.includes('[8:26]')}`);
    console.log(`  Contains "[9:18]": ${msg.text.includes('[9:18]')}`);
    console.log(`  Contains "[9:23]": ${msg.text.includes('[9:23]')}`);
    console.log('');
});

console.log('=== EXPECTED RESULTS ===\n');
console.log('Expected 2 messages:');
console.log('1. Clement Miao - should contain "this is AMAZING omg", "[8:26]", and "even if a bit buggy"');
console.log('2. Trajan McGill - should contain "Yeah, this is going to be fantastic", "[9:18]", "[9:23]" and their associated content');