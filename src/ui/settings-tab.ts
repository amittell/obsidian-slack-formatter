/**
 * Settings tab for Slack Formatter plugin
 */
import { App, PluginSettingTab, Setting, Notice, TextComponent, TextAreaComponent } from 'obsidian';
import type SlackFormatPlugin from '../main';
import { isValidJson } from '../utils'; // Import the centralized utility

export class SlackFormatSettingTab extends PluginSettingTab {
  plugin: SlackFormatPlugin;

  constructor(app: App, plugin: SlackFormatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Helper to display validation errors
  private setError(inputEl: HTMLElement, messageEl: HTMLElement, message: string | null): void {
    if (message) {
      inputEl.addClass('is-invalid');
      messageEl.setText(message);
      messageEl.addClass('is-visible');
    } else {
      inputEl.removeClass('is-invalid');
      messageEl.removeClass('is-visible');
      messageEl.setText('');
    }
  }

  // Removed local isValidJson method (now using utility)

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Slack Format Plugin Settings' }); // Updated title

    // --- General settings section ---
    containerEl.createEl('h3', { text: 'General Settings' });

    new Setting(containerEl)
      .setName('Hotkey Behavior')
      .setDesc(
        'Choose how formatting is triggered: assign your own hotkey or intercept the standard paste command.'
      )
      .addDropdown(dd => {
        dd.addOption('dedicatedHotkey', 'Dedicated hotkey (set via Obsidian Hotkeys)');
        dd.addOption('interceptCmdV', 'Intercept Cmd/Ctrl+V (Auto-detect)');
        dd.setValue(this.plugin.settings.hotkeyMode);
        dd.onChange(async val => {
          this.plugin.settings.hotkeyMode = val as 'dedicatedHotkey' | 'interceptCmdV';
          await this.plugin.saveSettings();
          // Removed notice about reloading, as event listeners might update dynamically or command registration handles it.
        });
      });

    new Setting(containerEl)
      .setName('Confirmation Dialog on Intercept')
      .setDesc('When intercepting Cmd/Ctrl+V, ask before formatting likely Slack content.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enableConfirmationDialog);
        tg.onChange(async val => {
          this.plugin.settings.enableConfirmationDialog = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Enable Preview Pane')
      .setDesc('Show a preview modal before inserting formatted content.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.enablePreviewPane);
        tg.onChange(async val => {
          this.plugin.settings.enablePreviewPane = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Time Zone')
      .setDesc(
        'Optional: Specify IANA time zone for date/time formatting (e.g., "America/New_York", "Europe/London"). Leave blank to use local time.'
      )
      .addText(text => {
        text.setPlaceholder('e.g., America/New_York');
        text.setValue(this.plugin.settings.timeZone);
        text.onChange(async val => {
          // Basic validation: just save the value. Actual validation happens in formatDateWithZone.
          this.plugin.settings.timeZone = val.trim();
          await this.plugin.saveSettings();
        });
      });

    // Max Lines Setting with Validation
    const maxLinesSetting = new Setting(containerEl)
      .setName('Max lines to process')
      .setDesc(
        'Maximum number of lines to process from a paste. Helps prevent performance issues with very large inputs.'
      );
    const maxLinesErrorEl = maxLinesSetting.controlEl.createDiv({ cls: 'setting-error-message' }); // Element for error message
    maxLinesSetting.addText(txt => {
      txt.setValue(String(this.plugin.settings.maxLines));
      txt.onChange(async val => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) {
          this.setError(txt.inputEl, maxLinesErrorEl, null); // Clear error
          this.plugin.settings.maxLines = num;
          await this.plugin.saveSettings();
        } else {
          this.setError(txt.inputEl, maxLinesErrorEl, 'Must be a positive number.'); // Show error
          // Do not save invalid value
        }
      });
    });

    // --- Thread display settings ---
    containerEl.createEl('h3', { text: 'Thread Display' });

    new Setting(containerEl)
      .setName('Collapse Long Threads')
      .setDesc('Automatically collapse threads exceeding the threshold below.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.collapseThreads);
        tg.onChange(async val => {
          this.plugin.settings.collapseThreads = val;
          await this.plugin.saveSettings();
        });
      });

    // Thread Collapse Threshold with Validation
    const threadThresholdSetting = new Setting(containerEl)
      .setName('Thread Collapse Threshold')
      .setDesc('Number of replies before collapsing a thread (if enabled above).');
    const threadThresholdErrorEl = threadThresholdSetting.controlEl.createDiv({
      cls: 'setting-error-message',
    });
    threadThresholdSetting.addText(text => {
      text.setValue(String(this.plugin.settings.threadCollapseThreshold));
      text.onChange(async val => {
        const num = parseInt(val);
        if (!isNaN(num) && num > 0) {
          this.setError(text.inputEl, threadThresholdErrorEl, null); // Clear error
          this.plugin.settings.threadCollapseThreshold = num;
          await this.plugin.saveSettings();
        } else {
          this.setError(text.inputEl, threadThresholdErrorEl, 'Must be a positive number.'); // Show error
          // Do not save invalid value
        }
      });
    });

    // --- Content formatting settings ---
    containerEl.createEl('h3', { text: 'Content Formatting' });

    new Setting(containerEl)
      .setName('Detect & Preserve Code Blocks')
      .setDesc('Format lines within ```...``` as code blocks.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.detectCodeBlocks);
        tg.onChange(async val => {
          this.plugin.settings.detectCodeBlocks = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Format Mentions')
      .setDesc('Convert Slack mentions (@User, #Channel) using the maps below.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.convertUserMentions);
        tg.onChange(async val => {
          this.plugin.settings.convertUserMentions = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Format Emojis')
      .setDesc('Convert Slack emoji codes (e.g., :smile:) to characters using the map below.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.replaceEmoji);
        tg.onChange(async val => {
          this.plugin.settings.replaceEmoji = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Parse Slack Times & Dates')
      .setDesc('Attempt to parse timestamps (e.g., "10:25 AM") and date lines.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.parseSlackTimes);
        tg.onChange(async val => {
          this.plugin.settings.parseSlackTimes = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Format Thread Links')
      .setDesc('Make "View thread" or similar text clickable if a URL is detected.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.highlightThreads);
        tg.onChange(async val => {
          this.plugin.settings.highlightThreads = val;
          await this.plugin.saveSettings();
        });
      });

    // --- Frontmatter Settings ---
    containerEl.createEl('h3', { text: 'Frontmatter Output' });

    new Setting(containerEl)
      .setName('Frontmatter CSS Class')
      .setDesc('CSS class to add to the frontmatter (e.g., for styling).')
      .addText(text => {
        text.setValue(this.plugin.settings.frontmatterCssClass);
        text.onChange(async val => {
          this.plugin.settings.frontmatterCssClass = val.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Frontmatter Title')
      .setDesc(
        'Markdown title to add below the frontmatter (e.g., "# Slack Conversation"). Leave blank for no title.'
      )
      .addText(text => {
        text.setValue(this.plugin.settings.frontmatterTitle);
        text.onChange(async val => {
          this.plugin.settings.frontmatterTitle = val.trim();
          await this.plugin.saveSettings();
        });
      });

    // --- Mapping sections ---
    containerEl.createEl('h3', { text: 'Mapping Rules (JSON Format)' });

    // User Map with Validation
    const userMapSetting = new Setting(containerEl)
      .setName('User Map')
      .setDesc('Map Slack User IDs (<@U...>) to Obsidian links or names.');
    const userMapErrorEl = userMapSetting.controlEl.createDiv({ cls: 'setting-error-message' });
    userMapSetting.addTextArea(txt => {
      txt.setPlaceholder('{\n  "U123ABC": "[[Alice]]",\n  "U456DEF": "Bob"\n}');
      txt.setValue(this.plugin.settings.userMapJson);
      txt.inputEl.rows = 6;
      txt.inputEl.addClass('full-width');
      txt.onChange(async val => {
        if (isValidJson(val)) {
          // Use imported function
          this.setError(txt.inputEl, userMapErrorEl, null); // Clear error
          this.plugin.settings.userMapJson = val;
          await this.plugin.saveSettings();
        } else {
          this.setError(txt.inputEl, userMapErrorEl, 'Invalid JSON format.'); // Show error
          // Do not save invalid value
        }
      });
    });

    // Removed Channel Map setting - Unused feature

    // Emoji Map with Validation
    const emojiMapSetting = new Setting(containerEl)
      .setName('Emoji Map')
      .setDesc('Map Slack emoji codes (:code:) to replacement characters.');
    const emojiMapErrorEl = emojiMapSetting.controlEl.createDiv({ cls: 'setting-error-message' });
    emojiMapSetting.addTextArea(txt => {
      txt.setPlaceholder('{\n  "smile": "😄",\n  "+1": "👍",\n  "bufo-thumbsup": "👍"\n}');
      txt.setValue(this.plugin.settings.emojiMapJson);
      txt.inputEl.rows = 6;
      txt.inputEl.addClass('full-width');
      txt.onChange(async val => {
        if (isValidJson(val)) {
          // Use imported function
          this.setError(txt.inputEl, emojiMapErrorEl, null); // Clear error
          this.plugin.settings.emojiMapJson = val;
          await this.plugin.saveSettings();
        } else {
          this.setError(txt.inputEl, emojiMapErrorEl, 'Invalid JSON format.'); // Show error
          // Do not save invalid value
        }
      });
    });

    // --- Debug Settings ---
    containerEl.createEl('h3', { text: 'Debugging' });

    new Setting(containerEl)
      .setName('Enable Debug Logging')
      .setDesc('Log detailed information to the developer console.')
      .addToggle(tg => {
        tg.setValue(this.plugin.settings.debug ?? false); // Provide default value for optional setting
        tg.onChange(async val => {
          this.plugin.settings.debug = val;
          await this.plugin.saveSettings();
        });
      });
  }
}
