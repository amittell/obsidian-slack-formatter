import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger } from '../helpers';

describe('Minimal failing case', () => {
    it('should include content after [time](url) continuation', () => {
        // Minimal test case with just the problematic pattern using realistic Slack format
        const input = `UserName  [Feb 6th at 7:47 PM](https://slack.com/archives/012/p123)

Main content

[9:18](https://slack.com/archives/012)

Content after continuation`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        TestLogger.log('\n=== MINIMAL TEST OUTPUT ===');
        TestLogger.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            TestLogger.log(`\nMessage ${i}:`);
            TestLogger.log(`  Username: "${msg.username}"`);
            TestLogger.log(`  Timestamp: "${msg.timestamp}"`);
            TestLogger.log(`  Text: ${JSON.stringify(msg.text)}`);
            TestLogger.log(`  Text length: ${msg.text.length}`);
            const lines = msg.text.split('\n');
            TestLogger.log(`  Number of lines in text: ${lines.length}`);
            lines.forEach((line, j) => {
                TestLogger.log(`    Line ${j}: "${line}"`);
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