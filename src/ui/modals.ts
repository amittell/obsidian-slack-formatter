/**
 * UI Modals for Slack Formatter plugin
 */
import { App, Editor, Notice, TextAreaComponent, ButtonComponent, ToggleComponent, MarkdownRenderer, Component } from 'obsidian';
import type SlackFormatPlugin from '../main';
import { BaseModal } from './base-modal';
import { ISlackFormatter } from '../interfaces';
import { Logger } from '../utils/logger';
import { SlackFormatSettings } from '../types/settings.types';
import { ParsedMaps } from '../types/formatters.types';

/**
 * Type guard to check if a formatter has settings property
 */
function hasSettings(formatter: any): formatter is ISlackFormatter & { settings: SlackFormatSettings } {
    return formatter && typeof formatter === 'object' && 'settings' in formatter && 
           formatter.settings && typeof formatter.settings === 'object';
}

/**
 * Type guard to check if a formatter has parsedMaps property  
 */
function hasParsedMaps(formatter: any): formatter is ISlackFormatter & { parsedMaps: ParsedMaps } {
    return formatter && typeof formatter === 'object' && 'parsedMaps' in formatter &&
           formatter.parsedMaps && typeof formatter.parsedMaps === 'object';
}

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
            if (hasSettings(this.formatter)) {
                originalDebug = this.formatter.settings?.debug;
            }

            // Temporarily enable debug if needed
            if (this.debugMode && 'updateSettings' in this.formatter) {
                const settings = hasSettings(this.formatter) ? this.formatter.settings : {};
                const parsedMaps = hasParsedMaps(this.formatter) ? this.formatter.parsedMaps : { userMap: {}, emojiMap: {} };
                
                // Safely call updateSettings with proper type checking
                if (typeof this.formatter.updateSettings === 'function') {
                    this.formatter.updateSettings({ ...settings, debug: true }, parsedMaps);
                }
            }

            // Format the content
            this.formattedText = this.formatter.formatSlackContent(this.rawText);

            // Restore original debug setting
            if (originalDebug !== undefined && 'updateSettings' in this.formatter) {
                const settings = hasSettings(this.formatter) ? this.formatter.settings : {};
                const parsedMaps = hasParsedMaps(this.formatter) ? this.formatter.parsedMaps : { userMap: {}, emojiMap: {} };
                
                // Safely restore settings
                if (typeof this.formatter.updateSettings === 'function') {
                    this.formatter.updateSettings({ ...settings, debug: originalDebug }, parsedMaps);
                }
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
            // Create a dedicated component instance for rendering to avoid memory leaks
            const renderComponent = new Component();
            renderComponent.load();
            
            try {
                // Use the newer render method with dedicated component
                await MarkdownRenderer.render(
                    this.app,
                    this.formattedText,
                    this.previewContainer,
                    '', // sourcePath
                    renderComponent // Use dedicated component instance
                );
                
                // Register component for cleanup when modal closes
                this.registerChild(renderComponent);
            } catch (renderError) {
                // Fallback to plain text if render fails
                Logger.warn('SlackPreviewModal', 'Markdown rendering failed, showing plain text', renderError);
                this.previewContainer.empty();
                const pre = this.previewContainer.createEl('pre');
                pre.style.whiteSpace = 'pre-wrap';
                pre.style.overflow = 'auto';
                pre.textContent = this.formattedText;
                
                // Clean up component on error
                renderComponent.unload();
            }
            
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