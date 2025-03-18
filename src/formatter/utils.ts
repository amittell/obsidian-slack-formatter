/**
 * Utility functions for Slack message formatting
 * Contains shared helper functions used across the formatter modules
 */

/**
 * Format a date as YYYY-MM-DD
 * @param d - Date object to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse and format a time string with consistent formatting
 * Handles various time formats and ensures consistent output
 *
 * @param timeStr - The time string to parse (e.g., "3:45 PM", "15:45")
 * @param baseDate - Optional base date or array of dates to use for the time (defaults to current date)
 * @param settings - Optional settings object that may contain timeZone
 * @returns Formatted time string
 */
export function parseAndFormatTime(
  timeStr: string,
  baseDate?: Date | Date[] | null,
  settings?: { timeZone?: string } | null
): string {
  // First normalize the time format
  timeStr = normalizeTimeFormat(timeStr);
  
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s?([AaPp]\.?[Mm]\.?)?)/);
  if (!match) return timeStr;
  
  let [_, hh, mm, ampm] = match;
  let hour = parseInt(hh, 10);
  const minute = parseInt(mm, 10);
  
  if (ampm) {
    ampm = ampm.toLowerCase().replace(/\./g, '');
    
    // Ensure proper 12/24 hour conversion
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  } else {
    // No AM/PM specified - make a reasonable guess based on hour
    if (hour < 12) {
      ampm = 'am';
    } else {
      ampm = 'pm';
      if (hour > 12) hour -= 12;
    }
  }
  
  // Determine which date to use as base
  let effectiveBaseDate: Date;
  
  if (!baseDate) {
    // No base date provided, use current date
    effectiveBaseDate = new Date();
  } else if (Array.isArray(baseDate)) {
    // If we have an array of dates, use the earliest one
    if (baseDate.length > 0) {
      effectiveBaseDate = baseDate.reduce((a, b) => (a < b ? a : b));
    } else {
      effectiveBaseDate = new Date();
    }
  } else {
    // Use the provided date
    effectiveBaseDate = baseDate;
  }
  
  const newDate = new Date(effectiveBaseDate.getTime());
  newDate.setHours(hour, minute, 0, 0);
  
  // Extract timezone from settings if provided
  const userTz = settings?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return newDate.toLocaleString('en-US', {
    timeZone: userTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Normalize time format to a consistent representation
 * Handles various time formats and cleans them up
 * 
 * @param time - The time string to normalize
 * @returns Normalized time string
 */
export function normalizeTimeFormat(time: string): string {
  if (!time) return time;
  
  // Remove any hyperlink formatting
  const hyperlinkMatch = time.match(/\[(.*?)\]\(.*?\)/);
  if (hyperlinkMatch) {
    return normalizeTimeFormat(hyperlinkMatch[1]);
  }
  
  // Remove any brackets
  time = time.replace(/^\[?(.*?)\]?$/, '$1');
  
  // Ensure AM/PM has proper spacing and capitalization
  time = time.replace(/(\d{1,2}:\d{2})([AaPp][Mm])/, '$1 $2');
  time = time.replace(/(\d{1,2}:\d{2})\s*([ap])\.?m\.?/i, '$1 $2m');
  
  // Standardize AM/PM capitalization
  time = time.replace(/\s*am/i, ' AM');
  time = time.replace(/\s*pm/i, ' PM');
  
  return time.trim();
}

/**
 * Generate a unique key for a message to avoid duplication
 * Creates a hash based on username, timestamp, and content
 * 
 * @param user - Username
 * @param time - Timestamp
 * @param contentSample - Sample of message content
 * @returns Unique message key
 */
export function generateMessageKey(user: string, time: string, contentSample: string): string {
  const contentHash = contentSample.substring(0, 50); // Use first 50 chars as content hash
  return `${user}|${time}|${contentHash}`;
}

/**
 * Fix common emoji formatting issues in text
 * This is a pre-processing step before normal parsing
 * 
 * @param text - Text to process
 * @returns Text with fixed emoji formatting
 */
export function fixEmojiFormatting(text: string): string {
  if (!text) return text;
  
  // Fix various emoji formats
  return text
    // Fix emoji with exclamation mark pattern: ![:emoji:] -> :emoji:
    .replace(/!\[:([a-z0-9_\-\+]+):\]/gi, ':$1:')
    // Fix emoji with brackets + number pattern: [:emoji:]27 -> :emoji: 27
    .replace(/\[:([a-z0-9_\-\+]+):\](\d+)/g, ':$1: $2')
    // Fix bracketed emoji with no numbers: [:emoji:] -> :emoji:
    .replace(/\[:([a-z0-9_\-\+]+):\]/g, ':$1:')
    // Fix emoji with URL pattern: :emoji-name:(url) -> :emoji-name:
    .replace(/:([a-z0-9_\-\+]+):\(https?:\/\/[^)]+\)/gi, ':$1:');
}

/**
 * Process multi-line image blocks from Slack paste
 * Fixes image blocks with the following pattern:
 * [
 * <img alt="IMG_XXXX.png" src="https://files.slack.com/...">
 * ](https://files.slack.com/...)
 * 
 * @param text - Text to process
 * @returns Text with fixed image blocks
 */
export function processSlackImageBlocks(text: string): string {
  try {
    // First, detect and process multi-line image blocks
    const lines = text.split('\n');
    const processedLines: string[] = [];
    let imageBlocksFound = 0;
    
    for (let i = 0; i < lines.length; i++) {
      // Look for patterns that start image blocks
      if (lines[i].trim() === '[') {
        // Check the next lines for image pattern
        if (i+1 < lines.length && lines[i+1].includes('<img alt="')) {
          const imgLine = lines[i+1].trim();
          
          // Extract the image information
          const imgMatch = imgLine.match(/<img alt="([^"]+)" src="([^"]+)">/);
          
          if (imgMatch && i+2 < lines.length) {
            const linkLine = lines[i+2].trim();
            const linkMatch = linkLine.match(/^\]\(([^)]+)\)/);
            
            if (linkMatch) {
              // We have a complete image block - replace with proper markdown
              const alt = imgMatch[1];
              const src = imgMatch[2];
              const link = linkMatch[1];
              
              imageBlocksFound++;
              
              processedLines.push(`![${alt}](${src})`);
              processedLines.push(link);
              
              // Skip processed lines
              i += 2;
              continue;
            }
          }
        }
      }
      
      // Also handle single-line image patterns
      const singleLineImgMatch = lines[i].match(/\[\s*<img alt="([^"]+)" src="([^"]+)">\s*\]\(([^)]+)\)/);
      if (singleLineImgMatch) {
        // Extract the components
        const alt = singleLineImgMatch[1];
        const src = singleLineImgMatch[2];
        const link = singleLineImgMatch[3];
        
        imageBlocksFound++;
        
        // Replace with proper markdown
        processedLines.push(`![${alt}](${src})`);
        processedLines.push(link);
        continue;
      }
      
      // Process normal lines
      processedLines.push(lines[i]);
    }
    
    return processedLines.join('\n');
  } catch (error) {
    console.error('Error processing image blocks:', error);
    return text; // Return original text on error
  }
}

/**
 * Debug logging helper with extended functionality
 * Provides consistent logging format with timestamps
 * 
 * @param level - log level (debug, info, warn, error)
 * @param message - the message to log
 * @param data - optional data to include
 * @param debug - whether debug mode is enabled
 */
export function log(
  level: 'debug' | 'info' | 'warn' | 'error', 
  message: string, 
  data?: any, 
  debug: boolean = false
): void {
  const timestamp = new Date().toISOString();
  const formattedData = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : '';
  const logMessage = `[SlackFormatter:${level.toUpperCase()}] [${timestamp}] ${message} ${formattedData}`.trim();
  
  switch (level) {
    case 'debug':
      if (debug) console.debug(logMessage);
      break;
    case 'info':
      console.log(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'error':
      console.error(logMessage);
      break;
  }
}