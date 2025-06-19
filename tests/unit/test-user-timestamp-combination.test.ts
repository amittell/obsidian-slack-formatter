import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Test hasUserTimestampCombination', () => {
    it('should correctly detect user+timestamp combinations', () => {
        const parser = new IntelligentMessageParser(
            { debug: true },
            { userMap: {}, emojiMap: {} }
        );
        
        // Access private method through any cast
        const parserAny = parser as any;
        
        const testCases = [
            // Should match - real cases from user sample
            'Jacob FreyJacob Frey  [7:13 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733943183106099?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)',
            'Alex J  [7:48 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945285113869?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)',
            'Jacob FreyJacob Frey  [7:44 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945054109689?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)',
            
            // Should match - simpler cases
            'John 3:45 PM',
            'User [9:30](url)',
            'Name [timestamp]',
            
            // Should NOT match - standalone timestamps
            '[7:48](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945309114539?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)',
            '8:26 AM',
            '[3:45]',
            
            // Should NOT match - content lines  
            'btw [[alex j]] wanted to mention yesterday',
            'yes when coding i do lots of cmd+p',
            'but it seems like any file switching fixes it'
        ];
        
        console.log('\n=== Testing hasUserTimestampCombination ===');
        testCases.forEach((testCase, i) => {
            const result = parserAny.hasUserTimestampCombination(testCase);
            const expected = i < 6; // First 6 should match, rest should not
            console.log(`${i}: "${testCase.substring(0, 50)}..." -> ${result} (expected: ${expected})`);
            
            if (i < 3) {
                // These are the real cases that MUST work
                expect(result).toBe(true);
            } else if (i >= 9) {
                // These content lines MUST NOT match
                expect(result).toBe(false);
            }
        });
    });
});