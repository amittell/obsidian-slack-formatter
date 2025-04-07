import { 
  parseDate, 
  formatDateWithZone, 
  parseSlackTimestamp 
} from '../../src/utils/datetime-utils';
import { Logger } from '../../src/utils/logger';

// Mock the Logger
jest.mock('../../src/utils/logger');

describe('Datetime Utils', () => {

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('parseDate', () => {
    it('should parse valid date strings (YYYY-MM-DD)', () => {
      const date = parseDate('2024-03-15');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(2); // Month is 0-indexed
      expect(date?.getDate()).toBe(15);
      expect(date?.getHours()).toBe(0); // Should be normalized
    });

    it('should parse valid date strings (Month Day, Year)', () => {
      const date = parseDate('March 15, 2024');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(2);
      expect(date?.getDate()).toBe(15);
    });

    it('should handle ordinal suffixes (st, nd, rd, th)', () => {
      expect(parseDate('March 1st, 2024')?.getDate()).toBe(1);
      expect(parseDate('March 2nd, 2024')?.getDate()).toBe(2);
      expect(parseDate('March 3rd, 2024')?.getDate()).toBe(3);
      expect(parseDate('March 4th, 2024')?.getDate()).toBe(4);
      expect(parseDate('March 21st, 2024')?.getDate()).toBe(21);
    });
    
    it('should parse date strings without year (assuming current year)', () => {
      const currentYear = new Date().getFullYear();
      const date = parseDate('March 15');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(currentYear);
      expect(date?.getMonth()).toBe(2);
      expect(date?.getDate()).toBe(15);
    });

    it('should return null for invalid date strings', () => {
      expect(parseDate('Invalid Date String')).toBeNull();
      expect(parseDate('2024-13-01')).toBeNull(); // Invalid month
      expect(parseDate('February 30, 2024')).toBeNull(); // Invalid day
    });

    it('should return null for empty or null input', () => {
      expect(parseDate('')).toBeNull();
      expect(parseDate(null as any)).toBeNull();
    });
    
    it('should normalize time to 00:00:00.000', () => {
      // new Date() might include time, parseDate should reset it
      const date = parseDate('2024-03-15'); 
      expect(date?.getHours()).toBe(0);
      expect(date?.getMinutes()).toBe(0);
      expect(date?.getSeconds()).toBe(0);
      expect(date?.getMilliseconds()).toBe(0);
    });
  });

  describe('formatDateWithZone', () => {
    // Note: Exact output depends on the node version/ICU data. Using regex to be more flexible.
    // Assuming en-US locale for consistency.
    const testDate = new Date(2024, 2, 15, 14, 30, 0); // March 15, 2024 2:30 PM local

    it('should format date with local timezone if zone is omitted', () => {
      // This test is environment-dependent, just check format roughly
      const formatted = formatDateWithZone(testDate);
      // Expect only time format HH:MM AM/PM
      expect(formatted).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    it('should format date with specified valid IANA timezone (e.g., UTC)', () => {
      const formatted = formatDateWithZone(testDate, 'UTC');
      // Check if it contains UTC indicators or expected UTC time (might vary slightly)
      // Example: 2024-03-15T14:30:00 local might be 2024-03-15T18:30:00 UTC if local is EST (UTC-4)
      // Let's check for the time format only
       expect(formatted).toMatch(/\d{1,2}:30 (AM|PM)/);
       // We can't easily assert the exact hour without knowing the test runner's TZ offset from UTC
    });
    
    it('should format date with specified valid IANA timezone (e.g., New York)', () => {
      const formatted = formatDateWithZone(testDate, 'America/New_York');
       // Expect only time format HH:MM AM/PM
       expect(formatted).toMatch(/\d{1,2}:30 (AM|PM)/);
    });

    it('should fall back to local timezone and log warning for invalid timezone', () => {
      const formatted = formatDateWithZone(testDate, 'Invalid/Timezone');
      const localFormatted = formatDateWithZone(testDate); // Get expected local format
      expect(formatted).toBe(localFormatted); // Should match local format
      expect(Logger.warn).toHaveBeenCalledTimes(1);
      expect(Logger.warn).toHaveBeenCalledWith(
        'datetime-utils',
        expect.stringContaining('Invalid timeZone provided: "Invalid/Timezone"'),
        expect.any(Error) // Check that an error object was logged
      );
    });
    
    it('should handle date object correctly', () => {
       const date = new Date(2023, 11, 25, 9, 5, 0); // Dec 25, 2023 09:05 AM local
       const formatted = formatDateWithZone(date, 'UTC');
       // Expect only time format HH:MM AM/PM (The exact hour depends on the local offset from UTC)
       expect(formatted).toMatch(/\d{1,2}:05 (AM|PM)/);
    });
  });

  describe('parseSlackTimestamp', () => {
    // Use a fixed date for context to make tests deterministic
    // March 15, 2024 (Friday)
    const contextDate = new Date(2024, 2, 15, 10, 0, 0); 
    const contextDateStartOfDay = new Date(2024, 2, 15, 0, 0, 0); 
    const yesterdayStartOfDay = new Date(2024, 2, 14, 0, 0, 0); 

    it('should parse time-only string using context date', () => {
      const result = parseSlackTimestamp("2:30 PM", contextDate);
      expect(result).toEqual(new Date(2024, 2, 15, 14, 30, 0));
    });
    
    it('should parse time-only string using current date if context is null', () => {
      const now = new Date();
      const expectedDate = new Date(now);
      expectedDate.setHours(14, 30, 0, 0); // 2:30 PM on today's date
      
      const result = parseSlackTimestamp("2:30 PM", null);
      expect(result).toEqual(expectedDate);
    });

    it('should parse "Today at HH:MM AM/PM"', () => {
      const result = parseSlackTimestamp("Today at 9:15 AM", contextDate);
      expect(result).toEqual(new Date(2024, 2, 15, 9, 15, 0));
    });

    it('should parse "Yesterday at HH:MM AM/PM"', () => {
      const result = parseSlackTimestamp("Yesterday at 11:55 PM", contextDate);
      expect(result).toEqual(new Date(2024, 2, 14, 23, 55, 0));
    });

    it('should parse "Month Day(th) at HH:MM AM/PM" (inferring year)', () => {
      const result = parseSlackTimestamp("Feb 6th at 7:47 PM", contextDate); // Assumes 2024
      expect(result).toEqual(new Date(2024, 1, 6, 19, 47, 0));
    });
    
     it('should parse "Month Day at HH:MM AM/PM" (inferring year)', () => {
      const result = parseSlackTimestamp("Mar 1 at 1:00 AM", contextDate); // Assumes 2024
      expect(result).toEqual(new Date(2024, 2, 1, 1, 0, 0));
    });

    it('should parse "Month Day, YYYY at HH:MM AM/PM"', () => {
      const result = parseSlackTimestamp("March 10, 2023 at 10:00 AM", contextDate); // Explicit year
      expect(result).toEqual(new Date(2023, 2, 10, 10, 0, 0));
    });
    
    it('should handle midnight correctly (12:xx AM)', () => {
       const result = parseSlackTimestamp("12:05 AM", contextDate);
       expect(result).toEqual(new Date(2024, 2, 15, 0, 5, 0));
    });
    
    it('should handle noon correctly (12:xx PM)', () => {
       const result = parseSlackTimestamp("12:50 PM", contextDate);
       expect(result).toEqual(new Date(2024, 2, 15, 12, 50, 0));
    });

    it('should return null for invalid timestamp format', () => {
      expect(parseSlackTimestamp("Invalid time", contextDate)).toBeNull();
      expect(parseSlackTimestamp("Today at invalid", contextDate)).toBeNull();
      expect(parseSlackTimestamp("Feb 30th at 1:00 PM", contextDate)).toBeNull(); // Invalid date part
      expect(parseSlackTimestamp("14:70 PM", contextDate)).toBeNull(); // Invalid time part
    });

    it('should return null for empty or null input', () => {
      expect(parseSlackTimestamp("", contextDate)).toBeNull();
      expect(parseSlackTimestamp(null as any, contextDate)).toBeNull();
    });
    
    it('should log error on exception', () => {
       // Force an error by providing bad context (though function should handle null)
       jest.spyOn(Date.prototype, 'getFullYear').mockImplementationOnce(() => { throw new Error('Test Error'); });
       expect(parseSlackTimestamp("Feb 6th at 7:47 PM", contextDate)).toBeNull();
       expect(Logger.error).toHaveBeenCalledWith(
         'datetime-utils',
         'Error parsing Slack timestamp string',
         expect.objectContaining({ timestamp: "Feb 6th at 7:47 PM" })
       );
       jest.restoreAllMocks(); // Clean up spy
    });
  });
});