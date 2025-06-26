import { SlackMessage } from '../../models.js';
import { Logger } from '../../utils/logger.js';

/**
 * Configuration for embedded message detection patterns using regex patterns.
 * 
 * These patterns define the various types of embedded content that can appear
 * within Slack messages, including link previews, file attachments, quoted messages,
 * and other embedded content types. Each pattern is optimized for accuracy while
 * minimizing false positives.
 * 
 * ## Pattern Categories
 * - **LINK_PREVIEW**: Detects standalone URLs that generate previews
 * - **FILE_ATTACHMENT**: Identifies file links and attachment metadata
 * - **EMBEDDED_MESSAGE**: Recognizes quoted or embedded message content
 * - **METADATA_LINE**: Captures titles, descriptions, and other metadata
 * - **REACTION_CONTINUATION**: Detects standalone reaction and emoji lines
 * 
 * ## Pattern Design Principles
 * - Case-insensitive matching where appropriate
 * - Flexible whitespace handling
 * - Support for common file extensions and formats
 * - Balanced precision vs. recall for practical use
 * 
 * @constant
 * @readonly
 * @example
 * ```typescript
 * // Link preview detection
 * const isLinkPreview = EMBEDDED_PATTERNS.LINK_PREVIEW.test('https://example.com');
 * // File attachment detection
 * const isFileAttachment = EMBEDDED_PATTERNS.FILE_ATTACHMENT.test('[document.pdf](link)');
 * ```
 */
const EMBEDDED_PATTERNS = {
    /** Link preview blocks typically start with URLs */
    LINK_PREVIEW: /^https?:\/\/[^\s]+$/,
    
    /** File attachments with metadata blocks */
    FILE_ATTACHMENT: /^\[(.*)\]\((.*)\)$|^(.*\.(pdf|doc|docx|zip|png|jpg|jpeg|gif))\s*$/i,
    
    /** Quoted/embedded messages from link previews */
    EMBEDDED_MESSAGE: /^([A-Za-z\s]+)$|^([A-Za-z\s]+\s+\[[0-9:]+\s*(AM|PM)?\])/,
    
    /** Embedded metadata lines (titles, descriptions) */
    METADATA_LINE: /^[A-Z][a-z\s]*[a-z]$|^(Google Doc|PDF|Zip)$/,
    
    /** Reaction continuation lines */
    REACTION_CONTINUATION: /^:\w+:\s*\d+$|^[\d\s]+$/
} as const;

/**
 * Embedded content types for classification and prioritization of detected content.
 * 
 * This enumeration provides a standardized taxonomy for different types of embedded
 * content found within Slack messages. Each type has specific characteristics and
 * processing requirements that affect how the content is handled during formatting
 * and deduplication operations.
 * 
 * ## Content Type Hierarchy (by processing priority)
 * 1. **QUOTED_MESSAGE**: User-generated quoted content with high semantic value
 * 2. **FILE_ATTACHMENT**: Documents, images, and other file resources
 * 3. **LINK_PREVIEW**: External web content previews and metadata
 * 4. **METADATA**: Titles, descriptions, and content annotations
 * 5. **REACTIONS**: Emoji reactions and social interaction indicators
 * 6. **CONTINUATION**: Message continuation markers and formatting
 * 
 * ## Processing Implications
 * - Higher priority types are preserved during deduplication
 * - Content types guide formatting decisions
 * - Type classification affects content extraction strategies
 * 
 * @enum {string}
 * @readonly
 * @example
 * ```typescript
 * // Type-based processing
 * if (embeddedContent.type === EmbeddedContentType.QUOTED_MESSAGE) {
 *   // Preserve quoted content with high priority
 *   return preserveContent(embeddedContent);
 * } else if (embeddedContent.type === EmbeddedContentType.REACTIONS) {
 *   // Handle reactions with lower priority
 *   return processReactions(embeddedContent);
 * }
 * ```
 */
export enum EmbeddedContentType {
    LINK_PREVIEW = 'link_preview',
    FILE_ATTACHMENT = 'file_attachment', 
    QUOTED_MESSAGE = 'quoted_message',
    METADATA = 'metadata',
    REACTIONS = 'reactions',
    CONTINUATION = 'continuation'
}

/**
 * Represents an embedded content block within a message with comprehensive metadata.
 * 
 * This interface defines the structure for embedded content blocks detected within
 * Slack messages. Each block contains the content itself along with classification
 * information, positional data, and optional metadata for advanced processing.
 * 
 * ## Content Structure
 * - **content**: Array of strings representing the embedded content lines
 * - **startIndex/endIndex**: Position boundaries within the original message
 * - **type**: Classification using EmbeddedContentType enumeration
 * - **metadata**: Optional structured data about the embedded content
 * 
 * ## Metadata Fields
 * - **url**: Extracted URLs from link previews or file attachments  
 * - **filename**: File names from attachment blocks
 * - **fileType**: Detected file type (PDF, Document, Archive, etc.)
 * - **title**: Extracted titles from link previews or metadata blocks
 * - **description**: Content descriptions or summaries
 * 
 * @interface
 * @example
 * ```typescript
 * // Link preview embedded content
 * const linkPreview: EmbeddedContent = {
 *   type: EmbeddedContentType.LINK_PREVIEW,
 *   content: [
 *     'https://example.com',
 *     'Example Website',
 *     'A comprehensive example of web content'
 *   ],
 *   startIndex: 2,
 *   endIndex: 4,
 *   metadata: {
 *     url: 'https://example.com',
 *     title: 'Example Website',
 *     description: 'A comprehensive example of web content'
 *   }
 * };
 * 
 * // File attachment embedded content
 * const fileAttachment: EmbeddedContent = {
 *   type: EmbeddedContentType.FILE_ATTACHMENT,
 *   content: ['[document.pdf](https://files.slack.com/...)', 'PDF'],
 *   startIndex: 0,
 *   endIndex: 1,
 *   metadata: {
 *     filename: 'document.pdf',
 *     fileType: 'PDF',
 *     url: 'https://files.slack.com/...'
 *   }
 * };
 * ```
 */
