/**
 * UI Modals for Slack Formatter plugin
 */
import {
  App,
  Modal,
  Editor,
  Notice,
  ButtonComponent,
  TextAreaComponent
} from 'obsidian';
import type SlackFormatPlugin from '../main';

/**
 * Modal for confirming Slack paste conversion
 */
export class ConfirmSlackModal extends Modal {
  onResult: (confirmed: boolean) => void;
  
  constructor(app: App, onResult: (confirmed: boolean) => void) {
    super(app);
    this.onResult = onResult;
  }
  
  onOpen() {
    const { contentEl } = this;
    
    // Clear existing content
    contentEl.empty();
    
    // Add styles to make the modal more prominent
    this.modalEl.style.width = '400px';
    this.modalEl.style.padding = '20px';
    
    // Create header
    const header = contentEl.createEl('h2', { 
      text: 'Slack Text Detected',
      cls: 'slack-confirm-header'
    });
    header.style.marginBottom = '15px';
    header.style.color = 'var(--text-accent)';
    
    // Create description
    const desc = contentEl.createEl('p', { 
      text: 'Would you like to convert this Slack text to formatted Markdown?',
      cls: 'slack-confirm-desc'
    });
    desc.style.marginBottom = '20px';
    
    // Create button container
    const btnDiv = contentEl.createDiv('modal-button-container');
    btnDiv.style.display = 'flex';
    btnDiv.style.justifyContent = 'flex-end';
    btnDiv.style.gap = '10px';
    
    // Create buttons
    const yesBtn = new ButtonComponent(btnDiv)
      .setButtonText('Yes, Format It')
      .onClick(() => {
        this.onResult(true);
        this.close();
      });
    
    const noBtn = new ButtonComponent(btnDiv)
      .setButtonText('No, Regular Paste')
      .onClick(() => {
        this.onResult(false);
        this.close();
      });
    
    // Style buttons
    yesBtn.buttonEl.style.backgroundColor = 'var(--interactive-accent)';
    yesBtn.buttonEl.style.color = 'var(--text-on-accent)';
    noBtn.buttonEl.style.backgroundColor = 'var(--interactive-normal)';
  }
  
  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Modal for previewing Slack conversation before inserting
 */
export class SlackPreviewModal extends Modal {
  onResult: (formattedText: string) => void;
  rawText: string;
  formatter: any;
  textArea!: TextAreaComponent;
  previewEl!: HTMLDivElement;
  
  constructor(
    app: App, 
    rawText: string, 
    onResult: (formattedText: string) => void,
    formatter: any
  ) {
    super(app);
    this.onResult = onResult;
    this.rawText = rawText;
    this.formatter = formatter;
  }
  
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    // Make modal significantly wider
    this.modalEl.style.width = 'min(95vw, 1800px)';
    this.modalEl.style.height = '95vh';
    
    // Set container styles
    contentEl.style.display = 'flex';
    contentEl.style.flexDirection = 'column';
    contentEl.style.height = '100%';
    contentEl.style.overflow = 'hidden';
    
    // Header section
    const header = contentEl.createDiv('slack-preview-header');
    header.style.flexShrink = '0';
    header.style.padding = '1rem';
    header.style.borderBottom = '1px solid var(--background-modifier-border)';
    header.style.backgroundColor = 'var(--background-primary)';
    
    header.createEl('h2', {
      text: 'Slack → Preview & Insert'
    });
    
    const buttonContainer = header.createDiv('slack-preview-buttons');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';
    
    new ButtonComponent(buttonContainer)
      .setButtonText('Insert')
      .onClick(() => {
        const raw = this.textArea.getValue();
        
        // Fix emoji issues in text before processing
        const fixedText = this.formatter.fixEmojiFormatting(raw);
        const formatted = this.formatter.formatSlackContent(fixedText);
        this.onResult(formatted);
        this.close();
      });
    
    new ButtonComponent(buttonContainer)
      .setButtonText('Cancel')
      .onClick(() => this.close());
    
    // Main content area
    const mainContent = contentEl.createDiv('slack-preview-main');
    mainContent.style.display = 'flex';
    mainContent.style.gap = '1rem';
    mainContent.style.flex = '1';
    mainContent.style.overflow = 'hidden';
    mainContent.style.padding = '1rem';
    mainContent.style.minHeight = '0';
    
    // Input pane (left side)
    const inputPane = mainContent.createDiv('slack-preview-input');
    inputPane.style.flex = '1';
    inputPane.style.display = 'flex';
    inputPane.style.flexDirection = 'column';
    inputPane.style.overflow = 'hidden';
    inputPane.style.minWidth = '0';
    
