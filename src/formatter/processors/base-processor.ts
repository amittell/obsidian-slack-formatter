import { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import the new Logger

// T: Input type, U: Output content type (defaults to string)
export abstract class BaseProcessor<T, U = string> {
  // Removed protected logger property

  abstract process(input: T): ProcessorResult<U>;

  /**
   * Validates string input for processor operations.
   * Provides consistent input validation across all processors.
   * 
   * Note: This method uses type casting (as U) which is safe because:
   * 1. It's a protected method only used by subclasses
   * 2. Subclasses that use non-string types for U should not call this method
   * 3. The method name clearly indicates it's for string validation
   * 
   * @param input Input to validate
   * @param allowEmpty Whether to allow empty strings (default: true)
   * @returns ProcessorResult with error if invalid, null if valid
   */
  protected validateStringInput(input: any, allowEmpty = true): ProcessorResult<U> | null {
    // Check for null/undefined
    if (input === null || input === undefined) {
      this.log('warn', 'Input is null or undefined', { input });
      return { content: '' as U, modified: false };
    }

    // Check if input is a string
    if (typeof input !== 'string') {
      this.log('warn', 'Input is not a string', { 
        actualType: typeof input 
      });
      return { content: String(input) as U, modified: false };
    }

    // Check for empty string if not allowed
    if (!allowEmpty && input.length === 0) {
      this.log('debug', 'Empty input provided when not allowed');
      return { content: input as U, modified: false };
    }

    // Input is valid
    return null;
  }

  /**
   * Validates array input for processor operations.
   * Provides consistent input validation for array-based processors.
   * @param input Input to validate
   * @param allowEmpty Whether to allow empty arrays (default: true)
   * @returns Valid array or empty array if invalid
   */
  protected validateArrayInput<T>(input: any, allowEmpty = true): T[] {
    // Check for null/undefined
    if (input === null || input === undefined) {
      this.log('warn', 'Input array is null or undefined', { input });
      return [];
    }

    // Check if input is an array
    if (!Array.isArray(input)) {
      this.log('warn', 'Input is not an array', { 
        actualType: typeof input 
      });
      return [];
    }

    // Check for empty array if not allowed
    if (!allowEmpty && input.length === 0) {
      this.log('debug', 'Empty array provided when not allowed');
      return input;
    }

    // Input is valid
    return input;
  }

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