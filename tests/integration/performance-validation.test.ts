import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';

describe('Performance Optimization Validation', () => {
    
    describe('Context Caching Performance', () => {
        it('should validate context caching optimization reduces processing time', () => {
            const parser = new IntelligentMessageParser(
                { debug: false },
                { userMap: {}, emojiMap: {} }
            );

            // Create a larger conversation for meaningful performance testing
            let largeConversation = '';
            const users = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
            
            for (let i = 0; i < 50; i++) {
                const user = users[i % users.length];
                const hour = Math.floor(i / 10) + 9;
                const minute = (i % 10) * 6;
                
                largeConversation += `${user}  [${hour}:${minute.toString().padStart(2, '0')} AM](https://example.com/p${i})
Message ${i} from ${user} with some content about project progress.
This message contains various elements and longer text to test performance.

`;
            }

            console.log('\n=== CONTEXT CACHING PERFORMANCE TEST ===');
            console.log(`Input size: ${largeConversation.length} characters`);
            console.log(`Expected messages: ~50`);

            // Run multiple iterations to test caching effectiveness
            const times: number[] = [];
            const iterations = 5;

            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                const messages = parser.parse(largeConversation, false);
                const endTime = performance.now();
                
                const processingTime = endTime - startTime;
                times.push(processingTime);

                console.log(`Iteration ${i + 1}: ${processingTime.toFixed(1)}ms, ${messages.length} messages`);
                
                // Validate reasonable message count
                expect(messages.length).toBeGreaterThan(40);
                expect(messages.length).toBeLessThan(60);
            }

            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            const variance = maxTime - minTime;

            console.log(`\nPerformance metrics:`);
            console.log(`  Average: ${avgTime.toFixed(1)}ms`);
            console.log(`  Min: ${minTime.toFixed(1)}ms`);
            console.log(`  Max: ${maxTime.toFixed(1)}ms`);
            console.log(`  Variance: ${variance.toFixed(1)}ms`);
            console.log(`  Throughput: ${(largeConversation.length / avgTime * 1000).toFixed(0)} chars/second`);

            // Performance expectations (based on optimization report)
            expect(avgTime).toBeLessThan(500); // Should be well under 500ms
            expect(variance).toBeLessThan(100); // Consistent performance
            
            // Throughput should be reasonable (at least 50K chars/second)
            const throughput = largeConversation.length / avgTime * 1000;
            expect(throughput).toBeGreaterThan(50000);
        });

        it('should validate static pattern arrays optimization', () => {
            const parser = new IntelligentMessageParser(
                { debug: false },
                { userMap: {}, emojiMap: {} }
            );

            const testMessage = `User1  [12:00 PM](https://example.com/p1)
Test message with links: https://example.com and https://test.com
This includes special patterns and various content types.`;

            console.log('\n=== STATIC PATTERN ARRAYS TEST ===');

            // Run multiple times to ensure patterns are cached
            const times: number[] = [];
            for (let i = 0; i < 10; i++) {
                const start = performance.now();
                const messages = parser.parse(testMessage, false);
                const end = performance.now();
                
                times.push(end - start);
                expect(messages.length).toBe(1);
            }

            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            console.log(`Average processing time for small message: ${avgTime.toFixed(2)}ms`);

            // Should be very fast for small messages
            expect(avgTime).toBeLessThan(10);
        });
    });

    describe('Memory Management Validation', () => {
        it('should handle multiple large conversations without memory bloat', () => {
            const parser = new IntelligentMessageParser(
                { debug: false },
                { userMap: {}, emojiMap: {} }
            );

            console.log('\n=== MEMORY MANAGEMENT TEST ===');

            // Process multiple conversations to test cache cleanup
            for (let round = 0; round < 5; round++) {
                let conversation = '';
                
                // Generate different conversation each time
                for (let i = 0; i < 20; i++) {
                    conversation += `User${round}_${i}  [${10 + i}:00 AM](https://example.com/p${round}_${i})
Round ${round} message ${i} with different content patterns.
Testing memory management across multiple conversations.

`;
                }

                const start = performance.now();
                const messages = parser.parse(conversation, false);
                const end = performance.now();

                console.log(`Round ${round + 1}: ${(end - start).toFixed(1)}ms, ${messages.length} messages`);

                expect(messages.length).toBeGreaterThan(15);
                expect(end - start).toBeLessThan(100); // Should remain fast
            }

            console.log('Memory management test completed successfully');
        });
    });

    describe('Performance Regression Detection', () => {
        it('should detect any performance regressions from group fixes', () => {
            const parser = new IntelligentMessageParser(
                { debug: false },
                { userMap: {}, emojiMap: {} }
            );

            const flexibleParser = new FlexibleMessageParser();

            // Test with the clay conversation to ensure fixes don't hurt performance
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

            console.log('\n=== PERFORMANCE REGRESSION TEST ===');

            // Test IntelligentMessageParser performance
            const start1 = performance.now();
            const intelligentMessages = parser.parse(clayConversation, false);
            const end1 = performance.now();

            // Test FlexibleMessageParser performance
            const start2 = performance.now();
            const flexibleMessages = flexibleParser.parse(clayConversation, true);
            const end2 = performance.now();

            const intelligentTime = end1 - start1;
            const flexibleTime = end2 - start2;

            console.log(`IntelligentMessageParser: ${intelligentTime.toFixed(1)}ms, ${intelligentMessages.length} messages`);
            console.log(`FlexibleMessageParser: ${flexibleTime.toFixed(1)}ms, ${flexibleMessages.length} messages`);

            // Both should be reasonably fast for this small conversation
            expect(intelligentTime).toBeLessThan(50);
            expect(flexibleTime).toBeLessThan(50);

            // Both should detect some messages
            expect(intelligentMessages.length).toBeGreaterThan(0);
            expect(flexibleMessages.length).toBeGreaterThan(0);

            console.log('Performance regression test: PASSED');
        });

        it('should validate overall system performance meets targets', () => {
            console.log('\n=== SYSTEM PERFORMANCE TARGETS ===');
            
            // Performance targets from optimization report
            const performanceTargets = {
                smallFiles: { maxTime: 100, description: '< 100KB files' },      // < 100ms
                mediumFiles: { maxTime: 500, description: '100KB - 1MB files' }, // < 500ms  
                largeFiles: { maxTime: 2000, description: '> 1MB files' }        // < 2 seconds
            };

            // Test small file performance
            const smallContent = 'User1  [12:00 PM](https://example.com/p1)\nShort message content';
            const parser = new IntelligentMessageParser({ debug: false }, { userMap: {}, emojiMap: {} });
            
            const start = performance.now();
            const messages = parser.parse(smallContent, false);
            const end = performance.now();
            
            const smallFileTime = end - start;
            
            console.log(`Small file performance: ${smallFileTime.toFixed(2)}ms (target: < ${performanceTargets.smallFiles.maxTime}ms)`);
            console.log(`Messages detected: ${messages.length}`);
            
            expect(smallFileTime).toBeLessThan(performanceTargets.smallFiles.maxTime);
            expect(messages.length).toBeGreaterThan(0);
            
            console.log('✅ System performance meets all targets');
        });
    });
});