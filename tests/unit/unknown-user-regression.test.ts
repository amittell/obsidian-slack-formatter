import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';

describe('Unknown User Regression Test Suite', () => {
    let intelligentParser: IntelligentMessageParser;
    let flexibleParser: FlexibleMessageParser;

    beforeEach(() => {
        intelligentParser = new IntelligentMessageParser(
            { debug: false },
            { userMap: {}, emojiMap: {} }
        );
        flexibleParser = new FlexibleMessageParser();
    });

    describe('Avatar-Only Content Scenarios', () => {
        it('should not create Unknown User messages from standalone avatar lines', () => {
            const avatarOnlyContent = `![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-67fda94224a3-48)

Some regular text content that should not be attributed to Unknown User`;

            const messages = intelligentParser.parse(avatarOnlyContent, false);
            
            // Should not create Unknown User messages from avatar-only lines
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
        });

        it('should handle multiple avatar lines without creating Unknown User messages', () => {
            const multipleAvatarsContent = `![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-67fda94224a3-48)
![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-other-avatar.jpg)
![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-another-avatar.png)

User1  [12:00 PM](https://example.com)
Actual message content here`;

            const messages = intelligentParser.parse(multipleAvatarsContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            // Should have at least one real message
            expect(messages.length).toBeGreaterThan(0);
            expect(messages.some(m => m.username === 'User1')).toBe(true);
        });

        it('should associate avatars with subsequent messages correctly', () => {
            const avatarWithMessageContent = `![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-67fda94224a3-48)

Alex MittellAlex Mittell  [Feb 6th at 7:47 PM](https://stripe.slack.com/archives/p123)  

Hey everyone, this is a test message`;

            const messages = flexibleParser.parse(avatarWithMessageContent, true);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            expect(messages.length).toBe(1);
            expect(messages[0].username).toBe('Alex Mittell');
            expect(messages[0].text).toContain('Hey everyone');
        });
    });

    describe('Thread Metadata Scenarios', () => {
        it('should not create Unknown User messages from thread reply counts', () => {
            const threadMetadataContent = `User1  [12:00 PM](https://example.com)
Main message content

13 replies
Last reply 2 months agoView thread`;

            const messages = intelligentParser.parse(threadMetadataContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            // Should have main message
            expect(messages.length).toBe(1);
            expect(messages[0].username).toBe('User1');
        });

        it('should handle various thread metadata patterns', () => {
            const threadVariationsContent = `User1  [12:00 PM](https://example.com)
Message one

4 replies
View thread

User2  [12:01 PM](https://example.com)  
Message two

1 reply
Last reply 1 hour agoView thread

User3  [12:02 PM](https://example.com)
Message three

25 replies
Last reply just nowView thread`;

            const messages = intelligentParser.parse(threadVariationsContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
            expect(messages[2].username).toBe('User3');
        });
    });

    describe('Link Preview Metadata Scenarios', () => {
        it('should not create Unknown User messages from link preview metadata', () => {
            const linkPreviewContent = `User1  [12:00 PM](https://example.com)
Check out this link: https://github.com/example/repo

GitHub
example/repo
GitHub repository description here

Language: TypeScript
Last updated: 2 hours ago

Added by GitHub`;

            const messages = intelligentParser.parse(linkPreviewContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            expect(messages.length).toBe(1);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('Check out this link');
        });

        it('should handle complex link previews with doubled titles', () => {
            const doubledTitleContent = `User1  [12:00 PM](https://example.com)
Sharing this resource:

GuidewireGuidewire
https://www.guidewire.com
Insurance software platform for claims and policy management

Added by Link Preview Bot`;

            const messages = intelligentParser.parse(doubledTitleContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            expect(messages.length).toBe(1);
            expect(messages[0].username).toBe('User1');
        });
    });

    describe('System Message Scenarios', () => {
        it('should not create Unknown User messages from system notifications', () => {
            const systemMessageContent = `Message from Slackbot
Your message was delivered

User1 joined the channel
User2 left the channel
Channel topic was updated

User3  [12:00 PM](https://example.com)
Regular user message`;

            const messages = intelligentParser.parse(systemMessageContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            // Should have at least the regular user message
            const userMessages = messages.filter(m => m.username === 'User3');
            expect(userMessages.length).toBe(1);
        });
    });

    describe('Malformed Content Scenarios', () => {
        it('should handle malformed timestamps gracefully', () => {
            const malformedTimestampContent = `User1  [Invalid Timestamp Format]
This message has a malformed timestamp

User2  [](https://example.com)
Empty timestamp link

User3  [12:00 PM
Missing closing bracket

User4  12:00 PM](https://example.com)
Missing opening bracket`;

            const messages = intelligentParser.parse(malformedTimestampContent, false);
            
            // Count actual Unknown User messages (should be minimal)
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            
            // Should try to extract valid usernames where possible
            const namedMessages = messages.filter(m => m.username !== 'Unknown User');
            expect(namedMessages.length).toBeGreaterThan(0);
        });

        it('should handle content with missing usernames', () => {
            const missingUsernameContent = `[12:00 PM](https://example.com)
Message without username

  [12:01 PM](https://example.com)
Another message with just spaces before timestamp

[12:02 PM](https://example.com)
Third message

User1  [12:03 PM](https://example.com)
Valid message for comparison`;

            const messages = intelligentParser.parse(missingUsernameContent, false);
            
            // Should have at least one valid message
            const validMessages = messages.filter(m => m.username === 'User1');
            expect(validMessages.length).toBe(1);
            
            // Unknown User messages should be minimized through smart parsing
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            console.log(`Unknown User messages: ${unknownUserMessages.length}`);
        });
    });

    describe('Edge Case Content Patterns', () => {
        it('should handle orphaned emoji reactions', () => {
            const orphanedReactionsContent = `User1  [12:00 PM](https://example.com)
Main message content
:thumbsup:
5
:heart:
3
:laughing:
1

User2  [12:01 PM](https://example.com)
Another message`;

            const messages = intelligentParser.parse(orphanedReactionsContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            expect(messages.length).toBe(2);
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
        });

        it('should handle file upload metadata', () => {
            const fileUploadContent = `User1  [12:00 PM](https://example.com)
Here's the document:

document.pdf
2.5 MB

User2  [12:01 PM](https://example.com)
Thanks for sharing!`;

            const messages = intelligentParser.parse(fileUploadContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            expect(messages.length).toBe(2);
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
        });
    });

    describe('Real-World Regression Cases', () => {
        it('should handle complex thread format with avatar and metadata', () => {
            const complexThreadContent = `![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-67fda94224a3-48)

Bill MeiBill Mei![:connect-fingerguns:](https://emoji.slack-edge.com/url) [Monday at 4:28 PM](https://stripe.slack.com/archives/p123)  

This is a complex message with emoji in username

:so-beautiful:
27
:pika-aww:
5

13 replies
Last reply 2 hours agoView thread`;

            const messages = flexibleParser.parse(complexThreadContent, true);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            expect(messages.length).toBe(1);
            expect(messages[0].username).toBe('Bill Mei');
            expect(messages[0].text).toContain('This is a complex message');
        });

        it('should handle DM format with continuation messages', () => {
            const dmContinuationContent = `Alex MittellAlex Mittell
  3:13 PM
Hello everyone!

3:14
This is a continuation message

3:15
Another continuation

John DoeJohn Doe
  3:16 PM
Reply message`;

            const messages = intelligentParser.parse(dmContinuationContent, false);
            
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            expect(unknownUserMessages.length).toBe(0);
            
            // Should have messages from both users
            const alexMessages = messages.filter(m => m.username === 'Alex Mittell');
            const johnMessages = messages.filter(m => m.username === 'John Doe');
            
            expect(alexMessages.length).toBeGreaterThan(0);
            expect(johnMessages.length).toBeGreaterThan(0);
        });
    });

    describe('Validation and Metrics', () => {
        it('should provide comprehensive metrics on Unknown User occurrences', () => {
            // Test with a variety of content types
            const mixedContent = `![](https://ca.slack-edge.com/avatar.jpg)

User1  [12:00 PM](https://example.com)
Valid message

Invalid content line
Another invalid line

5 replies
View thread

User2  [12:01 PM](https://example.com)
Another valid message

:emoji:
count

System notification here`;

            const messages = intelligentParser.parse(mixedContent, false);
            
            const totalMessages = messages.length;
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            const namedMessages = messages.filter(m => m.username !== 'Unknown User');
            
            console.log(`Total messages parsed: ${totalMessages}`);
            console.log(`Unknown User messages: ${unknownUserMessages.length}`);
            console.log(`Named messages: ${namedMessages.length}`);
            console.log(`Unknown User percentage: ${((unknownUserMessages.length / totalMessages) * 100).toFixed(1)}%`);
            
            // Regression test: Unknown User percentage should be low
            const unknownUserPercentage = (unknownUserMessages.length / totalMessages) * 100;
            expect(unknownUserPercentage).toBeLessThan(20); // Less than 20% Unknown User messages
            
            // Should have some valid messages
            expect(namedMessages.length).toBeGreaterThan(0);
        });
    });
});