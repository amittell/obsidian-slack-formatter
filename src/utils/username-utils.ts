/**
 * Username handling utilities for Slack user mentions and formatting.
 * Provides functions for converting Slack user mentions to Obsidian wikilinks,
 * cleaning up doubled usernames, and formatting usernames for display.
 * @module username-utils
 */
import { Logger } from './logger';
import { removeAllEmoji } from './emoji-utils';

/**
 * Replace Slack user mentions with wiki links.
 * Handles multiple mention formats:
 * - <@U123ABC> - User ID format
 * - @username - Direct mention format
 * - <@username> - Username without ID
 * - <!channel>, <!here>, <!everyone> - Special mentions
 * 
 * @param {string} text - The text containing user mentions
 * @param {Record<string, string>} userMap - Map of user IDs to display names
 * @returns {string} Text with mentions converted to [[wikilinks]] or **bold** for special mentions
 */
export function formatUserMentions(text: string, userMap: Record<string, string>): string {
    try {
        // Handle <@U123ABC> format (user IDs)
        text = text.replace(/<@(U[A-Z0-9]+)>/g, (match, userId) => {
            try {
                const username = userMap[userId];
                if (username && username.trim()) {
                    // Check if already wiki-linked
                    if (/^\[\[.*\]\]$/.test(username)) {
                        return username;
                    }
                    // Sanitize username for Obsidian links
                    const sanitized = sanitizeForWikiLink(username);
                    return `[[${sanitized}]]`;
                }
                // Fallback: readable user reference
                return `[[User-${userId.substring(0, 6)}]]`;
            } catch {
                return match;
            }
        });
        
        // Handle @username mentions (careful with emails)
        text = text.replace(/(?<![[@\w])@(\w+)(?![@\w])/g, (match, username, offset, string) => {
            try {
                // Check context to avoid emails
                const beforeChar = offset > 0 ? string[offset - 1] : '';
                const afterChar = offset + match.length < string.length ? string[offset + match.length] : '';
                
                // Skip if it looks like part of an email
                if (beforeChar.match(/[\w.]/) || afterChar === '.' || afterChar === '@') {
                    return match;
                }
                
                const sanitized = sanitizeForWikiLink(username);
                return `[[${sanitized}]]`;
            } catch {
                return match;
            }
        });
        
        // Handle <@username> format (username without ID)
        text = text.replace(/<@(\w+)>/g, (match, username) => {
            try {
                const sanitized = sanitizeForWikiLink(username);
                return `[[${sanitized}]]`;
            } catch {
                return match;
            }
        });
        
        // Handle [@username](url) format (markdown-style Slack mentions)
        text = text.replace(/\[@(\w+)\]\(https?:\/\/[^)]+\)/g, (match, username) => {
            try {
                const sanitized = sanitizeForWikiLink(username);
                return `[[${sanitized}]]`;
            } catch {
                return match;
            }
        });
        
        // Handle special Slack mentions <!channel>, <!here>, <!everyone>
        text = text.replace(/<!([a-z]+)(?:\|([^>]+))?>/g, (match, type, label) => {
            const display = label || `@${type}`;
            switch (type) {
                case 'channel':
                case 'here':
                case 'everyone':
                    return `**${display}**`; // Bold instead of wiki link
                default:
                    return display;
            }
        });
        
        return text;
    } catch (error) {
        Logger.warn('username-utils', 'formatUserMentions error:', error);
        return text; // Return original on catastrophic failure
    }
}

/**
 * Sanitize username for use in wiki links.
 * Removes characters that are invalid in Obsidian links.
 * @private
 * @param {string} username - The username to sanitize
 * @returns {string} Sanitized username safe for wiki links (max 100 chars)
 */
