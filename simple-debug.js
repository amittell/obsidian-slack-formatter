// Simple debug test for FlexibleMessageParser

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

console.log("TEST INPUT:");
console.log(testInput);

console.log("\n\nSPLIT LINES:");
const lines = testInput.split('\n');
lines.forEach((line, i) => {
    console.log(`${i}: "${line}"`);
});

console.log("\n\nTESTING REGEX:");
// Test the exact regex from the code
const isStandaloneTimestamp1 = /^\[?\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]?(?:\(https?:\/\/[^)]+\))?$/i.test("[8:26](https://infosys.slack.com/archives/C06SMTM7HJP/p1707261984055669?thread_ts=1707256915.639169&cid=C06SMTM7HJP)");
const isStandaloneTimestamp2 = /^\[\d{1,2}:\d{2}\]$/i.test("[8:26]");

console.log("Testing '[8:26](url)' with first regex:", isStandaloneTimestamp1);
console.log("Testing '[8:26]' with second regex:", isStandaloneTimestamp2);

// Test the actual line from the conversation
const testLine = "[8:26](https://infosys.slack.com/archives/C06SMTM7HJP/p1707261984055669?thread_ts=1707256915.639169&cid=C06SMTM7HJP)";
console.log("Actual line to test:", testLine);
console.log("First regex result:", /^\[?\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]?(?:\(https?:\/\/[^)]+\))?$/i.test(testLine));
console.log("Second regex result:", /^\[\d{1,2}:\d{2}\]$/i.test(testLine));