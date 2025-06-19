import { IntelligentMessageParser } from './src/formatter/stages/intelligent-message-parser.ts';

const input = `Clement MiaoClement Miao  [Feb 7th at 8:25 AM](https://slack.com/archives/123)  

this is AMAZING omg

[8:26](https://slack.com/archives/456)

even if a bit buggy, this is going to be great

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)  

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

// Access private methods through prototype manipulation
const parser = new IntelligentMessageParser(
    { debug: true },
    { userMap: {}, emojiMap: {} }
);

// Parse to get structure
const lines = input.split('\n');
const lineAnalysis = lines.map((line, idx) => {
    const trimmed = line.trim();
    return {
        original: line,
        trimmed: trimmed,
        isEmpty: trimmed.length === 0,
        length: line.length,
        indentation: line.length - line.trimStart().length,
        characteristics: {
            isShortLine: trimmed.length < 30,
            hasTimestamp: /\d{1,2}:\d{2}/.test(trimmed),
            hasAvatar: false,
            hasUrl: /https?:\/\//.test(trimmed),
            hasEmoji: /:\w+:/.test(trimmed),
            hasReactions: false,
            hasMention: /@\w+/.test(trimmed)
        }
    };
});

// Test findContinuationEnd for line 12
console.log('Testing findContinuationEnd for line 12 (the [9:18] timestamp)');
console.log('Line 12:', lines[12]);
console.log('Line 13:', lines[13]);
console.log('Line 14:', lines[14]);

// Manually trace through findContinuationEnd logic
let endIndex = 12;
for (let i = 13; i < lines.length; i++) {
    const line = lineAnalysis[i];
    console.log(`\nChecking line ${i}: "${line.trimmed}"`);
    
    if (line.isEmpty) {
        console.log('  -> Empty line, checking next non-empty...');
        let nextNonEmpty = i + 1;
        while (nextNonEmpty < lines.length && lineAnalysis[nextNonEmpty].isEmpty) {
            nextNonEmpty++;
        }
        
        if (nextNonEmpty < lines.length) {
            console.log(`  -> Next non-empty is line ${nextNonEmpty}: "${lineAnalysis[nextNonEmpty].trimmed}"`);
            // Would this be a message start?
            const nextLine = lineAnalysis[nextNonEmpty];
            const hasTimestamp = nextLine.characteristics.hasTimestamp;
            const looksLikeContent = nextLine.trimmed.length > 5 && !hasTimestamp;
            console.log(`  -> hasTimestamp: ${hasTimestamp}, looksLikeContent: ${looksLikeContent}`);
        }
        endIndex = i;
        continue;
    }
    
    // For message starts, check if within 3 lines
    const distance = i - 12;
    console.log(`  -> Distance from start: ${distance}`);
    if (distance <= 3) {
        console.log('  -> Within 3 lines, including as continuation content');
        endIndex = i;
    } else {
        console.log('  -> Too far, stopping');
        break;
    }
}

console.log(`\nfindContinuationEnd(12) would return: ${endIndex}`);