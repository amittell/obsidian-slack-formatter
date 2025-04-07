// import { isMessageBoundary } from '../../utils/message-utils'; // Removed unused import
import type { FormatStrategyType } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import the new Logger

export class FormatDetector {
    // Removed protected logger property

    /**
     * Detects the format strategy based on content patterns.
     * @param content The raw input content.
     * @returns The detected format strategy type.
     */
    detectFormat(content: string): FormatStrategyType {
        this.log('info', 'Detecting format...');
        if (!content || typeof content !== 'string') {
            this.log('warn', 'Invalid content for format detection, defaulting to standard.');
            return 'standard';
        }

        
                // More robust check for bracket format using regex (checks start of lines)
                // Looks for "[Message from ...]" at the start of any line (m flag)
                const bracketMessageRegex = /^\[Message from .+\]/m;
                // Looks for "[Time: ...]" at the start of any line (m flag)
                const bracketTimeRegex = /^\[Time: .+\]/m;
                if (bracketMessageRegex.test(content) && bracketTimeRegex.test(content)) {
                     this.log('info', 'Detected bracket format via regex.');
        }

        // Add more sophisticated checks if needed, e.g., analyzing line patterns or message structure

        this.log('info', 'Defaulting to standard format.');
        return 'standard'; // Default to standard if no specific format detected
    }

    /**
     * Checks if the text likely originates from Slack based on common patterns.
     * @param text The input text.
     * @returns True if the text appears to be from Slack.
     */
    isLikelySlack(text: string): boolean {
        this.log('info', 'Checking if text is likely Slack...');
        if (!text) return false;

        const lines = text.split('\n');
        let slackPatternCount = 0;
        const threshold = 2; // Number of patterns needed to be considered likely Slack

        // Check for common Slack patterns - if enough match, assume it's Slack content
        const patterns = [
            /^\d{1,2}:\d{2}\s*(?:AM|PM)$/i,                 // Timestamp (e.g., "10:30 AM") at start/end of line
            /^.+? \[\d{1,2}:\d{2}\s*(?:AM|PM)\]$/,          // Standard format: "Username [10:30 AM]" at end of line
            /^\w+ \d{1,2}(?:st|nd|rd|th)(?:, \d{4})?$/,    // Date separator (e.g., "July 4th", "July 4th, 2024")
            /replied to a thread:/,                       // Thread reply indicator text
            /View thread/,                                 // "View thread" link text
            /:[\w+-]+:/,                                   // Emoji code pattern (e.g., ":smile:", ":+1:")
            /<@U[A-Z0-9]+>/,                               // User mention pattern (e.g., "<@U123ABC>")
            /uploaded a file:/,                           // File upload indicator text
            /joined the channel/,                         // Join message text
            /\[Message from .+\]/,                         // Bracket format message start indicator
            /\[Time: .+\]/,                               // Bracket format time indicator
        ];

        for (const line of lines) {
            for (const pattern of patterns) {
                if (pattern.test(line)) {
                    slackPatternCount++;
                    // Optimization: If threshold is met, no need to check further
                    if (slackPatternCount >= threshold) {
                         this.log('info', `Likely Slack format detected (found ${slackPatternCount} patterns).`);
                         return true;
                    }
                    break; // Move to the next line once a pattern is found in the current line
                }
            }
        }

        this.log('info', `Not likely Slack format (found ${slackPatternCount} patterns).`);
        return false;
    }

    // Replace previous log method with calls to static Logger
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        Logger[level](this.constructor.name, message, data);
    }
}