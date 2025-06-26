import { Logger, StructuredLogEntry } from './logger.js';

/**
 * Parsing success metrics for quality monitoring
 */
interface ParsingMetrics {
    totalMessages: number;
    successfulParsing: number;
    failedParsing: number;
    successRate: number;
    averageMessageLength: number;
    averageParsingTime: number;
    formatDetectionAccuracy: number;
    boundaryDetectionAccuracy: number;
}

/**
 * Format detection metrics
 */
interface FormatMetrics {
    totalDetections: number;
    standardFormat: number;
    bracketFormat: number;
    dmFormat: number;
    channelFormat: number;
    threadFormat: number;
    mixedFormat: number;
    confidenceDistribution: {
        high: number; // >0.7
        medium: number; // 0.3-0.7
        low: number; // <0.3
    };
}

/**
 * Boundary detection metrics
 */
interface BoundaryMetrics {
    totalBoundaryDecisions: number;
    acceptedBoundaries: number;
    rejectedBoundaries: number;
    accuracyRate: number;
    commonRejectionReasons: Record<string, number>;
    commonAcceptancePatterns: Record<string, number>;
    averageConfidence: number;
}

/**
 * Performance metrics
 */
interface PerformanceMetrics {
    totalOperations: number;
    averageExecutionTime: number;
    memoryUsage: {
        average: number;
        peak: number;
        total: number;
    };
    operationTypes: Record<string, {
        count: number;
        averageTime: number;
        averageMemory: number;
    }>;
}

/**
 * Validation metrics
 */
interface ValidationMetrics {
    totalValidations: number;
    passedValidations: number;
    failedValidations: number;
    validationRate: number;
    commonFailureTypes: Record<string, number>;
    averageContentLength: number;
}

/**
 * Complete metrics dashboard data
 */
interface MetricsDashboard {
    timestamp: string;
    parsing: ParsingMetrics;
    format: FormatMetrics;
    boundary: BoundaryMetrics;
    performance: PerformanceMetrics;
    validation: ValidationMetrics;
    sessionInfo: {
        startTime: string;
        duration: number;
        totalLogEntries: number;
        errorCount: number;
    };
}

/**
 * Comprehensive metrics collection and analysis system
 */
export class MetricsCollector {
    private startTime: number;
    private metricsCache: MetricsDashboard | null = null;
    private cacheExpiry: number = 0;
    private readonly CACHE_DURATION = 5000; // 5 seconds

    constructor() {
        this.startTime = Date.now();
    }

    /**
     * Collect all metrics from the logging system
     */
    public collectMetrics(): MetricsDashboard {
        // Check cache first
        if (this.metricsCache && Date.now() < this.cacheExpiry) {
            return this.metricsCache;
        }

        const logEntries = Logger.getLogEntries();
        const now = new Date();

        const dashboard: MetricsDashboard = {
            timestamp: now.toISOString(),
            parsing: this.analyzeParsingMetrics(logEntries),
            format: this.analyzeFormatMetrics(logEntries),
            boundary: this.analyzeBoundaryMetrics(logEntries),
            performance: this.analyzePerformanceMetrics(logEntries),
            validation: this.analyzeValidationMetrics(logEntries),
            sessionInfo: {
                startTime: new Date(this.startTime).toISOString(),
                duration: Date.now() - this.startTime,
                totalLogEntries: logEntries.length,
                errorCount: logEntries.filter(entry => entry.level === 'ERROR').length
            }
        };

        // Cache the results
        this.metricsCache = dashboard;
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;

        return dashboard;
    }

