const input = `Clement MiaoClement Miao  [Feb 7th at 8:25 AM](https://slack.com/archives/123)

this is AMAZING omg

[8:26](https://slack.com/archives/456)

even if a bit buggy, this is going to be great

Trajan McGillTrajan McGill  [Feb 7th at 9:18 AM](https://slack.com/archives/789)

Yeah, this is going to be fantastic.

[9:18](https://slack.com/archives/012)

So, first attempt was copying and pasting this very thread`;

const lines = input.split('\n');
console.log('Total lines:', lines.length);
console.log('\nLine by line:');
lines.forEach((line, idx) => {
    console.log(`${idx}: "${line}"`);
});

// Expected boundaries:
console.log('\n\nExpected boundaries:');
console.log('Message 1: lines 0-7 (Clement Miao)');
console.log('Message 2: lines 8-14 (Trajan McGill)');
console.log('\nLine 12 contains "[9:18](url)" which is a continuation');
console.log('Line 14 contains "So, first attempt..." which should be included');