import { describe, it, expect, beforeEach } from '@jest/globals';
import { SlackMessage } from '../../src/models.ts';
import {
  EmbeddedMessageDetector,
  EmbeddedContentType,
} from '../../src/formatter/processors/embedded-message-detector.ts';
import { ContentDeduplicationProcessor } from '../../src/formatter/processors/content-deduplication-processor.ts';
import {
  MessageStructureValidator,
  ValidationSeverity,
} from '../../src/formatter/validators/message-structure-validator.ts';
import {
  OutputFormattingStandards,
  ContentType,
} from '../../src/formatter/standards/output-formatting-standards.ts';
import { SlackFormatSettings } from '../../src/types/settings.types.js';

describe('Message Structure & Deduplication', () => {
  let embeddedDetector: EmbeddedMessageDetector;
  let deduplicationProcessor: ContentDeduplicationProcessor;
  let structureValidator: MessageStructureValidator;
  let formattingStandards: OutputFormattingStandards;
  let defaultSettings: SlackFormatSettings;

  beforeEach(() => {
    defaultSettings = {
      // Core formatting options
      detectCodeBlocks: false,
      convertUserMentions: false,
      replaceEmoji: false,
      parseSlackTimes: false,
      highlightThreads: false,
      convertSlackLinks: false,

      // Maps (JSON strings)
      userMapJson: '{}',
      emojiMapJson: '{}',

      // UI options
      hotkeyMode: 'dedicatedHotkey',
      maxLines: 1000,
      enablePreviewPane: false,
      enableConfirmationDialog: false,
      showSuccessMessage: false,

      // Thread options
      collapseThreads: false,
      threadCollapseThreshold: 10,

      // Frontmatter options
      frontmatterCssClass: '',
      frontmatterTitle: '',

      // Advanced options
      timeZone: 'UTC',
      debug: true,
    } as SlackFormatSettings;

    embeddedDetector = new EmbeddedMessageDetector(true);
    deduplicationProcessor = new ContentDeduplicationProcessor(true);
    structureValidator = new MessageStructureValidator(true);
    formattingStandards = new OutputFormattingStandards(defaultSettings);
  });

  describe('EmbeddedMessageDetector', () => {
    it('should detect link preview blocks', () => {
      const message = new SlackMessage();
      message.text = `Check this out:
https://example.com/article
Great Article Title
This is a description of the article content.`;
      message.username = 'John Doe';

      const result = embeddedDetector.analyzeMessage(message);

      expect(result.hasEmbedded).toBe(true);
      expect(result.embeddedContent).toHaveLength(1);
      expect(result.embeddedContent[0].type).toBe(EmbeddedContentType.LINK_PREVIEW);
      expect(result.embeddedContent[0].metadata?.url).toBe('https://example.com/article');
      expect(result.cleanedText).toBe('Check this out:');
    });

    it('should detect file attachment blocks', () => {
      const message = new SlackMessage();
      message.text = `Here's the document:

[Stripe+Guidewire_Value_Card.pdf](https://files.slack.com/files-pri/T0181S17H6Z-F0916SPEBCH/stripe_guidewire_value_card.pdf)

PDF

4 files`;
      message.username = 'Jane Smith';

      const result = embeddedDetector.analyzeMessage(message);

      expect(result.hasEmbedded).toBe(true);
      expect(result.embeddedContent).toHaveLength(1);
      expect(result.embeddedContent[0].type).toBe(EmbeddedContentType.FILE_ATTACHMENT);
      expect(result.embeddedContent[0].metadata?.fileType).toBe('PDF');
    });

    it('should detect quoted message blocks', () => {
      const message = new SlackMessage();
      message.text = `Alex Mittell  [1:14 PM]
Hi @amybrito, we are in product development currently...

Previous message content here`;
      message.username = 'Replier';

      const result = embeddedDetector.analyzeMessage(message);

      expect(result.hasEmbedded).toBe(true);
      expect(result.embeddedContent).toHaveLength(1);
      expect(result.embeddedContent[0].type).toBe(EmbeddedContentType.QUOTED_MESSAGE);
    });

    it('should detect reaction continuation blocks', () => {
      const message = new SlackMessage();
      message.text = `Great idea!
:+1: 3
:fire: 2
4`;
      message.username = 'User';

      const result = embeddedDetector.analyzeMessage(message);

      expect(result.hasEmbedded).toBe(true);
      expect(result.embeddedContent).toHaveLength(1);
      expect(result.embeddedContent[0].type).toBe(EmbeddedContentType.REACTIONS);
      expect(result.cleanedText).toBe('Great idea!');
    });

    it('should handle messages with no embedded content', () => {
      const message = new SlackMessage();
      message.text = 'Just a regular message with no embedded content.';
      message.username = 'User';

      const result = embeddedDetector.analyzeMessage(message);

      expect(result.hasEmbedded).toBe(false);
      expect(result.embeddedContent).toHaveLength(0);
      expect(result.cleanedText).toBe('Just a regular message with no embedded content.');
    });
  });

  describe('ContentDeduplicationProcessor', () => {
    it('should remove duplicate content blocks', () => {
      const messages = [
        createMessage('User1', 'Original message with unique content'),
        createMessage(
          'User2',
          'Another message with https://example.com/link\nLink Title\nLink description'
        ),
        createMessage('User3', 'Response to the first message'),
        createMessage(
          'User2',
          'https://example.com/link\nLink Title\nLink description\nSame link shared again'
        ),
      ];

      const result = deduplicationProcessor.process(messages);

      expect(result.removedDuplicates).toBeGreaterThan(0);
      expect(result.messages.length).toBeLessThanOrEqual(messages.length);
      expect(result.preservedContext).toBeGreaterThan(0);
    });

    it('should preserve context while removing duplicates', () => {
      const messages = [
        createMessage('User1', 'Context message'),
        createMessage('User2', 'Important discussion point'),
        createMessage('User1', 'Context message'), // Exact duplicate
        createMessage('User3', 'Follow-up response'),
      ];

      const result = deduplicationProcessor.process(messages);

      expect(result.messages).toHaveLength(3); // One duplicate removed
      expect(result.removedDuplicates).toBe(1);

      // Verify context preservation
      const usernames = result.messages.map(m => m.username);
      expect(usernames).toContain('User1');
      expect(usernames).toContain('User2');
      expect(usernames).toContain('User3');
    });

    it('should handle similar but not identical content', () => {
      const messages = [
        createMessage('User1', 'This is a message about project X'),
        createMessage('User1', 'This is a message about project Y'),
        createMessage('User2', 'Different content entirely'),
      ];

      const result = deduplicationProcessor.process(messages);

      // Should not remove dissimilar content
      expect(result.messages).toHaveLength(3);
      expect(result.removedDuplicates).toBe(0);
    });

    it('should handle empty input gracefully', () => {
      const result = deduplicationProcessor.process([]);

      expect(result.messages).toHaveLength(0);
      expect(result.removedDuplicates).toBe(0);
      expect(result.preservedContext).toBe(0);
    });
  });

  describe('MessageStructureValidator', () => {
    it('should validate message structure integrity', () => {
      const messages = [
        createMessage('John Doe', 'Valid message with content', '12:30 PM'),
        createMessage('Jane Smith', 'Another valid message', '12:31 PM'),
        createMessage('', 'Message with empty username', '12:32 PM'),
        createMessage('Bob Wilson', '', '12:33 PM'), // Empty content
      ];

      const result = structureValidator.validate(messages);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);

      // Check for specific issues
      const errorIssues = result.issues.filter(i => i.severity === ValidationSeverity.ERROR);
      expect(errorIssues.length).toBeGreaterThan(0);

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it('should detect suspicious usernames', () => {
      const messages = [
        createMessage('John Doe', 'Valid message'),
        createMessage('Unknown', 'Suspicious username'),
        createMessage('123', 'Numeric username'),
        createMessage('undefined', 'Invalid username'),
      ];

      const result = structureValidator.validate(messages);

      expect(result.stats.suspiciousUsernames.length).toBeGreaterThan(0);
      expect(result.stats.suspiciousUsernames).toContain('Unknown');
      expect(result.stats.suspiciousUsernames).toContain('123');
      expect(result.stats.suspiciousUsernames).toContain('undefined');
    });

    it('should validate timestamp presence and format', () => {
      const messages = [
        createMessage('User1', 'Message with timestamp', '12:30 PM'),
        createMessage('User2', 'Message without timestamp'),
        createMessage('User3', 'Message with malformed timestamp', 'bad'),
      ];

      const result = structureValidator.validate(messages);

      const timestampIssues = result.issues.filter(
        i => i.type === 'missing_timestamp' || i.type === 'invalid_timestamp'
      );
      expect(timestampIssues.length).toBeGreaterThan(0);

      expect(result.stats.messagesWithTimestamps).toBe(1);
    });

    it('should provide quality score and recommendations', () => {
      const messages = [
        createMessage('User1', 'Good message', '12:30 PM'),
        createMessage('User2', 'Another good message', '12:31 PM'),
      ];

      const result = structureValidator.validate(messages);

      expect(result.score).toBeGreaterThan(50);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should detect duplicate messages', () => {
      const messages = [
        createMessage('User1', 'Duplicate content'),
        createMessage('User1', 'Duplicate content'),
        createMessage('User2', 'Unique content'),
      ];

      const result = structureValidator.validate(messages);

      const duplicateIssues = result.issues.filter(i => i.type === 'duplicate_message');
      expect(duplicateIssues.length).toBe(1);
    });
  });

  describe('OutputFormattingStandards', () => {
    it('should format messages with consistent standards', () => {
      const messages = [
        createMessage('John Doe', 'First message', '12:30 PM'),
        createMessage('Jane Smith', 'Second message', '12:31 PM'),
      ];

      const formattedMessages = formattingStandards.formatMessages(messages);

      expect(formattedMessages).toHaveLength(2);
      formattedMessages.forEach(formatted => {
        expect(formatted.content).toBeTruthy();
        expect(formatted.type).toBeDefined();
        expect(formatted.metadata).toBeDefined();
        expect(formatted.metadata.username).toBeTruthy();
      });
    });

    it('should determine content types correctly', () => {
      const regularMessage = createMessage('User', 'Regular message');
      const threadReply = createMessage('User', 'Thread reply');
      threadReply.isThreadReply = true;

      const fileMessage = createMessage('User', 'Check out this file: document.pdf');

      const formatted1 = formattingStandards.formatMessage(regularMessage);
      const formatted2 = formattingStandards.formatMessage(threadReply);
      const formatted3 = formattingStandards.formatMessage(fileMessage);

      expect(formatted1.type).toBe(ContentType.REGULAR_MESSAGE);
      expect(formatted2.type).toBe(ContentType.THREAD_REPLY);
      expect(formatted3.type).toBe(ContentType.FILE_ATTACHMENT);
    });

    it('should apply different formatting standards', () => {
      const message = createMessage('User', 'Test message', '12:30 PM');

      const conversationFormat = formattingStandards.formatMessage(message, {
        standardType: 'CONVERSATION',
      });

      const compactFormat = formattingStandards.formatMessage(message, {
        standardType: 'COMPACT',
      });

      expect(conversationFormat.content).not.toBe(compactFormat.content);
      expect(conversationFormat.content.length).toBeGreaterThan(compactFormat.content.length);
    });

    it('should combine multiple messages properly', () => {
      const messages = [
        createMessage('User1', 'First message'),
        createMessage('User2', 'Second message'),
        createMessage('User3', 'Third message'),
      ];

      const formattedMessages = formattingStandards.formatMessages(messages);
      const combined = formattingStandards.combineMessages(formattedMessages);

      expect(combined).toBeTruthy();
      expect(combined.includes('First message')).toBe(true);
      expect(combined.includes('Second message')).toBe(true);
      expect(combined.includes('Third message')).toBe(true);
    });

    it('should apply standards to message arrays', () => {
      const messages = [
        createMessage('User1', 'Test message 1'),
        createMessage('User2', 'Test message 2'),
      ];

      const result = formattingStandards.applyStandards(messages);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.includes('Test message 1')).toBe(true);
      expect(result.includes('Test message 2')).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should process embedded content and deduplicate in sequence', () => {
      const messages = [
        createMessage(
          'User1',
          `Original message
https://example.com/link
Link Title
Link Description`
        ),
        createMessage('User2', 'Response to original'),
        createMessage(
          'User1',
          `Same link again:
https://example.com/link
Link Title
Link Description`
        ),
      ];

      // First, detect embedded content
      const embeddedResults = messages.map(msg => embeddedDetector.analyzeMessage(msg));

      // Apply deduplication
      const deduplicationResult = deduplicationProcessor.process(messages);

      // Validate structure
      const validationResult = structureValidator.validate(deduplicationResult.messages);

      expect(embeddedResults.some(r => r.hasEmbedded)).toBe(true);
      expect(deduplicationResult.removedDuplicates).toBeGreaterThan(0);
      expect(validationResult.score).toBeGreaterThan(0);
    });

    it('should maintain message integrity through full pipeline', () => {
      const originalMessages = [
        createMessage('John Doe', 'Important business discussion', '9:00 AM'),
        createMessage('Jane Smith', 'I agree with your points', '9:01 AM'),
        createMessage('Bob Wilson', 'Let me share this document: report.pdf', '9:02 AM'),
      ];

      // Process through all components
      const deduplicationResult = deduplicationProcessor.process(originalMessages);
      const validationResult = structureValidator.validate(deduplicationResult.messages);
      const formattedResult = formattingStandards.applyStandards(deduplicationResult.messages);

      expect(deduplicationResult.messages.length).toBeGreaterThan(0);
      expect(validationResult.isValid).toBe(true);
      expect(formattedResult).toBeTruthy();
      expect(formattedResult.includes('John Doe')).toBe(true);
      expect(formattedResult.includes('Jane Smith')).toBe(true);
      expect(formattedResult.includes('Bob Wilson')).toBe(true);
    });
  });

  // Helper function to create test messages
  function createMessage(username: string, text: string, timestamp?: string): SlackMessage {
    const message = new SlackMessage();
    message.username = username;
    message.text = text;
    message.timestamp = timestamp || null;
    message.id = `msg_${Math.random().toString(36).substr(2, 9)}`;
    message.reactions = [];
    message.isThreadReply = false;
    message.isThreadStart = false;
    message.threadInfo = null;
    message.isEdited = false;
    return message;
  }
});
