import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Debug [time](url) issue', () => {
    it('should trace the exact issue', () => {
        // Just the problematic part
        const input = `Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

        const parser = new IntelligentMessageParser(
            { debug: false },
            { userMap: {}, emojiMap: {} }
        );
        
        // Let's manually check what happens
        const lines = input.split('\n');
        console.log('\n=== INPUT LINES ===');
        lines.forEach((line, i) => {
            console.log(`${i}: "${line}"`);
        });
        
        // Parse and check
        const messages = parser.parse(input);
        
        console.log('\n=== PARSED MESSAGES ===');
        messages.forEach((msg, i) => {
            console.log(`\nMessage ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Text lines:`);
            const textLines = msg.text.split('\n');
            textLines.forEach((line, j) => {
                console.log(`    ${j}: "${line}"`);
            });
        });
        
        // The test
        expect(messages.length).toBe(1);
        expect(messages[0].text).toContain('So, first attempt');
    });
});