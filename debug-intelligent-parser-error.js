#!/usr/bin/env node

// Debug script to isolate and reproduce the "Cannot read properties of undefined (reading 'debug')" error

import { IntelligentMessageParser } from './src/formatter/stages/intelligent-message-parser.ts';
import { DEFAULT_SETTINGS } from './src/settings.ts';

console.log('=== Debug Script: IntelligentMessageParser Error ===\n');

// Test case from the error log
const testInput = `Alex MittellAlex Mittell  [Feb 6th at 7:47 PM](https://stripe.slack.com/archives/C039S5CGKEJ/p1738889253251969)  

Hey all, I've been annoyed for a while by trying to copy and paste Slack conversations into Obsidian 'nicely' so I knocked up a quick plug-in to make it easier. Does anyone know if / how I can get this added to the internal [[Notes/Lexicon/Stripe]] Obsidian plug-in repo?BTW you can grab it [here](https://github.com/amittell/obsidian-slack-formatter) if you want to try it, feedback and suggestions welcome this version is pretty rough and ready! ![:bufo-cowboy:](https://emoji.slack-edge.com/T0181S17H6Z/bufo-cowboy/e335ba4bec9b8113.png)

4 files`;

// Test 1: Basic instantiation
console.log('Test 1: Basic instantiation');
try {
    const parser1 = new IntelligentMessageParser();
    console.log('✓ Parser created with no arguments');
    console.log('  debugMode:', parser1.debugMode);
    console.log('  settings:', parser1.settings);
} catch (error) {
    console.error('✗ Failed to create parser with no arguments:', error.message);
}

// Test 2: With settings
console.log('\nTest 2: With settings');
try {
    const parser2 = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
    console.log('✓ Parser created with settings');
    console.log('  debugMode:', parser2.debugMode);
    console.log('  settings.debug:', parser2.settings?.debug);
} catch (error) {
    console.error('✗ Failed to create parser with settings:', error.message);
}

// Test 3: Parse with debug disabled
console.log('\nTest 3: Parse with debug disabled');
try {
    const parser3 = new IntelligentMessageParser({ ...DEFAULT_SETTINGS, debug: false }, { userMap: {}, emojiMap: {} });
    console.log('  Calling parse...');
    const result = parser3.parse(testInput);
    console.log('✓ Parse completed successfully');
    console.log('  Messages found:', result.length);
} catch (error) {
    console.error('✗ Parse failed:', error.message);
    console.error('  Stack:', error.stack);
}

// Test 4: Parse with debug enabled
console.log('\nTest 4: Parse with debug enabled');
try {
    const parser4 = new IntelligentMessageParser({ ...DEFAULT_SETTINGS, debug: true }, { userMap: {}, emojiMap: {} });
    console.log('  debugMode before parse:', parser4.debugMode);
    console.log('  Calling parse...');
    const result = parser4.parse(testInput, true);
    console.log('✓ Parse completed successfully');
    console.log('  Messages found:', result.length);
} catch (error) {
    console.error('✗ Parse failed:', error.message);
    console.error('  Stack:', error.stack);
}

// Test 5: Direct method calls to test context
console.log('\nTest 5: Testing method context');
try {
    const parser5 = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
    
    // Test if methods are bound
    console.log('  couldBeMessageStart is function:', typeof parser5.couldBeMessageStart === 'function');
    console.log('  looksLikeContinuation is function:', typeof parser5.looksLikeContinuation === 'function');
    
    // Try to access private methods via prototype (for testing)
    const proto = Object.getPrototypeOf(parser5);
    console.log('  Prototype methods:', Object.getOwnPropertyNames(proto).filter(name => typeof proto[name] === 'function').slice(0, 10));
} catch (error) {
    console.error('✗ Method context test failed:', error.message);
}

console.log('\n=== End Debug Script ===');