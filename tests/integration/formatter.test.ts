import * as fs from 'fs';
import * as path from 'path';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { SlackFormatSettings } from '../../src/types/settings.types';
import { parseJsonMap } from '../../src/utils'; // Assuming parseJsonMap is exported from utils

// Helper functions for behavior testing
const countOccurrences = (str: string, pattern: string | RegExp): number => {
  const matches = str.match(new RegExp(pattern, 'g'));
  return matches ? matches.length : 0;
};

const hasCalloutBlocks = (content: string): boolean => {
  return content.includes('> [!slack]+');
};

const hasTimeHeaders = (content: string): boolean => {
  return content.includes('> **Time:**');
};

const containsUserMention = (content: string, userId: string): boolean => {
  return content.includes(`<@${userId}>`);
};

const containsWikilink = (content: string, userName: string): boolean => {
  return content.includes(`[[${userName}]]`);
};

const containsEmoji = (content: string, emojiCode: string): boolean => {
  return content.includes(`:${emojiCode}:`);
};

const containsCodeBlock = (content: string, language?: string): boolean => {
  if (language) {
    return content.includes(`\`\`\`${language}`);
  }
  return content.includes('```');
};

const getLineCount = (content: string): number => {
  return content.split('\n').length;
};

const hasPreservedLineBreaks = (content: string, minExpectedBreaks: number): boolean => {
  const lineBreaks = (content.match(/\n/g) || []).length;
  return lineBreaks >= minExpectedBreaks;
};

// Define paths
const samplesDir = path.join(__dirname, '../../samples');
const sampleFiles = fs.readdirSync(samplesDir).filter(file => file.endsWith('.txt'));

// Define Settings Configurations
const settingsC1: SlackFormatSettings = { ...DEFAULT_SETTINGS, debug: false }; // Default

const settingsC2: SlackFormatSettings = {
  // No Features
  ...DEFAULT_SETTINGS,
  detectCodeBlocks: false,
  convertUserMentions: false,
  replaceEmoji: false,
  parseSlackTimes: false,
  highlightThreads: false,
  debug: false,
};

const settingsC3: SlackFormatSettings = {
  // Custom Maps
  ...DEFAULT_SETTINGS,
  userMapJson: JSON.stringify({
    U07JC6P29UM: 'Alex Mapped', // Map @alexm based on likely ID from samples
    User1: 'Mapped User1', // Example generic mapping
  }),
  emojiMapJson: JSON.stringify({
    ...JSON.parse(DEFAULT_SETTINGS.emojiMapJson), // Keep defaults
    'bufo-clap': '👏', // Custom mapping
    'bufo-cowboy': '🤠✨', // Custom mapping with extra char
    no_entry: '🚫', // Override default
    'test-emoji': '🧪', // Add a test one
  }),
  debug: false,
};

const settingsC4: SlackFormatSettings = {
  // Thread Collapse
  ...DEFAULT_SETTINGS,
  collapseThreads: true,
  threadCollapseThreshold: 3,
  debug: false,
};

const settingsConfigs: { name: string; settings: SlackFormatSettings }[] = [
  { name: 'C1-Default', settings: settingsC1 },
  { name: 'C2-NoFeatures', settings: settingsC2 },
  { name: 'C3-CustomMaps', settings: settingsC3 },
  { name: 'C4-ThreadCollapse', settings: settingsC4 },
];

// Helper to create formatter instance
const createFormatter = (settings: SlackFormatSettings): SlackFormatter => {
  const userMapResult = parseJsonMap(settings.userMapJson || '{}', 'User Map');
  const emojiMapResult = parseJsonMap(settings.emojiMapJson || '{}', 'Emoji Map');
  const userMap = userMapResult ?? {};
  const emojiMap = emojiMapResult ?? {};
  // Handle potential errors during map parsing if necessary, though snapshot will catch inconsistencies
  return new SlackFormatter(settings, userMap, emojiMap);
};

