import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Debug Candidates Selection', () => {
    it('should debug why line 1 is being added to messageStartCandidates', () => {
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
        
        // Access private methods to debug the candidate selection
        const parserAny = parser as any;
        
        const lines = input.split('\n');
        console.log('\n=== INPUT LINES ===');
        lines.forEach((line, i) => {
            console.log(`${i}: "${line}"`);
        });

        // Step 1: Create line analysis structure (same as in parser)
        const analysis = lines.map((line, index) => parserAny.analyzeLine(line, index, lines));
        
        console.log('\n=== CALLING identifyPatterns ===');
        
        // Add custom logging to see what couldBeMessageStart returns for line 1
        console.log('\n=== MANUAL CHECK BEFORE identifyPatterns ===');
        const line1CouldBe = parserAny.couldBeMessageStart(analysis[1], analysis, 1);
        console.log(`Line 1 couldBeMessageStart BEFORE identifyPatterns: ${line1CouldBe}`);
        
        // Step 2: Call identifyPatterns to see how candidates are selected
        const patterns = parserAny.identifyPatterns(analysis);
        
        console.log('\n=== PATTERNS RESULT ===');
        console.log('Message start candidates:', patterns.messageStartCandidates);
        
        // Step 3: Check each candidate manually
        console.log('\n=== MANUAL VERIFICATION ===');
        for (const candidateIndex of patterns.messageStartCandidates) {
            const line = analysis[candidateIndex];
            const result = parserAny.couldBeMessageStart(line, analysis, candidateIndex);
            console.log(`Line ${candidateIndex}: "${line.trimmed}" -> couldBeMessageStart: ${result}`);
        }

        // Verify line 1 is NOT a valid candidate
        const line1Result = parserAny.couldBeMessageStart(analysis[1], analysis, 1);
        console.log(`\nSpecific check for line 1: ${line1Result}`);
        
        // Line 1 should NOT be a message start candidate
        expect(patterns.messageStartCandidates).not.toContain(1);
    });
});