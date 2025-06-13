/**
 * Text processing utilities
 */
import { Logger } from './logger';

/**
 * Convert code blocks to Markdown format
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
 * Process thread links with proper formatting
 */
export function formatThreadLinks(text: string): string {
    // Make the space after the colon optional using \s*
    return text.replace(
        /View thread:\s*(https:\/\/[^\s]+)/g,
        '[View thread]($1)'
    );
}
 
 
/**
 * Convert Slack URLs to Markdown format with error handling
 * Handles multiple formats:
 * - <url|text> -> [text](url)
 * - <url> -> url
 * - &lt;url&gt; (HTML encoded)
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