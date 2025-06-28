/**
 * Base modal class with common functionality for all plugin modals
 */
import { App, Modal, ButtonComponent } from 'obsidian'; // Import ButtonComponent

export abstract class BaseModal extends Modal {
  constructor(app: App) {
    super(app);
    this.modalEl.addClass('slack-formatter-modal');
  }

  protected applyModalStyles(isPreview: boolean = false): void {
    if (isPreview) {
      this.modalEl.addClass('preview');
    }
  }

  protected createButtonContainer(): HTMLElement {
    // Create the container within contentEl, not modalEl
    return this.contentEl.createDiv('button-container');
  }

  // Updated to return ButtonComponent
  protected createButton(container: HTMLElement, text: string, primary = false): ButtonComponent {
    const button = new ButtonComponent(container) // Create ButtonComponent in the provided container
      .setButtonText(text);

    if (primary) {
      button.setCta(); // Use setCta for primary button styling
    } else {
      // No specific class needed for default/warning button style via ButtonComponent
      // button.setWarning(); // Use this if a warning style is explicitly desired
    }
    return button;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
