import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Debug Line 3 Rejection', () => {
    it('should analyze why line 3 (Alex J message) is rejected as message start', () => {
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
        
        // Access private methods through any cast
        const parserAny = parser as any;
        
        const lines = input.split('\n');
        console.log('\n=== INPUT LINES ===');
        lines.forEach((line, i) => {
            console.log(`${i}: "${line}"`);
        });
        
        // Create line analysis structure for line 3
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
        
        console.log('\n=== ANALYZING LINE 3 (Alex J message) ===');
        const line3 = lineAnalysis[3];
        console.log(`Line 3: "${line3.trimmed}"`);
        console.log(`Line 3 characteristics:`, line3.characteristics);
        
        // Test all the individual checks manually
        console.log('\n=== INDIVIDUAL CHECKS FOR LINE 3 ===');
        
        // Check isStandaloneTimestamp patterns
        const standaloneTimestampPatterns = [
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i, // [8:26](url)
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]$/i,  // [8:26] or [8:26 AM]
            /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i,  // 8:26 or 8:26 AM
            /^Today at \d{1,2}:\d{2}\s*(?:AM|PM)?$/i, // Today at 8:26 AM
            /^Yesterday at \d{1,2}:\d{2}\s*(?:AM|PM)?$/i // Yesterday at 8:26 AM
        ];
        
        const isStandaloneTimestamp = standaloneTimestampPatterns.some((pattern) => {
            const result = pattern.test(line3.trimmed);
            console.log(`  Pattern ${pattern} -> ${result}`);
            return result;
        });
        console.log(`isStandaloneTimestamp: ${isStandaloneTimestamp}`);
        
        // Check hasUserTimestampCombination
        const hasUserTimestampCombination = parserAny.hasUserTimestampCombination(line3.trimmed);
        console.log(`hasUserTimestampCombination: ${hasUserTimestampCombination}`);
        
        // Check hasStrongIndicators
        const hasStrongIndicators = 
            (line3.characteristics.hasTimestamp && !isStandaloneTimestamp) ||
            line3.characteristics.hasAvatar ||
            hasUserTimestampCombination;
        console.log(`hasStrongIndicators: ${hasStrongIndicators}`);
        
        // Check for continuation nearby
        const searchStart = Math.max(0, 3 - 5);
        const searchEnd = Math.min(lineAnalysis.length - 1, 3 + 3);
        console.log(`\nLooking for continuations in range ${searchStart} to ${searchEnd}:`);
        
        let hasContinuationNearby = false;
        for (let i = searchStart; i <= searchEnd; i++) {
            if (i !== 3) {
                const isContinuation = parserAny.looksLikeContinuation(lineAnalysis[i], lineAnalysis);
                console.log(`  Line ${i}: "${lineAnalysis[i].trimmed}" -> isContinuation: ${isContinuation}`);
                if (isContinuation) {
                    hasContinuationNearby = true;
                }
            }
        }
        console.log(`hasContinuationNearby: ${hasContinuationNearby}`);
        
        // Final logic check
        const shouldBeRejected = hasContinuationNearby && !hasStrongIndicators;
        console.log(`\nFinal logic: hasContinuationNearby (${hasContinuationNearby}) && !hasStrongIndicators (${!hasStrongIndicators}) = ${shouldBeRejected}`);
        
        // Check tooCloseToMessageStart
        let tooCloseToMessageStart = false;
        for (let i = Math.max(0, 3 - 3); i < 3; i++) {
            const prevLine = lineAnalysis[i];
            if (prevLine && !prevLine.isEmpty) {
                // Check if previous line has username and timestamp combination
                const prevExtracted = parserAny.extractUserAndTime(prevLine.trimmed);
                console.log(`  Line ${i}: "${prevLine.trimmed.substring(0, 50)}..." -> extracted: {username: "${prevExtracted.username || 'none'}", timestamp: "${prevExtracted.timestamp || 'none'}"}`);
                if (prevExtracted.username && prevExtracted.timestamp) {
                    tooCloseToMessageStart = true;
                    console.log(`    -> TOO CLOSE TO MESSAGE START`);
                    break;
                }
            }
        }
        console.log(`tooCloseToMessageStart: ${tooCloseToMessageStart}`);
        
        // Check contextSupportsNewMessage
        const contextSupportsNewMessage = 
            line3.context.isAfterEmpty ||
            3 === 0 ||
            parserAny.previousLineEndsMessage(lineAnalysis, 3);
        console.log(`contextSupportsNewMessage: ${contextSupportsNewMessage} (isAfterEmpty: ${line3.context.isAfterEmpty}, index===0: ${3 === 0}, previousLineEndsMessage: ${parserAny.previousLineEndsMessage(lineAnalysis, 3)})`);
        
        // Check hasWeakIndicators
        const hasWeakIndicators = line3.characteristics.hasCapitalStart && line3.length > 10;
        console.log(`hasWeakIndicators: ${hasWeakIndicators}`);
        
        // Final calculation based on actual logic
        const finalResult = (hasStrongIndicators || (hasWeakIndicators && !tooCloseToMessageStart)) && contextSupportsNewMessage;
        console.log(`\nFinal calculation: (hasStrongIndicators (${hasStrongIndicators}) || (hasWeakIndicators (${hasWeakIndicators}) && !tooCloseToMessageStart (${!tooCloseToMessageStart}))) && contextSupportsNewMessage (${contextSupportsNewMessage}) = ${finalResult}`);
        
        // Test couldBeMessageStart for line 3
        const couldBeStart = parserAny.couldBeMessageStart(line3, lineAnalysis, 3);
        console.log(`\ncouldBeMessageStart(line 3): ${couldBeStart}`);
        
        // This should be true - Alex's message should be detected as a message start
        expect(couldBeStart).toBe(true);
    });
});