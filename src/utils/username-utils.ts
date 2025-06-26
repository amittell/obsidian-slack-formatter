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
    CHANNEL = 'channel', // Channel format: similar to thread but with different patterns
    APP = 'app',         // App message format: (https://app.slack.com/services/...)AppName
    UNKNOWN = 'unknown'  // Unknown format, use default behavior
}

/**
 * Username validation configuration
 */
export const USERNAME_CONFIG = {
    MIN_LENGTH: 1,
    MAX_LENGTH: 10000, // Significantly increased to handle very long usernames
    MAX_WORDS: 1000, // Significantly increased to handle very long usernames
    INVALID_NAMES: new Set([
        'unknown user', 'unknown', 'user', 'bot', 'slack', 'app',
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
        'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ])
} as const;

/**
 * App message pattern configurations
 */
export const APP_MESSAGE_PATTERNS = {
    /** Pattern for app messages with URL prefix - fixed to not capture spaces in app name */
    URL_PREFIX: /^\s*\(https?:\/\/[^)]+\)([A-Za-z][A-Za-z0-9\-_.]*)/,
    /** Pattern for app messages without parentheses - fixed to not capture spaces in app name */
    NO_PARENS: /^\s*https?:\/\/[^\s]+\s+([A-Za-z][A-Za-z0-9\-_.]*)/,
    /** Pattern for app services URLs */
    SERVICES_URL: /https?:\/\/[^\s\/]*slack[^\s\/]*\/services\/[A-Z0-9]+/,
    /** Pattern for doubled app names */
    DOUBLED_APP: /^([A-Za-z][A-Za-z0-9\s\-_.]+)\1\s*(?:APP\s*)?/i
} as const;

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
        
        // For very long strings, use simpler doubled detection to avoid regex performance issues
        if (text.length > 500) {
            const halfLength = Math.floor(text.length / 2);
            const firstHalf = text.substring(0, halfLength);
            const secondHalf = text.substring(halfLength);
            
            // Simple check: if first half equals second half, return first half
            if (firstHalf === secondHalf) {
                cleaned = firstHalf;
                // Return early to avoid expensive regex operations on long strings
                return removeEmojisFromText(cleaned);
            }
        }
        
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
        
        // Define comprehensive character class for international names
        const nameChars = '[a-zA-Z0-9\\u00C0-\\u017F\\u0100-\\u024F\\u1E00-\\u1EFF\\u0400-\\u04FF\\u4E00-\\u9FFF\\u3040-\\u309F\\u30A0-\\u30FF\\u0590-\\u05FF\\u0600-\\u06FF\'-]';
        
        // First pass: Handle exact duplicates with no space (e.g., "Amy BritoAmy Brito", "李伟李伟")
        const exactDuplicatePattern = new RegExp(`(\\b${nameChars}+(?:\\s+${nameChars}+)*)\\1\\b`, 'g');
        cleaned = cleaned.replace(exactDuplicatePattern, '$1');
        
        // Second pass: Handle duplicates with space between (e.g., "Amy Brito Amy Brito")
        const spacedDuplicatePattern = new RegExp(`(\\b${nameChars}+(?:\\s+${nameChars}+)*)\\s+\\1\\b`, 'g');
        cleaned = cleaned.replace(spacedDuplicatePattern, '$1');
        
        // Third pass: Handle patterns where first/last name parts are doubled separately
        // e.g., "John JohnSmith Smith" -> "John Smith"
        const separatedPartsPattern = new RegExp(`(\\b${nameChars}+)\\s+\\1(\\b${nameChars}+)\\s+\\2\\b`, 'g');
        cleaned = cleaned.replace(separatedPartsPattern, '$1 $2');
        
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
        
        let result = cleanedWords.join(' ');
        
        // Final cleanup: Remove emojis that may remain after username deduplication
        result = removeEmojisFromText(result);
        
        // Clean up any double spaces that may have been created
        result = result.replace(/\s+/g, ' ').trim();
        
        return result;
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
        const threadPattern = /^(.+?)(\1)(!?\[:[\w\-+]+:\]\([^)]+\))(.*)$/;
        const match = text.match(threadPattern);
        
        if (match && match[1] && match[3]) {
            // We found a doubled username followed by emoji - keep the first instance plus any trailing text
            const username = match[1].trim();
            const trailingText = match[4] ? match[4].trim() : '';
            return trailingText ? `${username} ${trailingText}` : username;
        }
        
        // Alternative pattern: Look for doubled name followed by emoji without perfect duplication
        // Handle cases where there might be slight differences in the doubled part
        const nameEmojiPattern = /^([A-Za-z\s\u00C0-\u017F]+)\1(!?\[:[\w\-+]+:\]\([^)]+\))(.*)$/;
        const nameEmojiMatch = text.match(nameEmojiPattern);
        
        if (nameEmojiMatch && nameEmojiMatch[1]) {
            const username = nameEmojiMatch[1].trim();
            const trailingText = nameEmojiMatch[3] ? nameEmojiMatch[3].trim() : '';
            return trailingText ? `${username} ${trailingText}` : username;
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
 * Enhanced username extraction with comprehensive format awareness and validation.
 * Handles app messages, doubled usernames, emoji removal, and edge cases.
 * 
 * @param {string} text - The text containing a username with potential decorations
 * @param {MessageFormat} [format] - The message format context for enhanced processing
 * @returns {string} Clean username or "Unknown User" if invalid
 * @example
 * extractUsername("John Doe :smile:") // "John Doe"
 * extractUsername("Jane 👋") // "Jane"
 * extractUsername("User123!!!") // "User123"
 * extractUsername("Bill MeiBill Mei![:emoji:](url)", MessageFormat.THREAD) // "Bill Mei"
 * extractUsername(" (https://app.slack.com/services/B123)GitHub", MessageFormat.APP) // "GitHub"
 */
export function extractUsername(text: string, format?: MessageFormat): string {
    try {
        if (!text || typeof text !== 'string') {
            return 'Unknown User';
        }

        let cleaned = text.trim();
        
        // Handle app message format first
        if (format === MessageFormat.APP || isAppMessage(cleaned)) {
            const appUsername = extractAppUsername(cleaned);
            if (appUsername && isValidUsername(appUsername)) {
                return normalizeUsername(appUsername);
            }
        }
        
        // Apply format-aware cleaning and emoji removal
        if (format) {
            cleaned = cleanupDoubledUsernames(cleaned, format);
        } else {
            // Apply basic doubled username cleanup even without format
            cleaned = cleanupDoubledUsernames(cleaned);
        }
        
        // Remove all types of emoji and decorations
        cleaned = removeAllDecorations(cleaned);
        
        // Normalize and validate
        const normalized = normalizeUsername(cleaned);
        
        return isValidUsername(normalized) ? normalized : 'Unknown User';
    } catch (error) {
        Logger.warn('username-utils', 'extractUsername error:', error);
        return text || 'Unknown User';
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
 * Analyzes patterns to determine if this is DM, Thread, App, or Channel format.
 * 
 * @param {string} line - The line to analyze
 * @returns {MessageFormat} Detected format or UNKNOWN
 */
export function detectMessageFormat(line: string): MessageFormat {
    try {
        // Check for app message format first
        if (isAppMessage(line)) {
            return MessageFormat.APP;
        }
        
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

/**
 * Check if text represents an app message
 */
export function isAppMessage(text: string): boolean {
    return APP_MESSAGE_PATTERNS.URL_PREFIX.test(text) ||
           APP_MESSAGE_PATTERNS.NO_PARENS.test(text) ||
           APP_MESSAGE_PATTERNS.SERVICES_URL.test(text);
}

/**
 * Extract username from app message format
 */
export function extractAppUsername(text: string): string {
    try {
        // Pattern 1: (https://app.slack.com/services/...)AppName
        let match = text.match(APP_MESSAGE_PATTERNS.URL_PREFIX);
        if (match && match[1]) {
            return match[1].trim();
        }
        
        // Pattern 2: https://app.slack.com/services/... AppName (no parentheses)
        match = text.match(APP_MESSAGE_PATTERNS.NO_PARENS);
        if (match && match[1]) {
            return match[1].trim();
        }
        
        // Pattern 3: Handle doubled app names like "GitHubGitHub APP"
        match = text.match(APP_MESSAGE_PATTERNS.DOUBLED_APP);
        if (match && match[1]) {
            return match[1].trim();
        }
        
        return text.trim();
    } catch (error) {
        Logger.warn('username-utils', 'extractAppUsername error:', error);
        return text;
    }
}

/**
 * Remove emoji codes and Unicode emojis from text
 * @private
 */
function removeEmojisFromText(text: string): string {
    try {
        let cleaned = text;
        
        // Remove emoji codes (:smile:, :+1::skin-tone-2:, and consecutive patterns like :smile::heart:)
        cleaned = cleaned.replace(/:[\w+-]+:(?::[\w-]+:)?/g, '').trim();
        // Handle consecutive emoji codes without separators
        cleaned = cleaned.replace(/(?::[\w+-]+:)+/g, '').trim();
        
        // Remove Slack emoji URLs (both with and without emoji codes)
        cleaned = cleaned.replace(/!\[:[\w\-+]+:\]\([^)]+\)/g, '').trim();
        cleaned = cleaned.replace(/!\[\]\([^)]+\)/g, '').trim(); // Empty emoji links ![](url)
        
        // Remove Unicode emoji (comprehensive range)
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}]/gu, '').trim();
        
        return cleaned.trim();
    } catch (error) {
        Logger.warn('username-utils', 'removeEmojisFromText error:', error);
        return text;
    }
}