function sanitizeForWikiLink(username: string): string {
    return username
        .trim()
        .replace(/[[\]|#^<>]/g, '') // Remove invalid characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .slice(0, 100); // Limit length
}
 
/**
 * Message format types for format-aware username processing
 */
export enum MessageFormat {
    DM = 'dm',           // Direct message format: timestamp first, then username
    THREAD = 'thread',   // Thread format: username first, then timestamp
    UNKNOWN = 'unknown'  // Unknown format, use default behavior
}

/**
 * Clean up immediately doubled usernames/names with format awareness.
 * Handles various duplication patterns:
 * - "Alex MittellAlex Mittell" -> "Alex Mittell" (DM format)
 * - "Bill MeiBill Mei![:emoji:](url)" -> "Bill Mei" (Thread format)
 * - "JohnJohn" -> "John"
 * - Case-insensitive duplicates
 * 
 * @param {string} text - The text containing potential doubled usernames
 * @param {MessageFormat} [format] - The message format context for enhanced processing
 * @returns {string} Text with doubled usernames cleaned up
 */
export function cleanupDoubledUsernames(text: string, format?: MessageFormat): string {
    try {
        let cleaned = text;
        
        // Handle format-specific patterns first
        if (format === MessageFormat.THREAD) {
            // Thread format: username may have emoji codes that need preservation during cleanup
            // Pattern: "Bill MeiBill Mei![:emoji:](url)" -> "Bill Mei"
            cleaned = cleanupThreadFormatUsername(cleaned);
        } else if (format === MessageFormat.DM) {
            // DM format: straightforward doubled username cleanup
            // Pattern: "Alex MittellAlex Mittell" -> "Alex Mittell" 
            cleaned = cleanupDMFormatUsername(cleaned);
        }
        
        // First pass: Handle exact duplicates with no space (e.g., "Amy BritoAmy Brito")
        cleaned = cleaned.replace(/(\b[\w-]+(?:\s+[\w-]+)*)\1\b/g, '$1');
        
        // Second pass: Handle duplicates with space between (e.g., "Amy Brito Amy Brito")
        cleaned = cleaned.replace(/(\b[\w-]+(?:\s+[\w-]+)*)\s+\1\b/g, '$1');
        
        // Third pass: Handle more complex patterns with Unicode characters (accented names)
        cleaned = cleaned.replace(/(\b[\w\u00C0-\u017F-]+(?:\s+[\w\u00C0-\u017F-]+)*)\1\b/g, '$1');
        
        // Fourth pass: Handle patterns where first/last name parts are doubled separately
        // e.g., "John JohnSmith Smith" -> "John Smith"
        cleaned = cleaned.replace(/(\b[\w\u00C0-\u017F-]+)\s+\1(\b[\w\u00C0-\u017F-]+)\s+\2\b/g, '$1 $2');
        
        // Fifth pass: Handle case-insensitive duplicates
        const words = cleaned.split(/\s+/);
        const cleanedWords: string[] = [];
        
        for (let i = 0; i < words.length; i++) {
            const current = words[i];
            const next = words[i + 1];
            
            // Skip if current word equals next word (case-insensitive)
            if (next && current.toLowerCase() === next.toLowerCase()) {
                cleanedWords.push(current);
                i++; // Skip the duplicate
            } else {
                cleanedWords.push(current);
            }
        }
        
        return cleanedWords.join(' ');
    } catch (error) {
        Logger.warn('username-utils', 'cleanupDoubledUsernames error:', error);
        return text;
    }
}

/**
 * Clean up usernames in thread format where emojis appear after doubled username.
 * Pattern: "Bill MeiBill Mei![:emoji:](url)" -> "Bill Mei"
 * @private
 * @param {string} text - Text containing thread format username
 * @returns {string} Cleaned username
 */
function cleanupThreadFormatUsername(text: string): string {
    try {
        // Pattern for thread format: "FirstnameLastnameFirstnameLastname![:emoji:](url)"
        // We want to extract just "FirstnameLastname" before the emoji
        
        // First, identify if we have the doubled pattern followed by emoji
        const threadPattern = /^(.+?)(\1)(!?\[:[\w\-+]+:\]\([^)]+\).*)$/;
        const match = text.match(threadPattern);
        
        if (match && match[1] && match[3]) {
            // We found a doubled username followed by emoji - keep just the first instance
            return match[1].trim();
        }
        
        // Alternative pattern: Look for doubled name followed by emoji without perfect duplication
        // Handle cases where there might be slight differences in the doubled part
        const nameEmojiPattern = /^([A-Za-z\s\u00C0-\u017F]+)\1(!?\[:[\w\-+]+:\]\([^)]+\).*)$/;
        const nameEmojiMatch = text.match(nameEmojiPattern);
        
        if (nameEmojiMatch && nameEmojiMatch[1]) {
            return nameEmojiMatch[1].trim();
        }
        
        // If no specific pattern found, just remove emoji and return
        const emojiRemoved = text.replace(/!?\[:[\w\-+]+:\]\([^)]+\)/g, '').trim();
        
        // Try basic doubled name cleanup on the emoji-free version
        const basicDoubled = emojiRemoved.match(/^(.+?)\1$/);
        if (basicDoubled && basicDoubled[1]) {
            return basicDoubled[1].trim();
        }
        
        return emojiRemoved;
    } catch (error) {
        Logger.warn('username-utils', 'cleanupThreadFormatUsername error:', error);
        return text;
    }
}

/**
 * Clean up usernames in DM format which are typically straightforward doubled names.
 * Pattern: "Alex MittellAlex Mittell" -> "Alex Mittell"
 * @private
 * @param {string} text - Text containing DM format username
 * @returns {string} Cleaned username
 */
