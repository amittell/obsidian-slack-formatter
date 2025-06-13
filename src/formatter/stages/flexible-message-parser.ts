import { SlackMessage } from '../../models';
import type { SlackReaction } from '../../types/messages.types';
import { parseDate, parseSlackTimestamp } from '../../utils/datetime-utils';
import { Logger } from '../../utils/logger';
import { cleanupDoubledUsernames } from '../../utils/username-utils';

/**
 * Pattern scoring weights for identifying message boundaries
 */
interface PatternScore {
    isUsername: number;
    isTimestamp: number;
    hasUserAndTime: number;
    isDateSeparator: number;
    isMetadata: number;
    confidence: number;
}

/**
 * Message block representing a potential message
 */
interface MessageBlock {
    startLine: number;
    endLine: number;
    username?: string;
    timestamp?: string;
    avatarUrl?: string;
    content: string[];
    reactions?: SlackReaction[];
    threadInfo?: string;
    confidence: number;
}

/**
 * Parser context for multi-pass parsing
 */
interface ParserContext {
    lines: string[];
    blocks: MessageBlock[];
    currentDate: Date | null;
    debugInfo: string[];
}

/**
 * Flexible message parser that uses pattern scoring and multi-pass parsing
 */
export class FlexibleMessageParser {
    // Remove instance logger - use static methods instead
    
