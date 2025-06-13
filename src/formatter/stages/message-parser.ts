import { SlackMessage } from '../../models';
import type { SlackReaction } from '../../types/messages.types'; // Removed SlackAttachment import
import { parseDate, parseSlackTimestamp } from '../../utils/datetime-utils'; // Import new function
import { Logger } from '../../utils/logger'; // Import the new Logger
import { cleanupDoubledUsernames } from '../../utils/username-utils'; // Import username cleanup utility

// --- Regex Definitions ---
const AVATAR_REGEX = /^!?\[.*?\]\((https?:\/\/.+?)\)$/;
const USER_TIMESTAMP_REGEX = /^(.+?)\s*\[(.+?)\]\((https?:\/\/.+)\)$/;
// TIMESTAMP_PART_REGEX removed due to persistent parsing issues. Validation now uses parseSlackTimestamp directly.
const EMOJI_IN_USERNAME_REGEX = /(!\[:[^:]+:\]\(.+?\)|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+)/gu;
const DATE_SEPARATOR_REGEX = /^--- (.+) ---$/;
const DATE_SEPARATOR_ALT_REGEX = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}(?:st|nd|rd|th)?(?:, \d{4})?$/i;
const CONTINUATION_TIME_REGEX = /^\[(\d{1,2}:\d{2}(?:\s*[AP]M)?)\]\(https?:\/\/.+\)$/i;
const THREAD_REPLY_HEADER_REGEX = /^replied to a thread:/i;
// Refined reaction pattern source to handle ![:name:](url)Count format
const reactionEmojiRegexSource = /(!\[:[^:]+:\]\(https?:\/\/[^)]+\)|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+|:[a-zA-Z0-9_+-]+:)/u.source;
// Updated singleReactionPairPattern to correctly capture emoji and count for all formats
const singleReactionPairPattern = `(${reactionEmojiRegexSource})(\\d+)`; // Capture emoji (group 1) and count (group 2)
const fullReactionLineRegex = new RegExp(`^(\\s*${singleReactionPairPattern}\\s*)+$`, 'u');
const TIMESTAMP_ONLY_REGEX = /^(?:\d{1,2}:\d{2}(?:\s*[AP]M)?|Today at \d{1,2}:\d{2}\s*[AP]M|Yesterday at \d{1,2}:\d{2}\s*[AP]M|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}(?:st|nd|rd|th)?(?: at \d{1,2}:\d{2}\s*[AP]M)?)$/i;
const AVATAR_REPLY_COUNT_REGEX = /^\s*!\[.*?\]\(https?:\/\/ca\.slack-edge\.com\/.+?\).*\d+\s+repl(?:y|ies)/i;
const SIMPLE_REPLY_COUNT_LINK_REGEX = /^(\d+\+?\s+repl(?:y|ies)|Last reply|View thread|View newer replies)/i;
const GITHUB_INFO_REGEX = /^\s*(?:Language|TypeScript|Last updated|\d+\s+minutes?\s+ago|[\w-]+\/[\w-]+)\s*$/i; // Excludes "Added by"
const GITHUB_ADDED_BY_REGEX = /^Added by \[GitHub\]\(https?:\/\/.+\)$/i; // New
const PLUS_ONE_REGEX = /^\s*\+1\s*$/;
const AVATAR_ONLY_REGEX = /^!\[\]\((https?:\/\/ca\.slack-edge\.com\/.+?)\)$/;
const LINK_PREVIEW_TITLE_REGEX = /^(?:Google Docs|ShuppaShuppa|X \(formerly Twitter\)X \(formerly Twitter\)|Notion \(@NotionHQ\) on X|GuidewireGuidewire)$/i;
const LINK_PREVIEW_DESCRIPTION_REGEX = /^(?:Guidewire–Stripe Connector:|shuppa \| Instant Grocery Delivery|Shuppa \| Grocery delivery dublin|Last year we launched custom emojis|But how do you add 1\.5M custom emojis|Guidewire PartnerConnect Ecosystem)/i;
const DELETED_MESSAGE_REGEX = /^This message was deleted\.$/i;
const THREAD_CONTEXT_REGEX = /^(?:Thread|guidewire-gtm-pursuit|Also sent to the channel)$/i;
const GITHUB_LINK_PREVIEW_REGEX = /^<https?:\/\/github\.com.+?\|.+?>.+?\| Added by GitHub/i;
const IMAGE_SOURCE_REGEX = /^Image from iOS$/i;
const FILE_PREVIEW_START_REGEX = /^\s*\[\s*$/;
const FILE_PREVIEW_END_REGEX = /^\s*\]\(https?:\/\/.+\)\s*$/;
const FILE_PREVIEW_DOWNLOAD_LINK_REGEX = /^\s*\[\]\(https?:\/\/files\.slack\.com\/.+?\)\s*$/; // New
const POTENTIAL_USERNAME_REGEX = /^.+$/;
const TIME_ONLY_REGEX = /^(?!\s*(?:https?:\/\/|\w+\.(?:png|jpg|jpeg|gif))\b)\s*(?:\d{1,2}:\d{2}(?:\s*[AP]M)?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}(?:st|nd|rd|th)?(?: at \d{1,2}:\d{2}\s*[AP]M)?)\s*$/i;
const AVATAR_LIST_REGEX = /^(?:\s*!\[.*?\]\(https?:\/\/ca\.slack-edge\.com\/.+?\))+.*(?:\d+\s+repl(?:y|ies))?$/i;
const FILE_PREVIEW_IMAGE_ONLY_REGEX = /^\s*!\[.*?\]\(https?:\/\/[^)]+\)\s*$/; // Made URL more specific
const HORIZONTAL_RULE_REGEX = /^\s*---\s*$/; // Allow whitespace
const FILE_COUNT_REGEX = /^\d+\s+files?$/i; // New


