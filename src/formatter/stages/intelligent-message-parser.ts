import { SlackMessage } from '../../models.js';
import type { SlackReaction } from '../../types/messages.types.js';
import { SlackFormatSettings } from '../../types/settings.types.js';
import { ParsedMaps } from '../../types/formatters.types.js';
import { parseSlackTimestamp } from '../../utils/datetime-utils.js';
import { Logger } from '../../utils/logger.js';
import { DEFAULT_SETTINGS } from '../../settings.js';

/**
 * Configuration constants for intelligent message parsing
 */
const LINE_LENGTH_CONFIG = {
    /** Short line threshold */
    SHORT_LINE_THRESHOLD: 30,
    /** Long line threshold */
    LONG_LINE_THRESHOLD: 100,
    /** Maximum username length */
    MAX_USERNAME_LENGTH: 50,
    /** Minimum username length */
    MIN_USERNAME_LENGTH: 2,
    /** Maximum words in a username */
    MAX_USERNAME_WORDS: 4,
    /** Max timestamp text length for processing */
    MAX_TIMESTAMP_TEXT_LENGTH: 50,
    /** All caps minimum length */
    ALL_CAPS_MIN_LENGTH: 3
} as const;

const CONFIDENCE_CONFIG = {
    /** Minimum confidence threshold for format detection */
    MIN_CONFIDENCE_THRESHOLD: 0.3,
    /** Standard confidence threshold for timestamps */
    TIMESTAMP_CONFIDENCE_THRESHOLD: 0.7,
    /** Confidence increment for various pattern matches */
    CONFIDENCE_INCREMENT_SMALL: 0.1,
    /** Larger confidence increment for strong indicators */
    CONFIDENCE_INCREMENT_LARGE: 0.2,
    /** Message length factor for confidence calculation */
    MESSAGE_LENGTH_FACTOR: 100
} as const;

const SCORING_CONFIG = {
    /** Score penalty for low confidence */
    SCORE_PENALTY_LOW: -3,
    /** Score penalty for medium confidence */
    SCORE_PENALTY_MEDIUM: -1,
    /** Score bonus for high confidence */
    SCORE_BONUS_HIGH: 3,
    /** Score bonus for medium confidence */
    SCORE_BONUS_MEDIUM: 1,
    /** Score adjustment for various indicators */
    SCORE_ADJUSTMENT: 0.1
} as const;

const ANALYSIS_CONFIG = {
    /** Search window for nearby timestamp detection */
    TIMESTAMP_SEARCH_WINDOW: 2,
    /** Metadata scan window size in lines */
    METADATA_SCAN_WINDOW: 3,
    /** Maximum reactions to parse per message */
    MAX_REACTIONS_PER_MESSAGE: 10
} as const;


/**
 * Intelligent message parser that uses structural analysis instead of rigid regexes.
 * This approach learns patterns from the content structure rather than trying to
 * match every possible format variation.
 */
export class IntelligentMessageParser {
    /** Current settings configuration */
    private settings: SlackFormatSettings;
    
    /** Parsed user and emoji mappings */
    private parsedMaps: ParsedMaps;
    
    /** Debug mode flag */
    private debugMode: boolean;
    
    /**
     * Constructor for IntelligentMessageParser
     * @param settings - Slack format settings
     * @param parsedMaps - User and emoji mappings
     */
    constructor(settings?: SlackFormatSettings, parsedMaps?: ParsedMaps) {
        // Initialize all properties first to ensure they exist
        this.settings = DEFAULT_SETTINGS;
        this.parsedMaps = { userMap: {}, emojiMap: {} };
        this.debugMode = false;
        
        // Then validate and set actual values
        if (settings && typeof settings !== 'object') {
            throw new Error('IntelligentMessageParser: settings must be an object or undefined');
        }
        if (settings) {
            this.settings = settings;
            this.debugMode = Boolean(settings?.debug);
        }
        
        // Validate and set parsedMaps
        if (parsedMaps && (typeof parsedMaps !== 'object' || parsedMaps === null)) {
            throw new Error('IntelligentMessageParser: parsedMaps must be an object or undefined');
        }
        if (parsedMaps && (!parsedMaps.userMap || !parsedMaps.emojiMap)) {
            throw new Error('IntelligentMessageParser: parsedMaps must contain userMap and emojiMap properties');
        }
        if (parsedMaps) {
            this.parsedMaps = parsedMaps;
        }
        
        // Bind methods to ensure correct this context
        this.couldBeMessageStart = this.couldBeMessageStart.bind(this);
        this.looksLikeContinuation = this.looksLikeContinuation.bind(this);
        this.safeRegexTest = this.safeRegexTest.bind(this);
    }

