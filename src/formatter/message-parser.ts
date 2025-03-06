/**
 * Message parser for Slack messages
 * Handles detection and parsing of message headers and metadata
 */

/**
 * Message parsing functions for Slack conversations
 */
import { ParsedMessageStart } from '../types';

/**
 * RegExp patterns for Slack message detection
 */
export class MessageParser {
  private dateRegex = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?(?:,? \d{4})?/i;
  private timeRegex = /\d{1,2}:\d{2}(?:\s*[AaPp]\.?[Mm]\.?)?/i;
  private timeWithBracketsRegex = /\[\d{1,2}:\d{2}(?:\s*[AaPp]\.?[Mm]\.?)?\]/i;
  // Regex patterns
  private avatarImagePattern = /^!\[\]\((https:\/\/ca\.slack-edge\.com\/[^)]+)\)$/;
  private brokenLinkPattern = /^\]\(([^)]+)\)/;
  private slackArchiveUrlPattern = /https:\/\/[^.]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+/;

  /**
   * Debug logging helper
   */
  private debugLog(message: string, data?: any) {
    console.log(`[SlackFormat] ${message}`, data || '');
  }
  
  /**
   * Special method to detect the first message in a paste
   * This specifically targets the common pattern seen in the first example:
   * "Alex MittellAlex Mittell [Feb 6th at 7:47 PM](https://stripe.slack.com/archives/...)"
   */
  public detectFirstMessage(lines: string[]): { user: string; time: string; date: string; remainder: string; lineCount: number } | null {
    if (!lines || lines.length === 0) return null;
    
    // Look for the specific pattern in the first few lines
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Improved pattern for doubled usernames with better capture groups to ensure full name extraction
      const firstMsgPattern = /^([A-Za-z]+)\s+([A-Za-z]+)(?:[A-Za-z]+)?\s+(?:[A-Za-z]+)?\s*\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?) at (\d{1,2}:\d{2}\s*(?:AM|PM))](?:\([^)]+\))?\s*(.*)$/i;
      const match = line.match(firstMsgPattern);
      
      if (match) {
        // Extract the first name and last name directly from the regex
        const firstName = match[1];
        const lastName = match[2];
        const combinedName = `${firstName} ${lastName}`;
        
        return {
          user: combinedName,
          date: match[3],
          time: match[4],
          remainder: match[5],
          lineCount: 1
        };
      }
      
      // If the first pattern doesn't match, try the alternative pattern
      const exactNamePattern = /^([A-Za-z]+\s+[A-Za-z]+)(?:[A-Za-z]+\s+[A-Za-z]+)?\s+\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?) at (\d{1,2}:\d{2}\s*(?:AM|PM))](?:\([^)]+\))?\s*(.*)$/i;
      const exactMatch = line.match(exactNamePattern);
      
      if (exactMatch) {
        // Just use the first captured name
        return {
          user: exactMatch[1],
          date: exactMatch[2],
          time: exactMatch[3],
          remainder: exactMatch[4],
          lineCount: 1
        };
      }
      
      // Try alternate pattern - for cases where username and timestamp are clearly separated
      const altPattern = /^([A-Za-z][A-Za-z]+(?:\s+[A-Za-z]+)+)\s+\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?) at (\d{1,2}:\d{2}\s*(?:AM|PM))]/i;
      const altMatch = line.match(altPattern);
      
      if (altMatch) {
        // Extract the full username portion before the timestamp
        const userPortion = line.substring(0, line.indexOf('['));
        const userName = this.fixDuplicatedUsername(userPortion.trim());
        
        return {
          user: userName,
          date: altMatch[2],
          time: altMatch[3],
          remainder: line.substring(line.indexOf(']') + 1).trim(),
          lineCount: 1
        };
      }
    }
    
    return null;
  }

  /**
   * Attempts to detect the start of a message from a line of Slack text
   * Enhanced to handle more message formats and partial copies
   */
  public parseMessageStart(line: string): { user: string; time: string; remainder: string; date?: string } | null {
    if (!line) return null;
    
    // Check for thread divider line
    if (line.trim() === '---') {
      return {
        user: "THREAD_DIVIDER",
        time: "",
        remainder: ""
      };
    }
    
    // Handle avatar image followed by username pattern (common in thread replies)
    if (line.match(/^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)\s+/)) {
      const avatarUserPattern = /^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)\s+([A-Za-z]+\s+[A-Za-z]+)/i;
      const avatarMatch = line.match(avatarUserPattern);
      
      if (avatarMatch) {
        // Found avatar with username pattern
        const userName = this.fixDuplicatedUsername(avatarMatch[1]);
        
        // Try to find timestamp in the same line
        const timeMatch = line.match(/\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?) at (\d{1,2}:\d{2}\s*(?:AM|PM))]/i);
        
        if (timeMatch) {
          return {
            user: userName,
            time: timeMatch[2],
            date: timeMatch[1],
            remainder: line.substring(line.indexOf(timeMatch[0]) + timeMatch[0].length).trim()
          };
        } else {
          // No timestamp in this line, treat as continuation but with username
          return {
            user: userName,
            time: "Unknown",
            remainder: line.substring(line.indexOf(avatarMatch[1]) + avatarMatch[1].length).trim()
          };
        }
      }
    }
    
    // IMPROVED: Handle specific pattern with date, time and username but no clear user ownership
    // This pattern often appears in thread replies: [Date at Time]
    const threadDateTimePattern = /^\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?) at (\d{1,2}:\d{2}\s*(?:AM|PM))]/i;
    const threadDateMatch = line.match(threadDateTimePattern);
    
    if (threadDateMatch) {
      // Try to find a username after the timestamp pattern
      const afterTimestamp = line.substring(line.indexOf(']') + 1).trim();
      const usernameMatch = afterTimestamp.match(/^([A-Za-z]+\s+[A-Za-z]+)(?:!?\[:[\w\-]+:\])?/);
      
      if (usernameMatch) {
        // We have a username after the timestamp!
        return {
          user: this.fixDuplicatedUsername(usernameMatch[1]),
          time: threadDateMatch[2],
          remainder: afterTimestamp.substring(usernameMatch[0].length).trim(),
          date: threadDateMatch[1]
        };
      } else {
        // No clear username - look for previous context
        return {
          user: "Thread Participant", // Was "Thread message" - improving name
          time: threadDateMatch[2],
          remainder: afterTimestamp,
          date: threadDateMatch[1]
        };
      }
    }

    // Handle specific pattern with archive links
    // Example: "Alex MittellAlex Mittell [Feb 6th at 7:47 PM](https://stripe.slack.com/archives/...)"
    const archiveLinkPattern = /^([A-Za-z0-9][\w\s]+?)\s+\[([A-Za-z0-9][\w\s]+) at (\d{1,2}:\d{2}\s*(?:AM|PM))]\(https:\/\/[^.]+\.slack\.com\/archives\/[^)]+\)\s*(.*)$/i;
    const archiveMatch = line.match(archiveLinkPattern);
    if (archiveMatch) {
      return {
        user: this.fixDuplicatedUsername(archiveMatch[1].trim()),
        time: archiveMatch[3].trim(),
        remainder: archiveMatch[4].trim(),
        date: archiveMatch[2].trim()
      };
    }
    
    // Handle emoji badges in username more effectively
    // This pattern looks for username followed by emoji marker like "Byron Luk⛔" or "Byron Luk![:no_entry:]"
    const userWithEmojiBadge = /^([A-Za-z0-9][\w\s]+?)(?:!?\[:[\w\-]+:\]|[^\w\s])\s+\[([\d:]+\s*(?:AM|PM|am|pm)?)\s*$/i;
    const emojiBadgeMatch = line.match(userWithEmojiBadge);
    if (emojiBadgeMatch) {
      return {
        user: this.fixDuplicatedUsername(emojiBadgeMatch[1].trim()),
        time: emojiBadgeMatch[2].trim(),
        remainder: '',
        date: undefined
      };
    }
    
    // Enhanced pattern detection for Slack message format with username first
    // Example: "Byron LukByron Luk⛔  [12:35 PM"
    const enhancedUserTimePattern = /^([A-Za-z0-9][\w\s]+?)(?:!?\[:[\w\-]+:\])?\s+\[([\d:]+\s*(?:AM|PM|am|pm)?)\s*$/i;
    const enhancedMatch = line.match(enhancedUserTimePattern);
    if (enhancedMatch) {
      return {
        user: this.fixDuplicatedUsername(enhancedMatch[1].trim()),
        time: enhancedMatch[2].trim(),
        remainder: '',
        date: undefined
      };
    }
    
    // Common Slack message pattern:
    // Username [Date at Time](Link)
    // Example: "Alex Mittell [Feb 7th at 8:39 AM](https://...)"
    const userDateTimeRegex = /^([A-Za-z0-9][\w\s]+?)\s+\[([A-Za-z0-9][\w\s]+) at (\d{1,2}:\d{2}\s*(?:AM|PM))]\(([^)]+)\)\s*(.*)$/i;
    const match = line.match(userDateTimeRegex);
    
    if (match) {
      return {
        user: this.fixDuplicatedUsername(match[1].trim()),
        time: match[3].trim(),
        remainder: match[5].trim(),
        date: match[2].trim()
      };
    }
    
    // Pattern without link
    // Username [Date at Time]
    const userDateTimeNoLinkRegex = /^([A-Za-z0-9][\w\s]+?)\s+\[([A-Za-z0-9][\w\s]+) at (\d{1,2}:\d{2}\s*(?:AM|PM))]\s*(.*)$/i;
    const matchNoLink = line.match(userDateTimeNoLinkRegex);
    
    if (matchNoLink) {
      return {
        user: this.fixDuplicatedUsername(matchNoLink[1].trim()),
        time: matchNoLink[3].trim(),
        remainder: matchNoLink[4].trim(),
        date: matchNoLink[2].trim()
      };
    }
    
    // Duplicated username pattern (common in Slack copy-paste)
    // Example: "Alex MittellAlex Mittell [Feb 7th at 8:39 AM]"
    const duplicatedNameRegex = /^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)\s+\[([A-Za-z0-9][\w\s]+) at (\d{1,2}:\d{2}\s*(?:AM|PM))]/i;
    const dupMatch = line.match(duplicatedNameRegex);
    
    if (dupMatch) {
      return {
        user: dupMatch[1].trim(), // Use just the first occurrence 
        time: dupMatch[4].trim(),
        remainder: '',
        date: dupMatch[3].trim()
      };
    }
    
    // Pattern for simplified username and time format
    // Example: "Byron LukByron Luk⛔  [12:35 PM]"
    const simplifiedUserTimeRegex = /^([A-Za-z0-9][\w\s]+?)(?:!?\[:[\w\-]+:\])?\s+\[(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]\s*(.*)$/i;
    const simplifiedMatch = line.match(simplifiedUserTimeRegex);
    if (simplifiedMatch) {
      return {
        user: this.fixDuplicatedUsername(simplifiedMatch[1].trim()),
        time: simplifiedMatch[2].trim(),
        remainder: simplifiedMatch[3].trim()
      };
    }
    
    // Username with Time pattern (no date)
    // Example: "Alex Mittell 10:42 AM"
    const userTimeRegex = /^([A-Za-z0-9][\w\s]+?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*(.*)$/i;
    const timeMatch = line.match(userTimeRegex);
    
    if (timeMatch) {
      return {
        user: this.fixDuplicatedUsername(timeMatch[1].trim()),
        time: timeMatch[2].trim(),
        remainder: timeMatch[3].trim()
      };
    }
    
    // IMPROVED: Check for bracketed timestamp with username after it
    // Example: "[10:42 AM] Username: message content"
    const bracketTimeWithNameRegex = /^\[(\d{1,2}:\d{2}\s*(?:AM|PM)?)\]\s*([A-Za-z]+\s+[A-Za-z]+)(?::|!?\[:[\w\-]+:\])?/i;
    const bracketTimeWithNameMatch = line.match(bracketTimeWithNameRegex);
    
    if (bracketTimeWithNameMatch) {
      const colonIndex = line.indexOf(':', line.indexOf(bracketTimeWithNameMatch[2]));
      const remainder = colonIndex > -1 ? 
        line.substring(colonIndex + 1).trim() : 
        line.substring(line.indexOf(bracketTimeWithNameMatch[2]) + bracketTimeWithNameMatch[2].length).trim();
      
      return {
        user: this.fixDuplicatedUsername(bracketTimeWithNameMatch[2].trim()),
        time: bracketTimeWithNameMatch[1].trim(),
        remainder: remainder
      };
    }
    
    // Check for bracketed timestamp
    // Example: "[10:42 AM]" or "[10:42]"
    const bracketTimeRegex = /^\[(\d{1,2}:\d{2}\s*(?:AM|PM)?)\]\s*(.*)$/i;
    const bracketMatch = line.match(bracketTimeRegex);
    
    if (bracketMatch) {
      // IMPROVED: Check if there's message content after the timestamp
      const afterTime = bracketMatch[2].trim();
      
      // Check if there's a username-like pattern in the content following the timestamp
      const possibleUserInContent = afterTime.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)(?::|!?\[:[\w\-]+:\])?/i);
      
      if (possibleUserInContent && possibleUserInContent[1].split(/\s+/).length >= 2) {
        // This looks like a timestamp followed by a username pattern!
        const colonIndex = afterTime.indexOf(':', afterTime.indexOf(possibleUserInContent[1]));
        const remainder = colonIndex > -1 ? 
          afterTime.substring(colonIndex + 1).trim() : 
          afterTime.substring(afterTime.indexOf(possibleUserInContent[1]) + possibleUserInContent[1].length).trim();
        
        return {
          user: this.fixDuplicatedUsername(possibleUserInContent[1]),
          time: bracketMatch[1].trim(),
          remainder: remainder
        };
      }
      
      // If nothing looks like a clear username, use placeholder and store the content
      return {
        // Instead of "Time-only message", use context-aware label
        // IMPROVED: Use "Thread Participant" instead of "Timestamp marker" for better identification
        user: afterTime ? "Thread Participant" : "Timestamp marker",
        time: bracketMatch[1].trim(),
        remainder: afterTime
      };
    }
    
    // No recognized pattern
    return null;
  }

  /**
   * Parse standard slack message format with username and timestamp
   */
  private parseRegularMessageFormat(line: string): ParsedMessageStart | null {
    // First detect doubled usernames at the beginning
    const doubledName = this.detectDoubledUsername(line);
    if (doubledName) {
      const fixedLine = line.replace(doubledName.original, doubledName.fixed);
      
      // Now check for timestamp patterns in the fixed line
      const timeMatch = fixedLine.match(/\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]/i);
      if (timeMatch) {
        // Parse the date/time components
        const fullTimestamp = timeMatch[1]; // e.g. "Feb 6th at 7:47 PM"
        const timeParts = fullTimestamp.match(/([A-Za-z]+\s+\d+(?:st|nd|rd|th)?)\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
        
        if (timeParts) {
          const date = timeParts[1]; // e.g. "Feb 6th"
          const time = timeParts[2]; // e.g. "7:47 PM"
          
          // Get the remainder after the timestamp link
          let remainder = '';
          const closeParenIndex = fixedLine.indexOf(')', fixedLine.indexOf(time));
          if (closeParenIndex > 0) {
            remainder = fixedLine.substring(closeParenIndex + 1).trim();
          }
          
          return {
            user: doubledName.fixed,
            time: time,
            remainder: remainder,
            date: date
          };
        }
      }
    }

    // Check for format like "Username [Feb 6th at 7:47 PM]" 
    const fullHeaderMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?)\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]/i);
    if (fullHeaderMatch) {
      const username = this.fixDuplicatedUsername(fullHeaderMatch[1]);
      const date = fullHeaderMatch[2];
      const time = fullHeaderMatch[3];
      
      // Get the remainder after the timestamp link
      let remainder = '';
      const closeParenIndex = line.indexOf(')', line.indexOf(time));
      if (closeParenIndex > 0) {
        remainder = line.substring(closeParenIndex + 1).trim();
      }
      
      return {
        user: username,
        time,
        remainder,
        date
      };
    }

    // Extract time pattern first - looking for format like 12:35 PM or 9:47 AM
    const timePattern = /\[?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]?/;
    const timeMatch = line.match(timePattern);
    
    if (!timeMatch) return null;
    
    const time = timeMatch[1];
    const timeParts = line.split(time);
    
    if (timeParts.length < 2) return null;
    
    let beforeTime = timeParts[0].trim();
    let afterTime = timeParts.slice(1).join(time).trim();
    
    // Fix Slack archive URLs that might be attached to the timestamp
    if (afterTime.startsWith('](https://') && this.slackArchiveUrlPattern.test(afterTime)) {
      const urlEndIndex = afterTime.indexOf(')', 2);
      if (urlEndIndex > 0) {
        afterTime = afterTime.substring(urlEndIndex + 1).trim();
      }
    }
    
    // Remove emoji from username for better parsing
    let user = beforeTime;
    let hasEmoji = false;
    
    // Check for emoji in username and strip it out
    if (beforeTime.includes('![')) {
      hasEmoji = true;
      user = beforeTime.split('![')[0].trim();
    } else if (beforeTime.includes('![:')) {
      hasEmoji = true;
      user = beforeTime.split('![:')[0].trim();
    }
    
    // Fix doubled usernames
    user = this.fixDuplicatedUsername(user);
    
    return {
      user,
      time,
      remainder: afterTime
    };
  }

  /**
   * Enhanced parser for handling partial thread copies or unusual formats
   * This attempts to extract user names and timestamps when the format isn't standard
   */
  private parsePartialThreadMessageFormat(line: string): ParsedMessageStart | null {
    // Check for message dividers/separators ("---")
    if (line.trim() === "---") {
      return {
        user: "THREAD_DIVIDER",
        time: "",
        remainder: ""
      };
    }

    // First check for common patterns with profile pictures
    if (line.includes('](https://ca.slack-edge.com/')) {
      // Handle avatar format from newer Slack clients (48px image followed by name)
      const avatarFollowedByName = line.match(/^!\[\]\((https:\/\/ca\.slack-edge\.com\/[^)]+)\)\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/);
      if (avatarFollowedByName) {
        const userName = this.fixDuplicatedUsername(avatarFollowedByName[2]);
        
        // Look for a time reference
        const timeRef = line.match(/\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
        const dateRef = line.match(/\[([A-Za-z]+\s+\d+(?:st|nd|rd|th)?)\s+at\s+/i);
        
        if (timeRef) {
          const date = dateRef ? dateRef[1] : null;
          const remainder = line.substring(line.indexOf(timeRef[1]) + timeRef[1].length).trim();
          
          return {
            user: userName,
            time: timeRef[1],
            remainder,
            date: date || undefined
          };
        } else {
          // No visible time, may be hidden in a collapsed timestamp
          return {
            user: userName,
            time: '???:??',
            remainder: line.substring(line.indexOf(userName) + userName.length).trim()
          };
        }
      }
    }

    // Check for date headers like "Today at 8:39 AM"
    const dateHeaderPattern = /^(Today|Yesterday|[A-Z][a-z]+\s+\d+(?:st|nd|rd|th)?)\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i;
    const dateHeaderMatch = line.match(dateHeaderPattern);
    if (dateHeaderMatch) {
      return {
        user: "DATE_HEADER",
        time: dateHeaderMatch[2],
        remainder: line.substring(line.indexOf(dateHeaderMatch[2]) + dateHeaderMatch[2].length).trim(),
        date: dateHeaderMatch[1]
      };
    }

    // Look for date-time patterns with thread info
    const dateTimeThreadPattern = /\[(.*?)at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]/i;
    const dateTimeMatch = line.match(dateTimeThreadPattern);
    if (dateTimeMatch) {
      // Found a date+time format like [Feb 6th at 7:47 PM]
      return {
        user: 'Thread Participant',  // We don't have a clear username
        time: dateTimeMatch[2],
        remainder: line.substring(line.indexOf(']') + 1).trim(),
        date: dateTimeMatch[1].trim()
      };
    }
    
    // Check for lines that appear to be from a thread continuation
    const threadContinuationPattern = /^(Today|Yesterday|\w+day|[A-Z][a-z]+ \d+(?:st|nd|rd|th)?)\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i;
    const threadMatch = line.match(threadContinuationPattern);
    if (threadMatch) {
      return {
        user: 'Thread Participant',  // These lines often don't show a username
        time: threadMatch[2],
        remainder: line.substring(line.indexOf(threadMatch[2]) + threadMatch[2].length).trim(),
        date: threadMatch[1]
      };
    }
    
    // Check for lines that start with timestamp reference in brackets
    const timeRefPattern = /^\[(\d{1,2}:\d{2})(?:\]|\s*(?:AM|PM|am|pm)\])/i;
    const timeRefMatch = line.match(timeRefPattern);
    if (timeRefMatch) {
      const timeValue = timeRefMatch[1];
      const amPmMatch = line.match(/(\d{1,2}:\d{2})\s*(AM|PM|am|pm)/i);
      const fullTime = amPmMatch ? `${amPmMatch[1]} ${amPmMatch[2]}` : timeValue;
      
      return {
        user: 'Thread Participant',
        time: fullTime,
        remainder: line.substring(line.indexOf(']') + 1).trim()
      };
    }
    
    // Check for lines that just have a username with a trailing emoji marker
    const userWithEmojiPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(!?\[:[\w-]+:\])/i;
    const emojiMatch = line.match(userWithEmojiPattern);
    if (emojiMatch) {
      // If the next line might contain a timestamp, this could be the start of a message
      return {
        user: emojiMatch[1].trim(),
        time: '???:??',  // Time unknown, might be detected later
        remainder: line.substring(line.indexOf(emojiMatch[2]) + emojiMatch[2].length).trim()
      };
    }

    // New pattern: Direct username at start of line followed by timestamp reference
    const usernameWithReference = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+\[/;
    const refMatch = line.match(usernameWithReference);
    if (refMatch) {
      // This might be a username followed by timestamp reference
      const userName = this.fixDuplicatedUsername(refMatch[1].trim());
      
      // Look for a time pattern in the line
      const timeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
      if (timeMatch) {
        return {
          user: userName,
          time: timeMatch[1],
          remainder: "" // We'll catch this in the next line
        };
      }
    }
    
    return null;
  }

  /**
   * Detect doubled usernames like "Alex MittellAlex Mittell" at the start of a line
   * Returns null if no doubled name is found
   */
  private detectDoubledUsername(line: string): { original: string, fixed: string } | null {
    // Exact doubled name pattern - when no space separates the duplicates
    const doubledExactMatch = line.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    if (doubledExactMatch) {
      const name1 = doubledExactMatch[1].toLowerCase();
      const name2 = doubledExactMatch[2].toLowerCase();
      
      if (name1.replace(/\s+/g, '') === name2.replace(/\s+/g, '')) {
        return {
          original: doubledExactMatch[0],
          fixed: doubledExactMatch[1]
        };
      }
    }
    
    // Alternative pattern - with a space between
    const doubledWithSpaceMatch = line.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    if (doubledWithSpaceMatch) {
      const name1 = doubledWithSpaceMatch[1].toLowerCase();
      const name2 = doubledWithSpaceMatch[2].toLowerCase();
      
      if (name1 === name2) {
        return {
          original: doubledWithSpaceMatch[0],
          fixed: doubledWithSpaceMatch[1]
        };
      }
    }

    return null;
  }

  /**
   * Fix duplicated usernames that occur in Slack copy+pastes
   * Enhanced to handle various patterns including emoji indicators
   */
  public fixDuplicatedUsername(username: string): string {
    if (!username) return username;
    
    // Strip any emoji indicators from the end first
    const emojiStripPattern = /!?\[:[\w\-]+:\].*$/;
    const usernameWithoutEmoji = username.replace(emojiStripPattern, '').trim();
    
    // NEW: Enhanced pattern for detecting doubled names with no space between them
    // Specifically for "FirstLast FirstLast" pattern like "Alex MittellAlex Mittell"
    const doubledExactPattern = /^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)$/i;
    const doubledMatch = usernameWithoutEmoji.match(doubledExactPattern);
    if (doubledMatch) {
      const firstPart = doubledMatch[1].trim();
      const secondPart = doubledMatch[2].trim();
      
      // Check if the two parts are exactly the same (ignoring case and whitespace)
      if (firstPart.toLowerCase() === secondPart.toLowerCase()) {
        return firstPart;
      }
      
      // Check if the two parts are nearly the same (one might be truncated)
      const firstNormalized = firstPart.toLowerCase().replace(/\s+/g, '');
      const secondNormalized = secondPart.toLowerCase().replace(/\s+/g, '');
      
      if (firstNormalized === secondNormalized || 
          firstNormalized.includes(secondNormalized) || 
          secondNormalized.includes(firstNormalized)) {
        // Take the longer name as it's likely more complete
        return firstPart.length >= secondPart.length ? firstPart : secondPart;
      }
      
      // Special case for "Alex MittellAlex Mittell" - first and last name are repeated with no space
      const firstWords = firstPart.split(/\s+/);
      const secondWords = secondPart.split(/\s+/);
      
      if (firstWords.length >= 2 && secondWords.length >= 2) {
        const firstName = firstWords[0].toLowerCase();
        const secondFirst = secondWords[0].toLowerCase();
        
        // If first names match, this is likely a doubled name
        if (firstName === secondFirst) {
          return firstPart;
        }
      }
    }
    
    // Handle the specific pattern with emoji: "Name NameName Name![:emoji:]"
    const emojiMatch = usernameWithoutEmoji.match(/^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+\s+[A-Za-z]+)$/i);
    if (emojiMatch) {
      // Check if the two parts are the same name
      const name1 = emojiMatch[1].toLowerCase().replace(/\s+/g, '');
      const name2 = emojiMatch[2].toLowerCase().replace(/\s+/g, '');
      
      if (name1 === name2) {
        return emojiMatch[1].trim();
      }
      
      // Check if one is contained in the other (handles missing space cases)
      if (name1.includes(name2) || name2.includes(name1)) {
        // Return the longer name as it's likely more complete
        return emojiMatch[1].length >= emojiMatch[2].length ? 
          emojiMatch[1].trim() : emojiMatch[2].trim();
      }
    }
    
    // Handle exact repetition: "John Smith John Smith"
    const exactDupePattern = /^([A-Za-z]+\s+[A-Za-z]+)\s+\1$/i;
    const exactMatch = usernameWithoutEmoji.match(exactDupePattern);
    if (exactMatch) {
      return exactMatch[1];
    }
    
    // Handle no space between names: "John SmithJohn Smith" 
    const noSpacePattern = /^([A-Za-z]+)\s+([A-Za-z]+)([A-Za-z]+)\s+([A-Za-z]+)$/i;
    const noSpaceMatch = usernameWithoutEmoji.match(noSpacePattern);
    if (noSpaceMatch) {
      const firstName1 = noSpaceMatch[1].toLowerCase();
      const lastName1 = noSpaceMatch[2].toLowerCase();
      const firstName2 = noSpaceMatch[3].toLowerCase();
      const lastName2 = noSpaceMatch[4].toLowerCase();
      
      if (firstName1 === firstName2 && lastName1 === lastName2) {
        return `${noSpaceMatch[1]} ${noSpaceMatch[2]}`;
      }
    }
    
    // Handle partial match: "John SmithJohn"
    const partialPattern = /^([A-Za-z]+\s+[A-Za-z]+)([A-Za-z]+)$/i;
    const partialMatch = usernameWithoutEmoji.match(partialPattern);
    if (partialMatch) {
      const fullName = partialMatch[1].toLowerCase().replace(/\s+/g, '');
      const partial = partialMatch[2].toLowerCase();
      
      if (fullName.includes(partial)) {
        return partialMatch[1].trim();
      }
    }
    
    // Try to extract a name if all else fails
    const firstNamePattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)/;
    const nameMatch = usernameWithoutEmoji.match(firstNamePattern);
    if (nameMatch) {
      return nameMatch[1].trim();
    }
    
    return username.trim();
  }

  /**
   * Determines if a line is a standalone timestamp
   */
  public isTimeLine(line: string): boolean {
    return /^\s*\d{1,2}:\d{2}(?:\s?[AaPp]\.?[Mm]\.?)?\s*$/.test(line);
  }

  /**
   * Checks if a line represents a date header
   */
  public isDateLine(line: string): boolean {
    // Check for day names first (most reliable)
    const dayPattern = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i;
    
    if (dayPattern.test(line)) {
      return true;
    }
    
    // Check for month names
    const monthPattern = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i;
    if (!monthPattern.test(line)) return false;
    
    // Check for standard date format like "Feb 2, 2023"
    const standardDatePattern = /\b\d{1,2},?\s*\d{4}\b/i;
    
    // Check for Slack-style date like "Feb 6th at 7:47 PM"
    const slackDatePattern = /\b\d{1,2}(?:st|nd|rd|th)?\s+at\s+\d{1,2}:\d{2}\b/i;
    
    return standardDatePattern.test(line) || slackDatePattern.test(line);
  }

  /**
   * Parses a date line into a Date object
   */
  public parseDateLine(line: string): Date | null {
    try {
      // Handle "Today" and "Yesterday"
      if (/^Today$/i.test(line)) {
        return new Date();
      }
      
      if (/^Yesterday$/i.test(line)) {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date;
      }
      
      // Try to parse normal date formats
      // First clean up the string (remove suffixes like 1st, 2nd)
      const cleanDateStr = line.replace(/(\d+)(?:st|nd|rd|th)/i, '$1');
      const date = new Date(cleanDateStr);
      
      // Validate date is valid
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      return null;
    } catch (e) {
      console.error("Error parsing date:", e);
      return null;
    }
  }

  /**
   * Determines if a line is a Slack metadata line (thread info, reactions, etc.)
   */
  public isSlackMetadataLine(line: string): boolean {
    const metadataPatterns = [
      /^\d+ repl(?:y|ies)$/i,
      /^view (?:thread|replies)/i,
      /!?\[:[\w_-]+:\]\s*\d+/,     // emoji with number (reactions)
      /^\d+ files$/i,
      /^Load(?:ing)? \d+ more/i,
      /^Last reply/i,
      /^\s*This thread has/i
    ];
    
    return metadataPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Parses thread metadata from a line
   */
  public parseThreadMetadata(line: string): { isThreadInfo: boolean, replyCount?: number } {
    const replyCountMatch = line.match(/^(\d+) repl(?:y|ies)$/i);
    if (replyCountMatch) {
      return {
        isThreadInfo: true,
        replyCount: parseInt(replyCountMatch[1], 10)
      };
    }
    
    const viewThreadMatch = line.match(/^view (?:thread|replies)/i);
    if (viewThreadMatch) {
      return {
        isThreadInfo: true
      };
    }
    
    return {
      isThreadInfo: false
    };
  }

  /**
   * Determines if a line represents a system message
   */
  public isSystemMessage(line: string): boolean {
    const systemPatterns = [
      /joined #/i,
      /\s+left #/i,
      /\s+added to #/i,
      /^\d+ repl(?:y|ies)$/i,
      /^view (?:thread|replies)/i,
      /^Last reply/i,
      /^\d+ files$/i,
      /^Loading conversation/i,
      /^Last reply/i,
      /^\s*This thread has/i,
      /https:\/\/.*\.slack\.com\/archives\//i
    ];
    
    return systemPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if username looks valid
   */
  public isValidUsername(name: string): boolean {
    // Basic validation
    if (!name || name.length < 3) return false;
    
    // Check for doubled names like "Alex MittellAlex" and fix them first
    const potentialDoubledName = this.fixDuplicatedUsername(name);
    if (potentialDoubledName !== name) {
      // If the username can be fixed with fixDuplicatedUsername, use that result for validation
      name = potentialDoubledName;
    }
    
    // Now check for truly truncated names (just fragments)
    const nameParts = name.split(' ');
    const lastPart = nameParts[nameParts.length - 1];
    
    // Only consider it truncated if it's a very short fragment (1-2 chars)
    // and not a complete name/initial
    const isTruncated = lastPart.length <= 2 && 
                        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 
                         'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 
                         'Y', 'Z'].indexOf(lastPart) === -1;
    
    if (isTruncated) return false;
    
    return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(name) && 
           !name.includes('?') &&
           !name.includes('"') &&
           !name.includes(':') &&
           !name.startsWith('Message from') &&
           !name.includes('replied to') &&
           name !== 'Thread participant' &&
           name !== 'DATE_HEADER' &&
           name !== 'THREAD_DIVIDER';
  }
  
  /**
   * Checks if a block of text is likely from Slack
   */
  public isLikelySlack(text: string): boolean {
    this.debugLog("Checking if text is likely from Slack");
    
    if (!text || text.length < 20) {
      this.debugLog("Text too short for Slack content");
      return false;
    }
    
    // Check for clear Slack indicators
    if (text.includes('slack.com/archives/')) {
      this.debugLog("Found slack archive URL");
      return true;
    }
    if (text.includes('ca.slack-edge.com/')) {
      this.debugLog("Found slack edge URL");
      return true;
    }
    if (text.includes('emoji.slack-edge.com/') || text.includes('slack-edge.com/')) {
      this.debugLog("Found slack emoji URL");
      return true;
    }
    if (text.includes('files.slack.com/files-')) {
      this.debugLog("Found slack files URL");
      return true;
    }
    
    // Look for avatar patterns
    if (/!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)/i.test(text)) {
      this.debugLog("Found slack avatar pattern");
      return true;
    }
    
    // Look for emoji patterns
    if (/!?\[:[\w\-]+:\]/i.test(text)) {
      this.debugLog("Found emoji pattern with brackets and colon");
      return true;
    }
    if (text.includes("![:") || text.includes("](https://a.slack-edge.com/")) {
      this.debugLog("Found emoji with slack edge URL");
      return true;
    }
    
    // Look for timestamp format [HH:MM AM/PM]
    if (/\[\d{1,2}:\d{2}\s*(?:AM|PM)\]/i.test(text)) {
      this.debugLog("Found bracketed timestamp format");
      return true;
    }
    
    // Look for repeated username patterns (common in Slack copy-paste)
    if (/([A-Z][a-z]+\s+[A-Z][a-z]+)\1/i.test(text)) {
      this.debugLog("Found duplicated username pattern");
      return true;
    }
    
    // Look for duplicated names which can happen in slack
    const namePattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)([A-Z][a-z]+\s+[A-Z][a-z]+)/i;
    if (namePattern.test(text)) {
      this.debugLog("Found possible duplicated name pattern");
      return true;
    }
    
    // Look for thread metadata
    if (/Last reply (?:today|yesterday|\d+ days ago)/i.test(text)) {
      this.debugLog("Found thread metadata");
      return true;
    }
    
    if (/\d+ repl(?:y|ies)/i.test(text) && /View thread/i.test(text)) {
      this.debugLog("Found replies and view thread pattern");
      return true;
    }
    
    // Check for common patterns of multiple small avatar images in a row
    if (/!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\-\d+\)!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\-\d+\)/i.test(text)) {
      this.debugLog("Found multiple small avatars in sequence");
      return true;
    }
    
    // Check content more thoroughly by examining lines
    const lines = text.split('\n');
    let slackIndicators = 0;
    let messageHeaderCount = 0;
    let avatarImageCount = 0;
    let timestampCount = 0;
    
    for (let i = 0; i < Math.min(lines.length, 40); i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Count avatar images
      if (this.avatarImagePattern.test(line)) {
        avatarImageCount++;
        if (avatarImageCount >= 2) {
          this.debugLog("Found multiple avatar images");
          return true;
        }
      }
      
      // Check for message headers like "Username [Time]"
      if (/[A-Z][a-z]+\s+[A-Z][a-z]+\s+\[\d{1,2}:\d{2}\s*(?:AM|PM)\]/i.test(line)) {
        messageHeaderCount++;
        if (messageHeaderCount >= 2) {
          this.debugLog("Found multiple message headers");
          return true;
        }
      }
      
      // Check for timestamps
      if (this.timeRegex.test(line) || this.timeWithBracketsRegex.test(line)) {
        timestampCount++;
      }
      
      // Check for thread replies pattern
      if (/\d+ repl(?:y|ies)/i.test(line) || /View thread/i.test(line) || /Last reply/i.test(line)) {
        slackIndicators++;
      }
      
      // Check for image thumbnails
      if (line.includes('](https://files.slack.com/files-tmb/')) {
        this.debugLog("Found Slack file thumbnail link");
        return true;
      }
      
      // Added: Check for date headers (like "Friday, February 14th")
      if (/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,|\s+)[A-Za-z]+\s+\d+(?:st|nd|rd|th)?$/i.test(line)) {
        slackIndicators++;
      }
      
      // Check for reactions (emoji with numbers)
      if (/!?\[:[\w\-]+:\]\d+/i.test(line)) {
        this.debugLog("Found reaction pattern (emoji with number)");
        return true;
      }
    }
    
    // If we have enough indicators, it's likely Slack
    if (slackIndicators >= 2 || (slackIndicators >= 1 && (avatarImageCount > 0 || timestampCount > 1))) {
      this.debugLog("Found enough Slack indicators", { slackIndicators, avatarImageCount, timestampCount });
      return true;
    }
    
    // Last resort check: Does it have a pattern of small avatar thumbnails at the bottom of messages?
    // This is common in Slack when showing who reacted to a message
    const smallThumbnailPattern = /!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\-\d+\)/g;
    const thumbnailMatches = text.match(smallThumbnailPattern);
    if (thumbnailMatches && thumbnailMatches.length >= 3) {
      this.debugLog("Found multiple small avatar thumbnails");
      return true;
    }
    
    this.debugLog("Not identified as Slack content");
    return false;
  }

  /**
   * Fix time format to always display properly (AM/PM)
   * This handles cases where the time format is ambiguous or inconsistent
   */
  public normalizeTimeFormat(timeString: string): string {
    if (!timeString) return timeString;
    
    // First check if we have a valid time format with AM/PM
    const timePattern = /^(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?$/i;
    const match = timeString.match(timePattern);
    
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = match[2];
      let ampm = match[3];
      
      // If no AM/PM specified but hour is 0-11, assume AM; if 12-23, convert to 12-hour format PM
      if (!ampm) {
        if (hour >= 12) {
          // Convert 24-hour to 12-hour format
          const hour12 = hour === 12 ? 12 : hour - 12;
          ampm = 'PM';
          return `${hour12}:${minute} ${ampm}`;
        } else if (hour === 0) {
          // Special case for midnight
          return `12:${minute} AM`;
        } else {
          // Assume AM for morning hours without AM/PM
          return `${hour}:${minute} AM`;
        }
      } else {
        // Ensure consistent capitalization for AM/PM
        ampm = ampm.toUpperCase();
        return `${hour}:${minute} ${ampm}`;
      }
    }
    
    return timeString;
  }
}