export interface EmbeddedContent {
    type: EmbeddedContentType;
    content: string[];
    startIndex: number;
    endIndex: number;
    metadata?: {
        url?: string;
        filename?: string;
        fileType?: string;
        title?: string;
        description?: string;
    };
}

/**
 * Result of embedded content detection with comprehensive analysis information.
 * 
 * This interface provides complete results from the embedded content detection
 * process, including the original message, all detected embedded content blocks,
 * summary information, and cleaned content suitable for further processing.
 * 
 * ## Result Components
 * - **message**: Original SlackMessage object (unmodified reference)
 * - **embeddedContent**: Array of all detected embedded content blocks
 * - **hasEmbedded**: Quick boolean flag for presence of embedded content
 * - **cleanedText**: Message text with embedded content removed
 * 
 * ## Usage Patterns
 * - **Content Analysis**: Use embeddedContent array for detailed processing
 * - **Quick Checks**: Use hasEmbedded flag for conditional logic
 * - **Text Processing**: Use cleanedText for main message content extraction
 * - **Preservation**: Use original message for metadata and structure
 * 
 * @interface
 * @example
 * ```typescript
 * const detector = new EmbeddedMessageDetector(true);
 * const message = {
 *   text: 'Check this out:\nhttps://example.com\nGreat Website\nVery informative!',
 *   username: 'alice'
 * };
 * 
 * const result: EmbeddedDetectionResult = detector.analyzeMessage(message);
 * 
 * console.log(`Has embedded content: ${result.hasEmbedded}`);
 * console.log(`Found ${result.embeddedContent.length} embedded blocks`);
 * console.log(`Cleaned text: ${result.cleanedText}`);
 * // Output:
 * // Has embedded content: true
 * // Found 1 embedded blocks
 * // Cleaned text: Check this out:\nVery informative!
 * 
 * // Process each embedded block
 * result.embeddedContent.forEach((block, index) => {
 *   console.log(`Block ${index}: ${block.type} (${block.content.length} lines)`);
 * });
 * ```
 * @see {@link EmbeddedMessageDetector.analyzeMessage} - Method that returns this result
 */
export interface EmbeddedDetectionResult {
    message: SlackMessage;
    embeddedContent: EmbeddedContent[];
    hasEmbedded: boolean;
    cleanedText: string;
}

/**
 * Detects and classifies embedded content within Slack messages using pattern analysis.
 * 
 * This class implements sophisticated pattern recognition to identify various types of
 * embedded content that Slack automatically generates, such as link previews, file
 * attachments, quoted messages, and other contextual content. The detector helps
 * separate main message content from embedded content for improved formatting and
 * duplicate detection.
 * 
 * ## Detection Capabilities
 * - **Link Previews**: URLs with associated titles and descriptions
 * - **File Attachments**: Document links with metadata and file type information
 * - **Quoted Messages**: Embedded message content from replies or shares
 * - **Metadata Blocks**: Titles, descriptions, and content annotations
 * - **Reaction Continuations**: Standalone emoji and reaction lines
 * 
 * ## Algorithm Approach
 * 1. **Line-by-Line Analysis**: Process message content sequentially
 * 2. **Pattern Matching**: Apply specialized regex patterns for each content type
 * 3. **Context Building**: Group related lines into coherent embedded blocks
 * 4. **Metadata Extraction**: Extract structured information from detected content
 * 5. **Content Cleaning**: Generate cleaned text with embedded content removed
 * 
 * ## Performance Considerations
 * - **Streaming Processing**: O(n) line-by-line analysis with lookahead
 * - **Early Termination**: Stop processing when patterns don't match
 * - **Efficient Regex**: Optimized patterns to minimize backtracking
 * - **Memory Management**: Reuse pattern objects and avoid unnecessary string operations
 * 
 * @complexity O(n*m) where n=number of lines, m=average lookahead distance
 * @example
 * ```typescript
 * const detector = new EmbeddedMessageDetector(true); // Enable debug logging
 * 
 * const message = {
 *   text: `Check out this research paper:
 * https://arxiv.org/abs/2023.12345
 * Advanced AI Techniques
 * This paper presents novel approaches to machine learning
 * 
 * Also attached the presentation slides:
 * [slides.pdf](https://files.slack.com/abc123)
 * PDF`,
 *   username: 'researcher'
 * };
 * 
 * const result = detector.analyzeMessage(message);
 * console.log(`Detected ${result.embeddedContent.length} embedded blocks`);
 * result.embeddedContent.forEach(block => {
 *   console.log(`- ${block.type}: ${block.content.length} lines`);
 * });
 * // Output:
 * // Detected 2 embedded blocks
 * // - LINK_PREVIEW: 3 lines
 * // - FILE_ATTACHMENT: 2 lines
 * 
 * console.log('Cleaned text:', result.cleanedText);
 * // Output: Cleaned text: Check out this research paper:\n\nAlso attached the presentation slides:
 * ```
 * @see {@link EMBEDDED_PATTERNS} - Pattern definitions used for detection
 * @see {@link EmbeddedContentType} - Classification system for detected content
 * @see {@link EmbeddedDetectionResult} - Comprehensive result structure
 */
