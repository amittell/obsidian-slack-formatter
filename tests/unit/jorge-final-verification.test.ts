import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';

describe('Jorge Macias Detection - Final Verification', () => {
  let parser: IntelligentMessageParser;

  beforeEach(() => {
    parser = new IntelligentMessageParser();
  });

  it('should detect Jorge Macias message as described in screenshot', () => {
    // Exact scenario from IMG_3520.PNG: Jorge Macias (Jun 9th) has message: "easy, tell prospects to never cough on a call 🤣"
    const jorgeMessage = `Jorge Macias
Jun 9th at 6:28 PM
easy, tell prospects to never cough on a call 🤣`;

    const messages = parser.parse(jorgeMessage, false); // Don't need debug output

    // Jorge's message should be detected as a single, complete message
    expect(messages.length).toBe(1);

    const message = messages[0];
    expect(message.username).toBe('Jorge Macias');
    expect(message.text).toContain('easy, tell prospects to never cough on a call');
    expect(message.text).toContain('🤣');
    expect(message.timestamp).toContain('6:28 PM');

    // Verify the message appears in final output with complete content
    expect(message.username).not.toBe('Unknown User');
    expect(message.text).not.toBe('');
  });

  it('should handle Jorge message in context with other messages', () => {
    // Test Jorge's message in a conversation context
    const conversation = `Previous User
Some previous message content

Jorge Macias
Jun 9th at 6:28 PM
easy, tell prospects to never cough on a call 🤣

Next User
Some next message content`;

    const messages = parser.parse(conversation, false);

    // Should find at least Jorge's message (may find others too)
    expect(messages.length).toBeGreaterThan(0);

    // Find Jorge's message specifically
    const jorgeMessage = messages.find(msg => msg.username === 'Jorge Macias');
    expect(jorgeMessage).toBeDefined();
    expect(jorgeMessage!.text).toContain('easy, tell prospects to never cough on a call');
    expect(jorgeMessage!.text).toContain('🤣');
  });

  it('should handle variations of Jorge message format', () => {
    const variations = [
      // With full timestamp
      `Jorge Macias
Jun 9th at 6:28 PM
easy, tell prospects to never cough on a call 🤣`,

      // With simple timestamp
      `Jorge Macias
6:28 PM
easy, tell prospects to never cough on a call 🤣`,

      // Without emoji
      `Jorge Macias
Jun 9th at 6:28 PM
easy, tell prospects to never cough on a call`,

      // Different emoji
      `Jorge Macias
Jun 9th at 6:28 PM
easy, tell prospects to never cough on a call 😂`,
    ];

    variations.forEach((variation, index) => {
      const messages = parser.parse(variation, false);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].username).toBe('Jorge Macias');
      expect(messages[0].text).toContain('easy, tell prospects to never cough on a call');
    });
  });
});