    /**
     * Analyze parsing success rates and metrics
     */
    private analyzeParsingMetrics(logEntries: StructuredLogEntry[]): ParsingMetrics {
        const parsingEntries = logEntries.filter(entry => 
            entry.className === 'IntelligentMessageParser' || 
            entry.className === 'FlexibleMessageParser'
        );

        let totalMessages = 0;
        let successfulParsing = 0;
        let failedParsing = 0;
        let totalMessageLength = 0;
        let totalParsingTime = 0;
        let parsingTimeCount = 0;

        for (const entry of parsingEntries) {
            if (entry.message.includes('Message boundary decision')) {
                totalMessages++;
                if (entry.message.includes('ACCEPT')) {
                    successfulParsing++;
                } else {
                    failedParsing++;
                }
            }

            if (entry.data && typeof entry.data === 'object' && 'trimmed' in entry.data) {
                const trimmed = (entry.data as any).trimmed;
                if (typeof trimmed === 'string') {
                    totalMessageLength += trimmed.length;
                }
            }

            if (entry.performance?.duration) {
                totalParsingTime += entry.performance.duration;
                parsingTimeCount++;
            }
        }

        return {
            totalMessages,
            successfulParsing,
            failedParsing,
            successRate: totalMessages > 0 ? successfulParsing / totalMessages : 0,
            averageMessageLength: totalMessages > 0 ? totalMessageLength / totalMessages : 0,
            averageParsingTime: parsingTimeCount > 0 ? totalParsingTime / parsingTimeCount : 0,
            formatDetectionAccuracy: this.calculateFormatDetectionAccuracy(logEntries),
            boundaryDetectionAccuracy: this.calculateBoundaryDetectionAccuracy(logEntries)
        };
    }

    /**
     * Analyze format detection metrics
     */
    private analyzeFormatMetrics(logEntries: StructuredLogEntry[]): FormatMetrics {
        const formatEntries = logEntries.filter(entry => 
            entry.className === 'ImprovedFormatDetector'
        );

        let totalDetections = 0;
        const formatCounts = {
            standard: 0,
            bracket: 0,
            dm: 0,
            channel: 0,
            thread: 0,
            mixed: 0
        };

        const confidenceDistribution = {
            high: 0,
            medium: 0,
            low: 0
        };

        for (const entry of formatEntries) {
            if (entry.message.includes('Format detection completed')) {
                totalDetections++;
                
                // Extract format from message
                const formatMatch = entry.message.match(/completed: (\w+)/);
                if (formatMatch) {
                    const format = formatMatch[1];
                    if (format in formatCounts) {
                        (formatCounts as any)[format]++;
                    }
                }

                // Extract confidence
                if (entry.diagnostic?.confidence) {
                    const confidence = entry.diagnostic.confidence;
                    if (confidence > 0.7) {
                        confidenceDistribution.high++;
                    } else if (confidence > 0.3) {
                        confidenceDistribution.medium++;
                    } else {
                        confidenceDistribution.low++;
                    }
                }
            }
        }

        return {
            totalDetections,
            standardFormat: formatCounts.standard,
            bracketFormat: formatCounts.bracket,
            dmFormat: formatCounts.dm,
            channelFormat: formatCounts.channel,
            threadFormat: formatCounts.thread,
            mixedFormat: formatCounts.mixed,
            confidenceDistribution
        };
    }

    /**
     * Analyze boundary detection metrics
     */
    private analyzeBoundaryMetrics(logEntries: StructuredLogEntry[]): BoundaryMetrics {
        const boundaryEntries = logEntries.filter(entry => 
            entry.diagnostic?.boundaryDecision
        );

        let totalBoundaryDecisions = 0;
        let acceptedBoundaries = 0;
        let rejectedBoundaries = 0;
        const rejectionReasons: Record<string, number> = {};
        const acceptancePatterns: Record<string, number> = {};
        let totalConfidence = 0;
        let confidenceCount = 0;

        for (const entry of boundaryEntries) {
            totalBoundaryDecisions++;
            
            const decision = entry.diagnostic!.boundaryDecision!;
            if (decision.startsWith('ACCEPTED')) {
                acceptedBoundaries++;
                
                // Track acceptance patterns
                const patterns = entry.diagnostic?.matchedPatterns || [];
                for (const pattern of patterns) {
                    acceptancePatterns[pattern] = (acceptancePatterns[pattern] || 0) + 1;
                }
            } else if (decision.startsWith('REJECTED')) {
                rejectedBoundaries++;
                
                // Track rejection reasons
                const patterns = entry.diagnostic?.rejectedPatterns || [];
                for (const pattern of patterns) {
                    rejectionReasons[pattern] = (rejectionReasons[pattern] || 0) + 1;
                }
            }

            if (entry.diagnostic?.confidence) {
                totalConfidence += entry.diagnostic.confidence;
                confidenceCount++;
            }
        }

        return {
            totalBoundaryDecisions,
            acceptedBoundaries,
            rejectedBoundaries,
            accuracyRate: totalBoundaryDecisions > 0 ? acceptedBoundaries / totalBoundaryDecisions : 0,
            commonRejectionReasons: rejectionReasons,
            commonAcceptancePatterns: acceptancePatterns,
            averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0
        };
    }