// --- Types and Interfaces ---
enum LineType {
    // Core message structure
    USER_TIMESTAMP_HEADER, // Format 1: Name [Time](URL)
    POTENTIAL_USERNAME,  // Format 2, Line 1: Name
    TIME_ONLY,           // Format 2, Line 2: Time
    DATE_SEPARATOR,
    AVATAR_ONLY,         // Large avatar before header
    BLANK,
    POTENTIAL_CONTENT,   // Default if nothing else matches

    // Metadata / Ignored lines
    REACTION_LINE,       // Line containing only reactions/counts
    REPLY_COUNT_LINK,    // e.g., "11 replies", "View thread" (covers simple and avatar lists)
    FILE_PREVIEW,        // Now primarily for start/end brackets and download links
    GITHUB_INFO,         // e.g., "Language", "TypeScript", "user/repo"
    PLUS_ONE,            // "+1" line
    THREAD_REPLY_HEADER, // "replied to a thread:"
    CONTINUATION_TIMESTAMP, // "[10:30 AM](URL)" on its own line (often ignored)
    LINK_PREVIEW_TITLE,  // Title line of a link preview
    LINK_PREVIEW_DESC,   // Description line of a link preview
    DELETED_MESSAGE,     // "This message was deleted."
    THREAD_CONTEXT,      // "Thread", "guidewire-gtm-pursuit", "Also sent to the channel"
    GITHUB_LINK_PREVIEW, // Specific format for GitHub links added by app
    IMAGE_SOURCE,        // "Image from iOS"
    AVATAR_LIST,         // Line with multiple avatars (e.g., reaction user list)
    FILE_PREVIEW_IMAGE_ONLY, // Line with just ![...](...)
    HORIZONTAL_RULE,     // --- line
    GITHUB_ADDED_BY,     // New: "Added by [GitHub](...)" line
    FILE_COUNT,          // New: "X files" line
    FILE_PREVIEW_DOWNLOAD_LINK, // New: [](files.slack.com/...) line
}

interface ParserState {
    messages: SlackMessage[];
    currentMessage: SlackMessage | null;
    pendingUsername: string | null; // Store potential username for Format 2 (Name \n Time)
    pendingAvatarUrl: string | null; // Store avatar URL from previous line
    pendingMessageHeader: SlackMessage | null; // Store partially created message from Format 2
    currentDate: Date | null;
    lineIndex: number;
    lines: string[]; // Keep lines array in state
}

export class SlackMessageParser {
    private logger = new Logger(); // Instantiate logger - Removed argument

    // --- Main Parsing Logic ---
    parse(text: string, isDebugEnabled?: boolean): SlackMessage[] {
        this.log('info', 'Starting message parsing (v2)'); // Info logs don't need the flag
        const lines = text.split('\n');
        const state: ParserState = {
            messages: [],
            currentMessage: null,
            pendingUsername: null, // Initialize pendingUsername
            pendingAvatarUrl: null, // Initialize pendingAvatarUrl
            pendingMessageHeader: null, // Initialize pending header
            currentDate: null,
            lineIndex: 0,
            lines: lines // Store lines in state
        };

        this.log('debug', `Starting parse. Total lines: ${lines.length}`, undefined, isDebugEnabled); // Added initial log

        while (state.lineIndex < state.lines.length) {
            // Pass isDebugEnabled down
            this.log('debug', `Processing line ${state.lineIndex + 1}: "${state.lines[state.lineIndex]}"`, undefined, isDebugEnabled); // Log current line
            this._processLine(state, isDebugEnabled);
        }

        // Removed final pendingUsername handling block

        // Finalize the very last message
        this.finalizeCurrentMessage(state, isDebugEnabled);

        this.log('info', `Parsing complete. Found ${state.messages.length} messages.`);
        return state.messages;
    }

