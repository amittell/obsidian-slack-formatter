/**
 * UI Modals for Slack Formatter plugin
 */
import {
  App,
  Editor,
  Notice,
  TextAreaComponent,
  ButtonComponent,
  ToggleComponent,
  MarkdownRenderer,
  Component,
} from 'obsidian';
import type SlackFormatPlugin from '../main';
import { BaseModal } from './base-modal';
import { ISlackFormatter } from '../interfaces';
import { Logger } from '../utils/logger';
import { SlackFormatSettings } from '../types/settings.types';
import { ParsedMaps } from '../types/formatters.types';
import { DEFAULT_SETTINGS } from '../settings';

/**
 * Type guard to check if a formatter has settings property
 */
function hasSettings(
  formatter: any
): formatter is ISlackFormatter & { settings: SlackFormatSettings } {
  return (
    formatter &&
    typeof formatter === 'object' &&
    'settings' in formatter &&
    formatter.settings &&
    typeof formatter.settings === 'object'
  );
}

/**
 * Type guard to check if a formatter has parsedMaps property
 */
function hasParsedMaps(formatter: any): formatter is ISlackFormatter & { parsedMaps: ParsedMaps } {
  return (
    formatter &&
    typeof formatter === 'object' &&
    'parsedMaps' in formatter &&
    formatter.parsedMaps &&
    typeof formatter.parsedMaps === 'object'
  );
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
    contentEl.createEl('p', {
      text: 'This looks like a Slack conversation. Would you like to format it?',
    });

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
  private renderComponent: Component | null = null;
  private showRawContent: boolean = false;

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
      .onChange(value => {
        this.debugMode = value;
        this.updatePreview();
      });

    debugContainer.createSpan({ text: ' Show debug information' });

    // View toggle (raw vs formatted)
    const viewToggleContainer = contentEl.createDiv({ cls: 'view-toggle-container' });
    viewToggleContainer.style.marginBottom = '10px';
    viewToggleContainer.style.display = 'flex';
    viewToggleContainer.style.alignItems = 'center';
    viewToggleContainer.style.gap = '10px';

    viewToggleContainer.createSpan({ text: 'Formatted view' });

    const viewToggle = new ToggleComponent(viewToggleContainer)
      .setValue(this.showRawContent)
      .onChange(value => {
        this.showRawContent = value;
        this.updatePreview();
      });

    viewToggleContainer.createSpan({ text: 'Raw view' });

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

  onClose(): void {
    // Clean up the render component when modal closes
    if (this.renderComponent) {
      this.renderComponent.unload();
      this.renderComponent = null;
    }
  }

  private async updatePreview() {
    try {
      // Store original debug setting if formatter has updateSettings
      let originalDebug: boolean | undefined;
      if (hasSettings(this.formatter)) {
        originalDebug = this.formatter.settings?.debug;
      }

      // Update debug setting based on toggle state
      if ('updateSettings' in this.formatter) {
        const settings = hasSettings(this.formatter) ? this.formatter.settings : DEFAULT_SETTINGS;
        const parsedMaps = hasParsedMaps(this.formatter)
          ? this.formatter.parsedMaps
          : { userMap: {}, emojiMap: {} };

        // Safely call updateSettings with proper type checking
        if (typeof this.formatter.updateSettings === 'function') {
          this.formatter.updateSettings({ ...settings, debug: this.debugMode }, parsedMaps);
        }
      }

      // Format the content
      this.formattedText = this.formatter.formatSlackContent(this.rawText);

      // Debug logging
      Logger.debug('SlackPreviewModal', 'Formatted text length:', this.formattedText.length);
      Logger.debug(
        'SlackPreviewModal',
        'Formatted text preview:',
        this.formattedText.substring(0, 200) + '...'
      );

      // Restore original debug setting
      if (originalDebug !== undefined && 'updateSettings' in this.formatter) {
        const settings = hasSettings(this.formatter) ? this.formatter.settings : DEFAULT_SETTINGS;
        const parsedMaps = hasParsedMaps(this.formatter)
          ? this.formatter.parsedMaps
          : { userMap: {}, emojiMap: {} };

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

      // Check if we should show raw content or formatted
      if (this.showRawContent) {
        // Show raw markdown content
        const pre = this.previewContainer.createEl('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.overflow = 'auto';
        pre.style.fontFamily = 'var(--font-monospace)';
        pre.style.fontSize = '0.9em';
        pre.textContent = this.formattedText;
      } else {
        // Use MarkdownRenderer to properly render the content
        // Create a dedicated component instance for rendering to avoid memory leaks
        this.renderComponent = new Component();
        this.renderComponent.load();

        try {
          Logger.debug(
            'SlackPreviewModal',
            'Starting markdown render with text length:',
            this.formattedText.length
          );

          // Try the simpler render method first (more compatible across Obsidian versions)
          try {
            await MarkdownRenderer.renderMarkdown(
              this.formattedText,
              this.previewContainer,
              '', // sourcePath
              this.renderComponent
            );
            Logger.debug(
              'SlackPreviewModal',
              'Markdown render completed successfully with renderMarkdown'
            );
          } catch (fallbackError) {
            Logger.debug(
              'SlackPreviewModal',
              'renderMarkdown failed, trying render method',
              fallbackError
            );
            // Fallback to the render method
            await MarkdownRenderer.render(
              this.app,
              this.formattedText,
              this.previewContainer,
              '', // sourcePath
              this.renderComponent
            );
            Logger.debug('SlackPreviewModal', 'Markdown render completed successfully with render');
          }

          // Store component for cleanup when modal closes
          // Note: registerChild is not available in modals, we'll clean up in onClose
        } catch (renderError) {
          // Fallback to plain text if render fails
          Logger.warn('SlackPreviewModal', 'Markdown rendering failed, showing plain text', {
            error: renderError instanceof Error ? renderError.message : String(renderError),
            stack: renderError instanceof Error ? renderError.stack : undefined,
            formattedTextLength: this.formattedText.length,
            formattedTextSample: this.formattedText.substring(0, 100),
          });
          this.previewContainer.empty();
          const pre = this.previewContainer.createEl('pre');
          pre.style.whiteSpace = 'pre-wrap';
          pre.style.overflow = 'auto';
          pre.textContent = this.formattedText;

          // Clean up component on error
          if (this.renderComponent) {
            this.renderComponent.unload();
            this.renderComponent = null;
          }
        }
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
