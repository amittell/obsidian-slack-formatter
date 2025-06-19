// Debug test for SlackFormatter with FlexibleMessageParser

const testInput = `Clement [Feb 6th at 7:25 PM](https://infosys.slack.com/archives/C06SMTM7HJP/p1707260749442979?thread_ts=1707256915.639169&cid=C06SMTM7HJP)
Thanks for confirming you all got the invite correctly! 

I think this would be best done in the context of the standup, so we can do this during the team standup on Monday. Does that work for you all?

[8:26](https://infosys.slack.com/archives/C06SMTM7HJP/p1707261984055669?thread_ts=1707256915.639169&cid=C06SMTM7HJP)
Actually, I think standup may be a bit short. Since it is a key metric, I think this is worthy of its own meeting. Maybe 30 mins is enough?

Trajan [Feb 6th at 8:27 PM](https://infosys.slack.com/archives/C06SMTM7HJP/p1707262029451749?thread_ts=1707256915.639169&cid=C06SMTM7HJP)
I think a dedicated meeting would be appropriate. We'll want to go through the data properly anyway.

[9:18](https://infosys.slack.com/archives/C06SMTM7HJP/p1707265133901689?thread_ts=1707256915.639169&cid=C06SMTM7HJP)
Also I think the data we have isn't complete since the acquisition is still being finalized - some metrics might be missing or not be up to date.

[9:18](https://infosys.slack.com/archives/C06SMTM7HJP/p1707265197075499?thread_ts=1707256915.639169&cid=C06SMTM7HJP)
I can look into this and bring a more comprehensive overview of what data we have and what's missing tomorrow if that helps.`;

// Save the test input to a file for the built script to process
const fs = require('fs');
fs.writeFileSync('test-slack-conversation.txt', testInput);

console.log("Test input saved. Content:")
console.log(testInput);

console.log("\n=== Now run: node scripts/test-formatter.cjs ===");