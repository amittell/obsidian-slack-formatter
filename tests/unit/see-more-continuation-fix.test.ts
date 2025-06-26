import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger } from '../helpers';

describe('See More Continuation Fix', () => {
    it('should handle Bo (Clay) See more continuation without creating Unknown User', () => {
        // Simulating the exact scenario the user reported:
        // Message 1: Owen Chandler ✅
        // Message 2: Clay ✅  
        // Message 3: **Unknown User** ❌ (this should be "Bo (Clay)")
        // The Unknown User message contains: "Have you tried testing it on a known transcript where you manually verified the longest monologue? Let me know if you have more questions."
        
        const input = `Owen Chandler
  12:00 PM
Message from Owen Chandler here.

Clay
  12:01 PM
Message from Clay here.

Bo (Clay)
  12:02 PM
This is the start of Bo's message...
See more
Have you tried testing it on a known transcript where you manually verified the longest monologue? Let me know if you have more questions.`;

        const parser = new IntelligentMessageParser();
        
        const messages = parser.parse(input);
        
        if (process.env.DEBUG_TESTS) {
            TestLogger.log('\n=== SEE MORE CONTINUATION FIX DEBUG ===');
            TestLogger.log('Number of messages:', messages.length);
            messages.forEach((msg, i) => {
                TestLogger.log(`\nMessage ${i + 1}:`);
                TestLogger.log(`  Username: "${msg.username}"`);
                TestLogger.log(`  Timestamp: "${msg.timestamp}"`);
                TestLogger.log(`  Text: "${msg.text}"`);
            });
            
            // Identify specific issues
            const unknownUserMessages = messages.filter(msg => msg.username === 'Unknown User');
            TestLogger.log(`\nUnknown User messages found: ${unknownUserMessages.length}`);
            unknownUserMessages.forEach((msg, i) => {
                TestLogger.log(`Unknown User ${i}: "${msg.text}"`);
            });
        }
        
        const unknownUserMessages = messages.filter(msg => msg.username === 'Unknown User');
        
        // Check that we have the expected 3 messages
        expect(messages.length).toBe(3);
        
        // Check that we have no Unknown User messages
        expect(unknownUserMessages.length).toBe(0);
        
        // Check that all expected usernames are present
        expect(messages.some(msg => msg.username === 'Owen Chandler')).toBe(true);
        expect(messages.some(msg => msg.username === 'Clay')).toBe(true);
        expect(messages.some(msg => msg.username === 'Bo (Clay)')).toBe(true);
        
        // Check that Bo's message contains the continuation content
        const boMessage = messages.find(msg => msg.username === 'Bo (Clay)');
        expect(boMessage).toBeDefined();
        expect(boMessage?.text).toContain('Have you tried testing it on a known transcript');
        expect(boMessage?.text).toContain('Let me know if you have more questions');
    });

    it('should handle various See more continuation patterns', () => {
        const input = `User1
  12:00 PM
First part of message...
See more
Second part of message after See more.

User2
  12:01 PM
Another message...
Show more
Additional content after Show more.

User3
  12:02 PM
Third message...
Read more
Final content after Read more.`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        if (process.env.DEBUG_TESTS) {
            TestLogger.log('\n=== VARIOUS CONTINUATION PATTERNS DEBUG ===');
            TestLogger.log('Number of messages:', messages.length);
            messages.forEach((msg, i) => {
                TestLogger.log(`\nMessage ${i + 1}:`);
                TestLogger.log(`  Username: "${msg.username}"`);
                TestLogger.log(`  Text: "${msg.text}"`);
            });
        }
        
        // Should have exactly 3 messages, no Unknown User
        expect(messages.length).toBe(3);
        expect(messages.filter(msg => msg.username === 'Unknown User').length).toBe(0);
        
        // Each message should contain both parts (before and after continuation)
        expect(messages[0].text).toContain('First part of message');
        expect(messages[0].text).toContain('Second part of message after See more');
        
        expect(messages[1].text).toContain('Another message');
        expect(messages[1].text).toContain('Additional content after Show more');
        
        expect(messages[2].text).toContain('Third message');
        expect(messages[2].text).toContain('Final content after Read more');
    });
});