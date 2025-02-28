/**
 * Obsidian Slack Formatter Plugin
 * @version 0.1.0
 * Author: Alex Mittell
 * 
 * Formats Slack conversations pasted into Obsidian
 */
import {
  App,
  Editor,
  Notice,
  Plugin,
  TFile
} from 'obsidian';

import { SlackFormatSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { SlackFormatter } from './formatter';
import { SlackFormatSettingTab } from './ui/settings-tab';
import { ConfirmSlackModal, SlackPreviewModal } from './ui/modals';

export default class SlackFormatPlugin extends Plugin {
  settings: SlackFormatSettings;
  userMap: Record<string, string> = {};
  emojiMap: Record<string, string> = {};
  channelMap: Record<string, string> = {};
  formatter: SlackFormatter;

  async onload() {
    console.log("Loading SlackFormatPlugin...");
    
    // Load settings
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.parseJsonMaps();
    
    // Initialize formatter
    this.formatter = new SlackFormatter(
      this.settings, 
      this.userMap, 
      this.emojiMap, 
      this.channelMap
    );
    
    // Add settings tab
    this.addSettingTab(new SlackFormatSettingTab(this.app, this));
    
    // Set up commands based on hotkey mode
    this.setupCommands();
  }

  onunload() {
    console.log("Unloading SlackFormatPlugin...");
  }

  /**
   * Set up plugin commands based on settings
   */
  private setupCommands() {
    // Format and paste command
    if (this.settings.hotkeyMode === 'cmdShiftV') {
      this.addCommand({
        id: 'format-slack-paste',
        name: 'Format and Paste Slack Thread (Cmd+Shift+V)',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'v' }],
        editorCallback: async (editor: Editor) => {
          await this.handleFormatAndPaste(editor);
        }
      });
    } else {
      // Intercept normal paste
      this.registerEvent(
        this.app.workspace.on('editor-paste', async (evt: ClipboardEvent, editor: Editor) => {
          if (!evt.clipboardData) return true;
          
          const text = evt.clipboardData.getData('text/plain');
          if (!text || !this.formatter.isLikelySlack(text)) {
            return true; // Allow default paste for non-Slack content
          }
          
          // Prevent default paste action
          evt.preventDefault();
          
          // Handle our custom paste
          if (this.settings.enableConfirmationDialog) {
            const confirmed = await this.askSlackConversion();
            if (!confirmed) {
              // Just do normal paste if declined
              editor.replaceSelection(text);
              return false;
            }
          }
          
          // Now paste with formatting
          await this.handleFormatAndPaste(editor, text);
          return false;
        })
      );
    }
    
    // Create new note command
    this.addCommand({
      id: 'format-slack-create-note',
      name: 'Format Slack & Create Dated Note (YAML Frontmatter)',
      callback: async () => {
        await this.handleCreateSlackNote();
      }
    });
  }
  
  /**
   * Handle the format and paste operation
   */
  private async handleFormatAndPaste(editor: Editor, text?: string) {
    if (this.settings.enablePreviewPane) {
      new SlackPreviewModal(this.app, this, editor, text).open();
      return;
    }
    
    try {
      // Get text from clipboard if not provided
      if (!text) {
        text = await navigator.clipboard.readText();
      }
      
      // Fix emoji issues and format the content
      text = this.fixEmojiFormattingIssues(text);
      
      const formatted = this.formatter.buildNoteWithFrontmatter(text);
      editor.replaceSelection(formatted);
    } catch (err) {
      console.error('Slack Format Plugin Error:', err);
      new Notice('Failed to process clipboard content.');
    }
  }
  
  /**
   * Handle creating a new note from Slack content
   */
  private async handleCreateSlackNote() {
    if (this.settings.enablePreviewPane) {
      new SlackPreviewModal(this.app, this, null, null, true).open();
      return;
    }
    
    try {
      const text = await navigator.clipboard.readText();
      
      // Quick check if it looks like Slack
      if (!text || !this.formatter.isLikelySlack(text)) {
        new Notice('Clipboard content doesn\'t appear to be from Slack.');
        return;
      }
      
      // Fix emoji issues
      const fixedText = this.fixEmojiFormattingIssues(text);
      
      // Format and create the note
      const noteContent = this.formatter.buildNoteWithFrontmatter(fixedText);
      await this.createUniqueNote(noteContent);
    } catch (err) {
      console.error('Slack Format Plugin Error:', err);
      new Notice("Failed to create Slack note from clipboard text.");
    }
  }
  
  /**
   * Fix all known emoji formatting issues in Slack text
   */
  private fixEmojiFormattingIssues(text: string): string {
    // Use the formatter's method first
    let result = this.formatter.fixEmojiFormatting(text);
    
    // Additional fixes for edge cases
    
    // Fix numerical emoji reactions (![:emoji:]27)
    result = result.replace(/!\[:([a-z0-9_\-\+]+):\](\d+)/g, (_, name, count) => {
      return `:${name}: ${count}`;
    });
    
    // Fix bracketed emoji with exclamation (![:emoji:])
    result = result.replace(/!\[:([a-z0-9_\-\+]+):\]/g, (_, name) => {
      return `:${name}:`;
    });
    
    // Fix bracketed emoji format ([:emoji:])
    result = result.replace(/\[:([a-z0-9_\-\+]+):\]/g, (_, name) => {
      return `:${name}:`;
    });
    
    return result;
  }
  
  /**
   * Check if text is likely from Slack
   */
  isLikelySlack(text: string): boolean {
    // Delegate to formatter's detection logic
    return this.formatter.isLikelySlack(text);
  }
  
  /**
   * Format Slack content into Obsidian Markdown
   */
  formatSlackContent(input: string): string {
    // Fix emoji issues first
    input = this.fixEmojiFormattingIssues(input);
    
    return this.formatter.formatSlackContent(input);
  }
  
  /**
   * Build a note with YAML frontmatter
   */
  buildNoteWithFrontmatter(rawText: string): string {
    // Fix emoji issues first
    rawText = this.fixEmojiFormattingIssues(rawText);
    
    return this.formatter.buildNoteWithFrontmatter(rawText);
  }
  
  /**
   * Parse JSON maps from settings
   */
  parseJsonMaps() {
    try {
      this.userMap = JSON.parse(this.settings.userMapJson);
    } catch (err) {
      console.warn("Failed to parse userMap JSON.", err);
      this.userMap = {};
    }
    
    try {
      this.emojiMap = JSON.parse(this.settings.emojiMapJson);
      
      // Make sure common emojis are included
      const defaultEmojis = {
        "bufo-ty": "🙏",
        "bufo-thinking": "🤔",
        "bufo-lol-cry": "😭",
        "pika-aww": "😍",
        "so-beautiful": "🤩",
        "nice5": "👍",
        "bufo-cowboy": "🤠",
        "bufoyes": "👍",
        "pray": "🙏",
        "no_entry": "⛔"
      };
      this.emojiMap = {...defaultEmojis, ...this.emojiMap};
      
    } catch (err) {
      console.warn("Failed to parse emojiMap JSON.", err);
      this.emojiMap = {
        "bufo-ty": "🙏",
        "bufo-thinking": "🤔",
        "bufo-lol-cry": "😭",
        "pika-aww": "😍",
        "so-beautiful": "🤩",
        "nice5": "👍",
        "bufo-cowboy": "🤠",
        "bufoyes": "👍",
        "pray": "🙏",
        "no_entry": "⛔"
      };
    }
    
    try {
      this.channelMap = JSON.parse(this.settings.channelMapJson);
    } catch (err) {
      console.warn("Failed to parse channelMap JSON.", err);
      this.channelMap = {};
    }
    
    // Update formatter with new maps if it exists
    if (this.formatter) {
      this.formatter = new SlackFormatter(
        this.settings, 
        this.userMap, 
        this.emojiMap, 
        this.channelMap
      );
    }
  }
  
  /**
   * Create a new note with a unique name
   */
  async createUniqueNote(content: string) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const baseName = `Slack-${dateStr}.md`;
    let finalName = baseName;
    let counter = 1;
    
    while (this.app.vault.getAbstractFileByPath(finalName)) {
      finalName = baseName.replace('.md', `-${counter}.md`);
      counter++;
    }
    
    const newFile = await this.app.vault.create(finalName, content);
    await this.app.workspace.getLeaf(true).openFile(newFile as TFile);
  }
  
  /**
   * Show confirmation dialog for Slack conversion
   */
  async askSlackConversion(): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = new ConfirmSlackModal(this.app, resolve);
      dialog.open();
    });
  }
  
  /**
   * Save plugin settings
   */
  async saveSettings() {
    await this.saveData(this.settings);
    
    // Refresh maps
    this.parseJsonMaps();
  }
}
