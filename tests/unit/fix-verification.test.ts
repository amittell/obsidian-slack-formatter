import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger } from '../helpers';

describe('Fix Verification - Unknown User Issue', () => {
  it('should NOT create Unknown User messages from the problematic input', () => {
    const input = `Jacob FreyJacob Frey  [7:13 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733943183106099?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
btw [[alex j]] wanted to mention yesterday the issue I've been tracking which mostly only happens with TypeScript seems related to not finding a good base directory, which should be fixed by the Pyright base directory fixes. The errors go away after switching files once or twice.
Jacob FreyJacob Frey  [7:44 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945054109689?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
Thanks for the info!
Alex J  [7:48 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945285113869?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
[7:48](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945309114539?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
yes when coding i do lots of cmd+p <select thing> esc
cmd+p <other thing> esc
etc.
but it seems like any file switching fixes it`;

    const parser = new IntelligentMessageParser({ debug: false }, { userMap: {}, emojiMap: {} });

    const messages = parser.parse(input, false);

    console.log('\n=== PARSED MESSAGES ===');
    messages.forEach((msg, i) => {
      console.log(`Message ${i}: "${msg.username}" -> "${msg.text?.substring(0, 50)}..."`);
    });

    // Should have 2 or 3 messages (boundary detection may merge Jacob's messages)
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages.length).toBeLessThanOrEqual(3);

    // NO messages should have "Unknown User" username
    const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
    expect(unknownUserMessages.length).toBe(0);

    // All key content should be captured
    const allText = messages.map(m => m.text || '').join(' ');
    expect(allText).toContain('btw [[alex j]] wanted to mention');
    expect(allText).toContain('Thanks for the info!');
    expect(allText).toContain('yes when coding i do lots of cmd+p');
    expect(allText).toContain('but it seems like any file switching fixes it');

    // Jacob's messages
    const jacobMessages = messages.filter(m => m.username === 'Jacob Frey');
    expect(jacobMessages.length).toBeGreaterThanOrEqual(1);
    expect(jacobMessages.length).toBeLessThanOrEqual(2);

    // Alex's message
    const alexMessages = messages.filter(m => m.username === 'Alex J');
    expect(alexMessages.length).toBe(1);

    // Check content exists in Jacob's messages (may be merged or separate)
    const jacobText = jacobMessages.map(m => m.text || '').join(' ');
    expect(jacobText).toContain('btw [[alex j]] wanted to mention');
    expect(jacobText).toContain('Thanks for the info!');

    // Check Alex's content
    expect(alexMessages[0].text).toContain('yes when coding i do lots of cmd+p');
    expect(alexMessages[0].text).toContain('but it seems like any file switching fixes it');
  });
});
