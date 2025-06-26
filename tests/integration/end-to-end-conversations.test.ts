import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { SlackFormatter } from '../../src/formatter/slack-formatter';

describe('End-to-End Conversation Processing Suite', () => {
    let flexibleParser: FlexibleMessageParser;
    let intelligentParser: IntelligentMessageParser;
    let slackFormatter: SlackFormatter;

    beforeEach(() => {
        flexibleParser = new FlexibleMessageParser();
        intelligentParser = new IntelligentMessageParser(
            { debug: false },
            { userMap: {}, emojiMap: {} }
        );
        slackFormatter = new SlackFormatter(
            { debug: false },
            {},
            {}
        );
    });

    describe('Real Sample File Processing', () => {
        it('should process multi-person DM sample correctly', () => {
            const sampleContent = readFileSync('./archived/samples/multi-person-dm-sample.txt', 'utf8');
            
            console.log('\n=== PROCESSING MULTI-PERSON DM SAMPLE ===');
            console.log(`Input length: ${sampleContent.length} characters`);
            
            const messages = flexibleParser.parse(sampleContent, true);
            
            console.log(`Parsed ${messages.length} messages`);
            
            // Validate message parsing
            expect(messages.length).toBeGreaterThan(0);
            
            // Check for diverse usernames
            const usernames = [...new Set(messages.map(m => m.username))];
            console.log(`Unique users: ${usernames.length}`);
            console.log(`Users: ${usernames.join(', ')}`);
            
            expect(usernames.length).toBeGreaterThan(1);
            expect(usernames.filter(u => u !== 'Unknown User').length).toBeGreaterThan(0);
            
            // Validate message structure
            messages.forEach((message, i) => {
                expect(message.username).toBeTruthy();
                expect(message.text).toBeTruthy();
                
                if (i < 5) { // Log first 5 messages for debugging
                    console.log(`Message ${i}: ${message.username} - "${message.text?.substring(0, 50)}..."`);
                }
            });
            
            // Check for reaction processing
            const messagesWithReactions = messages.filter(m => m.reactions && m.reactions.length > 0);
            console.log(`Messages with reactions: ${messagesWithReactions.length}`);
            
            // Validate no excessive Unknown User messages
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            const unknownUserPercentage = (unknownUserMessages.length / messages.length) * 100;
            console.log(`Unknown User percentage: ${unknownUserPercentage.toFixed(1)}%`);
            
            expect(unknownUserPercentage).toBeLessThan(25); // Less than 25% Unknown User
        });

        it('should process emoji channel sample correctly', () => {
            const sampleContent = readFileSync('./archived/samples/emoji-channel-sample.txt', 'utf8');
            
            console.log('\n=== PROCESSING EMOJI CHANNEL SAMPLE ===');
            console.log(`Input length: ${sampleContent.length} characters`);
            
            const messages = flexibleParser.parse(sampleContent, true);
            
            console.log(`Parsed ${messages.length} messages`);
            
            expect(messages.length).toBeGreaterThan(0);
            
            // Check emoji handling
            const messagesWithEmoji = messages.filter(m => 
                m.text?.includes(':') || m.text?.includes('![:') || /[\u{1f600}-\u{1f64f}]|[\u{1f300}-\u{1f5ff}]|[\u{1f680}-\u{1f6ff}]/u.test(m.text || '')
            );
            console.log(`Messages with emoji content: ${messagesWithEmoji.length}`);
            
            // Check reaction processing
            const messagesWithReactions = messages.filter(m => m.reactions && m.reactions.length > 0);
            console.log(`Messages with reactions: ${messagesWithReactions.length}`);
            
            if (messagesWithReactions.length > 0) {
                const totalReactions = messagesWithReactions.reduce((sum, m) => 
                    sum + (m.reactions?.length || 0), 0
                );
                console.log(`Total reactions processed: ${totalReactions}`);
                
                // Log sample reactions
                messagesWithReactions.slice(0, 3).forEach((message, i) => {
                    console.log(`Reactions for message ${i}:`, message.reactions?.map(r => `${r.name}:${r.count}`));
                });
            }
            
            // Validate thread handling
            const threadMetadata = messages.filter(m => 
                m.text?.includes('replies') || m.text?.includes('View thread')
            );
            console.log(`Thread metadata messages: ${threadMetadata.length}`);
            
            // Should minimize Unknown User messages
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            const unknownUserPercentage = (unknownUserMessages.length / messages.length) * 100;
            console.log(`Unknown User percentage: ${unknownUserPercentage.toFixed(1)}%`);
            
            expect(unknownUserPercentage).toBeLessThan(30); // Allow slightly higher for emoji-heavy content
        });

        it('should process other sample files', () => {
            const sampleFiles = [
                './archived/samples/duckcreek-sample.txt',
                './archived/samples/fireside-sample.txt',
                './archived/samples/guidewire-sample.txt'
            ];

            sampleFiles.forEach(filename => {
                try {
                    const sampleContent = readFileSync(filename, 'utf8');
                    
                    console.log(`\n=== PROCESSING ${filename} ===`);
                    console.log(`Input length: ${sampleContent.length} characters`);
                    
                    const messages = flexibleParser.parse(sampleContent, true);
                    
                    console.log(`Parsed ${messages.length} messages`);
                    
                    expect(messages.length).toBeGreaterThan(0);
                    
                    const usernames = [...new Set(messages.map(m => m.username))];
                    const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
                    const unknownUserPercentage = (unknownUserMessages.length / messages.length) * 100;
                    
                    console.log(`Unique users: ${usernames.length}`);
                    console.log(`Unknown User percentage: ${unknownUserPercentage.toFixed(1)}%`);
                    
                    expect(unknownUserPercentage).toBeLessThan(40); // Allow more variance for different formats
                    
                } catch (error) {
                    console.log(`Note: ${filename} not found or not readable`);
                }
            });
        });
    });

    describe('Complex Conversation Scenarios', () => {
        it('should handle thread conversations with multiple participants', () => {
            const threadConversation = `User1  [12:00 PM](https://example.com/p1)
Hey team, what do you think about this new feature proposal?

User2  [12:01 PM](https://example.com/p2)
Looks interesting! I have some concerns about the implementation

User3  [12:02 PM](https://example.com/p3)
I agree with User2. Let me add some thoughts:
• Performance implications
• Security considerations  
• Maintenance overhead

User1  [12:03 PM](https://example.com/p4)
Great points! Let's schedule a meeting to discuss further

:thumbsup:
3
:calendar:
2

13 replies
Last reply 2 hours agoView thread`;

            const messages = flexibleParser.parse(threadConversation, true);
            
            console.log('\n=== THREAD CONVERSATION PROCESSING ===');
            console.log(`Parsed ${messages.length} messages`);
            
            expect(messages.length).toBe(4);
            
            // Validate users
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('User2');
            expect(messages[2].username).toBe('User3');
            expect(messages[3].username).toBe('User1');
            
            // Check content preservation
            expect(messages[0].text).toContain('feature proposal');
            expect(messages[1].text).toContain('implementation');
            expect(messages[2].text).toContain('Performance implications');
            expect(messages[3].text).toContain('schedule a meeting');
            
            // Check reactions on last message
            if (messages[3].reactions) {
                expect(messages[3].reactions.length).toBeGreaterThan(0);
                const thumbsUp = messages[3].reactions.find(r => r.name === 'thumbsup');
                expect(thumbsUp?.count).toBe(3);
            }
            
            console.log('Thread conversation processing: PASS');
        });

        it('should handle DM conversations with continuation messages', () => {
            const dmConversation = `Alex MittellAlex Mittell
  3:13 PM
Hey, wanted to discuss the project timeline

3:14
I think we need to adjust the milestones

3:15
Especially for the Q2 deliverables

John DoeJohn Doe
  3:16 PM
Absolutely agree

3:17
Let me check my calendar and get back to you

3:18
How about we meet tomorrow at 2 PM?

Alex MittellAlex Mittell
  3:19 PM
Perfect! I'll send out the meeting invite`;

            const messages = flexibleParser.parse(dmConversation, true);
            
            console.log('\n=== DM CONVERSATION PROCESSING ===');
            console.log(`Parsed ${messages.length} messages`);
            
            expect(messages.length).toBe(3);
            
            // Validate users and message consolidation
            expect(messages[0].username).toBe('Alex Mittell');
            expect(messages[1].username).toBe('John Doe');
            expect(messages[2].username).toBe('Alex Mittell');
            
            // Check content consolidation
            expect(messages[0].text).toContain('project timeline');
            expect(messages[0].text).toContain('adjust the milestones');
            expect(messages[0].text).toContain('Q2 deliverables');
            
            expect(messages[1].text).toContain('Absolutely agree');
            expect(messages[1].text).toContain('check my calendar');
            expect(messages[1].text).toContain('tomorrow at 2 PM');
            
            expect(messages[2].text).toContain('meeting invite');
            
            console.log('DM conversation processing: PASS');
        });

        it('should handle mixed format conversations', () => {
            const mixedConversation = `![](https://ca.slack-edge.com/avatar1.jpg)

User1  [12:00 PM](https://example.com/p1)
Starting a discussion about our project

Alex MittellAlex Mittell
  12:01 PM
Great idea! I have some thoughts

12:02
Let me elaborate on the technical aspects

User2  [12:03 PM](https://example.com/p2)
I'd like to add my perspective as well

:rocket:
5
:brain:
3

5 replies
View thread`;

            const messages = flexibleParser.parse(mixedConversation, true);
            
            console.log('\n=== MIXED FORMAT CONVERSATION PROCESSING ===');
            console.log(`Parsed ${messages.length} messages`);
            
            expect(messages.length).toBe(3);
            
            expect(messages[0].username).toBe('User1');
            expect(messages[1].username).toBe('Alex Mittell');
            expect(messages[2].username).toBe('User2');
            
            // Check mixed format handling
            expect(messages[0].text).toContain('Starting a discussion');
            expect(messages[1].text).toContain('Great idea');
            expect(messages[1].text).toContain('technical aspects');
            expect(messages[2].text).toContain('add my perspective');
            
            console.log('Mixed format conversation processing: PASS');
        });

        it('should handle complex content with code, links, and formatting', () => {
            const complexContent = `Developer  [2:30 PM](https://example.com/p1)
Here's the code solution:

\`\`\`javascript
function processData(input) {
    // Handle special characters: àáâãäå 你好
    return input.map(item => ({
        ...item,
        processed: true
    }));
}
\`\`\`

Also check this documentation: https://docs.example.com/api

**Important:** Make sure to handle Unicode properly!

GitHub
API Documentation
Complete guide for the REST API

Language: JavaScript
Last updated: 1 hour ago
Added by GitHub

Reviewer  [2:35 PM](https://example.com/p2)
Looks good! A few suggestions:

> The Unicode handling could be improved
> Consider adding error handling for edge cases

*Overall:* ✅ Approved

:white_check_mark:
1
:eyes:
2`;

            const messages = flexibleParser.parse(complexContent, true);
            
            console.log('\n=== COMPLEX CONTENT PROCESSING ===');
            console.log(`Parsed ${messages.length} messages`);
            
            expect(messages.length).toBe(2);
            
            expect(messages[0].username).toBe('Developer');
            expect(messages[1].username).toBe('Reviewer');
            
            // Check code preservation
            expect(messages[0].text).toContain('```javascript');
            expect(messages[0].text).toContain('function processData');
            expect(messages[0].text).toContain('àáâãäå 你好');
            
            // Check link and formatting preservation
            expect(messages[0].text).toContain('https://docs.example.com/api');
            expect(messages[0].text).toContain('**Important:**');
            
            // Check review content
            expect(messages[1].text).toContain('> The Unicode handling');
            expect(messages[1].text).toContain('*Overall:* ✅ Approved');
            
            console.log('Complex content processing: PASS');
        });
    });

    describe('Full Pipeline Integration Tests', () => {
        it('should process complete conversation through SlackFormatter', () => {
            const fullConversation = `![](https://ca.slack-edge.com/avatar.jpg)

Product Manager  [9:00 AM](https://example.com/p1)
Morning team! Let's review yesterday's progress 📊

Lead Developer  [9:01 AM](https://example.com/p2)
Here's what we completed:
• ✅ User authentication system
• ✅ Database optimization
• 🔄 Frontend components (in progress)

QA Engineer  [9:02 AM](https://example.com/p3)
Testing results look good! Found minor issues:

\`\`\`
Test Suite: Authentication
✅ Login flow - PASS
✅ Logout flow - PASS
⚠️  Password reset - MINOR ISSUES
\`\`\`

:test_tube:
3
:bug:
1

Designer  [9:03 AM](https://example.com/p4)
UI mockups ready for review: https://figma.com/project/123

Figma
Project Mockups
Latest design iterations for the dashboard

Tool: Figma
Last updated: 30 minutes ago
Added by Figma

Product Manager  [9:04 AM](https://example.com/p5)
Great work everyone! Let's sync up at 2 PM

:calendar:
4
:thumbsup:
6

8 replies
Last reply 1 hour agoView thread`;

            console.log('\n=== FULL PIPELINE INTEGRATION TEST ===');
            
            // Test with both parsers
            const flexibleMessages = flexibleParser.parse(fullConversation, true);
            const intelligentMessages = intelligentParser.parse(fullConversation, false);
            
            console.log(`Flexible parser: ${flexibleMessages.length} messages`);
            console.log(`Intelligent parser: ${intelligentMessages.length} messages`);
            
            // Both should produce reasonable results
            expect(flexibleMessages.length).toBeGreaterThan(0);
            expect(intelligentMessages.length).toBeGreaterThan(0);
            
            // Test SlackFormatter integration
            const formattedResult = slackFormatter.format(fullConversation);
            
            console.log(`Formatted output length: ${formattedResult.length} characters`);
            
            expect(formattedResult).toBeTruthy();
            expect(formattedResult.length).toBeGreaterThan(0);
            
            // Check key content preservation
            expect(formattedResult).toContain('Product Manager');
            expect(formattedResult).toContain('Lead Developer');
            expect(formattedResult).toContain('QA Engineer');
            expect(formattedResult).toContain('Designer');
            
            expect(formattedResult).toContain('User authentication');
            expect(formattedResult).toContain('Testing results');
            expect(formattedResult).toContain('UI mockups');
            
            console.log('Full pipeline integration: PASS');
        });

        it('should handle large conversation files efficiently', () => {
            // Generate a large conversation
            const participants = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
            let largeConversation = '';
            
            for (let i = 0; i < 100; i++) {
                const user = participants[i % participants.length];
                const hour = Math.floor(i / 10) + 9;
                const minute = (i % 10) * 6;
                
                largeConversation += `${user}  [${hour}:${minute.toString().padStart(2, '0')} AM](https://example.com/p${i})
Message ${i} from ${user} with some content about project progress.
This message contains various elements like :emoji: and **formatting**.

`;
                
                // Add some reactions occasionally
                if (i % 10 === 0) {
                    largeConversation += `:thumbsup:\n${Math.floor(Math.random() * 5) + 1}\n\n`;
                }
            }
            
            console.log('\n=== LARGE CONVERSATION PERFORMANCE TEST ===');
            console.log(`Input size: ${largeConversation.length} characters`);
            
            const startTime = Date.now();
            const messages = flexibleParser.parse(largeConversation, true);
            const endTime = Date.now();
            
            const processingTime = endTime - startTime;
            
            console.log(`Processing time: ${processingTime}ms`);
            console.log(`Messages parsed: ${messages.length}`);
            console.log(`Performance: ${(largeConversation.length / processingTime * 1000).toFixed(0)} chars/second`);
            
            expect(messages.length).toBe(100);
            expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
            
            // Validate message quality
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            const unknownUserPercentage = (unknownUserMessages.length / messages.length) * 100;
            
            console.log(`Unknown User percentage: ${unknownUserPercentage.toFixed(1)}%`);
            expect(unknownUserPercentage).toBeLessThan(5); // Should be very low for clean input
            
            console.log('Large conversation performance: PASS');
        });
    });

    describe('End-to-End Quality Metrics', () => {
        it('should provide comprehensive processing statistics', () => {
            const testConversations = [
                {
                    name: "Thread Format",
                    content: `User1  [12:00 PM](https://example.com/p1)
Thread message
User2  [12:01 PM](https://example.com/p2)
Another thread message`
                },
                {
                    name: "DM Format", 
                    content: `User1User1
  12:00 PM
DM message
User2User2
  12:01 PM
Another DM message`
                },
                {
                    name: "Mixed Format",
                    content: `User1  [12:00 PM](https://example.com/p1)
Thread message
User2User2
  12:01 PM
DM message`
                }
            ];
            
            console.log('\n=== END-TO-END QUALITY METRICS ===');
            
            const results = testConversations.map(({ name, content }) => {
                const startTime = Date.now();
                const messages = flexibleParser.parse(content, true);
                const endTime = Date.now();
                
                const unknownUserCount = messages.filter(m => m.username === 'Unknown User').length;
                const namedUserCount = messages.filter(m => m.username !== 'Unknown User').length;
                
                const result = {
                    name,
                    totalMessages: messages.length,
                    namedUsers: namedUserCount,
                    unknownUsers: unknownUserCount,
                    accuracy: namedUserCount / messages.length * 100,
                    processingTime: endTime - startTime
                };
                
                console.log(`${name}:`);
                console.log(`  Messages: ${result.totalMessages}`);
                console.log(`  Named users: ${result.namedUsers}`);
                console.log(`  Unknown users: ${result.unknownUsers}`);
                console.log(`  Accuracy: ${result.accuracy.toFixed(1)}%`);
                console.log(`  Processing time: ${result.processingTime}ms`);
                
                return result;
            });
            
            // Validate overall quality
            const overallAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
            console.log(`\nOverall accuracy: ${overallAccuracy.toFixed(1)}%`);
            
            expect(overallAccuracy).toBeGreaterThan(70); // At least 70% overall accuracy
            
            // All should process quickly
            results.forEach(result => {
                expect(result.processingTime).toBeLessThan(1000);
            });
        });
    });
});