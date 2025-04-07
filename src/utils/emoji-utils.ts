/**
 * Emoji handling utilities
 */

/**
 * Replace Slack emoji codes with actual emoji characters
 */
export function replaceEmoji(text: string, emojiMap: Record<string, string>): string {
    // Allow letters, numbers, underscore, hyphen, and plus sign in emoji codes
    return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, code) => {
        return emojiMap[code] || match;
    });
}

/**
 * Format emoji reactions into a readable string
 */
export function formatReactions(reactions: Array<{ name: string; count: number }>, emojiMap: Record<string, string>): string {
    // Add guard clause for null/undefined or empty array
    if (!reactions || reactions.length === 0) {
        return '';
    }
    return reactions
        .map(reaction => {
            const emoji = emojiMap[reaction.name] || `:${reaction.name}:`;
            return `${emoji} ${reaction.count}`;
        })
        .join(' ');
}
