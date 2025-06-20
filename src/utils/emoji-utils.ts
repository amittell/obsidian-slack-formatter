/**
 * Emoji handling utilities for Slack-to-Unicode conversion.
 * Provides comprehensive emoji processing including standard codes,
 * custom emojis, and Slack production asset URLs.
 */

/**
 * Common emoji mappings for standard Slack emojis.
 * Maps emoji codes (without colons) to Unicode characters.
 * @type {Record<string, string>}
 */
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
    'no_entry': '⛔',
    'warning': '⚠️',
    'bulb': '💡',
    'gift': '🎁',
    'birthday': '🎂',
    'spiral_calendar_pad': '🗓️',
    
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
 * Mapping of common Slack standard emoji asset URLs to emoji names.
 * Based on Unicode codepoints found in Slack production asset URLs.
 * Keys are Unicode codepoints (e.g., '1f44d' for thumbsup)
 * Values are emoji names used in DEFAULT_EMOJI_MAP
 * @type {Record<string, string>}
 */
export const SLACK_EMOJI_URL_MAP: { [key: string]: string } = {
    // Standard emoji mappings from Slack production assets
    '26d4': 'no_entry',           // ⛔
    '1f64f': 'pray',              // 🙏  
    '2764-fe0f': 'heart',         // ❤️
    '1f5d3-fe0f': 'spiral_calendar_pad', // 🗓️
    '1f44d': 'thumbsup',          // 👍
    '1f44e': 'thumbsdown',        // 👎
    '1f602': 'joy',               // 😂
    '1f604': 'smile',             // 😄
    '1f609': 'wink',              // 😉
    '1f60a': 'blush',             // 😊
    '1f60d': 'heart_eyes',        // 😍
    '1f614': 'pensive',           // 😔
    '1f622': 'cry',               // 😢
    '1f62d': 'sob',               // 😭
    '1f914': 'thinking',          // 🤔
    '1f44b': 'wave',              // 👋
    '1f44c': 'ok_hand',           // 👌
    '1f44f': 'clap',              // 👏
    '1f4aa': 'muscle',            // 💪
    '1f64c': 'raised_hands',      // 🙌
    '2b50': 'star',               // ⭐
    '2728': 'sparkles',           // ✨
    '1f525': 'fire',              // 🔥
    '2705': 'white_check_mark',   // ✅
    '274c': 'x',                  // ❌
    '26a0-fe0f': 'warning',       // ⚠️
    '1f4a1': 'bulb',              // 💡
    '1f381': 'gift',              // 🎁
    '1f382': 'birthday',          // 🎂
    '1f4bb': 'computer',          // 💻
    '1f4f1': 'iphone',            // 📱
    '2328-fe0f': 'keyboard',      // ⌨️
    '1f4f7': 'camera',            // 📷
    '1f4fa': 'tv',                // 📺
    '1f642': 'slightly_smiling_face', // 🙂
    '1f937': 'shrug',             // 🤷
    '1f926': 'facepalm',          // 🤦
    '1f440': 'eyes',              // 👀
    '1f9e0': 'brain',             // 🧠
    '1f917': 'hugs',              // 🤗
}

/**
 * Extract emoji codepoint from Slack production emoji asset URL
 * @param url Slack emoji asset URL
 * @returns Unicode codepoint or null if not found
 */
function extractEmojiCodepointFromUrl(url: string): string | null {
    // Match patterns like:
    // https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/26d4.png
    // https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-small/1f64f@2x.png
    const match = url.match(/production-standard-emoji-assets\/[\d.]+\/[^/]+\/([a-f0-9-]+)(?:@\d+x)?\.png/);
    return match && match[1] ? match[1] : null;
}

/**
 * Convert Slack emoji image URLs to appropriate emoji representations
 * @param url Slack emoji URL
 * @param emojiName Optional emoji name from the markdown syntax
 * @param emojiMap Custom emoji mappings
 * @returns Best emoji representation
 */
