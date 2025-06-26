import { MetricsCollector, MetricsDashboard } from './metrics-collector.js';
import { Logger, StructuredLogEntry } from './logger.js';

/**
 * Analysis of parsing failures and issues
 */
interface FailureAnalysis {
    category: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    confidence: number;
    suggestedFix?: string;
    occurrence: number;
    timestamp: string;
}

/**
 * Analysis of parsing patterns and behavior
 */
interface PatternAnalysis {
    pattern: string;
    frequency: number;
    successRate: number;
    averageConfidence: number;
    commonFailures: string[];
}

/**
 * Basic debug utilities for failure analysis
 */
class DebugUtilities {
    public startDebugSession(): string {
        return `debug-session-${Date.now()}`;
    }

    public endDebugSession(): void {
        // Session cleanup if needed
    }

    public analyzeFailures(): FailureAnalysis[] {
        const logEntries = Logger.getLogEntries();
        const failures: FailureAnalysis[] = [];

        // Analyze error entries
        const errorEntries = logEntries.filter(entry => entry.level === 'ERROR');
        
        errorEntries.forEach(entry => {
            failures.push({
                category: entry.className || 'unknown',
                severity: this.determineSeverity(entry),
                description: entry.message,
                confidence: entry.diagnostic?.confidence || 0.5,
                suggestedFix: this.generateSuggestedFix(entry),
                occurrence: 1,
                timestamp: entry.timestamp
            });
        });

        // Aggregate similar failures
        return this.aggregateFailures(failures);
    }

    private determineSeverity(entry: StructuredLogEntry): 'critical' | 'high' | 'medium' | 'low' {
        if (entry.message.toLowerCase().includes('critical') || 
            entry.message.toLowerCase().includes('fatal')) {
            return 'critical';
        }
        if (entry.message.toLowerCase().includes('parsing failed') ||
            entry.message.toLowerCase().includes('boundary detection failed')) {
            return 'high';
        }
        if (entry.message.toLowerCase().includes('warning') ||
            entry.message.toLowerCase().includes('performance')) {
            return 'medium';
        }
        return 'low';
    }

    private generateSuggestedFix(entry: StructuredLogEntry): string | undefined {
        const message = entry.message.toLowerCase();
        
        if (message.includes('parsing failed')) {
            return 'Review message format detection algorithms';
        }
        if (message.includes('boundary detection')) {
            return 'Improve boundary detection patterns';
        }
        if (message.includes('performance')) {
            return 'Optimize processing algorithm';
        }
        if (message.includes('memory')) {
            return 'Investigate memory usage patterns';
        }
        
        return undefined;
    }

