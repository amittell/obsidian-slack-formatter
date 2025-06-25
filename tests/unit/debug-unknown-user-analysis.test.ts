import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { readFileSync } from 'fs';

describe('Debug Unknown User Analysis', () => {
    it('should analyze what creates Unknown User messages', () => {
        const input = readFileSync('./test-channel-sample.txt', 'utf8');
        console.log('\n=== ANALYZING UNKNOWN USER ISSUE ===');
        console.log('Input preview:');
        console.log(input.substring(0, 200) + '...\n');
        
        const parser = new IntelligentMessageParser(
            { debug: false }, // Set to false for cleaner output
            { userMap: {}, emojiMap: {} }
        );
        
        const messages = parser.parse(input, false);
        
        console.log(`\n=== PARSED ${messages.length} MESSAGES ===`);
        
        messages.forEach((msg, i) => {
            const isUnknown = msg.username === 'Unknown User';
            console.log(`\nMessage ${i}: ${isUnknown ? '⚠️  UNKNOWN USER' : '✅ ' + msg.username}`);
            console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
            console.log(`  Text: "${msg.text?.substring(0, 100) || '(empty)'}${msg.text?.length > 100 ? '...' : ''}"`);
            console.log(`  Text length: ${msg.text?.length || 0}`);
            
            if (isUnknown) {
                console.log(`  🔍 ANALYSIS: This message has no username extracted`);
                console.log(`  📝 Full text: "${msg.text}"`);
                
                // Analyze what type of content this is
                const text = msg.text || '';
                if (text.includes('![](https://ca.slack-edge.com/')) {
                    console.log(`  🖼️  TYPE: Avatar/image content`);
                } else if (text.includes('replies') || text.includes('View thread')) {
                    console.log(`  🧵 TYPE: Thread metadata`);
                } else if (text.match(/^\d+\s+(?:files?|replies?)$/i)) {
                    console.log(`  📁 TYPE: File/reply count metadata`);
                } else if (text.match(/^Message\s+.*$/i)) {
                    console.log(`  📱 TYPE: System message`);
                } else if (text.match(/^Added by/i)) {
                    console.log(`  🔗 TYPE: Link preview metadata`);
                } else if (text.length < 50 && text.match(/^[A-Za-z\s]+$/)) {
                    console.log(`  👤 TYPE: Possible orphaned username`);
                } else {
                    console.log(`  ❓ TYPE: Other/Unknown content type`);
                }
            }
        });
        
        // Count unknown user messages
        const unknownCount = messages.filter(m => m.username === 'Unknown User').length;
        console.log(`\n=== SUMMARY ===`);
        console.log(`Total messages: ${messages.length}`);
        console.log(`Unknown User messages: ${unknownCount}`);
        console.log(`Percentage Unknown: ${((unknownCount / messages.length) * 100).toFixed(1)}%`);
        
        // Show input lines that might be causing issues
        console.log(`\n=== INPUT ANALYSIS ===`);
        const lines = input.split('\n');
        lines.forEach((line, i) => {
            const trimmed = line.trim();
            if (trimmed && (
                trimmed.startsWith('![](https://ca.slack-edge.com/') ||
                trimmed.includes('replies') ||
                trimmed.includes('View thread') ||
                trimmed.startsWith('Message ') ||
                trimmed.startsWith('Added by')
            )) {
                console.log(`Line ${i}: "${trimmed}"`);
            }
        });
        
        // Test should pass - this is just for analysis
        expect(messages.length).toBeGreaterThan(0);
    });
});