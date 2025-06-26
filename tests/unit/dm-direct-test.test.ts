import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('DM Direct Test - Real Problematic Input', () => {
    it('should handle the actual DM input without Unknown User issues', () => {
        // Read the actual DM input
        const dmInput = readFileSync(join(__dirname, '../../test-slack-content.txt'), 'utf8');
        
        TestLogger.log('=== DM Input Length ===');
        TestLogger.log('Length:', dmInput.length);

        TestLogger.log('\n=== Raw input (first 500 chars) ===');
        TestLogger.log(dmInput.substring(0, 500));

        const settings = {
            ...DEFAULT_SETTINGS,
            debug: true,
            userMapJson: JSON.stringify({
                "user1": "User1",
                "user2": "User2", 
                "user3": "User3"
            })
        };

        // Create the formatter with proper arguments
        const formatter = new SlackFormatter(settings, {}, {});

        TestLogger.log('\n=== Formatting ===');

        const formattedResult = formatter.formatSlackContent(dmInput);
        
        TestLogger.log('\n=== Formatted Output (first 2000 chars) ===');
        TestLogger.log(formattedResult.substring(0, 2000));
        
        TestLogger.log('\n=== Checking for Unknown User ===');
        const unknownUserCount = (formattedResult.match(/Unknown User/g) || []).length;
        TestLogger.log('Unknown User occurrences:', unknownUserCount);
        
        if (unknownUserCount > 0) {
            TestLogger.log('\n=== Unknown User Context ===');
            const lines = formattedResult.split('\n');
            lines.forEach((line, i) => {
                if (line.includes('Unknown User')) {
                    TestLogger.log(`Line ${i}: ${line}`);
                }
            });
        }
        
        // Get thread stats if available
        const stats = formatter.getThreadStats();
        TestLogger.log('\n=== Thread Stats ===');
        TestLogger.log('Stats:', stats);
        
        // Assertions
        expect(formattedResult).toBeTruthy();
        expect(formattedResult.length).toBeGreaterThan(100);
        
        // The main assertion - we should have 0 "Unknown User" entries
        expect(unknownUserCount).toBe(0);
        
        // Should contain the actual usernames from test data
        expect(formattedResult).toContain('User1');
        expect(formattedResult).toContain('User2');
        expect(formattedResult).toContain('User3');
        
        // Should contain some of the actual content
        expect(formattedResult).toContain('feedback');
        expect(formattedResult).toContain('Guidewire');
    });
});