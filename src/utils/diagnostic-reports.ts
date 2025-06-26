import { DebugUtilities, FailureAnalysis, PatternAnalysis } from './debug-utilities.js';
import { MetricsCollector, MetricsDashboard } from './metrics-collector.js';
import { Logger, StructuredLogEntry } from './logger.js';

/**
 * Report generation options
 */
interface ReportOptions {
    includeMetrics: boolean;
    includeFailureAnalysis: boolean;
    includePatternAnalysis: boolean;
    includePerformanceData: boolean;
    includeLogEntries: boolean;
    timeWindow?: number; // milliseconds
    format: 'markdown' | 'json' | 'csv' | 'html';
    severity?: 'all' | 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Diagnostic report data structure
 */
interface DiagnosticReport {
    id: string;
    timestamp: string;
    title: string;
    summary: string;
    metrics?: MetricsDashboard;
    failures?: FailureAnalysis[];
    patterns?: PatternAnalysis[];
    logEntries?: StructuredLogEntry[];
    recommendations: string[];
    metadata: {
        generationTime: number;
        dataPoints: number;
        coverage: string;
        reliability: number;
    };
}

/**
 * Specialized report generators for different use cases
 */
export class DiagnosticReports {
    private debugUtilities: DebugUtilities;
    private metricsCollector: MetricsCollector;

    constructor() {
        this.debugUtilities = new DebugUtilities();
        this.metricsCollector = new MetricsCollector();
    }

