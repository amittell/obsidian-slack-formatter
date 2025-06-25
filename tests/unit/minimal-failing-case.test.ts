import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Minimal failing case', () => {
    it('should include content after [time](url) continuation', () => {
        // Minimal test case with just the problematic pattern using realistic Slack format
        const input = `UserName  [Feb 6th at 7:47 PM](https://slack.com/archives/012/p123)

Main content

[9:18](https://slack.com/archives/012)

Content after continuation`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        console.log('\n=== MINIMAL TEST OUTPUT ===');
        console.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            console.log(`\nMessage ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp}"`);
            console.log(`  Text: ${JSON.stringify(msg.text)}`);
            console.log(`  Text length: ${msg.text.length}`);
            const lines = msg.text.split('\n');
            console.log(`  Number of lines in text: ${lines.length}`);
            lines.forEach((line, j) => {
                console.log(`    Line ${j}: "${line}"`);
            });
        });
        
        expect(messages.length).toBe(1);
        // The parser should capture ALL content for the message, including both parts
        const allText = messages[0].text;
        expect(allText).toContain('Main content');
        expect(allText).toContain('[9:18]');
        expect(allText).toContain('Content after continuation');
    });
});