function cleanupDMFormatUsername(text: string): string {
    try {
        // DM format is typically cleaner - just doubled names without emojis
        // Pattern: "FirstnameLastnameFirstnameLastname" -> "FirstnameLastname"
        
        // Check for exact duplication pattern
        const exactMatch = text.match(/^(.+?)\1$/);
        if (exactMatch && exactMatch[1]) {
            return exactMatch[1].trim();
        }
        
        // Check for spaced duplication: "Name Name" -> "Name"
        const spacedMatch = text.match(/^(.+?)\s+\1$/);
        if (spacedMatch && spacedMatch[1]) {
            return spacedMatch[1].trim();
        }
        
        return text;
    } catch (error) {
        Logger.warn('username-utils', 'cleanupDMFormatUsername error:', error);
        return text;
    }
}

/**
 * Format username for display with improved title casing.
 * Preserves existing camelCase patterns and applies smart title casing.
 * Handles underscores, hyphens, and common prepositions.
 * 
 * @param {string} username - The username to format
 * @returns {string} Formatted username with proper casing
 * @example
 * formatUsername("john_doe") // "John Doe"
 * formatUsername("johnDoe") // "johnDoe" (preserves camelCase)
 * formatUsername("JOHN-DOE") // "John Doe"
 */
export function formatUsername(username: string): string {
    try {
        // Handle empty string input - return as-is
        if (!username || username.trim().length === 0) {
            return username;
        }
        
        // First, clean up doubled usernames (no format context available in this function)
        let cleaned = cleanupDoubledUsernames(username);
        
        // Remove all emojis (including custom Slack emoji images, codes, and Unicode)
        cleaned = removeAllEmoji(cleaned);
        
        // Remove URLs (both markdown and plain)
        cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, ''); // Remove image links
        cleaned = cleaned.replace(/\[.*?\]\(.*?\)/g, ''); // Remove markdown links
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, ''); // Remove plain URLs
        
        // Remove any remaining URL artifacts or special characters
        cleaned = cleaned.replace(/[<>]/g, ''); // Remove angle brackets
        cleaned = cleaned.replace(/\|/g, ' '); // Replace pipes with spaces
        
        // Remove trailing punctuation
        cleaned = cleaned.replace(/[.,;:!?]+$/, '');
        
        // Clean and trim
        cleaned = cleaned.trim().replace(/^[_\s-]+|[_\s-]+$/g, '');
        
        // If cleaning removed everything from a non-empty input, return fallback
        if (!cleaned) return 'Unknown User';
        
        // Preserve camelCase and existing capitalization patterns
        if (/[a-z][A-Z]/.test(cleaned)) {
            // Has camelCase, just clean it up
            return cleaned.replace(/[_-]+/g, ' ').trim();
        }
        
        // Otherwise apply title casing
        return cleaned
            .split(/[_\s-]+/)
            .filter(part => part.length > 0)
            .map((part, index) => {
                // Don't capitalize certain words unless they're first
                const lowercaseWords = ['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for'];
                if (index > 0 && lowercaseWords.includes(part.toLowerCase())) {
                    return part.toLowerCase();
                }
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            })
            .join(' ');
    } catch (error) {
        Logger.warn('username-utils', 'formatUsername error:', error);
        return username; // Return original on error
    }
}

/**
 * Extract username from various formats with format awareness.
 * Removes emoji codes, Unicode emoji, and trailing punctuation.
 * 
 * @param {string} text - The text containing a username with potential decorations
 * @param {MessageFormat} [format] - The message format context for enhanced processing
 * @returns {string} Clean username or "Unknown User" if empty
 * @example
 * extractUsername("John Doe :smile:") // "John Doe"
 * extractUsername("Jane 👋") // "Jane"
 * extractUsername("User123!!!") // "User123"
 * extractUsername("Bill MeiBill Mei![:emoji:](url)", MessageFormat.THREAD) // "Bill Mei"
 */
export function extractUsername(text: string, format?: MessageFormat): string {
    try {
        let cleaned = text;
        
        // Apply format-aware cleaning first
        if (format) {
            cleaned = cleanupDoubledUsernames(cleaned, format);
        }
        
        // Remove emoji codes (preserve during format-aware processing above)
        cleaned = cleaned.replace(/:[\w+-]+:/g, '').trim();
        
        // Remove Slack emoji URLs
        cleaned = cleaned.replace(/!\[:[\w\-+]+:\]\([^)]+\)/g, '').trim();
        
        // Remove Unicode emoji
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        
        // Remove trailing punctuation
        cleaned = cleaned.replace(/[.,;:!?]+$/, '').trim();
        
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        return cleaned || 'Unknown User';
    } catch (error) {
        Logger.warn('username-utils', 'extractUsername error:', error);
        return text;
    }
}

/**
 * Extract username from thread format line.
 * Handles patterns like "Bill MeiBill Mei![:emoji:](url) [timestamp](url)"
 * 
 * @param {string} line - The thread format line containing username and timestamp
 * @returns {string} Extracted username or "Unknown User" if not found
 */