    /**
     * Processes a single line based on its identified type.
     * @param state The current parser state.
     * @param isDebugEnabled Flag to control debug logging. // Added parameter
     * @private
     */
    private _processLine(state: ParserState, isDebugEnabled?: boolean): void {
        const originalLine = state.lines[state.lineIndex];
        // Use trim() for identification to handle potential leading/trailing whitespace robustly
        const trimmedLine = originalLine.trim(); 
        
        const lineType = this.identifyLineType(trimmedLine);
        this.log('debug', `Identified LineType: ${LineType[lineType]}`, { line: trimmedLine }, isDebugEnabled);

        try {
            // --- Handle Ignored Metadata Lines ---
            // Refined logic: Only clear pendingUsername if no message is active
            if (
                lineType === LineType.HORIZONTAL_RULE || 
                lineType === LineType.REPLY_COUNT_LINK ||
                lineType === LineType.FILE_PREVIEW || // Includes start '[', end '](url)'
                lineType === LineType.GITHUB_INFO ||
                lineType === LineType.PLUS_ONE ||
                lineType === LineType.REACTION_LINE || // Should now handle ![:emoji:](url)Count
                lineType === LineType.THREAD_REPLY_HEADER ||
                lineType === LineType.CONTINUATION_TIMESTAMP ||
                lineType === LineType.LINK_PREVIEW_TITLE || 
                lineType === LineType.LINK_PREVIEW_DESC ||
                lineType === LineType.DELETED_MESSAGE ||
                lineType === LineType.THREAD_CONTEXT ||
                lineType === LineType.GITHUB_LINK_PREVIEW ||
                lineType === LineType.IMAGE_SOURCE ||
                lineType === LineType.AVATAR_LIST || 
                lineType === LineType.FILE_PREVIEW_IMAGE_ONLY || // Handles ![...](...) lines
                lineType === LineType.GITHUB_ADDED_BY || 
                lineType === LineType.FILE_COUNT || 
                lineType === LineType.FILE_PREVIEW_DOWNLOAD_LINK // Handles [](url) lines
            ) {
                this.log('debug', `Ignoring metadata line: ${LineType[lineType]}`, { line: trimmedLine }, isDebugEnabled);
                // Clear pending username ONLY if there's no active message (metadata might be mid-message)
                if (state.pendingUsername && !state.currentMessage) {
                     this.log('debug', 'Clearing pending username due to metadata interruption (no active message).', { username: state.pendingUsername }, isDebugEnabled);
                     state.pendingUsername = null;
                 }
                // DO NOT finalize the current message here for metadata lines
                state.lineIndex++; 
                return;
            }

            // --- Handle Core Structural Lines ---
            if (lineType === LineType.AVATAR_ONLY) {
                if (this.handleAvatarOnly(trimmedLine, state, isDebugEnabled)) return;
            }
            if (lineType === LineType.USER_TIMESTAMP_HEADER) { // Format 1
                // Clear any pending username from Format 2 attempt
                state.pendingUsername = null;
                // handleUserTimestampHeader now returns false if it decides the line is not a valid header
                if (!this.handleUserTimestampHeader(trimmedLine, state, isDebugEnabled)) {
                    // If it wasn't handled as a header (e.g., malformed timestamp), treat as content
                    this.handlePotentialContent(originalLine, state, isDebugEnabled);
                }
                return; // Return whether handled as header or content
            }
            if (lineType === LineType.DATE_SEPARATOR) {
                // Clear any pending username from Format 2 attempt
                state.pendingUsername = null; 
                if (this.handleDateSeparator(trimmedLine, state, isDebugEnabled)) return;
            }
            if (lineType === LineType.BLANK) {
                // If a header was pending from Format 2, activate it now even on a blank line.
                if (state.pendingMessageHeader) {
                    this.log('debug', 'Activating pending message header due to blank line', { user: state.pendingMessageHeader.username }, isDebugEnabled);
                    this.finalizeCurrentMessage(state, isDebugEnabled); 
                    state.currentMessage = state.pendingMessageHeader;
                    state.pendingMessageHeader = null;
                    // Don't append the blank line as content for the *newly activated* message
                } else if (state.currentMessage) {
                    // If a message is active, treat the blank line as content (preserves paragraph breaks)
                    // Use originalLine to preserve potential indentation if needed later
                    this.handlePotentialContent(originalLine, state, isDebugEnabled); 
                    // handlePotentialContent increments lineIndex, so don't do it again here
                    return; // Return early as handlePotentialContent handles index advancement
                } else {
                    // No pending header and no current message, truly ignore the blank line
                    this.log('debug', 'Ignoring blank line (no active message)', undefined, isDebugEnabled);
                }
                // Only increment index here if handlePotentialContent wasn't called
                state.lineIndex++;
                return; 
            }

            // --- Handle Format 2 (Name \n Time) ---
            if (lineType === LineType.POTENTIAL_USERNAME) {
                this.handlePotentialUsername(trimmedLine, state, isDebugEnabled);
                return; // Always advance after handling potential username
            }
            if (lineType === LineType.TIME_ONLY) {
                // Pass originalLine for potential fallback to content handling
                this.handleTimeOnly(trimmedLine, originalLine, state, isDebugEnabled); 
                return; // handleTimeOnly advances index
            }

            // --- Fallback: Treat as Potential Content ---
            // This case should now only be reached if identifyLineType returns POTENTIAL_CONTENT
            if (lineType === LineType.POTENTIAL_CONTENT) { 
                // If a username was pending, it wasn't followed by TIME_ONLY, so treat it as content first
                if (state.pendingUsername) {
                    this.handlePotentialContent(state.pendingUsername, state, isDebugEnabled); // Append pending username
                    state.pendingUsername = null; // Clear it
                    // Don't return yet, process the current line as content too
                }
                this.handlePotentialContent(originalLine, state, isDebugEnabled);
                return;
            }

            // Should not reach here if identifyLineType logic is exhaustive
            this.log('warn', 'Unhandled line type in _processLine', { lineType: LineType[lineType], line: trimmedLine }, isDebugEnabled);
            state.lineIndex++; // Ensure progress

        } catch (lineError) {
            // Log error details
            Logger.error('SlackMessageParser', `RAW ERROR processing line ${state.lineIndex}:`, lineError);
            Logger.error('SlackMessageParser', `Line content: "${trimmedLine}"`);
            // Also log the custom log message for context
            this.log('error', `Error processing line ${state.lineIndex} (see raw error above)`, { line: trimmedLine }); // Removed error data duplication
            state.lineIndex++; // Ensure progress even on error
        }
    }


