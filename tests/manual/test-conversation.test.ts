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
        // Use inline test conversation since external file doesn't exist
        const testText = `John Doe  [12:00 PM](https://example.slack.com/archives/C123/p123)
Hello everyone, this is a test message.

Jane Smith  [12:01 PM](https://example.slack.com/archives/C123/p124)
Reply to the test message with some content.

Bob Wilson  [12:02 PM](https://example.slack.com/archives/C123/p125)
Another message in the conversation.

Alice Johnson  [12:03 PM](https://example.slack.com/archives/C123/p126)
Final message with additional content for testing.

Mike Brown  [12:04 PM](https://example.slack.com/archives/C123/p127)
One more message to ensure we have enough test data.`;

        TestLogger.log('=== Input Text ===');
        TestLogger.log('Length:', testText.length, 'characters');
        TestLogger.log('First 500 chars:', testText.substring(0, 500));
        TestLogger.log('\n');

        // Format the text
        const result = formatter.formatSlackContent(testText);

        TestLogger.log('=== Formatted Result ===');
        TestLogger.log(result);
        TestLogger.log('\n');

        // Skip file writing in tests to avoid file system dependencies
        // fs.writeFileSync(
        //     path.join(__dirname, '../../test-result.md'), 
        //     result
        // );
        // 
        // fs.writeFileSync(
        //     path.join(__dirname, '../../test-result-debug.md'), 
        //     result.substring(0, 2000)
        // );

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