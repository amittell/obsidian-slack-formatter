import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { TestLogger } from '../helpers';

describe('Boundary Detection Validation Suite', () => {
    let intelligentParser: IntelligentMessageParser;
    let flexibleParser: FlexibleMessageParser;

    beforeEach(() => {
        intelligentParser = new IntelligentMessageParser(
            { debug: false },
            { userMap: {}, emojiMap: {} }
        );
        flexibleParser = new FlexibleMessageParser();
    });

    describe('Clear Message Boundaries', () => {
        it('should detect boundaries between distinct thread format messages', () => {
            const threadFormatContent = `User1  [12:00 PM](https://example.com/p1)
First message content

User2  [12:01 PM](https://example.com/p2)
Second message content

User3  [12:02 PM](https://example.com/p3)
Third message content`;

            const messages = intelligentParser.parse(threadFormatContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('First message');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('Second message');
            expect(messages[2].username).toBe('User3');
            expect(messages[2].text).toContain('Third message');
        });

        it('should detect boundaries between DM format messages', () => {
            const dmFormatContent = `Alex MittellAlex Mittell
  3:13 PM
First DM message

John DoeJohn Doe
  3:14 PM
Second DM message

Jane SmithJane Smith
  3:15 PM
Third DM message`;

            const messages = intelligentParser.parse(dmFormatContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('Alex Mittell');
            expect(messages[1].username).toBe('John Doe');
            expect(messages[2].username).toBe('Jane Smith');
        });
    });

    describe('Ambiguous Boundary Scenarios', () => {
        it('should handle messages with similar usernames correctly', () => {
            const similarUsernamesContent = `John  [12:00 PM](https://example.com/p1)
First message from John

John Smith  [12:01 PM](https://example.com/p2)
Message from John Smith

John  [12:02 PM](https://example.com/p3)
Another message from John`;

            const messages = intelligentParser.parse(similarUsernamesContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('John');
            expect(messages[1].username).toBe('John Smith');
            expect(messages[2].username).toBe('John');
        });

        it('should distinguish between user messages and continuation timestamps', () => {
            const continuationContent = `User1  [12:00 PM](https://example.com/p1)
Main message content
More content on next line

[12:01](https://example.com/p2)
This is a continuation message from same user

User2  [12:02 PM](https://example.com/p3)
New message from different user`;

            const messages = intelligentParser.parse(continuationContent, false);
            
            // Should recognize continuation and not create separate message
            expect(messages.length).toBe(2);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('Main message content');
            expect(messages[0].text).toContain('continuation message');
            expect(messages[1].username).toBe('User2');
        });

        it('should handle mixed format messages in same conversation', () => {
            const mixedFormatContent = `User1  [12:00 PM](https://example.com/p1)
Thread format message

Alex MittellAlex Mittell
  12:01 PM
DM format message

User3  [12:02 PM](https://example.com/p2)
Back to thread format`;

            const messages = intelligentParser.parse(mixedFormatContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('Alex Mittell');
            expect(messages[2].username).toBe('User3');
        });
    });

    describe('Complex Content Between Messages', () => {
        it('should handle reactions and metadata between messages', () => {
            const reactionsMetadataContent = `User1  [12:00 PM](https://example.com/p1)
First message
:thumbsup:
5
:heart:
3

User2  [12:01 PM](https://example.com/p2)
Second message
:laughing:
2

User3  [12:02 PM](https://example.com/p3)
Third message`;

            const messages = intelligentParser.parse(reactionsMetadataContent, false);
            
            expect(messages.length).toBe(3);
            
            // First message should include reactions
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('First message');
            
            // Reactions should be properly parsed
            expect(messages[0].reactions).toBeDefined();
            if (messages[0].reactions) {
                expect(messages[0].reactions.length).toBeGreaterThan(0);
            }
            
            expect(messages[1].username).toBe('User2');
            expect(messages[2].username).toBe('User3');
        });

        it('should handle thread metadata between messages', () => {
            const threadMetadataContent = `User1  [12:00 PM](https://example.com/p1)
Message with thread replies

13 replies
Last reply 2 hours agoView thread

User2  [12:01 PM](https://example.com/p2)
Next message

5 replies
View thread

User3  [12:02 PM](https://example.com/p3)
Another message`;

            const messages = intelligentParser.parse(threadMetadataContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
            expect(messages[2].username).toBe('User3');
            
            // Thread metadata should not create separate messages
            const threadMetadataMessages = messages.filter(m => 
                m.text?.includes('replies') || m.text?.includes('View thread')
            );
            expect(threadMetadataMessages.length).toBe(0);
        });

        it('should handle link previews between messages', () => {
            const linkPreviewContent = `User1  [12:00 PM](https://example.com/p1)
Check this out: https://github.com/example/repo

GitHub
example/repo
Example repository description

Language: TypeScript
Stars: 1.2k
Added by GitHub

User2  [12:01 PM](https://example.com/p2)
Thanks for sharing!`;

            const messages = intelligentParser.parse(linkPreviewContent, false);
            
            expect(messages.length).toBe(2);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('Check this out');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('Thanks for sharing');
        });
    });

    describe('Edge Case Boundaries', () => {
        it('should handle empty lines and whitespace correctly', () => {
            const whitespaceContent = `User1  [12:00 PM](https://example.com/p1)
First message


User2  [12:01 PM](https://example.com/p2)
Second message

   
User3  [12:02 PM](https://example.com/p3)
Third message`;

            const messages = intelligentParser.parse(whitespaceContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
            expect(messages[2].username).toBe('User3');
        });

        it('should handle messages with URLs that look like timestamps', () => {
            const urlTimestampContent = `User1  [12:00 PM](https://example.com/p1)
Check this link: https://example.com/archives/p1234567890123456

User2  [12:01 PM](https://example.com/p2)
And this one: https://slack.com/archives/C123/p1234567890.123456

User3  [12:02 PM](https://example.com/p3)
Normal message`;

            const messages = intelligentParser.parse(urlTimestampContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('Check this link');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('And this one');
            expect(messages[2].username).toBe('User3');
        });

        it('should handle malformed message boundaries gracefully', () => {
            const malformedContent = `User1  [12:00 PM](https://example.com/p1)
Valid message

Invalid line without proper format
Another invalid line

User2  [12:01 PM](https://example.com/p2)
Another valid message

Broken format [missing timestamp
More broken content

User3  [12:02 PM](https://example.com/p3)
Final valid message`;

            const messages = intelligentParser.parse(malformedContent, false);
            
            // Should still extract valid messages
            const validMessages = messages.filter(m => 
                m.username !== 'Unknown User' && m.username !== ''
            );
            expect(validMessages.length).toBeGreaterThanOrEqual(3);
            
            // Should identify User1, User2, User3
            const usernames = messages.map(m => m.username);
            expect(usernames).toContain('User1');
            expect(usernames).toContain('User2');
            expect(usernames).toContain('User3');
        });
    });

    describe('Overlapping Content Patterns', () => {
        it('should handle code blocks that span message boundaries', () => {
            const codeBlockContent = `User1  [12:00 PM](https://example.com/p1)
Here's some code:
\`\`\`javascript
function example() {
    TestLogger.log("hello");
}
\`\`\`

User2  [12:01 PM](https://example.com/p2)
And here's more:
\`\`\`python
def another():
    print("world")
\`\`\``;

            const messages = intelligentParser.parse(codeBlockContent, false);
            
            expect(messages.length).toBe(2);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('javascript');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('python');
        });

        it('should handle quoted text across boundaries', () => {
            const quotedTextContent = `User1  [12:00 PM](https://example.com/p1)
As they say:
> This is a quote
> that spans multiple lines
> and continues here

User2  [12:01 PM](https://example.com/p2)
I agree with that quote!`;

            const messages = intelligentParser.parse(quotedTextContent, false);
            
            expect(messages.length).toBe(2);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('quote');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('agree');
        });

        it('should handle lists and formatted content', () => {
            const listContent = `User1  [12:00 PM](https://example.com/p1)
Here's my list:
• Item 1
• Item 2
• Item 3

User2  [12:01 PM](https://example.com/p2)
My numbered list:
1. First item
2. Second item
3. Third item`;

            const messages = intelligentParser.parse(listContent, false);
            
            expect(messages.length).toBe(2);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('Item 1');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('First item');
        });
    });

    describe('Avatar and Media Boundary Handling', () => {
        it('should not treat avatar lines as message boundaries', () => {
            const avatarBoundaryContent = `User1  [12:00 PM](https://example.com/p1)
First message

![](https://ca.slack-edge.com/avatar1.jpg)

User2  [12:01 PM](https://example.com/p2)
Second message after avatar

![](https://ca.slack-edge.com/avatar2.jpg)

User3  [12:02 PM](https://example.com/p3)
Third message`;

            const messages = intelligentParser.parse(avatarBoundaryContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
            expect(messages[2].username).toBe('User3');
        });

        it('should handle media attachments between messages', () => {
            const mediaContent = `User1  [12:00 PM](https://example.com/p1)
Check out this image:

image.png
1.2 MB

User2  [12:01 PM](https://example.com/p2)
Nice photo!

video.mp4
5.7 MB

User3  [12:02 PM](https://example.com/p3)
Great video!`;

            const messages = intelligentParser.parse(mediaContent, false);
            
            expect(messages.length).toBe(3);
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
            expect(messages[2].username).toBe('User3');
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle large numbers of messages efficiently', () => {
            // Generate content with many messages
            const messageCount = 50;
            let largeContent = '';
            
            for (let i = 1; i <= messageCount; i++) {
                largeContent += `User${i}  [12:${i.toString().padStart(2, '0')} PM](https://example.com/p${i})\n`;
                largeContent += `Message ${i} content\n\n`;
            }

            const startTime = Date.now();
            const messages = intelligentParser.parse(largeContent, false);
            const endTime = Date.now();
            
            expect(messages.length).toBe(messageCount);
            const performanceThreshold = process.env.CI ? 10000 : 5000; // 10s in CI, 5s locally
            expect(endTime - startTime).toBeLessThan(performanceThreshold);
            
            // Verify all messages are distinct
            const usernames = messages.map(m => m.username);
            const uniqueUsernames = new Set(usernames);
            expect(uniqueUsernames.size).toBe(messageCount);
        });

        it('should handle deeply nested content structures', () => {
            const nestedContent = `User1  [12:00 PM](https://example.com/p1)
Main message with:
> Quoted content
> > Nested quote
> > > Deeply nested quote
> Back to regular quote
Regular content again

User2  [12:01 PM](https://example.com/p2)
Response to nested content`;

            const messages = intelligentParser.parse(nestedContent, false);
            
            expect(messages.length).toBe(2);
            expect(messages[0].username).toBe('User1');
            expect(messages[0].text).toContain('Main message');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('Response');
        });
    });

    describe('Boundary Detection Metrics', () => {
        it('should provide accurate boundary detection statistics', () => {
            const testContent = `User1  [12:00 PM](https://example.com/p1)
Message 1

User2  [12:01 PM](https://example.com/p2)
Message 2

[12:02](https://example.com/p3)
Continuation of Message 2

User3  [12:03 PM](https://example.com/p4)
Message 3`;

            const messages = intelligentParser.parse(testContent, false);
            
            const showStats = process.env.SHOW_BOUNDARY_STATS === 'true';
            if (showStats) {
                TestLogger.log(`Boundary Detection Results:`);
                TestLogger.log(`Total lines processed: ${testContent.split('\n').length}`);
                TestLogger.log(`Messages detected: ${messages.length}`);
                TestLogger.log(`Expected messages: 3`);
                TestLogger.log(`Boundary accuracy: ${messages.length === 3 ? 'PASS' : 'FAIL'}`);
            }
            
            expect(messages.length).toBe(3);
            
            // Verify message integrity
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
            expect(messages[1].text).toContain('Continuation');
            expect(messages[2].username).toBe('User3');
        });
    });
});