import { SlackFormatter } from './src/formatter/slack-formatter.ts';
import { IntelligentMessageParser } from './src/formatter/stages/intelligent-message-parser.ts';

// Sample data with continuation timestamps
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

// Create parser with debug enabled
const parser = new IntelligentMessageParser({ debug: true }, { userMap: {}, emojiMap: {} });

console.log('=== INTELLIGENT PARSER DEBUG ===\n');

// Step 1: Analyze structure
const lines = testInput.split('\n');
console.log(`Total lines: ${lines.length}\n`);

// Manually trace through couldBeMessageStart for key lines
console.log('=== Analyzing Key Lines ===\n');

const keyLines = [
    { idx: 0, desc: 'First line (Clement Miao)' },
    { idx: 2, desc: 'Line 2: "this is AMAZING omg"' },
    { idx: 4, desc: 'Line 4: "[8:26](url)"' },
    { idx: 6, desc: 'Line 6: "even if a bit buggy..."' },
    { idx: 10, desc: 'Line 10: "Trajan McGill..."' },
    { idx: 14, desc: 'Line 14: "[9:18](url)"' },
    { idx: 16, desc: 'Line 16: "So, first attempt..."' },
    { idx: 18, desc: 'Line 18: "[9:23](url)"' }
];

keyLines.forEach(({ idx, desc }) => {
    if (idx < lines.length) {
        const line = lines[idx].trim();
        console.log(`${desc}:`);
        console.log(`  Content: "${line}"`);
        
        // Check standalone timestamp patterns
        const standaloneTimestampPatterns = [
            { pattern: /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\/archives\/[^)]+\)$/i, name: '[time](url)' },
            { pattern: /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]$/i, name: '[time]' },
            { pattern: /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i, name: 'time' }
        ];
        
        let isStandalone = false;
        standaloneTimestampPatterns.forEach(({ pattern, name }) => {
            if (pattern.test(line)) {
                console.log(`  ✓ Matches standalone timestamp pattern: ${name}`);
                isStandalone = true;
            }
        });
        
        if (isStandalone && idx + 1 < lines.length) {
            const nextLine = lines[idx + 1].trim();
            if (nextLine && nextLine !== '') {
                console.log(`  → Next line has content: "${nextLine.substring(0, 50)}..."`);
                console.log(`  → This should be treated as a CONTINUATION`);
            }
        }
        
        console.log('');
    }
});

// Now parse with the actual parser
console.log('=== PARSING RESULTS ===\n');
const messages = parser.parse(testInput, true);

console.log(`\nParsed ${messages.length} messages:\n`);
messages.forEach((msg, idx) => {
    console.log(`Message ${idx + 1}:`);
    console.log(`  Username: ${msg.username}`);
    console.log(`  Timestamp: ${msg.timestamp || 'none'}`);
    console.log(`  Text preview: "${msg.text.substring(0, 60).replace(/\n/g, '\\n')}..."`);
    console.log('');
});