// Test if [9:18](url) is detected as a continuation

const line = '[9:18](https://slack.com/archives/012)';
const pattern = /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i;

console.log('Line:', line);
console.log('Matches continuation pattern:', pattern.test(line));
console.log('This should be true to prevent it from being a message start candidate');