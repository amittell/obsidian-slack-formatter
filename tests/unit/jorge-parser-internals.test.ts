import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Jorge Parser Internals Debug', () => {
    let parser: IntelligentMessageParser;

    beforeEach(() => {
        parser = new IntelligentMessageParser();
    });

    it('should test internal parser methods for Jorge', () => {
        // Access private methods using casting
        const parserAny = parser as any;
        
        const testLine = "Jorge Macias";
        
        console.log('\n=== TESTING PARSER INTERNALS ===');
        console.log(`Input line: "${testLine}"`);
        
        // Test looksLikeUsername
        const looksLikeUsername = parserAny.looksLikeUsername(testLine);
        console.log(`looksLikeUsername: ${looksLikeUsername}`);
        
        // Test cleanUsername
        const cleanUsername = parserAny.cleanUsername(testLine);
        console.log(`cleanUsername: "${cleanUsername}"`);
        
        // Test extractUserAndTime
        const extractUserAndTime = parserAny.extractUserAndTime(testLine);
        console.log(`extractUserAndTime:`, extractUserAndTime);
        
        // Test hasTimestampPattern on timestamp line
        const timestampLine = "Jun 9th at 6:28 PM";
        const hasTimestamp = parserAny.hasTimestampPattern(timestampLine);
        console.log(`hasTimestampPattern("${timestampLine}"): ${hasTimestamp}`);
        
        // Test full metadata extraction
        const messageLines = [
            "Jorge Macias",
            "Jun 9th at 6:28 PM", 
            "easy, tell prospects to never cough on a call 🤣"
        ];
        
        console.log('\n=== TESTING METADATA EXTRACTION ===');
        const metadata = parserAny.extractMetadata(messageLines, {});
        console.log('Metadata result:', metadata);
        
        expect(looksLikeUsername).toBe(true);
        expect(cleanUsername).toBe('Jorge Macias');
        expect(hasTimestamp).toBe(true);
        expect(metadata.username).toBe('Jorge Macias');
    });

    it('should test message boundary detection for Jorge', () => {
        const parserAny = parser as any;
        
        const lines = [
            "Jorge Macias",
            "Jun 9th at 6:28 PM", 
            "easy, tell prospects to never cough on a call 🤣"
        ];
        
        console.log('\n=== TESTING BOUNDARY DETECTION ===');
        
        // Test structure analysis
        const structure = parserAny.analyzeStructure(lines);
        console.log('Structure analysis:', {
            format: structure.format,
            confidence: structure.confidence,
            patterns: structure.patterns
        });
        
        // Test boundary detection
        const boundaries = parserAny.findMessageBoundaries(lines, structure);
        console.log('Message boundaries:', boundaries);
        
        // Should detect one message spanning all 3 lines
        expect(boundaries.length).toBeGreaterThan(0);
        if (boundaries.length > 0) {
            expect(boundaries[0].start).toBe(0);
            expect(boundaries[0].end).toBe(2);
        }
    });
});