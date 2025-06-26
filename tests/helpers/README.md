# Test Helpers

This directory contains shared test utilities extracted from commonly repeated patterns across the test suite. These utilities provide consistent testing patterns, reduce boilerplate code, and improve maintainability.

## Directory Structure

```
tests/helpers/
├── index.ts                 # Main export file - import from here
├── debug-utils.ts          # Debug logging utilities
├── parser-setup.ts         # Parser initialization patterns
├── assertion-utils.ts      # Common assertion functions
├── test-fixtures.ts        # Shared test data and conversations
├── performance-utils.ts    # Performance measurement utilities
├── example-refactored-test.ts  # Example showing before/after refactoring
└── README.md              # This file
```

## Quick Start

Import the utilities you need from the main index:

```typescript
import {
    setupTestSuite,
    assertUserValidation,
    CLAY_CONVERSATION,
    createRegressionTest
} from '../helpers';
```

### Basic Test Setup

```typescript
describe('My Test Suite', () => {
    it('should parse messages correctly', () => {
        const testUtils = setupTestSuite('My Test', {
            debug: true,
            expectedUsers: ['User1', 'User2']
        });
        
        const { messages, validation } = testUtils.parseAndValidate(
            'User1\n12:00 PM\nHello world',
            ['User1']
        );
        
        expect(messages.length).toBe(1);
        expect(validation.hasUnknownUserRegression).toBe(false);
    });
});
```

## Utilities Overview

### 1. Debug Utilities (`debug-utils.ts`)

Provides consistent debug logging patterns:

```typescript
// Create a debug logger
const logger = TestDebugLogger.create('My Test', true);

// Log parsing results
logger.logParsingResults(messages, inputLength);

// Log user validation
logger.logUserValidation(messages, expectedUsers);

// Log performance metrics
logger.logPerformanceMetrics(times, inputSize);

// Simple debug logging
debugLog('Debug message', data);
```

### 2. Parser Setup (`parser-setup.ts`)

Standardized parser initialization:

```typescript
// Create a complete test suite
const suite = createParserTestSuite({
    debug: false,
    userMap: {},
    emojiMap: {}
});

// Create specific parsers
const parser = createIntelligentParser();
const debugParser = createDebugParser();
const regressionParser = createRegressionTestParser();

// Create formatting pipeline
const { parser, formatter, parseAndFormat } = createFormattingPipeline();
```

### 3. Assertion Utilities (`assertion-utils.ts`)

Common validation patterns:

```typescript
// Validate users without Unknown User regression
assertUserValidation(messages, expectedUsers, { allowUnknownUser: false });

// Validate message count
assertMessageCount(messages, { min: 3, max: 5 });

// Validate content preservation
assertContentPreservation(formattedOutput, criticalContent);

// Validate user differentiation
assertUserDifferentiation(messages, [
    { username: 'Clay', requiredContent: 'Hi there', count: 1 },
    { username: 'Bo (Clay)', requiredContent: 'Have you tried', count: 1 }
]);

// Validate no regression
assertRegressionFix(messages, {
    noUnknownUser: true,
    noTimestampAsUsername: true
});
```

### 4. Test Fixtures (`test-fixtures.ts`)

Pre-defined test conversations:

```typescript
// Use pre-defined conversations
const clayConv = CLAY_CONVERSATION;
const jorgeMsg = JORGE_MESSAGE;
const threadFormat = THREAD_FORMAT_CONVERSATION;

// Get conversation by feature
const conversation = getConversationForFeature('clay-differentiation');

// Create custom conversation
const custom = createTestConversation(['User1', 'User2'], 'Message from {user}');
```

### 5. Performance Utilities (`performance-utils.ts`)

Performance measurement and validation:

```typescript
// Quick performance test
const suite = new PerformanceTestSuite(getPerformanceThresholds());
const benchmark = suite.benchmarkParser(
    'Parser Test',
    (input) => parser.parse(input),
    testInput,
    5, // iterations
    (messages) => messages.length // message count extractor
);

// Validate performance
const validation = validatePerformance(benchmark, thresholds);
logPerformanceBenchmark(benchmark);
```