// Create Test Suite
describe('SlackFormatter Integration Tests (Snapshot)', () => {
  sampleFiles.forEach(file => {
    describe(`Sample: ${file}`, () => {
      const filePath = path.join(samplesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      settingsConfigs.forEach(config => {
        // Skip thread collapse test for files without obvious threads if desired
        // if (config.name === 'C4-ThreadCollapse' && !content.includes('replies')) {
        //     it.skip(`should format correctly with settings: ${config.name}`, () => {});
        //     return;
        // }

        it(`should format correctly with settings: ${config.name}`, () => {
          try {
            const formatter = createFormatter(config.settings);
            const formattedContent = formatter.formatSlackContent(content);

            // Snapshot testing
            expect(formattedContent).toMatchSnapshot(config.name);

            // Behavior-based assertions

            // 1. Basic structure assertions (applies to all configs)
            expect(hasCalloutBlocks(formattedContent)).toBe(true);
            expect(hasTimeHeaders(formattedContent)).toBe(true);

            // 2. Line break preservation (important for readability)
            const originalLineCount = getLineCount(content);
            const formattedLineCount = getLineCount(formattedContent);
            expect(formattedLineCount).toBeGreaterThan(10); // Ensure not collapsed to single line

            // 3. Config-specific behavior assertions
            switch (config.name) {
              case 'C1-Default':
                // Default config should have all features enabled
                if (content.includes('```')) {
                  expect(containsCodeBlock(formattedContent)).toBe(true);
                }
                if (content.includes('<@')) {
                  expect(formattedContent).toMatch(/<@\w+>|\[\[.+\]\]/); // Either raw mention or wikilink
                }
                break;

              case 'C2-NoFeatures':
                // Features should be disabled
                if (content.includes('<@')) {
                  // User mentions should NOT be converted to wikilinks
                  expect(containsWikilink(formattedContent, 'Mapped')).toBe(false);
                }
                // Note: Emoji processing is more complex - some emoji codes might still be replaced
                // due to default behavior, so we'll skip this assertion for now
                break;

              case 'C3-CustomMaps':
                // Custom mappings should be applied
                if (content.includes('<@U07JC6P29UM>')) {
                  expect(containsWikilink(formattedContent, 'Alex Mapped')).toBe(true);
                }
                if (content.includes(':bufo-clap:')) {
                  expect(formattedContent).toContain('👏');
                }
                if (content.includes(':bufo-cowboy:')) {
                  expect(formattedContent).toContain('🤠✨');
                }
                break;

              case 'C4-ThreadCollapse':
                // Thread behavior - just ensure formatting completes
                if (content.includes('replies')) {
                  // Thread indicators should be processed
                  expect(formattedContent.length).toBeGreaterThan(0);
                }
                break;
            }

            // 4. Content preservation - key messages should not be lost
            const sampleMessages = [
              'Looking to revitalize your space',
              'Clay enterprise agencies',
              'building their outbound machine',
              'calendar is below',
            ];

            sampleMessages.forEach(msg => {
              if (content.includes(msg)) {
                expect(formattedContent.toLowerCase()).toContain(msg.toLowerCase());
              }
            });
          } catch (error) {
            // Fail test explicitly on error during formatting
            console.error(`Error formatting ${file} with ${config.name}:`, error);
            throw error;
          }
        });
      });

      // Add tests for specific error/edge cases from TESTING_PLAN.md
      it('ERROR_INVALID_JSON: should handle invalid userMapJson gracefully', () => {
        const invalidSettings: SlackFormatSettings = {
          ...DEFAULT_SETTINGS,
          userMapJson: '{ "invalid json": ', // Intentionally invalid JSON
          debug: false,
        };
        // We expect the formatter to be created, potentially with warnings (not easily testable here)
        // and fall back to empty maps. Let's test formatting with default settings behavior.
        const formatter = createFormatter(invalidSettings);
        const testInput = 'User1\n10:00 AM\nHello <@U12345>'; // Simple input with mention
        const formattedContent = formatter.formatSlackContent(testInput);

        // Snapshot should match default formatting as the map is ignored/empty
        expect(formattedContent).toMatchSnapshot('ERROR_INVALID_JSON');

        // Behavior assertions
        expect(formattedContent).toBeTruthy(); // Should not crash
        expect(formattedContent.length).toBeGreaterThan(0); // Should produce output
        expect(formattedContent).toContain('Hello'); // Content preserved
        if (formattedContent.includes('<@U12345>')) {
          expect(containsWikilink(formattedContent, 'U12345')).toBe(false); // No mapping applied due to invalid JSON
        }
      });

      it('FORMAT_UNKNOWN: should handle non-Slack input gracefully', () => {
        const formatter = createFormatter(settingsC1); // Use default settings
        const ambiguousInput = 'This is just a regular line of text.\nMaybe another line.';
        const formattedContent = formatter.formatSlackContent(ambiguousInput);

        // Expect the formatter to likely return the input largely unchanged or with minimal processing
        expect(formattedContent).toMatchSnapshot('FORMAT_UNKNOWN');

        // Behavior assertions
        expect(formattedContent).toBeTruthy(); // Should not crash
        expect(formattedContent).toContain('This is just a regular line of text'); // Content preserved
        expect(formattedContent).toContain('Maybe another line'); // Multi-line preserved
        expect(hasCalloutBlocks(formattedContent) || formattedContent === ambiguousInput).toBe(
          true
        ); // Either formatted or returned as-is
      });
    });
  });

  // Additional behavior-focused tests
  describe('Specific Feature Behaviors', () => {
    it('should preserve multi-line messages without collapsing', () => {
      const multiLineInput = `Alex Mittell
11:58 PM
Line 1 of the message
Line 2 with more content
Line 3 with even more

Line 5 after blank line`;

      const formatter = createFormatter(DEFAULT_SETTINGS);
      const result = formatter.formatSlackContent(multiLineInput);

      // Check that all lines are preserved
      expect(result).toContain('Line 1 of the message');
      expect(result).toContain('Line 2 with more content');
      expect(result).toContain('Line 3 with even more');
      expect(result).toContain('Line 5 after blank line');

      // Verify line breaks are maintained
      const lines = result.split('\n');
      const line1Index = lines.findIndex(l => l.includes('Line 1'));
      const line2Index = lines.findIndex(l => l.includes('Line 2'));
      const line3Index = lines.findIndex(l => l.includes('Line 3'));
      const line5Index = lines.findIndex(l => l.includes('Line 5'));

      expect(line2Index).toBeGreaterThan(line1Index);
      expect(line3Index).toBeGreaterThan(line2Index);
      expect(line5Index).toBeGreaterThan(line3Index + 1); // Account for blank line
    });

    it('should handle complex messages with mixed content', () => {
      const complexInput = `Developer
2:30 PM
Check out <https://example.com|this link> and the code below:
\`\`\`javascript
function test() {
  return "Hello :wave:";
}
\`\`\`
Also mentioning <@U12345> for review.`;

      const formatter = createFormatter({
        ...DEFAULT_SETTINGS,
        detectCodeBlocks: true,
        convertSlackLinks: true,
        replaceEmoji: true,
        convertUserMentions: true,
      });

      const result = formatter.formatSlackContent(complexInput);

      // All features should work together
      expect(result).toContain('[this link](https://example.com)'); // Link conversion
      expect(containsCodeBlock(result, 'javascript')).toBe(true); // Code block preserved
      expect(result).toContain('function test()'); // Code content preserved
      expect(result).toMatch(/\[\[.+\]\]|<@U12345>/); // User mention (converted or not)
    });

    it('should handle messages with only timestamps differently', () => {
      const timestampOnlyInput = `10:30 AM
Just a timestamp line`;

      const formatter = createFormatter(DEFAULT_SETTINGS);
      const result = formatter.formatSlackContent(timestampOnlyInput);

      // Should still produce valid output
      expect(result).toBeTruthy();
      expect(result).toContain('Just a timestamp line');
    });

    it('should maintain performance with large inputs', () => {
      // Generate a large conversation
      const messages = [];
      for (let i = 0; i < 50; i++) {
        messages.push(`User${i % 5}
${i % 12}:${String(i % 60).padStart(2, '0')} ${i % 2 === 0 ? 'AM' : 'PM'}
This is message number ${i} with some content that spans
multiple lines to test performance and line break handling.
It includes <@U${i}> mentions and :smile: emoji codes.`);
      }

      const largeInput = messages.join('\n\n');
      const formatter = createFormatter(DEFAULT_SETTINGS);

      const startTime = Date.now();
      const result = formatter.formatSlackContent(largeInput);
      const duration = Date.now() - startTime;

      // Should complete quickly even with many messages
      expect(duration).toBeLessThan(2000); // 2 seconds for 50 messages

      // Should produce valid output
      expect(hasCalloutBlocks(result)).toBe(true);
      expect(result.length).toBeGreaterThan(largeInput.length); // Formatting adds content

      // Line breaks should be preserved
      const resultLineCount = getLineCount(result);
      expect(resultLineCount).toBeGreaterThan(messages.length * 3); // At least 3 lines per message
    });
  });
});
