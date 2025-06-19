// Simple debug script to trace parsing logic

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

console.log('=== ANALYZING CONTINUATION PATTERNS ===\n');

const lines = testInput.split('\n');

// Standalone timestamp patterns
const standaloneTimestampPatterns = [
    { regex: /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i, name: '[time](url)' },
    { regex: /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]$/i, name: '[time]' },
    { regex: /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i, name: 'time' }
];

// First, let's see all lines
console.log('All lines:');
lines.forEach((line, idx) => {
    console.log(`${idx}: "${line.trim()}"`);
});
console.log('\n');

// Find all continuation timestamps
const continuations = [];
lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // Check specific lines we know are timestamps
    if (idx === 4 || idx === 14 || idx === 18) {
        console.log(`\nChecking line ${idx}: "${trimmed}"`);
        standaloneTimestampPatterns.forEach(({ regex, name }) => {
            console.log(`  Testing pattern ${name}: ${regex.test(trimmed)}`);
        });
    }
    
    standaloneTimestampPatterns.forEach(({ regex, name }) => {
        if (regex.test(trimmed)) {
            // Look for next non-empty line
            let nextContentLine = '';
            let nextContentIdx = -1;
            for (let i = idx + 1; i < lines.length; i++) {
                const nextTrimmed = lines[i].trim();
                if (nextTrimmed !== '') {
                    nextContentLine = nextTrimmed;
                    nextContentIdx = i;
                    break;
                }
            }
            
            continuations.push({
                lineIndex: idx,
                line: trimmed,
                pattern: name,
                nextLine: nextContentLine,
                nextLineIdx: nextContentIdx,
                hasContent: nextContentLine !== ''
            });
        }
    });
});

console.log(`\nFound ${continuations.length} continuation timestamps:\n`);
continuations.forEach(cont => {
    console.log(`Line ${cont.lineIndex}: "${cont.line}"`);
    console.log(`  Pattern: ${cont.pattern}`);
    console.log(`  Has content after: ${cont.hasContent}`);
    if (cont.hasContent) {
        console.log(`  Next line: "${cont.nextLine}"`);
    }
    console.log('');
});

// Analyze how messages should be grouped
console.log('=== EXPECTED MESSAGE GROUPING ===\n');

const expectedMessages = [
    {
        author: 'Clement Miao',
        lines: [0, 2, 4, 6, 8],
        content: 'Message with timestamp [8:26] continuation'
    },
    {
        author: 'Trajan McGill',
        lines: [10, 12, 14, 16, 18, 20],
        content: 'Message with [9:18] and [9:23] continuations'
    }
];

expectedMessages.forEach((msg, idx) => {
    console.log(`Expected Message ${idx + 1}: ${msg.author}`);
    console.log(`  Should include lines: ${msg.lines.join(', ')}`);
    console.log(`  Description: ${msg.content}`);
    console.log('');
});