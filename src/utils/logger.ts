/**
 * Type constraint for data that can be safely logged and serialized
 */
type LoggableData = 
    | string 
    | number 
    | boolean 
    | null 
    | undefined
    | Error
    | Record<string, unknown>
    | Array<unknown>
    | { [key: string]: unknown };

/**
 * Diagnostic information for parsing decisions
 */
interface DiagnosticContext {
    operationId?: string;
    line?: number;
    text?: string;
    confidence?: number;
    matchedPatterns?: string[];
    rejectedPatterns?: string[];
    boundaryDecision?: string;
    formatDecision?: string;
    performanceData?: {
        startTime: number;
        endTime?: number;
        memoryUsage?: number;
    };
}

/**
 * Performance metrics for monitoring
 */
interface PerformanceMetrics {
    startTime: number;
    endTime?: number;
    duration?: number;
    memoryBefore?: number;
    memoryAfter?: number;
    memoryDelta?: number;
    operation: string;
    details?: Record<string, unknown>;
}

/**
 * Structured log entry for metrics collection
 */
interface StructuredLogEntry {
    timestamp: string;
    level: string;
    className: string;
    message: string;
    data?: LoggableData;
    diagnostic?: DiagnosticContext;
    performance?: PerformanceMetrics;
}

/**
 * Enhanced shared logger utility with diagnostic and performance monitoring capabilities
 */
export class Logger {
    // Basic console logger, could be replaced with a more robust library if needed.
    private static logger = console; 
    private static prefix = "[SlackFormat]"; // Centralized prefix
    private static debugEnabled = false; // Performance optimization flag
    private static diagnosticEnabled = false; // Diagnostic logging flag
    private static performanceEnabled = false; // Performance monitoring flag
    private static logEntries: StructuredLogEntry[] = []; // In-memory log storage for analysis
    private static maxLogEntries = 1000; // Prevent memory leaks

    /**
     * Logs a message with a specified level and optional data.
     * @param level Log level ('debug', 'info', 'warn', 'error')
     * @param className Name of the calling class/module for context
     * @param message The message to log
     * @param data Optional additional data (will be stringified)
     * @param diagnostic Optional diagnostic context for parsing decisions
     * @param performance Optional performance metrics
     */
    public static log(
        level: 'debug' | 'info' | 'warn' | 'error', 
        className: string, 
        message: string, 
        data?: LoggableData,
        diagnostic?: DiagnosticContext,
        performance?: PerformanceMetrics
    ): void {
        // Basic level filtering - could be extended with configuration
        if (level === 'debug' && !this.debugEnabled) return;

        // Build log message with minimal overhead
        const timestamp = new Date().toISOString();
        const levelStr = level.toUpperCase();
        
        // Create structured log entry
        const logEntry: StructuredLogEntry = {
            timestamp,
            level: levelStr,
            className,
            message,
            data,
            diagnostic,
            performance
        };

        // Store in memory for analysis (with size limit)
        this.addLogEntry(logEntry);
        
        // Build console output
        let consoleMessage = `${this.prefix} ${timestamp} [${levelStr}] [${className}] ${message}`;
        
        if (data !== undefined) {
            const logData = JSON.stringify(data);
            consoleMessage += ` | Data: ${logData}`;
        }

        if (diagnostic && this.diagnosticEnabled) {
            consoleMessage += ` | Diagnostic: ${JSON.stringify(diagnostic)}`;
        }

        if (performance && this.performanceEnabled) {
            consoleMessage += ` | Performance: ${JSON.stringify(performance)}`;
        }

        this.logger[level](consoleMessage);
    }

