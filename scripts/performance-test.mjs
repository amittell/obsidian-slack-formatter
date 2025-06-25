#!/usr/bin/env node

/**
 * Performance test script for the optimized Slack formatter.
 * Tests format detection and parsing speed with various input sizes.
 */

import { performance } from 'perf_hooks';
import { ImprovedFormatDetector } from '../src/formatter/stages/improved-format-detector.js';
import { IntelligentMessageParser } from '../src/formatter/stages/intelligent-message-parser.js';
import { Logger } from '../src/utils/logger.js';

// Test configurations
const TEST_CONFIGS = [
    { name: 'Small', lineCount: 50, iterations: 100 },
    { name: 'Medium', lineCount: 200, iterations: 50 },
    { name: 'Large', lineCount: 1000, iterations: 10 },
    { name: 'XLarge', lineCount: 5000, iterations: 5 }
];

/**
 * Generate test data for performance testing
 */
function generateTestData(lineCount) {
    const sampleLines = [
        'John Doe [8:26 AM](https://example.slack.com/archives/C1234/p1234567890)',
        'Hello everyone, how are you doing today?',
        'This is a test message with some content.',
        '',
        'Jane Smith [8:27 AM](https://example.slack.com/archives/C1234/p1234567891)',
        'I\'m doing well, thanks for asking!',
        ':thumbsup: 3 :heart: 1',
        '',
        '--- Today ---',
        'Bob Johnson [2:15 PM](https://example.slack.com/archives/C1234/p1234567892)',
        'Does anyone know about the meeting?',
        'It was supposed to be at 3 PM but I haven\'t received any updates.',
        '',
        'Alice Brown [2:20 PM](https://example.slack.com/archives/C1234/p1234567893)',
        'The meeting has been moved to tomorrow at 10 AM.',
        '📅 Calendar invite sent',
        ''
    ];
    
    const lines = [];
    for (let i = 0; i < lineCount; i++) {
        lines.push(sampleLines[i % sampleLines.length]);
    }
    
    return lines.join('\n');
}

/**
 * Measure execution time of a function
 */
function measureTime(fn, name) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`${name}: ${duration.toFixed(2)}ms`);
    return { result, duration };
}

/**
 * Run performance tests for format detection
 */
function testFormatDetection(testData, iterations) {
    const detector = new ImprovedFormatDetector();
    const results = [];
    
    console.log('  Format Detection Tests:');
    
    // Warm up
    for (let i = 0; i < 5; i++) {
        detector.detectFormat(testData);
    }
    
    // Measure performance
    for (let i = 0; i < iterations; i++) {
        const { duration } = measureTime(
            () => detector.detectFormat(testData),
            `    Iteration ${i + 1}`
        );
        results.push(duration);
    }
    
    const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
    const minTime = Math.min(...results);
    const maxTime = Math.max(...results);
    
    console.log(`    Average: ${avgTime.toFixed(2)}ms`);
    console.log(`    Min: ${minTime.toFixed(2)}ms`);
    console.log(`    Max: ${maxTime.toFixed(2)}ms`);
    
    return { avg: avgTime, min: minTime, max: maxTime };
}

/**
 * Run performance tests for message parsing
 */
function testMessageParsing(testData, iterations) {
    const parser = new IntelligentMessageParser();
    const results = [];
    
    console.log('  Message Parsing Tests:');
    
    // Warm up
    for (let i = 0; i < 5; i++) {
        parser.parse(testData);
    }
    
    // Measure performance
    for (let i = 0; i < iterations; i++) {
        const { duration } = measureTime(
            () => parser.parse(testData),
            `    Iteration ${i + 1}`
        );
        results.push(duration);
    }
    
    const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
    const minTime = Math.min(...results);
    const maxTime = Math.max(...results);
    
    console.log(`    Average: ${avgTime.toFixed(2)}ms`);
    console.log(`    Min: ${minTime.toFixed(2)}ms`);
    console.log(`    Max: ${maxTime.toFixed(2)}ms`);
    
    return { avg: avgTime, min: minTime, max: maxTime };
}

/**
 * Test memory usage during parsing
 */
function testMemoryUsage(testData) {
    const initialMemory = process.memoryUsage();
    
    const detector = new ImprovedFormatDetector();
    const parser = new IntelligentMessageParser();
    
    // Run tests
    for (let i = 0; i < 100; i++) {
        detector.detectFormat(testData);
        parser.parse(testData);
    }
    
    const finalMemory = process.memoryUsage();
    
    const memoryDiff = {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
    };
    
    console.log('  Memory Usage:');
    console.log(`    RSS: ${(memoryDiff.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`    Heap Used: ${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`    Heap Total: ${(memoryDiff.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    
    return memoryDiff;
}

/**
 * Main performance test runner
 */
function runPerformanceTests() {
    console.log('🚀 Starting Performance Tests for Optimized Slack Formatter\n');
    
    // Disable debug logging for accurate performance measurements
    Logger.setDebugEnabled(false);
    
    const allResults = [];
    
    for (const config of TEST_CONFIGS) {
        console.log(`📊 Testing ${config.name} dataset (${config.lineCount} lines, ${config.iterations} iterations)`);
        console.log(''.padEnd(80, '-'));
        
        const testData = generateTestData(config.lineCount);
        
        // Test format detection
        const formatDetectionResults = testFormatDetection(testData, config.iterations);
        
        // Test message parsing
        const messageParsingResults = testMessageParsing(testData, config.iterations);
        
        // Test memory usage
        const memoryResults = testMemoryUsage(testData);
        
        allResults.push({
            config,
            formatDetection: formatDetectionResults,
            messageParsing: messageParsingResults,
            memory: memoryResults
        });
        
        console.log('');
    }
    
    // Summary
    console.log('📈 Performance Summary');
    console.log(''.padEnd(80, '='));
    
    allResults.forEach(({ config, formatDetection, messageParsing }) => {
        console.log(`${config.name} (${config.lineCount} lines):`);
        console.log(`  Format Detection: ${formatDetection.avg.toFixed(2)}ms avg`);
        console.log(`  Message Parsing: ${messageParsing.avg.toFixed(2)}ms avg`);
        console.log(`  Lines/second: ${(config.lineCount / (messageParsing.avg / 1000)).toFixed(0)}`);
        console.log('');
    });
    
    // Performance thresholds
    console.log('✅ Performance Validation');
    console.log(''.padEnd(80, '-'));
    
    const smallTestResult = allResults.find(r => r.config.name === 'Small');
    const largeTestResult = allResults.find(r => r.config.name === 'Large');
    
    if (smallTestResult && smallTestResult.formatDetection.avg < 5) {
        console.log('✅ Format detection for small files: PASS (<5ms)');
    } else {
        console.log('❌ Format detection for small files: FAIL (>=5ms)');
    }
    
    if (smallTestResult && smallTestResult.messageParsing.avg < 20) {
        console.log('✅ Message parsing for small files: PASS (<20ms)');
    } else {
        console.log('❌ Message parsing for small files: FAIL (>=20ms)');
    }
    
    if (largeTestResult && largeTestResult.messageParsing.avg < 500) {
        console.log('✅ Message parsing for large files: PASS (<500ms)');
    } else {
        console.log('❌ Message parsing for large files: FAIL (>=500ms)');
    }
    
    console.log('\n🎉 Performance testing complete!');
}

// Run the tests
runPerformanceTests();