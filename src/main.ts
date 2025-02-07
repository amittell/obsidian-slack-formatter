/**
 * Formats Slack conversations pasted into Obsidian
 * @version 0.0.4
 * Author: Alex Mittell
 */

import {
  App,
  Editor,
  Notice,
  Modal,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  ButtonComponent,
  TextAreaComponent,
} from 'obsidian';

interface ThreadStats {
  messageCount: number;
  uniqueUsers: number;
  threadCount: number;
  dateRange: string;
  mostActiveUser?: string;
}

interface SlackFormatSettings {
  enableCodeBlocks: boolean;
  enableMentions: boolean;
  enableEmoji: boolean;
  enableTimestampParsing: boolean;
  enableSubThreadLinks: boolean;
  userMapJson: string;
  emojiMapJson: string;
  channelMapJson: string;
  hotkeyMode: 'cmdShiftV' | 'interceptCmdV';
  maxLines: number;
  enablePreviewPane: boolean;
  enableConfirmationDialog: boolean;
  timeZone: string;
  collapseThreads: boolean;
  threadCollapseThreshold: number;
}

const DEFAULT_SETTINGS: SlackFormatSettings = {
  enableCodeBlocks: true,
  enableMentions: true,
  enableEmoji: true,
  enableTimestampParsing: true,
  enableSubThreadLinks: true,
  userMapJson: JSON.stringify({ "U123ABCD": "Alice", "U999ZZYY": "Bob" }, null, 2),
  emojiMapJson: JSON.stringify({ "smile": "😄", "thumbsup": "👍" }, null, 2),
  channelMapJson: JSON.stringify({ "C01234": "general" }, null, 2),
  hotkeyMode: 'cmdShiftV',
  maxLines: 20000,
  enablePreviewPane: false,
  enableConfirmationDialog: false,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  collapseThreads: true,
  threadCollapseThreshold: 3
};

export default class SlackFormatPlugin extends Plugin {
  settings: SlackFormatSettings;
  userMap: Record<string, string> = {};
  emojiMap: Record<string, string> = {};
  channelMap: Record<string, string> = {};
  detectedDates: Date[] = [];
  participantSet: Set<string> = new Set();
  private currentUser: string = '';
  private currentTime: string = '';
  private messageLines: string[] = [];
  private result: string[] = [];
  private unknownUserActive: boolean = false;
  private threadInfo: string = '';
  private currentMessageNumber: number = 0;
  private threadStats: ThreadStats = {
    messageCount: 0,
    uniqueUsers: 0,
    threadCount: 0,
    dateRange: '',
    mostActiveUser: undefined
  };
  private userMessageCounts: Record<string, number> = {};

