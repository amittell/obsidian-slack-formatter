import { describe, it, expect, beforeAll } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

// Force debug logging to console
const originalDebug = console.debug;
beforeAll(() => {
    console.debug = console.log;
});

describe('Force debug test', () => {
    it('should show debug output', () => {
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
        
        const messages = parser.parse(input);
        
        console.log('\n=== FINAL MESSAGES ===');
        messages.forEach((msg, idx) => {
            console.log(`\nMessage ${idx}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Text length: ${msg.text.length}`);
            console.log(`  Text: "${msg.text}"`);
        });
        
        expect(messages.length).toBe(2);
        expect(messages[1].text).toContain('So, first attempt');
    });
    
    afterAll(() => {
        console.debug = originalDebug;
    });
});