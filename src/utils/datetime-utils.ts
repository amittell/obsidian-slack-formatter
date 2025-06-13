/**
 * Date and time formatting utilities
 */
import { Logger } from './logger'; // Import the Logger

// Helper regex to roughly extract month and day from various formats
const MONTHS: { [key: string]: number } = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, 
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, 
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};
const MONTH_DAY_REGEX = new RegExp(`(?:(${Object.keys(MONTHS).join('|')})[\\s.]*)(\\d{1,2})(?:st|nd|rd|th)?`, 'i');

/**
 * Parse a date string in various formats more robustly.
 * Handles YYYY-MM-DD, Month Day, Year, Month Day.
 * Validates against date rollovers (e.g., Feb 30).
 * @param dateStr The date string to parse.
 * @returns A Date object set to the beginning of the day, or null if parsing fails or is invalid.
 */
export function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    const cleanedDateStr = dateStr.trim();
    let year: number | null = null;
    let monthIndex: number | null = null; // 0-indexed
    let day: number | null = null;

    // Try YYYY-MM-DD format first
    const ymdMatch = cleanedDateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
        year = parseInt(ymdMatch[1], 10);
        monthIndex = parseInt(ymdMatch[2], 10) - 1; // Adjust month to 0-index
        day = parseInt(ymdMatch[3], 10);
    } else {
        // Try Month Day, Year or Month Day formats
        const yearMatch = cleanedDateStr.match(/,\s*(\d{4})$/);
        if (yearMatch) {
            year = parseInt(yearMatch[1], 10);
        } else {
            // Assume current year if no year is specified
            year = new Date().getFullYear();
        }

        // Extract month and day
        const monthDayMatch = cleanedDateStr.match(MONTH_DAY_REGEX);
        if (monthDayMatch) {
            const monthName = monthDayMatch[1]?.toLowerCase();
            if (monthName && MONTHS.hasOwnProperty(monthName)) {
                monthIndex = MONTHS[monthName];
            }
            day = parseInt(monthDayMatch[2], 10);
        }
    }

    // Validate extracted components
    if (year === null || monthIndex === null || day === null || 
        monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
        Logger.warn('datetime-utils', 'Failed to extract valid date components', { dateStr: cleanedDateStr });
        return null;
    }

    // Construct date using components to avoid timezone parsing issues
    const date = new Date(year, monthIndex, day);
    
    // Final validation: Check for rollovers (e.g., Feb 30 becoming Mar 1/2)
    // Also checks if the constructed date is valid at all (e.g., year was NaN)
    if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
         Logger.warn('datetime-utils', 'Invalid date detected after construction (possible rollover)', { dateStr: cleanedDateStr, year, monthIndex, day });
        return null;
    }

    // Normalize time part
    date.setHours(0, 0, 0, 0); 
    return date;
}


/**
 * Format a date object into a string with timezone support using Intl API.
 * @param date The Date object to format.
 * @param timeZone Optional IANA time zone string (e.g., "America/New_York"). Falls back to local if invalid/omitted.
 * @returns Formatted date/time string (e.g., "03/25/2025, 11:37 PM").
 */
export function formatDateWithZone(date: Date, timeZone?: string): string {
    // Ensure input is a valid Date object
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        Logger.error('datetime-utils', 'Invalid Date object passed to formatDateWithZone', { date });
        return 'Invalid Date';
    }
    
    try {
        // Modify options to only include time components
        const options: Intl.DateTimeFormatOptions = {
            hour: 'numeric', // Use 'numeric' for potentially single-digit hour (e.g., 8:39 AM)
            minute: '2-digit',
            hour12: true,
        };
        // Only include timeZone if it's a non-empty string and valid
        if (timeZone) {
            try {
                // Test validity by creating a formatter
                new Intl.DateTimeFormat('en-US', { timeZone }).format(date);
                options.timeZone = timeZone; // Add valid timezone to options
            } catch (tzError) {
                Logger.warn('datetime-utils', `Invalid timeZone provided: "${timeZone}". Falling back to local time.`, tzError);
                // Do not add invalid timezone to options
            }
        }
        return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (error) {
        Logger.error('datetime-utils', 'Error formatting date', { error, date: date.toISOString(), timeZone });
        // Fallback to basic locale string
        return date.toLocaleString();
    }
}

