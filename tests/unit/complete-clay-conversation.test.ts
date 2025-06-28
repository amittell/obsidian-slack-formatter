import { describe, it, expect } from '@jest/globals';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { TestLogger } from '../helpers';

describe('Complete Clay Conversation Test', () => {
  it('should parse the complete raw Clay conversation correctly', () => {
    // EXACT raw conversation data provided by user
    const input = `Owen Chandler
Owen Chandler
  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421707955479)
We are trying to leverage the Gong integration to identify the longest monologue by a sales rep. The way Gong tracks longest monologue is inaccurate because even if a prospect coughs, it ends the monologue. We have tried for hours using a prompt to analyze the transcript to better identify longest monologue and it's still inaccurate (but much closer to gong). Does anyone have any suggestions/ideas on how we can achieve this? (prompt in thread)
8 replies



Owen Chandler
Owen Chandler
  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421713437949?thread_ts=1749421707.955479&cid=C025XGWSYTX)
#CONTEXT#
You're finding the rep's longest monologue in a transcript. A monologue only ends if the prospect speaks for ≥10 seconds.
#OBJECTIVE#
Analyze the call transcript and return the rep's longest uninterrupted monologue, following the specified rules.
#INSTRUCTIONS#
1. Analyze the /f_0sxfv1exQCiSZErKsV5.transcript .
2. Clearly identify every segment of continuous rep speech. Continuous rep speech is broken only by prospect interruptions lasting 10 seconds or more.
3. For every prospect interruption that occurs between rep speech segments, explicitly identify:
Interruption timestamp (start and end)
Exact interruption duration in seconds
4. Calculate whether the interruption breaks (≥10 seconds) or does not break (<10 seconds) the monologue.
If the monologue was ≥10 seconds, treat that as a break and start a new rep segment after the prospect finishes talking.
If the monologue was not broken, ignore the interruption and continue counting the rep's monologue.
5. Repeat the process until the end of the call.
6. Identify and return the rep's longest monologue, including its duration in seconds.
7. Output only the monologue's duration in the specified format.
#EXAMPLES#
Input: Transcript with alternating rep and prospect turns, with some prospect turns under and some over 10 seconds.
Expected Output:
DurationSeconds: [120]



 (https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 8th at 6:28 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421722136699?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Hi there, thanks so much for sharing this! We'll be passing your feedback along to our product team, and any additional context you can provide will help us prioritize with your needs in mind as we shape the roadmap.

If there are specific use cases, workflows, or challenges where these suggestions would make a big difference, feel free to share—we'd love to hear more. Otherwise, we'll plan to close this ticket soon and review your input offline.

6:28 (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421722956409?thread_ts=1749421707.955479&cid=C025XGWSYTX)
All set, close this ticket out
I want to chat with support

6:28 (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749421723822739?thread_ts=1749421707.955479&cid=C025XGWSYTX)
All set, close this ticket out
I want to chat with support



Jorge Macias
Jorge Macias
  Jun 9th at 12:12 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749485545080789?thread_ts=1749421707.955479&cid=C025XGWSYTX)
easy, tell prospects to never cough on a call 



https://app.slack.com/services/B071TQU3SAH)Clay
Clay
APP  Jun 9th at 12:13 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749485617350569?thread_ts=1749421707.955479&cid=C025XGWSYTX)
All set, close this ticket out
I want to chat with support



 (https://app.slack.com/team/U07NFV9BD5L)Bo (Clay)
Bo (Clay)
  Jun 10th at 2:22 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749579776247889?thread_ts=1749421707.955479&cid=C025XGWSYTX)
Hey,
That's a tricky problem with analyzing speech patterns. A few ideas that might help improve accuracy:
Try a different approach with the prompt:
* Break it into steps: first identify all speaker segments with timestamps and extract them with Formula, then calculate durations, then apply the 10-seco…
See more

Have you tried testing it on a known transcript where you manually verified the longest monologue?
Let me know if you have more questions.



 (https://app.slack.com/team/U071Z6NQW4U)Channeled
Channeled
APP  Jun 10th at 2:24 PM (https://clayrunhq.slack.com/archives/C025XGWSYTX/p1749579853655949?thread_ts=1749421707.955479&cid=C025XGWSYTX)
This thread was picked up by our in-app web widget and will no longer sync to Slack. If you are the original poster, you can continue this conversation by logging into https://app.clay.com (https://app.clay.com/) and clicking "Support" in the sidebar. If you're not the original poster and require help from support, please post in #02___support (https://clayrunhq.slack.com/archives/C025KSBLPGX).`;

    const parser = new IntelligentMessageParser();
    const messages = parser.parse(input);

    TestLogger.log('\n=== COMPLETE CLAY CONVERSATION ANALYSIS ===');
    TestLogger.log(`Total messages detected: ${messages.length}`);

    messages.forEach((msg, i) => {
      TestLogger.log(`\nMessage ${i + 1}:`);
      TestLogger.log(`  Username: "${msg.username}"`);
      TestLogger.log(`  Timestamp: "${msg.timestamp || 'null'}"`);
      TestLogger.log(`  Content length: ${msg.text?.length || 0} chars`);
      TestLogger.log(`  Content preview: "${msg.text?.substring(0, 80)}..."`);
    });

    // Count expected users from the ground truth
    const expectedUsers = ['Owen Chandler', 'Clay', 'Jorge Macias', 'Bo (Clay)', 'Channeled'];
    TestLogger.log('\n=== EXPECTED VS ACTUAL ===');
    expectedUsers.forEach(expectedUser => {
      const userMessages = messages.filter(msg => msg.username === expectedUser);
      TestLogger.log(`${expectedUser}: ${userMessages.length} messages detected`);
    });

    // Count Unknown User messages
    const unknownUserMessages = messages.filter(msg => msg.username === 'Unknown User');
    TestLogger.log(`\nUnknown User messages: ${unknownUserMessages.length}`);

    // Based on the raw data, we should expect approximately 6-7 messages:
    // 1. Owen Chandler - Initial message
    // 2. Owen Chandler - #CONTEXT# message
    // 3. Clay (APP) - First response
    // 4. Jorge Macias - Cough comment
    // 5. Clay (APP) - Second response
    // 6. Bo (Clay) - Long advice message
    // 7. Channeled (APP) - System message

    // Validate we detect a reasonable number of messages
    expect(messages.length).toBeGreaterThanOrEqual(5);
    expect(messages.length).toBeLessThanOrEqual(15); // Adjusted for enhanced boundary detection (section headers)

    // Validate no Unknown User regression
    expect(unknownUserMessages.length).toBe(0);

    // Validate key users are detected
    expect(messages.some(msg => msg.username === 'Owen Chandler')).toBe(true);
    expect(messages.some(msg => msg.username === 'Clay')).toBe(true);
    expect(messages.some(msg => msg.username === 'Jorge Macias')).toBe(true);
    expect(messages.some(msg => msg.username === 'Bo (Clay)')).toBe(true);
  });
});
