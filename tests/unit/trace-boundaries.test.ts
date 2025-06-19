import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Trace boundary creation', () => {
    it('should trace how boundaries are created', () => {
        const input = `Clement MiaoClement Miao  [Feb 7th at 8:25 AM](https://slack.com/archives/123)

this is AMAZING omg

[8:26](https://slack.com/archives/456)

even if a bit buggy, this is going to be great

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

        // Create parser and manually trace
        const parser = new IntelligentMessageParser(
            { debug: false },
            { userMap: {}, emojiMap: {} }
        );
        
        // Access private methods via any cast
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
                hasSpecialChars: /[!?.,;:]/.test(line)
            },
            context: {
                prevLine: idx > 0 ? lines[idx-1] : null,
                nextLine: idx < lines.length - 1 ? lines[idx+1] : null,
                isAfterEmpty: idx > 0 && lines[idx-1].trim() === '',
                isBeforeEmpty: idx < lines.length - 1 && lines[idx+1].trim() === ''
            }
        }));
        
        // Check which lines are message start candidates
        console.log('\n=== MESSAGE START CANDIDATES ===');
        lineAnalysis.forEach((line, idx) => {
            if (!line.isEmpty) {
                const couldBeStart = parserAny.couldBeMessageStart(line, lineAnalysis, idx);
                if (couldBeStart) {
                    console.log(`Line ${idx}: "${line.trimmed.substring(0, 50)}..." - IS message start`);
                }
            }
        });
        
        // Check which lines look like continuations
        console.log('\n=== CONTINUATION TIMESTAMPS ===');
        lineAnalysis.forEach((line, idx) => {
            if (!line.isEmpty) {
                const isContinuation = parserAny.looksLikeContinuation(line, lineAnalysis);
                if (isContinuation) {
                    console.log(`Line ${idx}: "${line.trimmed}" - IS continuation`);
                }
            }
        });
        
        // Parse and check results
        const messages = parser.parse(input);
        console.log(`\n=== FINAL RESULT: ${messages.length} messages ===`);
        
        expect(messages[1].text).toContain('So, first attempt');
    });
});