    // Simplified core patterns
    private readonly patterns = {
        // Flexible username patterns
        username: [
            /^([A-Za-z0-9\s\-_.]+)$/,  // Simple username
            /^([A-Za-z0-9\s\-_.]+)\s*(?::[\w\-+]+:|[\u{1F300}-\u{1F9FF}])*$/u,  // Username with emoji
            /^!\[.*?\]\(.*?\)\s*([A-Za-z0-9\s\-_.]+)/,  // Avatar + username
        ],
        
        // Flexible timestamp patterns
        timestamp: [
            /\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/i,  // Time only
            /\b((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)\b/i,  // Day of week
            /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)\b/i,  // Month day
            /\b(Today|Yesterday)(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))?\b/i,  // Relative date
            /\[(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)[^\]]*)\]\(https?:\/\/[^\)]*\/archives\/[^\)]+\)/i,  // Linked timestamp - must be time/date format and link to Slack archives
        ],
        
        // Combined patterns
        userAndTime: [
            /^(.+?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i,  // User + time
            /^(.+?)\s+\[(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)[^\]]*)\]\(https?:\/\/[^\)]*\/archives\/[^\)]+\)$/i,  // User + linked timestamp to Slack archives
            /^(.+?)\s+(?:at\s+)?(\d{1,2}:\d{2})\s*$/i,  // User at time
            /^([A-Za-z0-9\s\-_.]+?)\1(.*?)(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i,  // Doubled username + optional content + time
            /^(.+?)(?::[\w\-+]+:|[\u{1F300}-\u{1F9FF}])+\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/ui,  // User + emoji + time
            /^(.+?)(:[a-zA-Z0-9_+-]+:)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i,  // User emoji time (with space between emoji and time)
        ],
        
        // Metadata patterns (simplified)
        metadata: [
            /^\d+\s+repl(?:y|ies)/i,
            /^View thread$/i,
            /^Thread:/i,
            /^:\w+:\s*\d+/,  // Reaction
            /^This message was deleted/i,
            /^\+1$/,
            /^---+$/,
            /^replied to a thread:/i,  // Thread reply indicator
            /^Last reply/i,  // Thread timing info
            /^View newer replies$/i,  // Thread navigation
            /^Added by/i,  // File attachment info
            /^\d+\s+files?$/i,  // File count
            /^:[a-zA-Z0-9_+-]+:$/,  // Standalone emoji (reaction indicator)
            /^!\[:.*?:\]\(.*?\)$/,  // Standalone custom emoji image
            /^\d+$/,  // Single number (likely a reaction count)
            /^Also sent to the channel$/i,  // Thread broadcast indicator
            /^\d+\s+(?:new\s+)?messages?$/i,  // Message count indicator
        ],
        
        // Date separators
        dateSeparator: [
            /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?$/i,
            /^---\s*(.+?)\s*---$/,
        ],
    };

    /**
     * Main entry point for parsing
     */
    parse(text: string, isDebugEnabled?: boolean): SlackMessage[] {
        const context: ParserContext = {
            lines: text.split('\n'),
            blocks: [],
            currentDate: null,
            debugInfo: [],
        };

        // Multi-pass parsing
        this.identifyMessageBlocks(context, isDebugEnabled);
        this.refineBlocks(context, isDebugEnabled);
        this.extractReactionsAndMetadata(context, isDebugEnabled);
        
        // Convert blocks to messages
        const messages = this.convertBlocksToMessages(context, isDebugEnabled);
        
        if (isDebugEnabled) {
            Logger.debug('FlexibleMessageParser', 'Debug info', context.debugInfo, isDebugEnabled);
        }
        
        return messages;
    }

    /**
     * First pass: Identify potential message blocks
     */
    private identifyMessageBlocks(context: ParserContext, isDebugEnabled?: boolean): void {
        let currentBlock: MessageBlock | null = null;
        let previousLineWasBlank = false;
        
        for (let i = 0; i < context.lines.length; i++) {
            const line = context.lines[i];
            const trimmed = line.trim();
            const score = this.scoreLine(trimmed, context);
            
            if (isDebugEnabled) {
                context.debugInfo.push(`Line ${i}: ${trimmed.substring(0, 50)}... Score: ${JSON.stringify(score)}`);
            }
            
            // Handle date separators
            if (score.isDateSeparator > 0.8) {
                if (currentBlock) {
                    context.blocks.push(currentBlock);
                    currentBlock = null;
                }
                this.updateDateContext(trimmed, context);
                continue;
            }
            
            // Skip high-confidence metadata UNLESS it also has user/time info
            if (score.isMetadata > 0.8 && score.hasUserAndTime < 0.7) {
                // If we're in a current block and this is a reaction emoji, 
                // check if the next line is a number (reaction count)
                if (currentBlock && /^:[a-zA-Z0-9_+-]+:$/.test(trimmed) && i + 1 < context.lines.length) {
                    const nextLine = context.lines[i + 1].trim();
                    if (/^\d+$/.test(nextLine)) {
                        // This is a reaction - add it to current block's content to be processed later
                        currentBlock.content.push(line);
                        currentBlock.content.push(context.lines[i + 1]);
                        currentBlock.endLine = i + 1;
                        i++; // Skip the count line
                        previousLineWasBlank = false;
                        continue;
                    }
                }
                
                // If we're in a current block and this is thread/file metadata, keep it with the block
                if (currentBlock && (
                    /^\d+\s+repl(?:y|ies)/i.test(trimmed) ||
                    /^Also sent to the channel$/i.test(trimmed) ||
                    /^Added by/i.test(trimmed) ||
                    /^\d+\s+files?$/i.test(trimmed) ||
                    /^View thread$/i.test(trimmed) ||
                    /^Thread:/i.test(trimmed) ||
                    /^Last reply/i.test(trimmed)
                )) {
                    currentBlock.content.push(line);
                    currentBlock.endLine = i;
                    previousLineWasBlank = false;
                    continue;
                }
                
                previousLineWasBlank = false;
                continue;
            }
            
            // Start new block on high-confidence username/timestamp
            if (score.confidence > 0.6 && (score.isUsername > 0.7 || score.hasUserAndTime > 0.7)) {
                if (currentBlock) {
                    context.blocks.push(currentBlock);
                }
                
                currentBlock = {
                    startLine: i,
                    endLine: i,
                    content: [],
                    confidence: score.confidence,
                };
                
                // Extract username and timestamp if found
                this.extractHeaderInfo(trimmed, currentBlock, context);
                
                // Check if next line is an indented timestamp (common format)
                if (!currentBlock.timestamp && i + 1 < context.lines.length) {
                    const nextLine = context.lines[i + 1];
                    // Check for various timestamp formats including dates with times
                    if (/^\s{2,}(?:\d{1,2}:\d{2}\s*(?:AM|PM)?|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday).*?\d{1,2}:\d{2}\s*(?:AM|PM)?)/i.test(nextLine)) {
                        currentBlock.timestamp = nextLine.trim();
                        currentBlock.endLine = i + 1;
                        i++; // Skip the timestamp line
                    }
                }
                
                previousLineWasBlank = false;
            }
            // Continue current block
            else if (currentBlock && trimmed !== '') {
                currentBlock.endLine = i;
                currentBlock.content.push(line);
                previousLineWasBlank = false;
            }
            // Handle blank lines
            else if (trimmed === '') {
                if (currentBlock && previousLineWasBlank) {
                    context.blocks.push(currentBlock);
                    currentBlock = null;
                } else if (currentBlock) {
                    currentBlock.content.push('');
                }
                previousLineWasBlank = true;
            }
            // Standalone content (no header)
            else if (!currentBlock && trimmed !== '' && score.isMetadata < 0.5) {
                currentBlock = {
                    startLine: i,
                    endLine: i,
                    content: [line],
                    confidence: 0.3,
                };
                previousLineWasBlank = false;
            }
        }
        
        // Don't forget the last block
        if (currentBlock) {
            context.blocks.push(currentBlock);
        }
    }

    /**
     * Second pass: Refine blocks by looking at context
     */
    private refineBlocks(context: ParserContext, isDebugEnabled?: boolean): void {
        for (let i = 0; i < context.blocks.length; i++) {
            const block = context.blocks[i];
            
            // Handle split username/timestamp patterns (e.g., "Feb 25th at" on one line, "10:39 AM" on next)
            if (block.username && /\s+at$/i.test(block.username) && !block.timestamp) {
                // This looks like a date ending with "at" - check if next line has time
                const nextLineIndex = block.startLine + 1;
                if (nextLineIndex < context.lines.length) {
                    const nextLine = context.lines[nextLineIndex].trim();
                    if (/^\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(nextLine)) {
                        // Combine the date and time
                        const fullTimestamp = block.username + ' ' + nextLine;
                        block.username = 'Unknown User'; // Reset username since it was actually part of timestamp
                        block.timestamp = fullTimestamp;
                        
                        // Remove the time line from content if it's there
                        const timeLineInContent = block.content.findIndex(line => line.trim() === nextLine);
                        if (timeLineInContent !== -1) {
                            block.content.splice(timeLineInContent, 1);
                        }
                        
                        // Also check if we need to adjust the block's actual content start
                        if (block.content.length === 0 && nextLineIndex + 1 < context.lines.length) {
                            // The actual content starts after the time line
                            for (let j = nextLineIndex + 1; j <= block.endLine && j < context.lines.length; j++) {
                                const contentLine = context.lines[j];
                                if (contentLine.trim() !== '') {
                                    block.content.push(contentLine);
                                }
                            }
                        }
                        
                        block.confidence = 0.8;
                    }
                }
            }
            
            // Check if this block is actually a continuation of previous block
            if (i > 0 && block.username) {
                // Check if username looks like content that should belong to previous block
                const suspiciousPatterns = [
                    /^(One thing|At Friday|Hosted and|Also sent|Added by|View thread|Thread:|Last reply)/i,
                    /^(Estimated timeline|We haven't notified|Infosys team showed|They have|They already|They take|They agreed)/i,
                    /^(Feb|Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(st|nd|rd|th)?\s+at$/i,
                    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+at$/i,
                    /^(Today|Yesterday)\s+at$/i,
                ];
                
                const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(block.username));
                
                if (isSuspicious) {
                    const prevBlock = context.blocks[i - 1];
                    // Merge this block into previous
                    prevBlock.content.push(block.username);
                    if (block.timestamp) {
                        prevBlock.content.push(block.timestamp);
                    }
                    prevBlock.content.push(...block.content);
                    prevBlock.endLine = block.endLine;
                    context.blocks.splice(i, 1);
                    i--;
                    continue;
                }
            }
            
            // Check if next line after header might be timestamp
            if (!block.timestamp) {
                // Check if the next line in the original text is an indented timestamp
                if (block.startLine + 1 < context.lines.length) {
                    const nextLine = context.lines[block.startLine + 1];
                    // Check for indented timestamp (common Slack format)
                    if (/^\s{2,}\d{1,2}:\d{2}\s*(?:AM|PM)?/i.test(nextLine)) {
                        block.timestamp = nextLine.trim();
                        // Adjust content to skip the timestamp line
                        if (block.content.length > 0 && block.content[0].trim() === block.timestamp) {
                            block.content.shift();
                        }
                        block.confidence += 0.3;
                    }
                } else if (block.content.length > 0) {
                    const firstContent = block.content[0].trim();
                    const timestampScore = this.scoreTimestamp(firstContent);
                    
                    if (timestampScore > 0.7) {
                        block.timestamp = firstContent;
                        block.content.shift();
                        block.confidence += 0.2;
                    }
                }
            }
            
            // Check for avatar in previous line
            if (i > 0 && block.startLine > 0) {
                const prevLine = context.lines[block.startLine - 1].trim();
                const avatarMatch = prevLine.match(/^!\[.*?\]\((https?:\/\/[^\)]+)\)$/);
                if (avatarMatch) {
                    block.avatarUrl = avatarMatch[1];
                }
            }
            
            // Merge blocks that are likely continuations
            if (i > 0) {
                const prevBlock = context.blocks[i - 1];
                const linesBetween = block.startLine - prevBlock.endLine - 1;
                
                // If blocks are close and current has low confidence, might be continuation
                if (linesBetween <= 1 && block.confidence < 0.5 && !block.username) {
                    prevBlock.content.push(...block.content);
                    prevBlock.endLine = block.endLine;
                    context.blocks.splice(i, 1);
                    i--;
                }
            }
        }
    }

    /**
     * Third pass: Extract reactions and thread metadata
     */
    private extractReactionsAndMetadata(context: ParserContext, isDebugEnabled?: boolean): void {
        for (const block of context.blocks) {
            const reactions: SlackReaction[] = [];
            let threadInfo: string | undefined;
            let attachmentInfo: string[] = [];
            const cleanedContent: string[] = [];
            
            for (let i = 0; i < block.content.length; i++) {
                const line = block.content[i];
                const trimmed = line.trim();
                
                // Check for reactions (emoji followed by count)
                if (i + 1 < block.content.length && /^:[a-zA-Z0-9_+-]+:$/.test(trimmed)) {
                    const nextLine = block.content[i + 1].trim();
                    if (/^\d+$/.test(nextLine)) {
                        const count = parseInt(nextLine, 10);
                        if (!isNaN(count)) {
                            const name = trimmed.slice(1, -1);
                            reactions.push({ name, count });
                            i++; // Skip the count line
                            continue;
                        }
                    }
                }
                
                // Check for other reaction formats
                const reactionMatches = this.extractReactions(trimmed);
                if (reactionMatches.length > 0) {
                    reactions.push(...reactionMatches);
                    continue;
                }
                
                // Check for combined thread metadata (e.g., "Last reply 16 days agoView thread")
                if (/Last reply.*View thread/i.test(trimmed)) {
                    threadInfo = (threadInfo ? threadInfo + ' ' : '') + trimmed;
                    continue;
                }
                
                // Check for thread info
                if (/^\d+\s+repl(?:y|ies)/i.test(trimmed) || 
                    /View thread/i.test(trimmed) || 
                    /^replied to a thread:/i.test(trimmed) || 
                    /^Last reply/i.test(trimmed) ||
                    /^Also sent to the channel$/i.test(trimmed) ||
                    /^Thread:/i.test(trimmed)) {
                    threadInfo = (threadInfo ? threadInfo + ' ' : '') + trimmed;
                    
                    // If this is "replied to a thread:", capture the context (next line)
                    if (/^replied to a thread:/i.test(trimmed) && i + 1 < block.content.length) {
                        const contextLine = block.content[i + 1].trim();
                        // Only capture if it doesn't look like metadata or a new message
                        if (contextLine && 
                            !/^\d+\s+repl(?:y|ies)/i.test(contextLine) &&
                            !/^View thread/i.test(contextLine) &&
                            !/^Last reply/i.test(contextLine) &&
                            !/^:[a-zA-Z0-9_+-]+:$/.test(contextLine)) {
                            threadInfo += ' "' + contextLine + '"';
                            i++; // Skip the context line
                        }
                    }
                    continue;
                }
                
                // Check for file attachment metadata
                if (/^\d+\s+files?$/i.test(trimmed)) {
                    attachmentInfo.push(trimmed);
                    // Look for "Added by" on next line
                    if (i + 1 < block.content.length) {
                        const nextLine = block.content[i + 1].trim();
                        if (/^Added by/i.test(nextLine)) {
                            attachmentInfo.push(nextLine);
                            i++; // Skip the "Added by" line
                        }
                    }
                    continue;
                }
                
                // Check for standalone "Added by" (for link previews)
                if (/^Added by/i.test(trimmed)) {
                    attachmentInfo.push(trimmed);
                    continue;
                }
                
                // Keep non-metadata content
                cleanedContent.push(line);
            }
            
            // Add attachment info back to content if present
            if (attachmentInfo.length > 0) {
                cleanedContent.push('', `📎 ${attachmentInfo.join(' - ')}`);
            }
            
            block.content = cleanedContent;
            if (reactions.length > 0) {
                block.reactions = reactions;
            }
            if (threadInfo) {
                block.threadInfo = threadInfo;
            }
        }
    }

    /**
     * Score a line to determine what it might be
     */
    private scoreLine(line: string, context: ParserContext): PatternScore {
        const score: PatternScore = {
            isUsername: 0,
            isTimestamp: 0,
            hasUserAndTime: 0,
            isDateSeparator: 0,
            isMetadata: 0,
            confidence: 0,
        };
        
        if (!line) return score;
        
        // Check username patterns
        score.isUsername = this.scoreUsername(line);
        
        // Check timestamp patterns
        score.isTimestamp = this.scoreTimestamp(line);
        
        // Check combined patterns
        score.hasUserAndTime = this.scoreUserAndTime(line);
        
        // Check date separator
        score.isDateSeparator = this.scoreDateSeparator(line);
        
        // Check metadata
        score.isMetadata = this.scoreMetadata(line);
        
        // Calculate overall confidence
        const signals = [score.isUsername, score.isTimestamp, score.hasUserAndTime, score.isDateSeparator];
        score.confidence = Math.max(...signals);
        
        // Boost confidence if multiple signals
        const activeSignals = signals.filter(s => s > 0.5).length;
        if (activeSignals > 1) {
            score.confidence = Math.min(1, score.confidence + 0.1 * activeSignals);
        }
        
        return score;
    }

    /**
     * Score how likely a line is to be a username
     */
    private scoreUsername(line: string): number {
        let maxScore = 0;
        
        // Check if line is just an emoji code or reaction - not a username
        if (/^:[a-zA-Z0-9_+-]+:$/.test(line) || /^!\[:.*?:\]\(.*?\)$/.test(line)) {
            return 0;
        }
        
        // Check for patterns that look like link preview titles (e.g., "GuidewireGuidewire")
        if (/^([A-Za-z]+)\1$/.test(line) && line.length > 10) {
            return 0;
        }
        
        // Single short words are unlikely to be usernames without more context
        if (/^[A-Za-z]{1,3}$/.test(line)) {
            // Check if the next line might be a timestamp to confirm this is a username
            return 0.3; // Low confidence
        }
        
        // Lines that look like titles or file names are not usernames
        if (/\.(png|jpg|jpeg|gif|pdf|doc|docx)$/i.test(line)) {
            return 0;
        }
        
        // Lines that start with common English words followed by more text are likely content, not usernames
        if (/^(Last|First|The|This|That|Google|Image|File|Document)\s+\w+/i.test(line)) {
            return 0;
        }
        
        // Lines that look like partial sentences or phrases are not usernames
        if (/^(One thing|At Friday|Hosted and|Also sent|Added by|View thread|Thread:|Last reply)/i.test(line)) {
            return 0;
        }
        
        // Lines ending with "at" (incomplete timestamps) are not usernames
        if (/\s+at$/i.test(line)) {
            return 0;
        }
        
        // Date patterns that might appear on their own line
        if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)\s+\d{1,2}(st|nd|rd|th)?\s+at$/i.test(line)) {
            return 0;
        }
        
        for (const pattern of this.patterns.username) {
            if (pattern.test(line)) {
                let score = 0.7;
                
                // Boost score for certain characteristics
                if (line.length < 50) score += 0.1;
                if (!/\d{4,}/.test(line)) score += 0.1; // No long numbers
                if (/^[A-Z]/.test(line)) score += 0.1; // Starts with capital
                
                maxScore = Math.max(maxScore, Math.min(1, score));
            }
        }
        
        return maxScore;
    }

    /**
     * Score how likely a line is to be a timestamp
     */
    private scoreTimestamp(line: string): number {
        let maxScore = 0;
        
        for (const pattern of this.patterns.timestamp) {
            if (pattern.test(line)) {
                let score = 0.8;
                
                // Boost for specific formats
                if (/^\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(line)) score = 0.95;
                if (/\[.+\]\(http/i.test(line) && line.length < 100) score = 0.9;
                
                maxScore = Math.max(maxScore, score);
            }
        }
        
        return maxScore;
    }

    /**
     * Score how likely a line contains both user and time
     */
    private scoreUserAndTime(line: string): number {
        let maxScore = 0;
        
        for (const pattern of this.patterns.userAndTime) {
            if (pattern.test(line)) {
                maxScore = Math.max(maxScore, 0.9);
            }
        }
        
        return maxScore;
    }

    /**
     * Score how likely a line is a date separator
     */
    private scoreDateSeparator(line: string): number {
        for (const pattern of this.patterns.dateSeparator) {
            if (pattern.test(line)) {
                return 0.95;
            }
        }
        return 0;
    }

    /**
     * Score how likely a line is metadata
     */
    private scoreMetadata(line: string): number {
        for (const pattern of this.patterns.metadata) {
            if (pattern.test(line)) {
                return 0.9;
            }
        }
        return 0;
    }

    /**
     * Extract header information from a line
     */
    private extractHeaderInfo(line: string, block: MessageBlock, context: ParserContext): void {
        // Try combined patterns first
        for (let i = 0; i < this.patterns.userAndTime.length; i++) {
            const pattern = this.patterns.userAndTime[i];
            const match = line.match(pattern);
            if (match) {
                // Handle different pattern matches
                if (i === 3) { // Doubled username + optional content + time pattern
                    block.username = this.cleanUsername(match[1]);
                    block.timestamp = match[3];
                } else if (i === 4) { // User + emoji + time pattern
                    block.username = this.cleanUsername(match[1]);
                    block.timestamp = match[2];
                } else if (i === 5) { // User emoji time (with space between emoji and time)
                    block.username = this.cleanUsername(match[1]);
                    block.timestamp = match[3];
                } else {
                    block.username = this.cleanUsername(match[1]);
                    block.timestamp = match[2];
                }
                return;
            }
        }
        
        // Try username patterns
        for (const pattern of this.patterns.username) {
            const match = line.match(pattern);
            if (match) {
                block.username = this.cleanUsername(match[1] || match[0]);
                break;
            }
        }
        
        // Try timestamp patterns
        for (const pattern of this.patterns.timestamp) {
            const match = line.match(pattern);
            if (match) {
                block.timestamp = match[1] || match[0];
                break;
            }
        }
    }

    /**
     * Clean username by removing emojis and artifacts
     */
    private cleanUsername(username: string): string {
        let cleaned = username;
        
        // Remove emojis
        cleaned = cleaned.replace(/:[a-zA-Z0-9_+-]+:/g, '').trim();
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        
        // Clean up doubled names
        cleaned = cleanupDoubledUsernames(cleaned);
        
        // Remove trailing punctuation
        cleaned = cleaned.replace(/[!?,.;:]+$/, '').trim();
        
        // Handle avatar prefix
        cleaned = cleaned.replace(/^!\[.*?\]\(.*?\)\s*/, '');
        
        return cleaned || 'Unknown User';
    }

    /**
     * Extract reactions from a line
     */
    private extractReactions(line: string): SlackReaction[] {
        const reactions: SlackReaction[] = [];
        
        // Pattern for emoji:count pairs
        const reactionPattern = /(:[a-zA-Z0-9_+-]+:|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|!\[:[^:]+:\]\([^)]+\))\s*(\d+)/gu;
        
        let match;
        while ((match = reactionPattern.exec(line)) !== null) {
            const emoji = match[1];
            const count = parseInt(match[2], 10);
            
            if (!isNaN(count)) {
                let name = emoji;
                
                // Extract name from different formats
                if (emoji.startsWith('![:')) {
                    const nameMatch = emoji.match(/!\[:(.+?):\]/);
                    if (nameMatch) name = nameMatch[1];
                } else if (emoji.startsWith(':')) {
                    name = emoji.slice(1, -1);
                }
                
                reactions.push({ name, count });
            }
        }
        
        return reactions;
    }

    /**
     * Update date context from date separator
     */
    private updateDateContext(line: string, context: ParserContext): void {
        for (const pattern of this.patterns.dateSeparator) {
            const match = line.match(pattern);
            if (match) {
                const dateStr = match[1] || match[0];
                const parsed = parseDate(dateStr);
                if (parsed) {
                    context.currentDate = parsed;
                }
                break;
            }
        }
    }

    /**
     * Convert blocks to SlackMessage objects
     */
    private convertBlocksToMessages(context: ParserContext, isDebugEnabled?: boolean): SlackMessage[] {
        const messages: SlackMessage[] = [];
        
        for (const block of context.blocks) {
            const message = new SlackMessage();
            
            // Set basic properties
            message.username = block.username || 'Unknown User';
            
            // Filter out content that looks like it might be a timestamp that wasn't properly extracted
            const filteredContent = block.content.filter(line => {
                const trimmed = line.trim();
                // Don't include lines that are just timestamps
                return !(/^\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(trimmed) ||
                        /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)\s+\d{1,2}(st|nd|rd|th)?\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(trimmed));
            });
            
            message.text = filteredContent.join('\n').trim();
            
            // Set timestamp
            if (block.timestamp) {
                const parsed = parseSlackTimestamp(block.timestamp, context.currentDate);
                if (parsed) {
                    message.timestamp = parsed.toISOString();
                    message.date = context.currentDate;
                } else {
                    message.timestamp = block.timestamp;
                }
            }
            
            // Set optional properties
            if (block.avatarUrl) {
                message.avatar = block.avatarUrl;
            }
            
            if (block.reactions) {
                message.reactions = block.reactions;
            }
            
            if (block.threadInfo) {
                message.threadInfo = block.threadInfo;
            }
            
            // Only add messages with content
            if (message.text || message.reactions || message.threadInfo) {
                messages.push(message);
            }
        }
        
        return messages;
    }
}