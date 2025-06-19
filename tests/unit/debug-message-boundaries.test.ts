import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Debug Message Boundaries', () => {
    it('should analyze the exact boundaries being created', () => {
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
        
        // We need to access private methods to debug the boundary detection
        const parserAny = parser as any;
        
        const lines = input.split('\n');
        console.log('\n=== INPUT LINES ===');
        lines.forEach((line, i) => {
            console.log(`${i}: "${line}"`);
        });

        // Step 1: Analyze structure
        const structure = parserAny.analyzeStructure(lines);
        
        console.log('\n=== STRUCTURE ANALYSIS ===');
        console.log('Message start candidates:', structure.patterns.messageStartCandidates);
        console.log('Timestamps:', structure.patterns.timestamps);
        console.log('Common usernames:', structure.patterns.commonUsernames);
        
        // Step 2: Find boundaries  
        const boundaries = parserAny.findMessageBoundaries(lines, structure);
        
        console.log('\n=== MESSAGE BOUNDARIES ===');
        boundaries.forEach((boundary, i) => {
            console.log(`\nBoundary ${i}: lines ${boundary.start}-${boundary.end} (confidence: ${boundary.confidence.toFixed(2)})`);
            console.log('Lines included:');
            for (let j = boundary.start; j <= boundary.end; j++) {
                console.log(`  ${j}: "${lines[j]}"`);
            }
        });
        
        // Step 3: Extract messages
        const messages = parserAny.extractMessages(lines, boundaries, structure);
        
        console.log('\n=== EXTRACTED MESSAGES ===');
        messages.forEach((msg, i) => {
            console.log(`\nMessage ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
            console.log(`  Text: "${msg.text || 'none'}"`);
        });

        // The boundaries should properly capture all content
        expect(boundaries.length).toBeGreaterThanOrEqual(3);
        
        // Check that we don't have Unknown User messages
        const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
        console.log(`\nUnknown User messages: ${unknownUserMessages.length}`);
        
        // This is the core issue we're trying to fix
        expect(unknownUserMessages.length).toBe(0);
    });
});