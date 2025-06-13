/**
 * Obsidian Slack Formatter Plugin
 * @version 1.0.0
 * Author: Alex Mittell
 * 
 * Formats Slack conversations pasted into Obsidian
 */
import { Plugin, Editor, Notice, Menu, MenuItem } from 'obsidian';
import { SlackFormatter } from './formatter/slack-formatter';
import { DEFAULT_SETTINGS } from './settings';
import { SlackFormatSettingTab } from './ui/settings-tab';
import { ConfirmSlackModal, SlackPreviewModal } from './ui/modals';
import { SlackFormatSettings } from './types/settings.types'; // Corrected import path
import { parseJsonMap } from './utils'; // Import the centralized utility
import { Logger } from './utils/logger';

export default class SlackFormatPlugin extends Plugin {
  settings!: SlackFormatSettings; // Corrected type name
  formatter!: SlackFormatter;

  async onload(): Promise<void> {
    Logger.info('SlackFormatPlugin', 'Loading Slack formatter plugin v1.0.0');

    // Load settings
    await this.loadSettings();

    // Initialize formatter
    this.initFormatter();

    // Add settings tab
    this.addSettingTab(new SlackFormatSettingTab(this.app, this));

    // Register commands using helper methods
    this.registerHotkeyCommand();
    this.registerPaletteCommand();
    this.registerContextMenu();

    // Removed 'editor-paste' event listener registration
    // Removed direct keydown event listener
  }

  /**
   * Initialize the formatter with current settings
   */
  private initFormatter(): void {
    try {
      Logger.info('SlackFormatPlugin', 'Initializing formatter...');
      let errorOccurred = false;
      
      // Parse the JSON maps using the utility function, handling potential nulls
      const userMapResult = parseJsonMap(this.settings.userMapJson || '{}', 'User Map');
      const emojiMapResult = parseJsonMap(this.settings.emojiMapJson || '{}', 'Emoji Map');
      const userMap = userMapResult ?? {};
      const emojiMap = emojiMapResult ?? {};

      // Show specific notices if parsing failed for any map
      if (userMapResult === null) {
          new Notice("Error parsing User Map JSON from settings. Mentions may not work correctly.");
          errorOccurred = true;
      }
      if (emojiMapResult === null) {
          new Notice("Error parsing Emoji Map JSON from settings. Custom emojis may not work correctly.");
          errorOccurred = true;
      }
      
      // Create formatter, passing settings and potentially empty maps if parsing failed
      this.formatter = new SlackFormatter(this.settings, userMap, emojiMap);
      
      if (!errorOccurred) {
          Logger.info('SlackFormatPlugin', 'Slack formatter initialized successfully');
      } else {
          Logger.warn('SlackFormatPlugin', 'Slack formatter initialized with potential map parsing errors.');
      }
      
    } catch (error) { // Catch any unexpected errors during initialization itself
      Logger.error('SlackFormatPlugin', 'Unexpected error during formatter initialization:', error);
      // Fallback to ensure formatter is always assigned, even if constructor fails unexpectedly
      this.formatter = new SlackFormatter(
        { ...this.settings },
        {}, {}
      );
      new Notice("Critical Error: Formatter initialization failed unexpectedly. Using default settings.");
    }
  }

  // Removed local parseJsonMap method (now using utility)
 
  // Removed handlePasteEvent method

  /**
   * Format text and insert it into the editor
   */
  private formatAndInsert(editor: Editor, text: string): void {
    try {
      if (!text) {
        new Notice("No text to format");
        return;
      }
      
      Logger.info('SlackFormatPlugin', 'Attempting to format text', text.substring(0, 100) + '...');

      // Handle auto-detect mode with confirmation dialog
      if (this.settings.hotkeyMode === 'interceptCmdV' && this.formatter.isLikelySlack(text)) {
          if (this.settings.enableConfirmationDialog) {
              new ConfirmSlackModal(
                  this.app,
                  (confirmed) => {
                      if (confirmed) {
                          this.performFormatting(editor, text);
                      }
                      // If not confirmed, do nothing
                  }
              ).open();
              return; // Wait for modal confirmation
          }
          // If confirmation is disabled, proceed directly
      } else if (this.settings.hotkeyMode === 'interceptCmdV' && !this.formatter.isLikelySlack(text)) {
          // If intercept mode is on but text isn't likely Slack, do nothing (allow normal paste)
          editor.replaceSelection(text); // Perform normal paste
          return;
      }
      
      // Proceed with formatting for cmdShiftV mode or if intercept checks passed
      this.performFormatting(editor, text);

    } catch (error) {
      Logger.error('SlackFormatPlugin', 'Error in formatAndInsert:', error);
      new Notice("Error formatting Slack text");
    }
  }

