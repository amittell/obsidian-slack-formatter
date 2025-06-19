import { SlackFormatter } from './src/formatter/slack-formatter.js';
import { IntelligentMessageParser } from './src/formatter/stages/intelligent-message-parser.js';
import { FlexibleMessageParser } from './src/formatter/stages/flexible-message-parser.js';
import { MessageContinuationProcessor } from './src/formatter/processors/message-continuation-processor.js';
import { DEFAULT_SETTINGS } from './src/settings.js';

const input = `Jacob FreyJacob Frey  [7:13 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733943183106099?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
btw [[alex j]] wanted to mention yesterday the issue I've been tracking which mostly only happens with TypeScript seems related to not finding a good base directory, which should be fixed by the Pyright base directory fixes. The errors go away after switching files once or twice.
Jacob FreyJacob Frey  [7:44 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945054109689?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
Alex J  [7:48 AM](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945285113869?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
[7:48](https://ableton.slack.com/archives/C07LB4Q7S3V/p1733945309114539?thread_ts=1733846267.949189&cid=C07LB4Q7S3V)  
yes when coding i do lots of cmd+p <select thing> esc
cmd+p <other thing> esc
etc.
but it seems like any file switching fixes it`;

console.log('=== INPUT ANALYSIS ===');
console.log('Lines:');
input.split('\n').forEach((line, i) => {
  console.log(`${i}: "${line}"`);
});

console.log('\n=== TESTING INTELLIGENT PARSER ===');
const intelligentParser = new IntelligentMessageParser({ debug: true }, { userMap: {}, emojiMap: {} });
const intelligentMessages = intelligentParser.parse(input, true);

console.log('\n=== INTELLIGENT PARSER RESULTS ===');
intelligentMessages.forEach((msg, i) => {
  console.log(`Message ${i}:`);
  console.log(`  Username: "${msg.username}"`);
  console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
  console.log(`  Text: "${msg.text ? msg.text.substring(0, 100) : 'none'}..."`);
});

console.log('\n=== TESTING FLEXIBLE PARSER ===');
const flexibleParser = new FlexibleMessageParser();
const flexibleMessages = flexibleParser.parse(input, true);

console.log('\n=== FLEXIBLE PARSER RESULTS ===');
flexibleMessages.forEach((msg, i) => {
  console.log(`Message ${i}:`);
  console.log(`  Username: "${msg.username}"`);
  console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
  console.log(`  Text: "${msg.text ? msg.text.substring(0, 100) : 'none'}..."`);
});

console.log('\n=== TESTING CONTINUATION PROCESSOR ===');
const continuationProcessor = new MessageContinuationProcessor();
const processedIntelligent = continuationProcessor.process(intelligentMessages);
const processedFlexible = continuationProcessor.process(flexibleMessages);

console.log('\n=== PROCESSED INTELLIGENT MESSAGES ===');
processedIntelligent.content.forEach((msg, i) => {
  console.log(`Message ${i}:`);
  console.log(`  Username: "${msg.username}"`);
  console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
  console.log(`  Text: "${msg.text ? msg.text.substring(0, 100) : 'none'}..."`);
});

console.log('\n=== PROCESSED FLEXIBLE MESSAGES ===');
processedFlexible.content.forEach((msg, i) => {
  console.log(`Message ${i}:`);
  console.log(`  Username: "${msg.username}"`);
  console.log(`  Timestamp: "${msg.timestamp || 'none'}"`);
  console.log(`  Text: "${msg.text ? msg.text.substring(0, 100) : 'none'}..."`);
});

console.log('\n=== FALLBACK DECISION ANALYSIS ===');
console.log('Testing shouldUseFallbackParser logic...');

// Simulate the fallback detection logic
const totalLines = input.split('\n').filter(line => line.trim()).length;
console.log(`Total non-empty lines: ${totalLines}`);

// Check bad indicators for intelligent parser
const badIndicators = [
  // Too many very short messages (likely fragmented)
  intelligentMessages.filter(m => m.text && m.text.length < 10).length / intelligentMessages.length > 0.5,
  
  // Messages with single-character usernames (likely misidentified)
  intelligentMessages.filter(m => m.username && m.username.length <= 2).length > 0,
  
  // Messages with obviously wrong usernames (numbers, metadata)
  intelligentMessages.filter(m => m.username && /^\d+$|^(Language|TypeScript|Last updated)$/i.test(m.username)).length > 0,
  
  // Too many messages relative to content (over-fragmentation)
  totalLines > 10 && intelligentMessages.length > totalLines * 0.8,
  
  // Messages with no content (empty messages shouldn't be created)
  intelligentMessages.filter(m => !m.text || m.text.trim() === '').length > 0
];

console.log('Bad indicators for IntelligentMessageParser:');
badIndicators.forEach((indicator, i) => {
  console.log(`  ${i}: ${indicator} (${indicator ? 'FAIL' : 'PASS'})`);
});

const shouldFallback = badIndicators.some(indicator => indicator);
console.log(`\nShould use fallback parser: ${shouldFallback}`);

console.log('\n=== FULL FORMATTER TEST ===');
const settings = { ...DEFAULT_SETTINGS, debug: true };
const formatter = new SlackFormatter(settings, {}, {});
const result = formatter.formatSlackContent(input);
console.log(result);