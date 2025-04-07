import { FormatStrategy } from '../../interfaces';
import { SlackFormatSettings } from '../../types/settings.types';
import { SlackMessage } from '../../models';
import { CodeBlockProcessor } from '../processors/code-block-processor';
import { UrlProcessor } from '../processors/url-processor';
import { ThreadLinkProcessor } from '../processors/thread-link-processor';
import { EmojiProcessor } from '../processors/emoji-processor';
import { UsernameProcessor } from '../processors/username-processor';
// import { AttachmentProcessor } from '../processors/attachment-processor'; // Removed unused import
import { formatDateWithZone, parseSlackTimestamp } from '../../utils/datetime-utils'; // Import parseSlackTimestamp
// Import ParsedMaps and FormatStrategyType from the centralized types file
import { ParsedMaps, FormatStrategyType } from '../../types/formatters.types';
import { Logger } from '../../utils/logger'; // Import the new Logger

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
        this.codeBlockProcessor = new CodeBlockProcessor({ enableCodeBlocks: settings.enableCodeBlocks, isDebugEnabled: isDebug });
        this.urlProcessor = new UrlProcessor({ isDebugEnabled: isDebug });
        this.threadLinkProcessor = new ThreadLinkProcessor({ enableThreadLinks: settings.enableSubThreadLinks, isDebugEnabled: isDebug });
        // Pass the parsed map and debug flag directly
        this.emojiProcessor = new EmojiProcessor({ emojiMap: this.parsedMaps.emojiMap, isDebugEnabled: isDebug });
        // Pass settings, the parsed userMap, and debug flag directly
        this.usernameProcessor = new UsernameProcessor({
            userMap: this.parsedMaps.userMap,
            enableMentions: settings.enableMentions,
            isDebugEnabled: isDebug
        });
        // Removed attachmentProcessor initialization
    }

   formatToMarkdown(messages: SlackMessage[]): string {
       let finalOutput = '';
       let previousAuthor: string | null = null;

       for (const message of messages) {
           // Skip processing if the message object has no actual text content (likely metadata handled by parser)
           if (!message.text || /^\s*$/.test(message.text)) {
               this.log('debug', `Skipping message object with no text content`, { username: message.username });
               continue;
           }
           try {
               const currentAuthor = message.username;
               let processedTextContent = ''; // To store processed text and reactions for the current message
               // --- Process Message Text (Common Logic) ---
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
                       processedLines.push(''); // Preserve blank lines without prefix
                   } else {
                       processedLines.push('> ' + currentLine); // Add prefix only to lines with content
                   }
               }
               // Join lines for the message body
               const processedText = processedLines.join('\n');
               if (processedText.trim()) { // Only add if there's non-whitespace content
                   processedTextContent += processedText + '\n';
               }

               // --- Process Reactions (Delegated to subclass) ---
               const reactionLine = this.formatReactions(message); // Expects a single line string or null
               if (reactionLine) {
                   // Prepend callout marker '>'
                   processedTextContent += '> ' + reactionLine + '\n';
               }

               // --- Assemble Output ---
               // Check if author changed or it's the first message
               if (previousAuthor === null || currentAuthor !== previousAuthor) {
                   // Add separation from previous block if this isn't the very first message
                   if (finalOutput !== '') {
                       finalOutput += '\n'; // Add a blank line between author blocks
                   }
                   // Start new block with header
                   const headerLines = this.formatHeader(message); // Assumes header lines already start with '>'
                   finalOutput += headerLines.join('\n') + '\n';
                   finalOutput += processedTextContent; // Add the content for this first message
                   previousAuthor = currentAuthor;
               } else {
                   // Same author, add separator and content
                   // Always add separator, even if content is just whitespace (e.g., a blank line)
                   finalOutput += '>\n'; // Minimal separator within the same author block
                   finalOutput += processedTextContent;
               }
               // Removed extra closing brace here

           } catch (messageError) {
               this.log('error', `Error formatting message: ${messageError}`, { message });
               // Format error message within a callout structure, trying to append to current block if possible
               const errorBlock = `> [!ERROR] Error processing message\n> User: ${message.username}\n> Timestamp: ${message.timestamp}\n`;
               if (previousAuthor === message.username) {
                   finalOutput += '>\n' + errorBlock; // Append error to existing block
               } else {
                   // Start a new block for the error if author changed or first message
                    if (finalOutput !== '') finalOutput += '\n';
                    finalOutput += errorBlock;
                    previousAuthor = message.username; // Treat error block as belonging to this user
               }
           }
       }
       // Trim final output
       return finalOutput.trim();
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
     * Helper to get formatted timestamp string, handling potential parsing errors.
     * Relies on the timestamp already being parsed correctly by SlackMessageParser.
     * Re-parses the string using parseSlackTimestamp for robustness against potential parser variations.
     */
    protected getFormattedTimestamp(message: SlackMessage): string {
        if (!message.timestamp) {
            return ''; // Or some default like 'Time unknown'
        }
        try {
            // 1. Try parsing as ISO string first (most likely format from parser)
            if (typeof message.timestamp === 'string') {
                const potentialDate = new Date(message.timestamp);
                if (!isNaN(potentialDate.getTime())) {
                    // Valid ISO date found, format it
                    return formatDateWithZone(potentialDate, this.settings.timeZone);
                } else {
                    // Not a valid ISO date (likely contains emoji or non-standard text)
                    this.log('debug', `Timestamp is not ISO, returning original: ${message.timestamp}`);
                    return message.timestamp; // Return original string directly
                }
            } else {
                 // Handle cases where timestamp is not a string (shouldn't happen with current parser logic, but safety)
                 this.log('warn', `Timestamp is not a string: ${typeof message.timestamp}`);
                 return 'Invalid Timestamp Type';
            }
            // Fallback logic (parseSlackTimestamp) and final else block removed as non-ISO strings are returned directly above
        } catch (tsError) {
            this.log('warn', `Error formatting timestamp: ${tsError}`, { timestamp: message.timestamp });
            // Fallback to the original string representation if Date parsing/formatting fails
            return typeof message.timestamp === 'string' ? message.timestamp : 'Invalid Date';
        }
    }

    // Replace previous log method with calls to static Logger
    protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        Logger[level](this.constructor.name, message, data);
    }
}