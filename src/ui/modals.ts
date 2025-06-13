/**
 * UI Modals for Slack Formatter plugin
 */
import { App, Editor, Notice, TextAreaComponent, ButtonComponent, ToggleComponent, MarkdownRenderer } from 'obsidian';
import type SlackFormatPlugin from '../main';
import { BaseModal } from './base-modal';
import { ISlackFormatter } from '../interfaces';
import { Logger } from '../utils/logger';

/**
 * Modal for confirming Slack paste conversion
 */
export class ConfirmSlackModal extends BaseModal {
    onResult: (confirmed: boolean) => void;

    constructor(app: App, onResult: (confirmed: boolean) => void) {
        super(app);
        this.onResult = onResult;
    }

    onOpen(): void {
        this.applyModalStyles();

        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Format Slack Conversation?' });
        contentEl.createEl('p', { text: 'This looks like a Slack conversation. Would you like to format it?' });

        const btnContainer = this.createButtonContainer();
        // Pass container to createButton
        const confirmBtn = this.createButton(btnContainer, 'Format', true);
        const cancelBtn = this.createButton(btnContainer, 'Cancel');

        // Use onClick for ButtonComponent
        confirmBtn.onClick(() => {
            this.onResult(true);
            this.close();
        });

        // Use onClick for ButtonComponent
        cancelBtn.onClick(() => {
            this.onResult(false);
            this.close();
        });
    }
}

/**
 * Enhanced modal for previewing Slack conversation with debug mode
 */
export class SlackPreviewModal extends BaseModal {
    private onResult: (formattedText: string | null) => void;
    private rawText: string;
    private formatter: ISlackFormatter;
    private previewContainer: HTMLElement;
    private statsContainer: HTMLElement;
    private formattedText: string = '';
    private debugMode: boolean = false;

    constructor(
        app: App,
        rawText: string,
        onResult: (formattedText: string | null) => void,
        formatter: ISlackFormatter
    ) {
        super(app);
        this.onResult = onResult;
        this.rawText = rawText;
        this.formatter = formatter;
    }

    onOpen(): void {
        this.applyModalStyles(true);

        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Preview Formatted Conversation' });

        // Debug toggle
        const debugContainer = contentEl.createDiv({ cls: 'debug-toggle-container' });
        debugContainer.style.marginBottom = '10px';
        
        const debugToggle = new ToggleComponent(debugContainer)
            .setValue(this.debugMode)
            .onChange((value) => {
                this.debugMode = value;
                this.updatePreview();
            });
        
        debugContainer.createSpan({ text: ' Show debug information' });

        // Stats container
        this.statsContainer = contentEl.createDiv({ cls: 'slack-stats-container' });
        this.statsContainer.style.fontSize = '0.9em';
        this.statsContainer.style.color = 'var(--text-muted)';
        this.statsContainer.style.marginBottom = '10px';

        // Create preview container
        this.previewContainer = contentEl.createDiv({ cls: 'slack-preview-container' });
        this.previewContainer.style.maxHeight = '400px';
        this.previewContainer.style.overflow = 'auto';
        this.previewContainer.style.border = '1px solid var(--background-modifier-border)';
        this.previewContainer.style.padding = '10px';
        this.previewContainer.style.marginBottom = '10px';
        this.previewContainer.style.backgroundColor = 'var(--background-secondary)';

        // Initial preview
        this.updatePreview();

        // Button container
        const btnContainer = this.createButtonContainer();
        const insertBtn = this.createButton(btnContainer, 'Insert', true);
        const cancelBtn = this.createButton(btnContainer, 'Cancel');

        insertBtn.onClick(() => {
            if (this.formattedText && !insertBtn.disabled) {
                this.onResult(this.formattedText);
                this.close();
            }
        });

        cancelBtn.onClick(() => {
            this.onResult(null);
            this.close();
        });
    }

    private async updatePreview() {
        try {
            // Store original debug setting if formatter has updateSettings
            let originalDebug: boolean | undefined;
            if ('settings' in this.formatter && this.formatter.settings && typeof this.formatter.settings === 'object') {
                originalDebug = (this.formatter.settings as any).debug;
            }

            // Temporarily enable debug if needed
            if (this.debugMode && 'updateSettings' in this.formatter) {
                const currentSettings = ('settings' in this.formatter && typeof this.formatter.settings === 'object') 
                    ? this.formatter.settings as any
                    : {};
                const parsedMaps = ('parsedMaps' in this.formatter && typeof (this.formatter as any).parsedMaps === 'object')
                    ? (this.formatter as any).parsedMaps 
                    : { userMap: {}, emojiMap: {} };
                (this.formatter as any).updateSettings({ ...currentSettings, debug: true }, parsedMaps);
            }

            // Format the content
            this.formattedText = this.formatter.formatSlackContent(this.rawText);

            // Restore original debug setting
            if (originalDebug !== undefined && 'updateSettings' in this.formatter) {
                const currentSettings = ('settings' in this.formatter && typeof this.formatter.settings === 'object') 
                    ? this.formatter.settings as any
                    : {};
                const parsedMaps = ('parsedMaps' in this.formatter && typeof (this.formatter as any).parsedMaps === 'object')
                    ? (this.formatter as any).parsedMaps 
                    : { userMap: {}, emojiMap: {} };
                (this.formatter as any).updateSettings({ ...currentSettings, debug: originalDebug }, parsedMaps);
            }

            // Update stats
            if ('getThreadStats' in this.formatter) {
                const stats = this.formatter.getThreadStats();
                this.statsContainer.innerHTML = `
                    <strong>Statistics:</strong> 
                    ${stats.messageCount || 0} messages • 
                    ${stats.uniqueUsers || 0} participants • 
                    ${stats.formatStrategy || 'unknown'} format
                    ${stats.processingTime ? ` • ${stats.processingTime}ms` : ''}
                `;
            }

            // Clear and re-render preview
            this.previewContainer.empty();
            
            // Use MarkdownRenderer to properly render the content
            await MarkdownRenderer.renderMarkdown(
                this.formattedText,
                this.previewContainer,
                '',
                this
            );
            
        } catch (error) {
            Logger.error('SlackPreviewModal', 'Error formatting Slack content:', error);
            this.formattedText = '';
            
            // Show error in preview
            this.previewContainer.empty();
            const errorEl = this.previewContainer.createDiv({ cls: 'slack-preview-error' });
            errorEl.style.color = 'var(--text-error)';
            errorEl.createEl('h3', { text: '⚠️ Formatting Error' });
            errorEl.createEl('p', { text: error.message || 'Unknown error occurred' });
            
            // Show raw content as fallback
            const fallbackEl = errorEl.createEl('details');
            fallbackEl.createEl('summary', { text: 'Show raw content' });
            const pre = fallbackEl.createEl('pre');
            pre.style.fontSize = '0.8em';
            pre.style.overflow = 'auto';
            pre.style.maxHeight = '200px';
            pre.textContent = this.rawText.substring(0, 1000) + (this.rawText.length > 1000 ? '...' : '');
        }
    }
}