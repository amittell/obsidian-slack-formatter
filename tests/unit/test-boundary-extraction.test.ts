import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger, createTestSettings } from '../helpers';

describe('Test boundary extraction', () => {
    it('should extract correct content from boundaries', () => {
        const input = `Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

        const parser = new IntelligentMessageParser(
            createTestSettings({ debug: false }),
            { userMap: {}, emojiMap: {} }
        );
        
        // Access private methods through any cast
        const parserAny = parser as any;
        
        const lines = input.split('\n');
        
        // Manually create structure
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
        
        const structure = {
            lines: lineAnalysis,
            patterns: {
                messageStartCandidates: [0],
                timestamps: [0, 4],
                usernames: [],
                metadata: [],
                averageMessageLength: 4,
                commonUsernames: [],
                timestampFormats: []
            },
            format: 'mixed' as const,
            confidence: 0.6
        };
        
        // Test the boundary creation
        const boundaries = parserAny.findMessageBoundaries(lines, structure);
        
        TestLogger.log('\n=== BOUNDARIES ===');
        boundaries.forEach((b, i) => {
            TestLogger.log(`Boundary ${i}: lines ${b.start}-${b.end}`);
            TestLogger.log(`  Start: "${lines[b.start]}"`);
            TestLogger.log(`  End: "${lines[b.end]}"`);
        });
        
        // Test message extraction
        const messages = parserAny.extractMessages(lines, boundaries, structure);
        
        TestLogger.log('\n=== EXTRACTED MESSAGES ===');
        messages.forEach((msg, i) => {
            TestLogger.log(`Message ${i}:`);
            TestLogger.log(`  Username: "${msg.username}"`);
            TestLogger.log(`  Text: "${msg.text}"`);
        });
        
        expect(boundaries.length).toBe(1);
        expect(boundaries[0].start).toBe(0);
        expect(boundaries[0].end).toBe(6);
        expect(messages[0].text).toContain('So, first attempt');
    });
});