/**
 * Remove all decorations (emoji, URLs, special chars) from username
 */
export function removeAllDecorations(text: string): string {
    try {
        let cleaned = text;
        
        // Remove emoji codes (:smile:, :+1::skin-tone-2:, and consecutive patterns like :smile::heart:)
        cleaned = cleaned.replace(/:[\w+-]+:(?::[\w-]+:)?/g, '').trim();
        // Handle consecutive emoji codes without separators
        cleaned = cleaned.replace(/(?::[\w+-]+:)+/g, '').trim();
        
        // Remove Slack emoji URLs (both with and without emoji codes)
        cleaned = cleaned.replace(/!\[:[\w\-+]+:\]\([^)]+\)/g, '').trim();
        cleaned = cleaned.replace(/!\[\]\([^)]+\)/g, '').trim(); // Empty emoji links ![](url)
        
        // Remove Unicode emoji (comprehensive range)
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}]/gu, '').trim();
        
        // Remove URLs (both markdown and plain)
        cleaned = cleaned.replace(/!?\[.*?\]\(.*?\)/g, ''); // Remove markdown links
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, ''); // Remove plain URLs
        
        // Remove special characters and artifacts
        cleaned = cleaned.replace(/[<>|]/g, ''); // Remove angle brackets and pipes  
        cleaned = cleaned.replace(/\s*APP\s*/gi, ' '); // Remove APP indicator
        
        // Remove remaining special characters but preserve word boundaries and international characters
        // Updated to preserve international characters including CJK, Cyrillic, Hebrew, Arabic
        cleaned = cleaned.replace(/[^a-zA-Z0-9\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0590-\u05FF\u0600-\u06FF\s\-_.']/g, ' ');
        
        // Remove trailing punctuation
        cleaned = cleaned.replace(/[.,;:!?]+$/, '').trim();
        
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        return cleaned.trim();
    } catch (error) {
        Logger.warn('username-utils', 'removeAllDecorations error:', error);
        return text;
    }
}

