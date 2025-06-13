import { parseJsonMap, isValidJson } from '../../src/utils/json-utils';
// Mock the Logger to prevent console output during tests and allow assertions
import { Logger } from '../../src/utils/logger';

jest.mock('../../src/utils/logger'); // Mock the entire Logger class

describe('JSON Utils', () => {

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('isValidJson', () => {
    it('should return true for valid JSON objects', () => {
      expect(isValidJson('{"key": "value"}')).toBe(true);
      expect(isValidJson('{}')).toBe(true);
      expect(isValidJson('{"a": 1, "b": null, "c": true}')).toBe(true);
    });

    it('should return true for valid JSON arrays', () => {
      expect(isValidJson('[1, 2, 3]')).toBe(true);
      expect(isValidJson('[]')).toBe(true);
      expect(isValidJson('[{"a": 1}]')).toBe(true);
    });

    it('should return true for valid JSON primitives (string, number, boolean, null)', () => {
      expect(isValidJson('"string"')).toBe(true);
      expect(isValidJson('123')).toBe(true);
      expect(isValidJson('true')).toBe(true);
      expect(isValidJson('null')).toBe(true);
    });

    it('should return true for empty or whitespace-only strings', () => {
      expect(isValidJson('')).toBe(true);
      expect(isValidJson('   ')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      expect(isValidJson('{key: "value"}')).toBe(false); // Missing quotes around key
      expect(isValidJson('{"key": "value",}')).toBe(false); // Trailing comma
      expect(isValidJson('invalid')).toBe(false);
      expect(isValidJson('{')).toBe(false);
      expect(isValidJson('undefined')).toBe(false); // undefined is not valid JSON
    });
  });

  describe('parseJsonMap', () => {
    it('should parse valid JSON map string', () => {
      const jsonStr = '{"U123": "Alice", "U456": "Bob"}';
      const expected = { U123: 'Alice', U456: 'Bob' };
      expect(parseJsonMap(jsonStr, 'TestMap')).toEqual(expected);
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should return empty object for empty string', () => {
      expect(parseJsonMap('', 'TestMap')).toEqual({});
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should return empty object for whitespace-only string', () => {
      expect(parseJsonMap('   ', 'TestMap')).toEqual({});
      expect(Logger.error).not.toHaveBeenCalled();
    });
    
    it('should return empty object for null input', () => {
      // Need to cast null to string type to satisfy function signature for test
      expect(parseJsonMap(null as unknown as string, 'TestMap')).toEqual({});
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should return null and log error for invalid JSON string', () => {
      const jsonStr = '{"U123": "Alice",}'; // Invalid trailing comma
      expect(parseJsonMap(jsonStr, 'TestMap')).toBeNull();
      expect(Logger.error).toHaveBeenCalledTimes(1);
      expect(Logger.error).toHaveBeenCalledWith(
        'json-utils',
        'Failed to parse TestMap',
        expect.objectContaining({ input: jsonStr }) // Check if error includes input
      );
    });

    it('should return null and log warning for valid JSON that is not an object', () => {
      const jsonStr = '[1, 2, 3]'; // Valid JSON, but not an object map
      expect(parseJsonMap(jsonStr, 'TestMap')).toBeNull();
      expect(Logger.warn).toHaveBeenCalledTimes(1);
      expect(Logger.warn).toHaveBeenCalledWith(
        'json-utils',
        'Parsed JSON for TestMap is not a valid object',
        { input: jsonStr }
      );
      expect(Logger.error).not.toHaveBeenCalled();
    });
    
    it('should return null and log warning for JSON null value', () => {
      const jsonStr = 'null'; 
      expect(parseJsonMap(jsonStr, 'TestMap')).toBeNull();
      expect(Logger.warn).toHaveBeenCalledTimes(1);
      expect(Logger.warn).toHaveBeenCalledWith(
        'json-utils',
        'Parsed JSON for TestMap is not a valid object',
        { input: jsonStr }
      );
      expect(Logger.error).not.toHaveBeenCalled();
    });

    it('should return null and log warning for JSON with non-string values', () => {
      // The function now correctly enforces Record<string, string> and returns null for other value types.
      const jsonStr = '{"U123": 123, "U456": true}';
      expect(parseJsonMap(jsonStr, 'TestMap')).toBeNull();
      // It should warn for the first invalid value encountered (U123: 123)
      expect(Logger.warn).toHaveBeenCalledTimes(1);
      expect(Logger.warn).toHaveBeenCalledWith(
        'json-utils',
        'Invalid value type for key "U123" in TestMap. Expected string.',
        { input: jsonStr }
      );
      expect(Logger.error).not.toHaveBeenCalled();
    });
  });
});