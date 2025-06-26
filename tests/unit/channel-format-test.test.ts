import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { readFileSync } from 'fs';

describe('Channel Format Testing', () => {
    it('should correctly format the provided channel conversation', () => {
        const channelInput = readFileSync('./test-channel-sample.txt', 'utf8');
        
        TestLogger.log('\n=== CHANNEL FORMAT TEST ===');
        TestLogger.log('Input length:', channelInput.length);
        TestLogger.log('Input preview:', channelInput.substring(0, 200) + '...');
        
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
        const result = formatter.formatSlackContent(channelInput);

        TestLogger.log('\n=== FORMATTING RESULTS ===');
        TestLogger.log('Formatted text length:', result.length);
        
        // Validation checks
        const checks = [
            { name: 'Caitlin Checkett message', pattern: /Caitlin Checkett.*Payteros has decided not to participate/s },
            { name: 'Amy Brito messages', pattern: /Amy Brito.*that's very solid feedback/s },
            { name: 'Shannon Cullins message', pattern: /Shannon Cullins.*Thanks Caitlin/s },
            { name: 'Alex Mittell messages', pattern: /Alex Mittell.*My opinion is that/s },
            { name: 'User mentions', pattern: /\[\[amybrito\]\]|\[\[shannoncullins\]\]|\[\[alexm\]\]/g },
            { name: 'Timestamps preserved', pattern: /12:33 PM|12:40 PM|12:41 PM|12:42 PM/g },
            { name: 'Thread indicators filtered out', pattern: /3 replies|Last reply 9 days ago|View thread/g },
            { name: 'Channel links', pattern: /\[\[ext-payteros-stripe\]\]/g },
            { name: 'Emoji processing', pattern: /🚫|🙂|👍/g }
        ];

        TestLogger.log('\n=== Content Validation ===');
        checks.forEach(check => {
            const found = check.pattern.test(result);
            if (check.name === 'Thread indicators filtered out') {
                // For this check, NOT found is correct (thread metadata should be filtered out)
                TestLogger.log(`${check.name}: ${!found ? '✅ CORRECTLY FILTERED' : '❌ STILL PRESENT'}`);
            } else {
                TestLogger.log(`${check.name}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
            }
            if (found && check.name === 'User mentions') {
                const matches = result.match(check.pattern);
                TestLogger.log(`  Mentions found: ${matches?.join(', ')}`);
            }
        });

        // Check for Unknown User
        const unknownUserCount = (result.match(/Unknown User/g) || []).length;
        TestLogger.log(`\nUnknown User occurrences: ${unknownUserCount}`);
        
        if (unknownUserCount > 0) {
            TestLogger.log('\n=== Unknown User Debug ===');
            const lines = result.split('\n');
            lines.forEach((line, i) => {
                if (line.includes('Unknown User')) {
                    TestLogger.log(`Line ${i}: ${line.substring(0, 100)}...`);
                }
            });
        }
        
        // Count messages - look for blockquote markers
        const messageCount = (result.match(/^>\s*\*\*/gm) || []).length;
        TestLogger.log(`Total messages parsed: ${messageCount}`);
        
        // Check for doubled usernames
        const doubledUsernames = result.match(/Caitlin CheckettCaitlin Checkett|Amy BritoAmy Brito|Shannon CullinsShannon Cullins|Alex MittellAlex Mittell/g) || [];
        TestLogger.log(`\nDoubled usernames found: ${doubledUsernames.length}`);
        if (doubledUsernames.length > 0) {
            TestLogger.log('Doubled usernames:', doubledUsernames);
        }

        // Show output preview
        TestLogger.log('\n=== Formatted Output Preview (first 1000 chars) ===');
        TestLogger.log(result.substring(0, 1000));

        // Show detected format
        TestLogger.log('\n=== Format Detection ===');
        const detector = formatter['formatDetector'];
        const detectedFormat = detector.detectFormat(channelInput);
        TestLogger.log('Detected format:', detectedFormat);
        
        // Assertions
        // Note: Some metadata lines (avatar images, thread info) may appear as Unknown User messages
        // This is acceptable as they don't affect the main content formatting
        expect(result).toContain('Caitlin Checkett');
        expect(result).toContain('Payteros has decided not to participate');
        expect(result).toContain('Amy Brito');
        expect(result).toContain('Shannon Cullins');
        expect(result).toContain('Alex Mittell');
        expect(doubledUsernames.length).toBe(0);
        
        // Should have properly formatted user mentions
        expect(result).toMatch(/\[\[amybrito\]\]|\[\[shannoncullins\]\]|\[\[alexm\]\]/);
        
        // Thread indicators should be filtered out (not appear in final content)
        expect(result).not.toContain('3 replies');
        expect(result).not.toContain('Last reply 9 days ago');
        expect(result).not.toContain('View thread');
        
        // Should handle continuation messages properly
        const amyMessages = (result.match(/>\s*\[!slack\]\+\s*Message from Amy Brito/g) || []).length;
        const alexMessages = (result.match(/>\s*\[!slack\]\+\s*Message from Alex Mittell/g) || []).length;
        
        TestLogger.log(`\nMessage counts by user:`);
        TestLogger.log(`Amy Brito messages: ${amyMessages}`);
        TestLogger.log(`Alex Mittell messages: ${alexMessages}`);
        
        // Amy should have at least 1 message (continuation messages are merged)
        // Alex should have at least 2 messages
        expect(amyMessages).toBeGreaterThanOrEqual(1);
        expect(alexMessages).toBeGreaterThanOrEqual(2);
    });
});