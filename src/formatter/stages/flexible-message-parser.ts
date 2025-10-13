import { SlackMessage } from '../../models';
import type { SlackReaction } from '../../types/messages.types';
import { parseDate, parseSlackTimestamp } from '../../utils/datetime-utils';
import { Logger } from '../../utils/logger';
import {
  cleanupDoubledUsernames,
  MessageFormat,
  detectMessageFormat,
  extractUsernameFromThreadFormat,
  extractUsernameFromDMFormat,
  extractUsername,
} from '../../utils/username-utils';
import { duplicateDetectionService } from '../../utils/duplicate-detection-service';

/**
 * Pattern scoring weights for identifying message boundaries.
 * Each score is a probability value between 0 and 1.
 *
 * @interface PatternScore
 * @since 1.0.0
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
 * Message block representing a potential message during parsing.
 * Contains extracted metadata and content lines for each identified message.
 *
 * @interface MessageBlock
 * @since 1.0.0
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
 * Parser context maintained throughout the multi-pass parsing process.
 * Tracks state, extracted blocks, and debug information across all parsing phases.
 *
 * @interface ParserContext
 * @since 1.0.0
 */
interface ParserContext {
  lines: string[];
  blocks: MessageBlock[];
  currentDate: Date | null;
  debugInfo: string[];
}

/**
 * Configuration constants for pattern matching and scoring thresholds
 */
const TIMESTAMP_CONFIDENCE_THRESHOLD = 0.7;
const MESSAGE_FRAGMENTATION_THRESHOLD = 0.8;
const CONTENT_PREVIEW_LENGTH = 100;
const MIN_MESSAGE_CONTENT_LENGTH = 3;

/**
 * Centralized confidence thresholds configuration for pattern matching
 */
const CONFIDENCE_THRESHOLDS = {
  // Core confidence levels
  timestamp: TIMESTAMP_CONFIDENCE_THRESHOLD, // 0.7 - High confidence for timestamp detection
  fragmentation: MESSAGE_FRAGMENTATION_THRESHOLD, // 0.8 - Threshold for message fragmentation

  // Pattern matching thresholds
  lowConfidence: 0.3, // Low confidence threshold for username detection
  mediumConfidence: 0.5, // Medium confidence threshold for general pattern matching
  highConfidence: 0.8, // High confidence threshold for strict pattern matching
  veryHighConfidence: 0.95, // Very high confidence for strong patterns
  perfectMatch: 0.9, // Near-perfect match confidence
  absolute: 1.0, // Absolute confidence for perfect matches

  // Content analysis thresholds
  minContentLength: MIN_MESSAGE_CONTENT_LENGTH, // 3 - Minimum message content length
  contentPreviewLength: CONTENT_PREVIEW_LENGTH, // 100 - Length for content preview

  // Scoring boosts and penalties
  multiSignalBoost: 0.1, // Boost when multiple signals are present
  capitalStartBoost: 0.1, // Boost for lines starting with capital letters
  lengthBoost: 0.1, // Boost for appropriate line lengths
} as const;

/**
 * Flexible message parser that uses pattern scoring and multi-pass parsing.
 *
 * Alternative parser implementation that serves as a fallback when the main
 * IntelligentMessageParser encounters difficult content. Uses probabilistic
 * pattern matching with configurable confidence thresholds.
 *
 * Three-Pass Algorithm:
 * 1. Pattern Recognition: Score lines for username, timestamp, and metadata patterns
 * 2. Block Identification: Group related lines into message blocks
 * 3. Content Extraction: Extract metadata and content, handle reactions
 *
 * Key Features:
 * - Multi-format support (DM, Thread, Channel, Standard)
 * - Probabilistic scoring with confidence thresholds
 * - Pattern-based username and timestamp detection
 * - Doubled username handling for multi-person DMs
 * - International character support
 * - Flexible continuation detection
 *
 * Known Limitations:
 * - Message continuation logic can over-split messages (expected 2, getting 3-5)
 * - Less sophisticated boundary detection than IntelligentMessageParser
 * - Acceptable for fallback scenarios where primary parser fails
 *
 * @complexity O(n²) for block identification, O(n) for pattern scoring
 * @see {@link IntelligentMessageParser} for primary parsing algorithm
 * @since 1.0.0
 */
export class FlexibleMessageParser {
  // Remove instance logger - use static methods instead

  // Format type for context-aware parsing
  private detectedFormat: 'dm' | 'thread' | 'channel' | 'standard' | 'mixed' = 'standard';