export function extractUsernameFromThreadFormat(line: string): string {
    try {
        // Thread format pattern: "Username![:emoji:](url) [timestamp](url)"
        // Extract everything before the timestamp link
        const beforeTimestamp = line.split(/\s+\[.*?\]\(https?:\/\/[^)]+\)$/)[0];
        
        if (beforeTimestamp && beforeTimestamp !== line) {
            return extractUsername(beforeTimestamp.trim(), MessageFormat.THREAD);
        }
        
        // If no timestamp link found, this might not be thread format
        // Check if it has the expected structure
        if (!/\[.*?\]\(https?:\/\/[^)]+\)/.test(line)) {
            return 'Unknown User';
        }
        
        // Fallback: try to extract username from the full line
        return extractUsername(line, MessageFormat.THREAD);
    } catch (error) {
        Logger.warn('username-utils', 'extractUsernameFromThreadFormat error:', error);
        return 'Unknown User';
    }
}

/**
 * Extract username from DM format context.
 * In DM format, username appears after standalone timestamp.
 * 
 * @param {string} line - The line containing the username (should be after timestamp)
 * @returns {string} Extracted username or "Unknown User" if not found
 */
export function extractUsernameFromDMFormat(line: string): string {
    try {
        const trimmed = line.trim();
        
        // Handle multi-person DM specific patterns
        // Pattern: "UserNameUserName  [timestamp](url)" 
        const multiPersonDMPattern = /^([A-Za-z\s\u00C0-\u017F]+)\1\s+\[\d{1,2}:\d{2}\s*(?:AM|PM)?\]\(https:\/\/.*\/archives\/[CD][A-Z0-9]+\/p\d+\)/;
        const multiPersonMatch = trimmed.match(multiPersonDMPattern);
        
        if (multiPersonMatch && multiPersonMatch[1]) {
            // Found doubled username pattern - extract the first occurrence
            const username = multiPersonMatch[1].trim();
            return extractUsername(username, MessageFormat.DM);
        }
        
        // Pattern: "AmyAmy BritoBrito [timestamp]" - split doubled pattern
        const splitDoubledPattern = /^([A-Za-z]+)\1([A-Za-z\s]+)\2\s+\[\d{1,2}:\d{2}/;
        const splitMatch = trimmed.match(splitDoubledPattern);
        
        if (splitMatch && splitMatch[1] && splitMatch[2]) {
            // Reconstruct the full name from the split doubled parts
            const fullName = splitMatch[1] + splitMatch[2];
            return extractUsername(fullName, MessageFormat.DM);
        }
        
        // Check if line has timestamp - if so, extract username part before it
        const usernameTimestampPattern = /^(.+?)\s+\[\d{1,2}:\d{2}/;
        const timestampMatch = trimmed.match(usernameTimestampPattern);
        
        if (timestampMatch && timestampMatch[1]) {
            // Extract username part before timestamp
            return extractUsername(timestampMatch[1], MessageFormat.DM);
        }
        
        // Fallback: DM format username is typically clean but may be doubled
        return extractUsername(trimmed, MessageFormat.DM);
    } catch (error) {
        Logger.warn('username-utils', 'extractUsernameFromDMFormat error:', error);
        return 'Unknown User';
    }
}

/**
 * Detect message format based on line content.
 * Analyzes patterns to determine if this is DM or Thread format.
 * 
 * @param {string} line - The line to analyze
 * @returns {MessageFormat} Detected format or UNKNOWN
 */
export function detectMessageFormat(line: string): MessageFormat {
    try {
        // Check for thread format pattern: username + emoji + timestamp
        if (/^.+!?\[:[\w\-+]+:\]\([^)]+\)\s+\[.*?\]\(https?:\/\/[^)]+\)/.test(line)) {
            return MessageFormat.THREAD;
        }
        
        // Check for standalone timestamp (DM format indicator)
        if (/^\[.*?\]\(https?:\/\/[^)]+\)$/.test(line.trim())) {
            return MessageFormat.DM;
        }
        
        // Check for combined username + timestamp without emoji (could be either)
        if (/^.+\s+\[.*?\]\(https?:\/\/[^)]+\)$/.test(line)) {
            // If it has emoji patterns, likely thread format
            if (/!?\[:[\w\-+]+:\]\([^)]+\)/.test(line)) {
                return MessageFormat.THREAD;
            }
            // Otherwise could be either, default to thread since it's more complex
            return MessageFormat.THREAD;
        }
        
        return MessageFormat.UNKNOWN;
    } catch (error) {
        Logger.warn('username-utils', 'detectMessageFormat error:', error);
        return MessageFormat.UNKNOWN;
    }
}