    /**
     * Generate comprehensive diagnostic report
     */
    public generateComprehensiveReport(options: Partial<ReportOptions> = {}): DiagnosticReport {
        const startTime = Date.now();
        
        const opts: ReportOptions = {
            includeMetrics: true,
            includeFailureAnalysis: true,
            includePatternAnalysis: true,
            includePerformanceData: true,
            includeLogEntries: false,
            format: 'markdown',
            severity: 'all',
            ...options
        };

        const reportId = `diagnostic-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        Logger.info('DiagnosticReports', `Generating comprehensive report: ${reportId}`, opts);

        const report: DiagnosticReport = {
            id: reportId,
            timestamp: new Date().toISOString(),
            title: 'Comprehensive Slack Formatter Diagnostic Report',
            summary: '',
            recommendations: [],
            metadata: {
                generationTime: 0,
                dataPoints: 0,
                coverage: '',
                reliability: 0
            }
        };

        // Collect metrics if requested
        if (opts.includeMetrics) {
            report.metrics = this.metricsCollector.collectMetrics();
        }

        // Analyze failures if requested
        if (opts.includeFailureAnalysis) {
            const allFailures = this.debugUtilities.analyzeFailures();
            report.failures = this.filterFailuresBySeverity(allFailures, opts.severity!);
        }

        // Include log entries if requested
        if (opts.includeLogEntries) {
            const logEntries = Logger.getLogEntries();
            report.logEntries = opts.timeWindow ? 
                this.filterLogEntriesByTime(logEntries, opts.timeWindow) : 
                logEntries;
        }

        // Generate summary and recommendations
        report.summary = this.generateSummary(report);
        report.recommendations = this.generateRecommendations(report);

        // Update metadata
        report.metadata.generationTime = Date.now() - startTime;
        report.metadata.dataPoints = this.countDataPoints(report);
        report.metadata.coverage = this.calculateCoverage(report);
        report.metadata.reliability = this.calculateReliability(report);

        Logger.info('DiagnosticReports', `Report generation completed: ${reportId}`, {
            generationTime: report.metadata.generationTime,
            dataPoints: report.metadata.dataPoints
        });

        return report;
    }

    /**
     * Generate performance-focused report
     */
    public generatePerformanceReport(): DiagnosticReport {
        const report = this.generateComprehensiveReport({
            includeMetrics: true,
            includeFailureAnalysis: true,
            includePatternAnalysis: false,
            includePerformanceData: true,
            includeLogEntries: false,
            severity: 'high'
        });

        report.title = 'Performance Analysis Report';
        report.summary = this.generatePerformanceSummary(report);

        return report;
    }

    /**
     * Generate failure analysis report
     */
    public generateFailureReport(severity: 'critical' | 'high' | 'all' = 'all'): DiagnosticReport {
        const report = this.generateComprehensiveReport({
            includeMetrics: false,
            includeFailureAnalysis: true,
            includePatternAnalysis: true,
            includePerformanceData: false,
            includeLogEntries: true,
            severity
        });

        report.title = `Failure Analysis Report (${severity.toUpperCase()})`;
        report.summary = this.generateFailureSummary(report);

        return report;
    }

    /**
     * Generate pattern analysis report
     */
    public generatePatternReport(): DiagnosticReport {
        const debugSession = this.debugUtilities.startDebugSession();
        const failures = this.debugUtilities.analyzeFailures();
        this.debugUtilities.endDebugSession();

        const report: DiagnosticReport = {
            id: `pattern-${Date.now()}`,
            timestamp: new Date().toISOString(),
            title: 'Pattern Analysis Report',
            summary: '',
            failures,
            recommendations: [],
            metadata: {
                generationTime: 0,
                dataPoints: failures.length,
                coverage: 'pattern-focused',
                reliability: 0.8
            }
        };

        report.summary = this.generatePatternSummary(report);
        report.recommendations = this.generatePatternRecommendations(report);

        return report;
    }

    /**
     * Export report in specified format
     */
    public exportReport(report: DiagnosticReport, format: 'markdown' | 'json' | 'csv' | 'html'): string {
        switch (format) {
            case 'markdown':
                return this.exportAsMarkdown(report);
            case 'json':
                return this.exportAsJSON(report);
            case 'csv':
                return this.exportAsCSV(report);
            case 'html':
                return this.exportAsHTML(report);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Generate real-time monitoring report
     */
    public generateMonitoringReport(windowMs: number = 300000): DiagnosticReport {
        const report = this.generateComprehensiveReport({
            includeMetrics: true,
            includeFailureAnalysis: true,
            includePatternAnalysis: false,
            includePerformanceData: true,
            includeLogEntries: true,
            timeWindow: windowMs,
            severity: 'high'
        });

        report.title = `Real-time Monitoring Report (${windowMs / 1000}s window)`;
        report.summary = this.generateMonitoringSummary(report, windowMs);

        return report;
    }

    /**
     * Generate trend analysis report
     */
    public generateTrendReport(): DiagnosticReport {
        const logEntries = Logger.getLogEntries();
        const timeWindows = [
            { name: '1 minute', ms: 60000 },
            { name: '5 minutes', ms: 300000 },
            { name: '15 minutes', ms: 900000 },
            { name: '1 hour', ms: 3600000 }
        ];

        const trends = timeWindows.map(window => {
            const windowEntries = this.filterLogEntriesByTime(logEntries, window.ms);
            return {
                window: window.name,
                entries: windowEntries.length,
                errors: windowEntries.filter(e => e.level === 'ERROR').length,
                diagnostics: windowEntries.filter(e => e.diagnostic).length
            };
        });

        const report: DiagnosticReport = {
            id: `trend-${Date.now()}`,
            timestamp: new Date().toISOString(),
            title: 'Trend Analysis Report',
            summary: this.generateTrendSummary(trends),
            recommendations: this.generateTrendRecommendations(trends),
            metadata: {
                generationTime: 0,
                dataPoints: trends.length,
                coverage: 'temporal-analysis',
                reliability: 0.7
            }
        };

        return report;
    }

    /**
     * Filter failures by severity
     */
    private filterFailuresBySeverity(failures: FailureAnalysis[], severity: string): FailureAnalysis[] {
        if (severity === 'all') return failures;
        return failures.filter(f => f.severity === severity);
    }

    /**
     * Filter log entries by time window
     */
    private filterLogEntriesByTime(entries: StructuredLogEntry[], windowMs: number): StructuredLogEntry[] {
        const cutoff = new Date(Date.now() - windowMs).toISOString();
        return entries.filter(entry => entry.timestamp > cutoff);
    }

    /**
     * Generate comprehensive summary
     */
    private generateSummary(report: DiagnosticReport): string {
        const parts: string[] = [];

        if (report.metrics) {
            parts.push(`Analyzed ${report.metrics.parsing.totalMessages} messages`);
            parts.push(`${(report.metrics.parsing.successRate * 100).toFixed(1)}% parsing success rate`);
        }

        if (report.failures) {
            const critical = report.failures.filter(f => f.severity === 'critical').length;
            const high = report.failures.filter(f => f.severity === 'high').length;
            parts.push(`${critical} critical and ${high} high-priority issues identified`);
        }

        return parts.join(', ');
    }

    /**
     * Generate recommendations
     */
    private generateRecommendations(report: DiagnosticReport): string[] {
        const recommendations: string[] = [];

        if (report.failures) {
            const criticalCount = report.failures.filter(f => f.severity === 'critical').length;
            if (criticalCount > 0) {
                recommendations.push(`Immediately address ${criticalCount} critical issues`);
            }

            const frequentCategories = this.getFrequentFailureCategories(report.failures);
            if (frequentCategories.length > 0) {
                recommendations.push(`Focus on ${frequentCategories.join(', ')} improvements`);
            }
        }

        if (report.metrics) {
            if (report.metrics.parsing.successRate < 0.8) {
                recommendations.push('Improve parsing algorithm reliability');
            }
            
            if (report.metrics.performance.averageExecutionTime > 500) {
                recommendations.push('Optimize performance for better response times');
            }
        }

        return recommendations;
    }

    /**
     * Get most frequent failure categories
     */
    private getFrequentFailureCategories(failures: FailureAnalysis[]): string[] {
        const categories: Record<string, number> = {};
        
        for (const failure of failures) {
            categories[failure.category] = (categories[failure.category] || 0) + 1;
        }

        return Object.entries(categories)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([category]) => category);
    }

    /**
     * Count total data points in report
     */
    private countDataPoints(report: DiagnosticReport): number {
        let count = 0;
        
        if (report.metrics) count += 1;
        if (report.failures) count += report.failures.length;
        if (report.patterns) count += report.patterns.length;
        if (report.logEntries) count += report.logEntries.length;

        return count;
    }

    /**
     * Calculate coverage percentage
     */
    private calculateCoverage(report: DiagnosticReport): string {
        const components = ['metrics', 'failures', 'patterns', 'logEntries'];
        const included = components.filter(comp => report[comp as keyof DiagnosticReport]).length;
        return `${(included / components.length * 100).toFixed(0)}%`;
    }

    /**
     * Calculate reliability score
     */
    private calculateReliability(report: DiagnosticReport): number {
        let score = 0.5; // Base reliability
        
        if (report.failures && report.failures.length > 0) {
            const avgConfidence = report.failures.reduce((sum, f) => sum + f.confidence, 0) / report.failures.length;
            score += avgConfidence * 0.3;
        }

        if (report.metrics) {
            score += 0.2; // Metrics always add reliability
        }

        return Math.min(score, 1.0);
    }

    /**
     * Export as Markdown
     */
    private exportAsMarkdown(report: DiagnosticReport): string {
        let markdown = `# ${report.title}\n\n`;
        markdown += `**Generated:** ${report.timestamp}\n`;
        markdown += `**Report ID:** ${report.id}\n\n`;
        
        markdown += `## Summary\n${report.summary}\n\n`;

        if (report.metrics) {
            markdown += `## Metrics\n`;
            markdown += `- Total Messages: ${report.metrics.parsing.totalMessages}\n`;
            markdown += `- Success Rate: ${(report.metrics.parsing.successRate * 100).toFixed(1)}%\n`;
            markdown += `- Average Response Time: ${report.metrics.parsing.averageParsingTime.toFixed(2)}ms\n\n`;
        }

        if (report.failures && report.failures.length > 0) {
            markdown += `## Issues\n`;
            for (const failure of report.failures) {
                markdown += `### ${failure.category} - ${failure.severity.toUpperCase()}\n`;
                markdown += `${failure.description}\n`;
                if (failure.suggestedFix) {
                    markdown += `**Fix:** ${failure.suggestedFix}\n`;
                }
                markdown += '\n';
            }
        }

        if (report.recommendations.length > 0) {
            markdown += `## Recommendations\n`;
            for (const rec of report.recommendations) {
                markdown += `- ${rec}\n`;
            }
        }

        return markdown;
    }

