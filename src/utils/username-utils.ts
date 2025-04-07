/**
 * Username handling utilities
 */

/**
 * Replace Slack user mentions with wiki links
 */
export function formatUserMentions(text: string, userMap: Record<string, string>): string {
    return text.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
        const username = userMap[userId];
        // Check if username is already a wiki link before wrapping
        if (username) {
            return /^\[\[.*\]\]$/.test(username) ? username : `[[${username}]]`;
        }
        return match; // Return original mention if user ID not in map
    });
}
 
/**
 * Clean up immediately doubled usernames/names (e.g., "Alex MittellAlex Mittell" -> "Alex Mittell").
 * This specifically targets cases where a name (one or more words, potentially hyphenated) is repeated
 * directly after itself with no intervening characters, often due to copy-paste errors.
 * It does NOT handle cases like "Alex Mittell Alex Mittell" (with a space in between).
 */
export function cleanupDoubledUsernames(text: string): string {
    // (\b[\w-]+(?:\s+[\w-]+)*) : Capture group 1: Matches word boundary, word chars OR hyphen,
    //                           followed by zero or more groups of (whitespace + word chars OR hyphen).
    // \1                       : Backreference to capture group 1.
    // \b                       : Word boundary.
    // Reverting to the regex that handles multi-word names, accepting it might fail edge cases like 'abab'.
    return text.replace(/(\b[\w-]+(?:\s+[\w-]+)*)\1\b/g, '$1');
}

/**
 * Format username for display (simple title casing)
 */
export function formatUsername(username: string): string {
    // Re-add trimming logic
    const trimmedUsername = username.trim().replace(/^[_\s]+|[_\s]+$/g, '');
    if (!trimmedUsername) return ''; // Handle empty or whitespace-only input

    return trimmedUsername
        .split(/[_\s]+/) // Split by one or more underscores or spaces
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}