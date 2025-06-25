import { BaseProcessor } from './base-processor';
import { ProcessorResult } from '../../types/formatters.types';
import { Logger } from '../../utils/logger';

/**
 * Processor for handling Slack attachments and link previews
 * Gracefully handles various attachment formats and provides fallbacks
 */
export class AttachmentProcessor extends BaseProcessor<string> {
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
     * Process attachment-related content
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
     * Process file upload notifications
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
     * Process image references and clean up image syntax
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
     * Process and simplify link previews
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
     * Check if current position looks like start of a link preview
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
                if (this.patterns.linkPreviewUrl.test(nextLine) || 
                    /^(Language|Last updated)$/i.test(nextLine)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Check if we're at the end of a link preview
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
            if (/^![:\[].*?[:\]]\([^)]+\)\d+/i.test(nextLine) || 
                /^:[a-zA-Z0-9_+-]+:$/i.test(nextLine)) {
                return true;
            }
            
            // Avatar patterns indicate start of new message
            if (/^!\[\]\(https:\/\/ca\.slack-edge\.com\/[^)]+\)$/i.test(nextLine)) {
                return true;
            }
            
            // Common message start patterns
            if (/^[A-Za-z0-9\s\-_.]+.*\[[^\]]+\]\(https?:\/\/[^)]+\)$/i.test(nextLine) || 
                /^\d{1,2}:\d{2}\s*(?:AM|PM)?$/i.test(nextLine)) {
                return true;
            }
            
            // Thread metadata patterns
            if (/^\d+\s+repl(?:y|ies)/i.test(nextLine) ||
                /^View thread$/i.test(nextLine) ||
                /^Last reply/i.test(nextLine)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Format a link preview into a concise representation
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
            const desc = data.description.length > 100 
                ? data.description.substring(0, 100) + '...'
                : data.description;
            parts.push(`— _${desc}_`);
        }
        
        return parts.join(' ');
    }

    /**
     * Process avatar patterns by filtering or preserving them appropriately
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
     * Check if a line is a standalone avatar image
     */
    private isStandaloneAvatar(line: string): boolean {
        return this.patterns.avatarUrl.test(line);
    }

    /**
     * Determine if an avatar should be preserved based on context
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
     * Check if a line should be filtered out as attachment metadata
     */
    isAttachmentMetadata(line: string): boolean {
        const trimmed = line.trim();
        
        // Avatar patterns are metadata that should be handled specially
        if (this.patterns.avatarUrl.test(trimmed)) {
            return true;
        }
        
        // File preview brackets
        if (this.patterns.previewBlockStart.test(trimmed) || 
            this.patterns.previewBlockEnd.test(trimmed)) {
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
     * Process "Added by [Service]" patterns
     */
    private processServiceAdditions(text: string): string {
        return text.replace(this.patterns.addedByService, (match, service) => {
            return `📎 _Added by ${service}_`;
        });
    }
    
    /**
     * Process file count patterns (e.g., "📎 2 files")
     */
    private processFileCounts(text: string): string {
        // For now, just preserve the pattern as-is
        // In the future, could try to extract actual file names from context
        return text;
    }
}