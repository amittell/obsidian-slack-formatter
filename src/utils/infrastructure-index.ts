/**
 * Infrastructure and Monitoring Utilities Index
 * 
 * This file exports all the infrastructure and monitoring components
 * added to enhance the Slack Formatter with robust debugging, metrics,
 * performance monitoring, and error recovery capabilities.
 */

// Enhanced Logger with diagnostic capabilities
export { Logger, DiagnosticContext, PerformanceMetrics, StructuredLogEntry } from './logger.js';

// Comprehensive metrics collection and analysis
export { MetricsCollector, MetricsDashboard, ParsingMetrics, FormatMetrics, BoundaryMetrics, ValidationMetrics } from './metrics-collector.js';

// Real-time metrics dashboard with alerting
export { MetricsDashboard as RealtimeDashboard, DashboardConfig, MetricAlert } from './metrics-dashboard.js';

// Debug utilities for parsing failure analysis
export { DebugUtilities, FailureAnalysis, DebugSession, PatternAnalysis, BottleneckAnalysis } from './debug-utilities.js';

// Diagnostic report generation in multiple formats
export { DiagnosticReports, ReportOptions, DiagnosticReport } from './diagnostic-reports.js';

// Performance monitoring and tracking
export { PerformanceMonitor, PerformanceConfig, PerformanceProfile, OperationStats, PerformanceAlert, ConversationMetrics } from './performance-monitor.js';

// Error recovery and graceful degradation
export { ErrorRecoverySystem, RecoveryStrategy, RecoveryContext, RecoveryResult, ErrorBoundaryConfig } from './error-recovery.js';

/**
 * Quick setup helper for enabling all monitoring features
 */
export class InfrastructureManager {
    private performanceMonitor: PerformanceMonitor;
    private errorRecovery: ErrorRecoverySystem;
    private debugUtils: DebugUtilities;
    private metricsCollector: MetricsCollector;
    private dashboard: import('./metrics-dashboard.js').MetricsDashboard;
    private reports: DiagnosticReports;

    constructor() {
        // Initialize all monitoring components
        this.performanceMonitor = new PerformanceMonitor();
        this.errorRecovery = new ErrorRecoverySystem();
        this.debugUtils = new DebugUtilities();
        this.metricsCollector = new MetricsCollector();
        this.dashboard = new (require('./metrics-dashboard.js').MetricsDashboard)();
        this.reports = new DiagnosticReports();
    }

    /**
     * Enable comprehensive monitoring and diagnostics
     */
    public enableFullMonitoring(): void {
        // Enable enhanced logging
        Logger.setDebugEnabled(true);
        Logger.setDiagnosticEnabled(true);
        Logger.setPerformanceEnabled(true);

        // Start performance monitoring
        this.performanceMonitor.startMonitoring();

        // Start metrics dashboard
        this.dashboard.start();

        Logger.info('InfrastructureManager', 'Full monitoring enabled', {
            components: ['logger', 'performance', 'metrics', 'dashboard']
        });
    }

    /**
     * Disable monitoring (for production optimization)
     */
    public disableMonitoring(): void {
        Logger.setDebugEnabled(false);
        Logger.setDiagnosticEnabled(false);
        Logger.setPerformanceEnabled(false);

        this.performanceMonitor.stopMonitoring();
        this.dashboard.stop();

        Logger.info('InfrastructureManager', 'Monitoring disabled');
    }

    /**
     * Execute operation with full error recovery and monitoring
     */
    public async executeWithFullProtection<T>(
        operation: string,
        fn: () => Promise<T> | T,
        context?: any
    ): Promise<T> {
        // Start performance tracking
        const performanceId = this.performanceMonitor.startOperation(operation, context);

        try {
            // Execute with error recovery
            const result = await this.errorRecovery.executeWithRecovery(operation, fn, context);
            
            if (!result.success) {
                throw new Error(`Operation failed: ${operation}`);
            }

            return result.result;
        } finally {
            // End performance tracking
            this.performanceMonitor.endOperation(performanceId, true);
        }
    }

    /**
     * Generate comprehensive status report
     */
    public generateStatusReport(): string {
        const performanceReport = this.performanceMonitor.generatePerformanceReport();
        const recoveryReport = this.errorRecovery.generateRecoveryReport();
        const debugReport = this.debugUtils.generateDebugReport();
        const metricsReport = this.metricsCollector.generateReport();

        return `
# Infrastructure Status Report
Generated: ${new Date().toISOString()}

## Performance Monitoring
${performanceReport}

## Error Recovery System
${recoveryReport}

## Debug Analysis
${debugReport}

## Metrics Summary
${metricsReport}

## Dashboard Status
${JSON.stringify(this.dashboard.getStatus(), null, 2)}
`;
    }

    /**
     * Get all monitoring statistics
     */
    public getMonitoringStats(): {
        performance: any;
        recovery: any;
        metrics: any;
        dashboard: any;
    } {
        return {
            performance: this.performanceMonitor.getStatistics(),
            recovery: this.errorRecovery.getStatistics(),
            metrics: this.metricsCollector.collectMetrics(),
            dashboard: this.dashboard.getStatus()
        };
    }

    /**
     * Export all data for external analysis
     */
    public exportAllData(): string {
        const data = {
            timestamp: new Date().toISOString(),
            logs: Logger.getLogEntries(),
            metrics: this.metricsCollector.collectMetrics(),
            performance: this.performanceMonitor.getStatistics(),
            recovery: this.errorRecovery.getStatistics(),
            alerts: this.dashboard.getAlerts()
        };

        return JSON.stringify(data, null, 2);
    }
}

/**
 * Utility decorators for automatic monitoring
 */
export function withPerformanceTracking(operation: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const monitor = new PerformanceMonitor();
            const operationId = monitor.startOperation(operation, { args });

            try {
                const result = await originalMethod.apply(this, args);
                monitor.endOperation(operationId, true);
                return result;
            } catch (error) {
                monitor.endOperation(operationId, false);
                throw error;
            }
        };

        return descriptor;
    };
}

export function withErrorRecovery(recoveryConfig?: Partial<import('./error-recovery.js').ErrorBoundaryConfig>) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const recovery = new ErrorRecoverySystem(recoveryConfig);

        descriptor.value = async function (...args: any[]) {
            const result = await recovery.executeWithRecovery(
                `${target.constructor.name}.${propertyKey}`,
                () => originalMethod.apply(this, args),
                { args }
            );

            if (!result.success) {
                throw new Error(`Method ${propertyKey} failed after recovery attempts`);
            }

            return result.result;
        };

        return descriptor;
    };
}

// Export convenience instance for global use
export const globalInfrastructure = new InfrastructureManager();