    /**
     * Analyze performance metrics
     */
    private analyzePerformanceMetrics(logEntries: StructuredLogEntry[]): PerformanceMetrics {
        const performanceEntries = logEntries.filter(entry => entry.performance);

        let totalOperations = 0;
        let totalExecutionTime = 0;
        let totalMemory = 0;
        let peakMemory = 0;
        const operationTypes: Record<string, {
            count: number;
            totalTime: number;
            totalMemory: number;
        }> = {};

        for (const entry of performanceEntries) {
            const perf = entry.performance!;
            totalOperations++;

            if (perf.duration) {
                totalExecutionTime += perf.duration;
            }

            if (perf.memoryAfter) {
                totalMemory += perf.memoryAfter;
                peakMemory = Math.max(peakMemory, perf.memoryAfter);
            }

            // Track by operation type
            const operation = perf.operation;
            if (!operationTypes[operation]) {
                operationTypes[operation] = { count: 0, totalTime: 0, totalMemory: 0 };
            }
            operationTypes[operation].count++;
            if (perf.duration) {
                operationTypes[operation].totalTime += perf.duration;
            }
            if (perf.memoryAfter) {
                operationTypes[operation].totalMemory += perf.memoryAfter;
            }
        }

        // Convert to averages
        const processedOperationTypes: Record<string, {
            count: number;
            averageTime: number;
            averageMemory: number;
        }> = {};

        for (const [operation, data] of Object.entries(operationTypes)) {
            processedOperationTypes[operation] = {
                count: data.count,
                averageTime: data.count > 0 ? data.totalTime / data.count : 0,
                averageMemory: data.count > 0 ? data.totalMemory / data.count : 0
            };
        }

        return {
            totalOperations,
            averageExecutionTime: totalOperations > 0 ? totalExecutionTime / totalOperations : 0,
            memoryUsage: {
                average: totalOperations > 0 ? totalMemory / totalOperations : 0,
                peak: peakMemory,
                total: totalMemory
            },
            operationTypes: processedOperationTypes
        };
    }

    /**
     * Analyze validation metrics
     */
    private analyzeValidationMetrics(logEntries: StructuredLogEntry[]): ValidationMetrics {
        const validationEntries = logEntries.filter(entry => 
            entry.className?.includes('Validation') || 
            entry.message.includes('validation') ||
            entry.message.includes('validate')
        );

        let totalValidations = 0;
        let passedValidations = 0;
        let failedValidations = 0;
        const failureTypes: Record<string, number> = {};
        let totalContentLength = 0;

        for (const entry of validationEntries) {
            totalValidations++;
            
            if (entry.level === 'ERROR') {
                failedValidations++;
                // Extract failure type from message
                const failureType = entry.message.split(':')[0] || 'unknown';
                failureTypes[failureType] = (failureTypes[failureType] || 0) + 1;
            } else {
                passedValidations++;
            }

            // Track content length if available
            if (entry.data && typeof entry.data === 'object' && 'contentLength' in entry.data) {
                const length = (entry.data as any).contentLength;
                if (typeof length === 'number') {
                    totalContentLength += length;
                }
            }
        }

        return {
            totalValidations,
            passedValidations,
            failedValidations,
            validationRate: totalValidations > 0 ? passedValidations / totalValidations : 0,
            commonFailureTypes: failureTypes,
            averageContentLength: totalValidations > 0 ? totalContentLength / totalValidations : 0
        };
    }

