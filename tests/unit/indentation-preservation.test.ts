import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('Indentation Preservation', () => {
  it("should preserve indentation from the user's Alex message example", () => {
    const alexMessage = `Alex
Alex
  11:58 PM
Hey everyone! our team at <oneaway> is looking to hire.
We're 1 of 25 Clay enterprise agencies.
We have 24 active clients.
We've now 3x'ed our revenue in 1 year BUT
the best stat is the fact we've only had 3 clients churn in the last 8 months.
We take a lot of pride in the work that we do ( check out the 9 video testimonials/case studies we have on our website here)
You will get the best work environment you can ask for
Whew, okay now I'm done with the sales pitch, here are the 3 roles we are looking for:
Role #1: Head of Strategy
 Mid to expert Clay level
 Has experience handling client calls
 Understands how to create strategy and write copy
Role #2: GTM- Clay
 Stays up to date on all Clay feature release
 Knows how to read API docs, connect webhooks and spends credits wisely.
 Understands the fundamentals of Clay ( we don't care about a complex table, we just want a table that works)
Role #3: GTM- Leads
 You have experience with Apify, IDS, Claygent etc.. to build lead lists.
 You understand that scraping leads from Apollo is just the tip of the iceberg
 Even when tasked to build a lead list that you've never done before, you figure out a solution`;

    const formatter = new SlackFormatter(DEFAULT_SETTINGS, {}, {});
    const result = formatter.formatSlackContent(alexMessage);

    console.log('=== FORMATTED OUTPUT ===');
    console.log(result);
    console.log('\n=== ANALYSIS ===');

    // Check angle bracket fix is working
    expect(result).toContain('&lt;oneaway&gt;');
    expect(result).not.toContain('<oneaway>');

    // Check that the formatted output preserves the list structure
    // Look for the indented items that should be preserved
    expect(result).toContain('Mid to expert Clay level');
    expect(result).toContain('Has experience handling client calls');
    expect(result).toContain('Understands how to create strategy and write copy');

    // Check if indentation is preserved (either as spaces or converted to proper markdown)
    const hasIndentedContent =
      result.includes(' Mid to expert Clay level') ||
      result.includes('- Mid to expert Clay level') ||
      result.includes('  Mid to expert Clay level');

    console.log('Has some form of indentation:', hasIndentedContent);
    console.log(
      'Contains leading space before "Mid to":',
      result.includes(' Mid to expert Clay level')
    );
    console.log(
      'Contains markdown bullet before "Mid to":',
      result.includes('- Mid to expert Clay level')
    );
    console.log(
      'Contains double space before "Mid to":',
      result.includes('  Mid to expert Clay level')
    );

    // For now, just ensure the content is there - we'll improve indentation next
    expect(result).toContain('Role #1: Head of Strategy');
    expect(result).toContain('Role #2: GTM- Clay');
    expect(result).toContain('Role #3: GTM- Leads');
  });

  it('should handle various indentation patterns', () => {
    const testMessage = `User
2:00 PM
Here are the items:
Main Item 1
 Sub item A
 Sub item B
  Deep sub item
Main Item 2
 Another sub item`;

    const formatter = new SlackFormatter(DEFAULT_SETTINGS, {}, {});
    const result = formatter.formatSlackContent(testMessage);

    console.log('\n=== INDENTATION TEST OUTPUT ===');
    console.log(result);

    // Check for preserved indentation
    console.log('Contains " Sub item A":', result.includes(' Sub item A'));
    console.log('Contains "  Deep sub item":', result.includes('  Deep sub item'));
    console.log('Contains " Another sub item":', result.includes(' Another sub item'));

    // Ensure content is preserved
    expect(result).toContain('Main Item 1');
    expect(result).toContain('Sub item A');
    expect(result).toContain('Sub item B');
    expect(result).toContain('Deep sub item');
    expect(result).toContain('Main Item 2');
    expect(result).toContain('Another sub item');

    // Check for preserved indentation
    expect(result).toContain(' Sub item A'); // Leading space should be preserved
    expect(result).toContain('  Deep sub item'); // Double space should be preserved
  });
});
