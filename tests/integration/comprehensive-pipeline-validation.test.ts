import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { StandardFormatStrategy } from '../../src/formatter/strategies/standard-format-strategy';
import { SlackMessage } from '../../src/models';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { TestLogger } from '../helpers';

describe('Comprehensive Formatting Pipeline Validation', () => {
    let intelligentParser: IntelligentMessageParser;
    let slackFormatter: SlackFormatter;
    let standardFormatStrategy: StandardFormatStrategy;

    // Complete Clay conversation data from original failing cases
    const rawClayConversation = `Owen Chandler
Owen Chandler
  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421707955479)
We are trying to leverage the Gong integration to identify the longest monologue by a sales rep. The way Gong tracks longest monologue is inaccurate because even if a prospect coughs, it ends the monologue. We have tried for hours using a prompt to analyze the transcript to better identify longest monologue and it's still inaccurate (but much closer to gong). Does anyone have any suggestions/ideas on how we can achieve this? (prompt in thread)
8 replies



Owen Chandler
Owen Chandler
  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421713437949?thread_ts=1749421707.955479&cid=C025XGWSYTX)
#CONTEXT#
You're finding the rep's longest monologue in a transcript. A monologue only ends if the prospect speaks for ≥10 seconds.
#OBJECTIVE#
Analyze the call transcript and return the rep's longest uninterrupted monologue, following the specified rules.
#INSTRUCTIONS#
1. Analyze the /f_0sxfv1exQCiSZErKsV5.transcript .
2. Clearly identify every segment of continuous rep speech. Continuous rep speech is broken only by prospect interruptions lasting 10 seconds or more.
3. For every prospect interruption that occurs between rep speech segments, explicitly identify:
Interruption timestamp (start and end)
Exact interruption duration in seconds
4. Calculate whether the interruption breaks (≥10 seconds) or does not break (<10 seconds) the monologue.
If the monologue was ≥10 seconds, treat that as a break and start a new rep segment after the prospect finishes talking.
If the monologue was not broken, ignore the interruption and continue counting the rep's monologue.
5. Repeat the process until the end of the call.
6. Identify and return the rep's longest monologue, including its duration in seconds.
7. Output only the monologue's duration in the specified format.
#EXAMPLES#
Input: Transcript with alternating rep and prospect turns, with some prospect turns under and some over 10 seconds.
Expected Output:
DurationSeconds: [120]



 (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421722136699?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Hi there, thanks so much for sharing this! We'll be passing your feedback along to our product team, and any additional context you can provide will help us prioritize with your needs in mind as we shape the roadmap.

If there are specific use cases, workflows, or challenges where these suggestions would make a big difference, feel free to share—we'd love to hear more. Otherwise, we'll plan to close this ticket soon and review your input offline.

6:28 (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421722956409?thread_ts=1749421707.955479&cid=C025XGWSYTX)
All set, close this ticket out
I want to chat with support

6:28 (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421723822739?thread_ts=1749421707.955479&cid=C025XGWSYTX)
All set, close this ticket out
I want to chat with support



Jorge Macias
Jorge Macias
  Jun 9th at 12:12 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749485545080789?thread_ts=1749421707.955479&cid=C025XGWSYTX)
easy, tell prospects to never cough on a call 



https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 9th at 12:13 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749485617350569?thread_ts=1749421707.955479&cid=C025XGWSYTX)
All set, close this ticket out
I want to chat with support



 (https://app.slack.com/team/U07NFV9BD5L)Bo (Clay)
Bo (Clay)
  Jun 10th at 2:22 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749579776247889?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Hey,
That's a tricky problem with analyzing speech patterns. A few ideas that might help improve accuracy:
Try a different approach with the prompt:
* Break it into steps: first identify all speaker segments with timestamps and extract them with Formula, then calculate durations, then apply the 10-seco…
See more

Have you tried testing it on a known transcript where you manually verified the longest monologue?
Let me know if you have more questions.



 (https://app.slack.com/team/U071Z6NQW4U)Channeled
Channeled
APP  Jun 10th at 2:24 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749579853655949?thread_ts=1749421707.955479&cid=C025XGWSYTX)
This thread was picked up by our in-app web widget and will no longer sync to Slack. If you are the original poster, you can continue this conversation by logging into https://app.clay.com (https://app.clay.com/) and clicking "Support" in the sidebar. If you're not the original poster and require help from support, please post in #02___support (https://clayrunhq.slack.com/archives/C025KSBLPGX).`;

    beforeEach(() => {
        const settings = { ...DEFAULT_SETTINGS, debug: false };
        const parsedMaps = { userMap: {}, emojiMap: {} };
        
        intelligentParser = new IntelligentMessageParser(
            settings,
            parsedMaps
        );
        slackFormatter = new SlackFormatter(
            settings,
            parsedMaps.userMap,
            parsedMaps.emojiMap
        );
        standardFormatStrategy = new StandardFormatStrategy(settings, parsedMaps);
    });

    describe('Stage 1: Parsing Validation', () => {
        it('should parse Clay conversation without Unknown User regression', () => {
            TestLogger.log('\n=== STAGE 1: PARSING VALIDATION ===');
            TestLogger.log(`Input text length: ${rawClayConversation.length} characters`);
            
            const messages = intelligentParser.parse(rawClayConversation, false);
            
            TestLogger.log(`Total messages detected: ${messages.length}`);
            
            // Log each detected message for verification
            messages.forEach((message, index) => {
                const preview = message.text?.substring(0, 60).replace(/\n/g, ' ') || '';
                TestLogger.log(`Message ${index + 1}: "${message.username}" - "${preview}..."`);
            });
            
            // CRITICAL: Count Unknown User messages
            const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
            const unknownUserCount = unknownUserMessages.length;
            
            TestLogger.log(`\n❌ Unknown User messages: ${unknownUserCount}`);
            
            if (unknownUserCount > 0) {
                TestLogger.log('REGRESSION DETECTED - Unknown User messages:');
                unknownUserMessages.forEach((msg, i) => {
                    TestLogger.log(`  Unknown User ${i + 1}: "${msg.text?.substring(0, 100)}..."`);
                });
            }
            
            // Expected users based on the conversation
            const expectedUsers = ['Owen Chandler', 'Clay', 'Jorge Macias', 'Bo (Clay)', 'Channeled'];
            const detectedUsers = [...new Set(messages.map(m => m.username))];
            
            TestLogger.log(`\nExpected users: ${expectedUsers.join(', ')}`);
            TestLogger.log(`Detected users: ${detectedUsers.join(', ')}`);
            
            // Validate message count (should be 6-8 messages based on conversation structure)
            expect(messages.length).toBeGreaterThanOrEqual(6);
            expect(messages.length).toBeLessThanOrEqual(8);
            
            // CRITICAL: No Unknown User regression
            expect(unknownUserCount).toBe(0);
            
            // Validate key users are detected
            expect(messages.some(m => m.username === 'Owen Chandler')).toBe(true);
            expect(messages.some(m => m.username === 'Clay')).toBe(true);
            expect(messages.some(m => m.username === 'Jorge Macias')).toBe(true);
            expect(messages.some(m => m.username === 'Bo (Clay)')).toBe(true);
            expect(messages.some(m => m.username === 'Channeled')).toBe(true);
            
            TestLogger.log('✅ STAGE 1 PASSED: Parsing without Unknown User regression');
        });

        it('should properly separate message content', () => {
            TestLogger.log('\n=== MESSAGE CONTENT SEPARATION VALIDATION ===');
            
            const messages = intelligentParser.parse(rawClayConversation, false);
            
            // Check that Owen's two messages are separate
            const owenMessages = messages.filter(m => m.username === 'Owen Chandler');
            expect(owenMessages.length).toBeGreaterThanOrEqual(2);
            
            TestLogger.log(`Owen Chandler messages detected: ${owenMessages.length}`);
            owenMessages.forEach((msg, i) => {
                const preview = msg.text?.substring(0, 50).replace(/\n/g, ' ') || '';
                TestLogger.log(`  Owen message ${i + 1}: "${preview}..."`);
            });
            
            // Check that the first Owen message contains Gong content
            const firstOwenMessage = owenMessages.find(m => m.text?.includes('Gong integration'));
            expect(firstOwenMessage).toBeTruthy();
            
            // Check that the second Owen message contains CONTEXT content
            const secondOwenMessage = owenMessages.find(m => m.text?.includes('#CONTEXT#'));
            expect(secondOwenMessage).toBeTruthy();
            
            // Ensure they're separate messages (no content mixing)
            expect(firstOwenMessage?.text).not.toContain('#CONTEXT#');
            expect(secondOwenMessage?.text).not.toContain('Gong integration');
            
            TestLogger.log('✅ MESSAGE SEPARATION VALIDATED: Owen messages properly separated');
        });
    });

    describe('Stage 2: Full Pipeline Formatting', () => {
        it('should format the complete conversation correctly through SlackFormatter', () => {
            TestLogger.log('\n=== STAGE 2: FULL PIPELINE FORMATTING ===');
            
            const formattedOutput = slackFormatter.formatSlackContent(rawClayConversation);
            
            TestLogger.log(`Formatted output length: ${formattedOutput.length} characters`);
            
            // Save formatted output for inspection
            const fs = require('fs');
            const path = require('path');
            fs.writeFileSync(
                path.join(__dirname, 'comprehensive-pipeline-output.md'), 
                formattedOutput
            );
            TestLogger.log('Formatted output saved to: comprehensive-pipeline-output.md');
            
            // Basic validation
            expect(formattedOutput).toBeTruthy();
            expect(formattedOutput.length).toBeGreaterThan(0);
            
            // Should contain all expected users in formatted output
            expect(formattedOutput).toContain('Owen Chandler');
            expect(formattedOutput).toContain('Clay');
            expect(formattedOutput).toContain('Jorge Macias');
            expect(formattedOutput).toContain('Bo (Clay)');
            expect(formattedOutput).toContain('Channeled');
            
            // Should contain key content pieces
            expect(formattedOutput).toContain('Gong integration');
            expect(formattedOutput).toContain('#CONTEXT#');
            expect(formattedOutput).toContain('never cough on a call');
            expect(formattedOutput).toContain('tricky problem');
            expect(formattedOutput).toContain('web widget');
            
            // CRITICAL: Should NOT contain Unknown User in formatted output
            expect(formattedOutput).not.toContain('Unknown User');
            
            TestLogger.log('✅ STAGE 2 PASSED: Complete pipeline formatting successful');
        });

        it('should generate proper callout formatting with BaseFormatStrategy', () => {
            TestLogger.log('\n=== CALLOUT FORMATTING VALIDATION ===');
            
            // First parse the messages
            const messages = intelligentParser.parse(rawClayConversation, false);
            
            // Then format using StandardFormatStrategy
            const formattedOutput = standardFormatStrategy.formatToMarkdown(messages);
            
            TestLogger.log(`StandardFormatStrategy output length: ${formattedOutput.length} characters`);
            
            // Count callout headers
            const calloutHeaders = (formattedOutput.match(/> \[!slack\]\+/g) || []).length;
            TestLogger.log(`Callout headers found: ${calloutHeaders}`);
            
            // Should have proper callout formatting
            expect(formattedOutput).toContain('> [!slack]+');
            
            // Should have proper message separators
            const messageSeparators = (formattedOutput.match(/\n\n---\n\n/g) || []).length;
            TestLogger.log(`Message separators found: ${messageSeparators}`);
            
            // Should have at least 4-5 separators for 5-6 messages
            expect(messageSeparators).toBeGreaterThanOrEqual(4);
            
            // Split into message blocks for analysis
            const messageBlocks = formattedOutput.split(/\n\n---\n\n/);
            TestLogger.log(`Message blocks detected: ${messageBlocks.length}`);
            
            messageBlocks.forEach((block, index) => {
                const lines = block.trim().split('\n');
                const firstLine = lines[0] || '';
                const hasCalloutHeader = firstLine.includes('> [!slack]+');
                
                TestLogger.log(`Block ${index + 1}:`);
                TestLogger.log(`  Has callout header: ${hasCalloutHeader}`);
                TestLogger.log(`  First line: "${firstLine.substring(0, 60)}..."`);
                TestLogger.log(`  Total lines: ${lines.length}`);
                
                // Each block should have a callout header
                expect(hasCalloutHeader).toBe(true);
            });
            
            TestLogger.log('✅ CALLOUT FORMATTING VALIDATED: Proper > [!slack]+ headers generated');
        });
    });

    describe('Stage 3: Content Integrity Validation', () => {
        it('should preserve all content without truncation or corruption', () => {
            TestLogger.log('\n=== STAGE 3: CONTENT INTEGRITY VALIDATION ===');
            
            const formattedOutput = slackFormatter.formatSlackContent(rawClayConversation);
            
            // Key content pieces that should be preserved
            const criticalContent = [
                'Gong integration',
                'longest monologue',
                'prospect coughs',
                '#CONTEXT#',
                '#OBJECTIVE#', 
                '#INSTRUCTIONS#',
                'DurationSeconds: [120]',
                'thanks so much for sharing',
                'never cough on a call',
                'That\'s a tricky problem',
                'web widget',
                'original poster'
            ];
            
            TestLogger.log('Checking critical content preservation:');
            criticalContent.forEach(content => {
                const found = formattedOutput.includes(content);
                TestLogger.log(`  "${content}": ${found ? '✅' : '❌'}`);
                expect(formattedOutput).toContain(content);
            });
            
            // Check that long content sections are not truncated
            const owenLongMessage = formattedOutput.match(/You're finding the rep's longest monologue[\s\S]*?DurationSeconds: \[120\]/);
            expect(owenLongMessage).toBeTruthy();
            
            const boLongMessage = formattedOutput.match(/That's a tricky problem[\s\S]*?Let me know if you have more questions/);
            expect(boLongMessage).toBeTruthy();
            
            TestLogger.log('✅ CONTENT INTEGRITY VALIDATED: All critical content preserved');
        });

        it('should maintain proper username attribution throughout', () => {
            TestLogger.log('\n=== USERNAME ATTRIBUTION VALIDATION ===');
            
            const formattedOutput = slackFormatter.formatSlackContent(rawClayConversation);
            
            // Extract all username mentions from the formatted output
            const usernameMatches = formattedOutput.match(/>\s*\*\*([^*]+)\*\*/g) || [];
            const extractedUsernames = usernameMatches.map(match => 
                match.replace(/>\s*\*\*/, '').replace(/\*\*/, '')
            );
            
            TestLogger.log('Usernames found in formatted output:');
            extractedUsernames.forEach((username, index) => {
                TestLogger.log(`  ${index + 1}. "${username}"`);
            });
            
            // Should contain all expected users
            const expectedUsers = ['Owen Chandler', 'Clay', 'Jorge Macias', 'Bo (Clay)', 'Channeled'];
            expectedUsers.forEach(expectedUser => {
                const found = extractedUsernames.some(extracted => 
                    extracted.includes(expectedUser) || expectedUser.includes(extracted)
                );
                TestLogger.log(`Expected user "${expectedUser}": ${found ? '✅' : '❌'}`);
                expect(found).toBe(true);
            });
            
            // Should NOT contain Unknown User
            const hasUnknownUser = extractedUsernames.some(username => 
                username.includes('Unknown User')
            );
            expect(hasUnknownUser).toBe(false);
            
            TestLogger.log('✅ USERNAME ATTRIBUTION VALIDATED: All users properly attributed');
        });
    });

    describe('Stage 4: Regression Prevention', () => {
        it('should handle problematic Clay APP format without creating Unknown User', () => {
            TestLogger.log('\n=== CLAY APP FORMAT REGRESSION TEST ===');
            
            // Test the specific problematic format that was causing Unknown User
            const problematicClayFormat = ` (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421722136699?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Hi there, thanks so much for sharing this!`;
            
            const messages = intelligentParser.parse(problematicClayFormat, false);
            
            TestLogger.log(`Clay APP format - Messages detected: ${messages.length}`);
            messages.forEach((msg, i) => {
                TestLogger.log(`  Message ${i + 1}: "${msg.username}" - "${msg.text?.substring(0, 50)}..."`);
            });
            
            // Should parse as exactly 1 message
            expect(messages.length).toBe(1);
            
            // Should NOT be Unknown User
            expect(messages[0].username).not.toBe('Unknown User');
            
            // Should be identified as Clay
            expect(messages[0].username.toLowerCase()).toContain('clay');
            
            // Should contain the message content
            expect(messages[0].text).toContain('Hi there, thanks so much');
            
            TestLogger.log('✅ CLAY APP FORMAT REGRESSION PREVENTED');
        });

        it('should handle complex timestamp patterns without content merging', () => {
            TestLogger.log('\n=== TIMESTAMP PATTERN REGRESSION TEST ===');
            
            // Test complex timestamp patterns that were causing content merging
            const complexTimestampFormat = `Owen Chandler
Owen Chandler
  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421707955479)
First message content

Owen Chandler
Owen Chandler
  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421713437949?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Second message content`;
            
            const messages = intelligentParser.parse(complexTimestampFormat, false);
            
            TestLogger.log(`Complex timestamp - Messages detected: ${messages.length}`);
            messages.forEach((msg, i) => {
                TestLogger.log(`  Message ${i + 1}: "${msg.username}" - "${msg.text?.substring(0, 30)}..."`);
            });
            
            // Should detect 2 separate Owen messages
            expect(messages.length).toBe(2);
            
            // Both should be Owen Chandler
            expect(messages[0].username).toBe('Owen Chandler');
            expect(messages[1].username).toBe('Owen Chandler');
            
            // Content should be separate
            expect(messages[0].text).toContain('First message');
            expect(messages[0].text).not.toContain('Second message');
            
            expect(messages[1].text).toContain('Second message');
            expect(messages[1].text).not.toContain('First message');
            
            TestLogger.log('✅ TIMESTAMP PATTERN REGRESSION PREVENTED');
        });
    });

    describe('Stage 5: Performance and Quality Metrics', () => {
        it('should maintain acceptable performance with the complete pipeline', () => {
            TestLogger.log('\n=== PERFORMANCE VALIDATION ===');
            
            const iterations = 5;
            const times: number[] = [];
            
            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                const formattedOutput = slackFormatter.formatSlackContent(rawClayConversation);
                const endTime = Date.now();
                
                times.push(endTime - startTime);
                
                // Validate results are consistent
                expect(formattedOutput).toBeTruthy();
                expect(formattedOutput).not.toContain('Unknown User');
            }
            
            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);
            
            TestLogger.log(`Performance metrics:`);
            TestLogger.log(`  Average time: ${avgTime.toFixed(1)}ms`);
            TestLogger.log(`  Min time: ${minTime}ms`);
            TestLogger.log(`  Max time: ${maxTime}ms`);
            TestLogger.log(`  Processing rate: ${(rawClayConversation.length / avgTime * 1000).toFixed(0)} chars/second`);
            
            // Performance should be reasonable
            expect(avgTime).toBeLessThan(500); // 500ms max average
            expect(maxTime).toBeLessThan(1000); // 1 second max
            
            TestLogger.log('✅ PERFORMANCE VALIDATED: Acceptable processing times');
        });

        it('should generate a comprehensive quality report', () => {
            TestLogger.log('\n=== COMPREHENSIVE QUALITY REPORT ===');
            
            // Parse and format
            const messages = intelligentParser.parse(rawClayConversation, false);
            const formattedOutput = slackFormatter.formatSlackContent(rawClayConversation);
            
            // Generate comprehensive report
            const report = {
                input: {
                    length: rawClayConversation.length,
                    lines: rawClayConversation.split('\n').length
                },
                parsing: {
                    messagesDetected: messages.length,
                    uniqueUsers: [...new Set(messages.map(m => m.username))].length,
                    unknownUserMessages: messages.filter(m => m.username === 'Unknown User').length,
                    users: [...new Set(messages.map(m => m.username))]
                },
                formatting: {
                    outputLength: formattedOutput.length,
                    calloutHeaders: (formattedOutput.match(/> \[!slack\]\+/g) || []).length,
                    messageSeparators: (formattedOutput.match(/\n\n---\n\n/g) || []).length,
                    messageBlocks: formattedOutput.split(/\n\n---\n\n/).length
                },
                validation: {
                    noUnknownUserRegression: !formattedOutput.includes('Unknown User'),
                    allUsersPresent: ['Owen Chandler', 'Clay', 'Jorge Macias', 'Bo (Clay)', 'Channeled']
                        .every(user => formattedOutput.includes(user)),
                    criticalContentPreserved: [
                        'Gong integration', '#CONTEXT#', 'never cough on a call', 
                        'tricky problem', 'web widget'
                    ].every(content => formattedOutput.includes(content))
                }
            };
            
            TestLogger.log('COMPREHENSIVE QUALITY REPORT:');
            TestLogger.log(JSON.stringify(report, null, 2));
            
            // All validations should pass
            expect(report.parsing.unknownUserMessages).toBe(0);
            expect(report.validation.noUnknownUserRegression).toBe(true);
            expect(report.validation.allUsersPresent).toBe(true);
            expect(report.validation.criticalContentPreserved).toBe(true);
            
            TestLogger.log('✅ COMPREHENSIVE VALIDATION COMPLETE: All quality metrics passed');
        });
    });
});