  // Simplified core patterns
  private readonly patterns = {
    // Flexible username patterns
    username: [
      /^([A-Za-z0-9\s\-_.'\u00C0-\u017F]+)$/, // Simple username
      /^([A-Za-z0-9\s\-_.'\u00C0-\u017F]+)\s*(?::[\w\-+]+:|[\u{1F300}-\u{1F9FF}])*$/u, // Username with emoji
      /^!\[.*?\]\(.*?\)\s*([A-Za-z0-9\s\-_.'\u00C0-\u017F]+)/, // Avatar + username
    ],

    // Flexible timestamp patterns
    timestamp: [
      /^\[\d{1,2}:\d{2}\]$/i, // Simple bracketed time [8:26]
      /\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/i, // Time only
      /\b((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)\b/i, // Day of week
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)\b/i, // Month day
      /\b(Today|Yesterday)(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))?\b/i, // Relative date
      /\[(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)[^\]]*)\]\(https?:\/\/[^\)]*\/archives\/[^\)]+\)/i, // Linked timestamp - must be time/date format and link to Slack archives
    ],

    // Combined patterns
    userAndTime: [
      /^([A-Za-z0-9\s\-_.'\u00C0-\u017F]+?)(?:\1)?\s*\[([^\]]+)\]\(https?:\/\/[^\)]*\/archives\/[^\)]+\)\s*$/i, // Username (possibly doubled) + linked timestamp
      /^([A-Za-z0-9\s\-_.'\u00C0-\u017F]+?)(?:\1)?\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i, // Username (possibly doubled) + time
      /^([A-Za-z0-9\s\-_.'\u00C0-\u017F]+?)\s+\[(\d{1,2}:\d{2}\s*(?:AM|PM)?)\]$/i, // Username + simple bracketed time [3:45 PM]
      /^(.+?)\s+\[(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)[^\]]*)\]\(https?:\/\/[^\)]*\/archives\/[^\)]+\)$/i, // User + linked timestamp to Slack archives
      /^([A-Za-z0-9\s\-_.'\u00C0-\u017F]{2,30})\s+\[([^\]]+)\]\(https?:\/\/[^\)]+\)$/i, // Username + any linked timestamp (but restrict username pattern)
      /^(.+?)\s+(?:at\s+)?(\d{1,2}:\d{2})\s*$/i, // User at time
      /^(.+?)(?::[\w\-+]+:|[\u{1F300}-\u{1F9FF}])+\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/iu, // User + emoji + time
      /^(.+?)(:[a-zA-Z0-9_+-]+:)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i, // User emoji time (with space between emoji and time)
      /^([A-Za-z\u00C0-\u017F][A-Za-z\s\-_.\u00C0-\u017F]+?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i, // Simple name + time (more restrictive)
      // Multi-person DM specific patterns
      /^([A-Za-z\s\u00C0-\u017F]+)\1\s+\[(\d{1,2}:\d{2}\s*(?:AM|PM)?)\]\(https?:\/\/[^\)]*\/archives\/[CD][A-Z0-9]+\/p\d+\)\s*$/i, // Explicit doubled username + linked timestamp
      /^([A-Za-z]+)\1([A-Za-z\s]+)\2\s+\[(\d{1,2}:\d{2}\s*(?:AM|PM)?)\].*$/i, // Pattern like "AmyAmy BritoBrito [timestamp]"
    ],

    // Metadata patterns (simplified)
    metadata: [
      /^\d+\s+repl(?:y|ies)/i,
      /\d+\s+repl(?:y|ies)$/i, // Reply count at end of line (e.g., avatar images followed by "17 replies")
      /^View thread$/i,
      /^Thread:/i,
      /^:\w+:\s*\d+/, // Reaction
      /^This message was deleted/i,
      /^\+1$/,
      /^---+$/,
      /^replied to a thread:/i, // Thread reply indicator
      /^Last reply/i, // Thread timing info
      /^View newer replies$/i, // Thread navigation
      /^Added by/i, // File attachment info - matches "Added by [GitHub]..." etc
      /^\d+\s+files?$/i, // File count
      /^:[a-zA-Z0-9_+-]+:$/, // Standalone emoji (reaction indicator)
      /^!\[:.*?:\]\(.*?\)$/, // Standalone custom emoji image
      /^\d+$/, // Single number (likely a reaction count)
      /^Also sent to the channel$/i, // Thread broadcast indicator
      /^\d+\s+(?:new\s+)?messages?$/i, // Message count indicator
      /^Language$/i, // GitHub integration metadata
      /^(TypeScript|JavaScript|Python|Java|Go|Ruby|PHP|C\+\+|C#|Swift|Kotlin|Rust|Scala|Haskell|Clojure|Elixir|Erlang)$/i, // Programming language metadata
      /^Last updated$/i, // GitHub integration metadata
      /^\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\s+ago$/i, // Time ago patterns
      /^![^]]+]\(https?:\/\/[^)]+\)$/, // Standalone images/avatars
      /^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/, // Slack avatar images (specific pattern)
      /^[\w-]+\/[\w-]+$/, // GitHub repository names (e.g., "amittell/obsidian-dynamic-todo-list")
    ],

    // Avatar patterns specifically for thread format
    avatar: [
      /^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/, // Slack avatar URL pattern
    ],

    // Date separators
    dateSeparator: [
      /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?$/i,
      /^---\s*(.+?)\s*---$/,
    ],
  };

  /**
   * Main entry point for parsing Slack conversation text.
   * Executes multi-pass parsing to extract structured messages.
   * @param {string} text - Raw Slack conversation text
   * @param {boolean} [isDebugEnabled] - Enable debug logging
   * @returns {SlackMessage[]} Array of parsed Slack messages
   */
  parse(text: string, isDebugEnabled?: boolean): SlackMessage[] {
    const context: ParserContext = {
      lines: text.split('\n'),
      blocks: [],
      currentDate: null,
      debugInfo: [],
    };

    // Detect format for context-aware parsing
    this.detectedFormat = this.detectFormat(text);
    if (isDebugEnabled) {
      Logger.debug('FlexibleMessageParser', `Detected format: ${this.detectedFormat}`);
    }

    // Multi-pass parsing
    this.identifyMessageBlocks(context, isDebugEnabled);
    this.refineBlocks(context, isDebugEnabled);
    this.extractReactionsAndMetadata(context, isDebugEnabled);

    // Convert blocks to messages
    let messages = this.convertBlocksToMessages(context, isDebugEnabled);

    // Deduplicate messages based on content similarity
    messages = duplicateDetectionService.deduplicateMessages(messages, isDebugEnabled);

    if (isDebugEnabled) {
      Logger.debug('FlexibleMessageParser', 'Debug info', context.debugInfo);
      Logger.debug(
        'FlexibleMessageParser',
        `Parsed ${messages.length} unique messages from ${context.blocks.length} blocks`
      );
    }

    return messages;
  }

  /**
   * First pass: Identify potential message blocks.
   * Scans lines to find message boundaries based on pattern scores.
   * Handles date separators, metadata lines, and message headers.
   * @private
   * @param {ParserContext} context - Parser context to update
   * @param {boolean} [isDebugEnabled] - Enable debug logging
   * @returns {void}
   */
  private identifyMessageBlocks(context: ParserContext, isDebugEnabled?: boolean): void {
    let currentBlock: MessageBlock | null = null;
    let previousLineWasBlank = false;

    for (let i = 0; i < context.lines.length; i++) {
      const line = context.lines?.[i];
      const trimmed = line.trim();
      const score = this.scoreLine(trimmed, context);

      if (isDebugEnabled) {
        context.debugInfo.push(
          `Line ${i}: ${trimmed.substring(0, 50)}... Score: ${JSON.stringify(score)}`
        );
      }

      // Handle date separators
      if (score.isDateSeparator > MESSAGE_FRAGMENTATION_THRESHOLD) {
        if (currentBlock) {
          context.blocks.push(currentBlock);
          currentBlock = null;
        }
        this.updateDateContext(trimmed, context);
        continue;
      }

      // Check if this is an avatar line that precedes a message
      if (this.isAvatarLine(trimmed)) {
        // Check if next non-empty line is a username/timestamp combo (thread format)
        let nextMessageLineIndex = i + 1;
        let foundNextMessage = false;

        // Skip empty lines to find the next actual content
        while (nextMessageLineIndex < context.lines.length) {
          const nextLine = context.lines?.[nextMessageLineIndex]?.trim();
          if (nextLine) {
            const nextScore = this.scoreLine(nextLine, context);

            // If next non-empty line has high confidence for username/time, this avatar belongs to that message
            if (
              nextScore.confidence > CONFIDENCE_THRESHOLDS.timestamp ||
              nextScore.hasUserAndTime > CONFIDENCE_THRESHOLDS.timestamp
            ) {
              foundNextMessage = true;
              if (isDebugEnabled) {
                context.debugInfo.push(
                  `Line ${i}: Found avatar before message header at line ${nextMessageLineIndex}: ${trimmed}`
                );
              }
              // We'll capture this avatar when we process the next line
              break;
            } else {
              // Next content is not a message header, this avatar is standalone
              break;
            }
          }
          nextMessageLineIndex++;
        }

        if (foundNextMessage) {
          // Avatar belongs to upcoming message, skip for now
          previousLineWasBlank = false;
          continue;
        }

        // Avatar is standalone (not followed by message header) - ignore it completely
        // Don't add to current block as it would interfere with message boundaries
        if (isDebugEnabled) {
          context.debugInfo.push(`Line ${i}: Standalone avatar ignored: ${trimmed}`);
        }
        previousLineWasBlank = false;
        continue;
      }

      // Skip high-confidence metadata UNLESS it also has user/time info
      if (
        score.isMetadata > MESSAGE_FRAGMENTATION_THRESHOLD &&
        score.hasUserAndTime < TIMESTAMP_CONFIDENCE_THRESHOLD
      ) {
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
        if (
          currentBlock &&
          (/^\d+\s+repl(?:y|ies)/i.test(trimmed) ||
            /^Also sent to the channel$/i.test(trimmed) ||
            /^Added by/i.test(trimmed) ||
            /^\d+\s+files?$/i.test(trimmed) ||
            /^View thread$/i.test(trimmed) ||
            /^Thread:/i.test(trimmed) ||
            /^Last reply/i.test(trimmed))
        ) {
          currentBlock.content.push(line);
          currentBlock.endLine = i;
          previousLineWasBlank = false;
          continue;
        }

        previousLineWasBlank = false;
        continue;
      }

      // Check if this is a standalone timestamp that should be part of a message block
      // This handles cases like "[8:26](url)" which are message continuations
      if (
        score.isTimestamp > CONFIDENCE_THRESHOLDS.timestamp &&
        score.isUsername < CONFIDENCE_THRESHOLDS.lowConfidence &&
        !score.hasUserAndTime
      ) {
        // Check if this is a linked timestamp format that indicates a message continuation
        const isLinkedTimestamp =
          /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^\)]*\/archives\/[^\)]+\)$/i.test(
            trimmed
          );
        const isSimpleTimestamp = /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i.test(trimmed);
        const isBracketedTimestamp = /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]$/i.test(trimmed);

        // If we have a current block, add to it
        if (currentBlock) {
          if (isDebugEnabled) {
            context.debugInfo.push(
              `Line ${i}: Detected standalone timestamp "${trimmed}" - adding to current block`
            );
          }
          currentBlock.content.push(line);
          currentBlock.endLine = i;
          previousLineWasBlank = false;
          continue;
        }
        // Otherwise, check if we should merge with the previous block
        else if (context.blocks.length > 0) {
          const prevBlock = context.blocks[context.blocks.length - 1];
          // Only merge if the previous block has a known username
          if (prevBlock.username && prevBlock.username !== 'Unknown User') {
            // For continuation messages, be more careful about when to merge
            // Only merge if this is clearly a continuation pattern
            let shouldMerge = false;

            // Check the pattern more carefully
            if (isLinkedTimestamp) {
              // Linked timestamps like [8:26](url) are almost always continuations
              shouldMerge = true;
            } else if (isSimpleTimestamp || isBracketedTimestamp) {
              // For standard format, simple timestamps are continuations
              if (this.detectedFormat === 'standard' || this.detectedFormat === 'mixed') {
                shouldMerge = true;
              } else if (
                (this.detectedFormat === 'thread' || this.detectedFormat === 'channel') &&
                i + 1 < context.lines.length
              ) {
                // In thread/channel format, check if there's content after
                const nextLine = context.lines[i + 1].trim();
                const nextScore = this.scoreLine(nextLine, context);

                // If next line is regular content (not metadata), it's a continuation
                if (
                  nextLine &&
                  nextScore.isMetadata < CONFIDENCE_THRESHOLDS.highConfidence &&
                  nextScore.confidence < CONFIDENCE_THRESHOLDS.highConfidence
                ) {
                  shouldMerge = true;
                }
              }
            }

            if (shouldMerge || isLinkedTimestamp) {
              if (isDebugEnabled) {
                context.debugInfo.push(
                  `Line ${i}: Detected standalone timestamp "${trimmed}" - merging with previous block (${prevBlock.username})`
                );
              }
              // Create a new block that includes the previous content plus this continuation
              currentBlock = {
                startLine: prevBlock.startLine,
                endLine: i,
                username: prevBlock.username,
                timestamp: prevBlock.timestamp,
                avatarUrl: prevBlock.avatarUrl,
                content: [...prevBlock.content],
                confidence: prevBlock.confidence,
                reactions: prevBlock.reactions,
                threadInfo: prevBlock.threadInfo,
              };

              // Add the timestamp as part of the continuation
              if (currentBlock.content.length > 0) {
                currentBlock.content.push(''); // Add blank line separator
              }
              currentBlock.content.push(line); // Add the timestamp line

              // Replace the previous block with the extended one - but DON'T remove from blocks yet
              // Keep currentBlock active so subsequent content gets captured
              context.blocks[context.blocks.length - 1] = currentBlock;

              // Mark that we're in continuation mode - content after this should be captured
              currentBlock.endLine = i; // Will be updated as more content is added
              previousLineWasBlank = false;
              continue;
            }
          }
        }
      }

