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
 * Clean up immediately doubled usernames/names.
 * Handles various duplication patterns:
 * - "Alex MittellAlex Mittell" -> "Alex Mittell"
 * - "JohnJohn" -> "John"
 * - Case-insensitive duplicates
 * 
 * @param {string} text - The text containing potential doubled usernames
 * @returns {string} Text with doubled usernames cleaned up
 */
export function cleanupDoubledUsernames(text: string): string {
    try {
        // First pass: Handle exact duplicates with no space
        text = text.replace(/(\b[\w-]+(?:\s+[\w-]+)*)\1\b/g, '$1');
        
        // Second pass: Handle duplicates with space between
        text = text.replace(/(\b[\w-]+(?:\s+[\w-]+)*)\s+\1\b/g, '$1');
        
        // Third pass: Handle case-insensitive duplicates
        const words = text.split(/\s+/);
        const cleaned: string[] = [];
        
        for (let i = 0; i < words.length; i++) {
            const current = words[i];
            const next = words[i + 1];
            
            // Skip if current word equals next word (case-insensitive)
            if (next && current.toLowerCase() === next.toLowerCase()) {
                cleaned.push(current);
                i++; // Skip the duplicate
            } else {
                cleaned.push(current);
            }
        }
        
        return cleaned.join(' ');
    } catch (error) {
        Logger.warn('username-utils', 'cleanupDoubledUsernames error:', error);
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
        
        // First, clean up doubled usernames
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
 * Extract username from various formats.
 * Removes emoji codes, Unicode emoji, and trailing punctuation.
 * 
 * @param {string} text - The text containing a username with potential decorations
 * @returns {string} Clean username or "Unknown User" if empty
 * @example
 * extractUsername("John Doe :smile:") // "John Doe"
 * extractUsername("Jane 👋") // "Jane"
 * extractUsername("User123!!!") // "User123"
 */
export function extractUsername(text: string): string {
    try {
        // Remove emoji codes
        let cleaned = text.replace(/:[\w+-]+:/g, '').trim();
        
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