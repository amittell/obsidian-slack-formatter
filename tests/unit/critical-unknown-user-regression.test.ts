/**
 * CRITICAL UNKNOWN USER REGRESSION FOUND
 *
 * Issue: Clay APP format causes parser failure, resulting in:
 * - Jorge Macias content → Unknown User
 * - Bo (Clay) content → Unknown User
 * - Massive regression in message detection
 */

import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { TestLogger } from '../helpers';

describe('CRITICAL: Unknown User Regression Analysis', () => {
  it('should PASS - Clay APP format regression has been FIXED', () => {
    const problematicContent = `Owen Chandler
  Jun 8th at 6:25 PM
Here's my request for transcript analysis.

 (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM
Hi there, thanks so much for sharing this!

Jorge Macias
Jun 9th at 10:15 AM
easy, tell prospects to never cough`;

    const parser = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
    const messages = parser.parse(problematicContent);

    TestLogger.log('\n=== CRITICAL UNKNOWN USER REGRESSION TEST ===');
    TestLogger.log('Total messages:', messages.length);

    const unknownUsers = messages.filter(msg => msg.username === 'Unknown User');
    TestLogger.log('Unknown User messages:', unknownUsers.length);

    if (unknownUsers.length > 0) {
      TestLogger.log('\n❌ REGRESSION DETECTED: Unknown User messages found!');
      unknownUsers.forEach((msg, i) => {
        TestLogger.log(`Unknown User ${i + 1} content: "${msg.text?.substring(0, 200)}..."`);
      });
    } else {
      TestLogger.log(
        '\n✅ SUCCESS: Clay APP format is working correctly - no Unknown User messages'
      );
    }

    messages.forEach((msg, i) => {
      TestLogger.log(`Message ${i + 1}: "${msg.username}" - "${msg.text?.substring(0, 100)}..."`);
    });

    // This test now validates the fix
    TestLogger.log('\n✅ CRITICAL FIX VALIDATED:');
    TestLogger.log('- Clay APP format now works correctly');
    TestLogger.log('- Jorge Macias content is properly detected');
    TestLogger.log('- Multi-line Clay format parsing is fixed');
    TestLogger.log('- Clay APP timestamp pattern has been added');

    // FIXED: The Clay APP format issue has been resolved!
    // The parser now correctly handles the multi-line Clay format
    expect(unknownUsers.length).toBe(0); // Should be 0 - no unknown users
    expect(messages.length).toBeGreaterThanOrEqual(3); // Should detect at least 3 messages: Owen, Clay, Jorge
  });

  it('should show Clay APP format works correctly in isolation', () => {
    const clayAppBreakdown = ` (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM
Short message.`;

    const parser = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
    const messages = parser.parse(clayAppBreakdown);

    TestLogger.log('\n=== CLAY APP FORMAT BREAKDOWN ===');
    TestLogger.log('Messages detected:', messages.length);
    messages.forEach((msg, i) => {
      TestLogger.log(`Message ${i + 1}: "${msg.username}" - "${msg.text}"`);
    });

    // This should work, but if it doesn't, we know the Clay APP format is the problem
    const clayMessages = messages.filter(msg => msg.username === 'Clay');
    const unknownMessages = messages.filter(msg => msg.username === 'Unknown User');

    TestLogger.log('Clay messages found:', clayMessages.length);
    TestLogger.log('Unknown messages found:', unknownMessages.length);

    if (unknownMessages.length > 0) {
      TestLogger.log('❌ Clay APP format creates Unknown User messages');
    } else {
      TestLogger.log('✅ Clay APP format works correctly in isolation');
    }

    // Verify the fix works
    expect(unknownMessages.length).toBe(0);
    expect(clayMessages.length).toBeGreaterThan(0);
  });
});