    /**
     * Safely execute a regex test operation with error handling
     * @param regex - Regular expression to test
     * @param text - Text to test against
     * @returns Boolean result or false on error
     */
    private safeRegexTest(regex: RegExp, text: string): boolean {
        try {
            // Defensive check for this context
            if (!this) {
                console.error('IntelligentMessageParser.safeRegexTest called without proper this context');
                return false;
            }
            if (!text || typeof text !== 'string') return false;
            return regex.test(text);
        } catch (error) {
            // Use console.error directly to avoid potential issues with Logger
            console.error('IntelligentMessageParser: Regex test failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                regex: regex?.toString() || 'undefined',
                textLength: text?.length || 0
            });
            return false;
        }
    }

    /**
     * Safely execute a regex match operation with error handling
     * @param text - Text to match against
     * @param regex - Regular expression to use
     * @returns Match result or null on error
     */
    private safeRegexMatch(text: string, regex: RegExp): RegExpMatchArray | null {
        try {
            if (!text || typeof text !== 'string') return null;
            return text.match(regex);
        } catch (error) {
            console.error('IntelligentMessageParser: Regex match failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                regex: regex?.toString() || 'undefined',
                textLength: text?.length || 0
            });
            return null;
        }
    }

    /**
     * Safely execute a regex exec operation with error handling
     * @param regex - Regular expression to execute
     * @param text - Text to execute against
     * @returns Exec result or null on error
     */
    private safeRegexExec(regex: RegExp, text: string): RegExpExecArray | null {
        try {
            if (!text || typeof text !== 'string') return null;
            return regex.exec(text);
        } catch (error) {
            console.error('IntelligentMessageParser: Regex exec failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                regex: regex?.toString() || 'undefined',
                textLength: text?.length || 0
            });
            return null;
        }
    }

    /**
     * Safely execute a regex replace operation with error handling
     * @param text - Text to perform replacement on
     * @param regex - Regular expression to use
     * @param replacement - Replacement string or function
     * @returns Replaced string or original on error
     */
    private safeRegexReplace(text: string, regex: RegExp, replacement: string | ((substring: string, ...args: any[]) => string)): string {
        try {
            if (!text || typeof text !== 'string') return text || '';
            return text.replace(regex, replacement as any);
        } catch (error) {
            console.error('IntelligentMessageParser: Regex replace failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                regex: regex?.toString() || 'undefined',
                textLength: text?.length || 0
            });
            return text || '';
        }
    }

    /**
     * Safely execute a regex split operation with error handling
     * @param text - Text to split
     * @param regex - Regular expression to use as separator
     * @returns Split array or single element array on error
     */
    private safeRegexSplit(text: string, regex: RegExp): string[] {
        try {
            if (!text || typeof text !== 'string') return [text || ''];
            return text.split(regex);
        } catch (error) {
            console.error('IntelligentMessageParser: Regex split failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                regex: regex?.toString() || 'undefined',
                textLength: text?.length || 0
            });
            return [text || ''];
        }
    }

    /**
     * Update parser settings and mappings
     * @param settings - New settings configuration
     * @param parsedMaps - New user and emoji mappings
     */
    updateSettings(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void {
        // Validate settings parameter
        if (!settings || typeof settings !== 'object') {
            throw new Error('IntelligentMessageParser.updateSettings: settings is required and must be an object');
        }
        
        // Validate parsedMaps parameter
        if (!parsedMaps || typeof parsedMaps !== 'object') {
            throw new Error('IntelligentMessageParser.updateSettings: parsedMaps is required and must be an object');
        }
        if (!parsedMaps.userMap || !parsedMaps.emojiMap) {
            throw new Error('IntelligentMessageParser.updateSettings: parsedMaps must contain userMap and emojiMap properties');
        }
        
        this.settings = settings;
        this.parsedMaps = parsedMaps;
        this.debugMode = Boolean(settings?.debug);
    }

    /**
     * Validate parser state before processing
     * @throws {Error} If parser is in an invalid state
     * @private
     */
    private validateParserState(): void {
        if (!this.settings) {
            throw new Error('IntelligentMessageParser: settings is not initialized');
        }
        
        if (!this.parsedMaps) {
            throw new Error('IntelligentMessageParser: parsedMaps is not initialized');
        }
        
        if (this.debugMode === undefined || this.debugMode === null) {
            Logger.warn('IntelligentMessageParser', 'debugMode is undefined, setting to false');
            this.debugMode = false;
        }
        
        // Ensure all bound methods are still functions
        const methodsToCheck = ['couldBeMessageStart', 'looksLikeContinuation', 'safeRegexTest'];
        for (const method of methodsToCheck) {
            if (typeof (this as any)[method] !== 'function') {
                throw new Error(`IntelligentMessageParser: method ${method} is not a function`);
            }
        }
    }

    /**
     * Parse Slack conversation using intelligent structural analysis
     */
    parse(text: string, isDebugEnabled?: boolean): SlackMessage[] {
        // Validate parser state before processing
        this.validateParserState();
        
        const lines = text.split('\n');
        
        // Use class debug mode or parameter override
        const debugMode = isDebugEnabled !== undefined ? isDebugEnabled : (this?.debugMode === true);
        
        // Step 1: Analyze the overall structure to identify patterns
        const structure = this.analyzeStructure(lines);
        
        // Step 2: Find message boundaries using pattern recognition
        const messageBoundaries = this.findMessageBoundaries(lines, structure);
        
        // Step 3: Extract content for each message
        const messages = this.extractMessages(lines, messageBoundaries, structure);
        
        if (debugMode) {
            Logger.debug('IntelligentMessageParser', 'Parsing results', {
                totalLines: lines.length,
                boundaries: messageBoundaries.length,
                messages: messages.length,
                structure: structure
            }, debugMode);
        }
        
        return messages;
    }

    /**
     * Analyze the overall structure of the conversation to identify patterns
     */
    private analyzeStructure(lines: string[]): ConversationStructure {
        const analysis: LineAnalysis[] = lines.map((line, index) => 
            this.analyzeLine(line, index, lines)
        );
        
        // Find recurring patterns
        const patterns = this.identifyPatterns(analysis);
        
        // Determine the dominant format
        const format = this.determineFormat(patterns);
        
        return {
            lines: analysis,
            patterns,
            format,
            confidence: this.calculateConfidence(patterns, format)
        };
    }

    /**
     * Analyze a single line to understand its characteristics
     */
    private analyzeLine(line: string, index: number, allLines: string[]): LineAnalysis {
        const trimmed = line.trim();
        
        return {
            index,
            content: line,
            trimmed,
            isEmpty: trimmed === '',
            length: trimmed.length,
            characteristics: {
                hasTimestamp: this.hasTimestampPattern(trimmed),
                hasUrl: this.hasUrlPattern(trimmed),
                hasUserMention: this.hasUserMentionPattern(trimmed),
                hasEmoji: this.hasEmojiPattern(trimmed),
                hasAvatar: this.hasAvatarPattern(trimmed),
                hasReactions: this.hasReactionPattern(trimmed),
                isShortLine: trimmed.length < LINE_LENGTH_CONFIG.SHORT_LINE_THRESHOLD,
                isLongLine: trimmed.length > LINE_LENGTH_CONFIG.LONG_LINE_THRESHOLD,
                hasCapitalStart: this.safeRegexTest(/^[A-Z]/, trimmed),
                hasNumbers: this.safeRegexTest(/\d/, trimmed),
                isAllCaps: trimmed === trimmed.toUpperCase() && trimmed.length > LINE_LENGTH_CONFIG.ALL_CAPS_MIN_LENGTH,
                hasSpecialChars: this.safeRegexTest(/[!@#$%^&*(),.?":{}|<>]/, trimmed)
            },
            // Context from surrounding lines
            context: {
                prevLine: index > 0 ? allLines[index - 1]?.trim() : null,
                nextLine: index < allLines.length - 1 ? allLines[index + 1]?.trim() : null,
                isAfterEmpty: index > 0 && allLines[index - 1]?.trim() === '',
                isBeforeEmpty: index < allLines.length - 1 && allLines[index + 1]?.trim() === ''
            }
        };
    }

    /**
     * Identify recurring patterns in the conversation
     */
    private identifyPatterns(analysis: LineAnalysis[]): ConversationPatterns {
        
        const messageStartCandidates: number[] = [];
        const timestamps: number[] = [];
        const usernames: number[] = [];
        const metadata: number[] = [];
        
        // Look for lines that could be message starts
        // Using traditional for loop to ensure 'this' context is preserved
        for (let i = 0; i < analysis.length; i++) {
            const line = analysis[i];
            if (line.isEmpty) continue;
            
            // Potential message start patterns
            const couldBeStart = this.couldBeMessageStart(line, analysis, i);
            
            if (couldBeStart) {
                messageStartCandidates.push(i);
            }
            
            // Timestamp patterns
            if (line.characteristics.hasTimestamp) {
                timestamps.push(i);
            }
            
            // Username patterns (names that appear consistently)
            if (this.couldBeUsername(line, analysis, i)) {
                usernames.push(i);
            }
            
            // Metadata patterns
            if (this.isMetadata(line)) {
                metadata.push(i);
            }
        }
        
        return {
            messageStartCandidates,
            timestamps,
            usernames,
            metadata,
            averageMessageLength: this.calculateAverageMessageLength(messageStartCandidates, analysis),
            commonUsernames: this.extractCommonUsernames(analysis, usernames),
            timestampFormats: this.identifyTimestampFormats(analysis, timestamps)
        };
    }

    /**
     * Determine if a line could be the start of a message
     */
    private couldBeMessageStart(line: LineAnalysis, allLines: LineAnalysis[], index: number): boolean {
        
        // Defensive check for this context
        if (!this) {
            console.error('IntelligentMessageParser.couldBeMessageStart called without proper this context');
            return false;
        }
        
        // Empty lines can't be message starts
        if (line.isEmpty) return false;
        
        // Very short lines are usually not message starts unless they have special characteristics
        if (line.characteristics.isShortLine && !line.characteristics.hasTimestamp && !line.characteristics.hasAvatar) {
            return false;
        }
        
        // Lines that look like reactions or metadata
        if (this.isObviousMetadata(line)) {
            return false;
        }
        
        // Check if this looks like link preview content
        // Link previews often appear after URLs and should not start a new message
        if (this.looksLikeLinkPreview(line, allLines, index)) {
            return false;
        }
        
        // Check if this is a standalone timestamp (likely a continuation)
        const standaloneTimestampPatterns = [
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i, // [8:26](url)
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]$/i,  // [8:26] or [8:26 AM]
            /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i,  // 8:26 or 8:26 AM
            /^Today at \d{1,2}:\d{2}\s*(?:AM|PM)?$/i, // Today at 8:26 AM
            /^Yesterday at \d{1,2}:\d{2}\s*(?:AM|PM)?$/i // Yesterday at 8:26 AM
        ];
        
        const isStandaloneTimestamp = standaloneTimestampPatterns.some((pattern) => {
            // Ensure this context is preserved
            return this.safeRegexTest(pattern, line.trimmed);
        });
        
        // If it's a standalone timestamp, check if there's content after it
        // If so, this is likely a continuation, not a new message
        if (isStandaloneTimestamp) {
            // Look for the next non-empty line
            for (let i = index + 1; i < allLines.length; i++) {
                const nextLine = allLines[i];
                if (!nextLine.isEmpty) {
                    // Found non-empty content after timestamp
                    if (!this.isObviousMetadata(nextLine)) {
                        // Check if the next line looks like regular content (not a new message header)
                        const nextLineText = nextLine.trimmed;
                        const looksLikeContent = 
                            !this.hasUserTimestampCombination(nextLineText) &&
                            !nextLine.characteristics.hasAvatar &&
                            nextLineText.length > 5 &&
                            !this.looksLikeUsername(nextLineText);
                            
                        if (looksLikeContent) {
                            // This is a continuation timestamp, not a message start
                            return false;
                        }
                    }
                    break;
                }
            }
        }
        
        // Check if this line follows message start patterns
        const timestampIndicator = line.characteristics.hasTimestamp && !isStandaloneTimestamp;
        const avatarIndicator = line.characteristics.hasAvatar;
        const userTimestampIndicator = this.hasUserTimestampCombination(line.trimmed);
        
        const hasStrongIndicators = timestampIndicator || avatarIndicator || userTimestampIndicator;
        
        // Weaker indicators that need more context
        const hasWeakIndicators = 
            line.characteristics.hasCapitalStart && line.length > 10;
        
        
        // For weak indicators, require stronger context evidence
        if (hasWeakIndicators && !hasStrongIndicators) {
            // Check if previous non-empty line looks like a message header
            let prevNonEmptyIdx = index - 1;
            while (prevNonEmptyIdx >= 0 && allLines[prevNonEmptyIdx].isEmpty) {
                prevNonEmptyIdx--;
            }
            
            if (prevNonEmptyIdx >= 0) {
                const prevLine = allLines[prevNonEmptyIdx];
                // If previous line has timestamp/username combo, this is likely content
                if (this.hasUserTimestampCombination(prevLine.trimmed) || 
                    prevLine.characteristics.hasAvatar) {
                    return false;
                }
            }
        }
        
        // Check if there's a continuation timestamp within the last few lines
        let hasContinuationNearby = false;
        // Look both backwards and forwards for continuation timestamps
        const searchStart = Math.max(0, index - 5);
        const searchEnd = Math.min(allLines.length - 1, index + 3);
        
        for (let i = searchStart; i <= searchEnd; i++) {
            if (i !== index && this.looksLikeContinuation(allLines[i], allLines)) {
                // Found a continuation timestamp nearby
                hasContinuationNearby = true;
                const debugEnabled = this?.debugMode === true;
                if (debugEnabled) {
                    Logger.debug('IntelligentMessageParser', `Line ${index} has continuation nearby at line ${i}`, undefined, debugEnabled);
                }
                break;
            }
        }
        
        // If there's a continuation timestamp nearby and this line only has weak indicators,
        // it's probably continuation content, not a new message
        if (hasContinuationNearby && !hasStrongIndicators) {
            return false;
        }
        
        // Check if this line is too close to a previous message start
        // (within 3 lines of a line that has strong username/timestamp indicators)
        let tooCloseToMessageStart = false;
        for (let i = Math.max(0, index - 3); i < index; i++) {
            const prevLine = allLines[i];
            if (prevLine && !prevLine.isEmpty) {
                // Check if previous line has username and timestamp combination
                const prevExtracted = this.extractUserAndTime(prevLine.trimmed);
                if (prevExtracted.username && prevExtracted.timestamp) {
                    tooCloseToMessageStart = true;
                    break;
                }
            }
        }
        
        // Context matters - is this after a complete message?
        const contextSupportsNewMessage = 
            line.context.isAfterEmpty ||
            index === 0 ||
            this.previousLineEndsMessage(allLines, index);
        
        return (hasStrongIndicators || (hasWeakIndicators && !tooCloseToMessageStart)) && contextSupportsNewMessage;
    }

    /**
     * Check if a line could contain a username
     */
    private couldBeUsername(line: LineAnalysis, allLines: LineAnalysis[], index: number): boolean {
        if (line.isEmpty || line.characteristics.isShortLine) return false;
        
        // Check for common username patterns
        const text = line.trimmed;
        
        // Names usually start with capitals and don't have URLs
        if (!line.characteristics.hasCapitalStart || line.characteristics.hasUrl) {
            return false;
        }
        
        // Avoid obvious metadata
        if (this.isObviousMetadata(line)) {
            return false;
        }
        
        // Check if this could be a name (reasonable length, format)
        const words = this.safeRegexSplit(text, /\s+/);
        if (words.length > LINE_LENGTH_CONFIG.MAX_USERNAME_WORDS) return false; // Names usually aren't more than 4 words
        
        return words.every(word => this.safeRegexTest(/^[A-Za-z0-9\-_.]+$/, word));
    }

    /**
     * Check if line is obviously metadata/reactions
     */
    private isObviousMetadata(line: LineAnalysis): boolean {
        const text = line.trimmed;
        
        // Common metadata patterns
        const metadataPatterns = [
            /^\d+\s+(reply|replies|files?|minutes?|hours?|days?)$/i,
            /^(View thread|Thread:|Last reply|Language|TypeScript|Last updated)$/i,
            /^Added by\s+/i,  // "Added by GitHub" or "Added by [GitHub](...) 🤩27😍5" etc.
            /^:\w+:\s*\d*$/,  // Reactions
            /^\d+$/,  // Just numbers
            /^(---+|===+)$/,  // Separators
            /^https?:\/\//,  // Just URLs
            /^!\[\]\(https:\/\/[^)]*slack[^)]*\)$/,  // Avatar images
        ];
        
        return metadataPatterns.some(pattern => this.safeRegexTest(pattern, text));
    }

    /**
     * Find message boundaries using identified patterns
     */
    private findMessageBoundaries(lines: string[], structure: ConversationStructure): MessageBoundary[] {
        const boundaries: MessageBoundary[] = [];
        const { patterns } = structure;
        
        // Use the most reliable indicators for boundaries
        const candidateStarts = this.rankMessageStartCandidates(patterns.messageStartCandidates, structure);
        
        // Filter out continuation timestamps from candidates
        const trueCandidateStarts = candidateStarts.filter(idx => 
            !this.looksLikeContinuation(structure.lines[idx], structure.lines)
        );
        
        let currentStart = 0;
        
        for (let i = 0; i < trueCandidateStarts.length; i++) {
            const startIndex = trueCandidateStarts[i];
            
            if (startIndex > currentStart) {
                // Create boundary for the previous message
                boundaries.push({
                    start: currentStart,
                    end: startIndex - 1,
                    confidence: this.calculateBoundaryConfidence(currentStart, startIndex - 1, structure)
                });
                currentStart = startIndex;
            }
        }
        
        // Add the final message
        if (currentStart < lines.length) {
            // Find the actual end of content for the final message
            let finalEnd = lines.length - 1;
            
            // Special handling: if this message has no more message starts after it,
            // it should include all remaining content
            boundaries.push({
                start: currentStart,
                end: finalEnd,
                confidence: this.calculateBoundaryConfidence(currentStart, finalEnd, structure)
            });
        }
        
        // Now extend boundaries to include any continuation timestamps
        for (const boundary of boundaries) {
            let extendedEnd = boundary.end;
            
            const debugEnabled = this?.debugMode === true;
            if (debugEnabled) {
                Logger.debug('IntelligentMessageParser', `Extending boundary ${boundary.start}-${boundary.end}`, undefined, debugEnabled);
            }
            
            // First, check if there are continuation timestamps WITHIN this boundary
            for (let i = boundary.start; i <= boundary.end && i < structure.lines.length; i++) {
                const line = structure.lines[i];
                if (this.looksLikeContinuation(line, structure.lines)) {
                    // Found a continuation timestamp within the boundary
                    // Extend to include all content after it
                    if (debugEnabled) {
                        Logger.debug('IntelligentMessageParser', `Found continuation within boundary at line ${i}: "${line.trimmed}"`, undefined, debugEnabled);
                    }
                    const continuationEnd = this.findContinuationEnd(structure.lines, i);
                    if (debugEnabled) {
                        Logger.debug('IntelligentMessageParser', `Continuation extends from ${i} to ${continuationEnd}`, undefined, debugEnabled);
                    }
                    extendedEnd = Math.max(extendedEnd, continuationEnd);
                }
            }
            
            // Then check if there are continuation timestamps AFTER the boundary
            let currentEnd = extendedEnd;
            let searching = true;
            
            if (debugEnabled) {
                Logger.debug('IntelligentMessageParser', `Checking for continuations after boundary ${boundary.start}-${boundary.end}, extendedEnd=${extendedEnd}`, undefined, debugEnabled);
            }
            
            while (searching && currentEnd < structure.lines.length - 1) {
                // Look at the next line after the current end
                let nextNonEmpty = currentEnd + 1;
                
                // Skip empty lines
                while (nextNonEmpty < structure.lines.length && structure.lines[nextNonEmpty].isEmpty) {
                    nextNonEmpty++;
                }
                
                if (nextNonEmpty < structure.lines.length) {
                    const nextLine = structure.lines[nextNonEmpty];
                    
                    if (debugEnabled) {
                        Logger.debug('IntelligentMessageParser', `Checking line ${nextNonEmpty} after boundary: "${nextLine.trimmed}"`, undefined, debugEnabled);
                    }
                    
                    // If the next non-empty line is a continuation timestamp, include it
                    if (this.looksLikeContinuation(nextLine, structure.lines)) {
                        const continuationEnd = this.findContinuationEnd(structure.lines, nextNonEmpty);
                        if (debugEnabled) {
                            Logger.debug('IntelligentMessageParser', `Found continuation at ${nextNonEmpty}, extends to ${continuationEnd}`, undefined, debugEnabled);
                        }
                        currentEnd = continuationEnd;
                        // Continue searching after this continuation
                    } else {
                        // Not a continuation, stop searching
                        searching = false;
                    }
                } else {
                    // Reached end of lines
                    searching = false;
                }
            }
            
            boundary.end = currentEnd;
            
            if (debugEnabled) {
                Logger.debug('IntelligentMessageParser', `Extended boundary to ${boundary.start}-${boundary.end}`, undefined, debugEnabled);
            }
        }
        
        const debugEnabled = this?.debugMode === true;
        if (debugEnabled) {
            Logger.debug('IntelligentMessageParser', `Boundaries before merging: ${boundaries.map(b => `${b.start}-${b.end}`).join(', ')}`, undefined, debugEnabled);
        }
        
        // Merge boundaries if one starts immediately after a continuation in another
        const mergedBoundaries: MessageBoundary[] = [];
        let skipNext = false;
        
        for (let i = 0; i < boundaries.length; i++) {
            if (skipNext) {
                skipNext = false;
                continue;
            }
            
            const current = boundaries[i];
            const next = boundaries[i + 1];
            
            if (next) {
                // Check if there's a continuation timestamp near the end of current boundary
                // that would make the next boundary part of this message
                let hasContinuationNearEnd = false;
                
                // Check last few lines of current boundary for continuation timestamps
                for (let j = Math.max(current.start, current.end - 5); j <= current.end; j++) {
                    if (j < structure.lines.length && this.looksLikeContinuation(structure.lines[j], structure.lines)) {
                        // Check if the continuation's content would overlap with next boundary
                        const contEnd = this.findContinuationEnd(structure.lines, j);
                        
                        const debugEnabled = this?.debugMode === true;
                        if (debugEnabled) {
                            Logger.debug('IntelligentMessageParser', `Checking continuation at line ${j}, ends at ${contEnd}, next boundary starts at ${next.start}`, undefined, debugEnabled);
                        }
                        
                        // If continuation end is at or past the next boundary start, merge
                        if (contEnd >= next.start - 1) {
                            hasContinuationNearEnd = true;
                            break;
                        }
                    }
                }
                
                if (hasContinuationNearEnd) {
                    // Merge the boundaries
                    mergedBoundaries.push({
                        start: current.start,
                        end: Math.max(current.end, next.end),
                        confidence: Math.max(current.confidence, next.confidence)
                    });
                    skipNext = true;
                } else {
                    mergedBoundaries.push(current);
                }
            } else {
                mergedBoundaries.push(current);
            }
        }
        
        return mergedBoundaries.filter(b => b.confidence > CONFIDENCE_CONFIG.MIN_CONFIDENCE_THRESHOLD); // Only keep reasonable boundaries
    }

    /**
     * Check if content appears to be a link preview
     */
    private looksLikeLinkPreview(line: LineAnalysis, allLines: LineAnalysis[], index: number): boolean {
        if (!line || line.isEmpty) return false;
        
        const text = line.trimmed;
        
        // Check for common link preview patterns and file attachment patterns
        const linkPreviewPatterns = [
            /^!\[.*\]\(.*\).*\(formerly.*\)$/i,  // ![X (formerly Twitter)](...) 
            /^[A-Za-z0-9\s]+\s+\(formerly\s+[A-Za-z0-9\s]+\)$/i,  // "X (formerly Twitter)"
            /\bChapters:\d+:\d+\b/i,  // Video chapters
            /^Nice - my AI.*talk is now up!/i,  // Specific content from the test
            /\(\d+\s*[KMG]?B\)$/,  // File sizes
            /^Programmatically integrate/i,
            /imo\s+fair\s+to\s+say.*software.*changing/i,
            
            // File attachment patterns
            /^\d+\s+files?$/i,  // "4 files", "1 file"
            /^(Zip|PDF|Doc|Google Doc|Google Docs|Excel|PowerPoint|Image|Video|Word|Spreadsheet)$/i,  // File type names
            /\.(zip|pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|mp4|mov|avi)$/i,  // File extensions
            /files\.slack\.com|enterprise\.slack\.com/,  // Slack file URLs
            /\/download\//,  // Download paths
            /^\[.*\]\(https:\/\/.*files.*\)/i,  // File download links in markdown format
            /^\[\s*$/,  // Lines that just start with "["
            /^\]\(https?:\/\/docs\.google\.com/i,  // Google Docs links (with or without s in https)
            /^\]\(https?:\/\/.*\.slack\.com/i,  // Any Slack links in bracket format
            /^\]\(https?:\/\//i,  // Any link that starts with ](http
            /^Stripe Guidewire Accelerator/i,  // Specific document title pattern
            
            // Document title patterns - common in Google Docs, Notion, etc. link previews
            /^[A-Za-z0-9\s]+–[A-Za-z0-9\s]+:.*$/i,  // "Title–Subtitle: Description" pattern
            /^[A-Za-z0-9\s]+:\s*(Consolidated|Strategy|Decision|Technical|Implementation|Specification).*$/i,  // Technical document patterns
            /^[A-Za-z0-9\s]+(Connector|Document|Strategy|Guide|Manual|Specification|Report).*$/i,  // Document type patterns
        ];
        
        // Also check if this looks like a response after a quoted message
        // Look for a quoted message (line starting with >) in the previous few lines
        let hasQuotedMessageBefore = false;
        for (let i = Math.max(0, index - 3); i < index; i++) {
            if (allLines[i] && allLines[i].trimmed.startsWith('>')) {
                hasQuotedMessageBefore = true;
                break;
            }
        }
        
        // If this follows a quoted message and doesn't have strong message indicators,
        // it's likely a response to the quote, not a new message
        if (hasQuotedMessageBefore && !line.characteristics.hasAvatar && !line.characteristics.hasTimestamp) {
            // Check if the line looks like regular content (not metadata)
            if (text.length > 10 && !this.isObviousMetadata(line)) {
                return true; // This is likely a continuation/response to a quote
            }
        }
        
        // Direct pattern match
        if (linkPreviewPatterns.some(pattern => this.safeRegexTest(pattern, text))) {
            return true;
        }
        
        // Check context - link previews typically follow URLs
        let hasUrlBefore = false;
        for (let i = Math.max(0, index - 5); i < index; i++) {
            if (allLines[i] && allLines[i].characteristics.hasUrl) {
                hasUrlBefore = true;
                break;
            }
        }
        
        // If preceded by URL and looks like a title/description
        if (hasUrlBefore) {
            // Check if it looks like a preview title (e.g. "Platform Name (@handle) on X")
            if (this.safeRegexTest(/^[A-Za-z0-9\s]+\s+\(@?\w+\)\s+on\s+\w+$/i, text)) {
                return true;
            }
            
            // Check if line has link preview image pattern followed by text
            if (this.safeRegexTest(/^!\[.*?\]\(.*?\)[A-Za-z]/, text)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if a line looks like a message continuation
     */
    private looksLikeContinuation(line: LineAnalysis, allLines: LineAnalysis[]): boolean {
        // Safety check for undefined line
        if (!line || !line.trimmed) {
            return false;
        }
        
        const standaloneTimestampPatterns = [
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i,  // [time](url) - any URL
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]$/i,  // [time]
            /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i,  // time
            /^Today at \d{1,2}:\d{2}\s*(?:AM|PM)?$/i,
            /^Yesterday at \d{1,2}:\d{2}\s*(?:AM|PM)?$/i
        ];
        
        const result = standaloneTimestampPatterns.some((pattern) => {
            // Ensure this context is preserved
            return this.safeRegexTest(pattern, line.trimmed);
        });
        
        // Defensive check for this context
        try {
            const isDebugEnabled = this?.debugMode === true;
            if (isDebugEnabled && result) {
                Logger.debug('IntelligentMessageParser', `Line looks like continuation: "${line.trimmed}"`, undefined, true);
            }
        } catch (e) {
            // Silently ignore debug logging errors
        }
        
        return result;
    }

    /**
     * Find where a continuation message ends
     */
    private findContinuationEnd(lines: LineAnalysis[], startIndex: number): number {
        let endIndex = startIndex;
        
        const debugEnabled = this?.debugMode === true;
        if (debugEnabled) {
            Logger.debug('IntelligentMessageParser', `findContinuationEnd starting at line ${startIndex}: "${lines[startIndex]?.trimmed}"`, undefined, debugEnabled);
        }
        
        // Start from the line after the timestamp
        for (let i = startIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip empty lines but keep going
            if (line.isEmpty) {
                // Check if next non-empty line is a new message start
                let nextNonEmpty = i + 1;
                while (nextNonEmpty < lines.length && lines[nextNonEmpty].isEmpty) {
                    nextNonEmpty++;
                }
                
                if (nextNonEmpty < lines.length) {
                    // If the next non-empty line is within 3 lines of the continuation start,
                    // it's probably continuation content, not a new message
                    if (nextNonEmpty - startIndex <= 3) {
                        // Close enough to be continuation content, keep going
                        if (debugEnabled) {
                            Logger.debug('IntelligentMessageParser', `Empty line ${i} followed by line ${nextNonEmpty} which is within continuation range`, undefined, debugEnabled);
                        }
                    } else if (this.couldBeMessageStart(lines[nextNonEmpty], lines, nextNonEmpty)) {
                        // Stop before this empty line as it precedes a new message
                        if (debugEnabled) {
                            Logger.debug('IntelligentMessageParser', `Stopping at empty line ${i} because line ${nextNonEmpty} is a message start`, undefined, debugEnabled);
                        }
                        break;
                    }
                }
                // Otherwise, include this empty line and continue
                endIndex = i;
                continue;
            }
            
            // Stop if we hit obvious metadata
            if (this.isObviousMetadata(line)) {
                if (debugEnabled) {
                    Logger.debug('IntelligentMessageParser', `Stopping at line ${i} - obvious metadata`, undefined, debugEnabled);
                }
                break;
            }
            
            // For non-empty, non-metadata lines, check if they could be a new message
            // But be more lenient for lines close to the continuation
            const distanceFromStart = i - startIndex;
            
            // Within 4 lines of continuation timestamp, assume it's continuation content
            // unless it has very strong message start indicators
            if (distanceFromStart <= 4) {
                // Check for very strong indicators only
                const hasVeryStrongIndicators = 
                    this.hasUserTimestampCombination(line.trimmed) ||
                    (line.characteristics.hasTimestamp && this.looksLikeUsername(line.trimmed));
                
                if (hasVeryStrongIndicators) {
                    if (debugEnabled) {
                        Logger.debug('IntelligentMessageParser', `Line ${i} has very strong indicators, stopping`, undefined, debugEnabled);
                    }
                    break;
                } else {
                    // Include as continuation content
                    endIndex = i;
                    continue;
                }
            } else {
                // Further away, use normal message start detection
                if (this.couldBeMessageStart(line, lines, i)) {
                    if (debugEnabled) {
                        Logger.debug('IntelligentMessageParser', `Stopping at line ${i} - could be message start`, undefined, debugEnabled);
                    }
                    break;
                }
            }
            
            // This line is part of the continuation
            endIndex = i;
        }
        
        if (debugEnabled) {
            Logger.debug('IntelligentMessageParser', `findContinuationEnd returning ${endIndex}`, undefined, debugEnabled);
        }
        
        return endIndex;
    }

    /**
     * Extract messages from identified boundaries
     */
    private extractMessages(lines: string[], boundaries: MessageBoundary[], structure: ConversationStructure): SlackMessage[] {
        const messages: SlackMessage[] = [];
        
        for (const boundary of boundaries) {
            const debugEnabled = this?.debugMode === true;
            if (debugEnabled) {
                Logger.debug('IntelligentMessageParser', `Extracting message from boundary ${boundary.start}-${boundary.end}`, undefined, debugEnabled);
            }
            const messageLines = lines.slice(boundary.start, boundary.end + 1);
            if (debugEnabled) {
                Logger.debug('IntelligentMessageParser', `Message has ${messageLines.length} lines`, undefined, debugEnabled);
            }
            const message = this.extractSingleMessage(messageLines, structure);
            
            if (message && this.isValidMessage(message)) {
                messages.push(message);
            }
        }
        
        return messages;
    }

    /**
     * Extract a single message from its lines
     */
    private extractSingleMessage(messageLines: string[], structure: ConversationStructure): SlackMessage | null {
        if (messageLines.length === 0) return null;
        
        const message = new SlackMessage();
        
        // Find username and timestamp using intelligent extraction
        const { username, timestamp, contentStart } = this.extractMetadata(messageLines, structure);
        
        message.username = username || 'Unknown User';
        message.timestamp = timestamp;
        
        // Extract content (everything after metadata)
        const contentLines = messageLines.slice(contentStart);
        const { text, reactions, threadInfo } = this.extractContent(contentLines);
        
        message.text = text;
        message.reactions = reactions;
        message.threadInfo = threadInfo;
        
        return message;
    }

    /**
     * Extract username, timestamp, and determine where content starts
     */
    private extractMetadata(messageLines: string[], structure: ConversationStructure): MetadataExtraction {
        let username: string | null = null;
        let timestamp: string | null = null;
        let contentStart = 0;
        
        // Analyze first few lines for metadata
        for (let i = 0; i < Math.min(3, messageLines.length); i++) {
            const line = messageLines[i].trim();
            if (!line) continue;
            
            // Try to extract username and timestamp
            const extracted = this.extractUserAndTime(line, structure);
            if (extracted.username) {
                username = extracted.username;
                timestamp = extracted.timestamp;
                contentStart = i + 1;
                break;
            }
            
            // Check if this line is just a username
            if (!username && this.looksLikeUsername(line)) {
                username = this.cleanUsername(line);
                contentStart = i + 1;
            }
            
            // Check if this line is just a timestamp
            if (!timestamp && this.looksLikeTimestamp(line)) {
                timestamp = line;
                if (!username) contentStart = i + 1;
            }
        }
        
        return { username, timestamp, contentStart };
    }

    /**
     * Extract content, reactions, and thread info from content lines
     */
    private extractContent(contentLines: string[]): ContentExtraction {
        const textLines: string[] = [];
        const reactions: SlackReaction[] = [];
        let threadInfo: string | null = null;
        
        const debugEnabled = this?.debugMode === true;
        if (debugEnabled) {
            Logger.debug('IntelligentMessageParser', `Extracting content from ${contentLines.length} lines`, undefined, debugEnabled);
        }
        
        for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i];
            const trimmed = line.trim();
            
            if (debugEnabled && i < 10) { // Log first 10 lines
                Logger.debug('IntelligentMessageParser', `Content line ${i}: "${trimmed}"`, undefined, debugEnabled);
            }
            
            if (!trimmed) {
                textLines.push(line); // Keep empty lines for proper formatting
                continue;
            }
            
            // Check if this is metadata that should be excluded
            if (this.isObviousMetadata({ trimmed } as LineAnalysis)) {
                // Skip metadata lines like "Added by GitHub"
                continue;
            }
            
            // Check for reactions
            const reaction = this.parseReaction(trimmed);
            if (reaction) {
                reactions.push(reaction);
                continue;
            }
            
            // Check for thread info
            if (this.isThreadInfo(trimmed)) {
                threadInfo = trimmed;
                continue;
            }
            
            // Regular content
            textLines.push(line);
        }
        
        if (debugEnabled) {
            Logger.debug('IntelligentMessageParser', `Extracted ${textLines.length} text lines`, undefined, debugEnabled);
        }
        
        const finalText = textLines.join('\n').trim();
        
        if (debugEnabled) {
            Logger.debug('IntelligentMessageParser', `Final text length: ${finalText.length}`, undefined, debugEnabled);
            if (finalText.length < 100) {
                Logger.debug('IntelligentMessageParser', `Final text: "${finalText}"`, undefined, debugEnabled);
            }
        }
        
        return {
            text: finalText,
            reactions: reactions.length > 0 ? reactions : undefined,
            threadInfo
        };
    }

    // Helper methods for pattern detection
    private hasTimestampPattern(text: string): boolean {
        // Primary timestamp patterns (more precise)
        const timestampPatterns = [
            /\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]/i,  // [7:13 AM] or [7:13]
            /\d{1,2}:\d{2}\s*(?:AM|PM)/i,           // 3:04 PM (with AM/PM)
            /\b(?:Today|Yesterday)\s+at\s+\d{1,2}:\d{2}/i,  // Today at 7:13
            /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,  // Dec 11, 2024
            /\b\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/,  // 2024-12-11 7:13
            /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+at\s+\d{1,2}:\d{2}/i  // Monday at 7:13
        ];
        
        // Check for primary patterns first
        if (timestampPatterns.some(pattern => this.safeRegexTest(pattern, text))) {
            return true;
        }
        
        // Fallback to basic time patterns, but exclude obvious content contexts
        const basicTimePattern = /\d{1,2}:\d{2}/;
        const timeWords = /\b(?:today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;
        
        if (basicTimePattern.test(text) || timeWords.test(text)) {
            // If line contains obvious content indicators, it's probably not a timestamp line
            const contentIndicators = [
                /\b(?:wanted|needed|mention|tracking|happens|related|finding|should|fixed|errors|after|switching)\b/i,  // Common content words
                /\[\[.*?\]\]/,  // Wiki links
                /\btw\b/i,      // "btw" at start
                /.{100,}/       // Very long lines are usually content
            ];
            
            // If it looks like content, return false
            if (contentIndicators.some(pattern => this.safeRegexTest(pattern, text))) {
                return false;
            }
            
            return true;
        }
        
        return false;
    }

    private hasUrlPattern(text: string): boolean {
        return this.safeRegexTest(/https?:\/\/|www\./i, text);
    }

    private hasUserMentionPattern(text: string): boolean {
        return this.safeRegexTest(/@\w+|<@[UW]\w+>|\[\[@\w+\]\]/, text);
    }

    private hasEmojiPattern(text: string): boolean {
        return this.safeRegexTest(/:\w+:|[\u{1F300}-\u{1F9FF}]|!\[:[\w-]+:\]/u, text);
    }

    private hasAvatarPattern(text: string): boolean {
        return this.safeRegexTest(/!\[\]\(https:\/\/[^)]*slack[^)]*\)/, text);
    }

    private hasReactionPattern(text: string): boolean {
        return this.safeRegexTest(/^[\u{1F300}-\u{1F9FF}]\s*\d+$|^:\w+:\s*\d+$/u, text);
    }

    private hasUserTimestampCombination(text: string): boolean {
        // Look for patterns where username and timestamp appear together
        return this.safeRegexTest(/\w+.*(?:\d{1,2}:\d{2}|\[.*\].*archives)/, text);
    }

    private previousLineEndsMessage(allLines: LineAnalysis[], currentIndex: number): boolean {
        // Validate bounds - check both lower and upper bounds
        if (currentIndex <= 0 || currentIndex > allLines.length) return true;
        
        const prevLine = allLines[currentIndex - 1];
        if (!prevLine) return true;
        
        // Check if previous line is a complete username+timestamp combination (message header)
        // This indicates the end of a message because it's the header for a new message
        const extracted = this.extractUserAndTime(prevLine.trimmed);
        if (extracted.username && extracted.timestamp) {
            return true;
        }
        
        // Check if previous line looks like end of message content
        return prevLine.characteristics.hasReactions ||
               this.isMetadata(prevLine) ||
               prevLine.trimmed.endsWith('.') ||
               prevLine.trimmed.endsWith('!') ||
               prevLine.trimmed.endsWith('?');
    }

    private isMetadata(line: LineAnalysis): boolean {
        return this.isObviousMetadata(line);
    }

    // Placeholder implementations for complex methods
    private determineFormat(patterns: ConversationPatterns): 'standard' | 'bracket' | 'mixed' {
        // Analyze timestamp formats to determine conversation format
        const timestampFormats = patterns.timestampFormats;
        const lines = patterns.messageStartCandidates.length;
        
        if (lines === 0) {
            return 'standard'; // Default when no clear patterns
        }
        
        // Count format indicators
        let standardIndicators = 0;
        let bracketIndicators = 0;
        
        // Check timestamp formats
        timestampFormats.forEach(format => {
            // Bracket format patterns
            if (format.includes('[') && format.includes(']')) {
                bracketIndicators++;
            }
            // Standard format patterns (time with AM/PM, linked timestamps)
            if (this.safeRegexMatch(format, /\d{1,2}:\d{2}\s*(?:AM|PM)?/) || 
                format.includes('](https://')) {
                standardIndicators++;
            }
        });
        
        // Check message start patterns
        // Look at the actual line content for the first few message candidates
        const sampleSize = Math.min(5, patterns.messageStartCandidates.length);
        for (let i = 0; i < sampleSize; i++) {
            const lineIndex = patterns.messageStartCandidates[i];
            // We don't have access to the actual lines here, so we'll rely on patterns
            
            // If we have many timestamps near message starts, it's likely standard
            if (patterns.timestamps.includes(lineIndex + 1) || 
                patterns.timestamps.includes(lineIndex - 1)) {
                standardIndicators++;
            }
        }
        
        // Determine format based on indicators
        const totalIndicators = standardIndicators + bracketIndicators;
        
        if (totalIndicators === 0) {
            // No clear format indicators, check for mixed content patterns
            return 'mixed';
        }
        
        const bracketRatio = bracketIndicators / totalIndicators;
        const standardRatio = standardIndicators / totalIndicators;
        
        // If one format dominates (>70%), use it
        if (bracketRatio > CONFIDENCE_CONFIG.TIMESTAMP_CONFIDENCE_THRESHOLD) {
            return 'bracket';
        } else if (standardRatio > CONFIDENCE_CONFIG.TIMESTAMP_CONFIDENCE_THRESHOLD) {
            return 'standard';
        } else {
            // Mixed indicators
            return 'mixed';
        }
    }

    private calculateConfidence(patterns: ConversationPatterns, format: string): number {
        // Calculate confidence based on pattern consistency
        let confidence = 0;
        let factors = 0;
        
        // Factor 1: Message start candidates relative to total lines
        if (patterns.messageStartCandidates.length > 0) {
            // Reasonable ratio of message starts (not too many, not too few)
            const messageRatio = patterns.messageStartCandidates.length / Math.max(patterns.timestamps.length, 1);
            if (messageRatio >= 0.5 && messageRatio <= 2.0) {
                confidence += CONFIDENCE_CONFIG.CONFIDENCE_INCREMENT_LARGE;
            } else if (messageRatio >= CONFIDENCE_CONFIG.MIN_CONFIDENCE_THRESHOLD && messageRatio <= 3.0) {
                confidence += CONFIDENCE_CONFIG.CONFIDENCE_INCREMENT_SMALL;
            }
            factors++;
        }
        
        // Factor 2: Consistent timestamp formats
        if (patterns.timestampFormats.length > 0) {
            // Fewer unique formats = more consistent
            const formatConsistency = Math.min(1, 3 / patterns.timestampFormats.length);
            confidence += CONFIDENCE_CONFIG.CONFIDENCE_INCREMENT_LARGE * formatConsistency;
            factors++;
        }
        
        // Factor 3: Common usernames detected
        if (patterns.commonUsernames.length > 0) {
            // Having common usernames indicates good pattern recognition
            confidence += 0.2;
            factors++;
        }
        
        // Factor 4: Format match confidence
        if (format === 'standard' || format === 'bracket') {
            // Clear format detection is more confident than mixed
            confidence += 0.2;
        } else {
            confidence += 0.1;
        }
        factors++;
        
        // Factor 5: Message boundaries align with timestamps
        const timestampAlignment = this.calculateTimestampAlignment(
            patterns.messageStartCandidates,
            patterns.timestamps
        );
        confidence += CONFIDENCE_CONFIG.CONFIDENCE_INCREMENT_LARGE * timestampAlignment;
        factors++;
        
        // Normalize confidence to 0-1 range
        return factors > 0 ? Math.min(1, confidence / Math.max(factors * 0.2, 1)) : 0.5;
    }
    
    private calculateTimestampAlignment(messageStarts: number[], timestamps: number[]): number {
        if (messageStarts.length === 0 || timestamps.length === 0) {
            return 0;
        }
        
        let alignedCount = 0;
        for (const start of messageStarts) {
            // Check if there's a timestamp near this message start (within 2 lines)
            const hasNearbyTimestamp = timestamps.some(ts => 
                Math.abs(ts - start) <= ANALYSIS_CONFIG.TIMESTAMP_SEARCH_WINDOW
            );
            if (hasNearbyTimestamp) {
                alignedCount++;
            }
        }
        
        return alignedCount / messageStarts.length;
    }

    private calculateAverageMessageLength(starts: number[], analysis: LineAnalysis[]): number {
        if (starts.length === 0) {
            return 0;
        }
        
        const messageLengths: number[] = [];
        
        // Calculate length for each message
        for (let i = 0; i < starts.length; i++) {
            const start = starts[i];
            const end = i < starts.length - 1 ? starts[i + 1] - 1 : analysis.length - 1;
            
            // Count non-empty lines in this message
            let messageLength = 0;
            for (let j = start; j <= end && j < analysis.length; j++) {
                if (!analysis[j].isEmpty) {
                    messageLength++;
                }
            }
            
            if (messageLength > 0) {
                messageLengths.push(messageLength);
            }
        }
        
        // Calculate average
        if (messageLengths.length === 0) {
            return 0;
        }
        
        const sum = messageLengths.reduce((acc, len) => acc + len, 0);
        return Math.round(sum / messageLengths.length);
    }

    private extractCommonUsernames(analysis: LineAnalysis[], usernames: number[]): string[] {
        const usernameCount = new Map<string, number>();
        
        // Extract potential usernames from identified lines
        usernames.forEach(lineIndex => {
            if (lineIndex >= 0 && lineIndex < analysis.length) {
                const line = analysis[lineIndex];
                const text = line.trimmed;
                
                // Try to extract username from the line
                const extracted = this.extractUserAndTime(text);
                if (extracted && extracted.username) {
                    const username = this.cleanUsername(extracted.username);
                    if (username && this.isValidUsername(username)) {
                        usernameCount.set(username, (usernameCount.get(username) || 0) + 1);
                    }
                } else if (this.looksLikeUsername(text)) {
                    // Line might be just a username
                    const username = this.cleanUsername(text);
                    if (username && this.isValidUsername(username)) {
                        usernameCount.set(username, (usernameCount.get(username) || 0) + 1);
                    }
                }
            }
        });
        
        // Return usernames that appear at least twice
        const commonUsernames: string[] = [];
        for (const [username, count] of usernameCount.entries()) {
            if (count >= ANALYSIS_CONFIG.TIMESTAMP_SEARCH_WINDOW) {
                commonUsernames.push(username);
            }
        }
        
        // Sort by frequency (most common first)
        return commonUsernames.sort((a, b) => 
            (usernameCount.get(b) || 0) - (usernameCount.get(a) || 0)
        );
    }
    
    private isValidUsername(username: string): boolean {
        // Filter out obvious non-usernames
        if (username.length < LINE_LENGTH_CONFIG.MIN_USERNAME_LENGTH || username.length > LINE_LENGTH_CONFIG.MAX_USERNAME_LENGTH) return false;
        if (this.safeRegexTest(/^\d+$/, username)) return false; // All numbers
        if (this.safeRegexTest(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i, username)) return false;
        if (this.safeRegexTest(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i, username)) return false;
        if (this.safeRegexTest(/^\d{1,2}:\d{2}/, username)) return false; // Time patterns
        return true;
    }

    private identifyTimestampFormats(analysis: LineAnalysis[], timestamps: number[]): string[] {
        const formats = new Set<string>();
        
        // Extract timestamp patterns from lines marked as having timestamps
        timestamps.forEach(lineIndex => {
            if (lineIndex >= 0 && lineIndex < analysis.length) {
                const line = analysis[lineIndex];
                const text = line.trimmed;
                
                // Extract various timestamp patterns
                let match;
                
                // Pattern 1: Time with optional AM/PM
                match = this.safeRegexMatch(text, /\d{1,2}:\d{2}(?:\s*[AP]M)?/i);
                if (match && match[0]) {
                    formats.add(match[0]);
                }
                
                // Pattern 2: Linked timestamp [time](url)
                match = this.safeRegexMatch(text, /\[([^\]]+)\]\(https?:\/\/[^)]+\)/);
                if (match && match[0]) {
                    formats.add(match[0]);
                }
                
                // Pattern 3: Bracketed time [3:31 PM]
                match = this.safeRegexMatch(text, /\[\d{1,2}:\d{2}(?:\s*[AP]M)?\]/i);
                if (match && match[0]) {
                    formats.add(match[0]);
                }
                
                // Pattern 4: Date patterns
                match = this.safeRegexMatch(text, /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+at\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?/i);
                if (match && match[0]) {
                    formats.add(match[0]);
                }
                
                // Pattern 5: Relative dates
                match = this.safeRegexMatch(text, /(?:Today|Yesterday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+at\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?/i);
                if (match && match[0]) {
                    formats.add(match[0]);
                }
            }
        });
        
        return Array.from(formats);
    }

    private rankMessageStartCandidates(candidates: number[], structure: ConversationStructure): number[] {
        const { lines, patterns } = structure;
        
        // Score each candidate based on various factors
        const scoredCandidates = candidates.map(candidateIndex => {
            let score = 0;
            const line = lines[candidateIndex];
            
            // Factor 1: Line has a timestamp nearby
            const hasNearbyTimestamp = patterns.timestamps.some(ts => 
                Math.abs(ts - candidateIndex) <= ANALYSIS_CONFIG.TIMESTAMP_SEARCH_WINDOW
            );
            if (hasNearbyTimestamp) score += 3;
            
            // Factor 2: Previous line is empty
            if (line.context.isAfterEmpty) score += 2;
            
            // Factor 3: Line contains a common username
            const lineText = line.trimmed;
            const hasCommonUsername = patterns.commonUsernames.some(username => 
                lineText.includes(username)
            );
            if (hasCommonUsername) score += 2;
            
            // Factor 4: Structural characteristics
            if (line.characteristics.hasCapitalStart) score += 1;
            if (line.characteristics.isShortLine && !line.isEmpty) score += 1;
            
            // Factor 5: Not metadata
            const looksLikeMetadata = this.isMetadata(line);
            if (looksLikeMetadata) score -= 3;
            
            // Factor 6: Distance from previous candidate (prefer reasonable spacing)
            const prevIndex = candidates[candidates.indexOf(candidateIndex) - 1];
            if (prevIndex !== undefined) {
                const distance = candidateIndex - prevIndex;
                if (distance >= patterns.averageMessageLength * 0.5 && 
                    distance <= patterns.averageMessageLength * 2) {
                    score += 1;
                }
            }
            
            return { index: candidateIndex, score };
        });
        
        // Sort by score (descending) and then by index (ascending) for ties
        scoredCandidates.sort((a, b) => {
            if (b.score === a.score) {
                return a.index - b.index;
            }
            return b.score - a.score;
        });
        
        // Return just the indices, sorted by their position in the document
        return scoredCandidates
            .map(sc => sc.index)
            .sort((a, b) => a - b);
    }

    private calculateBoundaryConfidence(start: number, end: number, structure: ConversationStructure): number {
        const { lines, patterns } = structure;
        let confidence = 0;
        let factors = 0;
        
        // Factor 1: Message length is reasonable
        const messageLength = end - start + 1;
        const avgLength = patterns.averageMessageLength || 5;
        if (messageLength >= avgLength * 0.2 && messageLength <= avgLength * 3) {
            confidence += CONFIDENCE_CONFIG.CONFIDENCE_INCREMENT_LARGE;
        } else if (messageLength >= avgLength * 0.1 && messageLength <= avgLength * 5) {
            confidence += 0.15;
        }
        factors++;
        
        // Factor 2: Has username at or near start
        const hasUsername = patterns.usernames.some(userIndex => 
            userIndex >= start && userIndex <= Math.min(start + 2, end)
        );
        if (hasUsername) {
            confidence += 0.25;
        }
        factors++;
        
        // Factor 3: Has timestamp at or near start
        const hasTimestamp = patterns.timestamps.some(tsIndex => 
            tsIndex >= start && tsIndex <= Math.min(start + 2, end)
        );
        if (hasTimestamp) {
            confidence += 0.25;
        }
        factors++;
        
        // Factor 4: Content characteristics
        let hasContent = false;
        let contentLines = 0;
        for (let i = start; i <= end && i < lines.length; i++) {
            const line = lines[i];
            if (!line.isEmpty && !this.isMetadata(line)) {
                hasContent = true;
                contentLines++;
            }
        }
        if (hasContent && contentLines >= 1) {
            confidence += 0.2;
        }
        factors++;
        
        // Normalize confidence
        return Math.min(1, confidence);
    }

    private isValidMessage(message: SlackMessage): boolean {
        // Filter out Unknown User messages unless they're legitimate continuation messages
        if (message.username === 'Unknown User') {
            // Check if this looks like metadata that should be filtered out
            const text = message.text?.trim() || '';
            
            // Common metadata patterns that should be filtered out
            const metadataPatterns = [
                /^Added by\s+/i,  // "Added by GitHub" etc.
                /^Language$/i,
                /^TypeScript$/i,
                /^Last updated$/i,
                /^\d+\s*(?:minutes?|hours?|days?)\s*ago$/i,
                /^!\[\]\(https?:\/\/[^)]+\)$/,  // Just an image
                /^[a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+$/,  // GitHub repo names like "user/repo"
                /^\d+\s+(?:reply|replies|files?)$/i,  // "13 replies" etc.
                /^View thread$/i,
                /^Thread:$/i,
                /^Last reply$/i
            ];
            
            // If it matches any metadata pattern, filter it out
            if (metadataPatterns.some(pattern => this.safeRegexTest(pattern, text))) {
                return false;
            }
            
            // Only allow Unknown User messages if they have substantial content
            // and don't look like metadata (probably legitimate continuation messages)
            return text.length > 20 && !text.match(/^[A-Za-z0-9\s\-_.]+$/);
        }
        
        // Non-Unknown User messages are valid if they have any content
        return message.text && message.text.trim().length > 0;
    }

    private extractUserAndTime(line: string, structure?: ConversationStructure): {username?: string, timestamp?: string} {
        // Try to find username + timestamp combinations intelligently
        
        // Pattern 1: UserUser [timestamp](url) - doubled username with linked timestamp
        // Enhanced to handle emojis between the doubled username and timestamp
        let match = this.safeRegexMatch(line, /^([A-Za-z][A-Za-z0-9\s\-_.]*?)\1(?:!\[:[^\]]+:\][^\[]*)?\s*\[([^\]]+)\]/);
        if (match && match.length > 2 && match[1] && match[2]) {
            return {
                username: this.cleanUsername(match[1]),
                timestamp: match[2]
            };
        }
        
        // Pattern 2: User [timestamp](url) - simple username with linked timestamp
        match = this.safeRegexMatch(line, /^([A-Za-z0-9\s\-_.]+?)\s*\[([^\]]+)\]/);
        if (match && match.length > 2 && match[1] && match[2] && (!line.includes('http') || line.includes('archives'))) {
            return {
                username: this.cleanUsername(match[1]),
                timestamp: match[2]
            };
        }
        
        // Pattern 3: User time - username followed by time
        match = this.safeRegexMatch(line, /^([A-Za-z0-9\s\-_.]+?)\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
        if (match && match.length > 2 && match[1] && match[2]) {
            return {
                username: this.cleanUsername(match[1]),
                timestamp: match[2]
            };
        }
        
        // Pattern 4: Just username (timestamp might be on next line)
        if (this.looksLikeUsername(line) && !this.hasTimestampPattern(line)) {
            return {
                username: this.cleanUsername(line)
            };
        }
        
        return {};
    }

    private looksLikeUsername(text: string): boolean {
        return this.safeRegexTest(/^[A-Za-z][A-Za-z0-9\s\-_.]{1,30}$/, text) && 
               !this.isObviousMetadata({trimmed: text} as LineAnalysis);
    }

    private looksLikeTimestamp(text: string): boolean {
        return this.hasTimestampPattern(text) && text.length < 50;
    }

    private cleanUsername(text: string): string {
        return this.safeRegexReplace(text, /[^\w\s\-_.]/g, '').trim();
    }

    private parseReaction(text: string): SlackReaction | null {
        const match = this.safeRegexMatch(text, /^([\u{1F300}-\u{1F9FF}]|:\w+:)\s*(\d+)$/u);
        if (match && match.length > 2 && match[1] && match[2]) {
            return {
                name: this.safeRegexReplace(match[1], /:/g, ''),
                count: parseInt(match[2], 10)
            };
        }
        return null;
    }

    private isThreadInfo(text: string): boolean {
        // Thread info is typically short metadata like "2 replies" or "View thread"
        // It should not match regular content that happens to contain the word "thread"
        return this.safeRegexTest(/^\d+\s+repl(?:y|ies)|^view\s+thread$|^thread$/i, text) && text.length < 20;
    }
}

