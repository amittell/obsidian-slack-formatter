/**
 * Text processing utilities
 */
// Removed unused SlackAttachment import

// Removed formatSlackUrls function

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
 
// Removed unused formatAttachments function
 
/**
 * Convert Slack URLs (&lt;url|text&gt;) to Markdown format ([text](url))
 */
export function formatSlackUrlSyntax(text: string): string {
    // Handle Slack's <url|text> format
    // Note: Use &lt; and &gt; for matching literal angle brackets if they might be HTML-encoded
    // Updated regex to handle both raw <...> and encoded &lt;...&gt;
    return text.replace(/(?:<|&lt;)(https?:\/\/[^|>]+)\|([^>]+)(?:>|&gt;)/g, '[$2]($1)');
}