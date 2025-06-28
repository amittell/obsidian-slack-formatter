import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { ImprovedFormatDetector } from '../../src/formatter/stages/improved-format-detector';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { TestLogger } from '../helpers';

describe('Multi-Person DM Parsing Fixes', () => {
  const multiPersonDMSample = `![](https://ca.slack-edge.com/E0181S17H6Z-U023H2QHYG1-79ffd588753a-48)

Amy BritoAmy Brito  [12:36 PM](https://stripe.slack.com/archives/C08K7SJG3LG/p1749573392955799)  

Hi Alex, Shannon, what package of materials are we ready to take to Infosys on continued discussions with their Insurance team on Guidewire?

[12:36](https://stripe.slack.com/archives/C08K7SJG3LG/p1749573410932379)

Amy Brito

we've had this discussion already with PWC but it was just a short overview

![](https://ca.slack-edge.com/E0181S17H6Z-U07JC6P29UM-67fda94224a3-48)

Alex MittellAlex Mittell  [1:14 PM](https://stripe.slack.com/archives/C08K7SJG3LG/p1749575654085999)  

Hi [@amybrito](https://stripe.slack.com/team/U023H2QHYG1), we are in product development currently

[1:15](https://stripe.slack.com/archives/C08K7SJG3LG/p1749575654085999)

Alex Mittell

Here are some additional details about our progress`;

  const userMap = {
    U023H2QHYG1: 'Amy Brito',
    U07JC6P29UM: 'Alex Mittell',
  };

  it('should detect multi-person DM format correctly', () => {
    const detector = new ImprovedFormatDetector();
    const detectedFormat = detector.detectFormat(multiPersonDMSample);

    expect(detectedFormat).toBe('dm');
  });

  it('should parse multi-person DM into separate messages with IntelligentMessageParser', () => {
    const settings = { ...DEFAULT_SETTINGS, debug: true };
    const parsedMaps = { userMap, emojiMap: {} };
    const parser = new IntelligentMessageParser(settings, parsedMaps, 'dm');

    const messages = parser.parse(multiPersonDMSample, true);

    TestLogger.log('=== IntelligentMessageParser Results ===');
    TestLogger.log(`Number of messages: ${messages.length}`);
    messages.forEach((msg, i) => {
      TestLogger.log(`Message ${i + 1}:`);
      TestLogger.log(`  Username: "${msg.username}"`);
      TestLogger.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
      TestLogger.log(`  Text preview: "${msg.text?.substring(0, 100) || 'empty'}..."`);
    });

    // Should parse into at least 2 messages (the main messages from Amy and Alex)
    // Note: Continuation logic may merge some continuation messages
    expect(messages.length).toBeGreaterThanOrEqual(2);

    // Should extract usernames correctly (not "Unknown User")
    const unknownUserCount = messages.filter(msg => msg.username === 'Unknown User').length;
    expect(unknownUserCount).toBe(0);

    // Should have messages from both users (may be merged due to continuation logic)
    const amyMessages = messages.filter(
      msg => msg.username === 'Amy Brito' || msg.username?.includes('Amy')
    );
    const alexMessages = messages.filter(
      msg => msg.username === 'Alex Mittell' || msg.username?.includes('Alex')
    );

    expect(amyMessages.length).toBeGreaterThanOrEqual(1);
    expect(alexMessages.length).toBeGreaterThanOrEqual(1);

    // Should have timestamps
    const messagesWithTimestamps = messages.filter(msg => msg.timestamp && msg.timestamp !== '');
    expect(messagesWithTimestamps.length).toBeGreaterThanOrEqual(2);
  });

  it('should parse multi-person DM into separate messages with FlexibleMessageParser', () => {
    const settings = { ...DEFAULT_SETTINGS, debug: true };
    const parser = new FlexibleMessageParser();

    const messages = parser.parse(multiPersonDMSample, true);

    TestLogger.log('=== FlexibleMessageParser Results ===');
    TestLogger.log(`Number of messages: ${messages.length}`);
    messages.forEach((msg, i) => {
      TestLogger.log(`Message ${i + 1}:`);
      TestLogger.log(`  Username: "${msg.username}"`);
      TestLogger.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
      TestLogger.log(`  Text preview: "${msg.text?.substring(0, 100) || 'empty'}..."`);
    });

    // Should parse into multiple messages
    expect(messages.length).toBeGreaterThanOrEqual(2);

    // Should extract some usernames correctly
    const validUsernames = messages.filter(
      msg => msg.username !== 'Unknown User' && msg.username && msg.username.trim() !== ''
    );
    expect(validUsernames.length).toBeGreaterThan(0);
  });

  it('should format multi-person DM conversation correctly with SlackFormatter', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      debug: true,
      userMapJson: JSON.stringify(userMap),
      emojiMapJson: JSON.stringify({}),
    };

    const formatter = new SlackFormatter(settings, userMap, {});
    const parsedMaps = { userMap, emojiMap: {} };

    const result = formatter.formatSlackContent(multiPersonDMSample, settings, parsedMaps);

    TestLogger.log('=== SlackFormatter Results ===');
    TestLogger.log(result);

    // Should contain formatted message blocks
    expect(result).toContain('> [!slack]+');

    // Should contain both usernames
    expect(result).toContain('Amy Brito');
    expect(result).toContain('Alex Mittell');

    // Should not contain "Unknown User"
    expect(result).not.toContain('Unknown User');

    // Should contain timestamps
    expect(result).toMatch(/12:36|1:14|1:15/);

    // Count message blocks
    const messageBlocks = (result.match(/> \[!slack\]\+/g) || []).length;
    TestLogger.log(`Number of message blocks: ${messageBlocks}`);

    // Should have multiple message blocks
    expect(messageBlocks).toBeGreaterThanOrEqual(2);
  });

  it('should handle doubled username patterns correctly', () => {
    const testLines = [
      'Amy BritoAmy Brito  [12:36 PM](https://stripe.slack.com/archives/C08K7SJG3LG/p1749573392955799)',
      'Alex MittellAlex Mittell  [1:14 PM](https://stripe.slack.com/archives/C08K7SJG3LG/p1749575654085999)',
      'John DoeJohn Doe [3:45 PM](https://example.slack.com/archives/C123/p456)',
    ];

    testLines.forEach(line => {
      // Test format detection patterns
      const detector = new ImprovedFormatDetector();
      const miniSample = `![](https://ca.slack-edge.com/test.jpg)\n\n${line}\n\nTest message content`;
      const format = detector.detectFormat(miniSample);

      expect(format).toBe('dm');

      // Test pattern matching
      const doubledPattern = /^([A-Za-z\s\u00C0-\u017F]+)\1\s+\[\d{1,2}:\d{2}\s*(?:AM|PM)?\]/;
      expect(doubledPattern.test(line)).toBe(true);
    });
  });
});
