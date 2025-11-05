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
 * Simple logger utility for the Slack Formatter plugin.
 * Provides basic logging with debug mode support.
 *
 * @class Logger
 * @since 1.0.0
 */
export class Logger {
  private static logger = console;
  private static prefix = '[SlackFormat]';
  private static debugEnabled = false;

  /**
   * Log a message with specified level and optional structured data.
   */
  public static log(
    level: 'debug' | 'info' | 'warn' | 'error',
    className: string,
    message: string,
    data?: LoggableData
  ): void {
    // Skip debug messages when debug is disabled
    if (level === 'debug' && !Logger.debugEnabled) return;

    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase();
    let consoleMessage = `${Logger.prefix} ${timestamp} [${levelStr}] [${className}] ${message}`;

    if (data !== undefined) {
      try {
        const logData = JSON.stringify(data);
        consoleMessage += ` | Data: ${logData}`;
      } catch (e) {
        consoleMessage += ` | Data: [Serialization Error]`;
      }
    }

    Logger.logger?.[level]?.(consoleMessage);
  }

  /**
   * Log a debug message (only when debug mode is enabled)
   */
  public static debug(className: string, message: string, data?: LoggableData): void {
    Logger.log('debug', className, message, data);
  }

  /**
   * Log an informational message
   */
  public static info(className: string, message: string, data?: LoggableData): void {
    Logger.log('info', className, message, data);
  }

  /**
   * Log a warning message
   */
  public static warn(className: string, message: string, data?: LoggableData): void {
    Logger.log('warn', className, message, data);
  }

  /**
   * Log an error message
   */
  public static error(className: string, message: string, data?: LoggableData): void {
    Logger.log('error', className, message, data);
  }

  /**
   * Check if debug logging is currently enabled
   */
  public static isDebugEnabled(): boolean {
    return Logger.debugEnabled;
  }

  /**
   * Set debug logging state
   */
  public static setDebugEnabled(enabled: boolean): void {
    Logger.debugEnabled = enabled;
  }
}

export type { LoggableData };
