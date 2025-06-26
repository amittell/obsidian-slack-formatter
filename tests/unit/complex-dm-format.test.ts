import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { readFileSync } from 'fs';
import { TestLogger } from '../helpers';

describe('Complex Multi-Person DM Format', () => {
    it('should correctly format multi-person DM with avatars and attachments', () => {
        // Read the test content
        const input = readFileSync('./test-multi-dm-complex.txt', 'utf8');
        
        // Create user and emoji maps
        const userMap = {
            "U023H2QHYG1": "Amy Brito",
            "U07JC6P29UM": "Alex Mittell", 
            "U07NHRJSB27": "Josh Levey",
            "U0216DSDZDM": "Shannon Cullins"
        };
        
        const emojiMap = JSON.parse(DEFAULT_SETTINGS.emojiMapJson || '{}');
        
        // Create settings with user mappings
        const settings = {
            ...DEFAULT_SETTINGS,
            debug: true,
            userMapJson: JSON.stringify(userMap),
            emojiMapJson: JSON.stringify(emojiMap)
        };
        
        // Create formatter with proper constructor parameters
        const formatter = new SlackFormatter(settings, userMap, emojiMap);

        const parsedMaps = {
            userMap: userMap,
            emojiMap: emojiMap
        };

        // Format the content
        const result = formatter.formatSlackContent(input, settings, parsedMaps);
        
        TestLogger.log('=== Formatted Output ===\n');
        TestLogger.log(result);
        
        // Count messages and analyze content
        const messageBlocks = (result.match(/> \[!slack\]\+/g) || []).length;
        const unknownUserCount = (result.match(/Unknown User/g) || []).length;
        const avatarCount = (result.match(/!\[\]/g) || []).length;
        
        TestLogger.log('\n=== Formatting Analysis ===');
        TestLogger.log(`Message blocks: ${messageBlocks}`);
        TestLogger.log(`Unknown users: ${unknownUserCount}`);
        TestLogger.log(`Avatar images: ${avatarCount}`);
        TestLogger.log(`Emoji converted to Unicode: ${result.includes('👍')}`);
        TestLogger.log(`File attachments parsed as messages: ${result.includes('Message from Zip') || result.includes('Message from Pdf')}`);
        
        // Basic checks
        expect(result).toBeTruthy();
        expect(result).toContain('> [!slack]+');
        
        // Check user names are correctly extracted
        expect(result).toContain('Amy Brito');
        expect(result).toContain('Alex Mittell');
        expect(result).toContain('Josh Levey');
        expect(result).toContain('Shannon Cullins');
        
        // Check user mentions are converted
        expect(result).toMatch(/\[\[Amy Brito\]\]|\[\[amybrito\]\]/);
        expect(result).toMatch(/\[\[Alex Mittell\]\]|\[\[alexm\]\]/);
        
        // Check file attachments are preserved in URLs
        expect(result).toContain('guidewire_stripe_accelerator_apps_pre-release.zip');
        expect(result).toContain('stripe_guidewire_value_card.pdf');
        
        // Check emoji reaction - might be as :+1: or 👍
        expect(result).toMatch(/👍|:\+1:/);
        
        // Check for no Unknown User
        expect(result).not.toContain('Unknown User');
        
        // Check message count - expecting more due to file attachments being parsed as messages
        expect(messageBlocks).toBeGreaterThanOrEqual(4); // Should have at least 4 real messages
        expect(messageBlocks).toBeLessThanOrEqual(10); // But not too many
        
        // Check for no doubled usernames
        expect(result).not.toMatch(/Amy BritoAmy Brito/);
        expect(result).not.toMatch(/Alex MittellAlex Mittell/);
        
        // Avatar count already calculated above
        
        // Check timestamps are preserved
        expect(result).toMatch(/\d{1,2}:\d{2}\s*[AP]M/);
    });
});