function convertSlackEmojiUrl(url: string, emojiName: string | null, emojiMap: Record<string, string>): string {
    const mergedMap = { ...DEFAULT_EMOJI_MAP, ...emojiMap };
    
    // If we have an emoji name and a custom mapping for it, use that
    if (emojiName && mergedMap[emojiName]) {
        return mergedMap[emojiName];
    }
    
    // Try to extract standard emoji from Slack production assets
    if (url.includes('production-standard-emoji-assets')) {
        const codepoint = extractEmojiCodepointFromUrl(url);
        if (codepoint && SLACK_EMOJI_URL_MAP[codepoint]) {
            const standardName = SLACK_EMOJI_URL_MAP[codepoint];
            return mergedMap[standardName] || `:${standardName}:`;
        }
    }
    
    // For custom Slack emojis (emoji.slack-edge.com), try to use the name
    if (emojiName) {
        // Check if it's a known default emoji
        if (mergedMap[emojiName]) {
            return mergedMap[emojiName];
        }
        // Otherwise return as emoji code for custom emojis
        return `:${emojiName}:`;
    }
    
    // Fallback: extract any potential emoji name from URL path
    const pathMatch = url.match(/\/([a-zA-Z0-9_-]+)\.[a-z]+$/);
    if (pathMatch) {
        const urlEmojiName = pathMatch[1];
        if (mergedMap[urlEmojiName]) {
            return mergedMap[urlEmojiName];
        }
        return `:${urlEmojiName}:`;
    }
    
    // Final fallback: return a generic emoji indicator
    return ':emoji:';
}

/**
 * Replace Slack emoji codes and image URLs with actual emoji characters.
 * Handles multiple formats:
 * - :emoji: standard codes
 * - ![:emoji:](url) Slack emoji with URLs (both standard and custom)
 * - ![](url) broken image markdown that should be emojis
 * - Unicode emoji (preserved as-is)
 * @param {string} text - The text containing emoji codes to replace
 * @param {Record<string, string>} emojiMap - Custom emoji mappings to merge with defaults
 * @returns {string} Text with emoji codes replaced by Unicode characters
 */
export function replaceEmoji(text: string, emojiMap: Record<string, string>): string {
    const mergedMap = { ...DEFAULT_EMOJI_MAP, ...emojiMap };
    
    // First, fix broken Slack URLs that have spaces
    let result = text.replace(/https:\/\/slack\s+imgs\.com/gi, 'https://slack-imgs.com');
    result = result.replace(/https:\/\/([ae])\.slack\s+edge\.com/gi, 'https://$1.slack-edge.com');
    result = result.replace(/https:\/\/emoji\.slack\s+edge\.com/gi, 'https://emoji.slack-edge.com');
    result = result.replace(/production\s+standard\s+emoji\s+assets/gi, 'production-standard-emoji-assets');
    result = result.replace(/apple\s+large/gi, 'apple-large');
    
    // Then, handle Slack emoji with image URLs: ![:emoji:](url)
    result = result.replace(/!\[:([a-zA-Z0-9_+-]+):\]\(([^)]+)\)/g, (match, emojiName, url) => {
        return convertSlackEmojiUrl(url, emojiName, emojiMap);
    });
    
    // Handle broken emoji images that appear as ![](slack-edge-url)
    // These are typically from Slack's standard emoji assets or custom emojis
    result = result.replace(/!\[\]\(https:\/\/[ae]\.(slack-edge\.com|emoji\.slack-edge\.com)[^)]+\)/g, (match) => {
        const urlMatch = match.match(/!\[\]\(([^)]+)\)/);
        if (urlMatch) {
            return convertSlackEmojiUrl(urlMatch[1], null, emojiMap);
        }
        return match;
    });
    
    // Handle user avatar images (don't convert these to emojis)
    // These typically have patterns like ca.slack-edge.com/.../-U123456-...
    // We'll leave these as-is since they're user avatars, not emojis
    
    // Finally, handle standard :emoji: patterns
    result = result.replace(/:([a-zA-Z0-9_+-]+):/g, (match, code) => {
        return mergedMap[code] || match;
    });
    
    return result;
}

