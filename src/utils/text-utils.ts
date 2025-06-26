/**
 * Text processing utilities for Slack message formatting.
 * Handles code blocks, thread links, and URL conversions.
 * @module text-utils
 */
import { Logger } from './logger';

/**
 * Convert code blocks to Markdown format.
 * Ensures proper triple-backtick formatting with language specifiers.
 * @param {string} text - The text containing potential code blocks
 * @returns {string} Text with properly formatted Markdown code blocks
 */
export function formatCodeBlocks(text: string): string {
    const lines = text.split('\n');
    let inCodeBlock = false;
    let language = '';

    return lines.map(line => {
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                language = line.slice(3).trim();
                inCodeBlock = true;
                return '```' + language;
            } else {
                inCodeBlock = false;
                return '```';
            }
        }
        return line;
    }).join('\n');
}

/**
 * Process thread links with proper formatting.
 * Converts "View thread: <url>" to Markdown link format.
 * @param {string} text - The text containing thread links
 * @returns {string} Text with thread links converted to [View thread](url)
 */
export function formatThreadLinks(text: string): string {
    // Make the space after the colon optional using \s*
    return text.replace(
        /View thread:\s*(https:\/\/[^\s]+)/g,
        '[View thread]($1)'
    );
}
 
 
/**
 * Normalize whitespace in text while preserving structure.
 * @param text - The text to normalize
 * @returns Text with normalized whitespace
 */
export function normalizeWhitespace(text: string): string {
    return text
        .replace(/\t/g, ' ')                    // Convert tabs to spaces
        .replace(/\u00A0/g, ' ')                // Convert non-breaking spaces to regular spaces
        .replace(/ {2,}/g, ' ')                 // Replace multiple spaces with single space
        .replace(/^\s+|\s+$/g, '');             // Remove leading/trailing whitespace
}

/**
 * Clean text by removing unwanted characters and normalizing whitespace.
 * @param text - The text to clean
 * @returns Cleaned text
 */
export function cleanText(text: string): string {
    return text
        .replace(/\t/g, ' ')                    // Convert tabs to spaces
        .replace(/\u00A0/g, ' ')                // Convert non-breaking spaces to regular spaces
        .replace(/ {2,}/g, ' ')                 // Replace multiple spaces with single space
        .replace(/\r\n|\r/g, '\n')              // Normalize line endings
        .replace(/^\s+|\s+$/g, '');             // Remove leading/trailing whitespace
}

/**
 * Validate if text is considered valid (not empty or whitespace-only).
 * @param text - The text to validate
 * @returns True if text is valid
 */
export function isValidText(text: string): boolean {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    // Check if text is only whitespace or control characters
    const cleanedText = text.replace(/[\s\u0000-\u001F]/g, '');
    return cleanedText.length > 0;
}

/**
 * Convert Slack URLs to Markdown format with error handling.
 * Handles multiple formats:
 * - <url|text> -> [text](url)
 * - <url> -> url
 * - &lt;url&gt; (HTML encoded)
 * - mailto: links
 * - Malformed URLs (missing protocol)
 * 
 * @param {string} text - The text containing Slack-formatted URLs
 * @returns {string} Text with URLs converted to Markdown format
 * @example
 * formatSlackUrlSyntax("<https://example.com|Example>") // "[Example](https://example.com)"
 * formatSlackUrlSyntax("<https://example.com>") // "https://example.com"
 * formatSlackUrlSyntax("&lt;mailto:user@example.com&gt;") // "[user@example.com](mailto:user@example.com)"
 */
export function formatSlackUrlSyntax(text: string): string {
    try {
        // Handle Slack's <url|text> format (both raw and HTML-encoded)
        text = text.replace(/(?:<|&lt;)(https?:\/\/[^|>]+)\|([^>]+)(?:>|&gt;)/g, (match, url, displayText) => {
            try {
                // Validate URL
                new URL(url);
                // Clean and validate display text
                displayText = displayText.trim();
                if (!displayText) displayText = 'Link';
                // Escape any markdown characters in display text
                displayText = displayText.replace(/[[\]()]/g, '\\$&');
                return `[${displayText}](${url})`;
            } catch {
                // Invalid URL, return original
                return match;
            }
        });
        
        // Handle plain <url> format (both raw and HTML-encoded)
        text = text.replace(/(?:<|&lt;)(https?:\/\/[^>]+)(?:>|&gt;)/g, (match, url) => {
            try {
                new URL(url);
                return url;
            } catch {
                return match;
            }
        });
        
        // Handle malformed URLs (missing protocol)
        text = text.replace(/(?:<|&lt;)((?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^>]*)(?:>|&gt;)/g, (match, url) => {
            const fullUrl = url.startsWith('www.') ? `https://${url}` : `https://www.${url}`;
            try {
                new URL(fullUrl);
                return fullUrl;
            } catch {
                return match;
            }
        });
        
        // Handle mailto links
        text = text.replace(/(?:<|&lt;)mailto:([^>]+)(?:>|&gt;)/g, (match, email) => {
            // Basic email validation
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return `[${email}](mailto:${email})`;
            }
            return match;
        });
        
        return text;
    } catch (error) {
        // If anything fails catastrophically, return original text
        Logger.warn('text-utils', 'formatSlackUrlSyntax error:', error);
        return text;
    }
}