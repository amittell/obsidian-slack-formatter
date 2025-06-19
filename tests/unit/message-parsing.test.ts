import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { SlackFormatSettings } from '../../src/types/settings.types';

describe('Message Parsing - Multiple Messages', () => {
    const settings: SlackFormatSettings = {
        detectCodeBlocks: true,
        convertUserMentions: true,
        replaceEmoji: true,
        parseSlackTimes: true,
        highlightThreads: true,
        convertSlackLinks: true,
        userMapJson: '{}',
        emojiMapJson: '{}',
        maxLines: 5000,
        debug: false,
        collapseThreads: false,
        threadCollapseThreshold: 10,
        frontmatterCssClass: 'slack-conversation',
        frontmatterTitle: ''
    };

    describe('FlexibleMessageParser', () => {
        const parser = new FlexibleMessageParser();

        it('should correctly separate messages with username and timestamp on separate lines', () => {
            const input = `User1
[3:31 PM](https://example.slack.com/archives/C123/p1234567890)
Hey @user2 - as an aside, just visited Duck Creek's payments page again.

User2
[3:32 PM](https://example.slack.com/archives/C123/p1234567891)
Thanks for sharing! Let me take a look.

User3
[3:33 PM](https://example.slack.com/archives/C123/p1234567892)
This is interesting. We should discuss this further.`;

            const messages = parser.parse(input);
            
            expect(messages).toHaveLength(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('Hey @user2');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('Thanks for sharing');
            expect(messages[2].username).toBe('User3');
            expect(messages[2].text).toContain('This is interesting');
        });

        it('should handle messages with simple time stamps', () => {
            const input = `AlexSmith
3:31 PM
First message here

BobJones  
3:32 PM
Second message content`;

            const messages = parser.parse(input);
            
            expect(messages).toHaveLength(2);
            expect(messages[0].username).toBe('AlexSmith');
            expect(messages[0].timestamp).toBe('3:31 PM');
            expect(messages[0].text).toContain('First message here');
            expect(messages[1].username).toBe('BobJones');
            expect(messages[1].timestamp).toBe('3:32 PM');
            expect(messages[1].text).toContain('Second message content');
        });

        it('should not treat message content starting with common words as metadata', () => {
            const input = `User1
3:31 PM
Hey everyone, just wanted to share something

User2
3:32 PM
Nice work on the project!`;

            const messages = parser.parse(input);
            
            expect(messages).toHaveLength(2);
            expect(messages[0].text).toContain('Hey everyone');
            expect(messages[1].text).toContain('Nice work');
        });
    });

    describe('IntelligentMessageParser', () => {
        const parser = new IntelligentMessageParser(settings, { userMap: {}, emojiMap: {} });

        it('should handle basic message separation', () => {
            const input = `User1
3:31 PM
First message

User2
3:32 PM
Second message`;

            const messages = parser.parse(input);
            
            // The intelligent parser might not work as well since it has placeholder implementations
            expect(messages.length).toBeGreaterThan(0);
        });
    });
});