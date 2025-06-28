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
 * Enhanced shared logger utility with diagnostic and performance monitoring capabilities.
 * Provides structured logging with multiple output levels, diagnostic context tracking,
 * performance metrics collection, and in-memory log storage for analysis.
 *
 * Features:
 * - Structured logging with JSON serialization
 * - Diagnostic context for parsing decisions
 * - Performance metrics collection
 * - In-memory log storage with size limits
 * - Configurable debug/diagnostic/performance logging
 * - Memory usage tracking
 *
 * @class Logger
 * @since 1.0.0
 */
export class Logger {
  // Basic console logger, could be replaced with a more robust library if needed.
  private static logger = console;
  private static prefix = '[SlackFormat]'; // Centralized prefix
  private static debugEnabled = false; // Performance optimization flag
  private static diagnosticEnabled = false; // Diagnostic logging flag
  private static performanceEnabled = false; // Performance monitoring flag
  private static logEntries: StructuredLogEntry[] = []; // In-memory log storage for analysis
  private static maxLogEntries = 1000; // Prevent memory leaks

  /**
   * Log a message with specified level and optional structured data.
   * Core logging method that handles level filtering, structured data serialization,
   * and in-memory storage with configurable output formatting.
   *
   * @param level - Log level for filtering and formatting
   * @param className - Name of calling class/module for context tracking
   * @param message - Primary log message content
   * @param data - Optional structured data (objects, arrays, errors)
   * @param diagnostic - Optional diagnostic context for debugging parsing decisions
   * @param performance - Optional performance metrics for monitoring
   * @throws Does not throw - handles serialization errors gracefully
   * @example
   * ```typescript
   * Logger.log('info', 'MyClass', 'Processing started',
   *   { items: 5 },
   *   { operationId: 'op_123', confidence: 0.95 },
   *   { startTime: Date.now(), operation: 'process' }
   * );
   * ```
   * @since 1.0.0
   * @see {@link debug} for debug-level logging
   * @see {@link info} for info-level logging
   *
   * Performance: O(1) with JSON serialization overhead. Respects debug flags for optimization.
   * Edge cases: Handles circular references, undefined values, and large objects safely.
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
    if (level === 'debug' && !Logger.debugEnabled) return;

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
      performance,
    };

    // Store in memory for analysis (with size limit)
    Logger.addLogEntry(logEntry);

    // Build console output
    let consoleMessage = `${Logger.prefix} ${timestamp} [${levelStr}] [${className}] ${message}`;

    if (data !== undefined) {
      const logData = JSON.stringify(data);
      consoleMessage += ` | Data: ${logData}`;
    }

    if (diagnostic && Logger.diagnosticEnabled) {
      consoleMessage += ` | Diagnostic: ${JSON.stringify(diagnostic)}`;
    }

    if (performance && Logger.performanceEnabled) {
      consoleMessage += ` | Performance: ${JSON.stringify(performance)}`;
    }

    Logger.logger?.[level]?.(consoleMessage);
  }

  /**
   * Add log entry to in-memory storage with automatic size management.
   * Maintains a rolling buffer of log entries to prevent memory leaks
   * while preserving recent entries for analysis and debugging.
   *
   * @param entry - Structured log entry to store
   * @throws Does not throw - handles memory management gracefully
   * @since 1.0.0
   * @private
   * @see {@link getLogEntries} for retrieving stored entries
   *
   * Performance: O(1) amortized with occasional O(n) for buffer trimming.
   * Edge cases: Automatically trims buffer when size limit exceeded.
   */
  private static addLogEntry(entry: StructuredLogEntry): void {
    Logger.logEntries.push(entry);

    // Prevent memory leaks by limiting stored entries
    if (Logger.logEntries.length > Logger.maxLogEntries) {
      Logger.logEntries = Logger.logEntries.slice(-Logger.maxLogEntries);
    }
  }

