// Test if "So, first attempt..." is considered a message start

const line = "So, first attempt was copying and pasting this very thread";

// Test various characteristics
console.log('Testing line:', line);
console.log('Length:', line.length);
console.log('Starts with capital:', /^[A-Z]/.test(line));

// Check if it has weak indicators
const hasNumbers = /\d/.test(line);
const hasUrl = /https?:\/\//.test(line);
const hasTimestamp = /\d{1,2}:\d{2}/.test(line);
const hasUserTimestamp = /\w+.*(?:\d{1,2}:\d{2}|\[.*\].*archives)/.test(line);

console.log('\nWeak indicators:');
console.log('  Has numbers:', hasNumbers);
console.log('  Has URL:', hasUrl);
console.log('  Has timestamp:', hasTimestamp);
console.log('  Has user+timestamp combo:', hasUserTimestamp);

// The line starts with "So" which is a common sentence starter
// It has no strong indicators (no timestamp, no username pattern)
// It only has weak indicators (starts with capital, reasonable length)

console.log('\nThis line has only weak indicators, so if there\'s a continuation');
console.log('timestamp nearby, it should NOT be considered a message start.');