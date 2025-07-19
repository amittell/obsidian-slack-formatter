import { describe, it, expect } from '@jest/globals';
import { UnifiedProcessor } from '../../src/formatter/processors/unified-processor';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('Angle Bracket Escaping', () => {
  describe('with default settings (all processors enabled)', () => {
    const processor = new UnifiedProcessor(DEFAULT_SETTINGS);

    it('should escape standalone angle brackets like <oneaway>', () => {
      const input = 'Hey everyone! our team at <oneaway> is looking to hire.';
      const result = processor.process(input);
      expect(result.content).toContain('&lt;oneaway&gt;');
      expect(result.content).not.toContain('<oneaway>');
    });

    it('should process Slack user mentions normally (not escape them)', () => {
      const input = 'Hey <@U12345>, can you help with this?';
      const result = processor.process(input);
      // With default settings, user mentions are converted to wikilinks
      expect(result.content).toContain('[[User-U12345]]');
      expect(result.content).not.toContain('&lt;@U12345&gt;');
    });

    it('should preserve Slack channel mentions', () => {
      const input = 'Please check <#C12345|general> for updates';
      const result = processor.process(input);
      expect(result.content).toContain('<#C12345|general>');
      expect(result.content).not.toContain('&lt;#C12345|general&gt;');
    });

    it('should process Slack links normally (convert to markdown)', () => {
      const input = 'Check out <https://example.com|this website>';
      const result = processor.process(input);
      // With default settings, Slack links are converted to markdown
      expect(result.content).toContain('[this website](https://example.com)');
      expect(result.content).not.toContain('&lt;https://example.com|this website&gt;');
    });

    it('should handle multiple angle brackets in the same text', () => {
      const input =
        'We have <oneaway> and <another> company, plus <@U12345> and <https://example.com>';
      const result = processor.process(input);
      expect(result.content).toContain('&lt;oneaway&gt;');
      expect(result.content).toContain('&lt;another&gt;');
      expect(result.content).toContain('[[User-U12345]]'); // Converted to wikilink
      expect(result.content).toContain('https://example.com'); // URL simplified
    });

    it('should not double-escape already escaped entities', () => {
      const input = 'This &lt;tag&gt; is already escaped';
      const result = processor.process(input);
      expect(result.content).toContain('&lt;tag&gt;');
      expect(result.content).not.toContain('&amp;lt;');
      expect(result.content).not.toContain('&amp;gt;');
    });

    it('should handle complex real-world example', () => {
      const input = `Hey everyone! our team at <oneaway> is looking to hire.
We're working with <@U12345> on this project.
Check <#C12345|general> and visit <https://example.com|our site>.
The <important> thing is to remember <https://docs.com>.`;

      const result = processor.process(input);

      // Verify escaping of non-Slack angle brackets
      expect(result.content).toContain('&lt;oneaway&gt;');
      expect(result.content).toContain('&lt;important&gt;');

      // Verify Slack syntax is processed normally
      expect(result.content).toContain('[[User-U12345]]'); // User mention converted
      expect(result.content).toContain('<#C12345|general>'); // Channel mention preserved
      expect(result.content).toContain('[our site](https://example.com)'); // Link converted
      expect(result.content).toContain('https://docs.com'); // Plain URL simplified
    });
  });

  describe('with minimal settings (processors disabled)', () => {
    const minimalSettings = {
      ...DEFAULT_SETTINGS,
      convertSlackLinks: false,
      convertUserMentions: false,
    };
    const processor = new UnifiedProcessor(minimalSettings);

    it('should still escape angle brackets but preserve Slack syntax', () => {
      const input = 'Team <oneaway> with <@U12345> and <https://example.com>';
      const result = processor.process(input);

      // Non-Slack brackets should be escaped
      expect(result.content).toContain('&lt;oneaway&gt;');

      // Slack syntax should be preserved (not converted, not escaped)
      expect(result.content).toContain('<@U12345>');
      expect(result.content).toContain('<https://example.com>');
    });
  });
});
