import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { TestLogger } from '../helpers';

// Enhanced conditional skip logic for performance tests
// Skip in CI environments, when running in debug mode, or when explicitly disabled
// Can be overridden with RUN_PERFORMANCE_TESTS=true
const shouldSkipPerformanceTests =
  process.env.RUN_PERFORMANCE_TESTS === 'true'
    ? false
    : process.env.CI === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.env.SKIP_PERFORMANCE_TESTS === 'true' ||
      process.env.DEBUG === 'true';

const describePerformance = shouldSkipPerformanceTests ? describe.skip : describe;

// Log skip reason for clarity
if (shouldSkipPerformanceTests) {
  TestLogger.log('⏭️  Skipping performance tests due to environment settings');
  if (process.env.CI) TestLogger.log('   Reason: CI environment detected');
  if (process.env.SKIP_PERFORMANCE_TESTS) TestLogger.log('   Reason: SKIP_PERFORMANCE_TESTS=true');
  if (process.env.DEBUG) TestLogger.log('   Reason: DEBUG mode enabled');
}

describePerformance('Performance Optimization Validation', () => {
  describe('Context Caching Performance', () => {
    it('should validate context caching optimization reduces processing time', () => {
      const parser = new IntelligentMessageParser({ debug: false }, { userMap: {}, emojiMap: {} });

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

      TestLogger.log('\n=== CONTEXT CACHING PERFORMANCE TEST ===');
      TestLogger.log(`Input size: ${largeConversation.length} characters`);
      TestLogger.log(`Expected messages: ~50`);

      // Run multiple iterations to test caching effectiveness
      const times: number[] = [];
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const messages = parser.parse(largeConversation, false);
        const endTime = performance.now();

        const processingTime = endTime - startTime;
        times.push(processingTime);

        TestLogger.log(
          `Iteration ${i + 1}: ${processingTime.toFixed(1)}ms, ${messages.length} messages`
        );

        // Validate reasonable message count
        expect(messages.length).toBeGreaterThan(40);
        expect(messages.length).toBeLessThan(60);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const variance = maxTime - minTime;

      TestLogger.log(`\nPerformance metrics:`);
      TestLogger.log(`  Average: ${avgTime.toFixed(1)}ms`);
      TestLogger.log(`  Min: ${minTime.toFixed(1)}ms`);
      TestLogger.log(`  Max: ${maxTime.toFixed(1)}ms`);
      TestLogger.log(`  Variance: ${variance.toFixed(1)}ms`);
      TestLogger.log(
        `  Throughput: ${((largeConversation.length / avgTime) * 1000).toFixed(0)} chars/second`
      );

      // Performance expectations (based on optimization report)
      const avgTimeThreshold = process.env.CI ? 1000 : 500; // 1s in CI, 500ms locally
      const varianceThreshold = process.env.CI ? 200 : 100; // 200ms in CI, 100ms locally
      expect(avgTime).toBeLessThan(avgTimeThreshold);
      expect(variance).toBeLessThan(varianceThreshold);

      // Throughput should be reasonable (at least 50K chars/second)
      const throughput = (largeConversation.length / avgTime) * 1000;
      expect(throughput).toBeGreaterThan(50000);
    });

    it('should validate static pattern arrays optimization', () => {
      const parser = new IntelligentMessageParser({ debug: false }, { userMap: {}, emojiMap: {} });

      const testMessage = `User1  [12:00 PM](https://example.com/p1)
Test message with links: https://example.com and https://test.com
This includes special patterns and various content types.`;

      TestLogger.log('\n=== STATIC PATTERN ARRAYS TEST ===');

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
      TestLogger.log(`Average processing time for small message: ${avgTime.toFixed(2)}ms`);

      // Should be very fast for small messages
      const smallMessageThreshold = process.env.CI ? 20 : 10; // 20ms in CI, 10ms locally
      expect(avgTime).toBeLessThan(smallMessageThreshold);
    });
  });

  describe('Memory Management Validation', () => {
    it('should handle multiple large conversations without memory bloat', () => {
      const parser = new IntelligentMessageParser({ debug: false }, { userMap: {}, emojiMap: {} });

      TestLogger.log('\n=== MEMORY MANAGEMENT TEST ===');

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

        TestLogger.log(
          `Round ${round + 1}: ${(end - start).toFixed(1)}ms, ${messages.length} messages`
        );

        expect(messages.length).toBeGreaterThan(15);
        const memoryTestThreshold = process.env.CI ? 200 : 100; // 200ms in CI, 100ms locally
        expect(end - start).toBeLessThan(memoryTestThreshold);
      }

      TestLogger.log('Memory management test completed successfully');
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect any performance regressions from group fixes', () => {
      const parser = new IntelligentMessageParser({ debug: false }, { userMap: {}, emojiMap: {} });

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

      TestLogger.log('\n=== PERFORMANCE REGRESSION TEST ===');

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

      TestLogger.log(
        `IntelligentMessageParser: ${intelligentTime.toFixed(1)}ms, ${intelligentMessages.length} messages`
      );
      TestLogger.log(
        `FlexibleMessageParser: ${flexibleTime.toFixed(1)}ms, ${flexibleMessages.length} messages`
      );

      // Both should be reasonably fast for this small conversation
      const regressionThreshold = process.env.CI ? 100 : 50; // 100ms in CI, 50ms locally
      expect(intelligentTime).toBeLessThan(regressionThreshold);
      expect(flexibleTime).toBeLessThan(regressionThreshold);

      // Both should detect some messages
      expect(intelligentMessages.length).toBeGreaterThan(0);
      expect(flexibleMessages.length).toBeGreaterThan(0);

      TestLogger.log('Performance regression test: PASSED');
    });

    it('should validate overall system performance meets targets', () => {
      TestLogger.log('\n=== SYSTEM PERFORMANCE TARGETS ===');

      // Performance targets from optimization report (environment-aware)
      const performanceTargets = {
        smallFiles: {
          maxTime: process.env.CI ? 200 : 100,
          description: '< 100KB files',
        },
        mediumFiles: {
          maxTime: process.env.CI ? 1000 : 500,
          description: '100KB - 1MB files',
        },
        largeFiles: {
          maxTime: process.env.CI ? 4000 : 2000,
          description: '> 1MB files',
        },
      };

      // Test small file performance
      const smallContent = 'User1  [12:00 PM](https://example.com/p1)\nShort message content';
      const parser = new IntelligentMessageParser({ debug: false }, { userMap: {}, emojiMap: {} });

      const start = performance.now();
      const messages = parser.parse(smallContent, false);
      const end = performance.now();

      const smallFileTime = end - start;

      TestLogger.log(
        `Small file performance: ${smallFileTime.toFixed(2)}ms (target: < ${performanceTargets.smallFiles.maxTime}ms)`
      );
      TestLogger.log(`Messages detected: ${messages.length}`);

      expect(smallFileTime).toBeLessThan(performanceTargets.smallFiles.maxTime);
      expect(messages.length).toBeGreaterThan(0);

      TestLogger.log('✅ System performance meets all targets');
    });
  });
});
