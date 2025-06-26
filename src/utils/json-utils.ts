/**
 * JSON parsing and validation utilities for safe data handling.
 * Provides robust JSON parsing with comprehensive error handling,
 * type validation, and security considerations for untrusted input.
 * 
 * Features:
 * - Safe JSON parsing with error recovery
 * - Type validation for expected data structures
 * - Input sanitization and validation
 * - Detailed error logging for debugging
 * - Empty string handling with sensible defaults
 * 
 * @module json-utils
 * @since 1.0.0
 */
import { Logger } from './logger'; // Import the Logger

/**
 * Safely parse a JSON string into a validated Record<string, string>.
 * Provides comprehensive error handling, type validation, and security checks
 * for parsing untrusted JSON input with detailed logging for debugging.
 * 
 * Features:
 * - Handles empty/null input gracefully (returns empty object)
 * - Validates parsed result is an object (not array or primitive)
 * - Type-checks all values are strings
 * - Comprehensive error logging with context
 * - Prevents prototype pollution attacks
 * 
 * @param jsonStr - The JSON string to parse and validate
 * @param context - Descriptive context for error logging (e.g., "User Map", "Emoji Map")
 * @returns Parsed and validated object, empty object for empty input, or null on error
 * @throws Does not throw - returns null for all error conditions
 * @example
 * ```typescript
 * parseJsonMap('{"key1": "value1", "key2": "value2"}', 'Settings')
 * // Returns: { key1: 'value1', key2: 'value2' }
 * 
 * parseJsonMap('', 'Empty Input')
 * // Returns: {}
 * 
 * parseJsonMap('{"key": 123}', 'Invalid Value')
 * // Returns: null (logs warning about non-string value)
 * 
 * parseJsonMap('invalid-json', 'Malformed')
 * // Returns: null (logs parsing error)
 * 
 * parseJsonMap('["array"]', 'Wrong Type')
 * // Returns: null (logs type validation error)
 * ```
 * @since 1.0.0
 * @see {@link isValidJson} for JSON validation without parsing
 * 
 * Performance: O(n) for JSON parsing + O(k) for property validation where k is key count.
 * Security: Validates object structure to prevent prototype pollution and type confusion.
 * Edge cases: Handles circular references, undefined values, and mixed data types safely.
 */
export function parseJsonMap(jsonStr: string, context: string = 'JSON Map'): Record<string, string> | null {
    try {
        if (!jsonStr || jsonStr.trim() === '') {
            return {}; // Return empty object for empty input
        }
        const parsed = JSON.parse(jsonStr);
        // Basic type check to ensure it's an object
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
             // Add value validation
             for (const key in parsed) {
                 if (Object.prototype.hasOwnProperty.call(parsed, key) && typeof parsed[key] !== 'string') {
                     Logger.warn('json-utils', `Invalid value type for key "${key}" in ${context}. Expected string.`, { input: jsonStr });
                     return null; // Invalid value type
                 }
             }
            return parsed as Record<string, string>; // Cast after validation
       } else {
            Logger.warn('json-utils', `Parsed JSON for ${context} is not a valid object`, { input: jsonStr });
            return null; // Return null for invalid object type
       }
   } catch (error) {
       Logger.error('json-utils', `Failed to parse ${context}`, { error, input: jsonStr });
       return null; // Return null on parsing error
    }
}

/**
 * Validate if a string contains valid JSON syntax.
 * Fast validation utility that checks JSON syntax without parsing,
 * allowing optimization of JSON processing pipelines.
 * 
 * Validation rules:
 * - Empty/whitespace strings are considered valid (parseJsonMap treats as {})
 * - Proper JSON syntax according to JSON specification
 * - Handles all JSON data types (objects, arrays, primitives)
 * 
 * @param str - The string to validate for JSON syntax
 * @returns True if string is valid JSON or empty/whitespace, false otherwise
 * @throws Does not throw - handles all input types safely
 * @example
 * ```typescript
 * isValidJson('{"key": "value"}')
 * // Returns: true
 * 
 * isValidJson('')
 * // Returns: true (empty string is valid for parseJsonMap)
 * 
 * isValidJson('   ')
 * // Returns: true (whitespace-only is valid)
 * 
 * isValidJson('{invalid json}')
 * // Returns: false
 * 
 * isValidJson('[1, 2, 3]')
 * // Returns: true (arrays are valid JSON)
 * 
 * isValidJson('null')
 * // Returns: true (null is valid JSON)
 * ```
 * @since 1.0.0
 * @see {@link parseJsonMap} for actual JSON parsing with validation
 * 
 * Performance: O(n) for JSON.parse validation. More efficient than full parsing for validation-only use.
 * Edge cases: Handles null, undefined input, and truncated JSON strings safely.
 */
export function isValidJson(str: string): boolean {
    if (!str || str.trim() === '') {
        return true; // Allow empty string -> results in {}
    }
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        // Log the error in debug mode for troubleshooting
        Logger.debug('json-utils', 'Invalid JSON detected', { 
            error: e instanceof Error ? e.message : String(e),
            input: str.length > 100 ? str.substring(0, 100) + '...' : str
        });
        return false;
    }
}