/**
 * Settings tab for Slack Formatter plugin
 */
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type SlackFormatPlugin from '../main';

export class SlackFormatSettingTab extends PluginSettingTab {
  plugin: SlackFormatPlugin;
  
  constructor(app: App, plugin: SlackFormatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Slack Format Plugin (Callout Style)' });
    
    // General settings section
    containerEl.createEl('h3', { text: 'General Settings' });
    
    new Setting(containerEl)
      .setName('Hotkey Behavior')
      .setDesc('Use Cmd+Shift+V or intercept normal Cmd+V if Slack text is detected')
      .addDropdown(dd => {
        dd.addOption('cmdShiftV', 'Cmd+Shift+V (default)');
        dd.addOption('interceptCmdV', 'Intercept Cmd+V');
        dd.setValue(this.plugin.settings.hotkeyMode);
        dd.onChange(async (val) => {
          this.plugin.settings.hotkeyMode = val as 'cmdShiftV' | 'interceptCmdV';
          await this.plugin.saveSettings();
          new Notice('Hotkey setting changed. Reload or toggle plugin to apply.');
        });
      });
    
    new Setting(containerEl)
      .setName('Confirmation Dialog on Intercept')
      .setDesc('Ask the user if they want to convert Slack text when intercepting Cmd+V.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enableConfirmationDialog);
        tg.onChange(async (val) => {
          this.plugin.settings.enableConfirmationDialog = val;
          await this.plugin.saveSettings();
        });
      });
    
    new Setting(containerEl)
      .setName('Enable Preview Pane')
      .setDesc('Show a real-time preview modal before inserting Slack text.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enablePreviewPane);
        tg.onChange(async (val) => {
          this.plugin.settings.enablePreviewPane = val;
          await this.plugin.saveSettings();
        });
      });
    
    new Setting(containerEl)
      .setName('Time Zone')
      .setDesc('Time zone for date/time formatting (e.g., America/New_York)')
      .addText(text => {
        text.setValue(this.plugin.settings.timeZone);
        text.onChange(async (val) => {
          this.plugin.settings.timeZone = val;
          await this.plugin.saveSettings();
        });
      });
      
    new Setting(containerEl)
      .setName('Max lines to process')
      .setDesc('Truncate Slack paste if it exceeds this limit.')
      .addText(txt => {
        txt.setValue(String(this.plugin.settings.maxLines));
        txt.onChange(async (val) => {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num > 0) {
            this.plugin.settings.maxLines = num;
            await this.plugin.saveSettings();
          } else {
            new Notice('Invalid max lines value.');
          }
        });
      });
    
    // Thread display settings
    containerEl.createEl('h3', { text: 'Thread Display' });
    
    new Setting(containerEl)
      .setName('Collapse Long Threads')
      .setDesc('Automatically collapse threads with many replies')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.collapseThreads);
        tg.onChange(async (val) => {
          this.plugin.settings.collapseThreads = val;
          await this.plugin.saveSettings();
        });
      });
    
    new Setting(containerEl)
      .setName('Thread Collapse Threshold')
      .setDesc('Number of replies before collapsing a thread')
      .addText(text => {
        text.setValue(String(this.plugin.settings.threadCollapseThreshold));
        text.onChange(async (val) => {
          const num = parseInt(val);
          if (!isNaN(num) && num > 0) {
            this.plugin.settings.threadCollapseThreshold = num;
            await this.plugin.saveSettings();
          }
        });
      });
    
    // Content formatting settings
    containerEl.createEl('h3', { text: 'Content Formatting' });
    
    new Setting(containerEl)
      .setName('Detect & Preserve Code Blocks')
      .setDesc('If enabled, lines starting with ``` become code fences.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enableCodeBlocks);
        tg.onChange(async (val) => {
          this.plugin.settings.enableCodeBlocks = val;
          await this.plugin.saveSettings();
        });
      });
    
    new Setting(containerEl)
      .setName('@username => [[username]]')
      .setDesc('Convert Slack mentions into Obsidian wikilinks.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enableMentions);
        tg.onChange(async (val) => {
          this.plugin.settings.enableMentions = val;
          await this.plugin.saveSettings();
        });
      });
    
    new Setting(containerEl)
      .setName('Convert :emoji: => actual emoji')
      .setDesc('Use an emoji map to replace Slack :smile: with 😄, etc.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enableEmoji);
        tg.onChange(async (val) => {
          this.plugin.settings.enableEmoji = val;
          await this.plugin.saveSettings();
        });
      });
    
    new Setting(containerEl)
      .setName('Parse Slack Times & Dates')
      .setDesc('Convert "10:25 AM" into local date/time and detect lines like "Feb 2, 2025".')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enableTimestampParsing);
        tg.onChange(async (val) => {
          this.plugin.settings.enableTimestampParsing = val;
          await this.plugin.saveSettings();
        });
      });
    
    new Setting(containerEl)
      .setName('Highlight Slack Threads')
      .setDesc('If Slack text references "View thread", create a clickable link if URL is present.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enableSubThreadLinks);
        tg.onChange(async (val) => {
          this.plugin.settings.enableSubThreadLinks = val;
          await this.plugin.saveSettings();
        });
      });
    
    // Mapping sections
    containerEl.createEl('h3', { text: 'Slack User ID → Name Map' });
    
    new Setting(containerEl)
      .setName('User Map (JSON)')
      .setDesc('Map "<@U123>" => "[[Alice]]". Example: { "U123":"Alice" }')
      .addTextArea(txt => {
        txt.setValue(this.plugin.settings.userMapJson);
        txt.inputEl.rows = 6;
        txt.inputEl.style.width = '100%';
        txt.onChange(async (val) => {
          this.plugin.settings.userMapJson = val;
          await this.plugin.saveSettings();
          this.plugin.parseJsonMaps();
        });
      });
    
    containerEl.createEl('h3', { text: 'Slack Channel ID → Channel Name Map' });
    
    new Setting(containerEl)
      .setName('Channel Map (JSON)')
      .setDesc('Map "#C01234" => "[[#general]]". Example: { "C01234": "general" }')
      .addTextArea(txt => {
        txt.setValue(this.plugin.settings.channelMapJson);
        txt.inputEl.rows = 6;
        txt.inputEl.style.width = '100%';
        txt.onChange(async (val) => {
          this.plugin.settings.channelMapJson = val;
          await this.plugin.saveSettings();
          this.plugin.parseJsonMaps();
        });
      });
    
    containerEl.createEl('h3', { text: 'Emoji Map (JSON)' });
    
    new Setting(containerEl)
      .setName('Emoji Map')
      .setDesc('Map :smile: => actual emoji. Example: { "smile":"😄" }')
      .addTextArea(txt => {
        txt.setValue(this.plugin.settings.emojiMapJson);
        txt.inputEl.rows = 6;
        txt.inputEl.style.width = '100%';
        txt.onChange(async (val) => {
          this.plugin.settings.emojiMapJson = val;
          await this.plugin.saveSettings();
          this.plugin.parseJsonMaps();
        });
      });
  }
}