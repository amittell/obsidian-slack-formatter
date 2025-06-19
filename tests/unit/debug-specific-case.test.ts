import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Debug specific failing case', () => {
    it('should debug the [9:18] case', () => {
        const input = `Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

        const parser = new IntelligentMessageParser(
            { debug: true },
            { userMap: {}, emojiMap: {} }
        );
        
        // Parse to understand what's happening
        const messages = parser.parse(input);
        
        console.log('\n=== MESSAGES ===');
        messages.forEach((msg, idx) => {
            console.log(`\nMessage ${idx}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Text: "${msg.text}"`);
        });
        
        // The message text should include all three parts
        expect(messages.length).toBe(1);
        expect(messages[0].text).toContain('Yeah, this is going to be fantastic');
        expect(messages[0].text).toContain('[9:18]');
        expect(messages[0].text).toContain('So, first attempt');
    });
});