import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Debug extractContent', () => {
    it('should show why content is cut off', () => {
        const contentLines = [
            '',  // Line 1 from original
            'Yeah, this is going to be fantastic.',  // Line 2
            '',  // Line 3
            '[9:18](https://slack.com/archives/012)',  // Line 4
            '',  // Line 5
            'So, first attempt was copying and pasting this very thread'  // Line 6
        ];
        
        const parser = new IntelligentMessageParser(
            { debug: false },
            { userMap: {}, emojiMap: {} }
        );
        
        const parserAny = parser as any;
        
        // Manually test each line
        console.log('\n=== CHECKING EACH LINE ===');
        contentLines.forEach((line, i) => {
            const trimmed = line.trim();
            console.log(`\nLine ${i}: "${line}"`);
            console.log(`  Trimmed: "${trimmed}"`);
            console.log(`  Is empty: ${!trimmed}`);
            
            if (trimmed) {
                // Check for reactions
                const reaction = parserAny.parseReaction(trimmed);
                console.log(`  Is reaction: ${reaction !== null}`);
                
                // Check for thread info
                const isThread = parserAny.isThreadInfo(trimmed);
                console.log(`  Is thread info: ${isThread}`);
            }
        });
        
        const result = parserAny.extractContent(contentLines);
        
        console.log('\n=== RESULT ===');
        console.log(`Text: "${result.text}"`);
        console.log(`Reactions: ${JSON.stringify(result.reactions)}`);
        console.log(`Thread info: ${result.threadInfo}`);
        
        expect(result.text).toContain('So, first attempt');
    });
});