/**
 * Normalize username with consistent formatting
 */
export function normalizeUsername(username: string): string {
    try {
        if (!username || typeof username !== 'string') {
            return '';
        }
        
        let normalized = username.trim();
        
        // Remove leading/trailing special characters but keep internal ones for now
        // Updated to preserve international characters and apostrophes
        // Added CJK (Chinese, Japanese, Korean) ranges and Cyrillic
        normalized = normalized.replace(/^[^a-zA-Z0-9\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0590-\u05FF\u0600-\u06FF]+|[^a-zA-Z0-9\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0590-\u05FF\u0600-\u06FF\s']+$/g, '');
        
        // Remove non-alphanumeric characters except spaces, hyphens, underscores, dots, apostrophes, parentheses
        // Updated to preserve international characters including:
        // - Latin Extended (Latin-1 Supplement, Latin Extended-A/B, Latin Extended Additional)
        // - Cyrillic, CJK (Chinese/Japanese/Korean), Hebrew, Arabic
        normalized = normalized.replace(/[^a-zA-Z0-9\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0590-\u05FF\u0600-\u06FF\s\-_.'()]/g, ' ');
        
        // Clean up internal spaces
        normalized = normalized.replace(/\s+/g, ' ');
        
        // Apply length limits
        if (normalized.length > USERNAME_CONFIG.MAX_LENGTH) {
            normalized = normalized.substring(0, USERNAME_CONFIG.MAX_LENGTH).trim();
        }
        
        return normalized;
    } catch (error) {
        Logger.warn('username-utils', 'normalizeUsername error:', error);
        return username;
    }
}

/**
 * Validate username against quality rules
 */
export function isValidUsername(username: string): boolean {
    try {
        if (!username || typeof username !== 'string') {
            return false;
        }
        
        const normalized = username.toLowerCase().trim();
        
        // Check length
        if (normalized.length < USERNAME_CONFIG.MIN_LENGTH || normalized.length > USERNAME_CONFIG.MAX_LENGTH) {
            return false;
        }
        
        // Check for invalid names
        if (USERNAME_CONFIG.INVALID_NAMES.has(normalized)) {
            return false;
        }
        
        // Check word count
        const words = normalized.split(/\s+/).filter(word => word.length > 0);
        if (words.length > USERNAME_CONFIG.MAX_WORDS) {
            return false;
        }
        
        // Check for obvious non-names
        if (/^\d+$/.test(normalized)) { // All numbers
            return false;
        }
        
        // Check if has no letters (including international characters)
        // Updated to recognize international letters
        if (/^[^a-zA-Z\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0590-\u05FF\u0600-\u06FF]+$/.test(normalized)) {
            return false;
        }
        
        // Check for time patterns
        if (/^\d{1,2}:\d{2}/.test(normalized)) {
            return false;
        }
        
        return true;
    } catch (error) {
        Logger.warn('username-utils', 'isValidUsername error:', error);
        return false;
    }
}