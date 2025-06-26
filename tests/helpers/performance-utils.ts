/**
 * Performance Testing Utilities
 * Provides consistent performance measurement and validation patterns
 */

export interface PerformanceMetrics {
    executionTime: number;
    memoryUsage?: {
        heapUsed: number;
        heapTotal: number;
        external: number;
    };
    inputSize: number;
    outputSize?: number;
    charactersPerSecond: number;
    messagesPerSecond?: number;
}

export interface PerformanceBenchmark {
    name: string;
    iterations: number;
    metrics: PerformanceMetrics[];
    averageMetrics: PerformanceMetrics;
    summary: PerformanceSummary;
}

export interface PerformanceSummary {
    averageTime: number;
    minTime: number;
    maxTime: number;
    standardDeviation: number;
    throughput: number;
    memoryEfficiency?: number;
}

export interface PerformanceThresholds {
    maxAverageTime?: number;
    maxSingleExecution?: number;
    minCharactersPerSecond?: number;
    minMessagesPerSecond?: number;
    maxMemoryUsage?: number;
}

/**
 * Measures execution time and memory usage of a function
 */
export function measurePerformance<T>(
    fn: () => T,
    inputSize: number,
    outputSizeExtractor?: (result: T) => number
): PerformanceMetrics {
    const startMemory = process.memoryUsage();
    const startTime = process.hrtime.bigint();
    
    const result = fn();
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const executionTime = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    const outputSize = outputSizeExtractor ? outputSizeExtractor(result) : undefined;
    const charactersPerSecond = inputSize / executionTime * 1000;
    
    return {
        executionTime,
        memoryUsage: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal,
            external: endMemory.external - startMemory.external
        },
        inputSize,
        outputSize,
        charactersPerSecond
    };
}

/**
 * Runs multiple iterations of performance measurement
 */
export function benchmarkFunction<T>(
    name: string,
    fn: () => T,
    inputSize: number,
    iterations: number = 5,
    options: {
        outputSizeExtractor?: (result: T) => number;
        messagesExtractor?: (result: T) => number;
        warmupIterations?: number;
    } = {}
): PerformanceBenchmark {
    const { outputSizeExtractor, messagesExtractor, warmupIterations = 2 } = options;
    
    // Warmup iterations to stabilize performance
    for (let i = 0; i < warmupIterations; i++) {
        fn();
    }
    
    const metrics: PerformanceMetrics[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const metric = measurePerformance(fn, inputSize, outputSizeExtractor);
        
        if (messagesExtractor) {
            const result = fn();
            const messageCount = messagesExtractor(result);
            metric.messagesPerSecond = messageCount / metric.executionTime * 1000;
        }
        
        metrics.push(metric);
    }
    
    const averageMetrics = calculateAverageMetrics(metrics);
    const summary = calculatePerformanceSummary(metrics);
    
    return {
        name,
        iterations,
        metrics,
        averageMetrics,
        summary
    };
}

/**
 * Calculates average metrics from multiple measurements
 */
function calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const count = metrics.length;
    
    return {
        executionTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / count,
        memoryUsage: {
            heapUsed: metrics.reduce((sum, m) => sum + (m.memoryUsage?.heapUsed || 0), 0) / count,
            heapTotal: metrics.reduce((sum, m) => sum + (m.memoryUsage?.heapTotal || 0), 0) / count,
            external: metrics.reduce((sum, m) => sum + (m.memoryUsage?.external || 0), 0) / count
        },
        inputSize: metrics[0].inputSize,
        outputSize: metrics[0].outputSize ? 
            metrics.reduce((sum, m) => sum + (m.outputSize || 0), 0) / count : undefined,
        charactersPerSecond: metrics.reduce((sum, m) => sum + m.charactersPerSecond, 0) / count,
        messagesPerSecond: metrics[0].messagesPerSecond ? 
            metrics.reduce((sum, m) => sum + (m.messagesPerSecond || 0), 0) / count : undefined
    };
}

/**
 * Calculates performance summary statistics
 */
function calculatePerformanceSummary(metrics: PerformanceMetrics[]): PerformanceSummary {
    const times = metrics.map(m => m.executionTime);
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);
    
    const avgInputSize = metrics[0].inputSize;
    const throughput = avgInputSize / averageTime * 1000; // characters per second
    
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + (m.memoryUsage?.heapUsed || 0), 0) / metrics.length;
    const memoryEfficiency = avgInputSize / (avgMemoryUsage || 1); // characters per byte
    
    return {
        averageTime,
        minTime,
        maxTime,
        standardDeviation,
        throughput,
        memoryEfficiency: avgMemoryUsage > 0 ? memoryEfficiency : undefined
    };
}

