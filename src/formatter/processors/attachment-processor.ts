import { BaseProcessor } from './base-processor';
import { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger';

/**
 * Specialized processor for handling Slack attachments, file uploads, and link previews with intelligent formatting.
 *
 * This processor manages the complex landscape of Slack attachment content, transforming various
 * attachment formats into clean, readable Markdown while preserving essential information and
 * context. It handles file uploads, image references, link previews, GitHub integrations,
 * and avatar patterns with sophisticated pattern recognition and contextual analysis.
 *
 * ## Processing Capabilities
 * - **File Upload Notifications**: Transform "user uploaded a file: filename" into formatted notifications
 * - **Image References**: Clean and format image markdown and device source indicators
 * - **Link Previews**: Simplify complex link preview blocks into concise representations
 * - **GitHub Integrations**: Process repository links and service additions
 * - **Avatar Handling**: Context-aware avatar preservation or filtering
 * - **File Count Summaries**: Handle multi-file attachment indicators
 *
 * ## Pattern Recognition System
 * The processor uses a comprehensive pattern library covering:
 * - Link preview patterns (titles, URLs, descriptions)
 * - File attachment patterns (uploads, extensions, metadata)
 * - Image patterns (sources, markdown, formats)
 * - Service integration patterns (GitHub, external services)
 * - Avatar and user interface patterns
 *
 * ## Processing Algorithm
 * 1. **Sequential Processing**: Apply transformations in dependency order
 * 2. **Pattern Matching**: Use regex patterns for reliable content identification
 * 3. **Context Analysis**: Consider surrounding content for intelligent decisions
 * 4. **Format Preservation**: Maintain essential information while improving readability
 * 5. **Error Recovery**: Graceful fallback to original content on processing errors
 *
 * @extends BaseProcessor<string>
 * @example
 * ```typescript
 * const processor = new AttachmentProcessor();
 *
 * // File upload transformation
 * const uploadText = "Alice uploaded a file: project_report.pdf";
 * const uploadResult = processor.process(uploadText);
 * console.log(uploadResult.content); // "📄 Alice uploaded: **project_report.pdf**"
 *
 * // Link preview simplification
 * const previewText = `GitHub
 * https://github.com/user/repo
 * A great repository for learning
 * Language
 * TypeScript
 * Last updated 2 hours ago`;
 * const previewResult = processor.process(previewText);
 * console.log(previewResult.content); // "🔗 [GitHub](https://github.com/user/repo) — _A great repository for learning_"
 *
 * // Image reference cleanup
 * const imageText = "Image from iOS\n![Screenshot](https://example.com/image.png)";
 * const imageResult = processor.process(imageText);
 * console.log(imageResult.content); // "🖼️ _Image from iOS_\n![Screenshot](https://example.com/image.png)"
 *
 * // Complex attachment processing
 * const complexText = `John uploaded a file: presentation.pptx
 * Image from Desktop
 * ![Diagram](https://files.slack.com/abc123)
 * 📎 Added by [GitHub](https://github.com)
 * 📎 3 files`;
 * const complexResult = processor.process(complexText);
 * // Returns clean, formatted version with appropriate emoji indicators
 * ```
 * @see {@link patterns} - Comprehensive pattern library for attachment recognition
 */
export class AttachmentProcessor extends BaseProcessor<string> {
  /**
   * Comprehensive pattern library for identifying and processing various attachment types.
   *
   * This pattern collection covers the full spectrum of Slack attachment formats,
   * enabling accurate identification and appropriate processing of different content types.
   * Patterns are organized by category for maintainability and performance.
   *
   * ## Pattern Categories
   * - **Link Previews**: Service names, URLs, descriptions for external content
   * - **File Attachments**: Upload notifications, filenames, extensions by type
   * - **Images**: Source indicators, markdown formats, device sources
   * - **Avatars**: Slack-specific avatar URL patterns and domains
   * - **Service Integrations**: GitHub, external service additions and metadata
   * - **Preview Blocks**: Slack's preview block formatting structures
   *
   * @private Readonly pattern collection for internal processor use
   */
  private readonly patterns = {
    // Link preview patterns
    linkPreviewTitle: /^(?:Google Docs|Notion|GitHub|Twitter|YouTube|Wikipedia|Stack Overflow)/i,
    linkPreviewUrl: /^https?:\/\/[^\s]+$/,
    linkPreviewDescription: /^.{10,500}$/, // Reasonable description length

    // File attachment patterns
    fileUpload: /uploaded a file:/i,
    fileName: /^(.+?)(?:\s*\([\d.]+\s*[KMGT]?B\))?$/, // Filename with optional size
    imageExtension: /\.(png|jpg|jpeg|gif|webp|svg)$/i,
    documentExtension: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,
    codeExtension: /\.(js|ts|py|java|c|cpp|go|rs|rb|php)$/i,

    // Image patterns
    imageFromSource: /^Image from (iOS|Android|Desktop)$/i,
    imageMarkdown: /^!\[([^\]]*)\]\(([^)]+)\)$/,

    // Avatar patterns (Slack-specific)
    avatarUrl: /^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/,
    slackAvatarDomain: /^https:\/\/ca\.slack-edge\.com\//,

    // Preview blocks
    previewBlockStart: /^\s*\[\s*$/,
    previewBlockEnd: /^\s*\]\(https?:\/\/[^)]+\)\s*$/,

    // GitHub/service patterns
    addedByService: /📎\s*Added by\s*\[([^\]]+)\]\([^)]+\)/,
    fileCount: /📎\s*(\d+)\s*files?/,

    // Repository/project patterns
    repoName: /^[\w-]+\/[\w-]+$/,
  };

  /**
   * Process attachment-related content through comprehensive transformation pipeline.
   *
   * This method orchestrates the complete attachment processing workflow, applying
   * multiple specialized transformations in the correct order to handle complex
   * attachment content effectively. Each transformation step is applied independently
   * with change tracking for optimal performance.
   *
   * ## Processing Pipeline
   * 1. **Input Validation**: Ensure text input is valid and processable
   * 2. **File Upload Processing**: Transform file upload notifications
   * 3. **Image Processing**: Clean image references and markdown
   * 4. **Link Preview Processing**: Simplify complex preview blocks
   * 5. **Service Addition Processing**: Format GitHub and service integrations
   * 6. **File Count Processing**: Handle multi-file summaries
   * 7. **Avatar Processing**: Context-aware avatar handling
   *
   * ## Change Tracking
   * Each processing step tracks modifications independently, allowing the processor
   * to report whether any transformations were applied. This enables efficient
   * pipeline optimization and debugging.
   *
   * ## Error Handling
   * - Comprehensive try-catch around entire processing pipeline
   * - Individual error handling within each transformation method
   * - Graceful fallback to original content if any step fails
   * - Warning-level logging for processing errors (non-critical)
   *
   * @param {string} text - Input text containing potential attachment content
   * @returns {ProcessorResult<string>} Processed text with modification status
   * @throws {Error} Processing errors are caught and logged, original content returned
   * @example
   * ```typescript
   * const processor = new AttachmentProcessor();
   *
   * // Multiple attachment types in one text
   * const complexText = `Alice uploaded a file: document.pdf
   * Bob uploaded a file: image.png
   * GitHub
   * https://github.com/example/repo
   * A sample repository
   * Image from iOS
   * ![Photo](https://example.com/photo.jpg)
   * 📎 Added by [GitHub](https://github.com)`;
   *
   * const result = processor.process(complexText);
   * console.log(`Modified: ${result.modified}`);
   * console.log('Processed content:', result.content);
   * // Output shows clean formatting with appropriate emoji indicators
   * ```
   */
  process(text: string): ProcessorResult<string> {
    // Validate input
    const validationResult = this.validateStringInput(text);
    if (validationResult) {
      return validationResult;
    }

    try {
      let processed = text;
      let modified = false;

      // Handle file uploads
      const afterFileUploads = this.processFileUploads(processed);
      if (afterFileUploads !== processed) {
        processed = afterFileUploads;
        modified = true;
      }

      // Handle image references
      const afterImages = this.processImages(processed);
      if (afterImages !== processed) {
        processed = afterImages;
        modified = true;
      }

      // Handle link previews
      const afterLinkPreviews = this.processLinkPreviews(processed);
      if (afterLinkPreviews !== processed) {
        processed = afterLinkPreviews;
        modified = true;
      }

      // Handle GitHub/service additions
      const afterServiceAdditions = this.processServiceAdditions(processed);
      if (afterServiceAdditions !== processed) {
        processed = afterServiceAdditions;
        modified = true;
      }

      // Handle file count summaries
      const afterFileCounts = this.processFileCounts(processed);
      if (afterFileCounts !== processed) {
        processed = afterFileCounts;
        modified = true;
      }

      // Handle avatar patterns
      const afterAvatars = this.processAvatars(processed);
      if (afterAvatars !== processed) {
        processed = afterAvatars;
        modified = true;
      }

      return { content: processed, modified };
    } catch (error) {
      Logger.warn('AttachmentProcessor', 'Error processing attachments', error);
      return { content: text, modified: false };
    }
  }

  /**
   * Process file upload notifications into formatted, emoji-enhanced representations.
   *
   * Transforms Slack's standard file upload format ("user uploaded a file: filename")
   * into a more readable format with appropriate file type emoji indicators and
   * emphasis formatting. The method intelligently determines file types based on
   * extensions and applies appropriate visual indicators.
   *
   * ## File Type Detection
   * - **Images** (🖼️): .png, .jpg, .jpeg, .gif, .webp, .svg
   * - **Documents** (📄): .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx
   * - **Code Files** (💻): .js, .ts, .py, .java, .c, .cpp, .go, .rs, .rb, .php
   * - **Generic Files** (📎): All other file types
   *
   * ## Output Format
   * `{emoji} {username} uploaded: **{filename}**`
   *
   * @param {string} text - Text containing potential file upload notifications
   * @returns {string} Text with transformed upload notifications
   * @private Internal method for file upload processing
   * @example
   * ```typescript
   * // Internal usage within main process method
   * const input = "Alice uploaded a file: presentation.pptx\nBob uploaded a file: code.js";
   * const output = this.processFileUploads(input);
   * // Output: "📄 Alice uploaded: **presentation.pptx**\n💻 Bob uploaded: **code.js**"
   * ```
   */
  private processFileUploads(text: string): string {
    return text.replace(/(.+?)\s+uploaded a file:\s*(.+)/gi, (match, user, fileName) => {
      try {
        // Clean up the filename
        const cleanName = fileName.trim();

        // Determine file type
        let fileType = '📎';
        if (this.patterns.imageExtension.test(cleanName)) {
          fileType = '🖼️';
        } else if (this.patterns.documentExtension.test(cleanName)) {
          fileType = '📄';
        } else if (this.patterns.codeExtension.test(cleanName)) {
          fileType = '💻';
        }

        return `${fileType} ${user} uploaded: **${cleanName}**`;
      } catch (error) {
        Logger.warn('AttachmentProcessor', 'Error processing file upload:', error);
        return match;
      }
    });
  }

  /**
   * Process image references and clean up image syntax with device source formatting.
   *
   * Handles various image-related patterns in Slack messages, including device source
   * indicators ("Image from iOS") and image markdown formatting. Ensures proper
   * markdown syntax and adds visual emphasis to image source information.
   *
   * ## Image Processing Features
   * - **Device Source Formatting**: "Image from iOS/Android/Desktop" → "🖼️ _Image from X_"
   * - **Markdown Validation**: Ensures image markdown has valid URLs and clean alt text
   * - **Alt Text Cleaning**: Provides fallback alt text when missing
   * - **URL Validation**: Verifies image URLs are properly formatted
   *
   * ## Error Handling
   * - Invalid URLs are preserved in original format
   * - Malformed markdown is logged but preserved
   * - Processing errors don't break the transformation pipeline
   *
   * @param {string} text - Text containing potential image references
   * @returns {string} Text with cleaned and formatted image references
   * @private Internal method for image processing
   * @example
   * ```typescript
   * // Internal usage within main process method
   * const input = "Image from iOS\n![](https://example.com/image.png)\n![Bad URL](invalid-url)";
   * const output = this.processImages(input);
   * // Output: "🖼️ _Image from iOS_\n![Image](https://example.com/image.png)\n![Bad URL](invalid-url)"
   * ```
   */
  private processImages(text: string): string {
    // Handle "Image from X" lines
    text = text.replace(this.patterns.imageFromSource, '🖼️ _$&_');

    // Ensure image markdown is properly formatted
    text = text.replace(this.patterns.imageMarkdown, (match, alt, url) => {
      try {
        // Validate URL
        new URL(url);
        // Clean alt text
        const cleanAlt = alt.trim() || 'Image';
        return `![${cleanAlt}](${url})`;
      } catch (error) {
        Logger.warn('AttachmentProcessor', 'Error processing image markdown:', error);
        return match;
      }
    });

    return text;
  }

  /**
   * Process and simplify complex link previews into concise, readable representations.
   *
   * This method handles Slack's multi-line link preview blocks, which often contain
   * service names, URLs, descriptions, and metadata. It analyzes the structure of
   * these previews and condenses them into clean, single-line representations while
   * preserving essential information.
   *
   * ## Link Preview Structure Detection
   * 1. **Preview Identification**: Recognize known service patterns and structures
   * 2. **Content Extraction**: Extract title, URL, and description components
   * 3. **Block Boundary Detection**: Determine where previews start and end
   * 4. **Context Analysis**: Consider surrounding content for accurate processing
   *
   * ## Supported Preview Types
   * - **Service Previews**: GitHub, Google Docs, Notion, Twitter, YouTube, etc.
   * - **Repository Previews**: GitHub repositories with metadata
   * - **Generic URL Previews**: Any URL with associated title/description
   * - **Doubled Title Previews**: Common Slack rendering artifact
   *
   * ## Output Format
   * `🔗 [Title](URL) — _Description_` (components included as available)
   *
   * @param {string} text - Text containing potential link preview blocks
   * @returns {string} Text with simplified link preview representations
   * @private Internal method for link preview processing
   * @complexity O(n*m) where n=number of lines, m=average lookahead distance
   * @example
   * ```typescript
   * // Internal usage within main process method
   * const input = `GitHub
   * https://github.com/user/awesome-repo
   * An awesome repository for developers
   * Language
   * TypeScript
   * Last updated 3 hours ago`;
   * const output = this.processLinkPreviews(input);
   * // Output: "🔗 [GitHub](https://github.com/user/awesome-repo) — _An awesome repository for developers_"
   * ```
   * @see {@link looksLikeLinkPreview} - Preview detection logic
   * @see {@link formatLinkPreview} - Preview formatting logic
   */
  private processLinkPreviews(text: string): string {
    const lines = text.split('\n');
    const processed: string[] = [];
    let inLinkPreview = false;
    let previewData: { title?: string; url?: string; description?: string } = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if we're starting a link preview block
      if (!inLinkPreview && this.looksLikeLinkPreview(trimmed, lines, i)) {
        inLinkPreview = true;
        previewData = {};

        // Try to extract title
        if (this.patterns.linkPreviewTitle.test(trimmed)) {
          previewData.title = trimmed;
          continue;
        }
      }

      // If we're in a link preview, try to extract data
      if (inLinkPreview) {
        // Check for URL
        if (this.patterns.linkPreviewUrl.test(trimmed)) {
          previewData.url = trimmed;
          continue;
        }

        // Check for description
        if (!previewData.description && this.patterns.linkPreviewDescription.test(trimmed)) {
          previewData.description = trimmed;
          continue;
        }

        // Check if preview is ending
        if (trimmed === '' || this.isEndOfPreview(trimmed, lines, i)) {
          inLinkPreview = false;

          // Format the preview
          const formattedPreview = this.formatLinkPreview(previewData);
          if (formattedPreview) {
            processed.push(formattedPreview);
          }

          // Add the current line if it's not empty
          if (trimmed !== '') {
            processed.push(line);
          }
          continue;
        }
      }

      // Normal line processing
      if (!inLinkPreview) {
        processed.push(line);
      }
    }

    // Handle case where preview was at end of text
    if (inLinkPreview && Object.keys(previewData).length > 0) {
      const formattedPreview = this.formatLinkPreview(previewData);
      if (formattedPreview) {
        processed.push(formattedPreview);
      }
    }

    return processed.join('\n');
  }

  /**
   * Check if current position looks like the start of a link preview block.
   *
   * This method analyzes the current line and surrounding context to determine
   * if it represents the beginning of a Slack link preview. It uses multiple
   * detection strategies to handle various preview formats and service types.
   *
   * ## Detection Strategies
   * 1. **Known Service Patterns**: Recognize titles from common services
   * 2. **Repository Patterns**: Detect GitHub-style repository names
   * 3. **Doubled Title Patterns**: Identify Slack rendering artifacts
   * 4. **Context Validation**: Verify patterns with lookahead analysis
   *
   * ## Lookahead Analysis
   * - Maximum 3-5 lines lookahead depending on pattern type
   * - Search for confirming patterns (URLs, metadata, language indicators)
   * - Balance accuracy with performance
   *
   * @param {string} line - Current line to analyze
   * @param {string[]} lines - Complete array of text lines for context
   * @param {number} index - Current position in the lines array
   * @returns {boolean} True if position appears to start a link preview
   * @private Internal helper for preview boundary detection
   * @example
   * ```typescript
   * // Internal usage within processLinkPreviews
   * const lines = ['Regular text', 'GitHub', 'https://github.com/user/repo', 'Description'];
   * const isPreview = this.looksLikeLinkPreview('GitHub', lines, 1); // true
   * const notPreview = this.looksLikeLinkPreview('Regular text', lines, 0); // false
   * ```
   */
  private looksLikeLinkPreview(line: string, lines: string[], index: number): boolean {
    // Check if it's a known preview title
    if (this.patterns.linkPreviewTitle.test(line)) {
      // Look ahead for URL
      for (let i = index + 1; i < Math.min(index + 3, lines.length); i++) {
        if (this.patterns.linkPreviewUrl.test(lines[i].trim())) {
          return true;
        }
      }
    }

    // Check for GitHub repository patterns (common link previews)
    if (this.patterns.repoName.test(line)) {
      // Look ahead for "Language", "Last updated" or other GitHub metadata
      for (let i = index + 1; i < Math.min(index + 5, lines.length); i++) {
        const nextLine = lines[i].trim();
        if (/^(Language|Last updated|Added by \[GitHub\])$/i.test(nextLine)) {
          return true;
        }
      }
    }

    // Check for doubled title patterns (common in Slack link previews)
    const doubledPattern = /^([A-Za-z\u00C0-\u017F]+)\1$/;
    if (doubledPattern.test(line) && line.length > 6) {
      // Look ahead for metadata or URL
      for (let i = index + 1; i < Math.min(index + 3, lines.length); i++) {
        const nextLine = lines[i].trim();
        if (
          this.patterns.linkPreviewUrl.test(nextLine) ||
          /^(Language|Last updated)$/i.test(nextLine)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if we're at the end of a link preview block using contextual analysis.
   *
   * This method determines preview boundaries by analyzing content patterns that
   * typically indicate the end of Slack link preview blocks. It considers various
   * termination patterns including empty lines, service metadata, and message boundaries.
   *
   * ## Termination Patterns
   * - **Empty Lines**: Standard preview block separator
   * - **Service Metadata**: "Added by [Service]" patterns
   * - **Message Boundaries**: Avatar patterns, timestamps, usernames
   * - **Reaction Indicators**: Emoji reactions or social interaction markers
   * - **Thread Metadata**: Reply counts, thread navigation elements
   *
   * ## Context Analysis
   * - Examines current line and next line for boundary indicators
   * - Considers message flow patterns
   * - Balances accuracy with robust boundary detection
   *
   * @param {string} line - Current line to analyze
   * @param {string[]} lines - Complete array of text lines for context
   * @param {number} index - Current position in the lines array
   * @returns {boolean} True if position appears to end a link preview
   * @private Internal helper for preview boundary detection
   * @example
   * ```typescript
   * // Internal usage within processLinkPreviews
   * const lines = ['Description text', 'Added by [GitHub]', '![Avatar](url)', 'User message'];
   * const isEnd1 = this.isEndOfPreview('Added by [GitHub]', lines, 1); // true
   * const isEnd2 = this.isEndOfPreview('Description text', lines, 0); // false
   * ```
   */
  private isEndOfPreview(line: string, lines: string[], index: number): boolean {
    // Empty line usually ends preview
    if (line === '') return true;

    // Check if this line looks like the end of GitHub integration metadata
    if (/^Added by \[GitHub\]$/i.test(line)) {
      return true;
    }

    // Check if next line looks like a new message or reaction
    if (index + 1 < lines.length) {
      const nextLine = lines[index + 1].trim();

      // Reactions or emoji patterns indicate end of preview
      if (/^![:\[].*?[:\]]\([^)]+\)\d+/i.test(nextLine) || /^:[a-zA-Z0-9_+-]+:$/i.test(nextLine)) {
        return true;
      }

      // Avatar patterns indicate start of new message
      if (/^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/i.test(nextLine)) {
        return true;
      }

      // Common message start patterns
      if (
        /^[A-Za-z0-9\s\-_.]+.*\[[^\]]+\]\(https?:\/\/[^)]+\)$/i.test(nextLine) ||
        /^\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(nextLine)
      ) {
        return true;
      }

      // Thread metadata patterns
      if (
        /^\d+\s+repl(?:y|ies)/i.test(nextLine) ||
        /^View thread$/i.test(nextLine) ||
        /^Last reply/i.test(nextLine)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Format a link preview into a concise, readable representation.
   *
   * Takes extracted preview data (title, URL, description) and creates a clean,
   * single-line representation that preserves essential information while improving
   * readability. Handles missing components gracefully and applies appropriate formatting.
   *
   * ## Formatting Logic
   * - **Full Preview**: `🔗 [Title](URL) — _Description_`
   * - **URL Only**: `🔗 <URL>`
   * - **Title Only**: `🔗 **Title**`
   * - **With Link**: `🔗 [Title](URL)` (no description)
   *
   * ## Description Handling
   * - Truncates long descriptions to 100 characters
   * - Adds ellipsis for truncated content
   * - Applies italic formatting for visual distinction
   *
   * @param {Object} data - Extracted preview data
   * @param {string} [data.title] - Preview title or service name
   * @param {string} [data.url] - Preview URL
   * @param {string} [data.description] - Preview description or summary
   * @returns {string} Formatted preview string or empty string if no valid data
   * @private Internal helper for preview formatting
   * @example
   * ```typescript
   * // Internal usage within processLinkPreviews
   * const fullPreview = this.formatLinkPreview({
   *   title: 'GitHub Repository',
   *   url: 'https://github.com/user/repo',
   *   description: 'A comprehensive example repository with great documentation'
   * });
   * // Returns: "🔗 [GitHub Repository](https://github.com/user/repo) — _A comprehensive example repository with great documentation_"
   *
   * const urlOnly = this.formatLinkPreview({ url: 'https://example.com' });
   * // Returns: "🔗 <https://example.com>"
   * ```
   */
  private formatLinkPreview(data: { title?: string; url?: string; description?: string }): string {
    if (!data.url && !data.title) return '';

    const parts: string[] = ['🔗'];

    if (data.title && data.url) {
      parts.push(`[${data.title}](${data.url})`);
    } else if (data.url) {
      parts.push(`<${data.url}>`);
    } else if (data.title) {
      parts.push(`**${data.title}**`);
    }

    if (data.description) {
      // Truncate long descriptions
      const desc =
        data.description.length > 100
          ? data.description.substring(0, 100) + '...'
          : data.description;
      parts.push(`— _${desc}_`);
    }

    return parts.join(' ');
  }

  /**
   * Process avatar patterns by filtering or preserving them based on contextual analysis.
   *
   * Slack avatar images can appear in various contexts - some meaningful (thread headers)
   * and others redundant (standalone decorative elements). This method analyzes the
   * context around avatar patterns to make intelligent preservation decisions.
   *
   * ## Avatar Context Analysis
   * - **Thread Headers**: Avatars followed by username/timestamp patterns (preserve)
   * - **Message Context**: Avatars associated with substantial content (preserve)
   * - **Standalone Decorative**: Isolated avatars with no context (filter)
   * - **Metadata Associations**: Avatars near attachment metadata (conditional)
   *
   * ## Processing Strategy
   * 1. **Pattern Identification**: Detect Slack avatar URL patterns
   * 2. **Context Analysis**: Examine surrounding lines for meaningful associations
   * 3. **Preservation Decision**: Apply contextual rules for keep/filter decision
   * 4. **Format Transformation**: Convert preserved avatars to HTML comments
   *
   * @param {string} text - Text containing potential avatar patterns
   * @returns {string} Text with avatars filtered or preserved based on context
   * @private Internal method for avatar processing
   * @example
   * ```typescript
   * // Internal usage within main process method
   * const withContext = `![](https://ca.slack-edge.com/avatar123)
   * Alice Smith [2:30 PM](https://workspace.slack.com/...)
   * This is an important message with substantial content`;
   * const contextResult = this.processAvatars(withContext);
   * // Preserves avatar as: "<!-- Avatar: ![](https://ca.slack-edge.com/avatar123) -->"
   *
   * const standalone = `![](https://ca.slack-edge.com/avatar456)
   * :thumbsup: 3`;
   * const standaloneResult = this.processAvatars(standalone);
   * // Filters out standalone avatar, keeps only emoji reaction
   * ```
   * @see {@link shouldPreserveAvatar} - Context-based preservation logic
   */
  private processAvatars(text: string): string {
    const lines = text.split('\n');
    const processed: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this is a standalone avatar line
      if (this.isStandaloneAvatar(trimmed)) {
        // Check context to decide whether to preserve or filter
        const shouldPreserve = this.shouldPreserveAvatar(lines, i);

        if (shouldPreserve) {
          // Preserve avatar with a comment for clarity
          processed.push(`<!-- Avatar: ${trimmed} -->`);
        } else {
          // Filter out standalone avatars that are not part of message context
          continue;
        }
      } else {
        processed.push(line);
      }
    }

    return processed.join('\n');
  }

  /**
   * Check if a line contains only a standalone avatar image pattern.
   *
   * Identifies lines that consist solely of Slack avatar image markdown,
   * which helps distinguish between meaningful avatar placements and
   * decorative or redundant avatar elements.
   *
   * @param {string} line - Text line to check for standalone avatar pattern
   * @returns {boolean} True if line contains only a Slack avatar image
   * @private Internal helper for avatar detection
   * @example
   * ```typescript
   * // Internal usage in avatar processing
   * const standalone = this.isStandaloneAvatar('![](https://ca.slack-edge.com/T123/avatar.png)'); // true
   * const withText = this.isStandaloneAvatar('![](https://ca.slack-edge.com/T123/avatar.png) User message'); // false
   * ```
   */
  private isStandaloneAvatar(line: string): boolean {
    return this.patterns.avatarUrl.test(line);
  }

  /**
   * Determine if an avatar should be preserved based on surrounding content context.
   *
   * Analyzes the context around an avatar to determine its importance and relevance.
   * Avatars that are part of meaningful message structures (like thread headers) or
   * associated with substantial content are preserved, while isolated decorative
   * avatars are filtered out.
   *
   * ## Context Analysis Rules
   * 1. **Thread Format Detection**: Avatar + username/timestamp pattern (preserve)
   * 2. **Content Association**: Avatar near substantial content >20 chars (preserve)
   * 3. **Metadata Context**: Avatar only near attachment metadata (filter)
   * 4. **Isolation Check**: Avatar with no meaningful context (filter)
   *
   * ## Lookahead Strategy
   * - Examines up to 5 lines following the avatar
   * - Filters out attachment metadata when assessing content
   * - Requires substantial content for preservation decision
   *
   * @param {string[]} lines - Complete array of text lines for context analysis
   * @param {number} index - Position of avatar line in the array
   * @returns {boolean} True if avatar should be preserved, false to filter
   * @private Internal helper for context-based avatar preservation
   * @example
   * ```typescript
   * // Internal usage within processAvatars
   * const lines1 = [
   *   '![](avatar-url)',
   *   'Alice Smith [2:30 PM](link)',
   *   'This is an important message with substantial content'
   * ];
   * const preserve = this.shouldPreserveAvatar(lines1, 0); // true (thread format)
   *
   * const lines2 = [
   *   '![](avatar-url)',
   *   ':thumbsup: 3'
   * ];
   * const filter = this.shouldPreserveAvatar(lines2, 0); // false (no substantial content)
   * ```
   */
  private shouldPreserveAvatar(lines: string[], index: number): boolean {
    // Check if the avatar is immediately followed by a username line
    // This indicates it's part of a thread format message header
    if (index + 1 < lines.length) {
      const nextLine = lines[index + 1].trim();
      // Check if next line looks like a username with timestamp (thread format)
      if (/^[A-Za-z0-9\s\-_.'\u00C0-\u017F]+.*\[[^\]]+\]\(https?:\/\/[^)]+\)$/i.test(nextLine)) {
        return true;
      }
    }

    // Check if the avatar is part of a message that has substantial content
    // Look ahead for content lines that aren't just metadata
    for (let i = index + 1; i < Math.min(index + 5, lines.length); i++) {
      const line = lines[i].trim();
      if (line && !this.isAttachmentMetadata(line) && line.length > 20) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a line should be classified as attachment metadata rather than content.
   *
   * Identifies various types of attachment-related metadata that should be considered
   * supplementary information rather than primary content. This helps distinguish
   * between meaningful message content and technical metadata when making processing
   * decisions.
   *
   * ## Metadata Categories
   * - **Avatar Patterns**: Slack avatar image URLs
   * - **Preview Blocks**: Slack preview formatting structures
   * - **File Metadata**: File counts, download links, type information
   * - **Service Metadata**: Language indicators, timestamps, technical details
   *
   * ## Detection Patterns
   * - File operations: "Download", "Open in browser", "Preview not available"
   * - File properties: "File type:", "File size:", numbered file counts
   * - Development metadata: "Language", "TypeScript", "Last updated"
   * - Temporal indicators: Time expressions like "2 hours ago"
   *
   * @param {string} line - Text line to analyze for metadata patterns
   * @returns {boolean} True if line appears to be attachment metadata
   * @public Public method for external metadata detection
   * @example
   * ```typescript
   * const processor = new AttachmentProcessor();
   *
   * console.log(processor.isAttachmentMetadata('Download')); // true
   * console.log(processor.isAttachmentMetadata('File size: 2.3 MB')); // true
   * console.log(processor.isAttachmentMetadata('This is a user message')); // false
   * console.log(processor.isAttachmentMetadata('Language')); // true
   * console.log(processor.isAttachmentMetadata('3 files')); // true
   * ```
   */
  isAttachmentMetadata(line: string): boolean {
    const trimmed = line.trim();

    // Avatar patterns are metadata that should be handled specially
    if (this.patterns.avatarUrl.test(trimmed)) {
      return true;
    }

    // File preview brackets
    if (
      this.patterns.previewBlockStart.test(trimmed) ||
      this.patterns.previewBlockEnd.test(trimmed)
    ) {
      return true;
    }

    // Common attachment-related lines to filter
    const metadataPatterns = [
      /^\d+\s+files?$/i,
      /^Download$/i,
      /^Open in browser$/i,
      /^Preview not available$/i,
      /^File type: .+$/i,
      /^File size: .+$/i,
      /^Language$/i,
      /^TypeScript$/i,
      /^Last updated$/i,
      /^\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\s+ago$/i,
    ];

    return metadataPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Process "Added by [Service]" patterns into formatted service attribution.
   *
   * Transforms Slack's service integration attribution patterns into clean,
   * visually distinct format with appropriate emoji indicators. This helps
   * identify content sources while maintaining readability.
   *
   * ## Pattern Transformation
   * `📎 Added by [ServiceName](url)` → `📎 _Added by ServiceName_`
   *
   * @param {string} text - Text containing potential service attribution patterns
   * @returns {string} Text with formatted service attributions
   * @private Internal method for service attribution processing
   * @example
   * ```typescript
   * // Internal usage within main process method
   * const input = "📎 Added by [GitHub](https://github.com)";
   * const output = this.processServiceAdditions(input);
   * // Output: "📎 _Added by GitHub_"
   * ```
   */
  private processServiceAdditions(text: string): string {
    return text.replace(this.patterns.addedByService, (match, service) => {
      return `📎 _Added by ${service}_`;
    });
  }

  /**
   * Process file count patterns for multi-file attachment summaries.
   *
   * Currently preserves file count patterns as-is for compatibility.
   * Future enhancements could extract actual file names from surrounding
   * context or provide more detailed file information.
   *
   * ## Current Behavior
   * - Preserves existing file count format
   * - No transformation applied
   * - Maintains compatibility with existing content
   *
   * ## Future Enhancements
   * - Extract individual file names from context
   * - Provide detailed file type breakdown
   * - Create expandable file lists
   *
   * @param {string} text - Text containing potential file count patterns
   * @returns {string} Text with file count patterns (currently unchanged)
   * @private Internal method for file count processing
   * @example
   * ```typescript
   * // Internal usage within main process method
   * const input = "📎 3 files";
   * const output = this.processFileCounts(input);
   * // Output: "📎 3 files" (preserved as-is)
   * ```
   */
  private processFileCounts(text: string): string {
    // For now, just preserve the pattern as-is
    // In the future, could try to extract actual file names from context
    return text;
  }
}