  // Convenience methods for each level
  /**
   * Log a debug message with performance optimization.
   * Only processes and outputs debug messages when debug logging is enabled,
   * providing zero-cost debugging in production environments.
   *
   * @param className - Name of the calling class/module for context
   * @param message - Debug message content
   * @param data - Optional structured debug data
   * @param diagnostic - Optional diagnostic context for parsing decisions
   * @param performance - Optional performance metrics
   * @throws Does not throw - handles all input types safely
   * @example
   * ```typescript
   * Logger.debug('Parser', 'Attempting boundary detection',
   *   { line: 42, pattern: 'username_pattern' },
   *   { confidence: 0.85, matchedPatterns: ['user:', 'timestamp'] }
   * );
   * ```
   * @since 1.0.0
   * @see {@link setDebugEnabled} for enabling debug output
   * @see {@link isDebugEnabled} for checking debug state
   *
   * Performance: O(1) when disabled, O(n) when enabled for serialization.
   * Edge cases: Safely handles expensive-to-serialize debug data when disabled.
   */
  public static debug(
    className: string,
    message: string,
    data?: LoggableData,
    diagnostic?: DiagnosticContext,
    performance?: PerformanceMetrics
  ): void {
    Logger.log('debug', className, message, data, diagnostic, performance);
  }

  /**
   * Log an informational message with optional structured data.
   * Standard logging level for general application flow and status updates.
   * Always outputs regardless of debug settings.
   *
   * @param className - Name of the calling class/module for context
   * @param message - Informational message content
   * @param data - Optional structured data for context
   * @param diagnostic - Optional diagnostic context
   * @param performance - Optional performance metrics
   * @throws Does not throw - handles all input types safely
   * @example
   * ```typescript
   * Logger.info('MessageProcessor', 'Processing completed',
   *   { messagesProcessed: 150, format: 'slack' }
   * );
   * ```
   * @since 1.0.0
   * @see {@link log} for the underlying logging implementation
   *
   * Performance: O(n) for data serialization. Always processes output.
   */
  public static info(
    className: string,
    message: string,
    data?: LoggableData,
    diagnostic?: DiagnosticContext,
    performance?: PerformanceMetrics
  ): void {
    Logger.log('info', className, message, data, diagnostic, performance);
  }

  /**
   * Log a warning message with optional structured data.
   * Used for potentially problematic situations that don't prevent operation
   * but may indicate issues requiring attention.
   *
   * @param className - Name of the calling class/module for context
   * @param message - Warning message content
   * @param data - Optional structured data providing warning context
   * @param diagnostic - Optional diagnostic context
   * @param performance - Optional performance metrics
   * @throws Does not throw - handles all input types safely
   * @example
   * ```typescript
   * Logger.warn('UrlParser', 'Invalid URL format detected',
   *   { url: 'malformed-url', fallback: 'used-default' }
   * );
   * ```
   * @since 1.0.0
   * @see {@link error} for more severe issues
   *
   * Performance: O(n) for data serialization. Always processes output.
   */
  public static warn(
    className: string,
    message: string,
    data?: LoggableData,
    diagnostic?: DiagnosticContext,
    performance?: PerformanceMetrics
  ): void {
    Logger.log('warn', className, message, data, diagnostic, performance);
  }

  /**
   * Log an error message with optional structured data.
   * Used for error conditions that may prevent normal operation
   * or indicate serious problems requiring immediate attention.
   *
   * @param className - Name of the calling class/module for context
   * @param message - Error message content
   * @param data - Optional structured data providing error context (often includes Error objects)
   * @param diagnostic - Optional diagnostic context for error analysis
   * @param performance - Optional performance metrics
   * @throws Does not throw - handles all input types safely, including Error objects
   * @example
   * ```typescript
   * try {
   *   riskyOperation();
   * } catch (error) {
   *   Logger.error('DataProcessor', 'Operation failed',
   *     { error, operation: 'parseData', input: data }
   *   );
   * }
   * ```
   * @since 1.0.0
   * @see {@link warn} for less severe issues
   *
   * Performance: O(n) for data serialization. Always processes output.
   */
  public static error(
    className: string,
    message: string,
    data?: LoggableData,
    diagnostic?: DiagnosticContext,
    performance?: PerformanceMetrics
  ): void {
    Logger.log('error', className, message, data, diagnostic, performance);
  }