    /**
     * Add log entry to in-memory storage with size management
     */
    private static addLogEntry(entry: StructuredLogEntry): void {
        this.logEntries.push(entry);
        
        // Prevent memory leaks by limiting stored entries
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries = this.logEntries.slice(-this.maxLogEntries);
        }
    }

    // Convenience methods for each level
    /**
     * Logs a debug message only if debug is enabled.
     * @param className Name of the calling class/module.
     * @param message The message to log.
     * @param data Optional additional data.
     * @param diagnostic Optional diagnostic context.
     * @param performance Optional performance metrics.
     */
    public static debug(className: string, message: string, data?: LoggableData, diagnostic?: DiagnosticContext, performance?: PerformanceMetrics): void {
        this.log('debug', className, message, data, diagnostic, performance);
    }
    
    public static info(className: string, message: string, data?: LoggableData, diagnostic?: DiagnosticContext, performance?: PerformanceMetrics): void {
        this.log('info', className, message, data, diagnostic, performance);
    }
    
    public static warn(className: string, message: string, data?: LoggableData, diagnostic?: DiagnosticContext, performance?: PerformanceMetrics): void {
        this.log('warn', className, message, data, diagnostic, performance);
    }
    
    public static error(className: string, message: string, data?: LoggableData, diagnostic?: DiagnosticContext, performance?: PerformanceMetrics): void {
        this.log('error', className, message, data, diagnostic, performance);
    }

    /**
     * Specialized diagnostic logging for parsing decisions
     */
    public static diagnostic(className: string, message: string, diagnostic: DiagnosticContext, data?: LoggableData): void {
        if (!this.diagnosticEnabled) return;
        this.log('debug', className, `[DIAGNOSTIC] ${message}`, data, diagnostic);
    }

    /**
     * Specialized performance logging for monitoring
     */
    public static performance(className: string, operation: string, metrics: PerformanceMetrics, data?: LoggableData): void {
        if (!this.performanceEnabled) return;
        this.log('info', className, `[PERFORMANCE] ${operation}`, data, undefined, metrics);
    }
    
    /**
     * Check if debug logging is enabled for performance optimization
     * @returns {boolean} True if debug logging is enabled
     */
    public static isDebugEnabled(): boolean {
        return this.debugEnabled;
    }
    
    /**
     * Set debug logging state
     * @param {boolean} enabled - Whether debug logging should be enabled
     */
    public static setDebugEnabled(enabled: boolean): void {
        this.debugEnabled = enabled;
    }

    /**
     * Check if diagnostic logging is enabled
     * @returns {boolean} True if diagnostic logging is enabled
     */
    public static isDiagnosticEnabled(): boolean {
        return this.diagnosticEnabled;
    }
    
    /**
     * Set diagnostic logging state
     * @param {boolean} enabled - Whether diagnostic logging should be enabled
     */
    public static setDiagnosticEnabled(enabled: boolean): void {
        this.diagnosticEnabled = enabled;
    }

    /**
     * Check if performance monitoring is enabled
     * @returns {boolean} True if performance monitoring is enabled
     */
    public static isPerformanceEnabled(): boolean {
        return this.performanceEnabled;
    }
    
    /**
     * Set performance monitoring state
     * @param {boolean} enabled - Whether performance monitoring should be enabled
     */
    public static setPerformanceEnabled(enabled: boolean): void {
        this.performanceEnabled = enabled;
    }

    /**
     * Get stored log entries for analysis
     * @returns {StructuredLogEntry[]} Array of log entries
     */
    public static getLogEntries(): StructuredLogEntry[] {
        return [...this.logEntries]; // Return copy to prevent external mutation
    }

    /**
     * Clear stored log entries
     */
    public static clearLogEntries(): void {
        this.logEntries = [];
    }

    /**
     * Get metrics summary from stored log entries
     */
    public static getMetricsSummary(): {
        totalEntries: number;
        byLevel: Record<string, number>;
        diagnosticEntries: number;
        performanceEntries: number;
        errorCount: number;
        averagePerformance?: number;
    } {
        const summary = {
            totalEntries: this.logEntries.length,
            byLevel: {} as Record<string, number>,
            diagnosticEntries: 0,
            performanceEntries: 0,
            errorCount: 0,
            averagePerformance: 0
        };

        let totalDuration = 0;
        let performanceCount = 0;

        for (const entry of this.logEntries) {
            // Count by level
            summary.byLevel[entry.level] = (summary.byLevel[entry.level] || 0) + 1;
            
            // Count diagnostic entries
            if (entry.diagnostic) {
                summary.diagnosticEntries++;
            }
            
            // Count performance entries and calculate averages
            if (entry.performance) {
                summary.performanceEntries++;
                if (entry.performance.duration) {
                    totalDuration += entry.performance.duration;
                    performanceCount++;
                }
            }
            
            // Count errors
            if (entry.level === 'ERROR') {
                summary.errorCount++;
            }
        }

        if (performanceCount > 0) {
            summary.averagePerformance = totalDuration / performanceCount;
        }

        return summary;
    }

    /**
     * Create a performance measurement context
     */
    public static startPerformance(operation: string): PerformanceMetrics {
        return {
            operation,
            startTime: Date.now(),
            memoryBefore: this.getMemoryUsage()
        };
    }

    /**
     * Complete a performance measurement
     */
    public static endPerformance(metrics: PerformanceMetrics): PerformanceMetrics {
        const endTime = Date.now();
        const memoryAfter = this.getMemoryUsage();
        
        return {
            ...metrics,
            endTime,
            duration: endTime - metrics.startTime,
            memoryAfter,
            memoryDelta: memoryAfter - (metrics.memoryBefore || 0)
        };
    }

    /**
     * Get current memory usage (if available)
     */
    private static getMemoryUsage(): number {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        return 0;
    }
}

export type { DiagnosticContext, PerformanceMetrics, StructuredLogEntry };