    // Add a label for the input pane
    const inputLabel = inputPane.createDiv('slack-preview-input-label');
    inputLabel.style.marginBottom = '0.5rem';
    inputLabel.createEl('h3', { text: 'Raw Slack Content' });
    
    this.textArea = new TextAreaComponent(inputPane);
    this.textArea.inputEl.style.width = '100%';
    this.textArea.inputEl.style.height = '100%';
    this.textArea.inputEl.style.resize = 'none';
    this.textArea.inputEl.style.padding = '1rem';
    this.textArea.inputEl.style.border = '1px solid var(--background-modifier-border)';
    this.textArea.inputEl.style.borderRadius = '4px';
    this.textArea.inputEl.style.overflow = 'auto';
    
    // Preview pane (right side)
    const previewPane = mainContent.createDiv('slack-preview-output');
    previewPane.style.flex = '1';
    previewPane.style.overflow = 'hidden';
    previewPane.style.display = 'flex';
    previewPane.style.flexDirection = 'column';
    previewPane.style.minWidth = '0';
    
    // Add a label for the preview pane
    const previewLabel = previewPane.createDiv('slack-preview-output-label');
    previewLabel.style.marginBottom = '0.5rem';
    previewLabel.createEl('h3', { text: 'Formatted Preview' });
    
    const previewScroll = previewPane.createDiv('preview-scroll-container');
    previewScroll.style.overflow = 'auto';
    previewScroll.style.flex = '1';
    previewScroll.style.padding = '1rem';
    previewScroll.style.border = '1px solid var(--background-modifier-border)';
    previewScroll.style.borderRadius = '4px';
    previewScroll.style.backgroundColor = 'var(--background-secondary)';
    
    this.previewEl = previewScroll.createDiv('preview-content');
    
    // Set initial content
    this.textArea.setValue(this.rawText);
    
    this.textArea.inputEl.addEventListener('input', () => {
      this.updatePreview();
    });
    
    this.updatePreview();
  }
  
  onClose() {
    this.contentEl.empty();
  }
  
  private updatePreview() {
    try {
      const raw = this.textArea.getValue();
      
      // Fix emoji issues before previewing
      const fixedText = this.formatter.fixEmojiFormatting(raw);
      
      // Generate formatted output
      let output = this.formatter.formatSlackContent(fixedText);
      
      // Apply syntax highlighting to code blocks
      output = output.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        try {
          return `<pre class="language-${lang || 'text'}">${code}</pre>`;
        } catch (e) {
          return match;
        }
      });
      
      // Format the YAML frontmatter for better preview
      output = output.replace(/^---\n([\s\S]*?)---/m, (match, yaml) => {
        return `<div class="yaml-frontmatter" style="color: var(--text-faint); background: var(--background-primary-alt); padding: 8px; border-radius: 4px; margin-bottom: 10px;">---\n${yaml}---</div>`;
      });
      
      // Apply styles to callouts
      output = output.replace(/>\[!note\]\+\s+(.*?)$/gm, (match, title) => {
        return `<div class="callout" style="background: var(--background-primary-alt); border-left: 4px solid var(--text-accent); padding: 8px; margin-bottom: 10px;"><div class="callout-title" style="font-weight: bold;">${title}</div>`;
      });
      
      // Convert > lines to styled blockquotes
      output = output.replace(/^>\s(.*)$/gm, '<div class="blockquote" style="padding-left: 8px; color: var(--text-normal);">$1</div>');
      
      this.previewEl.innerHTML = output;
    } catch (error) {
      console.error("Error updating preview:", error);
      this.previewEl.innerHTML = `<div style="color: red">Error formatting content: ${error.message}</div>`;
    }
  }
}

/**
 * Modal for paste confirmation
 */
export class PasteConfirmationModal extends Modal {
  callback: (result: boolean) => void;

  constructor(app: App, callback: (result: boolean) => void) {
    super(app);
    this.callback = callback;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Format Slack Content?' });
    contentEl.createEl('p', { text: 'This text appears to be from Slack. Would you like to format it as a structured Obsidian note?' });
    
    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.gap = '10px';

    new ButtonComponent(buttonContainer)
      .setButtonText('Cancel')
      .onClick(() => {
        this.callback(false);
        this.close();
      });

    new ButtonComponent(buttonContainer)
      .setButtonText('Format')
      .setCta()
      .onClick(() => {
        this.callback(true);
        this.close();
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}