// --- Refactored Slack Timestamp Parsing ---

/**
 * Parses the time part (HH:MM AM/PM) from a string.
 * @param timeStr String potentially containing the time.
 * @returns Object with hours (0-23) and minutes, or null if parsing fails.
 * @private
 */
function _parseTimePart(timeStr: string): { hours: number; minutes: number } | null {
    // Regex: Matches H:MM, HH:MM, H:MM:SS, HH:MM:SS with optional space and AM/PM. Anchored to start/end.
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)$/i); // Requires AM/PM
    if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3].toUpperCase();

        if (isNaN(hours) || hours < 1 || hours > 12 || isNaN(minutes) || minutes < 0 || minutes > 59) {
            Logger.warn('datetime-utils', 'Invalid time components found after regex match', { hours, minutes, timeStr });
            return null; 
        }

        // Convert to 24-hour format
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0; // Handle midnight (12:xx AM)

        return { hours, minutes };
    } else {
        Logger.warn('datetime-utils', 'Could not parse time part from string using regex', { timeStr });
        return null;
    }
}

/**
 * Determines the base date (day) and extracts the remaining time string part
 * from various Slack timestamp formats ("Today at...", "Yesterday at...", "Month Day at...").
 * @param ts The original timestamp string.
 * @param contextDate The date context for relative dates or year inference.
 * @returns Object with baseDate (Date object at 00:00) and remaining time string, or null on failure.
 * @private
 */
function _determineBaseDateAndTimeStr(ts: string, contextDate?: Date | null): { baseDate: Date; timeStr: string } | null {
    let baseDate = contextDate ? new Date(contextDate) : new Date();
    baseDate.setHours(0, 0, 0, 0);
    let timeStr = ts.trim();

    // Handle Relative Dates
    if (timeStr.toLowerCase().startsWith('today at ')) {
        timeStr = timeStr.substring('today at '.length).trim();
        return { baseDate, timeStr };
    } else if (timeStr.toLowerCase().startsWith('yesterday at ')) {
        baseDate.setDate(baseDate.getDate() - 1);
        timeStr = timeStr.substring('yesterday at '.length).trim();
        return { baseDate, timeStr };
    }

    // Handle Explicit Dates (e.g., "Feb 6th at 7:47 PM", "Mar 10, 2024 at ...")
    // Regex captures: 1=Month+Day(+Ordinal), 2=Year (optional), 3=Time part (optional)
    const dateMatch = timeStr.match(/^(\w+\s+\d+(?:st|nd|rd|th)?)(?:,\s*(\d{4}))?(?:\s+at\s+(.*))?/i);
    if (dateMatch) {
        const potentialDatePart = dateMatch[1]; // e.g., "Feb 6th"
        const yearStr = dateMatch[2]; // e.g., "2024" or undefined
        const possibleTimePart = dateMatch[3]; // e.g., "7:47 PM" or undefined

        const year = yearStr || (contextDate ? contextDate.getFullYear() : new Date().getFullYear());
        // Use the robust parseDate here
        const parsedDate = parseDate(`${potentialDatePart}, ${year}`); 

        if (parsedDate) {
            // Successfully parsed an explicit date.
            baseDate = parsedDate; // Already normalized by parseDate
            timeStr = possibleTimePart || '12:00 AM'; // Default if time is missing after "at"
            return { baseDate, timeStr };
        } else {
            // Date parsing failed for an explicit date format. Return null.
            Logger.warn('datetime-utils', 'Failed to parse explicit date part. Invalid date.', { potentialDatePart, year });
            return null; // Don't fall through if explicit date was invalid
        }
    } else {
        // No relative or explicit date found. Assume the string is just the time.
        timeStr = ts.trim();
        // Fall through to return baseDate (context/today) and original timeStr
    }

    // Return context/today as baseDate and the (potentially original) time string
    return { baseDate, timeStr };
}


