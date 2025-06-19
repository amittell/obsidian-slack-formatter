import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Test message line extraction', () => {
    it('should slice correct lines from boundaries', () => {
        const lines = [
            'Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)',
            '',
            'Yeah, this is going to be fantastic.',
            '',
            '[9:18](https://slack.com/archives/012)',
            '',
            'So, first attempt was copying and pasting this very thread'
        ];
        
        // Boundary is 0-6
        const boundary = { start: 0, end: 6, confidence: 0.8 };
        
        // Test the slice
        const messageLines = lines.slice(boundary.start, boundary.end + 1);
        
        console.log('\n=== SLICED LINES ===');
        console.log(`Boundary: ${boundary.start}-${boundary.end}`);
        console.log(`Sliced ${messageLines.length} lines:`);
        messageLines.forEach((line, i) => {
            console.log(`  ${i}: "${line}"`);
        });
        
        expect(messageLines.length).toBe(7);
        expect(messageLines[6]).toBe('So, first attempt was copying and pasting this very thread');
        
        // Now test what extractSingleMessage does with these lines
        const parser = new IntelligentMessageParser(
            { debug: true },
            { userMap: {}, emojiMap: {} }
        );
        
        const parserAny = parser as any;
        const structure = {
            lines: [],
            patterns: {
                messageStartCandidates: [],
                timestamps: [],
                usernames: [],
                metadata: [],
                averageMessageLength: 4,
                commonUsernames: [],
                timestampFormats: []
            },
            format: 'mixed' as const,
            confidence: 0.6
        };
        
        const message = parserAny.extractSingleMessage(messageLines, structure);
        
        console.log('\n=== EXTRACTED MESSAGE ===');
        console.log(`Username: "${message.username}"`);
        console.log(`Text lines in message:`);
        const textLines = message.text.split('\n');
        textLines.forEach((line, i) => {
            console.log(`  ${i}: "${line}"`);
        });
        
        expect(message.text).toContain('So, first attempt');
    });
});