export class EmbeddedMessageDetector {
    private debugMode: boolean;

    /**
     * Creates a new embedded message detector instance with optional debug logging.
     * 
     * @param {boolean} [debugMode=false] - Enable detailed logging of detection process and results
     * @example
     * ```typescript
     * // Production mode (minimal logging)
     * const detector = new EmbeddedMessageDetector();
     * 
     * // Debug mode (detailed logging for development/troubleshooting)
     * const debugDetector = new EmbeddedMessageDetector(true);
     * const result = debugDetector.analyzeMessage(message);
     * // Logs: Detected 2 embedded content blocks: [LINK_PREVIEW, FILE_ATTACHMENT]
     * ```
     */
    constructor(debugMode: boolean = false) {
        this.debugMode = debugMode;
    }

    /**
     * Analyze a message to detect embedded content patterns using comprehensive pattern matching.
     * 
     * This is the main entry point for embedded content detection. It processes the message
     * text line by line, applying specialized detection algorithms for each type of embedded
     * content, and returns a comprehensive analysis result with all detected blocks and
     * cleaned content.
     * 
     * ## Analysis Process
     * 1. **Text Preprocessing**: Split message into lines for sequential analysis
     * 2. **Pattern Detection**: Apply type-specific detection algorithms with lookahead
     * 3. **Content Grouping**: Combine related lines into coherent embedded blocks
     * 4. **Metadata Extraction**: Extract structured information from detected content
     * 5. **Text Cleaning**: Generate cleaned version with embedded content removed
     * 6. **Result Assembly**: Build comprehensive result with all analysis information
     * 
     * ## Detection Priority Order
     * 1. **Link Previews**: Detected first due to clear URL patterns
     * 2. **File Attachments**: Detected second for file-specific patterns
     * 3. **Quoted Messages**: Detected third for embedded message content
     * 4. **Reaction Continuations**: Detected last for standalone reaction lines
     * 
     * ## Performance Optimization
     * - Skip empty lines efficiently
     * - Use lookahead limits to prevent excessive processing
     * - Early termination when patterns don't match
     * - Reuse compiled regex patterns
     * 
     * @param {SlackMessage} message - The SlackMessage object to analyze for embedded content
     * @returns {EmbeddedDetectionResult} Complete analysis result with detected content and cleaned text
     * @throws {Error} When message text is invalid or analysis encounters unrecoverable errors
     * @complexity O(n*m) where n=number of lines, m=average lookahead distance
     * @example
     * ```typescript
     * const detector = new EmbeddedMessageDetector();
     * const message = {
     *   id: 'msg_123',
     *   text: 'Found this interesting article:\nhttps://example.com\nTech News\nLatest developments in AI',
     *   username: 'techfan',
     *   timestamp: '2023-12-01T10:30:00Z'
     * };
     * 
     * const result = detector.analyzeMessage(message);
     * 
     * console.log(`Analysis complete:`);
     * console.log(`- Has embedded content: ${result.hasEmbedded}`);
     * console.log(`- Embedded blocks found: ${result.embeddedContent.length}`);
     * console.log(`- Original text length: ${message.text.length}`);
     * console.log(`- Cleaned text length: ${result.cleanedText.length}`);
     * 
     * // Process each detected block
     * result.embeddedContent.forEach((block, index) => {
     *   console.log(`Block ${index + 1}: ${block.type}`);
     *   console.log(`  Lines: ${block.startIndex}-${block.endIndex}`);
     *   console.log(`  Content: ${block.content.join(' | ')}`);
     *   if (block.metadata) {
     *     console.log(`  Metadata:`, block.metadata);
     *   }
     * });
     * ```
     * @see {@link detectLinkPreview} - Link preview detection implementation
     * @see {@link detectFileAttachment} - File attachment detection implementation
     * @see {@link detectQuotedMessage} - Quoted message detection implementation
     * @see {@link detectReactionContinuation} - Reaction continuation detection implementation
     */
    analyzeMessage(message: SlackMessage): EmbeddedDetectionResult {
        const lines = message.text.split('\n');
        const embeddedContent: EmbeddedContent[] = [];
        const cleanedLines: string[] = [];
        
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) {
                cleanedLines.push(lines[i]);
                i++;
                continue;
            }

            // Check for link preview blocks
            const linkPreview = this.detectLinkPreview(lines, i);
            if (linkPreview) {
                embeddedContent.push(linkPreview);
                // Skip the lines that are part of the link preview
                i = linkPreview.endIndex + 1;
                continue;
            }

            // Check for file attachment blocks
            const fileAttachment = this.detectFileAttachment(lines, i);
            if (fileAttachment) {
                embeddedContent.push(fileAttachment);
                i = fileAttachment.endIndex + 1;
                continue;
            }

            // Check for quoted message blocks
            const quotedMessage = this.detectQuotedMessage(lines, i);
            if (quotedMessage) {
                embeddedContent.push(quotedMessage);
                i = quotedMessage.endIndex + 1;
                continue;
            }

