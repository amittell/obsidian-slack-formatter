import { Logger, PerformanceMetrics } from './logger.js';

/**
 * Performance tracking configuration
 */
interface PerformanceConfig {
    enableTracking: boolean;
    enableMemoryTracking: boolean;
    enableDetailedProfiling: boolean;
    trackingThreshold: number; // Only track operations longer than this (ms)
    maxHistorySize: number;
    autoOptimize: boolean;
    alertThresholds: {
        executionTime: number;
        memoryUsage: number;
        memoryLeak: number;
    };
}

/**
 * Performance profile for an operation
 */
interface PerformanceProfile {
    operationId: string;
    operation: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    memoryBefore?: number;
    memoryAfter?: number;
    memoryDelta?: number;
    cpuTime?: number;
    details?: Record<string, any>;
    stackTrace?: string;
    isCompleted: boolean;
}

/**
 * Performance statistics for an operation type
 */
interface OperationStats {
    operation: string;
    count: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    totalMemory: number;
    averageMemory: number;
    maxMemory: number;
    errorCount: number;
    lastExecuted: string;
    trend: 'improving' | 'stable' | 'degrading';
}

/**
 * Performance alert
 */
interface PerformanceAlert {
    type: 'execution_time' | 'memory_usage' | 'memory_leak' | 'error_rate';
    severity: 'warning' | 'critical';
    message: string;
    operation: string;
    value: number;
    threshold: number;
    timestamp: string;
    suggestions: string[];
}

/**
 * Large conversation processing metrics
 */
interface ConversationMetrics {
    conversationId: string;
    size: number; // Number of lines/messages
    processingTime: number;
    memoryUsed: number;
    throughput: number; // Messages per second
    errorCount: number;
    optimizationsApplied: string[];
    bottlenecks: string[];
}

/**
 * Comprehensive performance monitoring system for Slack formatter
 */
export class PerformanceMonitor {
    private config: PerformanceConfig;
    private activeProfiles: Map<string, PerformanceProfile> = new Map();
    private completedProfiles: PerformanceProfile[] = [];
    private operationStats: Map<string, OperationStats> = new Map();
    private alerts: PerformanceAlert[] = [];
    private conversationMetrics: ConversationMetrics[] = [];
    private isMonitoring = false;

    constructor(config?: Partial<PerformanceConfig>) {
        this.config = {
            enableTracking: true,
            enableMemoryTracking: true,
            enableDetailedProfiling: false,
            trackingThreshold: 10, // 10ms
            maxHistorySize: 1000,
            autoOptimize: false,
            alertThresholds: {
                executionTime: 1000, // 1 second
                memoryUsage: 50 * 1024 * 1024, // 50MB
                memoryLeak: 10 * 1024 * 1024 // 10MB growth
            },
            ...config
        };
    }

    /**
     * Start performance monitoring
     */
    public startMonitoring(): void {
        if (this.isMonitoring) {
            Logger.warn('PerformanceMonitor', 'Performance monitoring is already active');
            return;
        }

        this.isMonitoring = true;
        Logger.setPerformanceEnabled(true);
        
        Logger.info('PerformanceMonitor', 'Performance monitoring started', {
            config: this.config
        });

        // Start periodic cleanup and analysis
        this.startPeriodicTasks();
    }

    /**
     * Stop performance monitoring
     */
    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        Logger.setPerformanceEnabled(false);

        // Complete any active profiles
        this.completeAllActiveProfiles();
        
