import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger } from '../helpers';

describe('Jorge Parser Internals Debug', () => {
    let parser: IntelligentMessageParser;

    beforeEach(() => {
        parser = new IntelligentMessageParser();
    });

    it('should test internal parser methods for Jorge', () => {
        // Access private methods using casting
        const parserAny = parser as any;
        
        const testLine = "Jorge Macias";
        
        if (process.env.DEBUG_TESTS) {
            TestLogger.log('\n=== TESTING PARSER INTERNALS ===');
            TestLogger.log(`Input line: "${testLine}"`);
        }
        
        // Test looksLikeUsername
        const looksLikeUsername = parserAny.looksLikeUsername(testLine);
        if (process.env.DEBUG_TESTS) {
            TestLogger.log(`looksLikeUsername: ${looksLikeUsername}`);
        }
        
        // Test cleanUsername
        const cleanUsername = parserAny.cleanUsername(testLine);
        if (process.env.DEBUG_TESTS) {
            TestLogger.log(`cleanUsername: "${cleanUsername}"`);
        }
        
        // Test extractUserAndTime
        const extractUserAndTime = parserAny.extractUserAndTime(testLine);
        if (process.env.DEBUG_TESTS) {
            TestLogger.log(`extractUserAndTime:`, extractUserAndTime);
        }
        
        // Test hasTimestampPattern on timestamp line
        const timestampLine = "Jun 9th at 6:28 PM";
        const hasTimestamp = parserAny.hasTimestampPattern(timestampLine);
        if (process.env.DEBUG_TESTS) {
            TestLogger.log(`hasTimestampPattern("${timestampLine}"): ${hasTimestamp}`);
        }
        
        // Test full metadata extraction
        const messageLines = [
            "Jorge Macias",
            "Jun 9th at 6:28 PM", 
            "easy, tell prospects to never cough on a call 🤣"
        ];
        
        if (process.env.DEBUG_TESTS) {
            TestLogger.log('\n=== TESTING METADATA EXTRACTION ===');
        }
        const metadata = parserAny.extractMetadata(messageLines, {});
        if (process.env.DEBUG_TESTS) {
            TestLogger.log('Metadata result:', metadata);
        }
        
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
        
        if (process.env.DEBUG_TESTS) {
            TestLogger.log('\n=== TESTING BOUNDARY DETECTION ===');
        }
        
        // Test structure analysis
        const structure = parserAny.analyzeStructure(lines);
        if (process.env.DEBUG_TESTS) {
            TestLogger.log('Structure analysis:', {
                format: structure.format,
                confidence: structure.confidence,
                patterns: structure.patterns
            });
        }
        
        // Test boundary detection
        const boundaries = parserAny.findMessageBoundaries(lines, structure);
        if (process.env.DEBUG_TESTS) {
            TestLogger.log('Message boundaries:', boundaries);
        }
        
        // Use robust assertions that don't make fragile assumptions
        expect(structure).toMatchObject({
            format: expect.any(String),
            confidence: expect.any(Number)
        });
        expect(structure.confidence).toBeGreaterThan(0);
        
        // Verify boundary detection produces valid results
        expect(boundaries).toEqual(expect.any(Array));
        expect(boundaries.length).toBeGreaterThan(0);
        
        // Verify all boundaries have valid structure
        boundaries.forEach((boundary, index) => {
            expect(boundary).toMatchObject({
                start: expect.any(Number),
                end: expect.any(Number),
                confidence: expect.any(Number)
            });
            expect(boundary.start).toBeGreaterThanOrEqual(0);
            expect(boundary.end).toBeGreaterThanOrEqual(boundary.start);
            expect(boundary.end).toBeLessThan(lines.length);
            expect(boundary.confidence).toBeGreaterThan(0);
        });
        
        // Verify at least one boundary spans multiple lines (valid message)
        const validBoundaries = boundaries.filter(b => b.end > b.start);
        expect(validBoundaries.length).toBeGreaterThan(0);
    });
});