import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Clay Conversation Debug', () => {
    it('should handle duplicate usernames and app messages without creating Unknown User', () => {
        // Exact problematic content from user's input that caused "Unknown User" messages
        const input = `Owen Chandler
Owen Chandler
  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421713437949?thread_ts=1749421707.955479&cid=C025XGWSYTX)
#CONTEXT#
You're finding the rep's longest monologue in a transcript. A monologue only ends if the prospect speaks for ≥10 seconds.
#OBJECTIVE#
Analyze the call transcript and return the rep's longest uninterrupted monologue, following the specified rules.
#INSTRUCTIONS#
1. Analyze the /f_0sxfv1exQCiSZErKsV5.transcript .
2. Clearly identify every segment of continuous rep speech. Continuous rep speech is broken only by prospect interruptions lasting 10 seconds or more.
3. For every prospect interruption that occurs between rep speech segments, explicitly identify:
Interruption timestamp (start and end)
Exact interruption duration in seconds
4. Calculate whether the interruption breaks (≥10 seconds) or does not break (<10 seconds) the monologue.
If the monologue was ≥10 seconds, treat that as a break and start a new rep segment after the prospect finishes talking.
If the monologue was not broken, ignore the interruption and continue counting the rep's monologue.
5. Repeat the process until the end of the call.
6. Identify and return the rep's longest monologue, including its duration in seconds.
7. Output only the monologue's duration in the specified format.
#EXAMPLES#
Input: Transcript with alternating rep and prospect turns, with some prospect turns under and some over 10 seconds.
Expected Output:
DurationSeconds: [120]

 (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421722136699?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Hi there, thanks so much for sharing this! We'll be passing your feedback along to our product team, and any additional context you can provide will help us prioritize with your needs in mind as we shape the roadmap.

If there are specific use cases, workflows, or challenges where these suggestions would make a big difference, feel free to share—we'd love to hear more. Otherwise, we'll plan to close this ticket soon and review your input offline.

6:28 (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421722956409?thread_ts=1749421707.955479&cid=C025XGWSYTX)
All set, close this ticket out
I want to chat with support

6:28 (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421723822739?thread_ts=1749421707.955479&cid=C025XGWSYTX)
All set, close this ticket out
I want to chat with support`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        console.log('\n=== CLAY CONVERSATION DEBUG ===');
        console.log('Number of messages:', messages.length);
        messages.forEach((msg, i) => {
            console.log(`\nMessage ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp}"`);
            console.log(`  Text length: ${msg.text?.length || 0}`);
            console.log(`  Text preview: "${msg.text?.substring(0, 100)}..."`);
        });
        
        // Identify specific issues
        const unknownUserMessages = messages.filter(msg => msg.username === 'Unknown User');
        console.log(`\nUnknown User messages found: ${unknownUserMessages.length}`);
        unknownUserMessages.forEach((msg, i) => {
            console.log(`Unknown User ${i}: "${msg.text?.substring(0, 50)}..."`);
        });
        
        // Expectations (these will likely fail initially, showing us the issues)
        expect(unknownUserMessages.length).toBe(0); // Should have no Unknown User messages
        expect(messages.some(msg => msg.username === 'Owen Chandler')).toBe(true);
        expect(messages.some(msg => msg.username === 'Clay')).toBe(true);
        expect(messages.some(msg => msg.username === 'Jorge Macias')).toBe(true);
        
        // Should not split content mid-sentence
        expect(messages.every(msg => !msg.text?.endsWith('interr...'))).toBe(true);
    });
});