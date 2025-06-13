import { ISlackFormatter } from '../interfaces';
import { ParsedMaps, ThreadStats } from '../types/formatters.types';
import { SlackFormatSettings } from '../types/settings.types';
import { SlackMessage } from '../models';
import { Logger } from '../utils/logger';

// Import new components
import { FlexibleMessageParser } from './stages/flexible-message-parser';
import { ImprovedFormatDetector } from './stages/improved-format-detector';
import { UnifiedProcessor } from './processors/unified-processor';
import { PreProcessor } from './stages/preprocessor';
import { PostProcessor } from './stages/postprocessor';

// Import strategies
import { StandardFormatStrategy } from './strategies/standard-format-strategy';
import { BracketFormatStrategy } from './strategies/bracket-format-strategy';
import { MixedFormatStrategy } from './strategies/mixed-format-strategy';
import { BaseFormatStrategy } from './strategies/base-format-strategy';

/**
 * Improved SlackFormatter with flexible parsing and better error handling
 */
export class SlackFormatter implements ISlackFormatter {
    private settings: SlackFormatSettings;
    private parsedMaps: ParsedMaps;
    private parser: FlexibleMessageParser;
    private formatDetector: ImprovedFormatDetector;
    private unifiedProcessor: UnifiedProcessor;
    private preprocessor: PreProcessor;
    private postprocessor: PostProcessor;
    private strategies: Map<string, BaseFormatStrategy>;
    
    // Cache for performance
    private lastInput: string | null = null;
    private lastOutput: string | null = null;
    private lastStats: ThreadStats | null = null;
    private debugMode: boolean;

    constructor(
        settings: SlackFormatSettings,
        userMap: Record<string, string>,
        emojiMap: Record<string, string>
    ) {
        this.settings = settings;
        this.parsedMaps = { userMap, emojiMap };
        this.debugMode = settings.debug || false;
        
        // Initialize components
        this.parser = new FlexibleMessageParser();
        this.formatDetector = new ImprovedFormatDetector();
        this.unifiedProcessor = new UnifiedProcessor(settings);
        this.preprocessor = new PreProcessor(settings.maxLines);
        this.postprocessor = new PostProcessor();
        
        // Initialize strategies
        this.strategies = new Map();
        this.strategies.set('standard', new StandardFormatStrategy(settings, this.parsedMaps));
        this.strategies.set('bracket', new BracketFormatStrategy(settings, this.parsedMaps));
        this.strategies.set('mixed', new MixedFormatStrategy(settings, this.parsedMaps));
    }

    /**
     * Check if text is likely from Slack
     */
    isLikelySlack(text: string): boolean {
        return this.formatDetector.isLikelySlack(text);
    }

    /**
     * Main formatting method with improved error handling
     */
    formatSlackContent(input: string): string {
        if (!input) return '';
        
        // Check cache
        if (input === this.lastInput && this.lastOutput !== null) {
            Logger.debug('SlackFormatter', 'Using cached result');
            return this.lastOutput;
        }
        
        try {
            const startTime = Date.now();
            const debugInfo: string[] = [];
            
            // 1. Preprocessing
            const preprocessed = this.preprocessor.process(input);
            if (preprocessed.modified) {
                debugInfo.push(`Preprocessed: truncated to ${this.settings.maxLines} lines`);
            }
            
            // 2. Format detection
            const formatType = this.formatDetector.detectFormat(preprocessed.content);
            debugInfo.push(`Detected format: ${formatType}`);
            
            // 3. Parse messages
            const messages = this.parser.parse(preprocessed.content, this.debugMode);
            debugInfo.push(`Parsed ${messages.length} messages`);
            
            // 4. Process message content
            const processedMessages = messages.map(msg => {
                const processed = { ...msg };
                if (processed.text) {
                    processed.text = this.unifiedProcessor.process(
                        processed.text,
                        this.parsedMaps,
                        this.debugMode
                    );
                }
                return processed;
            });
            
            // 5. Apply formatting strategy
            const strategy = this.strategies.get(formatType) || this.strategies.get('standard')!;
            let formatted = strategy.formatToMarkdown(processedMessages);
            
            // 6. Postprocessing
            const postprocessed = this.postprocessor.process(formatted);
            if (postprocessed.modified) {
                debugInfo.push('Applied postprocessing');
                formatted = postprocessed.content;
            }
            
            // 7. Add debug info if enabled
            if (this.debugMode && debugInfo.length > 0) {
                formatted = this.addDebugInfo(formatted, debugInfo, messages);
            }
            
            // Calculate stats
            const endTime = Date.now();
            this.lastStats = this.calculateStats(messages, formatType, endTime - startTime);
            
            // Update cache
            this.lastInput = input;
            this.lastOutput = formatted;
            
            return formatted;
            
        } catch (error) {
            Logger.error('SlackFormatter', 'Error formatting content', error);
            
            // Fallback formatting
            return this.fallbackFormat(input, error);
        }
    }

