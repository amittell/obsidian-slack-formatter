import { FormatStrategy } from '../../interfaces';
import { SlackFormatSettings } from '../../types/settings.types';
import { SlackMessage } from '../../models';
import { CodeBlockProcessor } from '../processors/code-block-processor';
import { UrlProcessor } from '../processors/url-processor';
import { ThreadLinkProcessor } from '../processors/thread-link-processor';
import { EmojiProcessor } from '../processors/emoji-processor';
import { UsernameProcessor } from '../processors/username-processor';
import { formatDateWithZone, parseSlackTimestamp } from '../../utils/datetime-utils'; // Import parseSlackTimestamp
// Import ParsedMaps and FormatStrategyType from the centralized types file
import { ParsedMaps, FormatStrategyType } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import the new Logger

/**
 * Custom error types for specific timestamp processing errors
 */
class TimestampParsingError extends Error {
    constructor(message: string, public timestamp: string) {
        super(message);
        this.name = 'TimestampParsingError';
    }
}

class TimestampFormattingError extends Error {
    constructor(message: string, public timestamp: string) {
        super(message);
        this.name = 'TimestampFormattingError';
    }
}

class RegexError extends Error {
    constructor(message: string, public pattern: string, public input: string) {
        super(message);
        this.name = 'RegexError';
    }
}

// Removed local ParsedMaps type definition

export abstract class BaseFormatStrategy implements FormatStrategy {
    abstract readonly type: FormatStrategyType;

    protected codeBlockProcessor: CodeBlockProcessor;
    protected urlProcessor: UrlProcessor;
    protected threadLinkProcessor: ThreadLinkProcessor;
    protected emojiProcessor: EmojiProcessor;
    protected usernameProcessor: UsernameProcessor;
    // Removed attachmentProcessor property
    protected settings: SlackFormatSettings;
    protected parsedMaps: ParsedMaps; // Store parsed maps - Now uses imported type

    constructor(settings: SlackFormatSettings, parsedMaps: ParsedMaps) {
        this.settings = settings;
        this.parsedMaps = parsedMaps; // Store the maps

        // Initialize processors, passing parsed maps and debug flag where needed
        const isDebug = settings.debug ?? false;
        this.codeBlockProcessor = new CodeBlockProcessor({ enableCodeBlocks: settings.detectCodeBlocks, isDebugEnabled: isDebug });
        this.urlProcessor = new UrlProcessor({ isDebugEnabled: isDebug });
        this.threadLinkProcessor = new ThreadLinkProcessor({ enableThreadLinks: settings.highlightThreads, isDebugEnabled: isDebug });
        // Pass the parsed map and debug flag directly
        this.emojiProcessor = new EmojiProcessor({ emojiMap: this.parsedMaps.emojiMap, isDebugEnabled: isDebug });
        // Pass settings, the parsed userMap, and debug flag directly
        this.usernameProcessor = new UsernameProcessor({
            userMap: this.parsedMaps.userMap,
            enableMentions: settings.convertUserMentions,
            isDebugEnabled: isDebug
        });
        // Removed attachmentProcessor initialization
    }

   formatToMarkdown(messages: SlackMessage[]): string {
       const messageBlocks: string[] = [];

       for (const message of messages) {
           // Skip processing if the message object has no actual text content (likely metadata handled by parser)
           if (!message.text || /^\s*$/.test(message.text)) {
               this.log('debug', `Skipping message object with no text content`, { username: message.username });
               continue;
           }
           
           try {
               // Start each message as a separate block
               const messageLines: string[] = [];
               
               // --- Format Header ---
               const headerLines = this.formatHeader(message);
               for (const line of headerLines) {
                   messageLines.push('> ' + line);
               }
               
               // Add empty line after header
               messageLines.push('>');
               
               // --- Process Message Text ---
               const originalText = message.text || '';
               const textLines = originalText.split('\n');
               const processedLines: string[] = [];
               let inCodeBlock = false;

               for (const line of textLines) {
                   let currentLine = line;
                   let result;

                   // Detect code block boundaries first
                   if (line.startsWith('```')) {
                       inCodeBlock = !inCodeBlock;
                       result = this.codeBlockProcessor.process(currentLine);
                       // Prepend callout marker '>' only if NOT inside a code block (handles closing fence)
                       // Or if it IS the opening fence
                       processedLines.push((!inCodeBlock || line === '```' ? '> ' : '') + result.content);
                       continue; // Move to next line after handling fence
                   }

                   // Apply other processors only if NOT inside a code block
                   if (!inCodeBlock) {
                       result = this.urlProcessor.process(currentLine);
                       currentLine = result.content;

                       result = this.emojiProcessor.process(currentLine);
                       currentLine = result.content;

                       // result = this.usernameProcessor.process(currentLine); // Mentions kept literal

                       result = this.threadLinkProcessor.process(currentLine);
                       currentLine = result.content;
                   }

                   // Add the processed line, prepended with callout marker '>' only if it has non-whitespace content
                   if (/^\s*$/.test(currentLine)) { // Check if line consists only of whitespace
                       processedLines.push('>'); // Preserve blank lines with callout marker
                   } else {
                       processedLines.push('> ' + currentLine); // Add prefix to lines with content
                   }
               }
               
               // Add processed text lines
               messageLines.push(...processedLines);

               // --- Process Thread Info ---
               if (message.threadInfo) {
                   // Add separator before thread info
                   messageLines.push('>');
                   // Format thread info with proper styling
                   const threadLines = this.formatThreadInfo(message.threadInfo);
                   for (const line of threadLines) {
                       messageLines.push('> ' + line);
                   }
               }

               // --- Process Reactions ---
               const reactionLine = this.formatReactions(message);
               if (reactionLine) {
                   // Add separator before reactions
                   messageLines.push('>');
                   messageLines.push('> ' + reactionLine);
               }
               
               // Join this message's lines into a complete block
               messageBlocks.push(messageLines.join('\n'));

           } catch (messageError) {
               this.log('error', `Error formatting message: ${messageError}`, { message });
               // Format error message as a complete block
               const errorBlock = [
                   `> [!error]+ Error processing message`,
                   `> **User:** ${message.username || 'Unknown'}`,
                   `> **Timestamp:** ${message.timestamp || 'Unknown'}`,
                   `>`,
                   `> Error: ${messageError instanceof Error ? messageError.message : String(messageError)}`
               ].join('\n');
               messageBlocks.push(errorBlock);
           }
       }
       
       // Join all message blocks with double newlines for separation
       return messageBlocks.join('\n\n');
   }