    // --- Line Type Identification ---
    private identifyLineType(trimmedLine: string): LineType {
        if (trimmedLine === '') return LineType.BLANK;

        // --- Check for Most Specific Metadata First (Revised Order) ---
        if (HORIZONTAL_RULE_REGEX.test(trimmedLine)) return LineType.HORIZONTAL_RULE; 
        if (fullReactionLineRegex.test(trimmedLine)) return LineType.REACTION_LINE; // Should handle ![:emoji:](url)Count now
        if (AVATAR_LIST_REGEX.test(trimmedLine)) return LineType.AVATAR_LIST; 
        if (AVATAR_REPLY_COUNT_REGEX.test(trimmedLine)) return LineType.REPLY_COUNT_LINK; 
        if (SIMPLE_REPLY_COUNT_LINK_REGEX.test(trimmedLine)) return LineType.REPLY_COUNT_LINK; 
        if (DELETED_MESSAGE_REGEX.test(trimmedLine)) return LineType.DELETED_MESSAGE; 
        if (PLUS_ONE_REGEX.test(trimmedLine)) return LineType.PLUS_ONE;
        if (GITHUB_LINK_PREVIEW_REGEX.test(trimmedLine)) return LineType.GITHUB_LINK_PREVIEW; 
        if (GITHUB_ADDED_BY_REGEX.test(trimmedLine)) return LineType.GITHUB_ADDED_BY; 
        if (GITHUB_INFO_REGEX.test(trimmedLine)) return LineType.GITHUB_INFO; 
        if (FILE_COUNT_REGEX.test(trimmedLine)) return LineType.FILE_COUNT; 
        if (FILE_PREVIEW_START_REGEX.test(trimmedLine)) return LineType.FILE_PREVIEW; 
        if (FILE_PREVIEW_END_REGEX.test(trimmedLine)) return LineType.FILE_PREVIEW;   
        if (FILE_PREVIEW_DOWNLOAD_LINK_REGEX.test(trimmedLine)) return LineType.FILE_PREVIEW_DOWNLOAD_LINK; 
        if (LINK_PREVIEW_TITLE_REGEX.test(trimmedLine)) return LineType.LINK_PREVIEW_TITLE; 
        if (LINK_PREVIEW_DESCRIPTION_REGEX.test(trimmedLine)) return LineType.LINK_PREVIEW_DESC;   
        if (FILE_PREVIEW_IMAGE_ONLY_REGEX.test(trimmedLine)) return LineType.FILE_PREVIEW_IMAGE_ONLY; 
        if (THREAD_REPLY_HEADER_REGEX.test(trimmedLine)) return LineType.THREAD_REPLY_HEADER;
        if (CONTINUATION_TIME_REGEX.test(trimmedLine)) return LineType.CONTINUATION_TIMESTAMP;
        if (THREAD_CONTEXT_REGEX.test(trimmedLine)) return LineType.THREAD_CONTEXT; 
        if (IMAGE_SOURCE_REGEX.test(trimmedLine)) return LineType.IMAGE_SOURCE; 

        // --- Check for Core Structural Elements (Order matters here too) ---
        if (AVATAR_ONLY_REGEX.test(trimmedLine)) return LineType.AVATAR_ONLY; 
        if (USER_TIMESTAMP_REGEX.test(trimmedLine)) return LineType.USER_TIMESTAMP_HEADER; // Check after specific metadata
        if (DATE_SEPARATOR_REGEX.test(trimmedLine) || DATE_SEPARATOR_ALT_REGEX.test(trimmedLine)) return LineType.DATE_SEPARATOR;

        // --- Check for Format 2 Elements ---
        if (TIME_ONLY_REGEX.test(trimmedLine)) return LineType.TIME_ONLY; 

        // --- Default / Fallback ---
        // If it's not blank and not any known structural or metadata type, assume it's content or a potential username
        // POTENTIAL_USERNAME_REGEX is just /.+/, so we check it last implicitly
        return LineType.POTENTIAL_CONTENT; 
    }

