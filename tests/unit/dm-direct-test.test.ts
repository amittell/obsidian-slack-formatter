import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('DM Direct Test - Real Problematic Input', () => {
    it('should handle the actual DM input without Unknown User issues', () => {
        // Read the actual DM input
        const dmInput = readFileSync(join(__dirname, '../../test-slack-content.txt'), 'utf8');
        
        console.log('=== DM Input Length ===');
        console.log('Length:', dmInput.length);

        console.log('\n=== Raw input (first 500 chars) ===');
        console.log(dmInput.substring(0, 500));

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

        console.log('\n=== Formatting ===');

        const formattedResult = formatter.formatSlackContent(dmInput);
        
        console.log('\n=== Formatted Output (first 2000 chars) ===');
        console.log(formattedResult.substring(0, 2000));
        
        console.log('\n=== Checking for Unknown User ===');
        const unknownUserCount = (formattedResult.match(/Unknown User/g) || []).length;
        console.log('Unknown User occurrences:', unknownUserCount);
        
        if (unknownUserCount > 0) {
            console.log('\n=== Unknown User Context ===');
            const lines = formattedResult.split('\n');
            lines.forEach((line, i) => {
                if (line.includes('Unknown User')) {
                    console.log(`Line ${i}: ${line}`);
                }
            });
        }
        
        // Get thread stats if available
        const stats = formatter.getThreadStats();
        console.log('\n=== Thread Stats ===');
        console.log('Stats:', stats);
        
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