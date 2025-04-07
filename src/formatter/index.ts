/**
 * Formatter module index
 * Exports all formatter components in an organized manner
 */

// Main formatter class
export { SlackFormatter } from './slack-formatter';

// Processors
// Updated exports for split processors:
export { CodeBlockProcessor } from './processors/code-block-processor';
export { UrlProcessor } from './processors/url-processor';
export { ThreadLinkProcessor } from './processors/thread-link-processor';
// Removed AttachmentProcessor export
export { EmojiProcessor } from './processors/emoji-processor';
export { UsernameProcessor } from './processors/username-processor';
export { BaseProcessor } from './processors/base-processor'; // Export BaseProcessor

// Stages
export { PreProcessor } from './stages/preprocessor';
export { FormatDetector } from './stages/format-detector';
export { SlackMessageParser } from './stages/message-parser'; // Export new parser
// Removed non-existent MarkdownFormatter export
export { PostProcessor } from './stages/postprocessor';
 
// Strategies
export { StandardFormatStrategy } from './strategies/standard-format-strategy';
export { BracketFormatStrategy } from './strategies/bracket-format-strategy';
export { FormatStrategyFactory } from './strategies/format-strategy-factory';

// Re-export base interfaces and types for convenience
export type { SlackMessage, FormattedOutput } from '../models';
export type { ThreadStats, FormatStrategyType, ProcessorResult } from '../types/formatters.types'; // Re-export moved ThreadStats & others
export type { FormatStrategy } from '../interfaces'; // Export FormatStrategy interface