import { MetricsCollector, MetricsDashboard } from './metrics-collector.js';
import { Logger } from './logger.js';

/**
 * Dashboard configuration options
 */
interface DashboardConfig {
    autoRefresh: boolean;
    refreshInterval: number; // milliseconds
    enableAlerts: boolean;
    thresholds: {
        successRate: number;
        errorRate: number;
        averageTime: number;
        memoryUsage: number;
    };
}

/**
 * Alert types for metric monitoring
 */
interface MetricAlert {
    type: 'error' | 'warning' | 'info';
    category: 'parsing' | 'performance' | 'format' | 'boundary' | 'validation';
    message: string;
    value: number;
    threshold: number;
    timestamp: string;
}

/**
 * Real-time metrics dashboard for monitoring parsing performance and quality
 */
export class MetricsDashboard {
    private metricsCollector: MetricsCollector;
    private config: DashboardConfig;
    private refreshTimer: NodeJS.Timeout | null = null;
    private alerts: MetricAlert[] = [];
    private isRunning = false;

    constructor(config?: Partial<DashboardConfig>) {
        this.metricsCollector = new MetricsCollector();
        this.config = {
            autoRefresh: true,
            refreshInterval: 10000, // 10 seconds
            enableAlerts: true,
            thresholds: {
                successRate: 0.8, // 80%
                errorRate: 0.1, // 10%
                averageTime: 1000, // 1 second
                memoryUsage: 100 * 1024 * 1024 // 100MB
            },
            ...config
        };
    }

    /**
     * Start the dashboard monitoring
     */
    public start(): void {
        if (this.isRunning) {
            Logger.warn('MetricsDashboard', 'Dashboard is already running');
            return;
        }

        this.isRunning = true;
        Logger.info('MetricsDashboard', 'Starting metrics dashboard', {
            autoRefresh: this.config.autoRefresh,
            refreshInterval: this.config.refreshInterval
        });

        if (this.config.autoRefresh) {
            this.refreshTimer = setInterval(() => {
                this.updateMetrics();
            }, this.config.refreshInterval);
        }

        // Initial metrics update
        this.updateMetrics();
    }

