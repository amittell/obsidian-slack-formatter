import { BaseFormatStrategy } from './base-format-strategy'; // Import base class
import { SlackFormatSettings } from '../../types/settings.types';
import { SlackMessage } from '../../models';
import { FormatStrategyType, ParsedMaps } from '../../types/formatters.types'; // Import ParsedMaps

// Removed redundant local ParsedMaps definition


export class StandardFormatStrategy extends BaseFormatStrategy {
    public readonly type: FormatStrategyType = 'standard';

    constructor(settings: SlackFormatSettings, parsedMaps: ParsedMaps) {
        super(settings, parsedMaps); // Call base constructor with maps
        // Processors are initialized in the base class using parsedMaps
    }

    protected formatHeader(message: SlackMessage): string[] {
        // Use formatDisplayName which should handle mapping to [[Link]] if available, or return raw name
        const displayName = this.usernameProcessor.formatDisplayName(message.username);
        const formattedTimestamp = this.getFormattedTimestamp(message); // Use helper from base
        
        // Construct the new header lines with callout prefix
        const isThreadReply = message.isThreadReply || (message.threadInfo && message.threadInfo.includes('replied to a thread:'));
        const titleLine = isThreadReply 
            ? `> [!slack]+ Thread Reply from ${displayName}`
            : `> [!slack]+ Message from ${displayName}`;
        const timeLine = `> **Time:** ${formattedTimestamp}`;
        
        return [titleLine, timeLine];
    }

    // formatAttachments method removed - handled by AttachmentProcessor via BaseFormatStrategy

    protected formatReactions(message: SlackMessage): string | null {
        if (!message.reactions || message.reactions.length === 0) {
            return null;
        }
        try {
            return this.emojiProcessor.processReactions(message.reactions);
        } catch (reactError) {
            this.log('error', `Error formatting reactions: ${reactError}`, { reactions: message.reactions });
            return '[Error formatting reactions]';
        }
    }

    // The main formatToMarkdown logic is now inherited from BaseFormatStrategy
    // We only need to implement the abstract methods above.
}