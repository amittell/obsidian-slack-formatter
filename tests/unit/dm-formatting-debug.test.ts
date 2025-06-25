import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { SlackFormatter } from '../../src/formatter/slack-formatter';

describe('DM Formatting Issues Debug', () => {
    it('should handle the actual DM conversation format without Unknown User', () => {
        const dmInput = `[10:30](https://stripe.slack.com/archives/D07M9Q92R24/p1749652229260679)

Alex Mittell

We need to sign off on that then they'll get us a timeline

![](https://ca.slack-edge.com/E0181S17H6Z-U026L1H3VV5-1bdba36aa1fb-48)

Shaun MillinShaun Millin  [10:37 AM](https://stripe.slack.com/archives/D07M9Q92R24/p1749652641326439)  

Do we need to add the migration parts

[10:37](https://stripe.slack.com/archives/D07M9Q92R24/p1749652649157289)

Shaun Millin

not sure if anything is missing

[10:37](https://stripe.slack.com/archives/D07M9Q92R24/p1749652660383439)

Shaun Millin

but in milestones there is only a handful of things

[10:37](https://stripe.slack.com/archives/D07M9Q92R24/p1749652664193379)

Shaun Millin

well 2

[10:37](https://stripe.slack.com/archives/D07M9Q92R24/p1749652665852449)

Shaun Millin

lol

![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-67fda94224a3-48)

Alex MittellAlex Mittell  [10:38 AM](https://stripe.slack.com/archives/D07M9Q92R24/p1749652732636759)  

We only need to call out the high level steps, but probably need more than 2 lol

[10:39](https://stripe.slack.com/archives/D07M9Q92R24/p1749652761748459)

Alex Mittell

I updated the Toyota doc too, the one to send to the customer they asked us to validate`;

        console.log('\n=== TESTING DM FORMAT ===');
        console.log('Input length:', dmInput.length);
        console.log('Input preview:', dmInput.substring(0, 200) + '...');

        // Test with the parser directly
        const parser = new IntelligentMessageParser(
            { debug: true }, 
            { userMap: {}, emojiMap: {} }
        );
        
        const messages = parser.parse(dmInput, false);
        
        console.log('\n=== PARSER RESULTS ===');
        console.log('Number of messages:', messages.length);
        
        messages.forEach((msg, i) => {
            console.log(`\nMessage ${i}:`);
            console.log(`  Username: "${msg.username}"`);
            console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
            console.log(`  Text: "${msg.text?.substring(0, 100)}${msg.text?.length > 100 ? '...' : ''}"`);
            console.log(`  Text length: ${msg.text?.length || 0}`);
        });

        // Check for Unknown User
        const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
        console.log('\n=== UNKNOWN USER CHECK ===');
        console.log(`Unknown User messages: ${unknownUserMessages.length}`);

        if (unknownUserMessages.length > 0) {
            console.log('\n=== UNKNOWN USER DETAILS ===');
            unknownUserMessages.forEach((msg, i) => {
                console.log(`Unknown Message ${i}: "${msg.text?.substring(0, 100)}..."`);
            });
        }

        // Test with the full formatter
        console.log('\n=== TESTING FULL FORMATTER ===');
        const settings = {
            userMapJson: '{}',
            emojiMapJson: '{}',
            detectCodeBlocks: true,
            convertUserMentions: true,
            replaceEmoji: true,
            parseSlackTimes: true,
            highlightThreads: true,
            convertSlackLinks: true,
            debug: true
        };

        const formatter = new SlackFormatter(settings, {}, {});
        const result = formatter.formatSlackContent(dmInput);

        console.log('\n=== FORMATTER RESULTS ===');
        console.log('Formatted text length:', result.length);
        
        console.log('\n=== FORMATTED OUTPUT (first 500 chars) ===');
        console.log(result.substring(0, 500));
        
        const unknownUserCount = (result.match(/Unknown User/g) || []).length;
        console.log('\n=== UNKNOWN USER IN OUTPUT ===');
        console.log(`Unknown User occurrences: ${unknownUserCount}`);

        if (unknownUserCount > 0) {
            console.log('\n=== UNKNOWN USER CONTEXT ===');
            const lines = result.split('\n');
            lines.forEach((line, i) => {
                if (line.includes('Unknown User')) {
                    console.log(`Line ${i}: ${line}`);
                }
            });
        }

        // The actual assertions
        expect(unknownUserCount).toBe(0); // No Unknown User entries should appear
        expect(result).toContain('Alex Mittell');
        expect(result).toContain('Shaun Millin');
        expect(result).toContain('We need to sign off on that then they');
        expect(result).toContain('Do we need to add the migration parts');
    });
});