/**
 * Format emoji reactions into a readable string.
 * Converts reaction objects to a space-separated string of emoji and counts.
 * @param {Array<{name: string; count: number}>} reactions - Array of reaction objects
 * @param {Record<string, string>} emojiMap - Custom emoji mappings to merge with defaults
 * @returns {string} Formatted string like "👍 3 ❤️ 2" or empty string if no reactions
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
 * Removes all emoji from text including Unicode emoji and Slack emoji codes.
 * Useful for cleaning usernames and timestamps.
 * Handles:
 * - Slack emoji with URLs ![:emoji:](url)
 * - Broken emoji images ![](url)
 * - Standard emoji codes :emoji:
 * - Unicode emoji characters
 * @param {string} text - The text to clean
 * @returns {string} Text with all emoji removed and spaces normalized
 */
export function removeAllEmoji(text: string): string {
    // Remove Slack emoji with URLs
    let cleaned = text.replace(/!\[:([a-zA-Z0-9_+-]+):\]\([^)]+\)/g, '');
    
    // Remove broken emoji images from Slack
    cleaned = cleaned.replace(/!\[\]\(https:\/\/[ae]\.(slack-edge\.com|emoji\.slack-edge\.com)[^)]+\)/g, '');
    
    // Remove standard emoji codes
    cleaned = cleaned.replace(/:([a-zA-Z0-9_+-]+):/g, '');
    
    // Remove Unicode emoji (comprehensive range)
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{3000}-\u{303F}]/gu, '');
    
    // Clean up any double spaces left behind
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

/**
 * Checks if text contains any emoji (codes, URLs, or Unicode).
 * @param {string} text - The text to check
 * @returns {boolean} True if text contains any form of emoji
 */
export function containsEmoji(text: string): boolean {
    // Check for emoji codes
    if (/:([a-zA-Z0-9_+-]+):/.test(text)) return true;
    
    // Check for Slack emoji with URLs
    if (/!\[:([a-zA-Z0-9_+-]+):\]\([^)]+\)/.test(text)) return true;
    
    // Check for broken emoji images from Slack
    if (/!\[\]\(https:\/\/[ae]\.(slack-edge\.com|emoji\.slack-edge\.com)[^)]+\)/.test(text)) return true;
    
    // Check for Unicode emoji
    if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text)) return true;
    
    return false;
}

/**
 * Extracts emoji codes from text (without colons).
 * Finds all emoji codes from various formats and returns unique codes.
 * @param {string} text - The text to extract emoji codes from
 * @returns {string[]} Array of unique emoji codes without colons
 */
export function extractEmojiCodes(text: string): string[] {
    const codes: string[] = [];
    
    // Extract from Slack emoji with URLs
    const customMatches = text.match(/!\[:([a-zA-Z0-9_+-]+):\]\([^)]+\)/g);
    if (customMatches) {
        customMatches.forEach(match => {
            const codeMatch = match.match(/!\[:([a-zA-Z0-9_+-]+):\]/);
            if (codeMatch && codeMatch[1]) codes.push(codeMatch[1]);
        });
    }
    
    // Extract potential emoji names from broken Slack image URLs
    const brokenImageMatches = text.match(/!\[\]\(https:\/\/emoji\.slack-edge\.com\/[^/]+\/([a-zA-Z0-9_+-]+)\/[^)]+\)/g);
    if (brokenImageMatches) {
        brokenImageMatches.forEach(match => {
            const nameMatch = match.match(/\/([a-zA-Z0-9_+-]+)\/[^)]+\)$/);
            if (nameMatch && nameMatch[1]) codes.push(nameMatch[1]);
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
 * Clean emoji from username while preserving the rest.
 * Wrapper around removeAllEmoji for semantic clarity.
 * @param {string} username - The username to clean
 * @returns {string} Username with all emoji removed
 */
export function cleanEmojiFromUsername(username: string): string {
    return removeAllEmoji(username);
}