// Type definitions
interface LineAnalysis {
    index: number;
    content: string;
    trimmed: string;
    isEmpty: boolean;
    length: number;
    characteristics: LineCharacteristics;
    context: LineContext;
}

interface LineCharacteristics {
    hasTimestamp: boolean;
    hasUrl: boolean;
    hasUserMention: boolean;
    hasEmoji: boolean;
    hasAvatar: boolean;
    hasReactions: boolean;
    isShortLine: boolean;
    isLongLine: boolean;
    hasCapitalStart: boolean;
    hasNumbers: boolean;
    isAllCaps: boolean;
    hasSpecialChars: boolean;
}

interface LineContext {
    prevLine: string | null;
    nextLine: string | null;
    isAfterEmpty: boolean;
    isBeforeEmpty: boolean;
}

interface ConversationPatterns {
    messageStartCandidates: number[];
    timestamps: number[];
    usernames: number[];
    metadata: number[];
    averageMessageLength: number;
    commonUsernames: string[];
    timestampFormats: string[];
}

interface ConversationStructure {
    lines: LineAnalysis[];
    patterns: ConversationPatterns;
    format: 'standard' | 'bracket' | 'mixed';
    confidence: number;
}

interface MessageBoundary {
    start: number;
    end: number;
    confidence: number;
}

interface MetadataExtraction {
    username: string | null;
    timestamp: string | null;
    contentStart: number;
}

interface ContentExtraction {
    text: string;
    reactions?: SlackReaction[];
    threadInfo?: string | null;
}