    /**
     * Get thread statistics
     */
    getThreadStats(): ThreadStats {
        return this.lastStats || {
            messageCount: 0,
            uniqueUsers: 0,
            formatStrategy: 'unknown'
        };
    }

    /**
     * Build note with frontmatter
     */
    buildNoteWithFrontmatter(text: string): string {
        const formatted = this.formatSlackContent(text);
        const stats = this.getThreadStats();
        
        const frontmatter = [
            '---',
            `cssclasses: ${this.settings.frontmatterCssClass || 'slack-conversation'}`,
            `participants: ${stats.uniqueUsers}`,
            `messages: ${stats.messageCount}`,
            `format: ${stats.formatStrategy}`,
            `date: ${new Date().toISOString().split('T')[0]}`,
            '---',
            ''
        ];
        
        if (this.settings.frontmatterTitle) {
            frontmatter.push(this.settings.frontmatterTitle);
            frontmatter.push('');
        }
        
        return frontmatter.join('\n') + formatted;
    }

    /**
     * Update settings and dependencies
     */
    updateSettings(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void {
        this.settings = settings;
        this.parsedMaps = parsedMaps;
        this.debugMode = settings.debug || false;
        
        // Update components
        this.unifiedProcessor.updateSettings(settings);
        this.preprocessor.updateMaxLines(settings.maxLines);
        
        // Update strategies
        this.strategies.forEach(strategy => {
            strategy.updateSettings(settings, parsedMaps);
        });
        
        // Clear cache
        this.lastInput = null;
        this.lastOutput = null;
        this.lastStats = null;
    }

    /**
     * Calculate thread statistics
     */
    private calculateStats(messages: SlackMessage[], formatStrategy: string, processingTime: number): ThreadStats {
        const users = new Set<string>();
        let threadReplies = 0;
        
        messages.forEach(msg => {
            if (msg.username) {
                users.add(msg.username);
            }
            if (msg.threadInfo) {
                threadReplies++;
            }
        });
        
        return {
            messageCount: messages.length,
            uniqueUsers: users.size,
            threadReplies,
            formatStrategy,
            processingTime
        };
    }

    /**
     * Add debug information to the output
     */
    private addDebugInfo(content: string, debugInfo: string[], messages: SlackMessage[]): string {
        const debugSection = [
            '',
            '---',
            '',
            '## Debug Information',
            '',
            '### Processing Steps',
            ...debugInfo.map(info => `- ${info}`),
            '',
            '### Unparsed Content',
            ''
        ];
        
        // Find lines that weren't parsed into messages
        const messageTexts = new Set(messages.map(m => m.text.trim()));
        const originalLines = this.lastInput?.split('\n') || [];
        const unparsedLines = originalLines.filter(line => {
            const trimmed = line.trim();
            return trimmed && !messageTexts.has(trimmed);
        });
        
        if (unparsedLines.length > 0) {
            debugSection.push('```');
            debugSection.push(...unparsedLines.slice(0, 50)); // Limit to 50 lines
            if (unparsedLines.length > 50) {
                debugSection.push(`... and ${unparsedLines.length - 50} more lines`);
            }
            debugSection.push('```');
        } else {
            debugSection.push('*All content was successfully parsed*');
        }
        
        return content + '\n' + debugSection.join('\n');
    }

    /**
     * Fallback formatting when parsing fails
     */
    private fallbackFormat(input: string, error: any): string {
        Logger.warn('SlackFormatter', 'Using fallback formatting');
        
        const lines = input.split('\n');
        const output: string[] = [
            '>[!warning]+ Slack Formatting Error',
            `> Failed to parse this content as Slack conversation.`,
            `> Error: ${error.message || 'Unknown error'}`,
            '>',
            '> **Original Content:**',
            '>'
        ];
        
        // Add original content in a code block
        output.push('> ```');
        lines.slice(0, 100).forEach(line => {
            output.push(`> ${line}`);
        });
        if (lines.length > 100) {
            output.push(`> ... and ${lines.length - 100} more lines`);
        }
        output.push('> ```');
        
        // Still try to extract some information
        const userMatches = input.match(/<@U[A-Z0-9]+>/g) || [];
        const timeMatches = input.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi) || [];
        
        if (userMatches.length > 0 || timeMatches.length > 0) {
            output.push('>');
            output.push('> **Detected Elements:**');
            if (userMatches.length > 0) {
                output.push(`> - User mentions: ${userMatches.length}`);
            }
            if (timeMatches.length > 0) {
                output.push(`> - Timestamps: ${timeMatches.length}`);
            }
        }
        
        this.lastStats = {
            messageCount: 0,
            uniqueUsers: userMatches.length,
            formatStrategy: 'fallback',
            processingTime: 0
        };
        
        return output.join('\n');
    }
}