/**
 * Gets month index from month name
 */
function getMonthIndex(monthStr: string): number {
    const month = monthStr.toLowerCase();
    return MONTHS[month] ?? -1;
}

/**
 * Parses a Slack timestamp string (handling relative/explicit dates and time) into a Date object.
 * Enhanced to handle more formats including relative dates, day of week, and linked timestamps.
 *
 * @param ts The timestamp string from Slack (e.g., "12:34 PM", "Today at 1:23 PM", "Feb 6th at 7:47 PM").
 * @param contextDate The date context for relative timestamps or year inference. Defaults to the current date if null/undefined.
 * @returns A Date object representing the parsed timestamp, or null if parsing fails.
 */
export function parseSlackTimestamp(ts: string, contextDate?: Date | null): Date | null {
    if (!ts) return null;

    try {
        // Remove any surrounding brackets or parentheses
        const cleaned = ts.trim().replace(/^[\[\(]|[\]\)]$/g, '');

        // Try direct Date parsing first (handles many standard formats)
        const directParse = new Date(cleaned);
        if (!isNaN(directParse.getTime())) {
            return directParse;
        }

    // Handle relative dates first
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Handle "Today at Time" format
    const todayMatch = cleaned.match(/^Today\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (todayMatch) {
        const hours = parseInt(todayMatch[1], 10);
        const minutes = parseInt(todayMatch[2], 10);
        const isPM = todayMatch[3]?.toUpperCase() === 'PM';
        
        const result = new Date(today);
        let adjustedHours = hours;
        
        if (todayMatch[3]) { // 12-hour format
            if (isPM && hours !== 12) adjustedHours += 12;
            else if (!isPM && hours === 12) adjustedHours = 0;
        }
        
        result.setHours(adjustedHours, minutes, 0, 0);
        return result;
    }

    // Handle "Yesterday at Time" format
    const yesterdayMatch = cleaned.match(/^Yesterday\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (yesterdayMatch) {
        const hours = parseInt(yesterdayMatch[1], 10);
        const minutes = parseInt(yesterdayMatch[2], 10);
        const isPM = yesterdayMatch[3]?.toUpperCase() === 'PM';
        
        const result = new Date(yesterday);
        let adjustedHours = hours;
        
        if (yesterdayMatch[3]) { // 12-hour format
            if (isPM && hours !== 12) adjustedHours += 12;
            else if (!isPM && hours === 12) adjustedHours = 0;
        }
        
        result.setHours(adjustedHours, minutes, 0, 0);
        return result;
    }

    // Handle day of week formats (e.g., "Wednesday at 8:19 PM", "Monday")
    const dayOfWeekMatch = cleaned.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?$/i);
    if (dayOfWeekMatch) {
        const targetDay = dayOfWeekMatch[1];
        const hours = dayOfWeekMatch[2] ? parseInt(dayOfWeekMatch[2], 10) : 0;
        const minutes = dayOfWeekMatch[3] ? parseInt(dayOfWeekMatch[3], 10) : 0;
        const isPM = dayOfWeekMatch[4]?.toUpperCase() === 'PM';
        
        // Find the most recent occurrence of this day
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const targetDayIndex = daysOfWeek.findIndex(d => d.toLowerCase() === targetDay.toLowerCase());
        const currentDayIndex = today.getDay();
        
        let daysAgo = currentDayIndex - targetDayIndex;
        if (daysAgo < 0) daysAgo += 7;
        if (daysAgo === 0) daysAgo = 7; // If it's the same day, assume last week
        
        const result = new Date(today);
        result.setDate(result.getDate() - daysAgo);
        
        if (dayOfWeekMatch[2]) { // Has time component
            let adjustedHours = hours;
            if (isPM && hours !== 12) adjustedHours += 12;
            else if (!isPM && hours === 12) adjustedHours = 0;
            result.setHours(adjustedHours, minutes, 0, 0);
        } else {
            result.setHours(0, 0, 0, 0);
        }
        
        return result;
    }

    // Handle time-only format (e.g., "10:30 AM", "2:45 PM", "14:30")
    const timeOnlyMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (timeOnlyMatch) {
        const baseDate = contextDate || today;
        const hours = parseInt(timeOnlyMatch[1], 10);
        const minutes = parseInt(timeOnlyMatch[2], 10);
        const isPM = timeOnlyMatch[3]?.toUpperCase() === 'PM';
        
        const result = new Date(baseDate);
        let adjustedHours = hours;
        
        if (timeOnlyMatch[3]) { // 12-hour format
            if (isPM && hours !== 12) adjustedHours += 12;
            else if (!isPM && hours === 12) adjustedHours = 0;
        }
        
        result.setHours(adjustedHours, minutes, 0, 0);
        return result;
    }

    // Handle "Month Day at Time" format (e.g., "Feb 6th at 7:47 PM", "Feb 25th at 10:39 AM")
    const monthDayTimeMatch = cleaned.match(/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (monthDayTimeMatch) {
        const monthStr = monthDayTimeMatch[1];
        const day = parseInt(monthDayTimeMatch[2], 10);
        const hours = parseInt(monthDayTimeMatch[3], 10);
        const minutes = parseInt(monthDayTimeMatch[4], 10);
        const isPM = monthDayTimeMatch[5].toUpperCase() === 'PM';
        
        const year = contextDate ? contextDate.getFullYear() : new Date().getFullYear();
        const monthIndex = getMonthIndex(monthStr);
        
        if (monthIndex !== -1) {
            let adjustedHours = hours;
            if (isPM && hours !== 12) adjustedHours += 12;
            else if (!isPM && hours === 12) adjustedHours = 0;
            
            return new Date(year, monthIndex, day, adjustedHours, minutes, 0, 0);
        }
    }

    // Handle "Month Day" format without time (e.g., "Jan 15th", "December 25")
    const monthDayMatch = cleaned.match(/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
    if (monthDayMatch) {
        const monthStr = monthDayMatch[1];
        const day = parseInt(monthDayMatch[2], 10);
        const year = contextDate ? contextDate.getFullYear() : new Date().getFullYear();
        const monthIndex = getMonthIndex(monthStr);
        
        if (monthIndex !== -1) {
            return new Date(year, monthIndex, day, 0, 0, 0, 0);
        }
    }

    // Handle linked timestamp format by extracting the visible text
    const linkedMatch = cleaned.match(/^\[([^\]]+)\]\(https?:\/\/[^\)]+\)$/i);
    if (linkedMatch) {
        return parseSlackTimestamp(linkedMatch[1], contextDate);
    }

    // Handle time with seconds (e.g., "10:30:45 AM")
    const timeWithSecondsMatch = cleaned.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
    if (timeWithSecondsMatch) {
        const baseDate = contextDate || today;
        const hours = parseInt(timeWithSecondsMatch[1], 10);
        const minutes = parseInt(timeWithSecondsMatch[2], 10);
        const seconds = parseInt(timeWithSecondsMatch[3], 10);
        const isPM = timeWithSecondsMatch[4]?.toUpperCase() === 'PM';
        
        const result = new Date(baseDate);
        let adjustedHours = hours;
        
        if (timeWithSecondsMatch[4]) { // 12-hour format
            if (isPM && hours !== 12) adjustedHours += 12;
            else if (!isPM && hours === 12) adjustedHours = 0;
        }
        
        result.setHours(adjustedHours, minutes, seconds, 0);
        return result;
    }

        // Try the existing helper functions as fallback
        const dateAndTime = _determineBaseDateAndTimeStr(cleaned, contextDate);
        if (dateAndTime) {
            const { baseDate, timeStr } = dateAndTime;
            const timeParts = _parseTimePart(timeStr);
            if (timeParts) {
                const finalDate = new Date(baseDate);
                finalDate.setHours(timeParts.hours, timeParts.minutes, 0, 0);
                return finalDate;
            }
        }

        return null;
    } catch (e) {
        Logger.warn('datetime-utils', 'Error parsing Slack timestamp', { timestamp: ts, error: e });
        return null;
    }
}