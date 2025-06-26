import { SlackMessage } from '../../models.js';
import { EmbeddedMessageDetector, EmbeddedDetectionResult, EmbeddedContentType } from './embedded-message-detector.js';
import { Logger } from '../../utils/logger.js';

/**
 * Configuration for deduplication algorithm
 */
const DEDUPLICATION_CONFIG = {
    /** Similarity threshold for considering content duplicate */
    SIMILARITY_THRESHOLD: 0.95, // More conservative threshold
    
    /** Minimum content length to consider for deduplication */
    MIN_CONTENT_LENGTH: 15, // Longer minimum length
    
    /** Maximum distance between messages to consider related */
    MAX_MESSAGE_DISTANCE: 3, // Closer messages only
    
    /** Word overlap threshold for text similarity */
    WORD_OVERLAP_THRESHOLD: 0.8,
    
    /** Character similarity threshold */
    CHAR_SIMILARITY_THRESHOLD: 0.9
} as const;

/**
 * Represents a content block that can be deduplicated
 */
interface ContentBlock {
    content: string;
    messageIndex: number;
    isEmbedded: boolean;
    embeddedType?: EmbeddedContentType;
    preserveReason?: string;
}

/**
 * Result of deduplication processing
 */
export interface DeduplicationResult {
    messages: SlackMessage[];
    removedDuplicates: number;
    preservedContext: number;
    processedBlocks: number;
    debugInfo?: {
        duplicateBlocks: ContentBlock[];
        preservedBlocks: ContentBlock[];
    };
}

/**
 * Intelligent content deduplication processor that removes duplicate content
 * while preserving context and message structure integrity.
 */
export class ContentDeduplicationProcessor {
    private embedDetector: EmbeddedMessageDetector;
    private debugMode: boolean;

    constructor(debugMode: boolean = false) {
        this.debugMode = debugMode;
        this.embedDetector = new EmbeddedMessageDetector(debugMode);
    }

    /**
     * Process messages to remove duplicate content while preserving context
     * @param messages - Array of SlackMessage objects to process
     * @returns Deduplication result with cleaned messages
     */
    process(messages: SlackMessage[]): DeduplicationResult {
        if (!messages || messages.length === 0) {
            return {
                messages: [],
                removedDuplicates: 0,
                preservedContext: 0,
                processedBlocks: 0
            };
        }

        const startTime = Date.now();
        
        // Analyze all messages for embedded content
        const analysisResults = messages.map(msg => this.embedDetector.analyzeMessage(msg));
        
        // Extract content blocks for deduplication analysis
        const contentBlocks = this.extractContentBlocks(analysisResults);
        
        // Identify duplicate blocks
        const duplicateBlocks = this.identifyDuplicates(contentBlocks);
        
        // Apply deduplication while preserving context
        const processedMessages = this.applyDeduplication(analysisResults, duplicateBlocks);
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        const result: DeduplicationResult = {
            messages: processedMessages,
            removedDuplicates: duplicateBlocks.length,
            preservedContext: contentBlocks.length - duplicateBlocks.length,
            processedBlocks: contentBlocks.length
        };

        if (this.debugMode) {
            result.debugInfo = {
                duplicateBlocks: duplicateBlocks,
                preservedBlocks: contentBlocks.filter(block => 
                    !duplicateBlocks.some(dup => dup.messageIndex === block.messageIndex)
                )
            };
            
            Logger.debug('ContentDeduplicationProcessor', 'Deduplication completed', {
                originalMessages: messages.length,
                processedMessages: processedMessages.length,
                removedDuplicates: result.removedDuplicates,
                preservedContext: result.preservedContext,
                processingTime
            });
        }

        return result;
    }

    /**
     * Extract content blocks from analyzed messages
     */
    private extractContentBlocks(analysisResults: EmbeddedDetectionResult[]): ContentBlock[] {
        const blocks: ContentBlock[] = [];
        
        analysisResults.forEach((result, messageIndex) => {
            // Add main message content if it's substantial
            if (result.message.text.trim().length >= DEDUPLICATION_CONFIG.MIN_CONTENT_LENGTH) {
                blocks.push({
                    content: result.message.text.trim(),
                    messageIndex,
                    isEmbedded: false
                });
            }

            // Add embedded content blocks
            result.embeddedContent.forEach(embedded => {
                const embeddedText = embedded.content.join('\n').trim();
                if (embeddedText.length >= DEDUPLICATION_CONFIG.MIN_CONTENT_LENGTH) {
                    blocks.push({
                        content: embeddedText,
                        messageIndex,
                        isEmbedded: true,
                        embeddedType: embedded.type
                    });
                }
            });
        });
        
        return blocks;
    }

