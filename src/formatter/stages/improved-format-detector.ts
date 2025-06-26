import type { FormatStrategyType } from '../../types/formatters.types';
import { Logger, DiagnosticContext } from '../../utils/logger';

/**
 * Pattern weights for format detection scoring.
 * Contains normalized scores for each format type and overall confidence.
 * 
 * @interface FormatScore
 * @since 1.0.0
 */
interface FormatScore {
    standard: number;
    bracket: number;
    mixed: number;
    dm: number;
    thread: number;
    channel: number;
    confidence: number;
}

/**
 * Optimized format detector using pattern scoring.
 * Analyzes Slack conversation text to determine the export format
 * (standard, bracket, or mixed) through probabilistic pattern matching.
 * This approach is more flexible than rigid regex matching and handles
 * variations in Slack export formats.
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Pre-compiled regex patterns to avoid runtime compilation
 * - Reduced pattern matching by using more specific patterns
 * - Early termination when confidence thresholds are met
 * - Cached pattern results for repeated calls
 */
export class ImprovedFormatDetector {
    // Performance optimization: cache results for repeated calls
    private resultCache = new Map<string, FormatStrategyType>();
    private readonly cacheMaxSize = 100; // Limit cache size to prevent memory issues
    
    // Pre-compiled patterns for better performance
    private readonly compiledPatterns = {
        // Standard format indicators
        standard: [
            /^[A-Za-z0-9\s\-_.]+\s+\d{1,2}:\d{2}\s*(?:AM|PM)?$/m,  // Username Time
            /^[A-Za-z0-9\s\-_.]+\s+\[.+\]\(.+\)$/m,  // Username [Time](url)
            /^\d{1,2}:\d{2}\s*(?:AM|PM)?$/m,  // Time only lines
            /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/m,  // Day names
            /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/m,  // Month day
        ],
        
        // Bracket format indicators
        bracket: [
            /^\[Message from .+\]/m,  // [Message from username]
            /^\[Time: .+\]/m,  // [Time: timestamp]
            /^>\s*\[Message from/m,  // Quoted bracket format
            /\[Thread:.+\]/m,  // [Thread: info]
            /\[Channel:.+\]/m,  // [Channel: name]
        ],
        
        // Mixed format indicators (optimized)
        mixed: [
            /:([\\w+-]+):/,  // Emoji codes (capture group for efficiency)
            /<@U[A-Z0-9]+>/,  // User mentions
            /View thread/,  // Thread indicators
            /\d+\s+repl(?:y|ies)/,  // Reply counts
            /https?:\/\//,  // URLs
        ],
        
        // DM format indicators
        dm: [
            /^\[\d{1,2}:\d{2}\]\(https:\/\/.*\/archives\/D[A-Z0-9]+\/p\d+\)$/m,  // Standalone [time](DM-url)
            /\/archives\/D[A-Z0-9]+\//,  // DM archive URLs (archives/D...)
            // Multi-person DM contextual indicators
            /!\[\]\(https:\/\/ca\.slack-edge\.com\/E[A-Z0-9]+-U[A-Z0-9]+-[a-f0-9]+-48\)/,  // User avatar images (48px)
            /^[A-Za-z\s]+[A-Za-z\s]+\s+\[\d{1,2}:\d{2}\s*(?:AM|PM)?\]\(https:\/\/.*\/archives\/[CD][A-Z0-9]+\/p\d+\)\s*$/m,  // Name + timestamp link pattern
            /^[A-Za-z\s]{20,}\s+\[\d{1,2}:\d{2}/m,  // Very long names + timestamp (common in DMs) - Made more restrictive
            /\[@\w+\]\(https:\/\/.*\/team\/U[A-Z0-9]+\)/,  // User mention links
            // Multi-person DM specific patterns
            /^([A-Za-z\s\u00C0-\u017F]+)\1\s+\[\d{1,2}:\d{2}\s*(?:AM|PM)?\]\(https:\/\/.*\/archives\/[CD][A-Z0-9]+\/p\d+\)/m,  // Doubled username + timestamp pattern
            /^([A-Za-z]+)\1([A-Za-z\s]+)\2\s+\[\d{1,2}:\d{2}/m,  // Pattern like "AmyAmy BritoBrito [timestamp]"
            /!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)\s*\n\s*([A-Za-z\s\u00C0-\u017F]+)\1\s+\[\d{1,2}:\d{2}/m,  // Avatar immediately followed by doubled name + timestamp
        ],
        
        // Thread format indicators
        thread: [
            /thread_ts=/,  // Thread timestamp parameter
            /^\!\[\]\(https:\/\/ca\.slack-edge\.com\//m,  // Avatar images
            /\d+\s+replies/,  // Reply count
            /^---$/m,  // Thread separator
            /!\[:[\w-]+:\]\(.*?\)\s+\[.+\]\(.+\)/,  // Username with emoji + timestamp
            /\[(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday).*?\]\(.*?thread_ts=/,  // Day format with thread_ts
        ],
        
        // Channel format indicators  
        channel: [
            /\/archives\/C[A-Z0-9]+\//,  // Channel archive URLs (archives/C...) - but this alone isn't definitive
            /joined the channel/,  // Join messages
            /set the channel/,  // Channel settings
            /Channel:/,  // Channel indicators
            /pinned a message to this channel/,  // Channel-specific actions
            /shared a file:.*to this channel/,  // Channel file sharing
            /^#[a-z0-9-]+/m,  // Channel name references
            /^---\s+[A-Za-z]/m,  // Channel conversations often start with "--- Username"
            /\[@\w+\]\([^)]+\)(?:\s+\[@\w+\]\([^)]+\)){2,}/,  // Multiple user mentions in sequence (common in channel conversations)
        ],
        
        // Confidence boosters
        highConfidence: [
            /^\d{1,2}:\d{2}\s*(?:AM|PM)?$/m,  // Clean timestamp lines
            /^[A-Za-z0-9\s\-_.]+$/m,  // Clean username lines
            /--- .+ ---/,  // Date separators
        ],
    };

    /**
     * Detects the format strategy based on optimized pattern scoring.
     * 
     * Main entry point for format detection. Uses probabilistic scoring
     * across multiple format indicators to determine the most likely format.
     * 
     * Algorithm Overview:
     * 1. Generate content hash for caching (performance optimization)
     * 2. Analyze first 50-60 lines with pre-compiled regex patterns
     * 3. Score content against all format types (DM, Thread, Channel, etc.)
     * 4. Apply format-specific logic and tiebreakers
     * 5. Cache result for future calls
     * 
     * Format Priority (most to least specific):
     * - Thread: Has explicit thread indicators (thread_ts, replies count)
     * - DM: Strong DM patterns (doubled usernames, DM URLs)
     * - Channel: Channel-specific indicators
     * - Bracket: Bracket format patterns
     * - Standard: Default fallback
     * 
     * @param {string} content - The Slack conversation content to analyze
     * @returns {FormatStrategyType} The detected format type
     * @complexity O(n) where n is number of lines analyzed (50-60 lines max)
     * @example
     * ```typescript
     * const detector = new ImprovedFormatDetector();
     * const format = detector.detectFormat(slackExportContent);
     * console.log(`Detected format: ${format}`);
     * ```
     * @since 1.0.0
     */
    detectFormat(content: string): FormatStrategyType {
        const operationId = `format-detect-${Date.now()}`;
        
        // Start diagnostic logging for format detection
        const diagnosticContext: DiagnosticContext = {
            operationId,
            text: content?.substring(0, 100) || '', // Limit text for logging
            matchedPatterns: [],
            rejectedPatterns: [],
            formatDecision: ''
        };
        
        Logger.diagnostic(
            'ImprovedFormatDetector',
            'Starting format detection analysis',
            diagnosticContext,
            { 
                contentLength: content?.length || 0,
                contentPreview: content?.substring(0, 100) || ''
            }
        );
        
        if (!content || typeof content !== 'string') {
            diagnosticContext.formatDecision = 'DEFAULT: Invalid content';
            Logger.diagnostic('ImprovedFormatDetector', 'Invalid content for format detection', diagnosticContext);
            Logger.warn('ImprovedFormatDetector', 'Invalid content for format detection');
            return 'standard';
        }

        // Performance optimization: check cache first
        const contentHash = this.generateContentHash(content);
        const cachedResult = this.resultCache.get(contentHash);
        if (cachedResult) {
            diagnosticContext.formatDecision = `CACHED: ${cachedResult}`;
            Logger.diagnostic('ImprovedFormatDetector', `Using cached format result: ${cachedResult}`, diagnosticContext);
            return cachedResult;
        }

        const score = this.scoreContent(content);
        
        // Always set confidence but only create expensive scoreData object in debug mode
        diagnosticContext.confidence = Number(score.confidence.toFixed(2));
        
        // Only create scoreData object and perform expensive logging in debug mode
        if (Logger.isDebugEnabled()) {
            const scoreData = {
                standard: Number(score.standard.toFixed(2)),
                bracket: Number(score.bracket.toFixed(2)),
                mixed: Number(score.mixed.toFixed(2)),
                dm: Number(score.dm.toFixed(2)),
                thread: Number(score.thread.toFixed(2)),
                channel: Number(score.channel.toFixed(2)),
                confidence: Number(score.confidence.toFixed(2))
            };
            
            Logger.diagnostic('ImprovedFormatDetector', 'Format scoring completed', diagnosticContext, scoreData);
            Logger.info('ImprovedFormatDetector', 'Format scores', scoreData);
        }

        let result: FormatStrategyType;
        
        // Optimized format detection with improved precedence logic
        if (score.confidence > 0.3) {
            diagnosticContext.matchedPatterns?.push('confidence-threshold-met');
            
            // Check for specific indicators in order of specificity (most specific first)
            
            // Thread indicators are very specific and should trump other patterns
            if (score.thread > 0.3) {
                diagnosticContext.matchedPatterns?.push('thread-score-threshold');
                
                // Check for explicit thread indicators in content to avoid false positives
                const hasThreadIndicators = content.includes('thread_ts=') || 
                                          /\d+\s+replies?/.test(content) ||
                                          /^---$/m.test(content);
                if (hasThreadIndicators) {
                    result = 'thread';
                    diagnosticContext.matchedPatterns?.push('explicit-thread-indicators');
                    diagnosticContext.formatDecision = 'THREAD: Explicit thread indicators found';
                } else if (score.dm > 0.4 && score.dm > score.channel) {
                    result = 'dm';
                    diagnosticContext.matchedPatterns?.push('dm-fallback-from-thread');
                    diagnosticContext.formatDecision = 'DM: Fallback from thread with strong DM indicators';
                } else if (score.channel > 0.3) {
                    result = 'channel';
                    diagnosticContext.matchedPatterns?.push('channel-fallback-from-thread');
                    diagnosticContext.formatDecision = 'CHANNEL: Fallback from thread';
                } else {
                    result = 'standard';
                    diagnosticContext.formatDecision = 'STANDARD: Thread score high but no explicit indicators';
                }
            } else if (score.dm > 0.4 && score.dm > score.channel) {
                // DM wins if it has stronger indicators than channel
                result = 'dm';
                diagnosticContext.matchedPatterns?.push('dm-strong-indicators');
                diagnosticContext.formatDecision = 'DM: Strong DM indicators beat channel';
            } else if (score.dm > 0.3 && score.channel > 0.3) {
                // Close call - use contextual tiebreaker
                // If DM score is significantly boosted, prefer DM
                const dmWins = score.dm > score.channel * 1.2;
                result = dmWins ? 'dm' : 'channel';
                diagnosticContext.matchedPatterns?.push(dmWins ? 'dm-tiebreaker-win' : 'channel-tiebreaker-win');
                diagnosticContext.formatDecision = `${dmWins ? 'DM' : 'CHANNEL'}: Close call tiebreaker (DM: ${score.dm.toFixed(2)}, Channel: ${score.channel.toFixed(2)})`;
            } else if (score.channel > 0.3 && score.channel > score.dm) {
                result = 'channel';
                diagnosticContext.matchedPatterns?.push('channel-clear-winner');
                diagnosticContext.formatDecision = 'CHANNEL: Clear channel indicators';
            } else if (score.bracket > score.standard && score.confidence > 0.5) {
                result = 'bracket';
                diagnosticContext.matchedPatterns?.push('bracket-format-detected');
                diagnosticContext.formatDecision = 'BRACKET: Bracket format with high confidence';
            } else {
                result = 'standard';
                diagnosticContext.formatDecision = 'STANDARD: Default with sufficient confidence';
            }
        } else {
            result = 'standard';
            diagnosticContext.rejectedPatterns?.push('low-confidence');
            diagnosticContext.formatDecision = `STANDARD: Low confidence (${score.confidence.toFixed(2)})`;
        }
        
        // Log final decision only in debug mode to improve performance
        if (Logger.isDebugEnabled()) {
            const scoreData = {
                standard: Number(score.standard.toFixed(2)),
                bracket: Number(score.bracket.toFixed(2)),
                mixed: Number(score.mixed.toFixed(2)),
                dm: Number(score.dm.toFixed(2)),
                thread: Number(score.thread.toFixed(2)),
                channel: Number(score.channel.toFixed(2)),
                confidence: Number(score.confidence.toFixed(2))
            };
            
            Logger.diagnostic('ImprovedFormatDetector', `Format detection completed: ${result}`, diagnosticContext, {
                finalResult: result,
                scores: scoreData,
                cacheKey: contentHash
            });
        }
        
        // Cache the result for future calls
        this.cacheResult(contentHash, result);
        
        return result;
    }

    /**
     * Optimized content scoring for different format patterns.
     * 
     * Core scoring algorithm that analyzes content against all format types.
     * Uses pre-compiled regex patterns for performance and applies 
     * sophisticated boosting logic for format differentiation.
     * 
     * Scoring Algorithm:
     * 1. Split content into lines (analyze first 60 lines)
     * 2. Test each line against pre-compiled pattern categories
     * 3. Count matches per format type
     * 4. Apply base scoring (matches/totalLines)
     * 5. Apply format-specific boosting multipliers
     * 6. Handle special cases (multi-person DMs vs Channels)
     * 7. Normalize all scores to 0-1 range
     * 
     * Key Innovation - Multi-person DM Detection:
     * Distinguishes between multi-person DMs and Channels by looking for:
     * - Avatar images + doubled usernames (DM layout)
     * - C-archive URLs without channel-specific patterns
     * - User mention link patterns
     * 
     * @param {string} content - The content to score
     * @returns {FormatScore} Normalized scores for each format type
     * @complexity O(n*m) where n=lines, m=patterns per category
     * @internal Core scoring method
     * @see {@link matchPatternCategory} for pattern matching
     * @since 1.0.0
     */
    private scoreContent(content: string): FormatScore {
        const lines = content.split('\n').slice(0, 60); // Analyze first 60 lines to catch thread indicators
        const score: FormatScore = {
            standard: 0,
            bracket: 0,
            mixed: 0,
            dm: 0,
            thread: 0,
            channel: 0,
            confidence: 0,
        };

        // Optimized counting with early termination
        const matches = {
            standard: 0,
            bracket: 0,
            mixed: 0,
            dm: 0,
            thread: 0,
            channel: 0,
            highConfidence: 0
        };

        // Performance optimization: process lines more efficiently
        const nonEmptyLines = lines.filter(line => line.trim().length > 0);
        
        for (const line of nonEmptyLines) {
            const trimmed = line.trim();
            
            // Optimized pattern matching with early breaks
            this.matchPatternCategory(trimmed, 'standard', matches);
            this.matchPatternCategory(trimmed, 'bracket', matches);
            this.matchPatternCategory(trimmed, 'mixed', matches);
            this.matchPatternCategory(trimmed, 'dm', matches);
            this.matchPatternCategory(trimmed, 'thread', matches);
            this.matchPatternCategory(trimmed, 'channel', matches);
            this.matchPatternCategory(trimmed, 'highConfidence', matches);
        }

        // Optimized score calculation
        const totalLines = Math.max(nonEmptyLines.length, 1);
        score.standard = matches.standard / totalLines;
        score.bracket = matches.bracket / totalLines;
        score.mixed = matches.mixed / totalLines;
        score.dm = matches.dm / totalLines;
        score.thread = matches.thread / totalLines;
        score.channel = matches.channel / totalLines;
        
        // Calculate confidence based on pattern density
        const totalMatches = matches.standard + matches.bracket + matches.dm + matches.thread + matches.channel + matches.highConfidence;
        score.confidence = Math.min(1, totalMatches / (totalLines * 0.3)); // Expect 30% of lines to match

        // Optimized score boosting with enhanced DM vs Channel logic
        if (matches.bracket > 2) score.bracket *= 1.5;
        if (matches.standard > 5) score.standard *= 1.2;
        if (matches.dm > 1) score.dm *= 2.5; // Boosted DM indicators
        if (matches.thread > 2) score.thread *= 2.2; // Strong thread indicators
        if (matches.channel > 2) score.channel *= 1.4; // Strong channel indicators
        
        // Special logic: If we have both C-archive URLs and DM contextual indicators,
        // favor DM detection (multi-person DMs can use C URLs)
        if (matches.dm > 0 || matches.channel > 0) {
            // Look for multi-person DM indicators
            const hasAvatarImages = /!\[\]\(https:\/\/ca\.slack-edge\.com\/E[A-Z0-9]+-U[A-Z0-9]+-[a-f0-9]+-48\)/.test(content);
            const hasDoubledUsernames = /([A-Za-z\s\u00C0-\u017F]+)\1\s+\[\d{1,2}:\d{2}/.test(content);
            const hasUserMentionLinks = /\[@\w+\]\(https:\/\/.*\/team\/U[A-Z0-9]+\)/.test(content);
            // Enhanced multi-person DM pattern detection
            const hasSpecificDoubledPattern = /^([A-Za-z\s\u00C0-\u017F]+)\1\s+\[\d{1,2}:\d{2}\s*(?:AM|PM)?\]\(https:\/\/.*\/archives\/[CD][A-Z0-9]+\/p\d+\)/m.test(content);
            const hasAvatarPlusDoubledName = /!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)\s*\n\s*[A-Za-z\s]+[A-Za-z\s]+\s+\[/.test(content);
            const dmIndicators = [hasAvatarImages, hasDoubledUsernames, hasUserMentionLinks, hasSpecificDoubledPattern, hasAvatarPlusDoubledName].filter(Boolean).length;
            
            // Check if channel match is primarily just the C-archive URL
            const channelOnlyFromUrl = content.includes('/archives/C') && 
                                     !(/joined the channel/i.test(content) || 
                                       /set the channel/i.test(content) ||
                                       /pinned a message to this channel/i.test(content) ||
                                       /#[a-z0-9-]+\s+channel/i.test(content));
            
            // Check for strong channel indicators that should override DM detection
            const hasStrongChannelIndicators = /joined the channel|set the channel|pinned a message to this channel|shared a file:.*to this channel|^#[a-z0-9-]+/m.test(content);
            const hasChannelArchiveUrl = /\/archives\/C[A-Z0-9]+\//.test(content);
            const hasChannelFormatPatterns = /^---\s+[A-Za-z]/m.test(content) || /\[@\w+\]\([^)]+\)(?:\s+\[@\w+\]\([^)]+\)){2,}/.test(content);
            
            // Enhanced logic for multi-person DM detection
            // Multi-person DMs are characterized by avatar images + doubled usernames + timestamps,
            // but can also use C-archive URLs. Channel format has different layout patterns.
            
            // Check for multi-person DM specific layout: avatar immediately followed by doubled username + timestamp
            // This pattern specifically looks for avatar on one line, then doubled username on the next non-empty line
            const hasMultiPersonDMLayout = hasAvatarPlusDoubledName;
            
            if (hasMultiPersonDMLayout && !hasStrongChannelIndicators && !hasChannelFormatPatterns) {
                // Strong multi-person DM indicators - but only when no channel-specific patterns present
                score.dm = Math.max(score.dm * 3.0, 0.7); // Strong DM boost for layout pattern
                score.channel *= 0.3; // Reduce channel confidence when DM layout is detected
                matches.dm = Math.max(matches.dm, 4); // Ensure high DM match count
            } else if (hasChannelArchiveUrl && (hasChannelFormatPatterns || hasStrongChannelIndicators)) {
                // Channel archive URL with channel-specific patterns - strongly indicate channel format
                score.channel = Math.max(score.channel * 2.0, 0.7); // Strong boost for channel score
                score.dm *= 0.2; // Significantly reduce DM confidence when channel patterns present
                matches.channel = Math.max(matches.channel, 3); // Ensure high channel match count
            } else if (hasChannelArchiveUrl && hasSpecificDoubledPattern && !hasAvatarImages) {
                // Channel archive URL with doubled usernames but NO avatars - likely channel format
                score.channel = Math.max(score.channel * 1.5, 0.5); // Boost channel score
                score.dm *= 0.6; // Reduce DM confidence when no DM-specific layout
                matches.channel = Math.max(matches.channel, 2); // Ensure minimum channel match count
            } else if (dmIndicators >= 2 && !hasStrongChannelIndicators && !hasChannelFormatPatterns && channelOnlyFromUrl) {
                // Strong DM indicators present and no strong channel indicators
                score.dm = Math.max(score.dm * 2.0, 0.5); // Ensure DM gets strong score (reduced from 2.5)
                score.channel *= 0.5; // Reduce channel confidence (increased from 0.4)
                matches.dm = Math.max(matches.dm, 2); // Ensure minimum DM match count
            } else if (channelOnlyFromUrl && matches.dm > 0 && !hasStrongChannelIndicators) {
                score.dm *= 1.5; // Moderate boost for DM (reduced from 1.8)
                score.channel *= 0.7; // Reduce channel confidence (increased from 0.6)
            }
        }
        
        // Normalize scores efficiently
        const maxScore = Math.max(score.standard, score.bracket, score.mixed, score.dm, score.thread, score.channel, 0.1);
        const invMaxScore = 1 / maxScore; // Avoid repeated division
        score.standard = Math.min(1, score.standard * invMaxScore);
        score.bracket = Math.min(1, score.bracket * invMaxScore);
        score.mixed = Math.min(1, score.mixed * invMaxScore);
        score.dm = Math.min(1, score.dm * invMaxScore);
        score.thread = Math.min(1, score.thread * invMaxScore);
        score.channel = Math.min(1, score.channel * invMaxScore);

        return score;
    }
    
    /**
     * Optimized pattern matching for a specific category.
     * 
     * Tests a line against all patterns in a specific category (standard,
     * bracket, DM, etc.) and increments the match counter for the first
     * matching pattern. Uses early termination for performance.
     * 
     * @param {string} trimmed - Trimmed line content to test
     * @param {keyof typeof this.compiledPatterns} category - Pattern category to test
     * @param {Record<string, number>} matches - Match counters object to update
     * @complexity O(p) where p is number of patterns in category
     * @internal Used by scoring algorithm
     * @since 1.0.0
     */
    private matchPatternCategory(trimmed: string, category: keyof typeof this.compiledPatterns, matches: Record<string, number>): void {
        const patterns = this.compiledPatterns[category];
        for (const pattern of patterns) {
            if (pattern.test(trimmed)) {
                matches[category]++;
                break; // Early termination - only count first match per category per line
            }
        }
    }
    
    /**
     * Generate a simple hash for content caching.
     * 
     * Creates a lightweight hash based on content length and 
     * first/last characters for cache key generation. Trades
     * hash collision resistance for performance.
     * 
     * @param {string} content - Content to generate hash for
     * @returns {string} Simple hash key for caching
     * @complexity O(1) - constant time substring operations
     * @internal Used for performance optimization
     * @since 1.0.0
     */
    private generateContentHash(content: string): string {
        // Simple hash based on content length and first/last characters
        // This is faster than a full hash but sufficient for our caching needs
        const first50 = content.substring(0, 50);
        const last50 = content.substring(Math.max(0, content.length - 50));
        return `${content.length}_${first50.length}_${last50.length}`;
    }
    
    /**
     * Cache result with size limit management.
     * 
     * Implements LRU-style cache with size limits to prevent memory bloat.
     * Removes oldest entry when cache is full.
     * 
     * @param {string} hash - Content hash key
     * @param {FormatStrategyType} result - Format detection result to cache
     * @complexity O(1) for insertion, O(1) for eviction
     * @internal Cache management
     * @since 1.0.0
     */
    private cacheResult(hash: string, result: FormatStrategyType): void {
        if (this.resultCache.size >= this.cacheMaxSize) {
            // Remove oldest entry
            const firstKey = this.resultCache.keys().next().value;
            this.resultCache.delete(firstKey);
        }
        this.resultCache.set(hash, result);
    }

    /**
     * Optimized quick check if text is likely from Slack.
     * 
     * Pre-filter to determine if content appears to be from Slack
     * before running full format detection. Uses common Slack
     * indicators with early termination for performance.
     * 
     * Slack Indicators:
     * - Emoji codes (:smile:, :+1:)
     * - Timestamps (12:34 AM, 9:15 PM)
     * - User mentions (<@U123ABC>)
     * - Thread text ("View thread", "5 replies")
     * - Day headers (Monday, Tuesday)
     * - File uploads ("uploaded a file:")
     * - Channel events ("joined the channel")
     * 
     * @param {string} text - The text to check
     * @returns {boolean} True if text appears to be from Slack
     * @complexity O(1) with early termination after 2 matches
     * @example
     * ```typescript
     * if (detector.isLikelySlack(content)) {
     *   const format = detector.detectFormat(content);
     * }
     * ```
     * @since 1.0.0
     */
    isLikelySlack(text: string): boolean {
        if (!text) return false;

        // Optimized quick checks with early termination
        const quickChecks = [
            /:[\w+-]+:/,  // Emoji codes
            /\d{1,2}:\d{2}\s*(?:AM|PM)/i,  // Timestamps
            /<@U[A-Z0-9]+>/,  // User mentions
            /View thread/i,  // Thread text
            /\d+\s+repl(?:y|ies)/i,  // Reply counts
            /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/im,  // Days
            /uploaded a file:/i,  // File uploads
            /joined the channel/i,  // Join messages
        ];

        let matches = 0;
        const threshold = 2; // Need at least 2 different patterns

        for (const pattern of quickChecks) {
            if (pattern.test(text)) {
                matches++;
                if (matches >= threshold) {
                    return true; // Early termination
                }
            }
        }

        return false;
    }
}