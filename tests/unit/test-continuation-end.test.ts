import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Test findContinuationEnd', () => {
    it('should find correct continuation end for [time](url) format', () => {
        const input = `Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

        const parser = new IntelligentMessageParser(
            { debug: true },
            { userMap: {}, emojiMap: {} }
        );
        
        // Access private method through any cast
        const parserAny = parser as any;
        
        const lines = input.split('\n');
        const lineAnalysis = lines.map((line, idx) => ({
            index: idx,
            content: line,
            original: line,
            trimmed: line.trim(),
            isEmpty: line.trim().length === 0,
            length: line.length,
            indentation: line.length - line.trimStart().length,
            characteristics: {
                isShortLine: line.trim().length < 30,
                hasTimestamp: /\d{1,2}:\d{2}/.test(line),
                hasAvatar: false,
                hasUrl: /https?:\/\//.test(line),
                hasEmoji: /:\w+:/.test(line),
                hasReactions: false,
                hasMention: /@\w+/.test(line),
                hasCapitalStart: /^[A-Z]/.test(line.trim()),
                hasNumbers: /\d/.test(line),
                isAllCaps: false,
                hasSpecialChars: /[!?.,;:]/.test(line),
                hasUserMention: /@\w+/.test(line)
            },
            context: {
                prevLine: idx > 0 ? lines[idx-1] : null,
                nextLine: idx < lines.length - 1 ? lines[idx+1] : null,
                isAfterEmpty: idx > 0 && lines[idx-1].trim() === '',
                isBeforeEmpty: idx < lines.length - 1 && lines[idx+1].trim() === ''
            }
        }));
        
        console.log('\n=== LINE ANALYSIS ===');
        lineAnalysis.forEach((line, i) => {
            console.log(`Line ${i}: "${line.trimmed}" - isEmpty: ${line.isEmpty}`);
        });
        
        // Line 4 is "[9:18](https://slack.com/archives/012)"
        // Line 6 is "So, first attempt was copying and pasting this very thread"
        
        // Test if line 6 could be a message start
        const line6CouldBeStart = parserAny.couldBeMessageStart(lineAnalysis[6], lineAnalysis, 6);
        console.log(`\nLine 6 could be message start: ${line6CouldBeStart}`);
        
        // Test findContinuationEnd for line 4
        const continuationEnd = parserAny.findContinuationEnd(lineAnalysis, 4);
        
        console.log('\n=== Testing findContinuationEnd ===');
        console.log(`Line 4: "${lines[4]}"`);
        console.log(`Line 5: "${lines[5]}"`); 
        console.log(`Line 6: "${lines[6]}"`);
        console.log(`findContinuationEnd(4) returned: ${continuationEnd}`);
        console.log(`Content at end line ${continuationEnd}: "${lines[continuationEnd]}"`);
        
        // It should return 6, not 4
        expect(continuationEnd).toBe(6);
    });
});