    /**
     * Identify duplicate content blocks using similarity analysis
     */
    private identifyDuplicates(contentBlocks: ContentBlock[]): ContentBlock[] {
        const duplicates: ContentBlock[] = [];
        const processed = new Set<number>();
        
        for (let i = 0; i < contentBlocks.length; i++) {
            if (processed.has(i)) continue;
            
            const currentBlock = contentBlocks[i];
            
            for (let j = i + 1; j < contentBlocks.length; j++) {
                if (processed.has(j)) continue;
                
                const compareBlock = contentBlocks[j];
                
                // Skip if messages are too far apart (unless they're exact matches)
                const messageDistance = Math.abs(compareBlock.messageIndex - currentBlock.messageIndex);
                if (messageDistance > DEDUPLICATION_CONFIG.MAX_MESSAGE_DISTANCE && 
                    !this.isExactMatch(currentBlock.content, compareBlock.content)) {
                    continue;
                }
                
                // Calculate similarity
                const similarity = this.calculateSimilarity(currentBlock.content, compareBlock.content);
                
                if (similarity >= DEDUPLICATION_CONFIG.SIMILARITY_THRESHOLD) {
                    // Determine which block to keep (preserve context)
                    const blockToRemove = this.selectBlockToRemove(currentBlock, compareBlock);
                    
                    if (blockToRemove === compareBlock) {
                        duplicates.push(compareBlock);
                        processed.add(j);
                    } else {
                        duplicates.push(currentBlock);
                        processed.add(i);
                        break; // Current block is removed, move to next
                    }
                }
            }
        }
        
        return duplicates;
    }

    /**
     * Calculate similarity between two content strings
     */
    private calculateSimilarity(content1: string, content2: string): number {
        // Exact match
        if (content1 === content2) return 1.0;
        
        // Character-level similarity (Jaccard similarity)
        const charSimilarity = this.calculateCharacterSimilarity(content1, content2);
        
        // Word-level similarity
        const wordSimilarity = this.calculateWordSimilarity(content1, content2);
        
        // Levenshtein distance similarity
        const editSimilarity = this.calculateEditSimilarity(content1, content2);
        
        // Weighted combination
        return (charSimilarity * 0.3) + (wordSimilarity * 0.4) + (editSimilarity * 0.3);
    }

    /**
     * Calculate character-level Jaccard similarity
     */
    private calculateCharacterSimilarity(str1: string, str2: string): number {
        const set1 = new Set(str1.toLowerCase().replace(/\s/g, ''));
        const set2 = new Set(str2.toLowerCase().replace(/\s/g, ''));
        
        const intersection = new Set([...set1].filter(char => set2.has(char)));
        const union = new Set([...set1, ...set2]);
        
        return union.size === 0 ? 0 : intersection.size / union.size;
    }

    /**
     * Calculate word-level similarity
     */
    private calculateWordSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        
        if (words1.size === 0 && words2.size === 0) return 1.0;
        if (words1.size === 0 || words2.size === 0) return 0.0;
        
