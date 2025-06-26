import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { TestLogger } from '../helpers';

describe('DM Format Parsing Fix', () => {
    let formatter: SlackFormatter;

    beforeEach(() => {
        // Enable debug mode to see what's happening
        const debugSettings = { ...DEFAULT_SETTINGS, debug: true };
        formatter = new SlackFormatter(
            debugSettings,
            {},
            {}
        );
    });

    test('should parse DM conversation into separate messages, not over-merge', () => {
        // Real DM conversation that was being over-merged
        const dmContent = `[10:30](https://stripe.slack.com/archives/D07M9Q92R24/p1749652229260679)

Alex Mittell

We need to sign off on that then they'll get us a timeline

[10:31](https://stripe.slack.com/archives/D07M9Q92R24/p1749652289036509)

Alex Mittell

btw I wanted to mention tracking this related issue`;

        TestLogger.log('=== TESTING DM FORMAT PARSING ===');
        TestLogger.log('Input:');
        TestLogger.log(dmContent);
        TestLogger.log('\n=== PROCESSING ===');

        const result = formatter.formatSlackContent(dmContent);
        const stats = formatter.getThreadStats();

        TestLogger.log('\n=== RESULT ===');
        TestLogger.log(result);

        TestLogger.log('\n=== ANALYSIS ===');
        TestLogger.log(`Message count: ${stats.messageCount}`);
        TestLogger.log(`Format detected: ${stats.formatStrategy}`);

        // Count actual messages in output by looking for message patterns
        const messageBlocks = result.split(/(?=>\s*\*\*)/g).filter(block => block.trim());
        TestLogger.log(`Actual message blocks in output: ${messageBlocks.length}`);

        // CORE TEST: Should be 2 messages, not 1 giant merged message
        expect(stats.messageCount).toBe(2);
        expect(stats.formatStrategy).toBe('dm');

        // Additional validation: both messages should have same username
        expect(result).toContain('Alex Mittell');

        // Should have separate message blocks
        expect(messageBlocks.length).toBeGreaterThanOrEqual(2);

        // Both timestamps should be present
        expect(result).toContain('10:30');
        expect(result).toContain('10:31');

        // Both content pieces should be present but in separate messages
        expect(result).toContain('We need to sign off');
        expect(result).toContain('btw I wanted to mention');
    });
});