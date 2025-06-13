import { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import the new Logger

// T: Input type, U: Output content type (defaults to string)
export abstract class BaseProcessor<T, U = string> {
  // Removed protected logger property

  abstract process(input: T): ProcessorResult<U>;

  /**
   * Logs a message using the shared Logger utility.
   * @param level Log level
   * @param message Message to log
   * @param data Optional data
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    // Use the static Logger methods, passing the constructor name for context
    Logger[level](this.constructor.name, message, data);
  }
}