        const intersection = new Set([...words1].filter(word => words2.has(word)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    /**
     * Calculate edit distance similarity
     */
    private calculateEditSimilarity(str1: string, str2: string): number {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        
        return maxLength === 0 ? 1.0 : (maxLength - distance) / maxLength;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // deletion
                    matrix[j - 1][i] + 1,     // insertion
                    matrix[j - 1][i - 1] + cost // substitution
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Check if two content strings are exact matches
     */
    private isExactMatch(content1: string, content2: string): boolean {
        return content1.trim() === content2.trim();
    }

    /**
     * Select which block to remove when duplicates are found
     * Preserves context and maintains message flow
     */
    private selectBlockToRemove(block1: ContentBlock, block2: ContentBlock): ContentBlock {
        // Preserve main message content over embedded content
        if (!block1.isEmbedded && block2.isEmbedded) {
            return block2;
        }
        if (block1.isEmbedded && !block2.isEmbedded) {
            return block1;
        }
        
        // If both are embedded, preserve based on type priority
        if (block1.isEmbedded && block2.isEmbedded) {
            const priority1 = this.getEmbeddedTypePriority(block1.embeddedType);
            const priority2 = this.getEmbeddedTypePriority(block2.embeddedType);
            
            if (priority1 > priority2) return block2;
            if (priority2 > priority1) return block1;
        }
        
        // Default: preserve earlier message (better context)
        return block1.messageIndex < block2.messageIndex ? block2 : block1;
    }

    /**
     * Get priority for embedded content types (higher = more important to preserve)
     */
    private getEmbeddedTypePriority(type?: EmbeddedContentType): number {
        if (!type) return 0;
        
        switch (type) {
            case EmbeddedContentType.QUOTED_MESSAGE: return 4;
            case EmbeddedContentType.FILE_ATTACHMENT: return 3;
            case EmbeddedContentType.LINK_PREVIEW: return 2;
            case EmbeddedContentType.METADATA: return 1;
            case EmbeddedContentType.REACTIONS: return 0;
            case EmbeddedContentType.CONTINUATION: return 0;
            default: return 0;
        }
    }

    /**
     * Apply deduplication by removing duplicate content from messages
     */
    private applyDeduplication(
        analysisResults: EmbeddedDetectionResult[], 
        duplicateBlocks: ContentBlock[]
    ): SlackMessage[] {
        const processedMessages: SlackMessage[] = [];
        
        analysisResults.forEach((result, messageIndex) => {
            const message = { ...result.message };
            
            // Check if this message has duplicate content to remove
            const messageDuplicates = duplicateBlocks.filter(block => 
                block.messageIndex === messageIndex
            );
            
            if (messageDuplicates.length > 0) {
                // Apply content cleaning based on embedded content analysis
                if (result.hasEmbedded && result.cleanedText.trim()) {
                    // Use cleaned text from embedded content detection
                    message.text = result.cleanedText;
                } else {
                    // Mark for removal or significant content reduction
                    const shouldPreserveMessage = this.shouldPreserveMessage(message, messageDuplicates);
                    if (!shouldPreserveMessage) {
                        // Skip this message entirely
                        return;
                    }
                    
                    // Otherwise, clean the content
                    message.text = this.cleanMessageContent(message.text, messageDuplicates);
                }
            }
            
            // Only add message if it has meaningful content
            if (message.text.trim().length > 0) {
                processedMessages.push(message);
            }
        });
        
        return processedMessages;
    }

    /**
     * Determine if a message should be preserved despite having duplicate content
     */
    private shouldPreserveMessage(message: SlackMessage, duplicates: ContentBlock[]): boolean {
        // Always preserve messages with meaningful metadata
        if (message.reactions && message.reactions.length > 0) return true;
        if (message.isThreadStart || message.isThreadReply) return true;
        if (message.threadInfo) return true;
        if (message.timestamp) return true; // Preserve timestamped messages
        
        // Preserve if message has substantial unique content
        if (!message.text || message.text.trim().length === 0) return false;
        
        // Calculate what percentage is duplicate
        const totalDuplicateLength = duplicates.reduce((sum, block) => sum + block.content.length, 0);
        const originalLength = message.text.length;
        
        // Be more conservative - preserve if less than 80% is duplicate
        return (totalDuplicateLength / originalLength) < 0.8;
    }

    /**
     * Clean message content by removing specific duplicate blocks
     */
    private cleanMessageContent(originalText: string, duplicates: ContentBlock[]): string {
        let cleanedText = originalText;
        
        // Remove duplicate content blocks
        duplicates.forEach(duplicate => {
            if (duplicate.isEmbedded) {
                // Remove the specific embedded content
                cleanedText = this.removeEmbeddedContent(cleanedText, duplicate.content);
            }
        });
        
        return cleanedText.trim();
    }

    /**
     * Remove embedded content from message text
     */
    private removeEmbeddedContent(text: string, embeddedContent: string): string {
        // Try exact match removal first
        let cleaned = text.replace(embeddedContent, '');
        
        // If not found, try line-by-line removal
        if (cleaned === text) {
            const lines = text.split('\n');
            const embeddedLines = embeddedContent.split('\n');
            
            embeddedLines.forEach(embeddedLine => {
                const trimmed = embeddedLine.trim();
                if (trimmed) {
                    const lineIndex = lines.findIndex(line => line.trim() === trimmed);
                    if (lineIndex !== -1) {
                        lines[lineIndex] = '';
                    }
                }
            });
            
            cleaned = lines.join('\n');
        }
        
        // Clean up extra whitespace
        return cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    }
}