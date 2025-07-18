import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger, createTestSettings } from '../helpers';

describe('Test extractContent', () => {
    it('should extract all content lines', () => {
        const contentLines = [
            '',  // Line 1 from original
            'Yeah, this is going to be fantastic.',  // Line 2
            '',  // Line 3
            '[9:18](https://slack.com/archives/012)',  // Line 4
            '',  // Line 5
            'So, first attempt was copying and pasting this very thread'  // Line 6
        ];
        
        const parser = new IntelligentMessageParser(
            createTestSettings({ debug: false }),
            { userMap: {}, emojiMap: {} }
        );
        
        const parserAny = parser as any;
        
        TestLogger.log('\n=== CONTENT LINES ===');
        contentLines.forEach((line, i) => {
            TestLogger.log(`  ${i}: "${line}"`);
        });
        
        const result = parserAny.extractContent(contentLines);
        
        TestLogger.log('\n=== EXTRACTED CONTENT ===');
        TestLogger.log(`Text: "${result.text}"`);
        TestLogger.log(`Text lines:`);
        const textLines = result.text.split('\n');
        textLines.forEach((line, i) => {
            TestLogger.log(`  ${i}: "${line}"`);
        });
        
        expect(result.text).toContain('Yeah, this is going to be fantastic');
        expect(result.text).toContain('[9:18]');
        expect(result.text).toContain('So, first attempt');
    });
});