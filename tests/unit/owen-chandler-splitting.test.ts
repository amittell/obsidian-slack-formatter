import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Owen Chandler Message Splitting', () => {
    it('should split Owen Chandler into 2 separate messages at #CONTEXT# boundary', () => {
        // Test that #CONTEXT# creates a message boundary, splitting Owen's content into two distinct messages
        const input = `Owen Chandler
Jun 8th at 6:28 PM
Initial message content here.

#CONTEXT#
You're finding the rep's longest monologue in a transcript.`;

        const parser = new IntelligentMessageParser();
        const messages = parser.parse(input);
        
        if (process.env.DEBUG_TESTS) {
            console.log('\n=== OWEN CHANDLER SPLITTING TEST ===');
            console.log(`Total messages detected: ${messages.length}`);
            
            messages.forEach((msg, i) => {
                console.log(`\nMessage ${i + 1}:`);
                console.log(`  Username: "${msg.username}"`);
                console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
                console.log(`  Text length: ${msg.text?.length || 0}`);
                console.log(`  Starts with #CONTEXT#: ${msg.text?.trim().startsWith('#CONTEXT#')}`);
                console.log(`  Text preview: "${msg.text?.substring(0, 100) || ''}..."`);
            });
        }
        
        // Filter Owen messages
        const owenMessages = messages.filter(msg => msg.username === 'Owen Chandler');
        
        if (process.env.DEBUG_TESTS) {
            console.log(`\nOwen Chandler messages: ${owenMessages.length}`);
        }
        
        // Based on task description, Owen should have 2 separate messages
        // 1. Initial message (may be empty in this test data)
        // 2. Message starting with #CONTEXT#
        
        // For now, let's test what we expect to see after the fix
        if (owenMessages.length >= 1) {
            const contextMessage = owenMessages.find(msg => msg.text?.includes('#CONTEXT#'));
            const nonContextMessage = owenMessages.find(msg => !msg.text?.includes('#CONTEXT#'));
            
            if (process.env.DEBUG_TESTS) {
                console.log(`Message with #CONTEXT#: ${contextMessage ? 'Found' : 'Not found'}`);
                console.log(`Message without #CONTEXT#: ${nonContextMessage ? 'Found' : 'Not found'}`);
                
                if (owenMessages.length === 1) {
                    console.log('❌ CURRENT: Only 1 Owen message (merging issue)');
                    console.log('Expected: #CONTEXT# should create separate message');
                } else {
                    console.log('✅ SUCCESS: Multiple Owen messages detected');
                }
            }
        }
        
        // The main assertion - we expect at least one message containing #CONTEXT#
        // This will help us verify our fix is working
        const hasContextMessage = messages.some(msg => 
            msg.text?.includes('#CONTEXT#') && msg.username === 'Owen Chandler'
        );
        
        // Specific expectations for the desired end state:
        // 1. Owen Chandler should have exactly 2 separate messages
        expect(owenMessages.length).toBe(2);
        
        // 2. One message should contain the initial content (before #CONTEXT#)
        const initialMessage = owenMessages.find(msg => 
            !msg.text?.includes('#CONTEXT#') && 
            msg.text?.includes('Initial message content here.')
        );
        expect(initialMessage).toBeDefined();
        expect(initialMessage?.username).toBe('Owen Chandler');
        expect(initialMessage?.timestamp).toBe('Jun 8th at 6:28 PM');
        
        // 3. One message should contain the #CONTEXT# content
        const contextMessage = owenMessages.find(msg => 
            msg.text?.includes('#CONTEXT#') &&
            msg.text?.includes("You're finding the rep's longest monologue in a transcript.")
        );
        expect(contextMessage).toBeDefined();
        expect(contextMessage?.username).toBe('Owen Chandler');
        expect(contextMessage?.text?.trim().startsWith('#CONTEXT#')).toBe(true);
        
        if (process.env.DEBUG_TESTS) {
            console.log(`\n=== SUMMARY ===`);
            console.log(`Owen messages: ${owenMessages.length}`);
            console.log(`Total messages: ${messages.length}`);
            console.log(`Has #CONTEXT# message: ${hasContextMessage}`);
        }
    });
});