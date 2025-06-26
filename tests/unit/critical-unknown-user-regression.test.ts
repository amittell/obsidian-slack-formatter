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

describe('CRITICAL: Unknown User Regression Analysis', () => {
    it('should FAIL due to Clay APP format causing Unknown User regression', () => {
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

        console.log('\n=== CRITICAL UNKNOWN USER REGRESSION TEST ===');
        console.log('Total messages:', messages.length);
        
        const unknownUsers = messages.filter(msg => msg.username === 'Unknown User');
        console.log('Unknown User messages:', unknownUsers.length);
        
        if (unknownUsers.length > 0) {
            console.log('\n❌ REGRESSION DETECTED: Unknown User messages found!');
            unknownUsers.forEach((msg, i) => {
                console.log(`Unknown User ${i + 1} content: "${msg.text?.substring(0, 200)}..."`);
            });
        }

        messages.forEach((msg, i) => {
            console.log(`Message ${i + 1}: "${msg.username}" - "${msg.text?.substring(0, 100)}..."`);
        });

        // This test documents the current failure
        console.log('\n🚨 CRITICAL FINDING:');
        console.log('- Clay APP format breaks parser');
        console.log('- Jorge Macias content gets dumped to Unknown User');
        console.log('- This is a MASSIVE regression');
        console.log('- Need to fix Clay APP parsing immediately');

        // Document current state
        expect(unknownUsers.length).toBeGreaterThan(0); // This currently fails validation
        expect(messages.length).toBeLessThan(4); // Parser is under-detecting
    });

    it('should show Clay APP format specifically breaks the parser', () => {
        const clayAppBreakdown = ` (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM
Short message.`;

        const parser = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
        const messages = parser.parse(clayAppBreakdown);

        console.log('\n=== CLAY APP FORMAT BREAKDOWN ===');
        console.log('Messages detected:', messages.length);
        messages.forEach((msg, i) => {
            console.log(`Message ${i + 1}: "${msg.username}" - "${msg.text}"`);
        });

        // This should work, but if it doesn't, we know the Clay APP format is the problem
        const clayMessages = messages.filter(msg => msg.username === 'Clay');
        const unknownMessages = messages.filter(msg => msg.username === 'Unknown User');
        
        console.log('Clay messages found:', clayMessages.length);
        console.log('Unknown messages found:', unknownMessages.length);
        
        if (unknownMessages.length > 0) {
            console.log('❌ Clay APP format creates Unknown User messages');
        } else {
            console.log('✅ Clay APP format works in isolation');
        }
    });
});