    // --- Message State Management ---

    /**
     * Finalizes the current message and adds it to the list if it's valid.
     * @param state The current parser state.
     * @param isDebugEnabled Flag to control debug logging. // Added parameter
     * @private
     */
    private finalizeCurrentMessage(state: ParserState, isDebugEnabled?: boolean): void {
        if (state.currentMessage) {
            // Trim whitespace from the collected text
            const trimmedText = state.currentMessage.text.trim();
            const originalTextForLog = state.currentMessage.text; // Keep original for logging if needed

            if (trimmedText) {
                // Assign the trimmed text *before* pushing
                state.currentMessage.text = trimmedText;
                state.messages.push(state.currentMessage);
                this.log('debug', `Finalized message for ${state.currentMessage.username}`, { messageCount: state.messages.length }, isDebugEnabled);
            } else {
                // Pass isDebugEnabled to log call, include original text for context
                this.log('debug', 'Discarding empty message object', { username: state.currentMessage.username, originalText: originalTextForLog }, isDebugEnabled);
            }
        }
        state.currentMessage = null;
        // Also clear any pending state when finalizing
        state.pendingUsername = null;
        state.pendingMessageHeader = null;
    }

    // Updated signature to accept isDebugEnabled
    private startNewMessage(state: ParserState, isDebugEnabled?: boolean): SlackMessage {
        // Pass the flag down to finalizeCurrentMessage
        this.finalizeCurrentMessage(state, isDebugEnabled);
        state.currentMessage = new SlackMessage();
        // Inherit date context
        state.currentMessage.date = state.currentDate;
        this.log('debug', 'Started new message object', undefined, isDebugEnabled);
        return state.currentMessage;
    }

    // --- Line Handlers ---
    // Renamed and modified to store URL in state, not start message
    private handleAvatarOnly(trimmedLine: string, state: ParserState, isDebugEnabled?: boolean): boolean {
        const avatarMatch = trimmedLine.match(AVATAR_REGEX);
        if (avatarMatch) {
            state.pendingAvatarUrl = avatarMatch[1]; // Store URL in state
            this.log('debug', 'Stored pending avatar URL', { url: state.pendingAvatarUrl }, isDebugEnabled);
            state.lineIndex++; // Increment line index
            return true; // Indicate line was handled
        }
        return false; // Indicate line was not handled
    }

