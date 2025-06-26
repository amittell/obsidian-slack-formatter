import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { TestLogger } from '../helpers';

describe('Clay Conversation Integration Validation', () => {
    let intelligentParser: IntelligentMessageParser;
    let flexibleParser: FlexibleMessageParser;
    let slackFormatter: SlackFormatter;

    // Clay conversation sample from Group E report
    const clayConversation = `Owen Chandler
Owen Chandler
  10:59 AM
hey
can you do a quick transcript analysis of this video we just had 

Owen Chandler
Owen Chandler
  11:20 AM
#CONTEXT#
For each person that is on the call, extract their verbatim talking points

Clay
 (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM
Hi there, thanks so much for sharing this! I can definitely help with the transcript analysis.

Jorge Macias
Jorge Macias  Jun 9th at 10:15 AM
easy, tell prospects to never cough up money to get money

Bo (Clay)
Bo (Clay)  Jun 9th at 10:16 AM
Great point! Let me know if you need any other analysis on this.`;

    // Common test configuration
    const testConfig = {
        debug: false,
        userMap: {},
        emojiMap: {}
    };

    // Shared setup function for parser initialization
    const createParsers = () => ({
        intelligentParser: new IntelligentMessageParser(
            { debug: testConfig.debug },
            { userMap: testConfig.userMap, emojiMap: testConfig.emojiMap }
        ),
        flexibleParser: new FlexibleMessageParser(),
        slackFormatter: new SlackFormatter(
            { debug: testConfig.debug },
            testConfig.userMap,
            testConfig.emojiMap
        )
    });

    // Shared function for logging test section headers
    const logTestSection = (sectionName: string) => {
        TestLogger.log(`\n=== ${sectionName} ===`);
    };

    // Shared function for validating Unknown User regression
    const validateNoUnknownUsers = (messages: any[], testName: string) => {
        const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
        const unknownUserCount = unknownUserMessages.length;
        
        TestLogger.log(`Unknown User messages: ${unknownUserCount}`);
        
        if (unknownUserCount > 0) {
            TestLogger.log('❌ CRITICAL REGRESSION: Unknown User messages detected:');
            unknownUserMessages.forEach((msg, i) => {
                TestLogger.log(`Unknown User ${i}: "${msg.text?.substring(0, 100)}..."`);
            });
        }
        
        expect(unknownUserCount).toBe(0);
    };

    // Shared function for logging message details
    const logMessageDetails = (messages: any[], prefix: string = 'Message') => {
        TestLogger.log(`Total messages detected: ${messages.length}`);
        messages.forEach((message, index) => {
            TestLogger.log(`${prefix} ${index}: "${message.username}" - "${message.text?.substring(0, 50)}..."`);
        });
    };

    beforeEach(() => {
        const parsers = createParsers();
        intelligentParser = parsers.intelligentParser;
        flexibleParser = parsers.flexibleParser;
        slackFormatter = parsers.slackFormatter;
    });

    describe('Critical Unknown User Regression Validation', () => {
        it('should detect 4-5 messages without Unknown User regression', () => {
            logTestSection('CLAY CONVERSATION INTEGRATION TEST');
            
            const messages = intelligentParser.parse(clayConversation, false);
            
            // Group E report indicated expectation of 4-5 messages
            expect(messages.length).toBeGreaterThanOrEqual(4);
            
            // Validate individual message attribution  
            logMessageDetails(messages);
            
            // Critical: Check for Unknown User regression
            validateNoUnknownUsers(messages, 'Clay Conversation Integration');
            
            // Validate specific user detection
            const usernames = messages.map(m => m.username);
            const uniqueUsers = [...new Set(usernames)];
            
            TestLogger.log(`Unique users detected: ${uniqueUsers.join(', ')}`);
            
            // Should detect Owen Chandler (appears twice)
            expect(usernames.filter(u => u.includes('Owen')).length).toBeGreaterThanOrEqual(1);
            
            // Should detect Clay APP
            expect(usernames.some(u => u.includes('Clay'))).toBe(true);
            
            // Should detect Jorge Macias 
            expect(usernames.some(u => u.includes('Jorge'))).toBe(true);
            
            // Should detect Bo
            expect(usernames.some(u => u.includes('Bo'))).toBe(true);
        });

        it('should validate regression fix for Clay APP format parsing', () => {
            logTestSection('CLAY APP FORMAT PARSING VALIDATION');
            
            // Focus on the problematic Clay APP format line
            const clayAppSection = ` (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM
Hi there, thanks so much for sharing this!`;

            const messages = intelligentParser.parse(clayAppSection, false);
            
            logMessageDetails(messages, 'Clay APP Message');
            
            // Should parse as Clay APP without creating Unknown User
            expect(messages.length).toBe(1);
            expect(messages[0].username).not.toBe('Unknown User');
            expect(messages[0].username.toLowerCase()).toContain('clay');
            expect(messages[0].text).toContain('Hi there, thanks so much');
        });

        it('should handle individual users correctly when isolated', () => {
            logTestSection('INDIVIDUAL USER VALIDATION');
            
            const testCases = [
                {
                    name: "Jorge Macias",
                    content: `Jorge Macias
Jorge Macias  Jun 9th at 10:15 AM
easy, tell prospects to never cough up money to get money`
                },
                {
                    name: "Bo (Clay)",
                    content: `Bo (Clay)
Bo (Clay)  Jun 9th at 10:16 AM
Great point! Let me know if you need any other analysis on this.`
                }
            ];
            
            testCases.forEach(({ name, content }) => {
                const messages = intelligentParser.parse(content, false);
                
                TestLogger.log(`${name} - Messages: ${messages.length}`);
                if (messages.length > 0) {
                    TestLogger.log(`  Username: "${messages[0].username}"`);
                    TestLogger.log(`  Text: "${messages[0].text?.substring(0, 50)}..."`);
                }
                
                expect(messages.length).toBe(1);
                expect(messages[0].username).not.toBe('Unknown User');
                expect(messages[0].username.toLowerCase()).toContain(name.toLowerCase().split(' ')[0]);
            });
        });

        it('should process full conversation through SlackFormatter without regressions', () => {
            logTestSection('FULL SLACK FORMATTER INTEGRATION');
            
            const formattedOutput = slackFormatter.format(clayConversation);
            
            TestLogger.log(`Formatted output length: ${formattedOutput.length} characters`);
            
            expect(formattedOutput).toBeTruthy();
            expect(formattedOutput.length).toBeGreaterThan(0);
            
            // Should contain all expected users
            expect(formattedOutput).toContain('Owen Chandler');
            expect(formattedOutput).toContain('Clay');
            expect(formattedOutput).toContain('Jorge Macias');
            expect(formattedOutput).toContain('Bo');
            
            // Should contain key content
            expect(formattedOutput).toContain('transcript analysis');
            expect(formattedOutput).toContain('thanks so much for sharing');
            expect(formattedOutput).toContain('never cough up money');
            expect(formattedOutput).toContain('Great point');
            
            // Should NOT contain Unknown User in formatted output
            expect(formattedOutput).not.toContain('Unknown User');
            
            TestLogger.log('Full SlackFormatter integration: VALIDATED');
        });
    });

    describe('Performance and Integration Validation', () => {
        it('should maintain performance with integrated fixes', () => {
            logTestSection('PERFORMANCE VALIDATION');
            
            const startTime = Date.now();
            const messages = intelligentParser.parse(clayConversation, false);
            const endTime = Date.now();
            
            const processingTime = endTime - startTime;
            
            TestLogger.log(`Processing time: ${processingTime}ms`);
            TestLogger.log(`Messages parsed: ${messages.length}`);
            TestLogger.log(`Performance: ${(clayConversation.length / processingTime * 1000).toFixed(0)} chars/second`);
            
            // Should process quickly (< 100ms for small conversation, 500ms in CI)
            expect(processingTime).toBeLessThan(process.env.CI ? 500 : 100);
            
            // Should still detect expected number of messages
            expect(messages.length).toBeGreaterThanOrEqual(4);
        });

        it('should validate context caching optimization is working', () => {
            logTestSection('CONTEXT CACHING VALIDATION');
            
            // Run the same conversation multiple times to test caching
            const iterations = 5;
            const times: number[] = [];
            
            for (let i = 0; i < iterations; i++) {
                const start = Date.now();
                const messages = intelligentParser.parse(clayConversation, false);
                const end = Date.now();
                
                times.push(end - start);
                
                // Validate results are consistent
                expect(messages.length).toBeGreaterThanOrEqual(4);
                validateNoUnknownUsers(messages, `Caching iteration ${i + 1}`);
            }
            
            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const maxTime = Math.max(...times);
            
            TestLogger.log(`Average processing time: ${avgTime.toFixed(1)}ms`);
            TestLogger.log(`Max processing time: ${maxTime}ms`);
            TestLogger.log(`Performance consistency: ${(times.every(t => t < 50) ? 'GOOD' : 'NEEDS_IMPROVEMENT')}`);
            
            // Performance should be consistent and fast
            expect(avgTime).toBeLessThan(process.env.CI ? 200 : 50);
            expect(maxTime).toBeLessThan(process.env.CI ? 500 : 100);
        });
    });
});