    private aggregateFailures(failures: FailureAnalysis[]): FailureAnalysis[] {
        const aggregated: Record<string, FailureAnalysis> = {};
        
        failures.forEach(failure => {
            const key = `${failure.category}-${failure.description}`;
            if (aggregated[key]) {
                aggregated[key].occurrence++;
            } else {
                aggregated[key] = { ...failure };
            }
        });
        
        return Object.values(aggregated);
    }
}

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
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        /* Base styles */
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #f8f9fa;
        }
        
        /* Layout components */
        .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            border-bottom: none;
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 2rem;
            font-weight: 300;
        }
        
        .header p {
            margin: 5px 0;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .section {
            margin: 30px 0;
        }
        
        .section:first-child {
            margin-top: 0;
        }
        
        .section h2 {
            color: #2c3e50;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 1.5rem;
            font-weight: 500;
        }
        
        /* Metric cards */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        
        .metric {
            background: linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%);
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #28a745;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .metric-label {
            font-size: 0.875rem;
            color: #6c757d;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .metric-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: #2c3e50;
        }
        
        /* Issue styling */
        .issues-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .issue {
            background: #fff;
            padding: 20px;
            margin: 0;
            border-radius: 6px;
            border-left: 4px solid #ff6b6b;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            transition: box-shadow 0.2s ease;
        }
        
        .issue:hover {
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .issue h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 1.125rem;
        }
        
        .issue p {
            margin: 10px 0;
            line-height: 1.5;
        }
        
        .suggested-fix {
            background: #f8f9fa;
            border-radius: 4px;
            padding: 15px;
            margin-top: 15px;
            border-left: 3px solid #17a2b8;
        }
        
        .suggested-fix strong {
            color: #17a2b8;
        }
        
        /* Severity levels */
        .critical {
            border-left-color: #dc3545;
        }
        
        .critical h3 {
            color: #dc3545;
        }
        
        .high {
            border-left-color: #fd7e14;
        }
        
        .high h3 {
            color: #fd7e14;
        }
        
        .medium {
            border-left-color: #ffc107;
        }
        
        .medium h3 {
            color: #e67e22;
        }
        
        .low {
            border-left-color: #28a745;
        }
        
        .low h3 {
            color: #28a745;
        }
        
        /* Recommendations */
        .recommendations-list {
            background: #e3f2fd;
            border-radius: 6px;
            padding: 20px;
            border-left: 4px solid #2196f3;
        }
        
        .recommendations-list ul {
            margin: 0;
            padding-left: 20px;
        }
        
        .recommendations-list li {
            margin: 8px 0;
            line-height: 1.5;
        }
        
        /* Metadata footer */
        .metadata {
            background: #f8f9fa;
            padding: 20px;
            margin-top: 30px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        
        .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }
        
        .metadata-item {
            text-align: center;
        }
        
        .metadata-label {
            font-size: 0.75rem;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .metadata-value {
            font-size: 1rem;
            font-weight: 600;
            color: #2c3e50;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            body {
                padding: 20px 10px;
            }
            
            .header {
                padding: 20px;
            }
            
            .content {
                padding: 20px;
            }
            
            .metrics-grid {
                grid-template-columns: 1fr;
            }
            
            .metadata-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        /* Print styles */
        @media print {
            body {
                background: white;
                font-size: 12pt;
            }
            
            .container {
                box-shadow: none;
            }
            
            .header {
                background: #2c3e50 !important;
                color: white !important;
            }
            
            .issue {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${report.title}</h1>
            <p><strong>Generated:</strong> ${report.timestamp}</p>
            <p><strong>Report ID:</strong> ${report.id}</p>
            <p><strong>Summary:</strong> ${report.summary}</p>
        </div>
        
        <div class="content">
            ${report.metrics ? `
            <div class="section">
                <h2>Metrics Overview</h2>
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-label">Total Messages</div>
                        <div class="metric-value">${report.metrics.parsing.totalMessages}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Success Rate</div>
                        <div class="metric-value">${(report.metrics.parsing.successRate * 100).toFixed(1)}%</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Avg Response Time</div>
                        <div class="metric-value">${report.metrics.parsing.averageParsingTime.toFixed(2)}ms</div>
                    </div>
                    ${report.metrics.performance ? `
                    <div class="metric">
                        <div class="metric-label">Avg Execution Time</div>
                        <div class="metric-value">${report.metrics.performance.averageExecutionTime.toFixed(2)}ms</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            ${report.failures && report.failures.length > 0 ? `
            <div class="section">
                <h2>Issues Identified</h2>
                <div class="issues-container">
                    ${report.failures.map(f => `
                    <div class="issue ${f.severity}">
                        <h3>${f.category} - ${f.severity.toUpperCase()}</h3>
                        <p>${f.description}</p>
                        ${f.suggestedFix ? `
                        <div class="suggested-fix">
                            <strong>Suggested Fix:</strong> ${f.suggestedFix}
                        </div>
                        ` : ''}
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${report.recommendations.length > 0 ? `
            <div class="section">
                <h2>Recommendations</h2>
                <div class="recommendations-list">
                    <ul>
                        ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            </div>
            ` : ''}
            
            ${report.logEntries && report.logEntries.length > 0 ? `
            <div class="section">
                <h2>Recent Log Entries</h2>
                <div class="issues-container">
                    ${report.logEntries.slice(0, 10).map(entry => `
                    <div class="issue ${entry.level === 'ERROR' ? 'critical' : entry.level === 'WARN' ? 'medium' : 'low'}">
                        <h3>${entry.level} - ${entry.component}</h3>
                        <p>${entry.message}</p>
                        <p><small>Timestamp: ${entry.timestamp}</small></p>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <div class="metadata">
                <div class="metadata-grid">
                    <div class="metadata-item">
                        <div class="metadata-label">Generation Time</div>
                        <div class="metadata-value">${report.metadata.generationTime}ms</div>
                    </div>
                    <div class="metadata-item">
                        <div class="metadata-label">Data Points</div>
                        <div class="metadata-value">${report.metadata.dataPoints}</div>
                    </div>
                    <div class="metadata-item">
                        <div class="metadata-label">Coverage</div>
                        <div class="metadata-value">${report.metadata.coverage}</div>
                    </div>
                    <div class="metadata-item">
                        <div class="metadata-label">Reliability</div>
                        <div class="metadata-value">${(report.metadata.reliability * 100).toFixed(0)}%</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    // Specialized summary methods based on actual report data
    private generatePerformanceSummary(report: DiagnosticReport): string {
        if (!report.metrics) {
            return 'Performance analysis unavailable - no metrics data collected';
        }

        const { performance, parsing } = report.metrics;
        const parts: string[] = [];

        // Execution time analysis
        if (performance.averageExecutionTime > 0) {
            const timeStatus = performance.averageExecutionTime > 100 ? 'slow' : 
                             performance.averageExecutionTime > 50 ? 'moderate' : 'fast';
            parts.push(`Average execution time: ${performance.averageExecutionTime.toFixed(2)}ms (${timeStatus})`);
        }

        // Memory usage analysis
        if (performance.memoryUsage.peak > 0) {
            const memoryMB = (performance.memoryUsage.peak / 1024 / 1024).toFixed(2);
            parts.push(`Peak memory usage: ${memoryMB}MB`);
        }

        // Parsing performance
        if (parsing.averageParsingTime > 0) {
            const parsingStatus = parsing.averageParsingTime > 50 ? 'needs optimization' : 'acceptable';
            parts.push(`Message parsing: ${parsing.averageParsingTime.toFixed(2)}ms/message (${parsingStatus})`);
        }

        // Operation type breakdown
        const operationTypes = Object.keys(performance.operationTypes);
        if (operationTypes.length > 0) {
            const slowestOp = operationTypes.reduce((prev, curr) => 
                performance.operationTypes[curr].averageTime > performance.operationTypes[prev].averageTime ? curr : prev
            );
            parts.push(`Slowest operation: ${slowestOp} (${performance.operationTypes[slowestOp].averageTime.toFixed(2)}ms avg)`);
        }

        return parts.length > 0 ? parts.join(', ') : 'No significant performance data available';
    }

    private generateFailureSummary(report: DiagnosticReport): string {
        if (!report.failures || report.failures.length === 0) {
            return 'No failures detected - system operating normally';
        }

        const failures = report.failures;
        const parts: string[] = [];

        // Severity breakdown
        const severityCount = {
            critical: failures.filter(f => f.severity === 'critical').length,
            high: failures.filter(f => f.severity === 'high').length,
            medium: failures.filter(f => f.severity === 'medium').length,
            low: failures.filter(f => f.severity === 'low').length
        };

        const severityParts = [];
        if (severityCount.critical > 0) severityParts.push(`${severityCount.critical} critical`);
        if (severityCount.high > 0) severityParts.push(`${severityCount.high} high`);
        if (severityCount.medium > 0) severityParts.push(`${severityCount.medium} medium`);
        if (severityCount.low > 0) severityParts.push(`${severityCount.low} low`);
        
        if (severityParts.length > 0) {
            parts.push(`Identified ${severityParts.join(', ')} priority issues`);
        }

        // Category analysis
        const categories = this.getFrequentFailureCategories(failures);
        if (categories.length > 0) {
            parts.push(`Most affected areas: ${categories.join(', ')}`);
        }

        // Confidence analysis
        const avgConfidence = failures.reduce((sum, f) => sum + f.confidence, 0) / failures.length;
        const confidenceStatus = avgConfidence > 0.8 ? 'high confidence' : 
                               avgConfidence > 0.5 ? 'moderate confidence' : 'low confidence';
        parts.push(`Analysis reliability: ${(avgConfidence * 100).toFixed(1)}% (${confidenceStatus})`);

        return parts.join(', ');
    }

    private generatePatternSummary(report: DiagnosticReport): string {
        if (!report.failures || report.failures.length === 0) {
            return 'Pattern analysis complete - no significant issues detected';
        }

        const failures = report.failures;
        const parts: string[] = [];

        // Pattern frequency analysis
        const patternFrequency: Record<string, number> = {};
        failures.forEach(failure => {
            patternFrequency[failure.category] = (patternFrequency[failure.category] || 0) + 1;
        });

        const mostFrequentPattern = Object.entries(patternFrequency)
            .sort(([,a], [,b]) => b - a)[0];
        
        if (mostFrequentPattern) {
            parts.push(`Most frequent issue: ${mostFrequentPattern[0]} (${mostFrequentPattern[1]} occurrences)`);
        }

        // Confidence distribution
        const highConfidence = failures.filter(f => f.confidence > 0.7).length;
        const mediumConfidence = failures.filter(f => f.confidence >= 0.3 && f.confidence <= 0.7).length;
        const lowConfidence = failures.filter(f => f.confidence < 0.3).length;

        if (highConfidence > 0) {
            const percent = (highConfidence / failures.length * 100).toFixed(1);
            parts.push(`${percent}% high-confidence pattern matches`);
        }

        // Improvement opportunities
        const improvementAreas = failures
            .filter(f => f.suggestedFix)
            .map(f => f.category)
            .filter((category, index, self) => self.indexOf(category) === index)
            .slice(0, 3);
        
        if (improvementAreas.length > 0) {
            parts.push(`Optimization opportunities in: ${improvementAreas.join(', ')}`);
        }

        return parts.length > 0 ? parts.join(', ') : 'Pattern analysis indicates stable parsing behavior';
    }

    private generateMonitoringSummary(report: DiagnosticReport, windowMs: number): string {
        const windowSeconds = windowMs / 1000;
        const parts: string[] = [`Monitoring window: ${windowSeconds}s`];

        // Activity analysis
        if (report.logEntries) {
            const entries = report.logEntries;
            const errorEntries = entries.filter(e => e.level === 'ERROR');
            const warningEntries = entries.filter(e => e.level === 'WARN');
            
            parts.push(`${entries.length} log entries`);
            
            if (errorEntries.length > 0) {
                const errorRate = (errorEntries.length / entries.length * 100).toFixed(1);
                parts.push(`${errorEntries.length} errors (${errorRate}% error rate)`);
            }
            
            if (warningEntries.length > 0) {
                parts.push(`${warningEntries.length} warnings`);
            }
        }

        // Performance trends
        if (report.metrics) {
            const { parsing, performance } = report.metrics;
            
            if (parsing.totalMessages > 0) {
                const messagesPerSecond = (parsing.totalMessages / windowSeconds).toFixed(1);
                parts.push(`${parsing.totalMessages} messages processed (${messagesPerSecond}/s)`);
                
                if (parsing.successRate < 1.0) {
                    const failureRate = ((1 - parsing.successRate) * 100).toFixed(1);
                    parts.push(`${failureRate}% parsing failures`);
                }
            }
            
            if (performance.totalOperations > 0) {
                const opsPerSecond = (performance.totalOperations / windowSeconds).toFixed(1);
                parts.push(`${performance.totalOperations} operations (${opsPerSecond}/s)`);
            }
        }

        // Critical issues
        if (report.failures) {
            const criticalFailures = report.failures.filter(f => f.severity === 'critical');
            if (criticalFailures.length > 0) {
                parts.push(`⚠️ ${criticalFailures.length} critical issues require attention`);
            }
        }

        return parts.join(', ');
    }

    private generateTrendSummary(trends: Array<{window: string, entries: number, errors: number, diagnostics: number}>): string {
        if (trends.length === 0) {
            return 'No trend data available for analysis';
        }

        const parts: string[] = [];

        // Activity trend analysis
        const totalEntries = trends.reduce((sum, t) => sum + t.entries, 0);
        const totalErrors = trends.reduce((sum, t) => sum + t.errors, 0);
        const totalDiagnostics = trends.reduce((sum, t) => sum + t.diagnostics, 0);

        if (totalEntries > 0) {
            parts.push(`${totalEntries} total log entries across all windows`);
        }

        // Error trend analysis
        if (totalErrors > 0) {
            const errorRate = (totalErrors / totalEntries * 100).toFixed(1);
            parts.push(`${totalErrors} errors (${errorRate}% overall error rate)`);
            
            // Check if errors are increasing or decreasing
            const recentWindow = trends[0]; // Assuming first is most recent
            const olderWindow = trends[trends.length - 1];
            
            if (recentWindow.entries > 0 && olderWindow.entries > 0) {
                const recentErrorRate = recentWindow.errors / recentWindow.entries;
                const olderErrorRate = olderWindow.errors / olderWindow.entries;
                
                if (recentErrorRate > olderErrorRate * 1.2) {
                    parts.push('⚠️ Error rate increasing over time');
                } else if (recentErrorRate < olderErrorRate * 0.8) {
                    parts.push('✅ Error rate decreasing over time');
                }
            }
        }

        // Diagnostic activity
        if (totalDiagnostics > 0) {
            const diagnosticRate = (totalDiagnostics / totalEntries * 100).toFixed(1);
            parts.push(`${totalDiagnostics} diagnostic entries (${diagnosticRate}% diagnostic activity)`);
        }

        // Peak activity window
        const peakWindow = trends.reduce((peak, current) => 
            current.entries > peak.entries ? current : peak
        );
        if (peakWindow.entries > 0) {
            parts.push(`Peak activity in ${peakWindow.window} window (${peakWindow.entries} entries)`);
        }

        return parts.join(', ');
    }

    private generatePatternRecommendations(report: DiagnosticReport): string[] {
        const recommendations: string[] = [];
        
        if (!report.failures || report.failures.length === 0) {
            return ['Continue monitoring for pattern consistency', 'Consider expanding test coverage'];
        }

        const failures = report.failures;

        // Confidence-based recommendations
        const lowConfidenceFailures = failures.filter(f => f.confidence < 0.5);
        if (lowConfidenceFailures.length > 0) {
            recommendations.push(`Review ${lowConfidenceFailures.length} low-confidence pattern matches for accuracy`);
        }

        // Category-specific recommendations
        const categories = this.getFrequentFailureCategories(failures);
        categories.forEach(category => {
            const categoryFailures = failures.filter(f => f.category === category);
            const avgConfidence = categoryFailures.reduce((sum, f) => sum + f.confidence, 0) / categoryFailures.length;
            
            if (avgConfidence < 0.6) {
                recommendations.push(`Improve ${category} pattern detection algorithms`);
            }
        });

        // Suggested fixes
        const fixableFailures = failures.filter(f => f.suggestedFix);
        if (fixableFailures.length > 0) {
            recommendations.push(`Implement ${fixableFailures.length} suggested fixes to improve pattern accuracy`);
        }

        // Severity-based recommendations
        const criticalFailures = failures.filter(f => f.severity === 'critical');
        if (criticalFailures.length > 0) {
            recommendations.push(`Prioritize resolution of ${criticalFailures.length} critical pattern issues`);
        }

        return recommendations.length > 0 ? recommendations : ['Pattern analysis indicates stable behavior'];
    }

    private generateTrendRecommendations(trends: Array<{window: string, entries: number, errors: number, diagnostics: number}>): string[] {
        const recommendations: string[] = [];
        
        if (trends.length === 0) {
            return ['Insufficient data for trend analysis', 'Continue monitoring to establish baseline'];
        }

        // Error trend analysis
        const totalEntries = trends.reduce((sum, t) => sum + t.entries, 0);
        const totalErrors = trends.reduce((sum, t) => sum + t.errors, 0);
        
        if (totalErrors > 0 && totalEntries > 0) {
            const errorRate = totalErrors / totalEntries;
            
            if (errorRate > 0.1) {
                recommendations.push('High error rate detected - investigate root causes immediately');
            } else if (errorRate > 0.05) {
                recommendations.push('Moderate error rate - consider implementing additional error handling');
            }
        }

        // Activity pattern analysis
        const maxActivity = Math.max(...trends.map(t => t.entries));
        const minActivity = Math.min(...trends.map(t => t.entries));
        const activityVariance = maxActivity - minActivity;
        
        if (activityVariance > maxActivity * 0.5) {
            recommendations.push('High activity variance detected - consider load balancing or capacity planning');
        }

        // Diagnostic activity recommendations
        const diagnosticRate = trends.reduce((sum, t) => sum + t.diagnostics, 0) / totalEntries;
        if (diagnosticRate > 0.3) {
            recommendations.push('High diagnostic activity - system may be under stress or encountering edge cases');
        }

        // Time-based recommendations
        const recentWindow = trends[0];
        const olderWindow = trends[trends.length - 1];
        
        if (recentWindow && olderWindow && recentWindow.entries > 0 && olderWindow.entries > 0) {
            const recentErrorRate = recentWindow.errors / recentWindow.entries;
            const olderErrorRate = olderWindow.errors / olderWindow.entries;
            
            if (recentErrorRate > olderErrorRate * 1.5) {
                recommendations.push('Error rate increasing over time - investigate recent changes or degradation');
            }
        }

        // Peak activity recommendations
        const peakWindow = trends.reduce((peak, current) => 
            current.entries > peak.entries ? current : peak
        );
        
        if (peakWindow.entries > 0) {
            const peakErrorRate = peakWindow.errors / peakWindow.entries;
            if (peakErrorRate > 0.1) {
                recommendations.push(`Peak activity in ${peakWindow.window} shows elevated error rate - investigate capacity limits`);
            }
        }

        return recommendations.length > 0 ? recommendations : ['Trend analysis indicates stable system behavior'];
    }
}

export type { ReportOptions, DiagnosticReport, FailureAnalysis, PatternAnalysis };
export { DebugUtilities };