    /**
     * Formats the header part of the message (e.g., User, Timestamp).
     * To be implemented by subclasses.
     * @param message The Slack message object.
     * @returns An array of strings representing the formatted header lines.
     */
    protected abstract formatHeader(message: SlackMessage): string[];

    // Removed abstract formatAttachments method

    /**
     * Formats the reactions of the message.
     * To be implemented by subclasses.
     * @param message The Slack message object.
     * @returns A string representing the formatted reactions, or null/empty if none.
     */
    protected abstract formatReactions(message: SlackMessage): string | null;

    /**
     * Formats thread information (e.g., "5 replies", "View thread").
     * @param threadInfo The thread information string.
     * @returns An array of formatted thread info lines.
     */
    protected formatThreadInfo(threadInfo: string): string[] {
        const lines: string[] = [];
        
        // Parse thread info to extract components
        const replyMatch = threadInfo.match(/(\d+)\s+repl(?:y|ies)/i);
        // Handle both separated and concatenated formats
        const lastReplyMatch = threadInfo.match(/Last reply\s+(.+?)(?:View thread|$)/i) || 
                              threadInfo.match(/(\d+\s+(?:days?|months?|hours?|minutes?)\s+ago)View thread/i);
        const viewThreadMatch = threadInfo.match(/View thread/i);
        const threadReplyMatch = threadInfo.match(/replied to a thread:\s*(?:"([^"]+)"|(.+?)(?=\s*(?:View thread|Last reply|$)))?/i);
        
        // Format thread reply indicator with context if available
        if (threadReplyMatch && threadReplyMatch.length > 0) {
            const context = (threadReplyMatch[1] && threadReplyMatch[1].trim()) || 
                           (threadReplyMatch[2] && threadReplyMatch[2].trim());
            if (context) {
                lines.push('🧵 **Thread Reply**');
                lines.push(`   _Replying to: "${context}"_`);
            } else {
                lines.push('🧵 **Thread Reply**');
            }
        }
        
        // Format thread metadata
        if (replyMatch || lastReplyMatch || viewThreadMatch) {
            const parts: string[] = [];
            
            if (replyMatch && replyMatch[1]) {
                const count = replyMatch[1];
                parts.push(`**${count} ${parseInt(count) === 1 ? 'reply' : 'replies'}**`);
            }
            
            if (lastReplyMatch && lastReplyMatch[1]) {
                parts.push(`Last reply ${lastReplyMatch[1].trim()}`);
            }
            
            if (parts.length > 0) {
                lines.push(`📊 ${parts.join(' • ')}`);
            }
            
            // Handle "View thread" link
            if (viewThreadMatch) {
                // Check if threadInfo contains a URL for the thread
                const urlMatch = threadInfo.match(/View thread.*?(https?:\/\/[^\s]+)/);
                if (urlMatch && urlMatch[1]) {
                    lines.push(`🔗 [View thread](${urlMatch[1]})`);
                } else {
                    // If no URL, just show as text
                    lines.push('🔗 View thread');
                }
            }
        }
        
        // Handle "Also sent to the channel" indicator
        if (/Also sent to the channel/i.test(threadInfo)) {
            lines.push('📢 Also sent to the channel');
        }
        
        return lines;
    }

