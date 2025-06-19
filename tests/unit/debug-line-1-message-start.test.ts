import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Debug Line 1 Message Start', () => {
    it('should analyze why line 1 is being detected as a message start', () => {
        const input = `Jacob FreyJacob Frey  [7:13 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733943183106099?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
btw [[alex j]] wanted to mention yesterday the issue I've been tracking which mostly only happens with TypeScript seems related to not finding a good base directory, which should be fixed by the Pyright base directory fixes. The errors go away after switching files once or twice.
Jacob FreyJacob Frey  [7:44 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945054109689?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
Alex J  [7:48 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945285113869?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
[7:48](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945309114539?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
yes when coding i do lots of cmd+p <select thing> esc
cmd+p <other thing> esc
etc.
but it seems like any file switching fixes it`;

        const parser = new IntelligentMessageParser({ debug: true }, { userMap: {}, emojiMap: {} });
        const parserAny = parser as any;
        
        const lines = input.split('\n');
        const lineAnalysis = lines.map((line, idx) => ({
            index: idx,
            content: line,
            trimmed: line.trim(),
            isEmpty: line.trim().length === 0,
            length: line.length,
            characteristics: {
                hasTimestamp: /\d{1,2}:\d{2}/.test(line),
                hasUrl: /https?:\/\//.test(line),
                hasUserMention: /@\w+/.test(line),
                hasEmoji: /:\w+:/.test(line),
                hasAvatar: /!\[\]\(/.test(line),
                hasReactions: /^:\w+:\s*\d+$/.test(line.trim()),
                isShortLine: line.trim().length < 30,
                isLongLine: line.trim().length > 100,
                hasCapitalStart: /^[A-Z]/.test(line.trim()),
                hasNumbers: /\d/.test(line),
                isAllCaps: false,
                hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(line)
            },
            context: {
                prevLine: idx > 0 ? lines[idx-1] : null,
                nextLine: idx < lines.length - 1 ? lines[idx+1] : null,
                isAfterEmpty: idx > 0 && lines[idx-1].trim() === '',
                isBeforeEmpty: idx < lines.length - 1 && lines[idx+1].trim() === ''
            }
        }));

        console.log('\n=== ANALYZING LINE 1 ===');
        const line1 = lineAnalysis[1];
        console.log(`Line 1: "${line1.trimmed}"`);
        console.log('Characteristics:', line1.characteristics);
        
        // Test couldBeMessageStart for line 1
        const couldBeStart = parserAny.couldBeMessageStart(line1, lineAnalysis, 1);
        console.log(`\ncouldBeMessageStart(line 1): ${couldBeStart}`);
        
        // Test all the individual checks manually
        const hasUserTimestampCombination = parserAny.hasUserTimestampCombination(line1.trimmed);
        console.log(`hasUserTimestampCombination: ${hasUserTimestampCombination}`);
        
        const hasStrongIndicators = 
            (line1.characteristics.hasTimestamp && false) || // !isStandaloneTimestamp would be calculated
            line1.characteristics.hasAvatar ||
            hasUserTimestampCombination;
        console.log(`hasStrongIndicators: ${hasStrongIndicators}`);
        
        const hasWeakIndicators = line1.characteristics.hasCapitalStart && line1.length > 10;
        console.log(`hasWeakIndicators: ${hasWeakIndicators}`);
        
        // Check contextSupportsNewMessage
        const contextSupportsNewMessage = 
            line1.context.isAfterEmpty ||
            1 === 0 ||
            parserAny.previousLineEndsMessage(lineAnalysis, 1);
        console.log(`contextSupportsNewMessage: ${contextSupportsNewMessage}`);
        console.log(`  isAfterEmpty: ${line1.context.isAfterEmpty}`);
        console.log(`  index===0: ${1 === 0}`);
        console.log(`  previousLineEndsMessage: ${parserAny.previousLineEndsMessage(lineAnalysis, 1)}`);
        
        // Final calculation
        const finalCalc = (hasStrongIndicators || (hasWeakIndicators && true)) && contextSupportsNewMessage;
        console.log(`\nFinal calculation: (${hasStrongIndicators} || (${hasWeakIndicators} && true)) && ${contextSupportsNewMessage} = ${finalCalc}`);
        
        // Line 1 should NOT be a message start because it's content, not a header
        expect(couldBeStart).toBe(false);
    });
});