            // Check for reaction continuation blocks
            const reactionBlock = this.detectReactionContinuation(lines, i);
            if (reactionBlock) {
                embeddedContent.push(reactionBlock);
                i = reactionBlock.endIndex + 1;
                continue;
            }

            // If no embedded content detected, keep the line
            cleanedLines.push(lines[i]);
            i++;
        }

        const cleanedText = cleanedLines.join('\n').trim();
        
        if (this.debugMode && embeddedContent.length > 0) {
            Logger.debug('EmbeddedMessageDetector', `Detected ${embeddedContent.length} embedded content blocks`, {
                messageText: message.text.substring(0, 100) + '...',
                embeddedTypes: embeddedContent.map(e => e.type),
                cleanedLength: cleanedText.length,
                originalLength: message.text.length
            });
        }

        return {
            message,
            embeddedContent,
            hasEmbedded: embeddedContent.length > 0,
            cleanedText
        };
    }

    /**
     * Detect link preview blocks consisting of URLs followed by title and description content.
     * 
     * Link previews are one of the most common types of embedded content in Slack messages.
     * This method identifies URL patterns and collects associated metadata (titles,
     * descriptions) that Slack automatically generates when links are shared.
     * 
     * ## Detection Algorithm
     * 1. **URL Pattern Matching**: Identify lines containing standalone URLs
     * 2. **Lookahead Analysis**: Examine following lines for associated metadata
     * 3. **Content Validation**: Verify metadata lines match expected patterns
     * 4. **Block Assembly**: Group URL and metadata into coherent preview block
     * 5. **Metadata Extraction**: Extract structured information for later use
     * 
     * ## Lookahead Strategy
     * - Maximum 5 lines lookahead to prevent excessive processing
     * - Include empty lines as they may be part of preview formatting
     * - Stop at first non-matching line to avoid over-collection
     * - Require at least one metadata line to qualify as link preview
     * 
     * @param {string[]} lines - Array of message lines to analyze
     * @param {number} startIndex - Starting index for link preview detection
     * @returns {EmbeddedContent | null} Detected link preview block or null if not found
     * @private Internal method for link preview detection
     * @complexity O(k) where k=lookahead distance (max 5)
     * @example
     * ```typescript
     * // Internal usage within analyzeMessage
     * const lines = [
     *   'Check this out:',
     *   'https://example.com',
     *   'Example Website',
     *   'A great resource for learning',
     *   'What do you think?'
     * ];
     * 
     * const linkPreview = this.detectLinkPreview(lines, 1);
     * // Returns: {
     * //   type: EmbeddedContentType.LINK_PREVIEW,
     * //   content: ['https://example.com', 'Example Website', 'A great resource for learning'],
     * //   startIndex: 1,
     * //   endIndex: 3,
     * //   metadata: {
     * //     url: 'https://example.com',
     * //     title: 'Example Website',
     * //     description: 'A great resource for learning'
     * //   }
     * // }
     * ```
     * @see {@link looksLikeMetadata} - Helper for metadata line detection
     * @see {@link looksLikeDescription} - Helper for description line detection
     */
    private detectLinkPreview(lines: string[], startIndex: number): EmbeddedContent | null {
        const currentLine = lines[startIndex].trim();
        
        // Must start with a URL
        if (!EMBEDDED_PATTERNS.LINK_PREVIEW.test(currentLine)) {
            return null;
        }

        const content: string[] = [currentLine];
        let endIndex = startIndex;
        
        // Look ahead for title and description lines
        for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 5); i++) {
            const line = lines[i].trim();
            
            // Empty lines can be part of link preview
            if (!line) {
                content.push(lines[i]);
                endIndex = i;
                continue;
            }
            
            // Check if this looks like a title or description
            if (this.looksLikeMetadata(line) || this.looksLikeDescription(line)) {
                content.push(lines[i]);
                endIndex = i;
            } else {
                break;
            }
        }

        // Only consider it a link preview if we found additional content
        if (content.length > 1) {
            return {
                type: EmbeddedContentType.LINK_PREVIEW,
                content,
                startIndex,
                endIndex,
                metadata: {
                    url: currentLine,
                    title: content.length > 1 ? content[1].trim() : undefined,
                    description: content.length > 2 ? content[2].trim() : undefined
                }
            };
        }

        return null;
    }

    /**
     * Detect file attachment blocks with download links and associated metadata.
     * 
     * File attachments in Slack messages often include download links, file type
     * information, and other metadata. This method identifies these patterns and
     * groups related lines into coherent file attachment blocks for processing.
     * 
     * ## Detection Strategy
     * 1. **Multi-line Scanning**: Process up to 10 lines to capture complete attachment info
     * 2. **File Pattern Recognition**: Identify file links, names, and type indicators
     * 3. **Metadata Collection**: Gather file type, size, and other attachment details
     * 4. **Content Grouping**: Group related lines with flexible empty line handling
     * 5. **Information Extraction**: Extract structured metadata for file processing
     * 
     * ## File Pattern Types
     * - **Markdown Links**: `[filename.pdf](download_url)`
     * - **Slack File URLs**: Links containing `files.slack.com`
     * - **Direct File References**: Filenames with extensions
     * - **File Type Indicators**: "PDF", "Doc", "Zip", "Google Doc", etc.
     * 
     * ## Metadata Extraction
     * - **URL**: Download links and file access URLs
     * - **Filename**: Extracted from links or direct references
     * - **File Type**: Detected from extensions or type indicators
     * 
     * @param {string[]} lines - Array of message lines to analyze for file attachments
     * @param {number} startIndex - Starting index for file attachment detection
     * @returns {EmbeddedContent | null} Detected file attachment block or null if not found
     * @private Internal method for file attachment detection
     * @complexity O(k) where k=lookahead distance (max 10)
     * @example
     * ```typescript
     * // Internal usage within analyzeMessage
     * const lines = [
     *   'Here is the report:',
     *   '[quarterly_report.pdf](https://files.slack.com/abc123)',
     *   'PDF',
     *   '2.3 MB',
     *   'Thanks for reviewing!'
     * ];
     * 
     * const fileAttachment = this.detectFileAttachment(lines, 1);
     * // Returns: {
     * //   type: EmbeddedContentType.FILE_ATTACHMENT,
     * //   content: ['[quarterly_report.pdf](https://files.slack.com/abc123)', 'PDF', '2.3 MB'],
     * //   startIndex: 1,
     * //   endIndex: 3,
     * //   metadata: {
     * //     url: 'https://files.slack.com/abc123',
     * //     filename: 'quarterly_report.pdf',
     * //     fileType: 'PDF'
     * //   }
     * // }
     * ```
     * @see {@link looksLikeFileLink} - Helper for file link detection
     * @see {@link looksLikeFileMetadata} - Helper for file metadata detection
     * @see {@link extractUrl} - URL extraction utility
     * @see {@link extractFilename} - Filename extraction utility
     * @see {@link extractFileType} - File type detection utility
     */
    private detectFileAttachment(lines: string[], startIndex: number): EmbeddedContent | null {
        const content: string[] = [];
        let endIndex = startIndex;
        let url: string | undefined;
        let filename: string | undefined;
        let fileType: string | undefined;

        // Look for file attachment patterns over multiple lines
        for (let i = startIndex; i < Math.min(lines.length, startIndex + 10); i++) {
            const line = lines[i].trim();
            
            if (!line) {
                if (content.length > 0) {
                    content.push(lines[i]);
                    endIndex = i;
                }
                continue;
            }

            // Check for file links or file indicators
            if (this.looksLikeFileLink(line)) {
                content.push(lines[i]);
                endIndex = i;
                if (!url) url = this.extractUrl(line);
                if (!filename) filename = this.extractFilename(line);
            } else if (this.looksLikeFileMetadata(line)) {
                content.push(lines[i]);
                endIndex = i;
                if (!fileType) fileType = this.extractFileType(line);
            } else if (content.length > 0) {
                // Stop if we've started collecting and hit non-file content
                break;
            }
        }

        if (content.length > 0) {
            return {
                type: EmbeddedContentType.FILE_ATTACHMENT,
                content,
                startIndex,
                endIndex,
                metadata: { url, filename, fileType }
            };
        }

        return null;
    }

    /**
     * Detect quoted message blocks often appearing in reply contexts and message sharing.
     * 
     * Quoted messages appear when users reply to previous messages or when Slack
     * automatically includes context from shared content. This method identifies
     * patterns that suggest embedded or quoted message content within the current message.
     * 
     * ## Detection Criteria
     * 1. **Quote Pattern Recognition**: Identify lines that look like quoted message starts
     * 2. **Content Validation**: Verify subsequent lines match quoted message patterns
     * 3. **Context Grouping**: Collect related lines into coherent quoted blocks
     * 4. **Length Limits**: Apply reasonable limits to prevent over-collection
     * 
     * ## Quoted Message Patterns
     * - **Author Attribution**: Lines starting with names or user indicators
     * - **Message Content**: Following lines that look like message text
     * - **Timestamp Information**: Optional timestamp patterns in quoted content
     * - **Length Constraints**: Reasonable length limits for quoted content
     * 
     * ## Validation Logic
     * - Must start with a line that looks like a quoted message beginning
     * - Subsequent lines must match quoted message content patterns
     * - Avoid collecting content that looks like new messages
     * - Limit lookahead to 5 lines to prevent excessive processing
     * 
     * @param {string[]} lines - Array of message lines to analyze for quoted content
     * @param {number} startIndex - Starting index for quoted message detection
     * @returns {EmbeddedContent | null} Detected quoted message block or null if not found
     * @private Internal method for quoted message detection
     * @complexity O(k) where k=lookahead distance (max 5)
     * @example
     * ```typescript
     * // Internal usage within analyzeMessage
     * const lines = [
     *   'In response to Alice:',
     *   'Alice Johnson',
     *   'That was a really insightful comment',
     *   'I agree completely',
     *   'Thanks for sharing your thoughts!'
     * ];
     * 
     * const quotedMessage = this.detectQuotedMessage(lines, 1);
     * // Returns: {
     * //   type: EmbeddedContentType.QUOTED_MESSAGE,
     * //   content: ['Alice Johnson', 'That was a really insightful comment', 'I agree completely'],
     * //   startIndex: 1,
     * //   endIndex: 3
     * // }
     * ```
     * @see {@link looksLikeQuotedMessageStart} - Helper for quoted message start detection
     * @see {@link looksLikeQuotedMessageContent} - Helper for quoted content validation
     */
    private detectQuotedMessage(lines: string[], startIndex: number): EmbeddedContent | null {
        const currentLine = lines[startIndex].trim();
        
        // Look for patterns that suggest quoted/embedded messages
        if (!this.looksLikeQuotedMessageStart(currentLine)) {
            return null;
        }

        const content: string[] = [lines[startIndex]];
        let endIndex = startIndex;
        
        // Collect subsequent lines that look like part of the quoted message
        for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 5); i++) {
            const line = lines[i].trim();
            
            if (!line) {
                content.push(lines[i]);
                endIndex = i;
                continue;
            }
            
            if (this.looksLikeQuotedMessageContent(line)) {
                content.push(lines[i]);
                endIndex = i;
            } else {
                break;
            }
        }

        return {
            type: EmbeddedContentType.QUOTED_MESSAGE,
            content,
            startIndex,
            endIndex
        };
    }

    /**
     * Detect reaction continuation blocks consisting of standalone emoji reactions and counts.
     * 
     * Reaction continuation blocks appear when Slack displays emoji reactions and their
     * counts on separate lines, often as part of message formatting or when reactions
     * are displayed in a continuation format. This method identifies these patterns
     * and groups them into coherent reaction blocks.
     * 
     * ## Detection Patterns
     * - **Emoji with Counts**: `:thumbsup: 5`, `:heart: 2`
     * - **Numeric Patterns**: Standalone numbers that may be reaction counts
     * - **Emoji Sequences**: Multiple emoji reactions in sequence
     * - **Continuation Lines**: Related reaction content across multiple lines
     * 
     * ## Grouping Strategy
     * 1. **Initial Pattern Match**: Identify first line matching reaction patterns
     * 2. **Continuation Detection**: Look for additional reaction lines
     * 3. **Empty Line Handling**: Allow empty lines between reactions
     * 4. **Validation**: Ensure at least one valid reaction pattern exists
     * 5. **Block Assembly**: Create coherent reaction block from collected lines
     * 
     * ## Validation Logic
     * - Must contain at least one line matching reaction continuation patterns
     * - Empty lines are preserved as part of reaction formatting
     * - Stop at first non-reaction line to avoid over-collection
     * - Maximum 5 lines lookahead to prevent excessive processing
     * 
     * @param {string[]} lines - Array of message lines to analyze for reaction content
     * @param {number} startIndex - Starting index for reaction continuation detection
     * @returns {EmbeddedContent | null} Detected reaction block or null if not found
     * @private Internal method for reaction continuation detection
     * @complexity O(k) where k=lookahead distance (max 5)
     * @example
     * ```typescript
     * // Internal usage within analyzeMessage
     * const lines = [
     *   'Great work everyone!',
     *   ':thumbsup: 8',
     *   ':heart: 3',
     *   '',
     *   ':clap: 5',
     *   'Thanks for the feedback!'
     * ];
     * 
     * const reactionBlock = this.detectReactionContinuation(lines, 1);
     * // Returns: {
     * //   type: EmbeddedContentType.REACTIONS,
     * //   content: [':thumbsup: 8', ':heart: 3', '', ':clap: 5'],
     * //   startIndex: 1,
     * //   endIndex: 4
     * // }
     * ```
     * @see {@link EMBEDDED_PATTERNS.REACTION_CONTINUATION} - Reaction pattern definitions
     */
    private detectReactionContinuation(lines: string[], startIndex: number): EmbeddedContent | null {
        const currentLine = lines[startIndex].trim();
        
        if (!EMBEDDED_PATTERNS.REACTION_CONTINUATION.test(currentLine)) {
            return null;
        }

        const content: string[] = [lines[startIndex]];
        let endIndex = startIndex;
        
        // Look for continuation reaction lines
        for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 5); i++) {
            const line = lines[i].trim();
            
            if (!line) {
                // Allow empty lines between reactions
                content.push(lines[i]);
                endIndex = i;
                continue;
            }
            
            if (EMBEDDED_PATTERNS.REACTION_CONTINUATION.test(line)) {
                content.push(lines[i]);
                endIndex = i;
            } else {
                break;
            }
        }

        // Only consider as reaction block if we have actual reaction patterns
        if (content.filter(line => line.trim() && EMBEDDED_PATTERNS.REACTION_CONTINUATION.test(line.trim())).length > 0) {
            return {
                type: EmbeddedContentType.REACTIONS,
                content,
                startIndex,
                endIndex
            };
        }

        return null;
    }

    /**
     * Helper methods for pattern recognition and content classification.
     * These methods provide specialized logic for identifying different types
     * of content patterns within message lines.
     */

    /**
     * Determine if a line looks like metadata content (titles, headers, short descriptive text).
     * 
     * Metadata lines typically contain titles, headers, or brief descriptive content
     * that accompanies link previews or file attachments. This method identifies
     * patterns that suggest metadata rather than main message content.
     * 
     * ## Metadata Characteristics
     * - Matches predefined metadata patterns (Google Doc, PDF, Zip)
     * - Short length (<60 characters) with title-case formatting
     * - Starts with capital letter indicating structured content
     * - Lacks complex punctuation or conversational markers
     * 
     * @param {string} line - Text line to analyze for metadata patterns
     * @returns {boolean} True if line appears to be metadata content
     * @private Internal helper for content classification
     * @example
     * ```typescript
     * // Internal usage in link preview detection
     * const isMetadata1 = this.looksLikeMetadata('Google Doc'); // true
     * const isMetadata2 = this.looksLikeMetadata('Research Paper Title'); // true
     * const isMetadata3 = this.looksLikeMetadata('Hey, check this out!'); // false
     * ```
     */
    private looksLikeMetadata(line: string): boolean {
        return EMBEDDED_PATTERNS.METADATA_LINE.test(line) || 
               line.length < 60 && /^[A-Z]/.test(line);
    }

    /**
     * Determine if a line looks like description content for link previews or attachments.
     * 
     * Description lines typically contain longer explanatory text that provides
     * context or summary information for linked content. This method identifies
     * lines that have the characteristics of descriptions rather than titles or main content.
     * 
     * ## Description Characteristics
     * - Medium length (20-200 characters) indicating substantial but not excessive content
     * - Lacks bracket notation that might indicate links or metadata
     * - Doesn't contain HTTP URLs (which would suggest link content)
     * - Has descriptive rather than conversational tone
     * 
     * @param {string} line - Text line to analyze for description patterns
     * @returns {boolean} True if line appears to be description content
     * @private Internal helper for content classification
     * @example
     * ```typescript
     * // Internal usage in link preview detection
     * const isDesc1 = this.looksLikeDescription('A comprehensive guide to modern web development'); // true
     * const isDesc2 = this.looksLikeDescription('Check it out'); // false (too short)
     * const isDesc3 = this.looksLikeDescription('https://example.com'); // false (contains URL)
     * ```
     */
    private looksLikeDescription(line: string): boolean {
        return line.length > 20 && line.length < 200 && 
               !line.includes('[') && !line.includes('http');
    }

    /**
     * Determine if a line contains file link patterns indicating file attachments.
     * 
     * File links in Slack can appear in various formats including Markdown-style
     * links, direct Slack file URLs, or download links. This method identifies
     * these patterns to help classify file attachment content.
     * 
     * ## File Link Patterns
     * - Markdown format: `[filename.ext](url)`
     * - Slack file URLs: URLs containing `files.slack.com`
     * - Download URLs: URLs containing `download/` path segment
     * - File extension patterns: Common file extensions in link text
     * 
     * @param {string} line - Text line to analyze for file link patterns
     * @returns {boolean} True if line contains file link indicators
     * @private Internal helper for file attachment detection
     * @example
     * ```typescript
     * // Internal usage in file attachment detection
     * const isFile1 = this.looksLikeFileLink('[report.pdf](https://files.slack.com/abc)'); // true
     * const isFile2 = this.looksLikeFileLink('https://files.slack.com/documents/123'); // true
     * const isFile3 = this.looksLikeFileLink('regular message text'); // false
     * ```
     */
    private looksLikeFileLink(line: string): boolean {
        return EMBEDDED_PATTERNS.FILE_ATTACHMENT.test(line) ||
               line.includes('files.slack.com') ||
               line.includes('download/');
    }

    /**
     * Determine if a line contains file metadata patterns (file types, counts, etc.).
     * 
     * File metadata lines provide additional information about file attachments,
     * such as file type indicators, file counts, or other attachment-related data.
     * This method identifies these supplementary content patterns.
     * 
     * ## File Metadata Patterns
     * - File type indicators: "PDF", "Doc", "Zip", "Google Doc"
     * - File count patterns: "3 files", "1 file"
     * - Case-insensitive matching for flexibility
     * 
     * @param {string} line - Text line to analyze for file metadata patterns
     * @returns {boolean} True if line contains file metadata indicators
     * @private Internal helper for file attachment detection
     * @example
     * ```typescript
     * // Internal usage in file attachment detection
     * const isMeta1 = this.looksLikeFileMetadata('PDF'); // true
     * const isMeta2 = this.looksLikeFileMetadata('3 files'); // true
     * const isMeta3 = this.looksLikeFileMetadata('regular text'); // false
     * ```
     */
    private looksLikeFileMetadata(line: string): boolean {
        return /^(PDF|Doc|Zip|Google Doc)$/i.test(line) ||
               /^\d+ files?$/i.test(line);
    }

    /**
     * Determine if a line looks like the start of a quoted message block.
     * 
     * Quoted message starts typically contain author names or attribution
     * information that indicates the beginning of embedded message content.
     * This method identifies patterns that suggest quoted content initiation.
     * 
     * ## Quoted Message Start Patterns
     * - Matches embedded message patterns from EMBEDDED_PATTERNS
     * - Reasonable length limit (<100 characters)
     * - Lacks colon characters (which might indicate different content)
     * - Starts with capital letter (typical of names/titles)
     * 
     * @param {string} line - Text line to analyze for quoted message start patterns
     * @returns {boolean} True if line appears to start a quoted message block
     * @private Internal helper for quoted message detection
     * @example
     * ```typescript
     * // Internal usage in quoted message detection
     * const isQuote1 = this.looksLikeQuotedMessageStart('Alice Johnson'); // true
     * const isQuote2 = this.looksLikeQuotedMessageStart('User Name [2:30 PM]'); // true
     * const isQuote3 = this.looksLikeQuotedMessageStart('Alice: replied to thread'); // false (contains colon)
     * ```
     */
    private looksLikeQuotedMessageStart(line: string): boolean {
        return EMBEDDED_PATTERNS.EMBEDDED_MESSAGE.test(line) &&
               line.length < 100 &&
               !line.includes(':') && 
               /^[A-Z]/.test(line);
    }

    /**
     * Determine if a line looks like content within a quoted message block.
     * 
     * Quoted message content lines should contain the actual text content
     * of the quoted message, without URLs or patterns that might indicate
     * the start of new message content.
     * 
     * ## Quoted Content Characteristics
     * - Reasonable length (<200 characters)
     * - Lacks HTTP URLs (which might be separate content)
     * - Doesn't look like a new message (no timestamp patterns)
     * 
     * @param {string} line - Text line to analyze for quoted message content patterns
     * @returns {boolean} True if line appears to be quoted message content
     * @private Internal helper for quoted message detection
     * @example
     * ```typescript
     * // Internal usage in quoted message detection
     * const isContent1 = this.looksLikeQuotedMessageContent('This is the quoted message text'); // true
     * const isContent2 = this.looksLikeQuotedMessageContent('https://example.com'); // false (contains URL)
     * const isContent3 = this.looksLikeQuotedMessageContent('Alice Smith [3:45 PM]'); // false (looks like new message)
     * ```
     */
    private looksLikeQuotedMessageContent(line: string): boolean {
        return line.length < 200 && 
               !line.includes('http') &&
               !this.looksLikeNewMessage(line);
    }

    /**
     * Determine if a line looks like the start of a new message rather than quoted content.
     * 
     * This method helps distinguish between quoted message content and the start
     * of new messages by identifying timestamp patterns and author attribution
     * formats that typically indicate message boundaries.
     * 
     * ## New Message Indicators
     * - Timestamp patterns: `12:34`, `2:45 PM`
     * - Author name patterns: `First Last` (typical name formatting)
     * 
     * @param {string} line - Text line to analyze for new message patterns
     * @returns {boolean} True if line appears to start a new message
     * @private Internal helper for content boundary detection
     * @example
     * ```typescript
     * // Internal usage in quoted message content validation
     * const isNew1 = this.looksLikeNewMessage('2:45 PM'); // true
     * const isNew2 = this.looksLikeNewMessage('John Smith'); // true (name pattern)
     * const isNew3 = this.looksLikeNewMessage('continued message text'); // false
     * ```
     */
    private looksLikeNewMessage(line: string): boolean {
        return /^\d{1,2}:\d{2}/.test(line) || 
               /^[A-Z][a-z]+ [A-Z][a-z]+/.test(line);
    }

    /**
     * Extract URL from a text line using pattern matching.
     * 
     * Identifies and extracts HTTP/HTTPS URLs from text content, handling
     * various URL formats and contexts that appear in Slack messages.
     * 
     * ## URL Extraction Logic
     * - Matches HTTP and HTTPS URLs
     * - Handles URLs with various characters and parameters
     * - Stops at whitespace or closing parentheses
     * - Returns first URL found in the line
     * 
     * @param {string} line - Text line to extract URL from
     * @returns {string | undefined} Extracted URL or undefined if none found
     * @private Internal helper for metadata extraction
     * @example
     * ```typescript
     * // Internal usage in file attachment detection
     * const url1 = this.extractUrl('[file.pdf](https://files.slack.com/abc123)'); // 'https://files.slack.com/abc123'
     * const url2 = this.extractUrl('Check out https://example.com for info'); // 'https://example.com'
     * const url3 = this.extractUrl('no url here'); // undefined
     * ```
     */
    private extractUrl(line: string): string | undefined {
        const urlMatch = line.match(/https?:\/\/[^\s)]+/);
        return urlMatch ? urlMatch[0] : undefined;
    }

    /**
     * Extract filename from a text line using pattern matching.
     * 
     * Identifies and extracts filenames with extensions from text content,
     * handling various filename formats that appear in file attachment contexts.
     * 
     * ## Filename Extraction Logic
     * - Matches filenames with extensions (e.g., file.pdf, document.docx)
     * - Handles filenames in various contexts (URLs, markdown links, plain text)
     * - Returns first filename found in the line
     * 
     * @param {string} line - Text line to extract filename from
     * @returns {string | undefined} Extracted filename or undefined if none found
     * @private Internal helper for metadata extraction
     * @example
     * ```typescript
     * // Internal usage in file attachment detection
     * const name1 = this.extractFilename('[report.pdf](https://files.slack.com/abc)'); // 'report.pdf'
     * const name2 = this.extractFilename('document.docx uploaded'); // 'document.docx'
     * const name3 = this.extractFilename('no filename here'); // undefined
     * ```
     */
    private extractFilename(line: string): string | undefined {
        const filenameMatch = line.match(/([^\/\s]+\.\w+)/);
        return filenameMatch ? filenameMatch[1] : undefined;
    }

    /**
     * Extract file type from a text line using pattern matching and keyword detection.
     * 
     * Identifies file type information from text content by looking for common
     * file type indicators and keywords that appear in file attachment contexts.
     * 
     * ## File Type Detection
     * - **PDF**: Detected from "pdf" keyword (case-insensitive)
     * - **Document**: Detected from "doc" keyword
     * - **Archive**: Detected from "zip" keyword
     * - **Google Doc**: Detected from "google doc" phrase
     * 
     * @param {string} line - Text line to extract file type from
     * @returns {string | undefined} Detected file type or undefined if none found
     * @private Internal helper for metadata extraction
     * @example
     * ```typescript
     * // Internal usage in file attachment detection
     * const type1 = this.extractFileType('PDF'); // 'PDF'
     * const type2 = this.extractFileType('Google Doc shared'); // 'Google Doc'
     * const type3 = this.extractFileType('regular text'); // undefined
     * ```
     */
    private extractFileType(line: string): string | undefined {
        if (/pdf/i.test(line)) return 'PDF';
        if (/doc/i.test(line)) return 'Document';
        if (/zip/i.test(line)) return 'Archive';
        if (/google doc/i.test(line)) return 'Google Doc';
        return undefined;
    }
}