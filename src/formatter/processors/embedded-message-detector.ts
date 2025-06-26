import { SlackMessage } from '../../models.js';
import { Logger } from '../../utils/logger.js';

/**
 * Configuration for embedded message detection patterns
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
 * Embedded content types for classification
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
 * Represents an embedded content block within a message
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
 * Result of embedded content detection
 */
export interface EmbeddedDetectionResult {
    message: SlackMessage;
    embeddedContent: EmbeddedContent[];
    hasEmbedded: boolean;
    cleanedText: string;
}

/**
 * Detects and classifies embedded content within Slack messages.
 * Identifies link previews, file attachments, quoted messages, and other embedded content
 * that may cause duplication or formatting issues.
 */
export class EmbeddedMessageDetector {
    private debugMode: boolean;

    constructor(debugMode: boolean = false) {
        this.debugMode = debugMode;
    }

    /**
     * Analyze a message to detect embedded content patterns
     * @param message - The SlackMessage to analyze
     * @returns Detection result with embedded content classification
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
     * Detect link preview blocks (URL followed by title and description)
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
     * Detect file attachment blocks with download links and metadata
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
     * Detect quoted message blocks (often from reply contexts)
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
     * Detect reaction continuation blocks (standalone reaction lines)
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

    // Helper methods for pattern recognition
    private looksLikeMetadata(line: string): boolean {
        return EMBEDDED_PATTERNS.METADATA_LINE.test(line) || 
               line.length < 60 && /^[A-Z]/.test(line);
    }

    private looksLikeDescription(line: string): boolean {
        return line.length > 20 && line.length < 200 && 
               !line.includes('[') && !line.includes('http');
    }

    private looksLikeFileLink(line: string): boolean {
        return EMBEDDED_PATTERNS.FILE_ATTACHMENT.test(line) ||
               line.includes('files.slack.com') ||
               line.includes('download/');
    }

    private looksLikeFileMetadata(line: string): boolean {
        return /^(PDF|Doc|Zip|Google Doc)$/i.test(line) ||
               /^\d+ files?$/i.test(line);
    }

    private looksLikeQuotedMessageStart(line: string): boolean {
        return EMBEDDED_PATTERNS.EMBEDDED_MESSAGE.test(line) &&
               line.length < 100 &&
               !line.includes(':') && 
               /^[A-Z]/.test(line);
    }

    private looksLikeQuotedMessageContent(line: string): boolean {
        return line.length < 200 && 
               !line.includes('http') &&
               !this.looksLikeNewMessage(line);
    }

    private looksLikeNewMessage(line: string): boolean {
        return /^\d{1,2}:\d{2}/.test(line) || 
               /^[A-Z][a-z]+ [A-Z][a-z]+/.test(line);
    }

    private extractUrl(line: string): string | undefined {
        const urlMatch = line.match(/https?:\/\/[^\s)]+/);
        return urlMatch ? urlMatch[0] : undefined;
    }

    private extractFilename(line: string): string | undefined {
        const filenameMatch = line.match(/([^\/\s]+\.\w+)/);
        return filenameMatch ? filenameMatch[1] : undefined;
    }

    private extractFileType(line: string): string | undefined {
        if (/pdf/i.test(line)) return 'PDF';
        if (/doc/i.test(line)) return 'Document';
        if (/zip/i.test(line)) return 'Archive';
        if (/google doc/i.test(line)) return 'Google Doc';
        return undefined;
    }
}