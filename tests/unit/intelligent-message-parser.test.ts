import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('IntelligentMessageParser - Error Resilience', () => {
    let parser: IntelligentMessageParser;
    
    beforeEach(() => {
        parser = new IntelligentMessageParser(DEFAULT_SETTINGS, {
            userMap: {},
            emojiMap: {}
        });
    });
    
    describe('Constructor and Initialization', () => {
        it('should initialize with default settings', () => {
            expect(parser).toBeDefined();
        });
        
        it('should initialize debugMode correctly', () => {
            const debugParser = new IntelligentMessageParser(
                { ...DEFAULT_SETTINGS, debug: true },
                { userMap: {}, emojiMap: {} }
            );
            expect(debugParser).toBeDefined();
        });
        
        it('should throw error for invalid settings', () => {
            expect(() => new IntelligentMessageParser(
                'invalid' as any,
                { userMap: {}, emojiMap: {} }
            )).toThrow('IntelligentMessageParser: settings must be an object or undefined');
        });
        
        it('should throw error for invalid parsedMaps', () => {
            expect(() => new IntelligentMessageParser(
                DEFAULT_SETTINGS,
                'invalid' as any
            )).toThrow('IntelligentMessageParser: parsedMaps must be an object or undefined');
        });
    });
    
    describe('Error Resilience', () => {
        it('should handle undefined properties gracefully', () => {
            const input = `Test User
12:00 PM
Test message`;
            
            const messages = parser.parse(input);
            expect(messages).toBeDefined();
            expect(messages.length).toBeGreaterThanOrEqual(0);
        });
        
        it('should validate parser state before processing', () => {
            const input = 'Test input';
            
            // Validation should prevent errors
            expect(() => parser.parse(input)).not.toThrow();
        });
        
        it('should handle debug mode parameter correctly', () => {
            const input = 'Test message';
            
            // Should not throw error with any debug mode value
            expect(() => parser.parse(input, true)).not.toThrow();
            expect(() => parser.parse(input, false)).not.toThrow();
            expect(() => parser.parse(input, undefined)).not.toThrow();
        });
        
        it('should not crash when accessing debugMode in loops', () => {
            const input = `User One
10:00 AM
Message one

User Two
10:01 AM
Message two

User Three
10:02 AM
Message three`;
            
            // This tests the forEach replacement with for loop
            expect(() => parser.parse(input, true)).not.toThrow();
            const messages = parser.parse(input);
            expect(messages.length).toBeGreaterThan(0);
        });
    });
});

describe('IntelligentMessageParser - Message Continuations', () => {
    const parser = new IntelligentMessageParser(
        { debug: false },
        { userMap: {}, emojiMap: {} }
    );

    it('should properly handle continuation timestamps with [time](url) format', () => {
        const input = `Clement MiaoClement Miao  [Feb 7th at 8:25 AM](https://slack.com/archives/123)

this is AMAZING omg

[8:26](https://slack.com/archives/456)

even if a bit buggy, this is going to be great

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

        const messages = parser.parse(input);


        // Should parse exactly 2 messages, not 4
        expect(messages.length).toBe(2);

        // First message should be from Clement Miao
        expect(messages[0].username).toBe('Clement Miao');
        expect(messages[0].text).toContain('this is AMAZING omg');
        expect(messages[0].text).toContain('[8:26]');
        expect(messages[0].text).toContain('even if a bit buggy');

        // Second message should be from Trajan McGill
        expect(messages[1].username).toBe('Trajan McGill');
        expect(messages[1].text).toContain('Yeah, this is going to be fantastic');
        expect(messages[1].text).toContain('[9:18]');
        expect(messages[1].text).toContain('So, first attempt');
    });

    it('should handle simple timestamp continuations', () => {
        const input = `User One  10:30 AM

First message

10:31 AM

Continuation of first message

User Two  10:35 AM

Second message`;

        const messages = parser.parse(input);

        // DEBUG: Log the actual message objects to see timestamp values
        console.log('\n=== DEBUG MESSAGE OBJECTS ===');
        messages.forEach((msg, i) => {
            console.log(`Message ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp}"`);
            console.log(`  Date: "${msg.date}"`);
            console.log('');
        });

        expect(messages.length).toBe(2);
        expect(messages[0].username).toBe('User One');
        expect(messages[0].text).toContain('First message');
        expect(messages[0].text).toContain('10:31 AM');
        expect(messages[0].text).toContain('Continuation of first message');
    });

    it('should handle bracketed timestamp continuations', () => {
        const input = `Alice Smith  [3:45 PM]

Starting a conversation

[3:46 PM]

Adding more thoughts

Bob Jones  [3:50 PM]

Different person's message`;

        const messages = parser.parse(input);

        expect(messages.length).toBe(2);
        expect(messages[0].username).toBe('Alice Smith');
        expect(messages[0].text).toContain('Starting a conversation');
        expect(messages[0].text).toContain('[3:46 PM]');
        expect(messages[0].text).toContain('Adding more thoughts');
    });

    it('should not merge messages from different authors', () => {
        const input = `User A  2:00 PM

Message from A

User B  2:01 PM

Message from B

[2:02 PM]

B's continuation`;

        const messages = parser.parse(input);

        expect(messages.length).toBe(2);
        expect(messages[1].username).toBe('User B');
        expect(messages[1].text).toContain('Message from B');
        expect(messages[1].text).toContain('[2:02 PM]');
        expect(messages[1].text).toContain("B's continuation");
    });

    it('should handle multiple continuations in one message', () => {
        const input = `Power User  [1:00 PM]

First part

[1:01 PM]

Second part

[1:02 PM]

Third part

[1:03 PM]

Fourth part`;

        const messages = parser.parse(input);

        expect(messages.length).toBe(1);
        expect(messages[0].username).toBe('Power User');
        expect(messages[0].text).toContain('First part');
        expect(messages[0].text).toContain('[1:01 PM]');
        expect(messages[0].text).toContain('Second part');
        expect(messages[0].text).toContain('[1:02 PM]');
        expect(messages[0].text).toContain('Third part');
        expect(messages[0].text).toContain('[1:03 PM]');
        expect(messages[0].text).toContain('Fourth part');
    });

    it('should not create Unknown User entries for continuations', () => {
        const input = `Real User  [10:00 AM]

Main message

[10:01 AM]

Continuation that should not be Unknown User`;

        const messages = parser.parse(input);

        expect(messages.length).toBe(1);
        expect(messages[0].username).toBe('Real User');
        expect(messages[0].username).not.toBe('Unknown User');
        
        // Verify no Unknown User in any message
        const hasUnknownUser = messages.some(m => m.username === 'Unknown User');
        expect(hasUnknownUser).toBe(false);
    });
});