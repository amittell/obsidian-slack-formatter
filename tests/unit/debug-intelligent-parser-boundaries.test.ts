import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Debug IntelligentMessageParser Boundaries', () => {
    it('should analyze the exact message boundaries now being detected', () => {
        const input = `Jacob FreyJacob Frey  [7:13 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733943183106099?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
btw [[alex j]] wanted to mention yesterday the issue I've been tracking which mostly only happens with TypeScript seems related to not finding a good base directory, which should be fixed by the Pyright base directory fixes. The errors go away after switching files once or twice.
Jacob FreyJacob Frey  [7:44 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945054109689?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
Alex J  [7:48 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945285113869?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
[7:48](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945309114539?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
yes when coding i do lots of cmd+p <select thing> esc
cmd+p <other thing> esc
etc.
but it seems like any file switching fixes it`;

        const parser = new IntelligentMessageParser({ debug: true }, { userMap: {}, emojiMap: {} });
        const messages = parser.parse(input, true);

        console.log('\n=== INPUT LINES ===');
        input.split('\n').forEach((line, i) => {
            console.log(`${i}: "${line}"`);
        });

        console.log('\n=== PARSED MESSAGES ===');
        messages.forEach((msg, i) => {
            console.log(`\nMessage ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
            console.log(`  Text (${msg.text?.length || 0} chars):`);
            if (msg.text) {
                const lines = msg.text.split('\n');
                lines.forEach((line, j) => {
                    console.log(`    Line ${j}: "${line}"`);
                });
            }
        });

        // Check specific content inclusion
        const allText = messages.map(m => m.text).join(' ');
        console.log('\n=== CONTENT ANALYSIS ===');
        console.log('All message text combined:', allText.substring(0, 200) + '...');
        
        const keyPhrases = [
            'btw [[alex j]] wanted to mention',
            'yes when coding i do lots of cmd+p',
            'cmd+p <other thing> esc',
            'etc.',
            'but it seems like any file switching fixes it'
        ];
        
        keyPhrases.forEach(phrase => {
            const found = allText.includes(phrase);
            console.log(`"${phrase}": ${found ? '✓ FOUND' : '❌ MISSING'}`);
        });

        // For now, just log the count to understand what's happening
        console.log(`\nActual message count: ${messages.length} (expected 3)`);
        
        // expect(messages.length).toBe(3);
        
        // Verify all key content is captured
        expect(allText).toContain('btw [[alex j]] wanted to mention');
        expect(allText).toContain('yes when coding i do lots of cmd+p');
        expect(allText).toContain('but it seems like any file switching fixes it');
    });
});