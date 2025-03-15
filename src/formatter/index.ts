/**
 * Slack Formatter Main Module
 * Handles processing and formatting of Slack conversations
 */
import { Notice } from 'obsidian';
import { ThreadStats, FormatterState, SlackFormatSettings } from '../types';
import { MessageParser } from './message-parser';
import { TextProcessor } from './text-processor';
import { SimpleFormatter } from './simple-formatter';

export class SlackFormatter {
    private settings: SlackFormatSettings;
    private parser: MessageParser;
    private processor: TextProcessor;
    private simpleFormatter: SimpleFormatter;
    private state: FormatterState;

    constructor(settings: SlackFormatSettings) {
        this.settings = settings || {};
        this.parser = new MessageParser(settings);
        this.processor = new TextProcessor(
            settings.userMap || {},
            settings.emojiMap || {},
            settings.channelMap || {}
        );
        this.simpleFormatter = new SimpleFormatter(
            settings,
            settings.userMap || {},
            settings.emojiMap || {},
            settings.channelMap || {}
        );
        this.resetState();
    }

    private debugLog(message: string, data?: any) {
        console.log(`[SlackFormat] ${message}`, data || '');
    }

    public isLikelySlack(text: string): boolean {
        return this.parser.isLikelySlackFormat(text);
    }

