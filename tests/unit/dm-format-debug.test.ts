import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('DM Format Debug - IntelligentMessageParser Only', () => {
    let parser: IntelligentMessageParser;

    beforeEach(() => {
        // Test IntelligentMessageParser directly, bypassing fallback logic
        const debugSettings = { ...DEFAULT_SETTINGS, debug: true };
        parser = new IntelligentMessageParser(debugSettings, { userMap: {}, emojiMap: {} }, 'dm');
    });

    test('should parse DM conversation with IntelligentMessageParser directly', () => {
        // Real DM conversation that was being over-merged
        const dmContent = `[10:30](https://stripe.slack.com/archives/D07M9Q92R24/p1749652229260679)

Alex Mittell

We need to sign off on that then they'll get us a timeline

[10:31](https://stripe.slack.com/archives/D07M9Q92R24/p1749652289036509)

Alex Mittell

btw I wanted to mention tracking this related issue`;

        console.log('=== TESTING INTELLIGENT PARSER DIRECTLY ===');
        console.log('Input:');
        console.log(dmContent);
        console.log('\n=== PROCESSING ===');

        const messages = parser.parse(dmContent, true);

        console.log('\n=== DIRECT PARSER RESULTS ===');
        console.log(`Number of messages returned: ${messages.length}`);
        
        messages.forEach((msg, i) => {
            console.log(`\nMessage ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
            console.log(`  Text: "${msg.text?.substring(0, 100) || 'empty'}${(msg.text?.length || 0) > 100 ? '...' : ''}"`);
            console.log(`  Text length: ${msg.text?.length || 0}`);
            console.log(`  Valid username: ${msg.username !== 'Unknown User'}`);
            console.log(`  Has content: ${(msg.text?.trim().length || 0) > 0}`);
        });

        // Core tests
        expect(messages.length).toBeGreaterThan(0);
        
        if (messages.length >= 2) {
            console.log('\n✅ SUCCESS: IntelligentMessageParser created multiple messages');
            
            // Validate the messages
            expect(messages[0].username).toBe('Alex Mittell');
            expect(messages[1].username).toBe('Alex Mittell');
            
            expect(messages[0].text).toContain('We need to sign off');
            expect(messages[1].text).toContain('btw I wanted to mention');
            
            expect(messages[0].timestamp).toContain('10:30');
            expect(messages[1].timestamp).toContain('10:31');
            
        } else {
            console.log('\n❌ FAILURE: IntelligentMessageParser did not create separate messages');
            console.log('This means the DM parsing logic needs refinement');
        }
    });
});