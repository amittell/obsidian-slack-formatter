import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Trace boundary creation detailed', () => {
    it('should trace boundary extension in detail', () => {
        const input = `Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

        // Create parser with debug enabled
        const parser = new IntelligentMessageParser(
            { debug: true },
            { userMap: {}, emojiMap: {} }
        );
        
        // Parse and check results
        const messages = parser.parse(input);
        
        console.log(`\n=== MESSAGES ===`);
        messages.forEach((msg, i) => {
            console.log(`Message ${i}: ${msg.username}`);
            console.log(`Text: ${msg.text}`);
        });
        
        expect(messages.length).toBe(1);
        expect(messages[0].text).toContain('So, first attempt');
    });
});