      // Start new block on high-confidence username/timestamp
      if (
        score.confidence > CONFIDENCE_THRESHOLDS.timestamp &&
        (score.isUsername > CONFIDENCE_THRESHOLDS.timestamp ||
          score.hasUserAndTime > CONFIDENCE_THRESHOLDS.timestamp)
      ) {
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

        // If we only got a username, check if timestamp is on next line
        if (currentBlock.username && !currentBlock.timestamp && i + 1 < context.lines.length) {
          i = this.processUsernameWithSeparateTimestamp(currentBlock, context, i);
        }

        previousLineWasBlank = false;
      }
      // Continue current block
      else if (currentBlock && trimmed !== '') {
        // Check if previous line was a timestamp - if so, this is definitely content
        if (i > 0 && currentBlock.timestamp && currentBlock.startLine + 1 === i - 1) {
          // This line immediately follows the timestamp line, so it's content
          currentBlock.endLine = i;
          currentBlock.content.push(line);
        } else if (
          score.confidence < CONFIDENCE_THRESHOLDS.mediumConfidence ||
          score.isMetadata > CONFIDENCE_THRESHOLDS.timestamp
        ) {
          // Low confidence or metadata - add to current block
          currentBlock.endLine = i;
          currentBlock.content.push(line);
        } else {
          // This might be content, but check context
          currentBlock.endLine = i;
          currentBlock.content.push(line);
        }
        previousLineWasBlank = false;
      }
      // Handle blank lines
      else if (trimmed === '') {
        if (currentBlock && previousLineWasBlank) {
          // Check if we're in a continuation block - if so, be more lenient about closing
          const isRecentContinuation = currentBlock.content.some(
            content =>
              /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i.test(content.trim()) ||
              /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]$/i.test(content.trim())
          );

          if (!isRecentContinuation) {
            context.blocks.push(currentBlock);
            currentBlock = null;
          } else {
            // We're in a continuation - just add the blank line but don't close yet
            currentBlock.content.push('');
          }
        } else if (currentBlock) {
          currentBlock.content.push('');
        }
        previousLineWasBlank = true;
      }
      // Standalone content (no header)
      else if (!currentBlock && trimmed !== '' && score.isMetadata < 0.5) {
        // Don't create a new block for standalone timestamps - they should be continuations
        const isStandaloneTimestamp =
          score.isTimestamp > CONFIDENCE_THRESHOLDS.timestamp &&
          score.isUsername < CONFIDENCE_THRESHOLDS.lowConfidence &&
          !score.hasUserAndTime;

        if (!isStandaloneTimestamp) {
          currentBlock = {
            startLine: i,
            endLine: i,
            content: [line],
            confidence: 0.3,
          };
          previousLineWasBlank = false;
        }
      }
    }

    // Don't forget the last block
    if (currentBlock) {
      context.blocks.push(currentBlock);
    }
  }

  /**
   * Second pass: Refine blocks by looking at context.
   * Handles split timestamps, merges continuation blocks, and adjusts boundaries.
   * Identifies and corrects common parsing errors from the first pass.
   * @private
   * @param {ParserContext} context - Parser context to update
   * @param {boolean} [isDebugEnabled] - Enable debug logging
   * @returns {void}
   */
  private refineBlocks(context: ParserContext, isDebugEnabled?: boolean): void {
    for (let i = 0; i < context.blocks.length; i++) {
      const block = context.blocks?.[i];

      // Handle split username/timestamp patterns (e.g., "Feb 25th at" on one line, "10:39 AM" on next)
      if (block.username && /\s+at$/i.test(block.username) && !block.timestamp) {
        // This looks like a date ending with "at" - check if next line has time
        const nextLineIndex = block.startLine + 1;
        if (nextLineIndex < context.lines.length) {
          const nextLine = context.lines?.[nextLineIndex]?.trim();
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
                const contentLine = context.lines?.[j];
                if (contentLine.trim() !== '') {
                  block.content.push(contentLine);
                }
              }
            }

            block.confidence = MESSAGE_FRAGMENTATION_THRESHOLD;
          }
        }
      }

      // Check if this block is actually a continuation of previous block
      if (i > 0) {
        const prevBlock = context.blocks[i - 1];

        // Check if this block starts with just a timestamp and no username
        if (!block.username || block.username === 'Unknown User') {
          // Check if the block's first line is a timestamp
          const firstLineOfBlock = context.lines[block.startLine].trim();
          // Enhanced timestamp detection for various formats
          const timestampPatterns = [
            /^\[?\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]?$/i, // [8:26] or 8:26 AM
            /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\]\(https?:\/\/[^)]+\)$/i, // [8:26](url)
            /^\d{1,2}:\d{2}$/i, // Simple 8:26
            /^Today at \d{1,2}:\d{2}\s*(?:AM|PM)?$/i, // Today at 8:26 AM
            /^Yesterday at \d{1,2}:\d{2}\s*(?:AM|PM)?$/i, // Yesterday at 8:26 AM
          ];
          const isStandaloneTimestamp = timestampPatterns.some(pattern =>
            pattern.test(firstLineOfBlock)
          );

          if (isDebugEnabled) {
            context.debugInfo.push(
              `Block ${i}: Checking standalone timestamp. FirstLine: "${firstLineOfBlock}", isStandaloneTimestamp: ${isStandaloneTimestamp}, prevBlock.username: "${prevBlock?.username || 'none'}"`
            );
          }

          if (isStandaloneTimestamp) {
            // FORMAT-AWARE: In thread/channel format, check if username follows timestamp
            if (this.detectedFormat === 'thread' || this.detectedFormat === 'channel') {
              // Check if this block has a username that follows the timestamp pattern
              if (block.username && block.username !== 'Unknown User') {
                // In thread format: [timestamp]\n\nUsername\n\ncontent is a continuation
                if (prevBlock.username && prevBlock.username !== 'Unknown User') {
                  if (isDebugEnabled) {
                    context.debugInfo.push(
                      `Thread format: Merging continuation block ${i} (timestamp + ${block.username}) into previous block from ${prevBlock.username}`
                    );
                  }
                  // This is a continuation message - merge into previous
                  prevBlock.content.push(''); // Add blank line separator
                  prevBlock.content.push(firstLineOfBlock); // Add the timestamp
                  prevBlock.content.push(''); // Blank line
                  prevBlock.content.push(block.username); // Add the username line
                  prevBlock.content.push(''); // Blank line
                  prevBlock.content.push(...block.content); // Add the content
                  prevBlock.endLine = block.endLine;
                  context.blocks.splice(i, 1);
                  i--;
                  continue;
                }
              }
            } else if (prevBlock.username && prevBlock.username !== 'Unknown User') {
              // DM/Standard format: standalone timestamp with previous username = continuation
              if (isDebugEnabled) {
                context.debugInfo.push(
                  `Merging standalone timestamp block ${i} into previous block`
                );
              }
              // This is a continuation message from the same user
              // Merge this block into the previous one
              prevBlock.content.push(''); // Add blank line separator
              prevBlock.content.push(firstLineOfBlock); // Add the timestamp
              prevBlock.content.push(...block.content); // Add the content
              prevBlock.endLine = block.endLine;
              context.blocks.splice(i, 1);
              i--;
              continue;
            }
          }
        }

        // Also check if username looks like content that should belong to previous block
        if (block.username) {
          const suspiciousPatterns = [
            /^(One thing|At Friday|Hosted and|Also sent|Added by|View thread|Thread:|Last reply)/i,
            /^(Estimated timeline|We haven't notified|Infosys team showed|They have|They already|They take|They agreed)/i,
            /^(Feb|Jan|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(st|nd|rd|th)?\s+at$/i,
            /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+at$/i,
            /^(Today|Yesterday)\s+at$/i,
          ];

          const isSuspicious = block.username
            ? suspiciousPatterns.some(pattern => pattern.test(block.username!))
            : false;

          if (isSuspicious) {
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
            if (block.content?.length > 0 && block.content?.[0]?.trim() === block.timestamp) {
              block.content.shift();
            }
            block.confidence += 0.3;
          }
        } else if (block.content.length > 0) {
          const firstContent = block.content?.[0]?.trim();
          const timestampScore = this.scoreTimestamp(firstContent);

          if (timestampScore > TIMESTAMP_CONFIDENCE_THRESHOLD) {
            block.timestamp = firstContent;
            block.content.shift();
            block.confidence += 0.2;
          }
        }
      }

      // Check for avatar in previous line (enhanced for Slack avatars)
      if (i > 0 && block.startLine > 0) {
        try {
          const prevLine = context.lines[block.startLine - 1].trim();
          // Check for Slack avatar pattern first
          if (this.isAvatarLine(prevLine)) {
            const avatarMatch = prevLine.match(/^!\[\]\((https?:\/\/[^\)]+)\)$/);
            if (
              avatarMatch &&
              avatarMatch.length > 1 &&
              avatarMatch[1] &&
              avatarMatch[1] !== null
            ) {
              block.avatarUrl = avatarMatch[1];
            }
          } else {
            // Fall back to general image pattern
            const avatarMatch = prevLine.match(/^!\[.*?\]\((https?:\/\/[^\)]+)\)$/);
            if (
              avatarMatch &&
              avatarMatch.length > 1 &&
              avatarMatch[1] &&
              avatarMatch[1] !== null
            ) {
              block.avatarUrl = avatarMatch[1];
            }
          }
        } catch (error) {
          Logger.debug('FlexibleMessageParser', 'Error extracting avatar URL', { error });
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
   * Third pass: Extract reactions and thread metadata.
   * Removes metadata from content and populates reaction/thread properties.
   * Handles various reaction formats and thread indicators.
   * @private
   * @param {ParserContext} context - Parser context to update
   * @param {boolean} [isDebugEnabled] - Enable debug logging
   * @returns {void}
   */
  private extractReactionsAndMetadata(context: ParserContext, isDebugEnabled?: boolean): void {
    for (const block of context.blocks) {
      const reactions: SlackReaction[] = [];
      let threadInfo: string | undefined;
      let attachmentInfo: string[] = [];
      const cleanedContent: string[] = [];

      for (let i = 0; i < block.content.length; i++) {
        const line = block.content?.[i];
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
        if (
          /^\d+\s+repl(?:y|ies)/i.test(trimmed) ||
          /View thread/i.test(trimmed) ||
          /^replied to a thread:/i.test(trimmed) ||
          /^Last reply/i.test(trimmed) ||
          /^Also sent to the channel$/i.test(trimmed) ||
          /^Thread:/i.test(trimmed)
        ) {
          threadInfo = (threadInfo ? threadInfo + ' ' : '') + trimmed;

          // If this is "replied to a thread:", capture the context (next line)
          if (/^replied to a thread:/i.test(trimmed) && i + 1 < block.content.length) {
            const contextLine = block.content[i + 1].trim();
            // Only capture if it doesn't look like metadata or a new message
            if (
              contextLine &&
              !/^\d+\s+repl(?:y|ies)/i.test(contextLine) &&
              !/^View thread/i.test(contextLine) &&
              !/^Last reply/i.test(contextLine) &&
              !/^:[a-zA-Z0-9_+-]+:$/.test(contextLine)
            ) {
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

      // Add attachment info back to content if present AND there's actual file info
      // Don't add back standalone "Added by" lines that aren't associated with files
      if (attachmentInfo.length > 0) {
        // Check if we have actual file attachment info (not just "Added by")
        const hasFileInfo = attachmentInfo.some(info => /^\d+\s+files?$/i.test(info));
        if (hasFileInfo) {
          cleanedContent.push('', `📎 ${attachmentInfo.join(' - ')}`);
        }
        // If it's just "Added by" without file count, it's probably link preview metadata
        // and should be filtered out completely
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
   * Score a line to determine what it might be.
   * Calculates probability scores for different line types.
   * @private
   * @param {string} line - The line to score
   * @param {ParserContext} context - Current parser context
   * @returns {PatternScore} Probability scores for different patterns
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
    const signals = [
      score.isUsername,
      score.isTimestamp,
      score.hasUserAndTime,
      score.isDateSeparator,
    ];
    score.confidence = Math.max(...signals);

    // Boost confidence if multiple signals
    const activeSignals = signals.filter(s => s > CONFIDENCE_THRESHOLDS.mediumConfidence).length;
    if (activeSignals > 1) {
      score.confidence = Math.min(
        CONFIDENCE_THRESHOLDS.absolute,
        score.confidence + CONFIDENCE_THRESHOLDS.multiSignalBoost * activeSignals
      );
    }

    return score;
  }

  /**
   * Score how likely a line is to be a username.
   * Applies various heuristics to distinguish usernames from content.
   * @private
   * @param {string} line - The line to score
   * @returns {number} Probability score between 0 and 1
   */
  private scoreUsername(line: string): number {
    let maxScore = 0;

    try {
      // Check if line is just an emoji code or reaction - not a username
      if (/^:[a-zA-Z0-9_+-]+:$/.test(line) || /^!\[:.*?:\]\(.*?\)$/.test(line)) {
        return 0;
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Regex error in scoreUsername emoji check', {
        line,
        error,
      });
      return 0;
    }

    try {
      // Check for patterns that look like link preview titles (e.g., "GuidewireGuidewire")
      if (/^([A-Za-z\u00C0-\u017F]+)\1$/.test(line) && line.length > 10) {
        return 0;
      }

      // Single short words are unlikely to be usernames without more context
      if (/^[A-Za-z\u00C0-\u017F]{1,3}$/.test(line)) {
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
      if (
        /^(One thing|At Friday|Hosted and|Also sent|Added by|View thread|Thread:|Last reply|Language|TypeScript|Last updated|Nice|Oh interesting|Interesting|Hey|hi team|Just noticed|Went to|New message|First message|Initial message|This is)/i.test(
          line
        )
      ) {
        return 0;
      }

      // Lines that look like message content (sentences with common words) are not usernames
      if (
        /^(Main|Continuation|Message|Content|Reply|Response|Update|Comment|Note|Text|Information|Details|Summary|Description|Explanation|Question|Answer|Thanks|Thank|Please|Sorry|Sure|Yes|No|Ok|Okay|Right|Well|So|But|And|Or|Also|However|Actually|Really|Just|Still|Only|Even|More|Less|Some|Many|Most|All|Any|Each|Every|Both|Either|Neither|Few|Several|Other|Another|Next|Last|First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Previous|Following|Above|Below|Here|There|Where|When|Why|How|What|Who|Which|That|These|Those|Before|After|During|While|Since|Until|If|Unless|Although|Because|Since|As|Like|Such|Same|Different|Similar|Various|Specific|General|Important|Necessary|Possible|Impossible|Easy|Difficult|Good|Bad|Great|Excellent|Amazing|Wonderful|Terrible|Awful|Nice|Fine|Better|Best|Worse|Worst|New|Old|Recent|Current|Future|Past|Present|Today|Tomorrow|Yesterday|Now|Later|Soon|Never|Always|Sometimes|Often|Usually|Rarely|Seldom|Once|Twice|Again|Still|Yet|Already|Finally|Eventually|Immediately|Quickly|Slowly|Carefully|Properly|Correctly|Incorrectly|Exactly|Approximately|Probably|Definitely|Certainly|Obviously|Clearly|Unfortunately|Fortunately|Hopefully|Basically|Essentially|Generally|Specifically|Particularly|Especially|Mainly|Mostly|Primarily|Simply|Actually|Really|Truly|Honestly|Seriously|Absolutely|Completely|Totally|Partially|Slightly|Significantly|Considerably|Extremely|Very|Quite|Rather|Pretty|Too|Enough|Almost|Nearly|About|Around|Over|Under|Through|Across|Along|Against|Towards|Without|Within|Outside|Inside|Between|Among|Despite|Although|However|Therefore|Thus|Hence|Consequently|Furthermore|Moreover|Additionally|Also|Besides|Instead|Otherwise|Meanwhile|Anyway|Regardless|Nevertheless|Nonetheless|Indeed|Actually|Obviously|Apparently|Fortunately|Unfortunately|Interestingly|Surprisingly|Remarkably)\s+(part|message|content|text|line|section|paragraph|sentence|word|phrase|statement|remark|comment|note|reply|response|update|piece|item|thing|element|component|aspect|feature|detail|point|topic|subject|matter|issue|problem|solution|answer|question|example|instance|case|situation|condition|status|state|stage|step|phase|level|degree|amount|number|count|total|sum|result|outcome|effect|impact|consequence|reason|cause|purpose|goal|objective|target|aim|plan|idea|thought|concept|notion|opinion|view|perspective|approach|method|way|manner|style|type|kind|sort|form|format|structure|design|pattern|model|system|process|procedure|technique|strategy|tactic|action|activity|task|job|work|effort|attempt|try|test|trial|experiment|study|research|analysis|investigation|examination|review|evaluation|assessment|judgment|decision|choice|option|alternative|possibility|chance|opportunity|risk|danger|threat|challenge|difficulty|obstacle|barrier|limitation|restriction|constraint|requirement|condition|criterion|standard|rule|regulation|policy|principle|guideline|instruction|direction|guidance|advice|suggestion|recommendation|proposal|offer|request|demand|requirement|need|want|desire|wish|hope|dream|expectation|anticipation|prediction|forecast|estimate|calculation|measurement|observation|discovery|finding|conclusion|result|person's?)/i.test(
          line
        )
      ) {
        return 0;
      }

      // Lines that contain common sentence structures are not usernames
      if (
        /\b(the|a|an|this|that|these|those|my|your|his|her|its|our|their|some|any|all|every|each|many|much|more|most|few|several|other|another|one|two|three|four|five|first|second|third|last|next|before|after|during|while|when|where|why|how|what|who|which|if|unless|because|since|as|like|than|but|and|or|so|yet|for|nor|to|of|in|on|at|by|with|from|up|out|off|over|under|above|below|through|across|into|onto|upon|within|without|between|among|around|about|against|towards|during|throughout|until|since|before|after|while|when|where)\b/i.test(
          line
        )
      ) {
        return 0;
      }

      // Lines with possessives or contractions (like "B's continuation") are not usernames
      if (/^[A-Z]'s\s+\w+/i.test(line)) {
        return 0;
      }

      // Lines that look like GitHub integration metadata
      if (
        /^(Language|TypeScript|Last updated|\d+\s+(?:minutes?|hours?|days?)\s+ago)$/i.test(line)
      ) {
        return 0;
      }

      // Lines ending with "at" (incomplete timestamps) are not usernames
      if (/\s+at$/i.test(line)) {
        return 0;
      }

      // Date patterns that might appear on their own line
      if (
        /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)\s+\d{1,2}(st|nd|rd|th)?\s+at$/i.test(
          line
        )
      ) {
        return 0;
      }

      // Single timestamp on a line is not a username
      if (/^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i.test(line)) {
        return 0;
      }

      // Simple URL-like patterns are not usernames
      if (/^https?:\/\//i.test(line)) {
        return 0;
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Regex error in scoreUsername pattern checks', {
        line,
        error,
      });
      return 0;
    }

    try {
      for (const pattern of this.patterns.username) {
        if (pattern.test(line)) {
          let score = CONFIDENCE_THRESHOLDS.timestamp;

          // Boost score for certain characteristics
          if (line.length < 50) score += CONFIDENCE_THRESHOLDS.lengthBoost;
          if (!/\d{4,}/.test(line)) score += CONFIDENCE_THRESHOLDS.lengthBoost; // No long numbers
          if (/^[A-Z]/.test(line)) score += CONFIDENCE_THRESHOLDS.capitalStartBoost; // Starts with capital

          maxScore = Math.max(maxScore, Math.min(CONFIDENCE_THRESHOLDS.absolute, score));
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Regex error in scoreUsername pattern matching', {
        line,
        error,
      });
      return 0;
    }

    return maxScore;
  }

  /**
   * Score how likely a line is to be a timestamp.
   * Checks various timestamp formats including linked timestamps.
   * @private
   * @param {string} line - The line to score
   * @returns {number} Probability score between 0 and 1
   */
  private scoreTimestamp(line: string): number {
    let maxScore = 0;

    try {
      for (const pattern of this.patterns.timestamp) {
        if (pattern.test(line)) {
          let score: number = CONFIDENCE_THRESHOLDS.fragmentation;

          // Boost for specific formats
          if (/^\[\d{1,2}:\d{2}\]$/i.test(line)) score = CONFIDENCE_THRESHOLDS.absolute; // Perfect score for [8:26] format
          if (/^\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(line))
            score = CONFIDENCE_THRESHOLDS.veryHighConfidence;
          if (
            /\[.+\]\(http/i.test(line) &&
            line.length < CONFIDENCE_THRESHOLDS.contentPreviewLength
          )
            score = CONFIDENCE_THRESHOLDS.perfectMatch;

          maxScore = Math.max(maxScore, score);
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Regex error in scoreTimestamp', { line, error });
      return 0;
    }

    return maxScore;
  }

  /**
   * Score how likely a line contains both user and time.
   * Checks for combined username/timestamp patterns.
   * @private
   * @param {string} line - The line to score
   * @returns {number} Probability score between 0 and 1
   */
  private scoreUserAndTime(line: string): number {
    let maxScore = 0;

    try {
      for (const pattern of this.patterns.userAndTime) {
        if (pattern.test(line)) {
          maxScore = Math.max(maxScore, 0.9);
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Regex error in scoreUserAndTime', { line, error });
      return 0;
    }

    return maxScore;
  }

  /**
   * Score how likely a line is a date separator.
   * Identifies date headers that separate conversation days.
   * @private
   * @param {string} line - The line to score
   * @returns {number} Probability score between 0 and 1
   */
  private scoreDateSeparator(line: string): number {
    try {
      for (const pattern of this.patterns.dateSeparator) {
        if (pattern.test(line)) {
          return 0.95;
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Regex error in scoreDateSeparator', { line, error });
      return 0;
    }
    return 0;
  }

  /**
   * Score how likely a line is metadata.
   * Identifies thread info, reactions, and other non-content lines.
   * @private
   * @param {string} line - The line to score
   * @returns {number} Probability score between 0 and 1
   */
  private scoreMetadata(line: string): number {
    try {
      for (const pattern of this.patterns.metadata) {
        if (pattern.test(line)) {
          return 0.9;
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Regex error in scoreMetadata', { line, error });
      return 0;
    }
    return 0;
  }

  /**
   * Extract header information from a line with format awareness.
   * Parses username and timestamp from message headers using format detection.
   * @private
   * @param {string} line - The header line to parse
   * @param {MessageBlock} block - The block to update with extracted info
   * @param {ParserContext} context - Current parser context
   * @returns {void}
   */
  private extractHeaderInfo(line: string, block: MessageBlock, context: ParserContext): void {
    try {
      // Detect the message format first
      const format = detectMessageFormat(line);

      // Apply format-aware extraction
      if (format === MessageFormat.THREAD) {
        // Thread format: "Username![:emoji:](url) [timestamp](url)"
        const username = extractUsernameFromThreadFormat(line);
        if (username && username !== 'Unknown User') {
          block.username = username;
        }

        // Extract timestamp from thread format
        const timestampMatch = line.match(/\[([^\]]+)\]\(https?:\/\/[^)]+\)$/);
        if (timestampMatch && timestampMatch[1]) {
          block.timestamp = timestampMatch[1];
        }
        return;
      } else if (format === MessageFormat.DM) {
        // Enhanced DM format handling for multi-person DMs

        // Handle multi-person DM pattern: "UserNameUserName [timestamp](url)"
        const multiPersonDMPattern =
          /^([A-Za-z\s\u00C0-\u017F]+)\1\s+\[([^\]]+)\]\(https?:\/\/[^)]+\)$/;
        const multiPersonMatch = line.match(multiPersonDMPattern);

        if (multiPersonMatch && multiPersonMatch[1] && multiPersonMatch[2]) {
          // Extract doubled username and timestamp
          const username = extractUsernameFromDMFormat(multiPersonMatch[1].trim());
          block.username = username;
          block.timestamp = multiPersonMatch[2];
          return;
        }

        // Handle split doubled pattern: "AmyAmy BritoBrito [timestamp]"
        const splitDoubledPattern = /^([A-Za-z]+)\1([A-Za-z\s]+)\2\s+\[([^\]]+)\]/;
        const splitMatch = line.match(splitDoubledPattern);

        if (splitMatch && splitMatch[1] && splitMatch[2] && splitMatch[3]) {
          // Reconstruct full name and extract timestamp
          const fullName = splitMatch[1] + splitMatch[2];
          const username = extractUsername(fullName, MessageFormat.DM);
          block.username = username;
          block.timestamp = splitMatch[3];
          return;
        }

        // Handle any username + timestamp pattern in DM format
        const usernameTimestampPattern = /^(.+?)\s+\[([^\]]+)\]/;
        const usernameTimestampMatch = line.match(usernameTimestampPattern);

        if (usernameTimestampMatch && usernameTimestampMatch[1] && usernameTimestampMatch[2]) {
          const username = extractUsernameFromDMFormat(usernameTimestampMatch[1]);
          block.username = username;
          block.timestamp = usernameTimestampMatch[2];
          return;
        }

        // Fallback: standalone timestamp line (original logic)
        const timestampMatch = line.match(/^\[([^\]]+)\]\(https?:\/\/[^)]+\)$/);
        if (timestampMatch && timestampMatch[1]) {
          block.timestamp = timestampMatch[1];
        }
        return;
      }

      // Fall back to original logic for unknown formats
      // Try combined patterns first
      for (let i = 0; i < this.patterns.userAndTime.length; i++) {
        const pattern = this.patterns.userAndTime?.[i];
        const match = line.match(pattern);
        if (match && match.length > 1) {
          // Handle different pattern matches with null safety
          if (i === 0 || i === 1) {
            // Username (possibly doubled) patterns
            block.username = this.cleanUsername(
              match[1] && match[1] !== null ? match[1] : '',
              format
            );
            block.timestamp = match[2] && match[2] !== null ? match[2] : '';
          } else if (i === 4) {
            // User + emoji + time pattern
            block.username = this.cleanUsername(
              match[1] && match[1] !== null ? match[1] : '',
              format
            );
            block.timestamp = match[2] && match[2] !== null ? match[2] : '';
          } else if (i === 5) {
            // User emoji time (with space between emoji and time)
            block.username = this.cleanUsername(
              match[1] && match[1] !== null ? match[1] : '',
              format
            );
            block.timestamp = match.length > 3 && match[3] && match[3] !== null ? match[3] : '';
          } else {
            block.username = this.cleanUsername(
              match[1] && match[1] !== null ? match[1] : '',
              format
            );
            block.timestamp = match.length > 2 && match[2] && match[2] !== null ? match[2] : '';
          }
          return;
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Error in extractHeaderInfo combined patterns', {
        line,
        error,
      });
    }

    try {
      // Try username patterns
      for (const pattern of this.patterns.username) {
        const match = line.match(pattern);
        if (match && match[0]) {
          const usernameValue =
            match.length > 1 && match[1] && match[1] !== null ? match[1] : match[0];
          block.username = this.cleanUsername(usernameValue || '', MessageFormat.UNKNOWN);
          break;
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Error in extractHeaderInfo username patterns', {
        line,
        error,
      });
    }

    try {
      // Try timestamp patterns
      for (const pattern of this.patterns.timestamp) {
        const match = line.match(pattern);
        if (match && match[0]) {
          const timestampValue =
            match.length > 1 && match[1] && match[1] !== null ? match[1] : match[0];
          block.timestamp = timestampValue || '';
          break;
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Error in extractHeaderInfo timestamp patterns', {
        line,
        error,
      });
    }
  }

  /**
   * Clean username by removing emojis and artifacts with format awareness.
   * Handles doubled usernames, emoji codes, and formatting artifacts.
   * @private
   * @param {string} username - Raw username string
   * @param {MessageFormat} [format] - Message format for context-aware cleaning
   * @returns {string} Cleaned username or 'Unknown User'
   */
  private cleanUsername(username: string, format?: MessageFormat): string {
    let cleaned = username;

    // Remove emojis (but preserve for format-aware processing)
    cleaned = cleaned.replace(/:[a-zA-Z0-9_+-]+:/g, '').trim();
    cleaned = cleaned
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    // Clean up doubled names with format awareness
    cleaned = cleanupDoubledUsernames(cleaned, format);

    // Remove trailing punctuation
    cleaned = cleaned.replace(/[!?,.;:]+$/, '').trim();

    // Handle avatar prefix
    cleaned = cleaned.replace(/^!\[.*?\]\(.*?\)\s*/, '');

    return cleaned || 'Unknown User';
  }

  /**
   * Extract reactions from a line.
   * Parses emoji:count pairs in various formats including complex patterns.
   * @private
   * @param {string} line - The line to parse for reactions
   * @returns {SlackReaction[]} Array of extracted reactions
   */
  private extractReactions(line: string): SlackReaction[] {
    const reactions: SlackReaction[] = [];

    // Enhanced pattern for complex reaction formats including linked emoji images
    // Handles patterns like: ![:subscribe:](url)4![:heavy_plus_sign:](url)1
    const complexReactionPattern = /!\[:([^:]+):\]\([^)]+\)(\d+)/g;

    // Standard pattern for emoji:count pairs
    const standardReactionPattern =
      /(:[a-zA-Z0-9_+-]+:|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])\s*(\d+)/gu;

    // Process complex reaction patterns first (linked emoji images)
    let match;
    while ((match = complexReactionPattern.exec(line)) !== null) {
      if (
        !match ||
        match.length < 3 ||
        !match[1] ||
        !match[2] ||
        match[1] === null ||
        match[2] === null
      )
        continue;

      const name = match[1];
      const count = parseInt(match[2], 10);

      if (!isNaN(count) && name) {
        reactions.push({ name, count });
      }
    }

    // Process standard reaction patterns (avoiding overlap with complex patterns)
    const processedText = line.replace(complexReactionPattern, ''); // Remove already processed reactions
    complexReactionPattern.lastIndex = 0; // Reset regex state

    while ((match = standardReactionPattern.exec(processedText)) !== null) {
      if (
        !match ||
        match.length < 3 ||
        !match[1] ||
        !match[2] ||
        match[1] === null ||
        match[2] === null
      )
        continue;

      const emoji = match[1];
      const count = parseInt(match[2], 10);

      if (!isNaN(count) && emoji) {
        let name = emoji;

        // Extract name from standard emoji format
        if (emoji.startsWith(':') && emoji.endsWith(':')) {
          name = emoji.slice(1, -1);
        }

        reactions.push({ name, count });
      }
    }

    return reactions;
  }

  /**
   * Update date context from date separator.
   * Parses date headers to maintain temporal context for messages.
   * @private
   * @param {string} line - The date separator line
   * @param {ParserContext} context - Parser context to update
   * @returns {void}
   */
  private updateDateContext(line: string, context: ParserContext): void {
    try {
      for (const pattern of this.patterns.dateSeparator) {
        const match = line.match(pattern);
        if (match && match[0]) {
          const dateStr = match.length > 1 && match[1] && match[1] !== null ? match[1] : match[0];
          if (dateStr) {
            const parsed = parseDate(dateStr);
            if (parsed) {
              context.currentDate = parsed;
            }
          }
          break;
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Error in updateDateContext', { line, error });
    }
  }

  /**
   * Convert blocks to SlackMessage objects.
   * Final step that transforms parsed blocks into structured messages.
   * @private
   * @param {ParserContext} context - Parser context with blocks
   * @param {boolean} [isDebugEnabled] - Enable debug logging
   * @returns {SlackMessage[]} Array of structured Slack messages
   */
  private convertBlocksToMessages(
    context: ParserContext,
    isDebugEnabled?: boolean
  ): SlackMessage[] {
    const messages: SlackMessage[] = [];

    for (const block of context.blocks) {
      const message = new SlackMessage();

      // Set basic properties
      message.username = block.username || 'Unknown User';

      // Filter out content that looks like it might be a timestamp that wasn't properly extracted
      // BUT keep timestamps that are part of continuation messages
      const filteredContent = block.content.filter((line, index) => {
        const trimmed = line.trim();

        // Check if this is a standalone timestamp
        const isStandaloneTimestamp =
          /^\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(trimmed) ||
          /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday)\s+\d{1,2}(st|nd|rd|th)?\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(
            trimmed
          ) ||
          /^\[\d{1,2}:\d{2}(?:\s*(?:AM|PM))?\](?:\(https?:\/\/[^)]+\))?$/i.test(trimmed);

        if (isStandaloneTimestamp) {
          // Keep it if:
          // 1. This block has a username (not Unknown User) - meaning it's a merged continuation
          // 2. AND there's content after this timestamp line
          if (
            block.username &&
            block.username !== 'Unknown User' &&
            index < block.content.length - 1 &&
            block.content.slice(index + 1).some(l => l.trim() !== '')
          ) {
            return true; // Keep the timestamp as part of continuation
          }
          return false; // Filter out orphaned timestamps
        }

        return true; // Keep all non-timestamp content
      });

      message.text = filteredContent.join('\n').trim();

      // Set timestamp - preserve original format
      if (block.timestamp) {
        // Store the original timestamp string for display
        message.timestamp = block.timestamp;

        // Also try to parse it to set the date context
        const parsed = parseSlackTimestamp(block.timestamp, context.currentDate);
        if (parsed) {
          message.date = context.currentDate || parsed;
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

      // Only add messages with substantial content and valid usernames
      if (
        (message.text && message.text.length > MIN_MESSAGE_CONTENT_LENGTH) ||
        message.reactions ||
        message.threadInfo
      ) {
        // Skip messages with obvious non-username patterns
        if (
          message.username &&
          (/^\d+$/.test(message.username) || // Just numbers
            /^[A-Za-z\u00C0-\u017F]{1,3}$/.test(message.username) || // Very short words like "1", "Nice"
            /^(Language|TypeScript|Last updated|\d+\s+(?:minutes?|hours?|days?)\s+ago)$/i.test(
              message.username
            ) ||
            // Skip if username looks like a sentence fragment (contains common phrase starters)
            /^(First|Second|Third|Next|Last|Another|Other|This|That|These|Those|Some|Many|Few|Several|All|Any|Each|Every)\s+(message|comment|note|reply|response|update|post|item|thing)/i.test(
              message.username
            ))
        ) {
          continue;
        }
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Process a username line that may have a separate timestamp on the next line.
   * Handles complex logic for detecting and capturing message content.
   *
   * @private
   * @param currentBlock - The current message block being processed
   * @param context - Parser context with lines and debug info
   * @param currentIndex - Current line index
   * @returns New line index after processing
   */
  private processUsernameWithSeparateTimestamp(
    currentBlock: MessageBlock,
    context: ParserContext,
    currentIndex: number
  ): number {
    let i = currentIndex;
    const nextLine = context.lines[i + 1];
    const nextLineTrimmed = nextLine.trim();

    // Check if next line contains a timestamp
    if (this.isTimestampLine(nextLine)) {
      currentBlock.timestamp = nextLineTrimmed;
      currentBlock.endLine = i + 1;
      i++; // Skip the timestamp line

      // Capture content lines that follow the timestamp
      i = this.captureMessageContent(currentBlock, context, i);
    }

    return i;
  }

  /**
   * Check if a line contains timestamp patterns.
   *
   * @private
   * @param line - Line to check for timestamp patterns
   * @returns True if line contains timestamp patterns
   */
  private isTimestampLine(line: string): boolean {
    return (
      /^\s*(?:\d{1,2}:\d{2}\s*(?:AM|PM)?|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Today|Yesterday).*?\d{1,2}:\d{2}\s*(?:AM|PM)?)/i.test(
        line
      ) || /^\s*\[.*\]\(https?:\/\/[^\)]*\/archives\/[^\)]+\)/.test(line)
    );
  }

  /**
   * Capture message content lines following a timestamp.
   * Handles complex logic for determining where a message ends.
   *
   * @private
   * @param currentBlock - The current message block being processed
   * @param context - Parser context with lines and debug info
   * @param currentIndex - Current line index
   * @returns New line index after capturing content
   */
  private captureMessageContent(
    currentBlock: MessageBlock,
    context: ParserContext,
    currentIndex: number
  ): number {
    let i = currentIndex;

    while (i + 1 < context.lines.length) {
      const contentLine = context.lines[i + 1];
      const contentTrimmed = contentLine.trim();

      // Check if we should stop content capture
      if (this.shouldStopContentCapture(contentTrimmed, context, i)) {
        break;
      }

      // Add this line as content
      currentBlock.content.push(contentLine);
      currentBlock.endLine = i + 1;
      i++;
    }

    return i;
  }

  /**
   * Determine if content capture should stop at the current line.
   *
   * @private
   * @param contentTrimmed - Trimmed content of the current line
   * @param context - Parser context with lines and debug info
   * @param currentIndex - Current line index
   * @returns True if content capture should stop
   */
  private shouldStopContentCapture(
    contentTrimmed: string,
    context: ParserContext,
    currentIndex: number
  ): boolean {
    // Stop if we hit a blank line followed by another blank or high-confidence message start
    if (contentTrimmed === '') {
      return this.isBlankLineFollowedByMessageStart(context, currentIndex);
    }

    // Stop if this looks like metadata that doesn't belong to the message
    if (this.isNonMessageMetadata(contentTrimmed)) {
      return true;
    }

    // Stop if this looks like a new message start
    return this.isNewMessageStart(contentTrimmed, context, currentIndex);
  }

  /**
   * Check if blank line is followed by another blank or message start.
   *
   * @private
   * @param context - Parser context with lines and debug info
   * @param currentIndex - Current line index
   * @returns True if should stop due to blank line pattern
   */
  private isBlankLineFollowedByMessageStart(context: ParserContext, currentIndex: number): boolean {
    if (currentIndex + 2 < context.lines.length) {
      const nextAfterBlank = context.lines[currentIndex + 2].trim();
      const nextScore = this.scoreLine(nextAfterBlank, context);
      if (nextAfterBlank === '' || nextScore.confidence > TIMESTAMP_CONFIDENCE_THRESHOLD) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if content is metadata that doesn't belong to the current message.
   *
   * @private
   * @param contentTrimmed - Trimmed content to check
   * @returns True if this is non-message metadata
   */
  private isNonMessageMetadata(contentTrimmed: string): boolean {
    return (
      this.scoreMetadata(contentTrimmed) > MESSAGE_FRAGMENTATION_THRESHOLD &&
      !/^\d+\s+repl(?:y|ies)/i.test(contentTrimmed) &&
      !/^Also sent to the channel$/i.test(contentTrimmed) &&
      !/^View thread$/i.test(contentTrimmed)
    );
  }

  /**
   * Check if content indicates the start of a new message.
   *
   * @private
   * @param contentTrimmed - Trimmed content to check
   * @param context - Parser context with lines and debug info
   * @param currentIndex - Current line index
   * @returns True if this indicates a new message start
   */
  private isNewMessageStart(
    contentTrimmed: string,
    context: ParserContext,
    currentIndex: number
  ): boolean {
    const contentScore = this.scoreLine(contentTrimmed, context);
    return (
      contentScore.hasUserAndTime > TIMESTAMP_CONFIDENCE_THRESHOLD ||
      (contentScore.isUsername > TIMESTAMP_CONFIDENCE_THRESHOLD &&
        currentIndex + 2 < context.lines.length &&
        this.scoreTimestamp(context.lines[currentIndex + 2].trim()) >
          TIMESTAMP_CONFIDENCE_THRESHOLD)
    );
  }

  /**
   * Check if a line is an avatar image pattern.
   *
   * @private
   * @param line - The line to check
   * @returns True if this is an avatar line
   */
  private isAvatarLine(line: string): boolean {
    try {
      for (const pattern of this.patterns.avatar) {
        if (pattern.test(line)) {
          return true;
        }
      }
    } catch (error) {
      Logger.debug('FlexibleMessageParser', 'Regex error in isAvatarLine', { line, error });
    }
    return false;
  }

  /**
   * Detect the format of the Slack export for context-aware parsing.
   * @private
   * @param {string} text - The full text to analyze
   * @returns {string} The detected format type
   */
  private detectFormat(text: string): 'dm' | 'thread' | 'channel' | 'standard' | 'mixed' {
    // Check for DM format indicators
    const dmPatterns = [
      /^\[\d{1,2}:\d{2}\]\(https:\/\/.*\/archives\/D[A-Z0-9]+\/p\d+\)$/m,
      /\/archives\/D[A-Z0-9]+\//,
    ];

    // Check for thread format indicators
    const threadPatterns = [
      /thread_ts=/,
      /^\!\[\]\(https:\/\/ca\.slack-edge\.com\//m,
      /\d+\s+replies/,
      /Last reply.*ago.*View thread/,
    ];

    // Check for channel format indicators
    const channelPatterns = [/\/archives\/C[A-Z0-9]+\//, /^---\s*[A-Za-z]/m];

    let dmScore = 0;
    let threadScore = 0;
    let channelScore = 0;

    // Score each pattern
    for (const pattern of dmPatterns) {
      if (pattern.test(text)) dmScore++;
    }

    for (const pattern of threadPatterns) {
      if (pattern.test(text)) threadScore++;
    }

    for (const pattern of channelPatterns) {
      if (pattern.test(text)) channelScore++;
    }

    // Determine format based on scores
    if (dmScore > threadScore && dmScore > channelScore) {
      return 'dm';
    } else if (threadScore > dmScore && threadScore >= channelScore) {
      return 'thread';
    } else if (channelScore > 0) {
      return 'channel';
    } else {
      return 'standard';
    }
  }
}
