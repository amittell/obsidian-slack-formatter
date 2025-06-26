import { SlackFormatter } from '../../src/formatter/slack-formatter';
import * as fs from 'fs';
import * as path from 'path';
import { TestLogger } from '../helpers';

describe('Manual Test - Real Conversation', () => {
    let formatter: SlackFormatter;

    beforeEach(() => {
        formatter = new SlackFormatter(
            {
                userMapJson: '{}',
                emojiMapJson: '{}',
                detectCodeBlocks: true,
                convertUserMentions: true,
                replaceEmoji: true,
                parseSlackTimes: true,
                highlightThreads: true,
                convertSlackLinks: true,
                debug: true
            },
            {}, // userMap
            {} // emojiMap
        );
    });

    it('should format the test conversation correctly', () => {
        // Read the test conversation
        const testText = fs.readFileSync(
            path.join(__dirname, '../../test-slack-conversation.txt'), 
            'utf8'
        );

        TestLogger.log('=== Input Text ===');
        TestLogger.log('Length:', testText.length, 'characters');
        TestLogger.log('First 500 chars:', testText.substring(0, 500));
        TestLogger.log('\n');

        // Format the text
        const result = formatter.formatSlackContent(testText);

        TestLogger.log('=== Formatted Result ===');
        TestLogger.log(result);
        TestLogger.log('\n');

        // Save the result
        fs.writeFileSync(
            path.join(__dirname, '../../test-result.md'), 
            result
        );
        
        // Save a debug version with just the first 2000 chars
        fs.writeFileSync(
            path.join(__dirname, '../../test-result-debug.md'), 
            result.substring(0, 2000)
        );

        // Basic assertions
        expect(result).toBeTruthy();
        expect(result).toContain('> [!slack]+ Message from');
        
        // Check if messages were properly separated
        const messageBlocks = result.match(/> \[!slack\]\+ Message from/g);
        TestLogger.log('Number of message blocks found:', messageBlocks?.length || 0);
        
        // Debug: show what usernames are being found
        const usernameMatches = result.match(/> \[!slack\]\+ Message from ([^\n]+)/g);
        TestLogger.log('Usernames found:', usernameMatches || []);
        
        // Debug: show total result length
        TestLogger.log('Result length:', result.length);
        TestLogger.log('First 1000 chars of result:');
        TestLogger.log(result.substring(0, 1000));
        
        // We expect at least 5 messages based on the input
        expect(messageBlocks?.length).toBeGreaterThanOrEqual(5);
    });
});