import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Minimal failing case', () => {
    it('should include content after [time](url) continuation', () => {
        // Minimal test case with just the problematic pattern
        const input = `UserName  [timestamp](https://url)

Main content

[9:18](https://slack.com/archives/012)

Content after continuation`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        console.log('\n=== MINIMAL TEST OUTPUT ===');
        console.log('Number of messages:', messages.length);
        if (messages.length > 0) {
            console.log('Message text:', JSON.stringify(messages[0].text));
            console.log('Text length:', messages[0].text.length);
            const lines = messages[0].text.split('\n');
            console.log('Number of lines in text:', lines.length);
            lines.forEach((line, i) => {
                console.log(`  Line ${i}: "${line}"`);
            });
        }
        
        expect(messages.length).toBe(1);
        expect(messages[0].text).toContain('Main content');
        expect(messages[0].text).toContain('[9:18]');
        expect(messages[0].text).toContain('Content after continuation');
    });
});