        Logger.info('PerformanceMonitor', 'Performance monitoring stopped', {
            completedProfiles: this.completedProfiles.length,
            totalAlerts: this.alerts.length
        });
    }

    /**
     * Start tracking a specific operation
     */
    public startOperation(operation: string, details?: Record<string, any>): string {
        if (!this.config.enableTracking) {
            return '';
        }

        const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const profile: PerformanceProfile = {
            operationId,
            operation,
            startTime: Date.now(),
            isCompleted: false,
            details
        };

        if (this.config.enableMemoryTracking) {
            profile.memoryBefore = this.getMemoryUsage();
        }

        if (this.config.enableDetailedProfiling) {
            profile.stackTrace = this.getStackTrace();
        }

        this.activeProfiles.set(operationId, profile);

        Logger.performance('PerformanceMonitor', `Started tracking: ${operation}`, {
            operation,
            startTime: profile.startTime,
            memoryBefore: profile.memoryBefore || 0
        });

        return operationId;
    }

    /**
     * End tracking for a specific operation
     */
    public endOperation(operationId: string, success: boolean = true, additionalDetails?: Record<string, any>): PerformanceProfile | null {
        if (!operationId || !this.activeProfiles.has(operationId)) {
            return null;
        }

        const profile = this.activeProfiles.get(operationId)!;
        profile.endTime = Date.now();
        profile.duration = profile.endTime - profile.startTime;
        profile.isCompleted = true;

        if (this.config.enableMemoryTracking) {
            profile.memoryAfter = this.getMemoryUsage();
            profile.memoryDelta = (profile.memoryAfter || 0) - (profile.memoryBefore || 0);
        }

        if (additionalDetails) {
            profile.details = { ...profile.details, ...additionalDetails };
        }

        // Only track if duration exceeds threshold
        if (profile.duration >= this.config.trackingThreshold) {
            this.completedProfiles.push(profile);
            this.updateOperationStats(profile, success);
            this.checkForAlerts(profile);

            // Log performance data
            Logger.performance('PerformanceMonitor', `Completed tracking: ${profile.operation}`, {
                operation: profile.operation,
                duration: profile.duration,
                memoryDelta: profile.memoryDelta || 0,
                success
            });

            // Manage history size
            this.maintainHistorySize();
        }

        this.activeProfiles.delete(operationId);
        return profile;
    }

    /**
     * Track large conversation processing
     */
    public trackConversationProcessing(conversationId: string, size: number): {
        start: () => void;
        end: (errorCount?: number, optimizations?: string[]) => ConversationMetrics;
    } {
        let startTime: number;
        let startMemory: number;

        return {
            start: () => {
                startTime = Date.now();
                startMemory = this.getMemoryUsage();
                
                Logger.info('PerformanceMonitor', `Starting conversation processing: ${conversationId}`, {
                    size,
                    memoryBefore: startMemory
                });
            },
            end: (errorCount = 0, optimizations = []) => {
                const endTime = Date.now();
                const endMemory = this.getMemoryUsage();
                const processingTime = endTime - startTime;
                const memoryUsed = endMemory - startMemory;
                const throughput = size / (processingTime / 1000); // messages per second

                const metrics: ConversationMetrics = {
                    conversationId,
                    size,
                    processingTime,
                    memoryUsed,
                    throughput,
                    errorCount,
                    optimizationsApplied: optimizations,
                    bottlenecks: this.identifyBottlenecks(processingTime, memoryUsed, size)
                };

                this.conversationMetrics.push(metrics);

                Logger.info('PerformanceMonitor', `Completed conversation processing: ${conversationId}`, {
                    processingTime,
                    throughput: throughput.toFixed(2),
                    memoryUsed,
                    errorCount
                });

                // Check for conversation-specific alerts
                this.checkConversationAlerts(metrics);

                return metrics;
            }
        };
    }

    /**
     * Get current performance statistics
     */
    public getStatistics(): {
        activeOperations: number;
        completedOperations: number;
        totalAlerts: number;
        operationStats: OperationStats[];
        conversationMetrics: ConversationMetrics[];
        systemLoad: {
            memoryUsage: number;
            activeProfiles: number;
            alertRate: number;
        };
    } {
        return {
            activeOperations: this.activeProfiles.size,
            completedOperations: this.completedProfiles.length,
            totalAlerts: this.alerts.length,
            operationStats: Array.from(this.operationStats.values()),
            conversationMetrics: this.conversationMetrics,
            systemLoad: {
                memoryUsage: this.getMemoryUsage(),
                activeProfiles: this.activeProfiles.size,
                alertRate: this.calculateAlertRate()
            }
        };
    }

    /**
     * Generate performance report
     */
    public generatePerformanceReport(): string {
        const stats = this.getStatistics();
        const topOperations = stats.operationStats
            .sort((a, b) => b.averageTime - a.averageTime)
            .slice(0, 10);

        const recentAlerts = this.alerts
            .filter(alert => {
                const alertTime = new Date(alert.timestamp).getTime();
                return Date.now() - alertTime < 3600000; // Last hour
            });

        return `
# Performance Monitor Report
Generated: ${new Date().toISOString()}

## Summary
- Active Operations: ${stats.activeOperations}
- Completed Operations: ${stats.completedOperations}
- Total Alerts: ${stats.totalAlerts}
- Current Memory Usage: ${(stats.systemLoad.memoryUsage / 1024 / 1024).toFixed(2)} MB

## Top 10 Slowest Operations
${topOperations.map(op => `
### ${op.operation}
- Count: ${op.count}
- Average Time: ${op.averageTime.toFixed(2)}ms
- Max Time: ${op.maxTime.toFixed(2)}ms
- Trend: ${op.trend}
`).join('')}

## Large Conversation Processing
${stats.conversationMetrics.slice(-5).map(conv => `
### Conversation ${conv.conversationId}
- Size: ${conv.size} messages
- Processing Time: ${conv.processingTime}ms
- Throughput: ${conv.throughput.toFixed(2)} msg/s
- Memory Used: ${(conv.memoryUsed / 1024 / 1024).toFixed(2)} MB
- Errors: ${conv.errorCount}
- Bottlenecks: ${conv.bottlenecks.join(', ') || 'None'}
`).join('')}

## Recent Alerts (Last Hour)
${recentAlerts.map(alert => `
### ${alert.type.toUpperCase()} - ${alert.severity.toUpperCase()}
- Operation: ${alert.operation}
- Message: ${alert.message}
- Value: ${alert.value} (threshold: ${alert.threshold})
- Suggestions: ${alert.suggestions.join(', ')}
`).join('')}

## Recommendations
${this.generateRecommendations().map(rec => `- ${rec}`).join('\n')}
`;
    }

    /**
     * Get alerts
     */
    public getAlerts(): PerformanceAlert[] {
        return [...this.alerts];
    }

    /**
     * Clear alerts
     */
    public clearAlerts(): void {
        this.alerts = [];
        Logger.info('PerformanceMonitor', 'Performance alerts cleared');
    }

    /**
     * Get memory usage (cross-platform)
     */
    private getMemoryUsage(): number {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        
        // Browser fallback (limited accuracy)
        if (typeof performance !== 'undefined' && 'memory' in performance) {
            return (performance as any).memory.usedJSHeapSize || 0;
        }
        
        return 0;
    }

    /**
     * Get stack trace for detailed profiling
     */
    private getStackTrace(): string {
        const stack = new Error().stack;
        return stack ? stack.split('\n').slice(2, 6).join('\n') : '';
    }

    /**
     * Update operation statistics
     */
    private updateOperationStats(profile: PerformanceProfile, success: boolean): void {
        const operation = profile.operation;
        let stats = this.operationStats.get(operation);

        if (!stats) {
            stats = {
                operation,
                count: 0,
                totalTime: 0,
                averageTime: 0,
                minTime: Number.MAX_SAFE_INTEGER,
                maxTime: 0,
                totalMemory: 0,
                averageMemory: 0,
                maxMemory: 0,
                errorCount: 0,
                lastExecuted: new Date().toISOString(),
                trend: 'stable'
            };
            this.operationStats.set(operation, stats);
        }

        const duration = profile.duration || 0;
        const memory = profile.memoryDelta || 0;

        stats.count++;
        stats.totalTime += duration;
        stats.averageTime = stats.totalTime / stats.count;
        stats.minTime = Math.min(stats.minTime, duration);
        stats.maxTime = Math.max(stats.maxTime, duration);
        stats.totalMemory += Math.abs(memory);
        stats.averageMemory = stats.totalMemory / stats.count;
        stats.maxMemory = Math.max(stats.maxMemory, Math.abs(memory));
        stats.lastExecuted = new Date().toISOString();

        if (!success) {
            stats.errorCount++;
        }

        // Calculate trend
        stats.trend = this.calculateTrend(operation, duration);
    }

    /**
     * Calculate performance trend for an operation
     */
    private calculateTrend(operation: string, currentDuration: number): 'improving' | 'stable' | 'degrading' {
        const recentProfiles = this.completedProfiles
            .filter(p => p.operation === operation)
            .slice(-10);

        if (recentProfiles.length < 5) return 'stable';

        const firstHalf = recentProfiles.slice(0, Math.floor(recentProfiles.length / 2));
        const secondHalf = recentProfiles.slice(Math.floor(recentProfiles.length / 2));

        const firstAvg = firstHalf.reduce((sum, p) => sum + (p.duration || 0), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, p) => sum + (p.duration || 0), 0) / secondHalf.length;

        const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (changePercent < -10) return 'improving';
        if (changePercent > 10) return 'degrading';
        return 'stable';
    }

    /**
     * Check for performance alerts
     */
    private checkForAlerts(profile: PerformanceProfile): void {
        const alerts: PerformanceAlert[] = [];

        // Check execution time
        if (profile.duration && profile.duration > this.config.alertThresholds.executionTime) {
            alerts.push({
                type: 'execution_time',
                severity: profile.duration > this.config.alertThresholds.executionTime * 2 ? 'critical' : 'warning',
                message: `Slow operation detected: ${profile.operation}`,
                operation: profile.operation,
                value: profile.duration,
                threshold: this.config.alertThresholds.executionTime,
                timestamp: new Date().toISOString(),
                suggestions: this.getExecutionTimeSuggestions(profile)
            });
        }

        // Check memory usage
        if (profile.memoryDelta && Math.abs(profile.memoryDelta) > this.config.alertThresholds.memoryUsage) {
            alerts.push({
                type: 'memory_usage',
                severity: Math.abs(profile.memoryDelta) > this.config.alertThresholds.memoryUsage * 2 ? 'critical' : 'warning',
                message: `High memory usage: ${profile.operation}`,
                operation: profile.operation,
                value: Math.abs(profile.memoryDelta),
                threshold: this.config.alertThresholds.memoryUsage,
                timestamp: new Date().toISOString(),
                suggestions: this.getMemoryUsageSuggestions(profile)
            });
        }

        this.alerts.push(...alerts);

        // Log alerts
        for (const alert of alerts) {
            Logger.warn('PerformanceMonitor', `Performance alert: ${alert.message}`, {
                type: alert.type,
                severity: alert.severity,
                value: alert.value,
                threshold: alert.threshold
            });
        }
    }

    /**
     * Check for conversation-specific alerts
     */
    private checkConversationAlerts(metrics: ConversationMetrics): void {
        const alerts: PerformanceAlert[] = [];

        // Check throughput
        if (metrics.throughput < 10) { // Less than 10 messages per second
            alerts.push({
                type: 'execution_time',
                severity: metrics.throughput < 5 ? 'critical' : 'warning',
                message: `Low conversation processing throughput`,
                operation: 'conversation-processing',
                value: metrics.throughput,
                threshold: 10,
                timestamp: new Date().toISOString(),
                suggestions: ['Consider batch processing', 'Review parsing algorithms', 'Implement caching']
            });
        }

        this.alerts.push(...alerts);
    }

    /**
     * Get execution time improvement suggestions
     */
    private getExecutionTimeSuggestions(profile: PerformanceProfile): string[] {
        const suggestions: string[] = [];
        
        if (profile.operation.includes('parsing')) {
            suggestions.push('Consider caching parsing results');
            suggestions.push('Optimize regex patterns');
        }
        
        if (profile.operation.includes('format')) {
            suggestions.push('Implement format detection caching');
        }
        
        suggestions.push('Review algorithm complexity');
        return suggestions;
    }

    /**
     * Get memory usage improvement suggestions
     */
    private getMemoryUsageSuggestions(profile: PerformanceProfile): string[] {
        return [
            'Check for memory leaks',
            'Optimize data structures',
            'Implement object pooling',
            'Review large string operations'
        ];
    }

    /**
     * Identify bottlenecks in conversation processing
     */
    private identifyBottlenecks(processingTime: number, memoryUsed: number, size: number): string[] {
        const bottlenecks: string[] = [];

        const timePerMessage = processingTime / size;
        if (timePerMessage > 100) { // More than 100ms per message
            bottlenecks.push('slow-per-message-processing');
        }

        const memoryPerMessage = memoryUsed / size;
        if (memoryPerMessage > 1024 * 1024) { // More than 1MB per message
            bottlenecks.push('high-memory-per-message');
        }

        if (processingTime > 30000) { // More than 30 seconds total
            bottlenecks.push('excessive-total-time');
        }

        return bottlenecks;
    }

    /**
     * Calculate alert rate
     */
    private calculateAlertRate(): number {
        const recentAlerts = this.alerts.filter(alert => {
            const alertTime = new Date(alert.timestamp).getTime();
            return Date.now() - alertTime < 3600000; // Last hour
        });

        return recentAlerts.length;
    }

    /**
     * Generate performance recommendations
     */
    private generateRecommendations(): string[] {
        const recommendations: string[] = [];
        const stats = this.getStatistics();

        // Check for operations with high error rates
        const problematicOps = stats.operationStats.filter(op => op.errorCount / op.count > 0.1);
        if (problematicOps.length > 0) {
            recommendations.push(`Review error handling for: ${problematicOps.map(op => op.operation).join(', ')}`);
        }

        // Check for consistently slow operations
        const slowOps = stats.operationStats.filter(op => op.averageTime > 500);
        if (slowOps.length > 0) {
            recommendations.push(`Optimize slow operations: ${slowOps.map(op => op.operation).join(', ')}`);
        }

        // Check memory usage trends
        if (stats.systemLoad.memoryUsage > 100 * 1024 * 1024) {
            recommendations.push('Monitor memory usage - approaching high levels');
        }

        return recommendations;
    }

    /**
     * Complete all active profiles (cleanup)
     */
    private completeAllActiveProfiles(): void {
        for (const [operationId, profile] of this.activeProfiles) {
            profile.endTime = Date.now();
            profile.duration = profile.endTime - profile.startTime;
            profile.isCompleted = true;
            this.completedProfiles.push(profile);
        }
        this.activeProfiles.clear();
    }

    /**
     * Maintain history size to prevent memory bloat
     */
    private maintainHistorySize(): void {
        if (this.completedProfiles.length > this.config.maxHistorySize) {
            this.completedProfiles = this.completedProfiles.slice(-this.config.maxHistorySize);
        }

        if (this.conversationMetrics.length > 100) {
            this.conversationMetrics = this.conversationMetrics.slice(-100);
        }

        if (this.alerts.length > 500) {
            this.alerts = this.alerts.slice(-500);
        }
    }

    /**
     * Start periodic tasks for monitoring
     */
    private startPeriodicTasks(): void {
        // Periodic cleanup and analysis every 5 minutes
        setInterval(() => {
            this.maintainHistorySize();
            this.checkSystemHealth();
        }, 300000);
    }

    /**
     * Check overall system health
     */
    private checkSystemHealth(): void {
        const memoryUsage = this.getMemoryUsage();
        const activeOperations = this.activeProfiles.size;

        if (memoryUsage > this.config.alertThresholds.memoryUsage * 2) {
            Logger.warn('PerformanceMonitor', 'High system memory usage detected', {
                memoryUsage,
                threshold: this.config.alertThresholds.memoryUsage
            });
        }

        if (activeOperations > 50) {
            Logger.warn('PerformanceMonitor', 'High number of active operations', {
                activeOperations
            });
        }
    }
}

export type { PerformanceConfig, PerformanceProfile, OperationStats, PerformanceAlert, ConversationMetrics };