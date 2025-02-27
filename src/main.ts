/**
 * Formats Slack conversations pasted into Obsidian
 * @version 0.0.7
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
  private lastKnownUser: string = '';
  private lastMessageTime: string = '';
  private isMessageContinuation: boolean = false;
  private inCodeBlock: boolean = false;
  private inQuotedBlock: boolean = false;

  // New properties to collect unattributed content
  private initialContent: string[] = [];
  private hasInitialContent: boolean = false;
  private avatarImagePattern = /^!\[\]\((https:\/\/ca\.slack-edge\.com\/[^)]+)\)$/;
  private messageStarted: boolean = false;
  private currentAvatar: string = '';
  private lastDateLine: string = '';
  private inReactionBlock: boolean = false;
  private reactionLines: string[] = [];

  // New properties to track problematic URL formatting
  private brokenLinkPattern = /^\]\(([^)]+)\)/;
  private slackArchiveUrlPattern = /https:\/\/[^.]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+/;

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
          return true;
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

private debugLog(message: string, data?: any) {
  console.log(`[SlackFormat] ${message}`, data || '');
}

private handleMessageStart(line: string): { user: string; time: string; remainder: string } | null {
  this.debugLog("Checking line:", line);
  
  // Skip image-only lines that match avatar pattern - store for the next message
  if (this.avatarImagePattern.test(line.trim())) {
    this.currentAvatar = line.trim();
    return null;
  }
  
  // Extract time pattern first - looking for format like 12:35 PM or 9:47 AM
  const timePattern = /\[?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\]?/;
  const timeMatch = line.match(timePattern);
  
  if (!timeMatch) return null;
  
  const time = timeMatch[1];
  const timeParts = line.split(time);
  
  if (timeParts.length < 2) return null;
  
  let beforeTime = timeParts[0].trim();
  let afterTime = timeParts.slice(1).join(time).trim();
  
  // Fix Slack archive URLs that might be attached to the timestamp
  if (afterTime.startsWith('](https://') && this.slackArchiveUrlPattern.test(afterTime)) {
    // This is a Slack archive URL - remove it from the remainder
    const urlEndIndex = afterTime.indexOf(')', 2);
    if (urlEndIndex > 0) {
      afterTime = afterTime.substring(urlEndIndex + 1).trim();
    }
  }
  
  // Remove emoji from username for better parsing
  let user = beforeTime;
  let hasEmoji = false;
  
  // Check for emoji in username and strip it out
  if (beforeTime.includes('![')) {
    hasEmoji = true;
    user = beforeTime.split('![')[0].trim();
  } else if (beforeTime.includes('![:')) {
    hasEmoji = true;
    user = beforeTime.split('![:')[0].trim();
  }
  
  // Fix doubled usernames more aggressively
  user = this.fixDuplicatedUsername(user);
  
  this.debugLog(`Found message with user: ${user}, time: ${time}, emoji: ${hasEmoji}, remainder: ${afterTime}`);
  this.messageStarted = true;
  
  return {
    user: user,
    time: time,
    remainder: afterTime
  };
}

// Enhanced username duplication detection and fixing
// Handle doubled usernames specifically for "FirstName LastNameFirstName LastName" without space
private fixDuplicatedUsername(username: string): string {
  // Special case for "Alex MittellAlex Mittell" pattern
  const noSpaceNamePattern = username.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)([A-Z][a-z]+)\s+([A-Z][a-z]+)$/i);
  if (noSpaceNamePattern) {
    const firstName1 = noSpaceNamePattern[1].toLowerCase();
    const lastName1 = noSpaceNamePattern[2].toLowerCase(); 
    const firstName2 = noSpaceNamePattern[3].toLowerCase();
    const lastName2 = noSpaceNamePattern[4].toLowerCase();
    
    if (firstName1 === firstName2 && lastName1 === lastName2) {
      return `${noSpaceNamePattern[1]} ${noSpaceNamePattern[2]}`;
    }
  }
  
  // First check for exact duplication pattern (e.g. "Byron LukByron Luk")
  const exactDupeMatch = username.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(\s+\1)+$/i);
  if (exactDupeMatch) {
    return exactDupeMatch[1];
  }
  
  // Check for patterns like "FirstName LastNameFirstName LastName"
  const combinedNameMatch = username.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)\1\s+\2$/i);
  if (combinedNameMatch) {
    return `${combinedNameMatch[1]} ${combinedNameMatch[2]}`;
  }
  
  // Handle Name1 Name2Name1 Name2 pattern
  const wordBoundaryMatch = username.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+?)([A-Z][a-z]+.*)$/i);
  if (wordBoundaryMatch) {
    const firstPart = wordBoundaryMatch[1];
    const secondPart = wordBoundaryMatch[2];
    
    // If second part starts with a capital letter where it shouldn't
    if (firstPart.trim().length > 0 && secondPart.trim().length > 0 
        && secondPart.charAt(0).match(/[A-Z]/)) {
      // Check if first part is at the start of second part
      if (secondPart.toLowerCase().startsWith(firstPart.toLowerCase())) {
        return firstPart;
      }
    }
  }
  
  // Check for repeated names with spaces
  const parts = username.split(/\s+/);
  if (parts.length >= 4) {
    const midpoint = Math.floor(parts.length / 2);
    const firstHalf = parts.slice(0, midpoint).join(' ');
    const secondHalf = parts.slice(midpoint).join(' ');
    
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      return firstHalf;
    }
  }
  
  // If we couldn't match any specific pattern but the name is suspiciously long,
  // make a best guess by taking the first two words if they look like a name
  if (parts.length >= 4 && parts.every(p => p.charAt(0).match(/[A-Z]/))) {
    return `${parts[0]} ${parts[1]}`;
  }
  
  return username;
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
    // Check for day names first (most reliable)
    const dayPattern = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i;
    
    // If it's a clear day marker like "Friday, February 14th"
    if (dayPattern.test(line)) {
      this.lastDateLine = line;
      return true;
    }
    
    // Check for month names
    const monthPattern = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i;
    if (!monthPattern.test(line)) return false;
    
    // Check for standard date format like "Feb 2, 2023"
    const standardDatePattern = /\b\d{1,2},?\s*\d{4}\b/i;
    
    // Check for Slack-style date like "Feb 6th at 7:47 PM"
    const slackDatePattern = /\b\d{1,2}(?:st|nd|rd|th)?\s+at\s+\d{1,2}:\d{2}\b/i;
    
    // If it's a date, store it for section headers
    const isDate = standardDatePattern.test(line) || slackDatePattern.test(line);
    if (isDate) {
      this.lastDateLine = line;
    }
    
    return isDate;
  }

  private parseDateLine(line: string): Date | null {
    // Handle both standard dates and Slack-style dates like "Feb 6th at 7:47 PM"
    const cleaned = line.replace(/(\d+)(st|nd|rd|th)/gi, '$1').replace(/\s+at\s+/i, ' ');
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

  private handleSlackMetadataLine(line: string): false | string | undefined {
    const trimmed = line.trim();
    
    // Skip empty lines and metadata
    if (trimmed === '' || trimmed === 'NEW' || trimmed === '1') return false;
    
    // Check for reaction patterns (lines with multiple emoji counts)
    const reactionPattern = /!?\[:[\w_-]+:\]\s*\d+/;
    if (reactionPattern.test(trimmed)) {
      this.inReactionBlock = true;
      this.reactionLines.push(trimmed);
      return false;
    }
    
    // Enhanced thread metadata handling
    if (/(view thread)|(replies?)|(\d+ repl(y|ies))|(Last reply)/i.test(trimmed)) {
        const replyMatch = trimmed.match(/(\d+)\s+repl(y|ies)/i);
        if (replyMatch) {
            const replyCount = parseInt(replyMatch[1], 10);
            this.threadStats.threadCount++;
            return `**Thread:** ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
        }
        return false;
    }
    
    // Skip "Last reply" or "Last Activity" lines
    if (/(Last reply)|(Last Activity)/i.test(trimmed)) return false;
    
    // Handle duplicated names in DMs
    const dmNameMatch = trimmed.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\1\s+/);
    if (dmNameMatch) {
        this.lastKnownUser = dmNameMatch[1];
        return false;
    }
    
    // Skip lines with just emoji reactions
    if (/^!?\[:[\w-]+:\]\d*$/.test(trimmed)) return false;
    
    // Skip date lines like "Friday, February 14th" - these are handled separately
    if (/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i.test(trimmed)) {
        return false;
    }
    
    // If we haven't found a message start yet, and this isn't handled metadata,
    // we'll collect it as initial content
    if (!this.messageStarted) {
      this.initialContent.push(trimmed);
      this.hasInitialContent = true;
      return false;
    }
    
    return undefined;
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

  private isValidUsername(name: string): boolean {
    return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(name) && 
           !name.includes('?') &&
           !name.includes('"') &&
           !name.includes(':') &&
           !name.startsWith('Message from') &&
           !name.includes('replied to');
  }

  private isSystemMessage(line: string): boolean {
    return line.includes('joined #') || 
           line.includes('others joined') || 
           line.includes('left #') || 
           line.includes(' left.') ||
           line.includes('replied to a thread');
  }

  private resetMessage() {
    this.currentUser = '';
    this.currentTime = '';
    this.messageLines = [];
    this.unknownUserActive = false;
    this.threadInfo = '';
    this.isMessageContinuation = false;
    this.currentAvatar = '';
  }

  private formatLine(line: string): string {
    if (!line.trim()) return '';
    
    // Handle system messages
    if (line.includes('joined #') || line.includes('others joined') || 
        line.includes('left #') || line.includes(' left.')) {
      return '';
    }
    
    // Fix broken Slack archive URLs that start with ](
    if (line.trim().match(this.brokenLinkPattern)) {
      const urlMatch = line.match(this.brokenLinkPattern);
      if (urlMatch && this.slackArchiveUrlPattern.test(urlMatch[1])) {
        // This is a broken Slack archive URL - skip it
        return '';
      }
    }
    
    // Special handling for Slack images and URLs
    if (line.trim().match(/^!\[.*?\]\(https?:\/\/.*?\)$/)) {
      // Direct image Markdown line - return as is
      return line.trim();
    }

    // Handle Slack image attachments which appear as ![filename](url)
    if (line.trim().startsWith('[') && line.includes('![') && line.includes('](')) {
      try {
        // Extract image URL directly
        const urlMatch = line.match(/\]\((https?:\/\/[^)]+)\)/);
        if (urlMatch) {
          return `![Image attachment](${urlMatch[1]})`;
        }
      } catch (e) {
        // Fallback to original line if regex fails
      }
    }
    
    let output = this.sanitizeMarkdown(line);
    
    if (output.trimStart().startsWith('>')) {
      output = '\\' + output.trimStart();
    }
    
    // Fix URL formatting issues - match Slack's explicit link format
    output = output.replace(/\]\(([^)]+)\)\s+\(([^)]+)\)/g, ']($1)');
    
    // Better handle URLs in parentheses to avoid the doubled parentheses issue
    output = output.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, (m, url, text) => {
      if (this.isSlackFile(url) && this.isImageLink(url)) {
        return `![${text}](${url})`;
      } else if (this.isSlackFile(url)) {
        return `[${text}](${url})`;
      } else if (this.isImageLink(url)) {
        return `![${text}](${url})`;
      }
      return `[${text}](${url})`;
    });
    
    // Handle plain URLs in angle brackets <url>
    output = output.replace(/<(https?:\/\/[^>]+)>/g, (m, url) => {
      const fileName = url.split('/').pop() || url;
      if (this.isSlackFile(url) && this.isImageLink(url)) {
        return `![${fileName}](${url})`;
      } else if (this.isSlackFile(url)) {
        return `[${fileName}](${url})`;
      } else if (this.isImageLink(url)) {
        return `![${fileName}](${url})`;
      }
      return `[${url}](${url})`;
    });
    
    // Improved Slack emoji handling - for all emoji formats
    output = output.replace(/!?\[:([a-z0-9_+-]+):\](?:\s*\d+)?(?:\([^)]+\))?\s*/gi, (m, code) => {
      if (this.settings.enableEmoji) {
        return this.emojiMap[code] ? this.emojiMap[code] : `:${code}:`;
      }
      return `:${code}:`;
    });
    
    // Handle user mentions 
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
      output = output.replace(/:([a-z0-9_+-]+):/gi, (m, code) => {
        return this.emojiMap[code] ? this.emojiMap[code] : m;
      });
    }
    
    // Handle URLs in text - avoid double markdown
    if (!output.includes('](http')) {
      output = output.replace(/(?<!!)\[(.*?)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)');
      output = output.replace(/(^|[^"!(\[])((https?:\/\/[^\s)]+))/g, (match, prefix, url) => {
        if (prefix.match(/\]$/)) return match;
        const fileName = url.split('/').pop() || url;
        if (this.isSlackFile(url) && this.isImageLink(url)) {
          return `${prefix}![${fileName}](${url})`;
        } else if (this.isSlackFile(url)) {
          return `${prefix}[${fileName}](${url})`;
        } else if (this.isImageLink(url)) {
          return `${prefix}![${fileName}](${url})`;
        }
        return `${prefix}[${url}](${url})`;
      });
    }
    
    // Fix combined URLs that appear as ]([url])
    output = output.replace(/\]\(\[(https?:\/\/[^)]+)\]\((https?:\/\/[^)]+)\)\)/g, ']($1)');
    
    // Fix broken Slack URLs at the beginning of lines
    if (output.startsWith('](https://') && this.slackArchiveUrlPattern.test(output)) {
      const endIndex = output.indexOf(')', 2);
      if (endIndex > 0) {
        output = output.substring(endIndex + 1).trim();
      }
    }
    
    // Handle channel mentions
    output = output.replace(/(^|\s)#(\S+)/g, (match, space, channelWord) => {
      if (/^C[A-Z0-9]+$/i.test(channelWord)) {
        const mapped = this.channelMap[channelWord] || channelWord;
        return `${space}[[#${mapped}]]`;
      }
      return `${space}[[#${channelWord}]]`;
    });
    
    // Handle bullet points and list formatting
    output = output.replace(/^(?:•|\-\s|\d+\.)\s?/, '- ');
    
    // Escape > characters to avoid conflicts with blockquote syntax
    output = output.replace(/(?<!\\)>/g, '\\>');
    
    return output.trimEnd();
  }

  private flushMessage() {
    if (this.currentUser && this.currentTime) {
      // Skip join/leave messages
      if (this.messageLines.every(line => 
        line.includes('joined #') || 
        line.includes('others joined') || 
        line.includes('left #') || 
        line.includes(' left.') ||
        line.trim() === 'joined.' ||
        line.trim() === 'left.'
      )) {
        this.resetMessage();
        return;
      }

      // Filter out broken URL lines that begin with ](
      const lines = this.messageLines
        .map(ln => ln.trim())
        .filter(ln => {
          if (ln.match(this.brokenLinkPattern) && this.slackArchiveUrlPattern.test(ln)) {
            return false; // Skip broken Slack archive URLs
          }
          return ln.length > 0 && !this.isSystemMessage(ln);
        });
      
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

        // Only wrap in [[]] if it's a valid username
        const userDisplay = this.isValidUsername(this.currentUser) ? 
          `[[${this.currentUser}]]` : this.currentUser;
        
        let messageBlock = [
          `>[!note]+ Message from ${userDisplay}`,
          `> **Time:** ${timeLabel}`
        ];
        
        // Add date information if we have it and should include it
        if (this.lastDateLine && this.settings.enableTimestampParsing) {
          messageBlock.push(`> **Date:** ${this.lastDateLine}`);
          this.lastDateLine = ''; // Clear after using it once
        }
        
        // Add a blank line before content
        messageBlock.push(`>`);
        
        // Add avatar if we have one - place it at the right location
        if (this.currentAvatar) {
          messageBlock.push(`> ${this.currentAvatar}`);
        }
        
        // Add a blank line after avatar if we have one
        if (this.currentAvatar) {
          messageBlock.push(`>`);
        }
        
        messageBlock.push(formattedBody);
        
        if (this.threadInfo) {
          messageBlock.push(`> ${this.threadInfo}`);
        }
        
        // Add reaction lines if we have any
        if (this.reactionLines.length > 0 && this.settings.enableEmoji) {
          const formattedReactions = this.reactionLines
            .map(r => this.formatLine(r))
            .filter(r => r)
            .join(' ');
            
          if (formattedReactions) {
            messageBlock.push(`> **Reactions:** ${formattedReactions}`);
          }
          this.reactionLines = [];
          this.inReactionBlock = false;
        }
        
        const formattedMessage = messageBlock.filter(Boolean).join('\n');

        if (!this.isDuplicateMessage(formattedMessage)) {
          this.result.push(formattedMessage);
        }
      }
    }
    this.resetMessage();
  }

  private isLikelySlack(clipboard: string): boolean {
    if (/(view thread)|(replies?)/i.test(clipboard)) return true;
    const lines = clipboard.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      if (this.isTimeLine(lines[i + 1])) return true;
    }
    return false;
  }

  formatSlackContent(input: string): string {
    this.debugLog("Starting to format slack content");
    // Reset state variables
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
    this.lastKnownUser = '';
    this.lastMessageTime = '';
    this.isMessageContinuation = false;
    this.inCodeBlock = false;
    this.inQuotedBlock = false;
    this.initialContent = [];
    this.hasInitialContent = false;
    this.messageStarted = false;
    this.currentAvatar = '';
    this.lastDateLine = '';
    this.inReactionBlock = false;
    this.reactionLines = [];

    let lines = input.split('\n');
    if (lines.length > this.settings.maxLines) {
      new Notice(`SlackFormatPlugin: Pasted text has ${lines.length} lines, truncating to ${this.settings.maxLines}.`);
      lines = lines.slice(0, this.settings.maxLines);
    }
    
    // First pass - look for formatting issues and clean up problematic patterns
    let preprocessed = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        preprocessed.push('');
        continue;
      }
      
      // Handle broken archive URLs before any other processing
      if (line.match(this.brokenLinkPattern) && this.slackArchiveUrlPattern.test(line)) {
        // Skip this line entirely - it's a broken Slack archive URL
        continue;
      }
      
      // If it's an avatar image, keep as is
      if (this.avatarImagePattern.test(line)) {
        preprocessed.push(line);
        continue;
      }
      
      preprocessed.push(line);
    }
    
    lines = preprocessed;
    
    // Debugging for problematic patterns
    if (input.includes("![:no_entry:]")) {
      this.debugLog("Found content with emoji in username");
    }

    // Second pass - check if we can detect any messages at all
    let messageFound = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        
        const messageStart = this.handleMessageStart(line);
        if (messageStart) {
            messageFound = true;
            break;
        }
    }

    // If no message structure detected, use fallback parsing
    if (!messageFound && lines.length > 0) {
        console.log("SlackFormatPlugin: No message structure detected, using fallback parsing");
        // Add first message as an unknown user to ensure something gets formatted
        this.currentUser = lines[0].match(/^[A-Z][a-z]+/) ? lines[0].split(' ')[0] : 'Unknown user';
        this.currentTime = '???:??';
        this.messageLines = lines;
        this.flushMessage();
        return this.result.join('\n\n');
    }

    // Main processing loop
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
      
        if (line === '') continue;
        
        // Handle date separators as inline content rather than separate headers
        if (this.isDateLine(line)) {
            if (this.currentUser) {
                this.flushMessage();
            }
            
            // Store the date but don't add it directly to results
            // We'll include it as content in the next message if needed
            this.lastDateLine = line;
            
            // Parse the date to help with timestamp formatting
            const dateObj = this.parseDateLine(line);
            if (dateObj) {
                this.detectedDates.push(dateObj);
            }
            
            continue;
        }
        
        // Handle code blocks
        if (this.settings.enableCodeBlocks) {
            const fenceMatch = line.match(/^```(\w+)?/);
            if (fenceMatch) {
                this.flushMessage();
                if (!this.inCodeBlock) {
                    this.inCodeBlock = true;
                    this.result.push(`\`\`\`${fenceMatch[1] || ''}`.trimEnd());
                    continue;
                } else {
                    this.inCodeBlock = false;
                    this.result.push('```');
                    continue;
                }
            }
            if (this.inCodeBlock) {
                this.result.push(line);
                continue;
            }
        }
        
        const tripleQuote = line.match(/^>>>(.*)/);
        if (tripleQuote) {
            this.flushMessage();
            if (!this.inQuotedBlock) {
                this.inQuotedBlock = true;
                const after = tripleQuote[1].trim();
                if (after) this.result.push(`> ${this.formatLine(after)}`);
            } else {
                this.inQuotedBlock = false;
            }
            continue;
        }
        if (this.inQuotedBlock) {
            this.result.push(`> ${this.formatLine(line)}`);
            continue;
        }
        
        // Check for metadata lines
        const metaHandled = this.handleSlackMetadataLine(line);
        if (metaHandled === false) {
            continue;
        } else if (typeof metaHandled === 'string') {
            this.threadInfo = metaHandled;
            continue;
        }
        
        // Try to detect message start
        const messageStart = this.handleMessageStart(line);
        if (messageStart) {
            this.flushMessage();
            this.currentUser = messageStart.user;
            this.currentTime = messageStart.time;
            this.lastKnownUser = this.currentUser;
            this.lastMessageTime = this.currentTime;
            
            if (messageStart.remainder) {
                this.messageLines.push(messageStart.remainder);
            }
            continue;
        }
        
        // Handle timestamp-only lines
        const timeOnlyMatch = line.match(/^(\d{1,2}:\d{2}(?:\s?[AaPp]\.?[Mm]\.?)?)\s*$/);
        if (timeOnlyMatch) {
            if (this.lastKnownUser && this.currentUser !== this.lastKnownUser) {
                this.flushMessage();
                this.currentUser = this.lastKnownUser;
            }
            this.currentTime = timeOnlyMatch[1];
            continue;
        }
        
        // Avatar-only lines - store for next message
        if (this.avatarImagePattern.test(line)) {
            this.currentAvatar = line;
            continue;
        }
        
        // Skip broken Slack archive URL lines
        if (line.match(this.brokenLinkPattern) && this.slackArchiveUrlPattern.test(line)) {
            continue;
        }
        
        // If we have a current user or are in a continuation, add the line to current message
        if (this.currentUser) {
            this.messageLines.push(line);
            continue;
        }
        
        // If we get here and have a lastKnownUser, treat as continuation
        if (this.lastKnownUser) {
            this.currentUser = this.lastKnownUser;
            this.currentTime = this.lastMessageTime;
            this.messageLines.push(line);
            continue;
        }
        
        // Fallback for unknown messages - add to initialContent if we haven't started messages yet
        if (!this.messageStarted) {
            this.initialContent.push(line);
            this.hasInitialContent = true;
            continue;
        }
        
        // Last resort fallback
        if (!this.unknownUserActive) {
            this.flushMessage();
            this.currentUser = 'Unknown user';
            this.currentTime = '???:??';
            this.unknownUserActive = true;
        }
        this.messageLines.push(line);
    }
    
    this.flushMessage();
    if (this.inCodeBlock) {
      this.result.push('```');
    }
    
    // Process initial unattributed content if we have any
    if (this.hasInitialContent && this.initialContent.length > 0) {
        // Filter out avatar images and irrelevant content
        const filteredContent = this.initialContent
            .filter(line => {
                // Skip avatar-only lines in initial content
                if (this.avatarImagePattern.test(line)) {
                    return false;
                }
                // Skip broken Slack URLs
                if (line.match(this.brokenLinkPattern) && this.slackArchiveUrlPattern.test(line)) {
                    return false;
                }
                // Skip pure emoji reactions
                if (/^!?\[:[\w-]+:\]\d*$/.test(line)) {
                    return false;
                }
                // Skip thread metadata lines
                if (/(view thread)|(replies?)|(\d+ repl(y|ies))|(Last reply)/i.test(line)) {
                    return false;
                }
                return line.trim().length > 0;
            });
            
        if (filteredContent.length > 0) {
            const formattedInitialContent = filteredContent
                .map(line => {
                    const formatted = this.formatLine(line);
                    return formatted ? `> ${formatted}` : '';
                })
                .filter(Boolean)
                .join('\n');
                
            if (formattedInitialContent) {
                // Insert at the beginning of the result
                this.result.unshift(
                    `>[!note]+ Message from Missing author`,
                    `> **Time:** Unknown`,
                    `>`,
                    formattedInitialContent
                );
            }
        }
    }
    
    // If no results were generated, create a fallback message
    if (this.result.length === 0 && lines.length > 0) {
        this.result.push(`>[!note]+ Slack Conversation\n> **Note:** Could not parse message format\n>\n> ${lines.join('\n> ')}`);
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
    
    // Post-process the results to fix date headers and link formatting
    let finalResults = [];
    let dateHeaderAdded = false;
    let currentDateHeader = "";
    
    for (const item of this.result) {
        // Check if this is a date header (starts with ##)
        if (item.trim().startsWith('\n##')) {
            currentDateHeader = item.trim().replace(/^\n##\s*/, '').replace(/\n$/, '');
            dateHeaderAdded = false;
            continue; // Skip adding the date header directly to results
        }
        
        // If we have a date header and it hasn't been added yet, include it in the next message
        if (currentDateHeader && !dateHeaderAdded && item.trim().startsWith('>[!note]+')) {
            // Add a date header to the start of this callout block
            const calloutParts = item.split('\n');
            // Add after the first two lines (user and time)
            calloutParts.splice(2, 0, `> **Date:** ${currentDateHeader}`);
            finalResults.push(calloutParts.join('\n'));
            dateHeaderAdded = true;
        } else {
            finalResults.push(item);
        }
    }
    
    // Clean up links - fix trailing parentheses issue
    finalResults = finalResults.map(item => {
        return item
          .replace(/\]\((https?:\/\/[^)]+)\)\s+\((https?:\/\/[^)]+)\)/g, ']($1)')
          .replace(/\]\(([^)]+)\)\s+\(([^)]+)\)/g, ']($1)');
    });
    
    return finalResults.join('\n\n');
}

private isSlackFile(url: string): boolean {
    return url.includes('files.slack.com/');
}

private isImageLink(url: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
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