  async onload() {
    console.log("Loading SlackFormatPlugin...");

    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.parseJsonMaps();
    this.addSettingTab(new SlackFormatSettingTab(this.app, this));

    if (this.settings.hotkeyMode === 'cmdShiftV') {
      this.addCommand({
        id: 'format-slack-paste',
        name: 'Format and Paste Slack Thread (Cmd+Shift+V)',
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'v' }],
        editorCallback: async (editor: Editor) => {
          if (this.settings.enablePreviewPane) {
            new SlackPreviewModal(this.app, this, editor).open();
            return;
          }
          try {
            const raw = await navigator.clipboard.readText();
            const formatted = this.formatSlackContent(raw);
            editor.replaceSelection(formatted);
          } catch (err) {
            console.error('Slack Format Plugin Error:', err);
            new Notice('Failed to process clipboard content.');
          }
        }
      });
    } else {
      this.registerEvent(
        this.app.workspace.on('editor-paste', async (clipboard: string, editor: Editor) => {
          if (this.isLikelySlack(clipboard)) {
            if (this.settings.enableConfirmationDialog) {
              const confirm = await this.askSlackConversion();
              if (!confirm) return;
            }
            if (this.settings.enablePreviewPane) {
              new SlackPreviewModal(this.app, this, editor, clipboard).open();
              return false;
            }
            const formatted = this.formatSlackContent(clipboard);
            editor.replaceSelection(formatted);
            return false;
          }
          return;
        })
      );
    }

    this.addCommand({
      id: 'format-slack-create-note',
      name: 'Format Slack & Create Dated Note (YAML Frontmatter)',
      callback: async () => {
        if (this.settings.enablePreviewPane) {
          new SlackPreviewModal(this.app, this, null, null, true).open();
        } else {
          try {
            const raw = await navigator.clipboard.readText();
            const noteContent = this.buildNoteWithFrontmatter(raw);
            await this.createUniqueNote(noteContent);
          } catch (err) {
            console.error('Slack Format Plugin Error:', err);
            new Notice("Failed to create Slack note from clipboard text.");
          }
        }
      }
    });
  }

  onunload() {
    console.log("Unloading SlackFormatPlugin...");
  }

  private parseSlackThreadUrl(url: string): string | null {
    const re = /archives\/([A-Z0-9]+)\/p(\d+)\.(\d+)/i;
    const m = url.match(re);
    if (m) {
      const channelId = m[1];
      const tsInt = m[2];
      const tsFrac = m[3];
      const chanName = this.channelMap[channelId] || channelId;
      return `Thread in #${chanName} at ${tsInt}.${tsFrac}`;
    }
    return null;
  }

  private isTimeLine(line: string): boolean {
    return /^\s*\d{1,2}:\d{2}(?:\s?[AaPp]\.?[Mm]\.?)?\s*$/.test(line);
  }

  private isDateLine(line: string): boolean {
    return /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(line)
      && /\b\d{1,2},?\s*\d{4}/.test(line);
  }

  private parseDateLine(line: string): Date | null {
    const cleaned = line.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
    const dt = new Date(cleaned);
    if (isNaN(dt.getTime())) return null;
    return dt;
  }

  private parseAndFormatTime(timeStr: string): string {
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s?([AaPp]\.?[Mm]\.?))?/);
    if (!match) return timeStr;
    
    let [_, hh, mm, ampm] = match;
    let hour = parseInt(hh, 10);
    const minute = parseInt(mm, 10);

    if (ampm) {
      ampm = ampm.toLowerCase().replace('.', '');
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
    }

    let baseDate: Date;
    if (this.detectedDates.length > 0) {
      baseDate = this.detectedDates.reduce((a, b) => (a < b ? a : b));
    } else {
      baseDate = new Date();
    }

    const newDate = new Date(baseDate.getTime());
    newDate.setHours(hour, minute, 0, 0);

    const userTz = this.settings.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return newDate.toLocaleString('en-US', {
      timeZone: userTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  private formatThreadInfo(replyCount: number): string {
    if (this.settings.collapseThreads && replyCount > this.settings.threadCollapseThreshold) {
      return `>\n> **Thread:** ${replyCount} replies (collapsed)`;
    }
    return `>\n> **Thread:** ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
  }

  private sanitizeMarkdown(text: string): string {
    return text
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^>\s+/gm, '')
      .replace(/^-\s+/gm, '')
      .replace(/^([0-9]+\.)\s+/gm, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  }

  private isDuplicateMessage(message: string): boolean {
    const lastMessages = this.result.slice(-3);
    return lastMessages.some(msg => msg === message);
  }

  private formatLine(line: string): string {
    if (!line.trim()) return '';
    
    if (line.includes('joined #') || line.includes('others joined') || 
        line.includes('left #') || line.includes(' left.')) {
      return '';
    }
    
    let output = this.sanitizeMarkdown(line);
    
    if (output.trimStart().startsWith('>')) {
      output = '\\' + output.trimStart();
    }

    output = output.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, (m, url, text) => {
      if (this.isSlackFile(url) && this.isImageLink(url)) {
        return `![${text} (Slack Attachment)](${url})`;
      } else if (this.isSlackFile(url)) {
        return `[${text} (Slack Attachment)](${url})`;
      } else if (this.isImageLink(url)) {
        return `![${text}](${url})`;
      }
      return `[${text}](${url})`;
    });
  
    output = output.replace(/<(https?:\/\/[^>]+)>/g, (m, url) => {
      const fileName = url.split('/').pop() || url;
      if (this.isSlackFile(url) && this.isImageLink(url)) {
        return `![${fileName} (Slack Attachment)](${url})`;
      } else if (this.isSlackFile(url)) {
        return `[${fileName} (Slack Attachment)](${url})`;
      } else if (this.isImageLink(url)) {
        return `![${fileName}](${url})`;
      }
      return `[${url}](${url})`;
    });

    output = output.replace(/<@([A-Z0-9]+)>/gi, (m, userId) => {
      const mappedUser = this.userMap[userId];
      return mappedUser ? `[[${mappedUser}]]` : `[[${userId}]]`;
    });

    if (this.settings.enableMentions) {
      output = output.replace(/(^|\s)@(\w[\w.-]+)/g, (m, space, uname) => {
        return `${space}[[${uname}]]`;
      });
    }

    if (this.settings.enableEmoji) {
      output = output.replace(/:([a-z0-9_+\-]+):/gi, (m, code) => {
        return this.emojiMap[code] ? this.emojiMap[code] : m;
      });
    }

    output = output.replace(/(^|[^"!])((https?:\/\/[^\s)]+))/g, (match, prefix, url) => {
      if (prefix.match(/\]$/)) return match;
      const fileName = url.split('/').pop() || url;
      if (this.isSlackFile(url) && this.isImageLink(url)) {
        return `${prefix}![${fileName} (Slack Attachment)](${url})`;
      } else if (this.isSlackFile(url)) {
        return `${prefix}[${fileName} (Slack Attachment)](${url})`;
      } else if (this.isImageLink(url)) {
        return `${prefix}![${fileName}](${url})`;
      }
      return `${prefix}[${url}](${url})`;
    });

    output = output.replace(/(^|\s)#(\S+)/g, (match, space, channelWord) => {
      if (/^C[A-Z0-9]+$/i.test(channelWord)) {
        const mapped = this.channelMap[channelWord] || channelWord;
        return `${space}[[#${mapped}]]`;
      }
      return `${space}[[#${channelWord}]]`;
    });

    output = output.replace(/^(?:•|\-\s|\d+\.)\s?/, '- ');
    output = output.replace(/(?<!\\)>/g, '\\>');

    return output.trimEnd();
  }

  private isSlackFile(url: string): boolean {
    return url.includes('files.slack.com/');
  }

  private isImageLink(url: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
  }

  private isLikelySlack(clipboard: string): boolean {
    if (/(view thread)|(replies?)/i.test(clipboard)) return true;
    const lines = clipboard.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      if (this.isTimeLine(lines[i + 1])) return true;
    }
    return false;
  }

  private handleSlackMetadataLine(line: string): false | string | undefined {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed === 'NEW' || trimmed === '1') return false;
    
    if (/(view thread)|(replies?)/i.test(trimmed)) {
      const replyMatch = trimmed.match(/(\d+)\s+repl(y|ies)/i);
      if (replyMatch) {
        const replyCount = parseInt(replyMatch[1], 10);
        this.threadStats.threadCount++;
        return `**Thread:** ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
      }
      return false;
    }
    if (/(Last reply)|(Last Activity)/i.test(trimmed)) {
      return false;
    }
    return undefined;
  }

  private flushMessage() {
    if (this.currentUser && this.currentTime) {
      // Skip messages that are only about joining/leaving
      if (this.messageLines.every(line => 
        line.includes('joined #') || 
        line.includes('others joined') || 
        line.includes('left #') || 
        line.includes(' left.') ||
        line.trim() === 'joined.' ||
        line.trim() === 'left.'
      )) {
        this.currentUser = '';
        this.currentTime = '';
        this.messageLines = [];
        this.unknownUserActive = false;
        return;
      }

      const lines = this.messageLines
        .map(ln => ln.trim())
        .filter(ln => ln.length > 0 && !ln.includes('joined #') && 
                !ln.includes('others joined') && !ln.includes('left #') && 
                !ln.includes(' left.'));
      
      if (lines.length > 0) {
        const formattedBody = lines
          .map(ln => {
            const formattedLine = this.formatLine(ln);
            return formattedLine ? `> ${formattedLine}` : '';
          })
          .filter(ln => ln)
          .join('\n');
        
        this.participantSet.add(this.currentUser);
        this.userMessageCounts[this.currentUser] = (this.userMessageCounts[this.currentUser] || 0) + 1;
        this.threadStats.messageCount++;

        let timeLabel = this.currentTime;
        if (this.settings.enableTimestampParsing && timeLabel !== '???:??') {
          timeLabel = this.parseAndFormatTime(timeLabel);
        }

        const userDisplay = this.currentUser === 'Unknown user' ? this.currentUser : `[[${this.currentUser}]]`;
        
        let messageBlock = [
          `>[!note]+ Message from ${userDisplay}`,
          `> **Time:** ${timeLabel}`,
          `>`,
          formattedBody
        ];
        
        // Add thread info inside the quote block if it exists
        if (this.threadInfo) {
          messageBlock.push(`> ${this.threadInfo}`);
        }

        const formattedMessage = messageBlock.filter(Boolean).join('\n');

        if (!this.isDuplicateMessage(formattedMessage)) {
          this.result.push(formattedMessage);
        }
      }
    }
    this.currentUser = '';
    this.currentTime = '';
    this.messageLines = [];
    this.unknownUserActive = false;
    this.threadInfo = '';
  }

  formatSlackContent(input: string): string {
    this.detectedDates = [];
    this.participantSet = new Set();
    this.result = [];
    this.threadInfo = '';
    this.currentMessageNumber = 0;
    this.threadStats = {
      messageCount: 0,
      uniqueUsers: 0,
      threadCount: 0,
      dateRange: '',
      mostActiveUser: undefined
    };
    this.userMessageCounts = {};

    let lines = input.split('\n');
    if (lines.length > this.settings.maxLines) {
      new Notice(`SlackFormatPlugin: Pasted text has ${lines.length} lines, truncating to ${this.settings.maxLines}.`);
      lines = lines.slice(0, this.settings.maxLines);
    }

    let inCodeBlock = false;
    let inQuotedBlock = false;

    this.currentUser = '';
    this.currentTime = '';
    this.messageLines = [];
    this.unknownUserActive = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '') continue;

      if (this.settings.enableCodeBlocks) {
        const trimmed = line.trim();
        const fenceMatch = trimmed.match(/^```(\w+)?/);
        if (fenceMatch) {
          this.flushMessage();
          if (!inCodeBlock) {
            inCodeBlock = true;
            this.result.push(`\`\`\`${fenceMatch[1] || ''}`.trimEnd());
            continue;
          } else {
            inCodeBlock = false;
            this.result.push('```');
            continue;
          }
        }
        if (inCodeBlock) {
          this.result.push(line);
          continue;
        }
      }

      const tripleQuote = line.trim().match(/^>>>(.*)/);
      if (tripleQuote) {
        this.flushMessage();
        if (!inQuotedBlock) {
          inQuotedBlock = true;
          const after = tripleQuote[1].trim();
          if (after) this.result.push(`> ${this.formatLine(after)}`);
        } else {
          inQuotedBlock = false;
        }
        continue;
      }
      if (inQuotedBlock) {
        this.result.push(`> ${this.formatLine(line)}`);
        continue;
      }

      const metaHandled = this.handleSlackMetadataLine(line);
      if (metaHandled === false) {
        continue;
      } else if (typeof metaHandled === 'string') {
        this.threadInfo = metaHandled;
        continue;
      }

      if (line.includes('joined #') || line.includes('others joined') || 
          line.includes('left #') || line.includes(' left.')) {
        continue;
      }

      const singleLineRegex = /^([\wÀ-ú'.-]+)\s+(\d{1,2}:\d{2}\s?[AaPp]\.?[Mm]\.?)(.*)/;
      const match = line.match(singleLineRegex);
      if (match) {
        this.flushMessage();
        this.currentUser = match[1].trim();
        this.currentTime = match[2].trim();
        const remainder = match[3].trim();
        if (remainder) this.messageLines.push(remainder);
        this.currentMessageNumber++;
        continue;
      }

      if (this.settings.enableTimestampParsing && this.isDateLine(line)) {
        const dt = this.parseDateLine(line);
        if (dt) this.detectedDates.push(dt);
        continue;
      }

      if (this.settings.enableTimestampParsing && i + 1 < lines.length && this.isTimeLine(lines[i + 1])) {
        this.flushMessage();
        this.currentUser = line.replace(/\(.*?\)$/, '').trim();
        this.currentTime = lines[i + 1].trim();
        i++;
        this.currentMessageNumber++;
        continue;
      }

      if (this.currentUser) {
        this.messageLines.push(line);
        continue;
      }

      if (!this.unknownUserActive) {
        this.flushMessage();
        this.currentUser = 'Unknown user';
        this.currentTime = '???:??';
        this.unknownUserActive = true;
        this.currentMessageNumber++;
      }
      this.messageLines.push(line);
    }

    this.flushMessage();
    if (inCodeBlock) {
      this.result.push('```');
    }

    // Update thread statistics
    this.threadStats.uniqueUsers = this.participantSet.size;
    if (this.detectedDates.length > 0) {
      const earliest = this.detectedDates.reduce((a, b) => (a < b ? a : b));
      const latest = this.detectedDates.reduce((a, b) => (a > b ? a : b));
      this.threadStats.dateRange = `${this.formatDateYMD(earliest)} to ${this.formatDateYMD(latest)}`;
    }
    
    // Find most active user
    let maxMessages = 0;
    for (const [user, count] of Object.entries(this.userMessageCounts)) {
      if (count > maxMessages) {
        maxMessages = count;
        this.threadStats.mostActiveUser = user;
      }
    }

    return this.result.join('\n\n');
  }

  private async askSlackConversion(): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = new ConfirmSlackModal(this.app, resolve);
      dialog.open();
    });
  }

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

  parseJsonMaps() {
    try {
      this.userMap = JSON.parse(this.settings.userMapJson);
    } catch (err) {
      console.warn("Failed to parse userMap JSON.", err);
      this.userMap = {};
    }
    try {
      this.emojiMap = JSON.parse(this.settings.emojiMapJson);
    } catch (err) {
      console.warn("Failed to parse emojiMap JSON.", err);
      this.emojiMap = {};
    }
    try {
      this.channelMap = JSON.parse(this.settings.channelMapJson);
    } catch (err) {
      console.warn("Failed to parse channelMap JSON.", err);
      this.channelMap = {};
    }
  }

  buildNoteWithFrontmatter(rawText: string): string {
    this.detectedDates = [];
    this.participantSet = new Set();

    const body = this.formatSlackContent(rawText);

    let earliest: Date | null = null;
    let latest: Date | null = null;
    if (this.detectedDates.length > 0) {
      earliest = this.detectedDates.reduce((a, b) => (a < b ? a : b));
      latest = this.detectedDates.reduce((a, b) => (a > b ? a : b));
    } else {
      earliest = new Date();
      latest = new Date();
    }
    const earliestStr = this.formatDateYMD(earliest);
    const latestStr = this.formatDateYMD(latest);

    const participants = Array.from(this.participantSet).join(', ');
    
    return `---
participants: [${participants}]
earliest_date: ${earliestStr}
latest_date: ${latestStr}
thread: true
statistics:
  message_count: ${this.threadStats.messageCount}
  unique_users: ${this.threadStats.uniqueUsers}
  thread_count: ${this.threadStats.threadCount}
  date_range: ${this.threadStats.dateRange}
  most_active_user: ${this.threadStats.mostActiveUser || 'N/A'}
---

${body}`;
  }

  private formatDateYMD(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class ConfirmSlackModal extends Modal {
  onResult: (confirmed: boolean) => void;

  constructor(app: App, onResult: (confirmed: boolean) => void) {
    super(app);
    this.onResult = onResult;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Slack text detected' });
    contentEl.createEl('p', { text: 'Convert Slack text to formatted Markdown?' });

    const btnDiv = contentEl.createDiv('modal-button-container');
    btnDiv.style.display = 'flex';
    btnDiv.style.justifyContent = 'space-between';
    btnDiv.style.marginTop = '1rem';

    const yesBtn = new ButtonComponent(btnDiv);
    yesBtn.setButtonText('Yes').onClick(() => {
      this.onResult(true);
      this.close();
    });

    const noBtn = new ButtonComponent(btnDiv);
    noBtn.setButtonText('No').onClick(() => {
      this.onResult(false);
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class SlackPreviewModal extends Modal {
  plugin: SlackFormatPlugin;
  editor: Editor | null;
  rawClipboard?: string;
  createNoteInstead?: boolean;
  textArea!: TextAreaComponent;
  previewEl!: HTMLDivElement;

  constructor(
    app: App,
    plugin: SlackFormatPlugin,
    editor: Editor | null,
    rawClipboard?: string | null,
    createNoteInstead?: boolean
  ) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
    this.rawClipboard = rawClipboard || '';
    this.createNoteInstead = createNoteInstead;
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
      text: this.createNoteInstead ? 'Slack → New Note (Preview)' : 'Slack → Preview & Insert'
    });

    const buttonContainer = header.createDiv('slack-preview-buttons');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '0.5rem';
    buttonContainer.style.marginTop = '0.5rem';

    new ButtonComponent(buttonContainer)
      .setButtonText(this.createNoteInstead ? 'Create Note' : 'Insert')
      .onClick(() => {
        const raw = this.textArea.getValue();
        if (this.createNoteInstead) {
          const content = this.plugin.buildNoteWithFrontmatter(raw);
          this.plugin.createUniqueNote(content);
        } else {
          if (!this.editor) {
            new Notice('No editor found for insertion.');
          } else {
            const formatted = this.plugin.formatSlackContent(raw);
            this.editor.replaceSelection(formatted);
          }
        }
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

    const previewScroll = previewPane.createDiv('preview-scroll-container');
    previewScroll.style.overflow = 'auto';
    previewScroll.style.flex = '1';
    previewScroll.style.padding = '1rem';
    previewScroll.style.border = '1px solid var(--background-modifier-border)';
    previewScroll.style.borderRadius = '4px';
    previewScroll.style.backgroundColor = 'var(--background-secondary)';

    this.previewEl = previewScroll.createDiv('preview-content');

    // Set initial content
    if (this.rawClipboard) {
      this.textArea.setValue(this.rawClipboard);
    } else {
      try {
        const clipText = await navigator.clipboard.readText();
        this.textArea.setValue(clipText);
      } catch (err) {
        console.warn('Failed to read clipboard:', err);
      }
    }

    this.textArea.inputEl.addEventListener('input', () => {
      this.updatePreview();
    });

    this.updatePreview();
  }

  onClose() {
    this.contentEl.empty();
  }

  private updatePreview() {
    const raw = this.textArea.getValue();
    let output = this.createNoteInstead ? 
      this.plugin.buildNoteWithFrontmatter(raw) :
      this.plugin.formatSlackContent(raw);
    
    // Apply syntax highlighting to code blocks
    output = output.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      try {
        return `<pre class="language-${lang || 'text'}">${code}</pre>`;
      } catch (e) {
        return match;
      }
    });
    
    this.previewEl.innerHTML = `<pre style="margin: 0; white-space: pre-wrap;">${output}</pre>`;
  }
}

class SlackFormatSettingTab extends PluginSettingTab {
  plugin: SlackFormatPlugin;

  constructor(app: App, plugin: SlackFormatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Slack Format Plugin (Callout Style)' });

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
