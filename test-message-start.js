// Test if "So, first attempt..." is considered a message start

const line = "So, first attempt was copying and pasting this very thread";

// Check various patterns
console.log('Testing line:', line);
console.log('Length:', line.length);
console.log('Starts with capital:', /^[A-Z]/.test(line));
console.log('Has timestamp:', /\d{1,2}:\d{2}/.test(line));
console.log('Has URL:', /https?:\/\//.test(line));
console.log('Looks like username:', /^[A-Za-z0-9\s\-_.]+$/.test(line));

// Check if it matches common content patterns
const contentPatterns = [
    /^(So|And|But|Then|Also|Just|Well|Yeah|Oh|Hey|Hi|Hello)/i,
    /^[A-Z][a-z]+\s+(is|was|are|were|has|have|had)/,
    /^(First|Second|Third|Next|Last|Another)/i
];

console.log('\nContent pattern matches:');
contentPatterns.forEach((pattern, i) => {
    console.log(`Pattern ${i}:`, pattern.test(line));
});