## Common Patterns

### Pattern 1: Basic Message Parsing Test

**Before:**
```typescript
const parser = new IntelligentMessageParser();
const messages = parser.parse(input);

console.log('Messages detected:', messages.length);
messages.forEach((msg, i) => {
    console.log(`Message ${i}: ${msg.username}`);
});

expect(messages.length).toBe(3);
expect(messages[0].username).toBe('User1');
const unknownUsers = messages.filter(m => m.username === 'Unknown User');
expect(unknownUsers.length).toBe(0);
```

**After:**
```typescript
const testUtils = setupTestSuite('Basic Parsing');
const { messages, validation } = testUtils.parseAndValidate(input, ['User1', 'User2']);

assertMessageCount(messages, 3);
expect(validation.hasUnknownUserRegression).toBe(false);
```

### Pattern 2: Regression Test

**Before:**
```typescript
const parser = new IntelligentMessageParser();
const messages = parser.parse(problematicInput);

if (process.env.DEBUG_TESTS) {
    console.log('Messages detected:', messages.length);
    // ... more debug code
}

expect(messages.length).toBeGreaterThan(1);
const unknownUsers = messages.filter(m => m.username === 'Unknown User');
expect(unknownUsers.length).toBe(0);
```

**After:**
```typescript
const regressionTest = createRegressionTest('My Regression', problematicInput, expectedUsers);
const { messages, validation } = regressionTest.runTest();
```

### Pattern 3: Performance Test

**Before:**
```typescript
const times: number[] = [];
for (let i = 0; i < 5; i++) {
    const start = Date.now();
    parser.parse(input);
    const end = Date.now();
    times.push(end - start);
}

const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
expect(avgTime).toBeLessThan(500);
```

**After:**
```typescript
const perfTest = createQuickPerformanceTest('Parser Performance', input);
const { benchmark, validation } = perfTest.runBenchmark(5);
expect(validation.passed).toBe(true);
```

### Pattern 4: Comprehensive Pipeline Test

**Before:**
```typescript
const parser = new IntelligentMessageParser(settings, parsedMaps);
const formatter = new SlackFormatter(settings, userMap, emojiMap);

const messages = parser.parse(input);
const formatted = formatter.formatSlackContent(input);

// Manual validation of users, content, etc...
expect(messages.length).toBeGreaterThan(0);
expect(formatted).toContain('expected content');
// ... many more manual assertions
```

**After:**
```typescript
const testUtils = setupTestSuite('Pipeline Test');
const result = testUtils.fullPipelineTest(input, expectedUsers, criticalContent);

expect(result.userValidation.hasUnknownUserRegression).toBe(false);
expect(result.contentValidation?.allFound).toBe(true);
```

## Environment Variables

The utilities respect these environment variables:

- `DEBUG_TESTS=true` - Enable debug logging across all utilities
- `DEBUG_TEST=TestName` - Enable debug logging for specific test
- `SHOW_BOUNDARY_STATS=true` - Show boundary detection statistics
- `CI=true` - Use CI-appropriate performance thresholds

## Benefits

1. **Reduced Boilerplate**: 20-40% less code in test files
2. **Consistent Patterns**: Standardized debug output and assertions
3. **Better Error Messages**: More informative failure messages
4. **Easier Maintenance**: Changes to test patterns propagate automatically
5. **Improved Readability**: Tests focus on intent rather than implementation
6. **Reusable Fixtures**: Common test data shared across tests
7. **Performance Monitoring**: Built-in performance validation

## Migration Guide

To migrate existing tests:

1. Import utilities: `import { setupTestSuite, assertUserValidation } from '../helpers';`
2. Replace manual parser setup with `setupTestSuite()`
3. Replace inline test data with fixtures from `test-fixtures.ts`
4. Replace manual debug logging with `TestDebugLogger`
5. Replace manual assertions with utility functions
6. Use `parseAndValidate()` or `fullPipelineTest()` for common patterns

See `example-refactored-test.ts` for a complete before/after comparison.