/**
 * Emoji handling utilities
 */

// Common emoji mappings
export const DEFAULT_EMOJI_MAP: { [key: string]: string } = {
    // Basic smileys
    'smile': '😄',
    'grin': '😁',
    'joy': '😂',
    'smiley': '😃',
    'wink': '😉',
    'blush': '😊',
    'heart_eyes': '😍',
    'thinking': '🤔',
    'neutral_face': '😐',
    'worried': '😟',
    'cry': '😢',
    'sob': '😭',
    
    // Gestures
    'wave': '👋',
    'ok_hand': '👌',
    'thumbsup': '👍',
    '+1': '👍',
    'thumbsdown': '👎',
    '-1': '👎',
    'clap': '👏',
    'pray': '🙏',
    'muscle': '💪',
    'raised_hands': '🙌',
    
    // Objects and symbols
    'heart': '❤️',
    'star': '⭐',
    'sparkles': '✨',
    'fire': '🔥',
    'check': '✅',
    'white_check_mark': '✅',
    'x': '❌',
    'warning': '⚠️',
    'bulb': '💡',
    'gift': '🎁',
    'birthday': '🎂',
    
    // Tech
    'computer': '💻',
    'iphone': '📱',
    'keyboard': '⌨️',
    'camera': '📷',
    'tv': '📺',
    
    // Common Slack custom
    'slightly_smiling_face': '🙂',
    'shrug': '🤷',
    'facepalm': '🤦',
    'eyes': '👀',
    'brain': '🧠',
    'hugs': '🤗',
    'thinking_face': '🤔',
}

/**
 * Replace Slack emoji codes with actual emoji characters
 * Handles multiple formats:
 * - :emoji: standard codes
 * - ![:emoji:](url) custom Slack emoji with URLs
 * - Unicode emoji (preserved as-is)
 */
export function replaceEmoji(text: string, emojiMap: Record<string, string>): string {
    const mergedMap = { ...DEFAULT_EMOJI_MAP, ...emojiMap };
    
    // First, handle custom Slack emoji with image URLs: ![:emoji:](url)
    let result = text.replace(/!\[:([a-zA-Z0-9_+-]+):\]\([^)]+\)/g, (match, emojiName) => {
        // If we have a mapping for this custom emoji, use it
        if (mergedMap[emojiName]) {
            return mergedMap[emojiName];
        }
        // Otherwise, just show the emoji name in a simplified format
        return `:${emojiName}:`;
    });
    
    // Then handle standard :emoji: patterns
    result = result.replace(/:([a-zA-Z0-9_+-]+):/g, (match, code) => {
        return mergedMap[code] || match;
    });
    
    return result;
}

/**
 * Format emoji reactions into a readable string
 */
export function formatReactions(reactions: Array<{ name: string; count: number }>, emojiMap: Record<string, string>): string {
    // Add guard clause for null/undefined or empty array
    if (!reactions || reactions.length === 0) {
        return '';
    }
    
    const mergedMap = { ...DEFAULT_EMOJI_MAP, ...emojiMap };
    
    return reactions
        .map(reaction => {
            const emoji = mergedMap[reaction.name] || `:${reaction.name}:`;
            return `${emoji} ${reaction.count}`;
        })
        .join(' ');
}

/**
 * Removes all emoji from text including Unicode emoji and Slack emoji codes
 * Useful for cleaning usernames and timestamps
 */
export function removeAllEmoji(text: string): string {
    // Remove custom Slack emoji with URLs
    let cleaned = text.replace(/!\[:([a-zA-Z0-9_+-]+):\]\([^)]+\)/g, '');
    
    // Remove standard emoji codes
    cleaned = cleaned.replace(/:([a-zA-Z0-9_+-]+):/g, '');
    
    // Remove Unicode emoji (comprehensive range)
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{3000}-\u{303F}]/gu, '');
    
    // Clean up any double spaces left behind
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

/**
 * Checks if text contains any emoji (codes or Unicode)
 */
export function containsEmoji(text: string): boolean {
    // Check for emoji codes
    if (/:([a-zA-Z0-9_+-]+):/.test(text)) return true;
    
    // Check for custom Slack emoji
    if (/!\[:([a-zA-Z0-9_+-]+):\]\([^)]+\)/.test(text)) return true;
    
    // Check for Unicode emoji
    if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text)) return true;
    
    return false;
}

/**
 * Extracts emoji codes from text (without colons)
 */
export function extractEmojiCodes(text: string): string[] {
    const codes: string[] = [];
    
    // Extract from custom Slack emoji
    const customMatches = text.match(/!\[:([a-zA-Z0-9_+-]+):\]\([^)]+\)/g);
    if (customMatches) {
        customMatches.forEach(match => {
            const codeMatch = match.match(/!\[:([a-zA-Z0-9_+-]+):\]/);
            if (codeMatch) codes.push(codeMatch[1]);
        });
    }
    
    // Extract from standard emoji codes
    const standardMatches = text.match(/:([a-zA-Z0-9_+-]+):/g);
    if (standardMatches) {
        standardMatches.forEach(match => {
            codes.push(match.slice(1, -1));
        });
    }
    
    // Remove duplicates
    return [...new Set(codes)];
}

/**
 * Clean emoji from username while preserving the rest
 */
export function cleanEmojiFromUsername(username: string): string {
    return removeAllEmoji(username);
}