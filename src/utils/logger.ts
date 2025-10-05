type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Minimal logger used across the plugin. It keeps the existing logging calls but
 * intentionally avoids any metrics collection or complex diagnostics.
 */
export class Logger {
  private static readonly prefix = '[SlackFormatter]';
  private static debugEnabled = false;

  private static log(level: LogLevel, className: string, message: string, data?: unknown): void {
    if (level === 'debug' && !Logger.debugEnabled) {
      return;
    }

    const logger = (console[level] ?? console.log).bind(console);
    const formatted = `${Logger.prefix} [${className}] ${message}`;

    if (data === undefined) {
      logger(formatted);
    } else {
      logger(formatted, data);
    }
  }

  static debug(className: string, message: string, data?: unknown): void {
    Logger.log('debug', className, message, data);
  }

  static info(className: string, message: string, data?: unknown): void {
    Logger.log('info', className, message, data);
  }

  static warn(className: string, message: string, data?: unknown): void {
    Logger.log('warn', className, message, data);
  }

  static error(className: string, message: string, error?: unknown): void {
    Logger.log('error', className, message, error);
  }

  static setDebugEnabled(enabled: boolean): void {
    Logger.debugEnabled = enabled;
  }

  static isDebugEnabled(): boolean {
    return Logger.debugEnabled;
  }
}
