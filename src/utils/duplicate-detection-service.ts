import { SlackMessage } from '../models';
import { Logger } from './logger';

/**
 * Configuration constants for duplicate detection
 */
const DEFAULT_CONTENT_PREVIEW_LENGTH = 100;
const DEFAULT_TIMESTAMP_LENGTH = 20;
const DEFAULT_BLOCK_HASH_LINES = 3;

/**
 * Centralized service for detecting and removing duplicate content
 * across different stages of Slack message processing.
 */
export class DuplicateDetectionService {
  private contentPreviewLength: number;
  private timestampLength: number;
  private blockHashLines: number;

  constructor(
    contentPreviewLength = DEFAULT_CONTENT_PREVIEW_LENGTH,
    timestampLength = DEFAULT_TIMESTAMP_LENGTH,
    blockHashLines = DEFAULT_BLOCK_HASH_LINES
  ) {
    this.contentPreviewLength = contentPreviewLength;
    this.timestampLength = timestampLength;
    this.blockHashLines = blockHashLines;
  }

  /**
   * Remove duplicate messages based on content and timestamp.
   * Uses Set-based O(n) algorithm for efficient deduplication.
   *
   * @param messages - Array of parsed messages
   * @param debugMode - Enable debug logging
   * @returns Deduplicated messages
   */
  public deduplicateMessages(messages: SlackMessage[], debugMode = false): SlackMessage[] {
    const seen = new Set<string>();
    const deduped: SlackMessage[] = [];

    for (const msg of messages) {
      const key = this.createMessageKey(msg);

      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(msg);
      } else if (debugMode) {
        Logger.debug(
          'DuplicateDetectionService',
          'Removing duplicate message',
          {
            username: msg.username,
            timestamp: msg.timestamp,
            contentPreview: msg.text.substring(0, this.contentPreviewLength).trim(),
          },
          debugMode
        );
      }
    }

    return deduped;
  }

  /**
   * Remove duplicate blocks of content in raw text input.
   * Uses Set-based O(n) algorithm for efficient block deduplication.
   *
   * @param content - Raw text content
   * @param messageStartPatterns - Regex patterns that identify message starts
   * @returns Content with duplicate blocks removed
   */
  public removeDuplicateBlocks(content: string, messageStartPatterns: RegExp[]): string {
    const lines = content.split('\n');
    const seen = new Set<string>();
    const result: string[] = [];
    let currentBlock: string[] = [];

    // Validate regex patterns before processing
    const validPatterns = this.validateRegexPatterns(messageStartPatterns);
    if (validPatterns.length === 0) {
      Logger.warn(
        'DuplicateDetectionService',
        'No valid regex patterns provided for duplicate block detection, returning original content'
      );
      return content;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this looks like a message header (username + timestamp)
      const isMessageStart = this.safeRegexTest(validPatterns, trimmed);

      if (isMessageStart && currentBlock.length > 0) {
        // End current block and check for duplicates
        const blockHash = this.hashBlock(currentBlock);
        if (!seen.has(blockHash)) {
          seen.add(blockHash);
          result.push(...currentBlock);
        }
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }

    // Don't forget the last block
    if (currentBlock.length > 0) {
      const blockHash = this.hashBlock(currentBlock);
      if (!seen.has(blockHash)) {
        result.push(...currentBlock);
      }
    }

    return result.join('\n');
  }

  /**
   * Create a unique key for a message based on username, timestamp, and content.
   *
   * @param msg - Slack message
   * @returns Unique key string
   */
  private createMessageKey(msg: SlackMessage): string {
    const contentPreview = msg.text.substring(0, this.contentPreviewLength).trim();
    const timestampKey = msg.timestamp
      ? msg.timestamp.substring(0, this.timestampLength)
      : 'no-timestamp';
    return `${msg.username}|${timestampKey}|${contentPreview}`;
  }

  /**
   * Create a simple hash of a block for deduplication.
   *
   * @param lines - Array of lines in the block
   * @returns Hash string
   */
  private hashBlock(lines: string[]): string {
    // Use first few non-empty lines as a simple hash
    const significantLines = lines
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, this.blockHashLines);

    return significantLines.join('|');
  }

  /**
   * Validate regex patterns to ensure they can be used safely.
   * Filters out invalid or malformed patterns.
   *
   * @param patterns - Array of regex patterns to validate
   * @returns Array of valid regex patterns
   */
  private validateRegexPatterns(patterns: RegExp[]): RegExp[] {
    const validPatterns: RegExp[] = [];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];

      try {
        // Test if the regex pattern is valid by checking its properties
        if (!pattern || typeof pattern.test !== 'function') {
          Logger.warn(
            'DuplicateDetectionService',
            `Invalid regex pattern at index ${i}: not a RegExp object`
          );
          continue;
        }

        // Test the pattern with a simple string to ensure it doesn't throw
        pattern.test('test');
        validPatterns.push(pattern);
      } catch (error) {
        Logger.error('DuplicateDetectionService', `Invalid regex pattern at index ${i}`, {
          pattern: pattern.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    Logger.debug(
      'DuplicateDetectionService',
      `Validated ${validPatterns.length} out of ${patterns.length} regex patterns`
    );
    return validPatterns;
  }

  /**
   * Safely test a string against an array of regex patterns.
   * Returns true if any pattern matches, false otherwise.
   * Handles regex execution errors gracefully.
   *
   * @param patterns - Array of validated regex patterns
   * @param text - Text to test against patterns
   * @returns True if any pattern matches, false otherwise
   */
  private safeRegexTest(patterns: RegExp[], text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    for (const pattern of patterns) {
      try {
        if (pattern.test(text)) {
          return true;
        }
      } catch (error) {
        Logger.error('DuplicateDetectionService', 'Error executing regex test', {
          pattern: pattern.toString(),
          text: text.substring(0, 100), // Truncate long text for logging
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue testing other patterns instead of failing completely
      }
    }

    return false;
  }
}

/**
 * Singleton instance for global use
 */
export const duplicateDetectionService = new DuplicateDetectionService();
