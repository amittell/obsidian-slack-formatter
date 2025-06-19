import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('IntelligentMessageParser - Debug Boundary Issue', () => {
    const parser = new IntelligentMessageParser(
        { debug: false },
        { userMap: {}, emojiMap: {} }
    );

    it('should debug the second message issue', () => {
        const input = `Clement MiaoClement Miao  [Feb 7th at 8:25 AM](https://slack.com/archives/123)  

this is AMAZING omg

[8:26](https://slack.com/archives/456)

even if a bit buggy, this is going to be great

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)  

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

        // Create a debug version of the parser
        const debugParser = new IntelligentMessageParser(
            { debug: true },
            { userMap: {}, emojiMap: {} }
        );
        
        // Manually trace through the parsing to understand boundaries
        const lines = input.split('\n');
        const structure = (debugParser as any).analyzeStructure(lines);
        const boundaries = (debugParser as any).findMessageBoundaries(lines, structure);
        
        console.log('\n=== INITIAL BOUNDARIES (before extension/merging) ===');
        boundaries.forEach((b, idx) => {
            console.log(`Boundary ${idx}: start=${b.start}, end=${b.end}, confidence=${b.confidence}`);
        });
        
        // Now get the final boundaries after parsing
        const finalBoundaries = (debugParser as any).findMessageBoundaries(lines, structure);
        
        console.log('\n=== FINAL BOUNDARIES (after extension/merging) ===');
        finalBoundaries.forEach((b, idx) => {
            console.log(`Boundary ${idx}: start=${b.start}, end=${b.end}, confidence=${b.confidence}`);
            console.log(`  Lines ${b.start}-${b.end}:`);
            for (let i = b.start; i <= b.end && i < lines.length; i++) {
                console.log(`    ${i}: "${lines[i]}"`);
            }
            
            // Check for continuations within this boundary
            console.log(`  Checking for continuations within boundary...`);
            for (let i = b.start; i <= b.end && i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const isCont = /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i.test(line);
                    if (isCont) {
                        console.log(`    Line ${i} is a continuation: "${line}"`);
                    }
                }
            }
            
            // Check for continuations after this boundary
            if (b.end < lines.length - 1) {
                let nextNonEmpty = b.end + 1;
                while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === '') {
                    nextNonEmpty++;
                }
                if (nextNonEmpty < lines.length) {
                    const nextLine = lines[nextNonEmpty];
                    console.log(`  Next non-empty line after boundary: ${nextNonEmpty}: "${nextLine}"`);
                    // Check if it's a continuation
                    const isCont = /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i.test(nextLine.trim());
                    console.log(`  Is continuation: ${isCont}`);
                }
            }
        });
        
        const messages = debugParser.parse(input);
        
        console.log('\n=== DEBUG OUTPUT ===');
        console.log(`Total messages: ${messages.length}`);
        console.log(`\nTotal lines: ${lines.length}`);
        lines.forEach((line, idx) => {
            console.log(`${idx}: "${line}"`);
        });
        
        console.log('\n=== MESSAGES ===');
        messages.forEach((msg, idx) => {
            console.log(`\nMessage ${idx}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
            console.log(`  Text: "${msg.text}"`);
        });
    });
});