import type { FormatStrategyType } from '../../types/formatters.types';
import { Logger } from '../../utils/logger';

/**
 * Pattern weights for format detection scoring.
 * Contains normalized scores for each format type and overall confidence.
 */
interface FormatScore {
    standard: number;
    bracket: number;
    mixed: number;
    confidence: number;
}

/**
 * Improved format detector using pattern scoring.
 * Analyzes Slack conversation text to determine the export format
 * (standard, bracket, or mixed) through probabilistic pattern matching.
 * This approach is more flexible than rigid regex matching and handles
 * variations in Slack export formats.
 */
export class ImprovedFormatDetector {
    private readonly patterns = {
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
        
        // Mixed format indicators (could be either)
        mixed: [
            /:[\w+-]+:/,  // Emoji codes
            /<@U[A-Z0-9]+>/,  // User mentions
            /View thread/,  // Thread indicators
            /\d+\s+repl(?:y|ies)/,  // Reply counts
            /https?:\/\//,  // URLs
        ],
        
        // Confidence boosters
        highConfidence: [
            /^\d{1,2}:\d{2}\s*(?:AM|PM)?$/m,  // Clean timestamp lines
            /^[A-Za-z0-9\s\-_.]+$/m,  // Clean username lines
            /--- .+ ---/,  // Date separators
        ],
    };

    /**
     * Detects the format strategy based on pattern scoring.
     * Analyzes the first 50 lines to determine the most likely format.
     * @param {string} content - The Slack conversation content to analyze
     * @returns {FormatStrategyType} The detected format type ('standard', 'bracket', or 'mixed')
     */
    detectFormat(content: string): FormatStrategyType {
        if (!content || typeof content !== 'string') {
            Logger.warn('ImprovedFormatDetector', 'Invalid content for format detection');
            return 'standard';
        }

        const score = this.scoreContent(content);
        
        Logger.info('ImprovedFormatDetector', 'Format scores', {
            standard: score.standard.toFixed(2),
            bracket: score.bracket.toFixed(2),
            mixed: score.mixed.toFixed(2),
            confidence: score.confidence.toFixed(2)
        });

        // Determine format based on scores
        if (score.bracket > score.standard && score.confidence > 0.5) {
            return 'bracket';
        }
        
        // Default to standard format
        return 'standard';
    }

    /**
     * Scores content for different format patterns.
     * Counts pattern matches and normalizes scores based on content density.
     * @private
     * @param {string} content - The content to score
     * @returns {FormatScore} Normalized scores for each format type
     */
    private scoreContent(content: string): FormatScore {
        const lines = content.split('\n').slice(0, 50); // Analyze first 50 lines
        const score: FormatScore = {
            standard: 0,
            bracket: 0,
            mixed: 0,
            confidence: 0,
        };

        // Count pattern matches
        let standardMatches = 0;
        let bracketMatches = 0;
        let mixedMatches = 0;
        let highConfidenceMatches = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Check standard patterns
            for (const pattern of this.patterns.standard) {
                if (pattern.test(trimmed)) {
                    standardMatches++;
                    break;
                }
            }

            // Check bracket patterns
            for (const pattern of this.patterns.bracket) {
                if (pattern.test(trimmed)) {
                    bracketMatches++;
                    break;
                }
            }

            // Check mixed patterns
            for (const pattern of this.patterns.mixed) {
                if (pattern.test(trimmed)) {
                    mixedMatches++;
                    break;
                }
            }

            // Check high confidence patterns
            for (const pattern of this.patterns.highConfidence) {
                if (pattern.test(trimmed)) {
                    highConfidenceMatches++;
                    break;
                }
            }
        }

        // Calculate scores (normalize by number of lines analyzed)
        const totalLines = Math.max(lines.length, 1);
        score.standard = standardMatches / totalLines;
        score.bracket = bracketMatches / totalLines;
        score.mixed = mixedMatches / totalLines;
        
        // Calculate confidence based on pattern density
        const totalMatches = standardMatches + bracketMatches + highConfidenceMatches;
        score.confidence = Math.min(1, totalMatches / (totalLines * 0.3)); // Expect 30% of lines to match

        // Boost scores based on strong indicators
        if (bracketMatches > 2) score.bracket *= 1.5;
        if (standardMatches > 5) score.standard *= 1.2;
        
        // Normalize scores
        const maxScore = Math.max(score.standard, score.bracket, 0.1);
        score.standard = Math.min(1, score.standard / maxScore);
        score.bracket = Math.min(1, score.bracket / maxScore);

        return score;
    }

    /**
     * Quick check if text is likely from Slack.
     * Uses multiple pattern indicators to determine if content appears to be
     * from a Slack conversation export.
     * @param {string} text - The text to check
     * @returns {boolean} True if text appears to be from Slack
     */
    isLikelySlack(text: string): boolean {
        if (!text) return false;

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
                    return true;
                }
            }
        }

        return false;
    }
}