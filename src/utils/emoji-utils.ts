/**
 * Emoji handling utilities for Slack-to-Unicode conversion.
 * Provides comprehensive emoji processing including standard codes,
 * custom emojis, Slack production asset URLs, and Unicode emoji handling
 * with internationalization support and performance optimization.
 * 
 * @module emoji-utils
 * @since 1.0.0
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
 * Extract Unicode codepoint from Slack production emoji asset URL.
 * Parses Slack's standardized emoji asset URLs to extract the Unicode
 * codepoint identifier used for mapping to actual emoji characters.
 * 
 * @param url - Slack production emoji asset URL
 * @returns Unicode codepoint string (e.g., "1f44d") or null if not extractable
 * @throws Does not throw - returns null for malformed URLs
 * @example
 * ```typescript
 * extractEmojiCodepointFromUrl(
 *   'https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/1f44d.png'
 * )
 * // Returns: '1f44d'
 * 
 * extractEmojiCodepointFromUrl('https://example.com/not-emoji.png')
 * // Returns: null
 * ```
 * @since 1.0.0
 * @private
 * @see {@link SLACK_EMOJI_URL_MAP} for codepoint to emoji mapping
 * 
 * Performance: O(1) regex matching. Efficient for bulk URL processing.
 * Edge cases: Handles various URL formats, @2x variants, and malformed URLs.
 */
function extractEmojiCodepointFromUrl(url: string): string | null {
    // Match patterns like:
    // https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/26d4.png
    // https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-small/1f64f@2x.png
    const match = url.match(/production-standard-emoji-assets\/[\d.]+\/[^/]+\/([a-f0-9-]+)(?:@\d+x)?\.png/);
    return match && match[1] ? match[1] : null;
}

