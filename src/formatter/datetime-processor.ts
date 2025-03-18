/**
 * DateTimeProcessor.ts
 * Specialized module for handling date and time processing in Slack messages
 * 
 * This module centralizes all date/time-related functionality, providing consistent
 * handling of timestamps and date formats across the application. It handles various
 * date and time formats found in Slack exports and copy/paste operations.
 */
import { SlackFormatterSettings } from "../types";

export class DateTimeProcessor {
  // Regex pattern constants for date and time detection
  private static readonly DATE_PATTERN = /^(?:Yesterday|Today|\w+, \w+ \d{1,2}(?:th|st|nd|rd)?)$/;
  private static readonly TIMESTAMP_PATTERN = /^\[((?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?(?:\d{1,2}:\d{2}\s*(?:AM|PM)))\]/i;
  private static readonly TIME_ONLY_PATTERN = /^(?:Today|Yesterday|[A-Z][a-z]{2}\s+\d+(?:st|nd|rd|th)?)?(?:\s+at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM))$/i;
  private static readonly DATE_TIME_PATTERN = /^\[([A-Z][a-z]{2}\s+\d+(?:st|nd|rd)?\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))\]/i;
  private static readonly HYPERLINK_PATTERN = /\[(.*?)\]\(.*?\)/;
  private static readonly INDENTED_TIME_PATTERN = /^\s+(\d{1,2}:\d{2}\s*(?:AM|PM))$/;
  
  private settings: SlackFormatterSettings;
  
  /**
   * Creates a new DateTimeProcessor instance
   * 
   * @param settings - Formatter settings
   */
  constructor(settings: SlackFormatterSettings) {
    this.settings = settings;
  }
  
  /**
   * Parse a timestamp from a line of text
   * 
   * Handles various timestamp formats:
   * - [10:30 AM]
   * - [Today at 10:30 AM]
   * - [Feb 5th at 10:30 AM]
   * - 10:30 AM
   * - Hyperlinked timestamps
   * 
   * @param line - Line of text to parse
   * @returns Extracted timestamp or null if not found
   */
  public parseTimestamp(line: string): string | null {
    if (!line) return null;
    
    const trimmed = line.trim();
    
    // Check for hyperlinked timestamps first
    const hyperlinkMatch = trimmed.match(DateTimeProcessor.HYPERLINK_PATTERN);
    if (hyperlinkMatch) {
      return this.parseTimestamp(hyperlinkMatch[1]);
    }
    
    // Try different timestamp patterns
    const patterns = [
      DateTimeProcessor.TIMESTAMP_PATTERN,
      DateTimeProcessor.TIME_ONLY_PATTERN,
      DateTimeProcessor.DATE_TIME_PATTERN
    ];
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return null;
  }
  
  /**
   * Format a timestamp for display
   * 
   * Normalizes various timestamp formats to a consistent representation
   * 
   * @param timestamp - Timestamp to format
   * @returns Formatted timestamp
   */
  public formatTimestamp(timestamp: string): string {
    if (!timestamp) return '';
    
    // Check for hyperlinked timestamps
    const hyperlinkMatch = timestamp.match(DateTimeProcessor.HYPERLINK_PATTERN);
    if (hyperlinkMatch) {
      return this.formatTimestamp(hyperlinkMatch[1]);
    }
    
    // Remove brackets if present
    timestamp = timestamp.replace(/^\[?(.*?)\]?$/, '$1');
    
    // If timestamp parsing is disabled, just return the cleaned timestamp
    if (!this.settings.enableTimestampParsing) {
      return timestamp;
    }
    
    // Parse and format the time
    const timeMatch = timestamp.match(/(\d{1,2}):(\d{2})(?:\s?([AaPp]\.?[Mm]\.?)?)/);
    if (!timeMatch) return timestamp;
    
    let [_, hours, minutes, ampm] = timeMatch;
    let hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    
    // Normalize AM/PM
    if (ampm) {
      ampm = ampm.toLowerCase().replace(/\./g, '');
      
      // Ensure proper 12/24 hour conversion
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
    } else {
      // No AM/PM specified - make a reasonable guess based on hour
      ampm = hour < 12 ? 'am' : 'pm';
      if (hour > 12) hour -= 12;
    }
    
    // Format with user's timezone if specified
    const userTz = this.settings.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Create a date object for today with the specified time
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    
    return date.toLocaleString('en-US', {
      timeZone: userTz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  
  /**
   * Check if a line is a date header
   * 
   * @param line - Line to check
   * @returns True if the line is a date header
   */
  public isDateLine(line: string): boolean {
    return DateTimeProcessor.DATE_PATTERN.test(line);
  }
  
  /**
   * Parse a date from a date header line
   * 
   * @param line - Date header line
   * @returns Date object or null if parsing failed
   */
  public parseDateLine(line: string): Date | null {
    if (!this.isDateLine(line)) return null;
    
    // Handle "Yesterday" and "Today"
    if (line === "Yesterday") {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      return date;
    } else if (line === "Today") {
      return new Date();
    }
    
    // Handle date format like "Monday, February 5th"
    try {
      return new Date(line);
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Format a date in YYYY-MM-DD format
   * 
   * @param date - Date to format
   * @returns Formatted date string
   */
  public formatDateYMD(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  
  /**
   * Check if a line contains an indented timestamp
   * 
   * @param line - Line to check
   * @returns True if the line contains an indented timestamp
   */
  public isIndentedTimestamp(line: string): boolean {
    return DateTimeProcessor.INDENTED_TIME_PATTERN.test(line);
  }
  
  /**
   * Extract an indented timestamp from a line
   * 
   * @param line - Line containing an indented timestamp
   * @returns Extracted timestamp or null if not found
   */
  public extractIndentedTimestamp(line: string): string | null {
    const match = line.match(DateTimeProcessor.INDENTED_TIME_PATTERN);
    return match ? match[1] : null;
  }
}