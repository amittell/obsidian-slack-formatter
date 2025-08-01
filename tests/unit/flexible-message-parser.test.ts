import { describe, it, expect } from '@jest/globals';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';

describe('FlexibleMessageParser - Message Continuations', () => {
  const parser = new FlexibleMessageParser();

  it('should properly handle continuation timestamps with [time](url) format', () => {
    const input = `Clement MiaoClement Miao  [Feb 7th at 8:25 AM](https://slack.com/archives/123)

this is AMAZING omg

[8:26](https://slack.com/archives/456)

even if a bit buggy, this is going to be great

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

    const messages = parser.parse(input, false);

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

    const messages = parser.parse(input, false);

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

    const messages = parser.parse(input, false);

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

    const messages = parser.parse(input, false);

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

    const messages = parser.parse(input, false);

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

    const messages = parser.parse(input, false);

    expect(messages.length).toBe(1);
    expect(messages[0].username).toBe('Real User');
    expect(messages[0].username).not.toBe('Unknown User');

    // Verify no Unknown User in any message
    const hasUnknownUser = messages.some(m => m.username === 'Unknown User');
    expect(hasUnknownUser).toBe(false);
  });
});
