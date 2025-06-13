/**
 * Simple shared logger utility
 */
export class Logger {
    // Basic console logger, could be replaced with a more robust library if needed.
    private static logger = console; 
    private static prefix = "[SlackFormat]"; // Centralized prefix

    /**
     * Logs a message with a specified level and optional data.
     * @param level Log level ('debug', 'info', 'warn', 'error')
     * @param className Name of the calling class/module for context
     * @param message The message to log
     * @param data Optional additional data (will be stringified)
     */
    public static log(
        level: 'debug' | 'info' | 'warn' | 'error', 
        className: string, 
        message: string, 
        data?: any
    ): void {
        // Basic level filtering (e.g., only show debug if a global debug flag is set)
        // For now, we log everything, but this is where filtering could go.
        // if (level === 'debug' && !globalDebugFlag) return; 

        const logData = data ? JSON.stringify(data) : '';
        const timestamp = new Date().toISOString(); // Add timestamp for better context

        this.logger[level](`${this.prefix} ${timestamp} [${level.toUpperCase()}] [${className}] ${message}${logData ? ` | Data: ${logData}` : ''}`);
    }

    // Convenience methods for each level
    /**
     * Logs a debug message only if isDebugEnabled is true.
     * @param className Name of the calling class/module.
     * @param message The message to log.
     * @param data Optional additional data.
     * @param isDebugEnabled Flag indicating if debug logging is currently enabled.
     */
    public static debug(className: string, message: string, data?: any, isDebugEnabled?: boolean): void {
        if (!isDebugEnabled) {
            return; // Don't log if debug is not enabled
        }
        this.log('debug', className, message, data);
    }
    public static info(className: string, message: string, data?: any): void {
        this.log('info', className, message, data);
    }
    public static warn(className: string, message: string, data?: any): void {
        this.log('warn', className, message, data);
    }
    public static error(className: string, message: string, data?: any): void {
        this.log('error', className, message, data);
    }
}