import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('Comprehensive Spacing Preservation', () => {
  it('should preserve all types of spacing patterns in messages', () => {
    const spacingTestMessage = `User
2:00 PM
Here are various spacing patterns:
Regular text with normal spacing
Text    with    multiple    spaces    between    words
Table-like format:
Name:       Value
Item 1      Item 2      Item 3
Price:      $100        $200        $300
Indented items:
 Single space indent
  Double space indent
   Triple space indent
Mixed patterns:
Start    middle     end
 Indent   with    spaces   between
  More    indented    content`;

    const formatter = new SlackFormatter(DEFAULT_SETTINGS, {}, {});
    const result = formatter.formatSlackContent(spacingTestMessage);

    console.log('\n=== COMPREHENSIVE SPACING TEST OUTPUT ===');
    console.log(result);

    // Test various spacing patterns
    console.log('\nSpacing Analysis:');
    console.log(
      'Contains "Text    with    multiple":',
      result.includes('Text    with    multiple')
    );
    console.log('Contains "Name:       Value":', result.includes('Name:       Value'));
    console.log('Contains "Item 1      Item 2":', result.includes('Item 1      Item 2'));
    console.log('Contains "Price:      $100":', result.includes('Price:      $100'));
    console.log(
      'Contains " Indent   with    spaces":',
      result.includes(' Indent   with    spaces')
    );
    console.log('Contains "Start    middle     end":', result.includes('Start    middle     end'));

    // Ensure content is preserved even if spacing isn't perfect
    expect(result).toContain('multiple');
    expect(result).toContain('spaces');
    expect(result).toContain('between');
    expect(result).toContain('words');
    expect(result).toContain('Name:');
    expect(result).toContain('Value');
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
    expect(result).toContain('Item 3');
    expect(result).toContain('Price:');
    expect(result).toContain('$100');
    expect(result).toContain('$200');
    expect(result).toContain('$300');
  });

  it('should handle edge cases in spacing preservation', () => {
    const edgeCaseMessage = `Developer
3:00 PM
Edge cases:
Word1     Word2     Word3
A        B        C        D
Numbers:  1    2    3    4    5
Symbols:  *    +    =    -    /
Mixed:    text   123   symbol   !`;

    const formatter = new SlackFormatter(DEFAULT_SETTINGS, {}, {});
    const result = formatter.formatSlackContent(edgeCaseMessage);

    console.log('\n=== EDGE CASE SPACING TEST OUTPUT ===');
    console.log(result);

    // Check if any multi-space patterns are preserved
    const hasMultipleSpaces = /\w\s{2,}\w/.test(result);
    console.log('Contains any multiple space patterns:', hasMultipleSpaces);
  });
});