/**
 * Validates performance against thresholds
 */
export function validatePerformance(
    benchmark: PerformanceBenchmark,
    thresholds: PerformanceThresholds
): { passed: boolean; failures: string[] } {
    const failures: string[] = [];
    
    if (thresholds.maxAverageTime && benchmark.summary.averageTime > thresholds.maxAverageTime) {
        failures.push(`Average time ${benchmark.summary.averageTime.toFixed(1)}ms exceeds threshold ${thresholds.maxAverageTime}ms`);
    }
    
    if (thresholds.maxSingleExecution && benchmark.summary.maxTime > thresholds.maxSingleExecution) {
        failures.push(`Max time ${benchmark.summary.maxTime.toFixed(1)}ms exceeds threshold ${thresholds.maxSingleExecution}ms`);
    }
    
    if (thresholds.minCharactersPerSecond && benchmark.summary.throughput < thresholds.minCharactersPerSecond) {
        failures.push(`Throughput ${benchmark.summary.throughput.toFixed(0)} chars/sec below threshold ${thresholds.minCharactersPerSecond}`);
    }
    
    if (thresholds.minMessagesPerSecond && benchmark.averageMetrics.messagesPerSecond) {
        if (benchmark.averageMetrics.messagesPerSecond < thresholds.minMessagesPerSecond) {
            failures.push(`Message processing rate ${benchmark.averageMetrics.messagesPerSecond.toFixed(1)} msgs/sec below threshold ${thresholds.minMessagesPerSecond}`);
        }
    }
    
    if (thresholds.maxMemoryUsage && benchmark.averageMetrics.memoryUsage) {
        if (benchmark.averageMetrics.memoryUsage.heapUsed > thresholds.maxMemoryUsage) {
            failures.push(`Memory usage ${(benchmark.averageMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB exceeds threshold ${(thresholds.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
        }
    }
    
    return {
        passed: failures.length === 0,
        failures
    };
}

/**
 * Logs performance benchmark results
 */
export function logPerformanceBenchmark(benchmark: PerformanceBenchmark, showDetails: boolean = false): void {
    console.log(`\n=== PERFORMANCE BENCHMARK: ${benchmark.name} ===`);
    console.log(`Iterations: ${benchmark.iterations}`);
    console.log(`Input size: ${benchmark.averageMetrics.inputSize.toLocaleString()} characters`);
    
    console.log('\n--- Performance Summary ---');
    console.log(`Average time: ${benchmark.summary.averageTime.toFixed(1)}ms`);
    console.log(`Min time: ${benchmark.summary.minTime.toFixed(1)}ms`);
    console.log(`Max time: ${benchmark.summary.maxTime.toFixed(1)}ms`);
    console.log(`Standard deviation: ${benchmark.summary.standardDeviation.toFixed(1)}ms`);
    console.log(`Throughput: ${benchmark.summary.throughput.toFixed(0)} chars/second`);
    
    if (benchmark.averageMetrics.messagesPerSecond) {
        console.log(`Message processing: ${benchmark.averageMetrics.messagesPerSecond.toFixed(1)} messages/second`);
    }
    
    if (benchmark.summary.memoryEfficiency) {
        console.log(`Memory efficiency: ${benchmark.summary.memoryEfficiency.toFixed(1)} chars/byte`);
    }
    
    if (benchmark.averageMetrics.memoryUsage) {
        console.log(`Average memory usage: ${(benchmark.averageMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    }
    
    if (showDetails) {
        console.log('\n--- Individual Measurements ---');
        benchmark.metrics.forEach((metric, index) => {
            console.log(`  ${index + 1}: ${metric.executionTime.toFixed(1)}ms (${metric.charactersPerSecond.toFixed(0)} chars/sec)`);
        });
    }
}

/**
 * Creates a performance test suite for common patterns
 */
export class PerformanceTestSuite {
    private thresholds: PerformanceThresholds;
    private benchmarks: PerformanceBenchmark[] = [];
    
    constructor(thresholds: PerformanceThresholds = {}) {
        this.thresholds = {
            maxAverageTime: 500, // 500ms default
            maxSingleExecution: 1000, // 1 second default
            minCharactersPerSecond: 10000, // 10k chars/sec default
            ...thresholds
        };
    }
    
    /**
     * Benchmarks a parsing function
     */
    benchmarkParser<T>(
        name: string,
        parserFn: (input: string) => T,
        testInput: string,
        iterations: number = 5,
        messagesExtractor?: (result: T) => number
    ): PerformanceBenchmark {
        const benchmark = benchmarkFunction(
            name,
            () => parserFn(testInput),
            testInput.length,
            iterations,
            {
                outputSizeExtractor: (result) => JSON.stringify(result).length,
                messagesExtractor
            }
        );
        
        this.benchmarks.push(benchmark);
        return benchmark;
    }
    
    /**
     * Benchmarks a formatting function
     */
    benchmarkFormatter<T>(
        name: string,
        formatterFn: (input: string) => string,
        testInput: string,
        iterations: number = 5
    ): PerformanceBenchmark {
        const benchmark = benchmarkFunction(
            name,
            () => formatterFn(testInput),
            testInput.length,
            iterations,
            {
                outputSizeExtractor: (result) => result.length
            }
        );
        
        this.benchmarks.push(benchmark);
        return benchmark;
    }
    
    /**
     * Validates all benchmarks against thresholds
     */
    validateAll(): { passed: boolean; results: Array<{ name: string; passed: boolean; failures: string[] }> } {
        const results = this.benchmarks.map(benchmark => ({
            name: benchmark.name,
            ...validatePerformance(benchmark, this.thresholds)
        }));
        
        const passed = results.every(r => r.passed);
        return { passed, results };
    }
    
    /**
     * Generates a comprehensive performance report
     */
    generateReport(): string {
        let report = '# Performance Test Report\n\n';
        
        this.benchmarks.forEach(benchmark => {
            report += `## ${benchmark.name}\n\n`;
            report += `- **Iterations**: ${benchmark.iterations}\n`;
            report += `- **Input Size**: ${benchmark.averageMetrics.inputSize.toLocaleString()} characters\n`;
            report += `- **Average Time**: ${benchmark.summary.averageTime.toFixed(1)}ms\n`;
            report += `- **Throughput**: ${benchmark.summary.throughput.toFixed(0)} chars/second\n`;
            
            if (benchmark.averageMetrics.messagesPerSecond) {
                report += `- **Message Processing**: ${benchmark.averageMetrics.messagesPerSecond.toFixed(1)} messages/second\n`;
            }
            
            const validation = validatePerformance(benchmark, this.thresholds);
            report += `- **Status**: ${validation.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
            
            if (!validation.passed) {
                report += `- **Failures**:\n`;
                validation.failures.forEach(failure => {
                    report += `  - ${failure}\n`;
                });
            }
            
            report += '\n';
        });
        
        return report;
    }
}

/**
 * Quick performance measurement for simple cases
 */
export function quickBenchmark<T>(
    fn: () => T,
    iterations: number = 5
): { averageTime: number; minTime: number; maxTime: number } {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        fn();
        const end = Date.now();
        times.push(end - start);
    }
    
    return {
        averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times)
    };
}

/**
 * Default performance thresholds for different environments
 */
export const PERFORMANCE_THRESHOLDS = {
    DEVELOPMENT: {
        maxAverageTime: 1000, // 1 second
        maxSingleExecution: 2000, // 2 seconds
        minCharactersPerSecond: 5000 // 5k chars/sec
    },
    CI: {
        maxAverageTime: 2000, // 2 seconds (CI can be slower)
        maxSingleExecution: 5000, // 5 seconds
        minCharactersPerSecond: 2000 // 2k chars/sec
    },
    PRODUCTION: {
        maxAverageTime: 500, // 500ms
        maxSingleExecution: 1000, // 1 second
        minCharactersPerSecond: 10000 // 10k chars/sec
    }
};

/**
 * Gets appropriate thresholds based on environment
 */
export function getPerformanceThresholds(): PerformanceThresholds {
    if (process.env.CI) {
        return PERFORMANCE_THRESHOLDS.CI;
    } else if (process.env.NODE_ENV === 'production') {
        return PERFORMANCE_THRESHOLDS.PRODUCTION;
    } else {
        return PERFORMANCE_THRESHOLDS.DEVELOPMENT;
    }
}