    // Modified to return boolean
    private handleUserTimestampHeader(trimmedLine: string, state: ParserState, isDebugEnabled?: boolean): boolean {
        // Rely on startNewMessage to finalize the previous message

        const userTsMatch = trimmedLine.match(USER_TIMESTAMP_REGEX);
        if (userTsMatch) {
            // --- Simplified Logic: Use parseSlackTimestamp for validation ---
            const potentialUserPart = userTsMatch[1]; // Raw user part
            const potentialTimestampStr = userTsMatch[2].trim(); // Raw timestamp string
            this.log('debug', 'Attempting to handle USER_TIMESTAMP_HEADER', { line: trimmedLine, userPart: potentialUserPart, tsPart: potentialTimestampStr }, isDebugEnabled);

            // Attempt to parse the timestamp string
            const parsedDate = parseSlackTimestamp(potentialTimestampStr, state.currentDate);

            if (parsedDate) {
                // Timestamp is valid, proceed to finalize previous and start new
                this.log('debug', 'Timestamp part is valid, starting new message.', { timestamp: parsedDate }, isDebugEnabled);
                this.startNewMessage(state, isDebugEnabled); // Finalizes previous message

                if (state.currentMessage) { // Should always be true after startNewMessage
                    // Clean up the username part (Revised Order)
                    let cleanedUserPart = cleanupDoubledUsernames(potentialUserPart); // Clean doubled names first
                    cleanedUserPart = cleanedUserPart.replace(EMOJI_IN_USERNAME_REGEX, '').trim(); // Then remove emojis
                    cleanedUserPart = cleanedUserPart.replace(/[!?,.;:]+$/, '').trim(); // Then remove trailing punctuation
                    if (!cleanedUserPart) {
                        this.log('warn', 'Username became empty after cleanup', { original: potentialUserPart }, isDebugEnabled);
                        cleanedUserPart = "Unknown User";
                    }
                    state.currentMessage.username = cleanedUserPart;

                    // Handle Avatar
                    if (state.pendingAvatarUrl) {
                        state.currentMessage.avatar = state.pendingAvatarUrl;
                        this.log('debug', 'Assigned pending avatar URL to message', { url: state.currentMessage.avatar }, isDebugEnabled);
                        state.pendingAvatarUrl = null;
                    }

                    // Assign the successfully parsed timestamp
                    state.currentMessage.timestamp = parsedDate.toISOString();
                    
                    // Update context date if needed
                    if (!state.currentDate || parsedDate.toDateString() !== state.currentDate.toDateString()) {
                        state.currentDate = new Date(parsedDate);
                        state.currentDate.setHours(0, 0, 0, 0);
                        this.log('debug', 'Updated date context from header', { date: state.currentDate }, isDebugEnabled);
                    }
                    
                    // Assign date context
                    state.currentMessage.date = state.currentDate;
                    this.log('debug', 'Handled user/timestamp header (Simplified Validation)', { user: state.currentMessage.username, ts: state.currentMessage.timestamp, avatar: state.currentMessage.avatar }, isDebugEnabled);
                    state.lineIndex++;
                    return true; // Indicate line was handled
                } else {
                     // Should not happen if startNewMessage worked, but safety check
                     this.log('error', 'Failed to start new message in handleUserTimestampHeader', { line: trimmedLine }, isDebugEnabled);
                     return false; 
                }
            } else {
                 // Timestamp string was not parsable by parseSlackTimestamp (likely contains emoji).
                 // STILL treat it as a header to start a new message block, but keep the original timestamp string.
                 this.log('warn', 'Line matched USER_TIMESTAMP_REGEX but timestamp part was invalid (likely emoji). Treating as header, keeping original timestamp string.', { line: trimmedLine, timestampStr: potentialTimestampStr }, isDebugEnabled);
                 
                 this.startNewMessage(state, isDebugEnabled); // Finalizes previous message, starts new one

                 if (state.currentMessage) {
                     // Clean up and assign username as before
                     let cleanedUserPart = cleanupDoubledUsernames(potentialUserPart); 
                     cleanedUserPart = cleanedUserPart.replace(EMOJI_IN_USERNAME_REGEX, '').trim(); 
                     cleanedUserPart = cleanedUserPart.replace(/[!?,.;:]+$/, '').trim(); 
                     if (!cleanedUserPart) cleanedUserPart = "Unknown User";
                     state.currentMessage.username = cleanedUserPart;

                     // Handle Avatar
                     if (state.pendingAvatarUrl) {
                         state.currentMessage.avatar = state.pendingAvatarUrl;
                         state.pendingAvatarUrl = null;
                     }

                     // Keep the original, unparsable timestamp string
                     state.currentMessage.timestamp = potentialTimestampStr; 
                     state.currentMessage.date = state.currentDate; // Assign date context

                     this.log('debug', 'Handled user/timestamp header with invalid timestamp part', { user: state.currentMessage.username }, isDebugEnabled);
                     state.lineIndex++;
                     return true; // Indicate line was handled as a header
                 } else {
                      this.log('error', 'Failed to start new message in handleUserTimestampHeader (invalid timestamp path)', { line: trimmedLine }, isDebugEnabled);
                      return false; 
                 }
            }
        } // End of if(userTsMatch)
        return false; // Indicate line was not handled if regex didn't match
    } // End of handleUserTimestampHeader function

    // Modified to return boolean
    private handleDateSeparator(trimmedLine: string, state: ParserState, isDebugEnabled?: boolean): boolean {
        // Finalize any previous message before processing the date separator
        this.finalizeCurrentMessage(state, isDebugEnabled);

        const dateSepMatch = trimmedLine.match(DATE_SEPARATOR_REGEX);
        const dateSepAltMatch = trimmedLine.match(DATE_SEPARATOR_ALT_REGEX);
        const dateStr = dateSepMatch ? dateSepMatch[1] : (dateSepAltMatch ? trimmedLine : null);

        if (dateStr) {
            const parsedDate = parseDate(dateStr);
            if (parsedDate) {
                state.currentDate = parsedDate;
                 // Pass isDebugEnabled to log call
                this.log('debug', 'Handled date separator', { date: state.currentDate }, isDebugEnabled);
            } else {
                this.log('warn', 'Could not parse date separator', { dateStr });
            }
            state.lineIndex++; // Increment only if it was a date separator line
            return true; // Indicate line was handled
        }
        // state.lineIndex++; // Don't increment if not handled
        return false; // Indicate line was not handled
    }