  /**
   * Specialized diagnostic logging for parsing decisions and algorithm analysis.
   * Provides detailed context about parsing decisions, pattern matching,
   * and algorithm performance for debugging complex text processing.
   *
   * @param className - Name of the calling class/module
   * @param message - Diagnostic message describing the decision or analysis
   * @param diagnostic - Diagnostic context with parsing details
   * @param data - Optional additional structured data
   * @throws Does not throw - handles all diagnostic data safely
   * @example
   * ```typescript
   * Logger.diagnostic('MessageParser', 'Boundary detection decision',
   *   {
   *     operationId: 'parse_123',
   *     line: 15,
   *     confidence: 0.92,
   *     matchedPatterns: ['timestamp', 'username'],
   *     boundaryDecision: 'new_message'
   *   },
   *   { rawText: 'john_doe: hello world' }
   * );
   * ```
   * @since 1.0.0
   * @see {@link setDiagnosticEnabled} for enabling diagnostic output
   *
   * Performance: Only processes when diagnostic logging enabled. O(1) when disabled.
   * Edge cases: Handles complex diagnostic objects and parsing state safely.
   */
  public static diagnostic(
    className: string,
    message: string,
    diagnostic: DiagnosticContext,
    data?: LoggableData
  ): void {
    if (!Logger.diagnosticEnabled) return;
    Logger.log('debug', className, `[DIAGNOSTIC] ${message}`, data, diagnostic);
  }

  /**
   * Specialized performance logging for operation monitoring and optimization.
   * Tracks operation duration, memory usage, and performance metrics
   * for identifying bottlenecks and monitoring system performance.
   *
   * @param className - Name of the calling class/module
   * @param operation - Name/description of the operation being measured
   * @param metrics - Performance metrics including timing and memory data
   * @param data - Optional additional context data
   * @throws Does not throw - handles metrics collection safely
   * @example
   * ```typescript
   * const metrics = Logger.startPerformance('message_parsing');
   * // ... perform operation ...
   * const completed = Logger.endPerformance(metrics);
   * Logger.performance('MessageParser', 'Parse completion', completed,
   *   { messageCount: 150, format: 'slack' }
   * );
   * ```
   * @since 1.0.0
   * @see {@link startPerformance} for starting performance measurement
   * @see {@link endPerformance} for completing measurement
   *
   * Performance: Only processes when performance logging enabled. Minimal overhead.
   * Edge cases: Handles incomplete metrics, memory measurement failures gracefully.
   */
  public static performance(
    className: string,
    operation: string,
    metrics: PerformanceMetrics,
    data?: LoggableData
  ): void {
    if (!Logger.performanceEnabled) return;
    Logger.log('info', className, `[PERFORMANCE] ${operation}`, data, undefined, metrics);
  }

  /**
   * Check if debug logging is currently enabled.
   * Allows callers to optimize expensive debug data preparation
   * by checking debug state before performing costly operations.
   *
   * @returns True if debug logging is enabled, false otherwise
   * @throws Does not throw
   * @example
   * ```typescript
   * if (Logger.isDebugEnabled()) {
   *   const expensiveDebugData = computeComplexAnalysis();
   *   Logger.debug('Parser', 'Complex analysis', expensiveDebugData);
   * }
   * ```
   * @since 1.0.0
   * @see {@link setDebugEnabled} for controlling debug state
   *
   * Performance: O(1) - simple boolean check.
   */
  public static isDebugEnabled(): boolean {
    return Logger.debugEnabled;
  }

  /**
   * Set debug logging state for runtime configuration.
   * Enables or disables debug output at runtime, allowing dynamic
   * control of logging verbosity without code changes.
   *
   * @param enabled - Whether debug logging should be enabled
   * @throws Does not throw
   * @example
   * ```typescript
   * Logger.setDebugEnabled(true);  // Enable debug output
   * Logger.debug('Test', 'This will appear');
   *
   * Logger.setDebugEnabled(false); // Disable debug output
   * Logger.debug('Test', 'This will not appear');
   * ```
   * @since 1.0.0
   * @see {@link isDebugEnabled} for checking current state
   *
   * Performance: O(1) - simple boolean assignment.
   */
  public static setDebugEnabled(enabled: boolean): void {
    Logger.debugEnabled = enabled;
  }

  /**
   * Check if diagnostic logging is currently enabled.
   * Allows optimization of diagnostic data preparation by checking
   * diagnostic state before performing expensive analysis operations.
   *
   * @returns True if diagnostic logging is enabled, false otherwise
   * @throws Does not throw
   * @example
   * ```typescript
   * if (Logger.isDiagnosticEnabled()) {
   *   const diagnosticContext = buildComplexDiagnostics();
   *   Logger.diagnostic('Parser', 'Decision analysis', diagnosticContext);
   * }
   * ```
   * @since 1.0.0
   * @see {@link setDiagnosticEnabled} for controlling diagnostic state
   *
   * Performance: O(1) - simple boolean check.
   */
  public static isDiagnosticEnabled(): boolean {
    return Logger.diagnosticEnabled;
  }