    public fixEmojiFormatting(text: string): string {
        if (!text) return text;
        return text
            .replace(/!$$ :([a-z0-9_\-\+]+): $$/gi, ':$1:')
            .replace(/$$ :([a-z0-9_\-\+]+): $$(\d+)/g, ':$1: $2')
            .replace(/$$ :([a-z0-9_\-\+]+): $$/g, ':$1:')
            .replace(/:([a-z0-9_\-\+]+):$$ https?:\/\/[^)]+ $$/gi, ':$1:');
    }

    private preprocessText(text: string): string {
        text = text.replace(/>$$ !note $$\+.*?\n/g, '');
        text = text.replace(/^>\s*/gm, '');
        text = text.replace(/^!+$/gm, '');
        text = text.replace(/^!!!!!\d*\s*replies?$/gm, '');
        text = text.replace(/^$$ https:\/\/ca\.slack-edge\.com\/.* $$$/gm, '');
        text = text.replace(/^https:\/\/ca\.slack-edge\.com\/.*$/gm, '');
        return this.fixEmojiFormatting(text);
    }

    public formatSlackContent(input: string): string {
        if (!input) return '';

        this.debugLog("Starting to format slack content");

        input = this.preprocessText(input);

        if (this.shouldUseSimpleFormatter(input)) {
            this.debugLog("Using SimpleFormatter for bracket-timestamp format");
            return this.simpleFormatter.formatSlackContent(input);
        }

        this.resetState();

        let lines = input.split('\n');

        if (lines.length > this.settings.maxLines) {
            new Notice(`SlackFormatPlugin: Pasted text has ${lines.length} lines, truncating to ${this.settings.maxLines}.`);
            lines = lines.slice(0, this.settings.maxLines);
        }

        const messages = this.parser.parse(input);
        const formattedText = this.parser.formatAsMarkdown(messages);

        this.state.result = [formattedText];
        this.updateThreadStatistics();
        return this.postProcessResults();
    }

    private shouldUseSimpleFormatter(input: string): boolean {
        if (!input) return false;
        const bracketTimestampCount = (input.match(/$$ \d{1,2}:\d{2}\s*(?:AM|PM) $$/gi) || []).length;
        return bracketTimestampCount >= 2;
    }

    private processLines(lines: string[]) {
        const messages = this.parser.parse(lines.join('\n'));
        const formattedText = this.parser.formatAsMarkdown(messages);
        this.state.result.push(formattedText);
    }

    private finalizeProcessing() {
        if (this.state.initialContent.length > 0) {
            this.processInitialContent();
        }
        if (this.state.result.length === 0) {
            this.debugLog("No messages found, creating fallback format");
            this.createFallbackContent();
        }
        this.updateThreadStatistics();
    }

    private processInitialContent() {
        if (!this.state.hasInitialContent || this.state.initialContent.length === 0) return;

        const formattedInitialContent = this.state.initialContent
            .map(line => {
                line = this.fixEmojiFormatting(line);
                const formatted = this.processor.formatLine(line, this.settings.enableMentions, this.settings.enableEmoji);
                return formatted ? `> ${formatted}` : '';
            })
            .filter(Boolean)
            .join('\n');

        if (formattedInitialContent) {
            this.state.result.unshift(
                `>[!note]+ Message from Unknown user`,
                `> **Time:** Unknown`,
                `>`,
                formattedInitialContent
            );
        }
    }

    private createFallbackContent() {
        const lines = this.state.initialContent.length > 0 ?
            this.state.initialContent : ['No parsable Slack content found'];

        const cleanedLines = lines.map(line => this.fixEmojiFormatting(line));

        this.state.result.push(
            `>[!note]+ Slack Conversation`,
            `> **Note:** Could not parse message format`,
            `>`,
            `> ${cleanedLines.join('\n> ')}`
        );
    }

    private updateThreadStatistics() {
        this.state.threadStats.uniqueUsers = this.state.participantSet.size;

        if (this.state.detectedDates.length > 0) {
            const earliest = this.state.detectedDates.reduce((a, b) => (a < b ? a : b));
            const latest = this.state.detectedDates.reduce((a, b) => (a > b ? a : b));
            this.state.threadStats.dateRange = `${this.formatDateYMD(earliest)} to ${this.formatDateYMD(latest)}`;
        }

        let maxMessages = 0;
        for (const [user, count] of Object.entries(this.state.userMessageCounts)) {
            if (count > maxMessages) {
                maxMessages = count;
                this.state.threadStats.mostActiveUser = user;
            }
        }
    }

    private postProcessResults(): string {
        const cleanedResults = this.state.result.map(item => {
            let cleanedItem = this.fixEmojiFormatting(item);
            cleanedItem = this.processor.cleanLinkFormatting(cleanedItem);
            return cleanedItem;
        });

        return cleanedResults.join('\n\n');
    }

    private resetState() {
        this.state = {
            detectedDates: [],
            participantSet: new Set(),
            result: [],
            threadInfo: '',
            currentMessageNumber: 0,
            threadStats: {
                messageCount: 0,
                uniqueUsers: 0,
                threadCount: 0,
                dateRange: '',
                mostActiveUser: undefined
            },
            userMessageCounts: {},
            currentUser: '',
            currentTime: '',
            messageLines: [],
            lastKnownUser: '',
            lastMessageTime: '',
            isMessageContinuation: false,
            inCodeBlock: false,
            inQuotedBlock: false,
            initialContent: [],
            hasInitialContent: false,
            messageStarted: false,
            currentAvatar: '',
            lastDateLine: '',
            inReactionBlock: false,
            reactionLines: [],
            unknownUserActive: false,
            processedMessageKeys: new Set(),
            lines: [],
            isPreFormatted: false,
            currentDate: '',
            reactionText: '',
            reactions: []
        };
    }

    private flushMessage() {
        // No-op: Logic moved to MessageParser
    }

    private parseMessageStart(line: string, lines: string[]): any {
        return this.parser.parseMessageStartPublic(line, 0, lines);
    }

    private generateMessageKey(user: string, time: string, content: string): string {
        return `${user}|${time}|${content}`;
    }

    private getMessageLineCount(message: any): number {
        return message?.content?.length || 0;
    }

    private parseAndFormatTime(timeStr: string): string {
        return this.processor.formatTimestamp(timeStr);
    }

    private formatMessageHeader(
        lines: string[],
        user: string,
        time: string,
        avatar: string,
        threadInfo: string | null,
        isContinuation: boolean
    ): string {
        const header = isContinuation ?
            `> ` :
            `>[!note]+ [[${user}]] ${time}${threadInfo ? `\n> ${threadInfo}` : ''}\n> `;
        return `${header}${lines.join('\n> ')}`;
    }

    private isDuplicateMessage(message: string): boolean {
        const msgHash = this.generateMessageKey(
            this.state.currentUser,
            this.state.currentTime,
            message
        );
        return this.state.processedMessageKeys.has(msgHash);
    }

    private formatDateYMD(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    private resetMessageState(): void {
        this.state.lines = [];
        this.state.currentUser = '';
        this.state.currentTime = '';
        this.state.reactionText = '';
        this.state.reactions = [];
        this.state.isPreFormatted = false;
    }
}