    /**
     * Stop the dashboard monitoring
     */
    public stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        Logger.info('MetricsDashboard', 'Stopped metrics dashboard');
    }

    /**
     * Get current metrics dashboard data
     */
    public getMetrics(): MetricsDashboard {
        return this.metricsCollector.collectMetrics();
    }

    /**
     * Get current alerts
     */
    public getAlerts(): MetricAlert[] {
        return [...this.alerts];
    }

    /**
     * Clear all alerts
     */
    public clearAlerts(): void {
        this.alerts = [];
        Logger.info('MetricsDashboard', 'Cleared all alerts');
    }

    /**
     * Generate formatted dashboard report
     */
    public generateReport(): string {
        const metrics = this.getMetrics();
        const alerts = this.getAlerts();

        let report = this.metricsCollector.generateReport();

        if (alerts.length > 0) {
            report += '\n\n## Active Alerts\n';
            
            const errorAlerts = alerts.filter(a => a.type === 'error');
            const warningAlerts = alerts.filter(a => a.type === 'warning');
            const infoAlerts = alerts.filter(a => a.type === 'info');

            if (errorAlerts.length > 0) {
                report += '\n### 🔴 Errors\n';
                errorAlerts.forEach(alert => {
                    report += `- ${alert.category}: ${alert.message} (${alert.value} vs threshold ${alert.threshold})\n`;
                });
            }

            if (warningAlerts.length > 0) {
                report += '\n### 🟡 Warnings\n';
                warningAlerts.forEach(alert => {
                    report += `- ${alert.category}: ${alert.message} (${alert.value} vs threshold ${alert.threshold})\n`;
                });
            }

            if (infoAlerts.length > 0) {
                report += '\n### ℹ️ Info\n';
                infoAlerts.forEach(alert => {
                    report += `- ${alert.category}: ${alert.message}\n`;
                });
            }
        }

        return report;
    }

    /**
     * Update metrics and check for alerts
     */
    private updateMetrics(): void {
        try {
            const metrics = this.metricsCollector.collectMetrics();
            
            if (this.config.enableAlerts) {
                this.checkForAlerts(metrics);
            }

            // Log summary if debug is enabled
            if (Logger.isDebugEnabled()) {
                Logger.debug('MetricsDashboard', 'Metrics updated', {
                    totalMessages: metrics.parsing.totalMessages,
                    successRate: metrics.parsing.successRate,
                    totalAlerts: this.alerts.length
                });
            }
        } catch (error) {
            Logger.error('MetricsDashboard', 'Failed to update metrics', error);
        }
    }

    /**
     * Check metrics against thresholds and generate alerts
     */
    private checkForAlerts(metrics: MetricsDashboard): void {
        const now = new Date().toISOString();

        // Check parsing success rate
        if (metrics.parsing.successRate < this.config.thresholds.successRate && metrics.parsing.totalMessages > 10) {
            this.addAlert({
                type: 'error',
                category: 'parsing',
                message: `Low parsing success rate: ${(metrics.parsing.successRate * 100).toFixed(1)}%`,
                value: metrics.parsing.successRate,
                threshold: this.config.thresholds.successRate,
                timestamp: now
            });
        }

        // Check error rate
        const errorRate = metrics.sessionInfo.errorCount / Math.max(metrics.sessionInfo.totalLogEntries, 1);
        if (errorRate > this.config.thresholds.errorRate) {
            this.addAlert({
                type: 'warning',
                category: 'validation',
                message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
                value: errorRate,
                threshold: this.config.thresholds.errorRate,
                timestamp: now
            });
        }

        // Check average parsing time
        if (metrics.parsing.averageParsingTime > this.config.thresholds.averageTime && metrics.parsing.totalMessages > 5) {
            this.addAlert({
                type: 'warning',
                category: 'performance',
                message: `Slow parsing performance: ${metrics.parsing.averageParsingTime.toFixed(2)}ms`,
                value: metrics.parsing.averageParsingTime,
                threshold: this.config.thresholds.averageTime,
                timestamp: now
            });
        }

        // Check memory usage
        if (metrics.performance.memoryUsage.peak > this.config.thresholds.memoryUsage) {
            this.addAlert({
                type: 'warning',
                category: 'performance',
                message: `High memory usage: ${(metrics.performance.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`,
                value: metrics.performance.memoryUsage.peak,
                threshold: this.config.thresholds.memoryUsage,
                timestamp: now
            });
        }

        // Check format detection confidence
        const lowConfidenceRate = metrics.format.confidenceDistribution.low / Math.max(metrics.format.totalDetections, 1);
        if (lowConfidenceRate > 0.3 && metrics.format.totalDetections > 5) {
            this.addAlert({
                type: 'info',
                category: 'format',
                message: `High rate of low-confidence format detections: ${(lowConfidenceRate * 100).toFixed(1)}%`,
                value: lowConfidenceRate,
                threshold: 0.3,
                timestamp: now
            });
        }

        // Check boundary detection success
        if (metrics.boundary.accuracyRate < 0.7 && metrics.boundary.totalBoundaryDecisions > 10) {
            this.addAlert({
                type: 'warning',
                category: 'boundary',
                message: `Low boundary detection accuracy: ${(metrics.boundary.accuracyRate * 100).toFixed(1)}%`,
                value: metrics.boundary.accuracyRate,
                threshold: 0.7,
                timestamp: now
            });
        }
    }

    /**
     * Add an alert, preventing duplicates
     */
    private addAlert(alert: MetricAlert): void {
        // Check for duplicate alerts (same category and type within last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const existingAlert = this.alerts.find(a => 
            a.category === alert.category && 
            a.type === alert.type && 
            a.timestamp > fiveMinutesAgo
        );

        if (!existingAlert) {
            this.alerts.push(alert);
            
            // Limit alert history to prevent memory bloat
            if (this.alerts.length > 100) {
                this.alerts = this.alerts.slice(-50);
            }

            // Log the alert
            Logger.warn('MetricsDashboard', `Alert generated: ${alert.message}`, {
                category: alert.category,
                type: alert.type,
                value: alert.value,
                threshold: alert.threshold
            });
        }
    }

    /**
     * Get metrics for specific time window
     */
    public getMetricsWindow(durationMs: number): {
        entries: any[];
        summary: any;
    } {
        const cutoff = new Date(Date.now() - durationMs).toISOString();
        const allEntries = Logger.getLogEntries();
        const windowEntries = allEntries.filter(entry => entry.timestamp > cutoff);

        return {
            entries: windowEntries,
            summary: {
                totalEntries: windowEntries.length,
                errorCount: windowEntries.filter(e => e.level === 'ERROR').length,
                diagnosticCount: windowEntries.filter(e => e.diagnostic).length,
                performanceCount: windowEntries.filter(e => e.performance).length
            }
        };
    }

    /**
     * Export metrics data as JSON
     */
    public exportMetrics(): string {
        const metrics = this.getMetrics();
        const alerts = this.getAlerts();
        
        return JSON.stringify({
            metrics,
            alerts,
            exportTimestamp: new Date().toISOString(),
            config: this.config
        }, null, 2);
    }

    /**
     * Get dashboard status
     */
    public getStatus(): {
        isRunning: boolean;
        config: DashboardConfig;
        alertCount: number;
        lastUpdate: string;
    } {
        return {
            isRunning: this.isRunning,
            config: this.config,
            alertCount: this.alerts.length,
            lastUpdate: new Date().toISOString()
        };
    }
}

export type { DashboardConfig, MetricAlert };