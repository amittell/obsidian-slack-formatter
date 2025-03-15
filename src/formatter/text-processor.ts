/**
 * Text processing utilities for formatting Slack conversations
 */
import { FormatMode } from "../types";

export class TextProcessor {
  private userMap: Record<string, string>;
  private emojiMap: Record<string, string>;
  private channelMap: Record<string, string>;

  constructor(
    userMap: Record<string, string>,
    emojiMap: Record<string, string>,
    channelMap: Record<string, string>
  ) {
    this.userMap = userMap || {};
    this.emojiMap = emojiMap || {};
    this.channelMap = channelMap || {};
  }

  private debugLog(message: string, data?: any) {
    console.log(`[SlackFormat] ${message}`, data || '');
  }

  public processMentions(text: string): string {
    if (!text) return text;
    text = text.replace(/(?<![:])@([A-Za-z0-9_-]+)/g, (_, name) => `[[${name}]]`);
    return text.replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>+/g, (match, userId, displayName) => {
      if (this.userMap[userId]) {
        return `[[${this.userMap[userId]}]]`;
      }
      if (displayName) {
        return `[[${displayName}]]`;
      }
      return `[[${userId}]]`;
    });
  }

  public processEmoji(text: string): string {
    if (!text) return text;
    return text.replace(/:([\w\-\+]+):/g, (match, emojiName) => {
      return this.emojiMap[emojiName] || match;
    });
  }

  public processChannelRefs(text: string): string {
    if (!text) return text;
    return text.replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/, (match, channelId, displayName) => {
      if (this.channelMap[channelId]) {
        return `#${this.channelMap[channelId]}`;
      }
      if (displayName) {
        return `#${displayName}`;
      }
      return `#${channelId}`;
    });
  }

  public formatLine(text: string, enableMentions: boolean, enableEmoji: boolean): string {
    if (!text) return text;
    let formatted = text;
    if (enableMentions) {
      formatted = this.processMentions(formatted);
    }
    if (enableEmoji) {
      formatted = formatted.replace(/^(:[\w\-\+]+:)\s*(\d+)$/i, '$1 $2');
      const reactionPattern = /^(:[\w\-\+]+:)\s*(\d+)\s*$/;
      const match = formatted.match(reactionPattern);
      if (match) {
        formatted = `${match[1]} ${match[2]}`;
      }
      formatted = formatted.replace(/:([\w\-\+]+):/g, (match, emojiName) => {
        return this.emojiMap[emojiName] || match;
      });
    }
    formatted = this.cleanLinkFormatting(formatted);
    return formatted;
  }

  private cleanCharacters(text: string): string {
    return text
      .replace(/`([^`]+)`/g, (match, code) => {
        return `\`${code.replace(/`/g, '\\`')}\``;
      });
  }

  public cleanLinkFormatting(text: string): string {
    if (!text) return text;
    return text
      .replace(/\\$$ /g, '[')
      .replace(/\\ $$/g, ']')
      .replace(/<(https?:\/\/[^>]+)>/g, '$1')
      .replace(/$$  $$$$ (https?:\/\/[^)]+) $$/g, '$1');
  }

  private fixDoubledUsernames(text: string): string {
    if (!text) return text;
    return text.replace(/($$ \[)([A-Z][a-z]+\s+[A-Z][a-z]+)(\2)( $$\])/gi, '$1$2$4');
  }

  public formatThreadInfo(
    replyCount: number,
    collapseThreads: boolean,
    collapseThreshold: number
  ): string {
    if (collapseThreads && replyCount >= collapseThreshold) {
      return `\n\n▼ ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
    }
    return '';
  }

  public formatReactions(reactions: string[]): string {
    if (!reactions || reactions.length === 0) return '';
    return reactions.map(r => r.trim()).join('\n> ');
  }

  public formatUserHandle(username: string): string {
    if (!username) return 'Unknown user';
    return `[[${username}]]`;
  }

  public formatMessage(
    user: string | undefined, // Allow undefined and handle it
    time: string,
    date: string,
    avatar: string,
    lines: string[],
    threadInfo: string,
    reactions: string[] | null,
    options: { 
      enableTimestampParsing: boolean, 
      enableEmoji: boolean, 
      enableMentions: boolean 
    },
    parseTimeCallback: (timeStr: string) => string
  ): string {
    user = user || "Unknown user"; // Default if undefined
    let formattedUser = user;
    if (!user.startsWith('[[') && !user.includes('Unknown') && user !== 'THREAD_DIVIDER') {
      formattedUser = `[[${user}]]`;
    }
    let result = `>[!note]+ Message from ${formattedUser}`;
    if (time) {
      const displayTime = options.enableTimestampParsing ? 
        parseTimeCallback(time) : time;
      result += `\n> **Time:** ${displayTime}`;
    }
    if (date) {
      result += `\n> **Date:** ${date}`;
    }
    result += '\n>';
    if (lines && lines.length > 0) {
      const formattedLines = lines
        .map(line => {
          return this.formatLine(line, options.enableMentions, options.enableEmoji);
        })
        .filter(line => line.trim() !== '')
        .join('\n> ');
      if (formattedLines) {
        result += `\n> ${formattedLines}`;
      }
    }
    if (reactions && reactions.length > 0) {
      const formattedReactions = this.formatReactions(reactions);
      if (formattedReactions) {
        result += `\n> ${formattedReactions}`;
      }
    }
    if (threadInfo) {
      result += threadInfo;
    }
    return result;
  }

  public processText(text: string, formatMode: FormatMode = FormatMode.Slack): string {
    if (formatMode === FormatMode.Slack) {
      return this.processSlackText(text);
    }
    return this.cleanupMarkdown(text);
  }

  public isLikelySlackFormat(text: string): boolean {
    if (!text || text.length < 20) return false;
    if (text.includes('slack.com/archives/')) return true;
    if (text.includes('ca.slack-edge.com/')) return true;
    if (text.includes('files.slack.com/files-')) return true;
    if (/([A-Z][a-z]+\s+[A-Z][a-z]+)([A-Z][a-z]+\s+[A-Z][a-z]+)/i.test(text)) return true;
    if (/$$ [A-Z][a-z]+ \d+(?:st|nd|rd|th)? at \d{1,2}:\d{2}\s*(?:AM|PM)]/i.test(text)) return true;
    if (/\[\d{1,2}:\d{2}\s*(?:AM|PM) $$/i.test(text)) return true;
    if (text.includes('replied to thread')) return true;
    if (text.includes('View thread')) return true;
    if (/\d+ repl(?:y|ies)/.test(text)) return true;
    if (/!?$$ :[\w\-]+: $$/i.test(text)) return true;
    const timestampMatches = text.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/ig);
    if (timestampMatches && timestampMatches.length >= 3) return true;
    return false;
  }

  private processSlackText(text: string): string {
    const lines = text.split('\n');
    const processedLines: string[] = [];
    let currentAuthor: string | null = null;
    let currentTimestamp: string | null = null;
    let inMessageContent = false;
    let currentContent: string[] = [];
    let currentReactions: string[] = [];
    let lastLineWasEmpty = true;
    let inCodeBlock = false;

    const nonUsernamePatterns = [
      /^Added by/i,
      /^Current users/i,
      /^That works? for/i,
      /^Interested in/i,
      /^Thread with/i,
      /^View (thread|repl(y|ies))/i,
      /^Last reply/i,
      /^Show more/i,
      /^Loading more/i,
      /^Pinned by/i,
      /^Saved by/i,
      /^Only visible to/i,
      /^This message/i,
      /^Posted in/i,
      /^\d+ repl(y|ies)/i,
      /^Reply in thread/i,
      /^Language$/i
    ];

    const instructionalPhrases = /will\s+|has\s+|is\s+|can\s+|should\s+|must\s+/i;

    const isNonUsername = (text: string): boolean => {
      if (!text) return true;
      return nonUsernamePatterns.some(pattern => pattern.test(text)) || 
             instructionalPhrases.test(text);
    };

    const cleanUsername = (username: string): string => {
      const doubledPattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)([A-Z][a-z]+\s+[A-Z][a-z]+)/i;
      if (doubledPattern.test(username)) {
        const match = username.match(doubledPattern);
        if (match) return match[1];
      }
      return username.replace(/!(?:$$ [^ $$]*\]|$$ :[\w\-]+: $$).*$/, '').trim();
    };

    const isLikelyUsernameLine = (line: string): boolean => {
      if (isNonUsername(line)) return false;
      const sentenceStartPattern = /^(Let|Anyone|Made|Is|Does|Our|That|Happy|If|I|We|This|Here|The|Check|What|When|How|Any|One|It|First|Added|Last|Who|Current|This|Only|Interested|View|Patrick)/i;
      if (sentenceStartPattern.test(line)) return false;
      const commonWords = [" if ", " the ", " with ", " for ", " a ", " to ", " in ", " my ", " our ", " your ", " is ", " are ", " show ", " this ", " team ", " us ", " you ", " through "];
      if (commonWords.some(word => line.toLowerCase().includes(word))) return false;
      const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})$/;
      if (namePattern.test(line)) return true;
      const doubledPattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)([A-Z][a-z]+\s+[A-Z][a-z]+)/i;
      if (doubledPattern.test(line)) return true;
      if (line.split(/\s+/).length > 4) return false;
      const words = line.split(/\s+/);
      const uppercaseWordCount = words.filter(w => /^[A-Z]/.test(w)).length;
      return uppercaseWordCount >= words.length * 0.5;
    };

    const addMessage = () => {
      if (!currentAuthor || !currentContent.length) return;
      const authorLink = `[[${currentAuthor}]]`;
      const timeStr = currentTimestamp ? `[${currentTimestamp}]` : '';
      processedLines.push(`**${authorLink}** ${timeStr}`);
      currentContent.forEach(line => {
        processedLines.push(`> ${line}`);
      });
      if (currentReactions.length) {
        processedLines.push('> ');
        processedLines.push(`> _Reactions: ${currentReactions.join(', ')}_`);
      }
      processedLines.push('');
      currentAuthor = null;
      currentTimestamp = null;
      currentContent = [];
      currentReactions = [];
      inMessageContent = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        lastLineWasEmpty = true;
        if (inMessageContent && currentContent.length > 0) {
          currentContent.push('');
        }
        continue;
      }
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (inMessageContent) {
          currentContent.push(line);
        }
        continue;
      }
      if (inCodeBlock) {
        if (inMessageContent) {
          currentContent.push(line);
        }
        continue;
      }
      if (line.match(/^:[\w\-]+:(\s*\d+)?$/)) {
        if (inMessageContent) {
          currentReactions.push(line);
        }
        continue;
      }
      if (line.match(/^(\d+ repl(?:y|ies)$|^View thread$|^Last reply)/i)) {
        if (inMessageContent) {
          currentContent.push(`_[Thread with replies]_`);
        }
        continue;
      }
      if (line.match(/^Posted in|^Only visible to you|^This message/i)) {
        continue;
      }
      const usernameTimestampPattern = /^([A-Z][a-z]+(?:\s+[A-Za-z]+)+)(?:\s+\[[^\]]+\]|\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i;
      const match = line.match(usernameTimestampPattern);
      if (match && !isNonUsername(match[1])) {
        if (currentAuthor) {
          addMessage();
        }
        const rawUsername = match[1];
        if (!isNonUsername(rawUsername) && isLikelyUsernameLine(rawUsername)) {
          currentAuthor = cleanUsername(rawUsername);
          const timeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))|(\[[^\]]+\])/i);
          currentTimestamp = timeMatch ? timeMatch[0] : null;
          const contentStartIdx = line.indexOf(timeMatch ? timeMatch[0] : match[0]) + (timeMatch ? timeMatch[0].length : match[0].length);
          if (contentStartIdx < line.length) {
            const remainingText = line.substring(contentStartIdx).trim();
            if (remainingText) {
              currentContent.push(remainingText);
            }
          }
          inMessageContent = true;
        } else {
          if (inMessageContent) {
            currentContent.push(line);
          } else {
            processedLines.push(line);
          }
        }
        continue;
      }
      if (lastLineWasEmpty && isLikelyUsernameLine(line) && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.match(/^\d{1,2}:\d{2}\s*(?:AM|PM)$/i)) {
          if (currentAuthor) {
            addMessage();
          }
          currentAuthor = cleanUsername(line);
          currentTimestamp = nextLine;
          i++;
          inMessageContent = true;
          continue;
        }
      }
      if (line.startsWith('![') && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (isLikelyUsernameLine(nextLine)) {
          if (currentAuthor) {
            addMessage();
          }
          currentAuthor = cleanUsername(nextLine);
          i++;
          if (i < lines.length - 1 && lines[i + 1].trim().match(/^\d{1,2}:\d{2}\s*(?:AM|PM)$/i)) {
            currentTimestamp = lines[i + 1].trim();
            i++;
          }
          inMessageContent = true;
          continue;
        }
      }
      if (inMessageContent) {
        if (line.match(/^thread$/i) || line.match(/^\d+ repl(?:y|ies)$/i)) {
          continue;
        }
        currentContent.push(line);
      } else {
        if (lastLineWasEmpty && isLikelyUsernameLine(line)) {
          if (currentAuthor) {
            addMessage();
          }
          currentAuthor = cleanUsername(line);
          inMessageContent = true;
        } else {
          processedLines.push(line);
        }
      }
      lastLineWasEmpty = false;
    }
    if (currentAuthor) {
      addMessage();
    }
    return processedLines.join('\n');
  }

  private cleanupMarkdown(text: string): string {
    let output = text;
    output = output.replace(/(?<!\(|\[)(https?:\/\/\S+)(?!\)|\])/g, '[[$1]]');
    output = output.replace(/^([*\-+])([^\s])/gm, '$1 $2');
    return output;
  }

  public formatTimestamp(timeStr: string): string {
    return this.parseTimestamp(timeStr);
  }

  public parseTimestamp(timeStr: string): string {
    if (!timeStr) return timeStr;
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);
    if (timeMatch) {
      const [_, hours, minutes, meridiem] = timeMatch;
      return `${hours}:${minutes} ${meridiem.toUpperCase()}`;
    }
    return timeStr;
  }
}