/**
 * JSON parsing and validation utilities
 */
import { Logger } from './logger'; // Import the Logger

/**
 * Safely parses a JSON string into a Record<string, string>.
 * Returns an empty object for null or empty string input.
 * Returns null if parsing fails or the result is not a valid object.
 * Logs errors during parsing.
 *
 * @param jsonStr The JSON string to parse.
 * @param context A string describing the context (e.g., "User Map", "Emoji Map") for logging.
 * @returns The parsed object, an empty object for empty input, or null on error/invalid type.
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
 * Validates if a string is valid JSON.
 * Allows empty or whitespace-only strings (which parseJsonMap treats as empty objects).
 *
 * @param str The string to validate.
 * @returns True if the string is valid JSON or empty/whitespace, false otherwise.
 */
export function isValidJson(str: string): boolean {
    if (!str || str.trim() === '') {
        return true; // Allow empty string -> results in {}
    }
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}