    /**
     * Helper to get formatted timestamp string, handling potential parsing errors.
     * Relies on the timestamp already being parsed correctly by SlackMessageParser.
     * Re-parses the string using parseSlackTimestamp for robustness against potential parser variations.
     */
    protected getFormattedTimestamp(message: SlackMessage): string {
        if (!message.timestamp) {
            return ''; // Or some default like 'Time unknown'
        }
        try {
            // 1. Handle Slack timestamp formats (e.g., "Feb 6th at 7:47 PM", "[Feb 6th at 7:47 PM](url)")
            if (typeof message.timestamp === 'string') {
                let timestampToFormat: string;
                
                // First, check if it's a linked timestamp format and extract the timestamp part
                try {
                    const linkedTimestampMatch = message.timestamp.match(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/);
                    timestampToFormat = (linkedTimestampMatch?.[1]) ? linkedTimestampMatch[1] : message.timestamp;
                } catch (regexError) {
                    throw new RegexError(
                        'Failed to extract timestamp from linked format',
                        '\\[([^\\]]+)\\]\\(https?:\\/\\/[^)]+\\)',
                        message.timestamp
                    );
                }
                
                // Try parsing with parseSlackTimestamp utility which handles various Slack formats
                let parsedDate: Date | null;
                try {
                    parsedDate = parseSlackTimestamp(timestampToFormat, message.date);
                } catch (parseError) {
                    throw new TimestampParsingError(
                        `Failed to parse timestamp: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
                        timestampToFormat
                    );
                }
                
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    // Successfully parsed, format it
                    try {
                        return formatDateWithZone(parsedDate, this.settings.timeZone);
                    } catch (formatError) {
                        throw new TimestampFormattingError(
                            `Failed to format timestamp: ${formatError instanceof Error ? formatError.message : 'Unknown formatting error'}`,
                            timestampToFormat
                        );
                    }
                } else {
                    // Could not parse - return the cleaned timestamp string
                    this.log('debug', `Could not parse timestamp, returning cleaned original: ${timestampToFormat}`);
                    return timestampToFormat;
                }
            } else {
                 // Handle cases where timestamp is not a string (shouldn't happen with current parser logic, but safety)
                 this.log('warn', `Timestamp is not a string: ${typeof message.timestamp}`);
                 return 'Invalid Timestamp Type';
            }
        } catch (error) {
            if (error instanceof RegexError) {
                this.log('error', `Regex error in timestamp processing: ${error.message}`, { 
                    pattern: error.pattern, 
                    input: error.input,
                    timestamp: message.timestamp 
                });
                // For regex errors, return the original timestamp
                return typeof message.timestamp === 'string' ? message.timestamp : 'Invalid Date';
            } else if (error instanceof TimestampParsingError) {
                this.log('warn', `Timestamp parsing error: ${error.message}`, { 
                    timestamp: error.timestamp,
                    originalTimestamp: message.timestamp
                });
                // For parsing errors, return the cleaned timestamp string
                return error.timestamp;
            } else if (error instanceof TimestampFormattingError) {
                this.log('warn', `Timestamp formatting error: ${error.message}`, { 
                    timestamp: error.timestamp,
                    originalTimestamp: message.timestamp
                });
                // For formatting errors, return the parsed but unformatted timestamp
                return error.timestamp;
            } else {
                // Fallback for any other unexpected errors
                this.log('error', `Unexpected error formatting timestamp: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
                    timestamp: message.timestamp,
                    errorType: error instanceof Error ? error.constructor.name : typeof error
                });
                return typeof message.timestamp === 'string' ? message.timestamp : 'Invalid Date';
            }
        }
    }

    // Replace previous log method with calls to static Logger
    protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        Logger[level](this.constructor.name, message, data);
    }

    /**
     * Update settings and parsed maps
     */
    public updateSettings(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void {
        this.settings = settings;
        this.parsedMaps = parsedMaps;
        
        // Re-initialize processors with new settings
        const isDebug = settings.debug ?? false;
        this.codeBlockProcessor = new CodeBlockProcessor({ enableCodeBlocks: settings.detectCodeBlocks, isDebugEnabled: isDebug });
        this.urlProcessor = new UrlProcessor({ isDebugEnabled: isDebug });
        this.threadLinkProcessor = new ThreadLinkProcessor({ enableThreadLinks: settings.highlightThreads, isDebugEnabled: isDebug });
        this.emojiProcessor = new EmojiProcessor({ emojiMap: this.parsedMaps.emojiMap, isDebugEnabled: isDebug });
        this.usernameProcessor = new UsernameProcessor({
            userMap: this.parsedMaps.userMap,
            enableMentions: settings.convertUserMentions,
            isDebugEnabled: isDebug
        });
    }
}