    // Removed redundant handleThreadIndicator function

    // Modified to return boolean
    private handleThreadReplyHeader(trimmedLine: string, state: ParserState, isDebugEnabled?: boolean): boolean {
        if (THREAD_REPLY_HEADER_REGEX.test(trimmedLine)) {
            // Don't finalize message here, just mark it and skip the line
            if (state.currentMessage) state.currentMessage.isThreadReply = true;
             // Pass isDebugEnabled to log call
            this.log('debug', 'Handled thread reply header', undefined, isDebugEnabled);
            state.lineIndex++; // Skip this line, increment only if handled
            return true; // Indicate line was handled
        }
        return false; // Indicate line was not handled
    }

    // Removed handleAttachmentCount function



        // Modified to return boolean
        private handleReactionLine(trimmedLine: string, state: ParserState, isDebugEnabled?: boolean): boolean {
        // Check if the line *only* contains reactions first
        if (!fullReactionLineRegex.test(trimmedLine)) {
            return false; // Not a reaction-only line
        }

        // Use the updated single pattern with global and unicode flags for iteration
        const reactionPairIteratorRegex = new RegExp(singleReactionPairPattern, 'gu');
        let match;
        const reactions: SlackReaction[] = [];
        reactionPairIteratorRegex.lastIndex = 0; // Reset regex index

        while ((match = reactionPairIteratorRegex.exec(trimmedLine)) !== null) {
            // Groups: 1=Full emoji text (e.g., ![:name:](url) or :name: or unicode), 2=Count
            const emoji = match[1]; 
            const count = parseInt(match[2], 10);
            if (isNaN(count)) continue;

            let name = emoji;
            // Extract name from ![:name:](url) format
            const customEmojiMatch = emoji.match(/!\[:(.+?):\]/); 
            // Extract name from :name: format
            const codeEmojiMatch = emoji.match(/^:(.+?):$/); 
            
            if (customEmojiMatch) {
                name = customEmojiMatch[1];
            } else if (codeEmojiMatch) {
                name = codeEmojiMatch[1];
            } // Unicode emojis remain as is

            reactions.push({ name, count }); 
        }

        if (reactions.length > 0) {
            if (state.currentMessage) {
                if (!state.currentMessage.reactions) state.currentMessage.reactions = [];
                state.currentMessage.reactions.push(...reactions);
                 // Pass isDebugEnabled to log call
                this.log('debug', `Handled ${reactions.length} reactions`, { reactions }, isDebugEnabled);
            } else {
                this.log('warn', 'Found reaction line but no current message to attach it to', { line: trimmedLine });
            }
            state.lineIndex++; // Increment only if handled
            return true; // Indicate line was handled
        } else {
             this.log('warn', 'Identified as reaction line but failed to parse pairs', { line: trimmedLine });
             // Don't increment lineIndex if parsing failed, let it be handled as regular text potentially
             return false; // Indicate line was not fully handled as reactions
        }
    }

    // Modified to return boolean
    private handleContinuationTimestamp(trimmedLine: string, state: ParserState, isDebugEnabled?: boolean): boolean {
        if (CONTINUATION_TIME_REGEX.test(trimmedLine)) {
             // Pass isDebugEnabled to log call
            this.log('debug', 'Ignoring continuation timestamp', undefined, isDebugEnabled);
            state.lineIndex++; // Increment only if handled
            return true; // Indicate line was handled
        }
        return false; // Indicate line was not handled
    }

    // Removed handleEditedMarkerWithText method

    // Renamed from handleRegularText - handles any line not identified as a structural element
    // CORRECTED LOGIC HERE
    private handlePotentialContent(originalLine: string, state: ParserState, isDebugEnabled?: boolean): void {
        // Check if we have a pending header from Format 2 (Name \n Time)
        if (state.pendingMessageHeader) {
            this.log('debug', 'Activating pending message header', { user: state.pendingMessageHeader.username }, isDebugEnabled);
            // Finalize the *actual* previous message before activating the new one
            this.finalizeCurrentMessage(state, isDebugEnabled);
            // Activate the pending header
            state.currentMessage = state.pendingMessageHeader;
            state.pendingMessageHeader = null; // Clear the pending header
            // Now, the current line is the *first* content for this new message
            // Strip leading callout syntax before assigning
            state.currentMessage.text = originalLine.replace(/^> /, '');
        } else if (state.currentMessage) {
            // Append the original line to the existing active message
            // Add newline separator if text already exists
            // Strip leading callout syntax before appending
            state.currentMessage.text = (state.currentMessage.text ? state.currentMessage.text + '\n' : '') + originalLine.replace(/^> /, '');
        } else {
            // Content found outside of any message context. Create a new message.
            this.log('debug', 'Potential content found outside message context, creating new message.', { line: originalLine }, isDebugEnabled);
            state.currentMessage = new SlackMessage();
            // Assign a default username or potentially use the last known user if tracked
            state.currentMessage.username = "Unknown User (Content Only)"; 
            // Strip leading callout syntax before assigning
            state.currentMessage.text = originalLine.replace(/^> /, '');
            state.currentMessage.date = state.currentDate; // Use current date context
            // Don't finalize yet, wait for next header or end of input
        }
        state.lineIndex++;
    }