    /**
     * Export as JSON
     */
    private exportAsJSON(report: DiagnosticReport): string {
        return JSON.stringify(report, null, 2);
    }

    /**
     * Export as CSV (simplified for tabular data)
     */
    private exportAsCSV(report: DiagnosticReport): string {
        if (!report.failures) return 'No failure data available for CSV export';

        const headers = ['Category', 'Severity', 'Description', 'Confidence', 'Suggested Fix'];
        const rows = report.failures.map(f => [
            f.category,
            f.severity,
            f.description.replace(/,/g, ';'),
            f.confidence.toFixed(2),
            (f.suggestedFix || '').replace(/,/g, ';')
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    /**
     * Export as HTML
     */
    private exportAsHTML(report: DiagnosticReport): string {
        return `<!DOCTYPE html>
<html>
<head>
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; }
        .section { margin: 20px 0; }
        .issue { background: #f5f5f5; padding: 10px; margin: 10px 0; border-left: 4px solid #ff6b6b; }
        .metric { background: #e8f5e8; padding: 10px; margin: 5px 0; }
        .critical { border-left-color: #ff4757; }
        .high { border-left-color: #ffa502; }
        .medium { border-left-color: #fffa65; }
        .low { border-left-color: #7bed9f; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
        <p><strong>Summary:</strong> ${report.summary}</p>
    </div>
    
    ${report.failures ? `
    <div class="section">
        <h2>Issues</h2>
        ${report.failures.map(f => `
        <div class="issue ${f.severity}">
            <h3>${f.category} - ${f.severity.toUpperCase()}</h3>
            <p>${f.description}</p>
            ${f.suggestedFix ? `<p><strong>Suggested Fix:</strong> ${f.suggestedFix}</p>` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}
    
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
    }

    // Placeholder methods for specialized summaries
    private generatePerformanceSummary(report: DiagnosticReport): string {
        return `Performance analysis focusing on execution times and resource usage`;
    }

    private generateFailureSummary(report: DiagnosticReport): string {
        return `Failure analysis identifying critical issues and improvement opportunities`;
    }

    private generatePatternSummary(report: DiagnosticReport): string {
        return `Pattern analysis revealing parsing behavior and optimization opportunities`;
    }

    private generateMonitoringSummary(report: DiagnosticReport, windowMs: number): string {
        return `Real-time monitoring report covering the last ${windowMs / 1000} seconds`;
    }

    private generateTrendSummary(trends: any[]): string {
        return `Trend analysis showing activity patterns over multiple time windows`;
    }

    private generatePatternRecommendations(report: DiagnosticReport): string[] {
        return ['Review pattern matching accuracy', 'Optimize frequently failing patterns'];
    }

    private generateTrendRecommendations(trends: any[]): string[] {
        return ['Monitor activity spikes', 'Investigate error patterns'];
    }
}

export type { ReportOptions, DiagnosticReport };