  /**
   * Performs the actual formatting and insertion/preview
   */
   private performFormatting(editor: Editor, text: string): void {
    try {
        // If preview pane is enabled, show the preview first
        if (this.settings.enablePreviewPane) {
            new SlackPreviewModal(
                this.app,
                text,
                (formattedText) => {
                    if (formattedText) {
                        editor.replaceSelection(formattedText);
                        if (this.settings.showSuccessMessage) {
                            new Notice("Slack message formatted!");
                        }
                    }
                },
                this.formatter // Pass the formatter instance
            ).open();
        } else {
            // Otherwise format directly
            const formattedText = this.formatter.formatSlackContent(text);
            editor.replaceSelection(formattedText);
            if (this.settings.showSuccessMessage) {
                new Notice("Slack message formatted!");
            }
        }
    } catch (error) {
        Logger.error('SlackFormatPlugin', 'Error during performFormatting:', error);
        new Notice("Error applying Slack formatting.");
    }
}

  /**
   * Reads text content from the system clipboard.
   * Handles errors and displays a notice to the user.
   * @returns The clipboard content as a string, or null if reading fails.
   */
  private async getClipboardContent(): Promise<string | null> {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      Logger.error('SlackFormatPlugin', 'Error reading clipboard:', error);
      new Notice("Error reading clipboard content. Check permissions?");
      return null;
    }
  }


  /**
   * Format with YAML frontmatter
   */
  public formatWithFrontmatter(text: string): string {
    return this.formatter.buildNoteWithFrontmatter(text);
  }

  onunload(): void {
    Logger.info('SlackFormatPlugin', 'Unloading Slack formatter plugin');
    // No need to manually remove listeners added via registerEvent
  }

  async loadSettings(): Promise<void> {
    try {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    } catch (error) {
      Logger.error('SlackFormatPlugin', 'Error loading settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Re-initialize the formatter with new settings and re-parsed maps
    this.initFormatter(); 
  }

  // --- Command Registration Methods ---

  private registerHotkeyCommand(): void {
    this.addCommand({
      id: 'format-slack-paste-hotkey',
      name: 'Format Slack paste with hotkey',
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "v",
        },
      ],
      editorCallback: async (editor: Editor) => {
        const clipboardContent = await this.getClipboardContent();
        if (clipboardContent !== null) { // Check if reading was successful
          this.formatAndInsert(editor, clipboardContent);
        }
        // Error handling is now inside getClipboardContent
      }
    });
  }

  private registerPaletteCommand(): void {
    this.addCommand({
      id: 'format-slack',
      name: 'Format Slack paste',
      icon: 'clipboard-list',
      editorCallback: async (editor: Editor) => {
        const clipboardContent = await this.getClipboardContent();
        if (clipboardContent !== null) { // Check if reading was successful
          this.formatAndInsert(editor, clipboardContent);
        }
        // Error handling is now inside getClipboardContent
      }
    });
  }

  private registerContextMenu(): void {
    this.registerEvent(
      this.app.workspace.on(
        'editor-menu',
        (menu: Menu, editor: Editor) => {
          menu.addItem((item: MenuItem) => {
            item
              .setTitle('Format as Slack conversation')
              .setIcon('clipboard-list')
              .onClick(async () => {
                const selection = editor.getSelection();
                if (selection) {
                  this.formatAndInsert(editor, selection);
                } else {
                  // Use the helper method to read clipboard
                  const clipboardContent = await this.getClipboardContent();
                  if (clipboardContent !== null) { // Check if reading was successful
                    this.formatAndInsert(editor, clipboardContent);
                  }
                  // Error handling is now inside getClipboardContent
                }
              });
          });
        }
      )
    );
  }
}
