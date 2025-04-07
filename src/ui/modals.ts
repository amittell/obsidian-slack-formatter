/**
 * UI Modals for Slack Formatter plugin
 */
import { App, Editor, Notice, TextAreaComponent, ButtonComponent } from 'obsidian'; // Import ButtonComponent
import type SlackFormatPlugin from '../main';
import { BaseModal } from './base-modal';
import { ISlackFormatter } from '../interfaces'; // Import the interface

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
 * Modal for previewing Slack conversation before inserting
 */
export class SlackPreviewModal extends BaseModal {
    private onResult: (formattedText: string) => void;
    private rawText: string;
    private formatter: ISlackFormatter; // Use the specific interface type
    private textArea: TextAreaComponent;

    constructor(
        app: App,
        rawText: string,
        onResult: (formattedText: string) => void,
        formatter: ISlackFormatter // Use the specific interface type
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

        // Create preview area
        this.textArea = new TextAreaComponent(contentEl)
            .setPlaceholder('Formatted content will appear here');

        this.textArea.inputEl.addClass('preview-area');

        const btnContainer = this.createButtonContainer();
        // Pass container to createButton
        const insertBtn = this.createButton(btnContainer, 'Insert', true);
        const cancelBtn = this.createButton(btnContainer, 'Cancel');

        // Format content within try...catch
        try {
            const formattedContent = this.formatter.formatSlackContent(this.rawText);
            this.textArea.setValue(formattedContent);
        } catch (error) {
            console.error("Error formatting content for preview:", error);
            this.textArea.setValue(`Error formatting content:\n\n${error.message}`);
            // Use ButtonComponent methods
            insertBtn.setDisabled(true);
            insertBtn.setTooltip('Cannot insert due to formatting error');
        }

        // Use onClick for ButtonComponent
        insertBtn.onClick(() => {
            // Check ButtonComponent's disabled state
            if (!insertBtn.disabled) {
                this.onResult(this.textArea.getValue());
                this.close();
            }
        });

        // Use onClick for ButtonComponent
        cancelBtn.onClick(() => this.close());
    }
}