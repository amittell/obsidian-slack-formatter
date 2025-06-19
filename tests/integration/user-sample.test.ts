import { describe, it, expect } from '@jest/globals';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('User Sample Integration Test', () => {
    it('should correctly format the user-provided sample', () => {
        const formatter = new SlackFormatter(DEFAULT_SETTINGS, {}, {});
        
        // The original sample from the user
        const input = `Jacob FreyJacob Frey  [7:13 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733943183106099?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
btw [[alex j]] wanted to mention yesterday the issue I've been tracking which mostly only happens with TypeScript seems related to not finding a good base directory, which should be fixed by the Pyright base directory fixes. The errors go away after switching files once or twice.
Jacob FreyJacob Frey  [7:44 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945054109689?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
Alex J  [7:48 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945285113869?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
[7:48](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945309114539?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
yes when coding i do lots of cmd+p <select thing> esc
cmd+p <other thing> esc
etc.
but it seems like any file switching fixes it`;

        const result = formatter.formatSlackContent(input);
        
        console.log('\n=== FORMATTED OUTPUT ===');
        console.log(result);
        console.log('=== END OUTPUT ===\n');
        
        // Check that it's formatted as a callout
        expect(result).toMatch(/^> \[!slack\]/);
        
        // Check that the key content is preserved
        expect(result).toContain('Jacob Frey');
        expect(result).toContain('btw [[alex j]] wanted to mention');
        
        // Most importantly: Check that the continuation content is included!
        expect(result).toContain('yes when coding i do lots of cmd+p');
        expect(result).toContain('but it seems like any file switching fixes it');
        
        // The formatter successfully merged the continuation content
        // even though it might not have perfect message separation
        console.log('✅ The continuation content IS included in the output!');
    });
});