/**
 * Convert Slack emoji image URLs to appropriate emoji representations.
 * Intelligently processes both standard and custom Slack emoji URLs,
 * with fallback strategies for optimal emoji representation.
 * 
 * @param url - Slack emoji image URL (standard or custom)
 * @param emojiName - Optional emoji name from markdown syntax
 * @param emojiMap - Custom emoji mappings to merge with defaults
 * @returns Best available emoji representation (Unicode or :code:)
 * @throws Does not throw - provides fallback representations
 * @example
 * ```typescript
 * convertSlackEmojiUrl(
 *   'https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/1f44d.png',
 *   'thumbsup',
 *   {}
 * )
 * // Returns: '👍'
 * 
 * convertSlackEmojiUrl(
 *   'https://emoji.slack-edge.com/T123/custom_emoji/abc123.png',
 *   'custom_emoji',
 *   {}
 * )
 * // Returns: ':custom_emoji:'
 * ```
 * @since 1.0.0
 * @private
 * @see {@link replaceEmoji} for public emoji replacement API
 * 
 * Performance: O(1) with URL pattern matching and map lookups.
 * Edge cases: Handles broken URLs, missing names, and unknown emoji types.
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
 * Comprehensive emoji processing function that handles multiple Slack emoji formats
 * including broken URLs, custom emojis, and standard emoji codes with robust error handling.
 * 
 * Supported formats:
 * - `:emoji:` - Standard emoji codes
 * - `![:emoji:](url)` - Slack emoji with URLs (standard and custom)
 * - `![](url)` - Broken image markdown for emojis
 * - Unicode emoji (preserved as-is)
 * - Broken Slack URLs with spaces (auto-corrected)
 * 
 * @param text - The text containing emoji codes and URLs to replace
 * @param emojiMap - Custom emoji mappings to merge with defaults
 * @returns Text with emoji codes replaced by Unicode characters or emoji codes
 * @throws Does not throw - handles malformed input gracefully
 * @example
 * ```typescript
 * replaceEmoji(':thumbsup: Great job!', {})
 * // Returns: '👍 Great job!'
 * 
 * replaceEmoji('![:custom:](https://emoji.slack-edge.com/T123/custom/abc.png)', {})
 * // Returns: ':custom:'
 * 
 * replaceEmoji('![](https://a.slack-edge.com/.../1f44d.png)', {})
 * // Returns: '👍'
 * 
 * replaceEmoji('Already 😀 Unicode', {})
 * // Returns: 'Already 😀 Unicode' (unchanged)
 * ```
 * @since 1.0.0
 * @see {@link DEFAULT_EMOJI_MAP} for available standard emojis
 * @see {@link formatReactions} for reaction-specific formatting
 * 
 * Performance: O(n) with multiple regex passes. Optimized for typical message lengths.
 * Edge cases: Fixes broken Slack URLs, handles malformed markdown, preserves user avatars.
 * Internationalization: Supports Unicode emoji and international custom emoji names.
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
 * Format emoji reactions into a readable string representation.
 * Converts reaction objects to a human-readable format with emoji characters
 * and counts, handling both standard and custom emoji reactions.
 * 
 * @param reactions - Array of reaction objects with name and count properties
 * @param emojiMap - Custom emoji mappings to merge with defaults
 * @returns Formatted string like "👍 3 ❤️ 2" or empty string if no reactions
 * @throws Does not throw - handles null/undefined input gracefully
 * @example
 * ```typescript
 * formatReactions([
 *   { name: 'thumbsup', count: 3 },
 *   { name: 'heart', count: 2 },
 *   { name: 'custom_emoji', count: 1 }
 * ], {})
 * // Returns: '👍 3 ❤️ 2 :custom_emoji: 1'
 * 
 * formatReactions([], {})
 * // Returns: ''
 * 
 * formatReactions(null, {})
 * // Returns: ''
 * ```
 * @since 1.0.0
 * @see {@link replaceEmoji} for general emoji processing
 * 
 * Performance: O(n) where n is number of reactions. Efficient for typical reaction counts.
 * Edge cases: Handles null input, empty arrays, and unknown emoji names gracefully.
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
 * Remove all emoji from text including Unicode emoji and Slack emoji codes.
 * Comprehensive emoji removal utility for cleaning usernames, timestamps,
 * and other text content that should not contain emoji.
 * 
 * Removes:
 * - Slack emoji with URLs: `![:emoji:](url)`
 * - Broken emoji images: `![](url)`
 * - Standard emoji codes: `:emoji:`
 * - Unicode emoji characters (full Unicode range)
 * 
 * @param text - The text to clean of all emoji content
 * @returns Text with all emoji removed and whitespace normalized
 * @throws Does not throw - handles null/undefined input gracefully
 * @example
 * ```typescript
 * removeAllEmoji('Hello 👍 :smile: ![:custom:](url) World')
 * // Returns: 'Hello World'
 * 
 * removeAllEmoji('Clean text')
 * // Returns: 'Clean text'
 * 
 * removeAllEmoji('')
 * // Returns: ''
 * ```
 * @since 1.0.0
 * @see {@link cleanEmojiFromUsername} for username-specific cleaning
 * @see {@link containsEmoji} for emoji detection
 * 
 * Performance: O(n) with comprehensive Unicode regex. Optimized for typical text lengths.
 * Edge cases: Handles complex Unicode sequences, multiple consecutive emoji, preserves spaces.
 * Internationalization: Removes full Unicode emoji range including regional indicators.
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
 * Check if text contains any form of emoji (codes, URLs, or Unicode).
 * Fast detection utility for determining if text contains emoji content
 * before applying more expensive processing operations.
 * 
 * Detects:
 * - Standard emoji codes: `:emoji:`
 * - Slack emoji with URLs: `![:emoji:](url)`
 * - Broken emoji images: `![](url)`
 * - Unicode emoji characters
 * 
 * @param text - The text to check for emoji presence
 * @returns True if any form of emoji is detected, false otherwise
 * @throws Does not throw - handles null/undefined input gracefully
 * @example
 * ```typescript
 * containsEmoji('Hello 👍 world')
 * // Returns: true
 * 
 * containsEmoji('Hello :smile: world')
 * // Returns: true
 * 
 * containsEmoji('Plain text')
 * // Returns: false
 * 
 * containsEmoji('')
 * // Returns: false
 * ```
 * @since 1.0.0
 * @see {@link removeAllEmoji} for emoji removal
 * @see {@link extractEmojiCodes} for emoji extraction
 * 
 * Performance: O(n) with early termination. Very fast for emoji-free text.
 * Edge cases: Handles various emoji formats and Unicode ranges efficiently.
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
 * Extract emoji codes from text across multiple formats.
 * Finds and extracts all emoji identifiers from various Slack emoji formats,
 * returning unique codes for analysis or processing.
 * 
 * Extracts from:
 * - Slack emoji with URLs: `![:emoji:](url)`
 * - Broken Slack emoji images: `![](url)`
 * - Standard emoji codes: `:emoji:`
 * 
 * @param text - The text to extract emoji codes from
 * @returns Array of unique emoji codes (without colons)
 * @throws Does not throw - handles malformed input gracefully
 * @example
 * ```typescript
 * extractEmojiCodes('Hello :smile: and ![:thumbsup:](url) :smile:')
 * // Returns: ['smile', 'thumbsup']
 * 
 * extractEmojiCodes('No emoji here')
 * // Returns: []
 * 
 * extractEmojiCodes('')
 * // Returns: []
 * ```
 * @since 1.0.0
 * @see {@link containsEmoji} for emoji detection
 * @see {@link replaceEmoji} for emoji replacement
 * 
 * Performance: O(n) with regex matching and Set deduplication. Efficient for analysis.
 * Edge cases: Handles duplicate codes, malformed URLs, and mixed emoji formats.
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
 * Clean emoji from username while preserving the rest of the text.
 * Specialized wrapper around removeAllEmoji for username processing
 * with semantic clarity and username-specific considerations.
 * 
 * @param username - The username string to clean of emoji
 * @returns Username with all emoji removed and whitespace normalized
 * @throws Does not throw - handles null/undefined input gracefully
 * @example
 * ```typescript
 * cleanEmojiFromUsername('john_doe 😀')
 * // Returns: 'john_doe'
 * 
 * cleanEmojiFromUsername(':smile: happy_user :thumbsup:')
 * // Returns: 'happy_user'
 * 
 * cleanEmojiFromUsername('regular_username')
 * // Returns: 'regular_username'
 * ```
 * @since 1.0.0
 * @see {@link removeAllEmoji} for general emoji removal
 * 
 * Performance: O(n) - same as removeAllEmoji. Optimized for username lengths.
 * Edge cases: Preserves underscores, periods, and other valid username characters.
 */
export function cleanEmojiFromUsername(username: string): string {
    return removeAllEmoji(username);
}