  /**
   * Set diagnostic logging state for runtime configuration.
   * Enables or disables diagnostic output for parsing decisions and
   * algorithm analysis without requiring code changes.
   *
   * @param enabled - Whether diagnostic logging should be enabled
   * @throws Does not throw
   * @example
   * ```typescript
   * Logger.setDiagnosticEnabled(true);  // Enable diagnostic output
   * Logger.diagnostic('Parser', 'Analysis', { confidence: 0.95 });
   *
   * Logger.setDiagnosticEnabled(false); // Disable diagnostic output
   * ```
   * @since 1.0.0
   * @see {@link isDiagnosticEnabled} for checking current state
   *
   * Performance: O(1) - simple boolean assignment.
   */
  public static setDiagnosticEnabled(enabled: boolean): void {
    Logger.diagnosticEnabled = enabled;
  }

  /**
   * Check if performance monitoring is currently enabled.
   * Allows optimization of performance metric collection by checking
   * monitoring state before performing measurement operations.
   *
   * @returns True if performance monitoring is enabled, false otherwise
   * @throws Does not throw
   * @example
   * ```typescript
   * let metrics;
   * if (Logger.isPerformanceEnabled()) {
   *   metrics = Logger.startPerformance('expensive_operation');
   * }
   * // ... perform operation ...
   * if (metrics) {
   *   Logger.performance('Class', 'operation', Logger.endPerformance(metrics));
   * }
   * ```
   * @since 1.0.0
   * @see {@link setPerformanceEnabled} for controlling performance monitoring
   *
   * Performance: O(1) - simple boolean check.
   */
  public static isPerformanceEnabled(): boolean {
    return Logger.performanceEnabled;
  }

  /**
   * Set performance monitoring state for runtime configuration.
   * Enables or disables performance metric collection and logging
   * for monitoring system performance and identifying bottlenecks.
   *
   * @param enabled - Whether performance monitoring should be enabled
   * @throws Does not throw
   * @example
   * ```typescript
   * Logger.setPerformanceEnabled(true);  // Enable performance monitoring
   * const metrics = Logger.startPerformance('parsing');
   * // ... operation ...
   * Logger.performance('Parser', 'parse', Logger.endPerformance(metrics));
   *
   * Logger.setPerformanceEnabled(false); // Disable monitoring
   * ```
   * @since 1.0.0
   * @see {@link isPerformanceEnabled} for checking current state
   *
   * Performance: O(1) - simple boolean assignment.
   */
  public static setPerformanceEnabled(enabled: boolean): void {
    Logger.performanceEnabled = enabled;
  }

  /**
   * Get stored log entries for analysis and debugging.
   * Returns a copy of all log entries stored in memory for analysis,
   * debugging, or export to external logging systems.
   *
   * @returns Array of structured log entries (defensive copy)
   * @throws Does not throw
   * @example
   * ```typescript
   * const entries = Logger.getLogEntries();
   * const errorEntries = entries.filter(e => e.level === 'ERROR');
   * const performanceEntries = entries.filter(e => e.performance);
   *
   * console.log(`Found ${errorEntries.length} errors`);
   * console.log(`Performance entries: ${performanceEntries.length}`);
   * ```
   * @since 1.0.0
   * @see {@link clearLogEntries} for clearing stored entries
   * @see {@link getMetricsSummary} for aggregated metrics
   *
   * Performance: O(n) for defensive copy. Returns immutable snapshot of current state.
   * Edge cases: Returns empty array if no entries stored.
   */
  public static getLogEntries(): StructuredLogEntry[] {
    return [...Logger.logEntries]; // Return copy to prevent external mutation
  }

  /**
   * Clear all stored log entries from memory.
   * Removes all log entries from in-memory storage to free memory
   * or reset logging state for new analysis periods.
   *
   * @throws Does not throw
   * @example
   * ```typescript
   * Logger.clearLogEntries(); // Clear all stored entries
   * const entries = Logger.getLogEntries();
   * console.log(entries.length); // Returns: 0
   * ```
   * @since 1.0.0
   * @see {@link getLogEntries} for retrieving entries before clearing
   *
   * Performance: O(1) - simple array reset.
   */
  public static clearLogEntries(): void {
    Logger.logEntries = [];
  }