    /**
     * Calculate format detection accuracy (placeholder - would need ground truth data)
     */
    private calculateFormatDetectionAccuracy(logEntries: StructuredLogEntry[]): number {
        // This would require ground truth data for comparison
        // For now, return a confidence-based estimate
        const formatEntries = logEntries.filter(entry => 
            entry.className === 'ImprovedFormatDetector' && entry.diagnostic?.confidence
        );

        if (formatEntries.length === 0) return 0;

        const totalConfidence = formatEntries.reduce((sum, entry) => 
            sum + (entry.diagnostic?.confidence || 0), 0
        );

        return totalConfidence / formatEntries.length;
    }

    /**
     * Calculate boundary detection accuracy (placeholder - would need ground truth data)
     */
    private calculateBoundaryDetectionAccuracy(logEntries: StructuredLogEntry[]): number {
        // This would require ground truth data for comparison
        // For now, return a confidence-based estimate
        const boundaryEntries = logEntries.filter(entry => 
            entry.diagnostic?.boundaryDecision && entry.diagnostic?.confidence
        );

        if (boundaryEntries.length === 0) return 0;

        const totalConfidence = boundaryEntries.reduce((sum, entry) => 
            sum + (entry.diagnostic?.confidence || 0), 0
        );

        return totalConfidence / boundaryEntries.length;
    }

    /**
     * Generate a formatted metrics report
     */
    public generateReport(): string {
        const metrics = this.collectMetrics();
        
        return `
# Slack Formatter Metrics Report
Generated: ${metrics.timestamp}

## Session Information
- Start Time: ${metrics.sessionInfo.startTime}
- Duration: ${(metrics.sessionInfo.duration / 1000).toFixed(2)}s
- Total Log Entries: ${metrics.sessionInfo.totalLogEntries}
- Error Count: ${metrics.sessionInfo.errorCount}

## Parsing Performance
- Total Messages: ${metrics.parsing.totalMessages}
- Success Rate: ${(metrics.parsing.successRate * 100).toFixed(1)}%
- Average Message Length: ${metrics.parsing.averageMessageLength.toFixed(0)} chars
- Average Parsing Time: ${metrics.parsing.averageParsingTime.toFixed(2)}ms

## Format Detection
- Total Detections: ${metrics.format.totalDetections}
- Standard: ${metrics.format.standardFormat}
- DM: ${metrics.format.dmFormat}
- Channel: ${metrics.format.channelFormat}
- Thread: ${metrics.format.threadFormat}
- Bracket: ${metrics.format.bracketFormat}

### Confidence Distribution
- High (>70%): ${metrics.format.confidenceDistribution.high}
- Medium (30-70%): ${metrics.format.confidenceDistribution.medium}
- Low (<30%): ${metrics.format.confidenceDistribution.low}

## Boundary Detection
- Total Decisions: ${metrics.boundary.totalBoundaryDecisions}
- Acceptance Rate: ${(metrics.boundary.accuracyRate * 100).toFixed(1)}%
- Average Confidence: ${(metrics.boundary.averageConfidence * 100).toFixed(1)}%

### Top Rejection Reasons
${Object.entries(metrics.boundary.commonRejectionReasons)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => `- ${reason}: ${count}`)
    .join('\n')}

## Performance
- Total Operations: ${metrics.performance.totalOperations}
- Average Execution Time: ${metrics.performance.averageExecutionTime.toFixed(2)}ms
- Peak Memory: ${(metrics.performance.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB

## Validation
- Total Validations: ${metrics.validation.totalValidations}
- Success Rate: ${(metrics.validation.validationRate * 100).toFixed(1)}%
- Average Content Length: ${metrics.validation.averageContentLength.toFixed(0)} chars
`;
    }

    /**
     * Clear metrics cache to force fresh calculation
     */
    public clearCache(): void {
        this.metricsCache = null;
        this.cacheExpiry = 0;
    }
}

export type { MetricsDashboard, ParsingMetrics, FormatMetrics, BoundaryMetrics, PerformanceMetrics, ValidationMetrics };