    // Handles lines identified as POTENTIAL_USERNAME (Format 2, line 1)
    private handlePotentialUsername(trimmedLine: string, state: ParserState, isDebugEnabled?: boolean): void {
        // If a username was already pending, the previous line wasn't followed by TIME_ONLY.
        // Treat the previous pending username as content of the current message.
        if (state.pendingUsername) {
            if (state.currentMessage) {
                this.log('debug', 'Previous potential username was just content, appending.', { username: state.pendingUsername }, isDebugEnabled);
                state.currentMessage.text = (state.currentMessage.text ? state.currentMessage.text + '\n' : '') + state.pendingUsername;
            } else {
                // This case should be rare if finalizeCurrentMessage works correctly
                this.log('debug', 'Discarding previous potential username (no active message).', { username: state.pendingUsername }, isDebugEnabled);
            }
        }
        // Store the current line as the new pending username
        state.pendingUsername = trimmedLine; // Store the raw line temporarily
        this.log('debug', 'Stored potential username', { username: state.pendingUsername }, isDebugEnabled);
        state.lineIndex++;
    }

    // Handles lines identified as TIME_ONLY (Format 2, line 2)
    private handleTimeOnly(trimmedLine: string, originalLine: string, state: ParserState, isDebugEnabled?: boolean): void { // Added originalLine
        if (state.pendingUsername) {
            // We have a pending username, this confirms Format 2 (Name \n Time)
            // Create a pending header object, but don't activate it yet (wait for content)
            const pendingHeader = new SlackMessage();
            
            // --- Username Cleanup ---
            let userPart = state.pendingUsername; // Start with the stored potential username
            userPart = userPart.replace(EMOJI_IN_USERNAME_REGEX, '').trim();
            userPart = cleanupDoubledUsernames(userPart);
            userPart = userPart.replace(/[!?,.;:]+$/, '').trim();
            if (!userPart) {
                 this.log('warn', 'Pending username became empty after cleanup', { original: state.pendingUsername });
                 userPart = "Unknown User";
            }
            pendingHeader.username = userPart;

            // --- Avatar Handling ---
            if (state.pendingAvatarUrl) {
                pendingHeader.avatar = state.pendingAvatarUrl; // Assign to pendingHeader
                state.pendingAvatarUrl = null;
            }

            // --- Timestamp Parsing ---
            const parsedDate = parseSlackTimestamp(trimmedLine, state.currentDate);
            if (parsedDate) {
                pendingHeader.timestamp = parsedDate.toISOString(); // Assign to pendingHeader
                // Update context date if needed
                if (!state.currentDate || parsedDate.toDateString() !== state.currentDate.toDateString()) {
                    state.currentDate = new Date(parsedDate);
                    state.currentDate.setHours(0, 0, 0, 0);
                    this.log('debug', 'Updated date context from time-only line', { date: state.currentDate }, isDebugEnabled);
                }
            } else {
                pendingHeader.timestamp = trimmedLine.trim(); // Fallback - Assign to pendingHeader
                this.log('warn', 'Could not parse time-only line', { timestampStr: trimmedLine });
            }
            pendingHeader.date = state.currentDate; // Ensure message date reflects context - Assign to pendingHeader

            // Store the fully populated header, ready to be activated by the next content line
            state.pendingMessageHeader = pendingHeader;
            this.log('debug', 'Created pending message header (Format 2)', { user: pendingHeader.username, ts: pendingHeader.timestamp }, isDebugEnabled);

            state.pendingUsername = null; // Clear pending username
        } else {
            // Time found without a preceding potential username - treat as content
            this.handlePotentialContent(originalLine, state, isDebugEnabled); // Need originalLine here... let's adjust _processLine
            return; // handlePotentialContent increments lineIndex
        }
        state.lineIndex++;
    }


    // Centralized logging helper
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any, isDebugEnabled?: boolean): void {
        if (level === 'debug') {
             // Only log debug messages if the flag is explicitly true
             if (!isDebugEnabled) return;
             // Use console.debug for debug level if needed, or stick to info/warn/error
             Logger.debug(this.constructor.name, message, data, isDebugEnabled);
        } else {
            // Log info, warn, error regardless of the debug flag
            Logger[level](this.constructor.name, message, data);
        }
    }
}