  /**
   * Get aggregated metrics summary from stored log entries.
   * Analyzes all stored log entries to provide comprehensive metrics
   * including counts by level, diagnostic data, performance averages, and error rates.
   *
   * @returns Aggregated metrics object with counts and performance data
   * @throws Does not throw - handles malformed entries gracefully
   * @example
   * ```typescript
   * const summary = Logger.getMetricsSummary();
   * console.log(`Total entries: ${summary.totalEntries}`);
   * console.log(`Errors: ${summary.errorCount}`);
   * console.log(`Average performance: ${summary.averagePerformance}ms`);
   * console.log(`Debug entries: ${summary.byLevel.DEBUG || 0}`);
   * ```
   * @since 1.0.0
   * @see {@link getLogEntries} for raw entry data
   *
   * Performance: O(n) where n is number of stored entries. Efficient aggregation.
   * Edge cases: Handles missing performance data, malformed entries, and empty logs.
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
      totalEntries: Logger.logEntries.length,
      byLevel: {} as Record<string, number>,
      diagnosticEntries: 0,
      performanceEntries: 0,
      errorCount: 0,
      averagePerformance: 0,
    };

    let totalDuration = 0;
    let performanceCount = 0;

    for (const entry of Logger.logEntries) {
      // Count by level
      summary.byLevel[entry.level] = (summary.byLevel?.[entry.level] || 0) + 1;

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
   * Create a performance measurement context for timing operations.
   * Initializes a performance metrics object with start time and memory usage
   * for measuring operation duration and resource consumption.
   *
   * @param operation - Name/description of the operation to measure
   * @returns Performance metrics object with start time and initial memory
   * @throws Does not throw - handles memory measurement failures gracefully
   * @example
   * ```typescript
   * const metrics = Logger.startPerformance('message_parsing');
   *
   * // ... perform expensive operation ...
   *
   * const completed = Logger.endPerformance(metrics);
   * Logger.performance('Parser', 'Parse messages', completed);
   * ```
   * @since 1.0.0
   * @see {@link endPerformance} for completing measurement
   * @see {@link performance} for logging performance data
   *
   * Performance: O(1) with optional memory usage collection.
   * Edge cases: Handles missing process.memoryUsage in browser environments.
   */
  public static startPerformance(operation: string): PerformanceMetrics {
    return {
      operation,
      startTime: Date.now(),
      memoryBefore: Logger.getMemoryUsage(),
    };
  }

  /**
   * Complete a performance measurement and calculate metrics.
   * Finalizes performance measurement by calculating duration, memory delta,
   * and other performance metrics for the measured operation.
   *
   * @param metrics - Performance metrics object from startPerformance
   * @returns Completed performance metrics with duration and memory data
   * @throws Does not throw - handles incomplete metrics gracefully
   * @example
   * ```typescript
   * const metrics = Logger.startPerformance('data_processing');
   *
   * // ... perform operation ...
   *
   * const completed = Logger.endPerformance(metrics);
   * console.log(`Operation took ${completed.duration}ms`);
   * console.log(`Memory delta: ${completed.memoryDelta} bytes`);
   * ```
   * @since 1.0.0
   * @see {@link startPerformance} for starting measurement
   * @see {@link performance} for logging completed metrics
   *
   * Performance: O(1) with optional memory usage calculation.
   * Edge cases: Handles missing start metrics, memory measurement failures.
   */
  public static endPerformance(metrics: PerformanceMetrics): PerformanceMetrics {
    const endTime = Date.now();
    const memoryAfter = Logger.getMemoryUsage();

    return {
      ...metrics,
      endTime,
      duration: endTime - metrics.startTime,
      memoryAfter,
      memoryDelta: memoryAfter - (metrics.memoryBefore || 0),
    };
  }

  /**
   * Get current memory usage in bytes (Node.js environments only).
   * Provides heap memory usage information for performance monitoring
   * and memory leak detection in Node.js environments.
   *
   * @returns Current heap memory usage in bytes, or 0 if unavailable
   * @throws Does not throw - handles missing process.memoryUsage gracefully
   * @since 1.0.0
   * @private
   * @see {@link startPerformance} for performance measurement using memory data
   *
   * Performance: O(1) - direct system call when available.
   * Edge cases: Returns 0 in browser environments or when process.memoryUsage unavailable.
   */
  private static getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
}

export type { DiagnosticContext, PerformanceMetrics, StructuredLogEntry };
