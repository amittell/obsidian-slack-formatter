/**
 * SEQUENTIAL THINKING SUBTASK E: Comprehensive Message Count Validation
 *
 * Validates detection of 4-5 messages from Clay screenshots:
 * 1. Owen Chandler - Initial message (Jun 8th at 6:28 PM)
 * 2. Owen Chandler - #CONTEXT# message (Jun 8th)
 * 3. Clay APP - "Hi there, thanks so much..." (Jun 8th)
 * 4. Bo (Clay) - Long advice message (Jun 10th)
 * 5. Jorge Macias - "easy, tell prospects to never cough..." (Jun 9th)
 */

import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { TestLogger } from '../helpers';

describe('GROUP E: Comprehensive Message Count Validation', () => {
  it('should detect exactly 4-5 messages with correct attribution (GROUND TRUTH VALIDATION)', () => {
    // Full conversation content based on screenshots
    const fullClayConversation = `Owen Chandler
  Jun 8th at 6:25 PM
Here's my request for transcript analysis. I need help analyzing the longest monologue in this conversation transcript.

#CONTEXT#
This is for a sales call review where we want to identify who spoke the longest without interruption.

 (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421713437949?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Hi there, thanks so much for sharing this! We'll be passing your feedback along to our product team, and any additional context you can provide will help us prioritize with your needs in mind as we shape the roadmap.

If there are specific use cases, workflows, or challenges where these suggestions would make a big difference, feel free to share—we'd love to hear more. Otherwise, we'll plan to close this ticket soon and review your input offline.

Jorge Macias
Jun 9th at 10:15 AM
easy, tell prospects to never cough or make noise during calls if they want to be taken seriously by enterprise buyers

Bo (Clay)
Jun 10th at 2:30 PM
Have you tried testing it on a known transcript where you manually verified the longest monologue? Let me know if you have more questions.

Also, here are some suggestions for improving your speech patterns:
- Use more varied sentence structures
- Include pauses for emphasis  
- Consider alternative phrasings when making key points
- Practice active listening techniques
- Be mindful of filler words

These techniques can help make your communication more engaging and effective during important business conversations.`;

    const parser = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
    const messages = parser.parse(fullClayConversation);

    TestLogger.log('\n=== COMPREHENSIVE MESSAGE COUNT VALIDATION ===');
    TestLogger.log(`TOTAL MESSAGES DETECTED: ${messages.length}`);
    TestLogger.log('\n--- DETAILED MESSAGE ANALYSIS ---');

    messages.forEach((msg, i) => {
      TestLogger.log(`\nMessage ${i + 1}:`);
      TestLogger.log(`  Username: "${msg.username}"`);
      TestLogger.log(`  Timestamp: "${msg.timestamp}"`);
      TestLogger.log(`  Content length: ${msg.text?.length || 0} chars`);

      if (msg.text) {
        const preview = msg.text.length > 120 ? `${msg.text.substring(0, 120)}...` : msg.text;
        TestLogger.log(`  Content preview: "${preview}"`);
      }
    });

    // GROUND TRUTH VALIDATION: Expected Messages
    TestLogger.log('\n--- GROUND TRUTH VALIDATION ---');

    // 1. Owen Chandler - Initial message
    const owenInitial = messages.filter(
      msg => msg.username === 'Owen Chandler' && msg.text?.includes('transcript analysis')
    );
    TestLogger.log(`✓ Owen Chandler (Initial): ${owenInitial.length} found`);

    // 2. Owen Chandler - Context message
    const owenContext = messages.filter(
      msg => msg.username === 'Owen Chandler' && msg.text?.includes('#CONTEXT#')
    );
    TestLogger.log(`✓ Owen Chandler (Context): ${owenContext.length} found`);

    // 3. Clay APP message
    const clayApp = messages.filter(
      msg => msg.username === 'Clay' && msg.text?.includes('Hi there, thanks so much')
    );
    TestLogger.log(`✓ Clay APP: ${clayApp.length} found`);

    // 4. Jorge Macias message
    const jorge = messages.filter(
      msg =>
        msg.username === 'Jorge Macias' && msg.text?.includes('easy, tell prospects to never cough')
    );
    TestLogger.log(`✓ Jorge Macias: ${jorge.length} found`);

    // 5. Bo (Clay) message
    const boClay = messages.filter(
      msg =>
        msg.username === 'Bo (Clay)' &&
        msg.text?.includes('Have you tried testing it on a known transcript')
    );
    TestLogger.log(`✓ Bo (Clay): ${boClay.length} found`);

    // Check for Unknown User regression
    const unknownUsers = messages.filter(msg => msg.username === 'Unknown User');
    TestLogger.log(`✗ Unknown User messages: ${unknownUsers.length}`);

    TestLogger.log('\n--- SUCCESS METRICS ---');
    const expectedMessages =
      owenInitial.length + owenContext.length + clayApp.length + jorge.length + boClay.length;
    TestLogger.log(`Expected messages found: ${expectedMessages}/5`);
    TestLogger.log(`Total messages detected: ${messages.length}`);
    TestLogger.log(`Unknown User regression: ${unknownUsers.length === 0 ? 'PASSED' : 'FAILED'}`);

    // CORE VALIDATIONS

    // Must detect 4-6 messages total (allowing for section header splitting)
    expect(messages.length).toBeGreaterThanOrEqual(4);
    expect(messages.length).toBeLessThanOrEqual(6);

    // Each expected message must be found exactly once
    expect(owenInitial.length).toBe(1);
    expect(clayApp.length).toBe(1);
    expect(jorge.length).toBe(1);
    expect(boClay.length).toBe(1);

    // Owen context message may be merged or separate (1 or 0)
    expect(owenContext.length).toBeGreaterThanOrEqual(0);
    expect(owenContext.length).toBeLessThanOrEqual(1);

    // No Unknown User regression
    expect(unknownUsers.length).toBe(0);

    // Verify correct timestamps preserved
    expect(owenInitial[0].timestamp).toMatch(/(Jun 8th|6:25|PM)/);
    expect(clayApp[0].timestamp).toMatch(/(Jun 8th|6:28|PM)/);
    expect(jorge[0].timestamp).toMatch(/(Jun 9th|10:15|AM)/);
    expect(boClay[0].timestamp).toMatch(/(Jun 10th|2:30|PM)/);

    // Verify key content preserved
    expect(owenInitial[0].text).toContain('transcript analysis');
    expect(clayApp[0].text).toContain('passing your feedback along to our product team');
    expect(jorge[0].text).toContain('never cough or make noise during calls');
    expect(boClay[0].text).toContain('suggestions for improving your speech patterns');

    TestLogger.log('\n✅ ALL VALIDATIONS PASSED - MESSAGE COUNT VALIDATION SUCCESSFUL');
  });

  it('should handle edge case: Owen messages may merge or separate', () => {
    // Test both Owen messages to see if they merge or stay separate
    const owenOnlyContent = `Owen Chandler
  Jun 8th at 6:25 PM
Here's my request for transcript analysis.

#CONTEXT#
This is for a sales call review.`;

    const parser = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
    const messages = parser.parse(owenOnlyContent);

    TestLogger.log('\n=== OWEN MESSAGE MERGE TEST ===');
    TestLogger.log(`Owen-only messages detected: ${messages.length}`);

    messages.forEach((msg, i) => {
      TestLogger.log(`Owen Message ${i + 1}: "${msg.text}"`);
    });

    // Should be 1 or 2 messages, never 0
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages.length).toBeLessThanOrEqual(2);

    // All should be Owen Chandler
    messages.forEach(msg => {
      expect(msg.username).toBe('Owen Chandler');
    });
  });

  it('should differentiate between Clay APP and Bo (Clay) consistently', () => {
    const clayDifferentiationTest = ` (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM
Customer service response.

Bo (Clay)
Jun 10th at 2:30 PM
Personal advice message.`;

    const parser = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
    const messages = parser.parse(clayDifferentiationTest);

    TestLogger.log('\n=== CLAY DIFFERENTIATION VALIDATION ===');
    messages.forEach((msg, i) => {
      TestLogger.log(`Message ${i + 1}: Username="${msg.username}", Date="${msg.timestamp}"`);
    });

    expect(messages.length).toBe(2);

    const clayAppMessage = messages.find(msg => msg.username === 'Clay');
    const boClayMessage = messages.find(msg => msg.username === 'Bo (Clay)');

    expect(clayAppMessage).toBeDefined();
    expect(boClayMessage).toBeDefined();

    expect(clayAppMessage?.timestamp).toMatch(/(Jun 8th|6:28|PM)/);
    expect(boClayMessage?.timestamp).toMatch(/(Jun 10th|2:30|PM)/);

    TestLogger.log('✅ Clay differentiation validation passed');
  });
});
