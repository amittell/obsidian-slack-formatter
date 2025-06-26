import { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import the new Logger

/**
 * Abstract base class for all content processors in the Slack formatting pipeline.
 * Provides common functionality including input validation, error handling, and logging
 * while establishing a consistent interface for all transformation operations.
 * 
 * ## Design Pattern
 * This class implements the Template Method pattern, where subclasses implement the
 * specific `process` method while inheriting common validation and utility methods.
 * 
 * ## Generic Type Parameters
 * - `T`: Input type for the processor (string, array, object, etc.)
 * - `U`: Output content type (defaults to string for most text processors)
 * 
 * ## Common Functionality
 * - **Input Validation** - Consistent validation for string and array inputs
 * - **Error Handling** - Standardized error logging and recovery
 * - **Logging Interface** - Unified logging using class name as context
 * - **Type Safety** - Generic type support for different processor types
 * 
 * @template T The input type that this processor accepts
 * @template U The output content type (defaults to string)
 * @abstract Must be extended by concrete processor implementations
 * @since 1.0.0
 * @example
 * ```typescript
 * // String-to-string processor
 * class MyTextProcessor extends BaseProcessor<string> {
 *   process(input: string): ProcessorResult<string> {
 *     const validation = this.validateStringInput(input);
 *     if (validation) return validation;
 *     
 *     const processed = input.toUpperCase();
 *     return { content: processed, modified: processed !== input };
 *   }
 * }
 * 
 * // Array-to-string processor
 * class ArrayJoinProcessor extends BaseProcessor<string[], string> {
 *   process(input: string[]): ProcessorResult<string> {
 *     const validInput = this.validateArrayInput(input);
 *     if (validInput.length === 0) {
 *       return { content: '', modified: false };
 *     }
 *     
 *     const joined = validInput.join(' ');
 *     return { content: joined, modified: true };
 *   }
 * }
 * 
 * // Usage
 * const textProcessor = new MyTextProcessor();
 * const result = textProcessor.process("hello world");
 * console.log(result.content); // "HELLO WORLD"
 * ```
 * @see {@link ProcessorResult} - Return type interface for all processors
 * @see {@link Logger} - Logging utility used by processors
 */
// T: Input type, U: Output content type (defaults to string)
export abstract class BaseProcessor<T, U = string> {
  // Removed protected logger property

  /**
   * Abstract method that must be implemented by all concrete processor classes.
   * Defines the core transformation logic for converting input to processed output.
   * 
   * ## Implementation Requirements
   * - Must handle all expected input types gracefully
   * - Should use validation methods for input checking
   * - Must return ProcessorResult with content and modification status
   * - Should use logging methods for error reporting and debugging
   * 
   * @param {T} input - The input data to be processed by this processor
   * @returns {ProcessorResult<U>} Result containing processed content and modification flag
   * @abstract Must be implemented by concrete processor classes
   * @since 1.0.0
   */
  abstract process(input: T): ProcessorResult<U>;

  /**
   * Validates string input for processor operations with comprehensive error handling.
   * Provides consistent input validation across all string-based processors with
   * automatic type coercion and detailed logging for invalid inputs.
   * 
   * ## Validation Rules
   * - Rejects null/undefined inputs (returns empty string result)
   * - Converts non-string inputs to strings automatically
   * - Optionally rejects empty strings based on allowEmpty parameter
   * - Logs warnings for type mismatches and validation failures
   * 
   * ## Type Safety Note
   * This method uses type casting (as U) which is safe because:
   * 1. It's a protected method only used by subclasses
   * 2. Subclasses that use non-string types for U should not call this method
   * 3. The method name clearly indicates it's for string validation
   * 4. Runtime validation ensures string output regardless of generic type
   * 
   * @param {any} input - Input value to validate (expected to be string)
   * @param {boolean} [allowEmpty=true] - Whether to allow empty strings as valid input
   * @returns {ProcessorResult<U> | null} ProcessorResult with fallback content if invalid, null if input is valid
   * @protected For use by concrete processor implementations only
   * @since 1.0.0
   * @example
   * ```typescript
   * class MyProcessor extends BaseProcessor<string> {
   *   process(input: string): ProcessorResult<string> {
   *     // Validate input first
   *     const validation = this.validateStringInput(input, false); // Don't allow empty
   *     if (validation) {
   *       return validation; // Return early with validation result
   *     }
   *     
   *     // Process valid input
   *     const processed = input.toUpperCase();
   *     return { content: processed, modified: processed !== input };
   *   }
   * }
   * ```
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
   * Validates array input for processor operations with comprehensive error handling.
   * Provides consistent input validation for array-based processors with automatic
   * fallback to empty arrays and detailed logging for invalid inputs.
   * 
   * ## Validation Rules
   * - Rejects null/undefined inputs (returns empty array)
   * - Rejects non-array inputs (returns empty array)
   * - Optionally validates against empty arrays based on allowEmpty parameter
   * - Logs warnings for type mismatches and validation failures
   * 
   * @template T The expected element type of the array
   * @param {any} input - Input value to validate (expected to be array)
   * @param {boolean} [allowEmpty=true] - Whether to allow empty arrays as valid input
   * @returns {T[]} Valid array or empty array if input is invalid
   * @protected For use by concrete processor implementations only
   * @since 1.0.0
   * @example
   * ```typescript
   * class ArrayProcessor extends BaseProcessor<string[]> {
   *   process(input: string[]): ProcessorResult<string> {
   *     // Validate array input
   *     const validArray = this.validateArrayInput<string>(input, false); // Don't allow empty
   *     if (validArray.length === 0) {
   *       return { content: '', modified: false };
   *     }
   *     
   *     // Process valid array
   *     const joined = validArray.join(', ');
   *     return { content: joined, modified: true };
   *   }
   * }
   * ```
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
   * Logs a message using the shared Logger utility with automatic context identification.
   * Provides a consistent logging interface for all processors with the processor class
   * name automatically included as context for easier debugging and monitoring.
   * 
   * ## Logging Features
   * - Automatic context identification using class constructor name
   * - Support for all standard log levels (debug, info, warn, error)
   * - Optional structured data for detailed debugging
   * - Consistent formatting across all processors
   * 
   * @param {('debug'|'info'|'warn'|'error')} level - Log level indicating severity and importance
   * @param {string} message - Primary log message describing the event or condition
   * @param {any} [data] - Optional structured data for additional context (objects, arrays, etc.)
   * @protected For use by concrete processor implementations only
   * @since 1.0.0
   * @example
   * ```typescript
   * class MyProcessor extends BaseProcessor<string> {
   *   process(input: string): ProcessorResult<string> {
   *     this.log('debug', 'Starting processing', { inputLength: input.length });
   *     
   *     try {
   *       const result = this.doComplexOperation(input);
   *       this.log('info', 'Processing completed successfully');
   *       return { content: result, modified: true };
   *     } catch (error) {
   *       this.log('error', 'Processing failed', { error, input });
   *       return { content: input, modified: false };
   *     }
   *   }
   * }
   * ```
   * @see {@link Logger} - Underlying logging utility
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    // Use the static Logger methods, passing the constructor name for context
    Logger[level](this.constructor.name, message, data);
  }
}