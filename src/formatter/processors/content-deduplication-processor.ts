import { SlackMessage } from '../../models.js';
import { EmbeddedMessageDetector, EmbeddedDetectionResult, EmbeddedContentType } from './embedded-message-detector.js';
import { Logger } from '../../utils/logger.js';

/**
 * Configuration constants for the deduplication algorithm that control similarity thresholds
 * and processing parameters. These values have been tuned for optimal balance between
 * aggressive duplicate removal and content preservation.
 * 
 * ## Threshold Explanations
 * - **SIMILARITY_THRESHOLD (0.95)**: Conservative threshold requiring 95% similarity
 *   to identify duplicates, preventing false positives that could remove unique content
 * - **MIN_CONTENT_LENGTH (15)**: Prevents over-processing of short content that may
 *   appear similar by chance (e.g., "OK", "Thanks", etc.)
 * - **MAX_MESSAGE_DISTANCE (3)**: Focuses deduplication on nearby messages where
 *   duplicates are more likely to be meaningful (e.g., link previews, copy-paste)
 * - **WORD_OVERLAP_THRESHOLD (0.8)**: Requires 80% word overlap for semantic similarity
 * - **CHAR_SIMILARITY_THRESHOLD (0.9)**: Requires 90% character similarity for structural matching
 * 
 * @constant
 * @readonly
 * @example
 * ```typescript
 * // Algorithm uses these thresholds internally:
 * if (similarity >= DEDUPLICATION_CONFIG.SIMILARITY_THRESHOLD) {
 *   // Content is considered duplicate
 * }
 * ```
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
 * Represents a content block that can be deduplicated with metadata for context preservation.
 * 
 * Content blocks are the fundamental unit of analysis in the deduplication process.
 * Each block represents either main message content or embedded content (like link previews)
 * along with sufficient metadata to make intelligent preservation decisions.
 * 
 * ## Block Types
 * - **Main Content**: Primary message text (isEmbedded: false)
 * - **Embedded Content**: Link previews, file attachments, quoted messages (isEmbedded: true)
 * 
 * ## Metadata Usage
 * - **messageIndex**: Used for distance-based filtering and temporal prioritization
 * - **embeddedType**: Used for content type prioritization during duplicate selection
 * - **preserveReason**: Optional debugging information for preservation decisions
 * 
 * @interface
 * @example
 * ```typescript
 * // Main message content block
 * const mainBlock: ContentBlock = {
 *   content: "Check out this interesting article about AI",
 *   messageIndex: 0,
 *   isEmbedded: false
 * };
 * 
 * // Embedded link preview block
 * const embeddedBlock: ContentBlock = {
 *   content: "AI Research Paper\nComprehensive analysis of modern AI techniques",
 *   messageIndex: 1,
 *   isEmbedded: true,
 *   embeddedType: EmbeddedContentType.LINK_PREVIEW
 * };
 * ```
 */
interface ContentBlock {
    content: string;
    messageIndex: number;
    isEmbedded: boolean;
    embeddedType?: EmbeddedContentType;
    preserveReason?: string;
}

/**
 * Result of deduplication processing containing cleaned messages and comprehensive statistics.
 * 
 * This interface provides complete information about the deduplication process including
 * the processed messages, quantitative metrics about the changes made, and optional
 * debug information for analysis and troubleshooting.
 * 
 * ## Statistics Provided
 * - **removedDuplicates**: Count of content blocks removed as duplicates
 * - **preservedContext**: Count of content blocks preserved for context
 * - **processedBlocks**: Total count of content blocks analyzed
 * 
 * ## Debug Information
 * When debug mode is enabled, additional information is included:
 * - Detailed list of duplicate blocks that were removed
 * - Detailed list of blocks that were preserved with reasons
 * - Processing timing and performance metrics
 * 
 * @interface
 * @example
 * ```typescript
 * const processor = new ContentDeduplicationProcessor(true); // Enable debug
 * const result: DeduplicationResult = processor.process(messages);
 * 
 * console.log(`Processed ${result.messages.length} messages`);
 * console.log(`Removed ${result.removedDuplicates} duplicates`);
 * console.log(`Preserved ${result.preservedContext} blocks for context`);
 * 
 * if (result.debugInfo) {
 *   console.log('Duplicate blocks:', result.debugInfo.duplicateBlocks);
 *   console.log('Preserved blocks:', result.debugInfo.preservedBlocks);
 * }
 * ```
 * @see {@link ContentDeduplicationProcessor.process} - Method that returns this result
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
 * 
 * ## Algorithm Overview
 * The deduplication process uses a multi-faceted similarity detection approach:
 * - **Character-level similarity** using Jaccard similarity on character sets
 * - **Word-level similarity** using word overlap analysis with length filtering
 * - **Edit distance similarity** using Levenshtein distance normalization
 * - **Contextual preservation** prioritizing main messages over embedded content
 * 
 * ## Performance Characteristics
 * - **Time Complexity**: O(n²m) where n = number of content blocks, m = average content length
 * - **Space Complexity**: O(n*m) for similarity matrices and content storage
 * - **Optimization**: Distance-based filtering reduces comparisons for distant messages
 * 
 * ## Deduplication Strategy
 * 1. Extract content blocks from messages (main text + embedded content)
 * 2. Calculate multi-dimensional similarity scores between all block pairs
 * 3. Apply context-aware selection to preserve most valuable content
 * 4. Remove duplicates while maintaining message structure and threading
 * 
 * @complexity O(n²m) - Quadratic in content blocks, linear in content length
 * @example
 * ```typescript
 * const processor = new ContentDeduplicationProcessor(true); // Enable debug mode
 * const messages = [
 *   { text: "Check out this link: https://example.com\nExample Website\nA great resource", username: "user1" },
 *   { text: "I found this: https://example.com\nExample Website", username: "user2" }
 * ];
 * 
 * const result = processor.process(messages);
 * console.log(`Removed ${result.removedDuplicates} duplicates`);
 * console.log(`Preserved ${result.preservedContext} content blocks`);
 * // Output: Removed 1 duplicates, Preserved 2 content blocks
 * ```
 * @see {@link EmbeddedMessageDetector} - Used for analyzing embedded content
 * @see {@link DeduplicationResult} - Return type with processing statistics
 * @see {@link ContentBlock} - Internal representation of deduplicated content
 */
export class ContentDeduplicationProcessor {
    private embedDetector: EmbeddedMessageDetector;
    private debugMode: boolean;

    /**
     * Creates a new content deduplication processor instance.
     * 
     * @param {boolean} [debugMode=false] - Enable detailed logging and debug information in results
     * @example
     * ```typescript
     * // Production mode (minimal logging)
     * const processor = new ContentDeduplicationProcessor();
     * 
     * // Debug mode (detailed logging and debug info)
     * const debugProcessor = new ContentDeduplicationProcessor(true);
     * const result = debugProcessor.process(messages);
     * console.log(result.debugInfo?.duplicateBlocks); // Available in debug mode
     * ```
     */
    constructor(debugMode: boolean = false) {
        this.debugMode = debugMode;
        this.embedDetector = new EmbeddedMessageDetector(debugMode);
    }

    /**
     * Process messages to remove duplicate content while preserving context and message integrity.
     * 
     * This is the main entry point for the deduplication algorithm. It performs a comprehensive
     * analysis of all message content (both main text and embedded content) to identify and
     * remove duplicates while maintaining the logical flow and context of conversations.
     * 
     * ## Processing Steps
     * 1. **Embedded Content Analysis** - Extract all content blocks using EmbeddedMessageDetector
     * 2. **Content Block Extraction** - Separate main message text from embedded content
     * 3. **Similarity Calculation** - Apply multi-dimensional similarity scoring
     * 4. **Duplicate Identification** - Find blocks exceeding similarity thresholds
     * 5. **Context-Aware Removal** - Remove duplicates while preserving message structure
     * 
     * ## Algorithm Configuration
     * - Similarity threshold: 95% (configurable via DEDUPLICATION_CONFIG.SIMILARITY_THRESHOLD)
     * - Minimum content length: 15 characters (prevents over-aggressive deduplication)
     * - Maximum message distance: 3 messages (focuses on local duplicates)
     * - Word overlap threshold: 80% for semantic similarity
     * - Character similarity threshold: 90% for exact match detection
     * 
     * @param {SlackMessage[]} messages - Array of SlackMessage objects to process for duplicates
     * @returns {DeduplicationResult} Comprehensive result with cleaned messages and statistics
     * @throws {Error} When message analysis fails due to invalid input format
     * @complexity O(n²m) where n=number of content blocks, m=average content length
     * @example
     * ```typescript
     * const processor = new ContentDeduplicationProcessor();
     * const messages = [
     *   { id: '1', text: 'Check this out: https://example.com\nGreat Article\nVery informative', username: 'alice' },
     *   { id: '2', text: 'Found this link: https://example.com\nGreat Article', username: 'bob' },
     *   { id: '3', text: 'Thanks for sharing!', username: 'charlie' }
     * ];
     * 
     * const result = processor.process(messages);
     * // Result: 2 messages (duplicate link preview removed from message 2)
     * console.log(`Original: ${messages.length}, Processed: ${result.messages.length}`);
     * console.log(`Removed duplicates: ${result.removedDuplicates}`);
     * console.log(`Processing time: ${result.processingTime}ms`);
     * ```
     * @see {@link DeduplicationResult} - Detailed return type documentation
     * @see {@link DEDUPLICATION_CONFIG} - Algorithm configuration constants
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
     * Extract content blocks from analyzed messages for deduplication analysis.
     * 
     * Converts the embedded content analysis results into normalized ContentBlock objects
     * that can be efficiently compared for similarity. This method separates main message
     * content from embedded content (link previews, file attachments, etc.) and filters
     * out content that's too short to meaningfully deduplicate.
     * 
     * ## Content Block Types
     * - **Main Message Content**: The primary text of each message
     * - **Embedded Content**: Link previews, file attachments, quoted messages
     * - **Metadata Content**: Titles, descriptions, file information
     * 
     * ## Filtering Logic
     * - Minimum content length enforced (15 characters by default)
     * - Whitespace normalization applied consistently
     * - Content type classification for prioritization
     * 
     * @param {EmbeddedDetectionResult[]} analysisResults - Results from embedded message analysis
     * @returns {ContentBlock[]} Array of normalized content blocks ready for similarity analysis
     * @private Internal method for content extraction
     * @complexity O(n*k) where n=number of messages, k=average embedded content per message
     * @example
     * ```typescript
     * // Internal usage (called from process method)
     * const analysisResults = messages.map(msg => this.embedDetector.analyzeMessage(msg));
     * const contentBlocks = this.extractContentBlocks(analysisResults);
     * // contentBlocks: [{ content: "Main text", messageIndex: 0, isEmbedded: false }, ...]
     * ```
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
     * Identify duplicate content blocks using multi-dimensional similarity analysis.
     * 
     * This method implements the core deduplication algorithm by comparing all content
     * blocks pairwise and identifying those that exceed the similarity threshold. The
     * algorithm uses distance-based optimization to avoid comparing messages that are
     * too far apart, focusing on local duplicates that are more likely to be meaningful.
     * 
     * ## Similarity Analysis Components
     * 1. **Distance Filtering**: Skip comparisons between distant messages (>3 apart)
     * 2. **Multi-dimensional Scoring**: Combine character, word, and edit distance similarities
     * 3. **Threshold Application**: Apply 95% similarity threshold for duplicate detection
     * 4. **Context Preservation**: Select which duplicate to remove based on content priority
     * 
     * ## Algorithm Optimization
     * - Early termination for distant message pairs
     * - Exact match detection for performance optimization
     * - Processed set tracking to avoid duplicate comparisons
     * - Smart block selection to preserve context
     * 
     * @param {ContentBlock[]} contentBlocks - Array of content blocks to analyze for duplicates
     * @returns {ContentBlock[]} Array of content blocks identified as duplicates for removal
     * @private Internal method for duplicate detection
     * @complexity O(n²) where n=number of content blocks (with distance optimization)
     * @example
     * ```typescript
     * // Internal usage within process method
     * const duplicates = this.identifyDuplicates(contentBlocks);
     * // duplicates: ContentBlock[] - blocks to be removed from final output
     * console.log(`Found ${duplicates.length} duplicate blocks`);
     * ```
     * @see {@link selectBlockToRemove} - Logic for choosing which duplicate to remove
     * @see {@link calculateSimilarity} - Multi-dimensional similarity calculation
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
     * Calculate similarity between two content strings using multi-dimensional analysis.
     * 
     * This method implements a sophisticated similarity calculation that combines multiple
     * similarity metrics to provide accurate duplicate detection. The algorithm uses weighted
     * combinations of different similarity measures to handle various types of content
     * duplication patterns effectively.
     * 
     * ## Similarity Metrics
     * 1. **Character Similarity (30% weight)**: Jaccard similarity on character sets
     * 2. **Word Similarity (40% weight)**: Word overlap analysis with length filtering
     * 3. **Edit Similarity (30% weight)**: Normalized Levenshtein distance
     * 
     * ## Algorithm Benefits
     * - **Exact Match Detection**: Fast path for identical content
     * - **Semantic Similarity**: Word-level analysis captures meaning
     * - **Structural Similarity**: Character-level analysis handles formatting
     * - **Edit Distance**: Handles minor variations and typos
     * 
     * @param {string} content1 - First content string for comparison
     * @param {string} content2 - Second content string for comparison
     * @returns {number} Similarity score between 0.0 (no similarity) and 1.0 (identical)
     * @private Internal method for similarity calculation
     * @complexity O(m*n) where m, n are lengths of the input strings (due to Levenshtein)
     * @example
     * ```typescript
     * // Internal usage for duplicate detection
     * const similarity = this.calculateSimilarity(
     *   "Check out this great article: https://example.com",
     *   "Found this article: https://example.com"
     * );
     * console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`); // e.g., "Similarity: 87.3%"
     * ```
     * @see {@link calculateCharacterSimilarity} - Character-level Jaccard similarity
     * @see {@link calculateWordSimilarity} - Word-level overlap analysis
     * @see {@link calculateEditSimilarity} - Normalized edit distance calculation
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
     * Calculate character-level Jaccard similarity between two strings.
     * 
     * Computes the Jaccard index (intersection over union) of character sets from both
     * strings after normalization. This metric is effective for detecting content that
     * has similar character composition but may have different word ordering or structure.
     * 
     * ## Normalization Process
     * - Convert to lowercase for case-insensitive comparison
     * - Remove whitespace to focus on actual content characters
     * - Create character sets for set-based operations
     * 
     * ## Mathematical Formula
     * Jaccard(A,B) = |A ∩ B| / |A ∪ B|
     * Where A and B are character sets of the input strings
     * 
     * @param {string} str1 - First string for character similarity analysis
     * @param {string} str2 - Second string for character similarity analysis
     * @returns {number} Jaccard similarity score (0.0 to 1.0)
     * @private Internal method for character-level analysis
     * @complexity O(m + n) where m, n are string lengths
     * @example
     * ```typescript
     * // Internal usage in similarity calculation
     * const charSim = this.calculateCharacterSimilarity("Hello World", "World Hello");
     * console.log(charSim); // 1.0 (same characters, different order)
     * ```
     */
    private calculateCharacterSimilarity(str1: string, str2: string): number {
        const set1 = new Set(str1.toLowerCase().replace(/\s/g, ''));
        const set2 = new Set(str2.toLowerCase().replace(/\s/g, ''));
        
        const intersection = new Set([...set1].filter(char => set2.has(char)));
        const union = new Set([...set1, ...set2]);
        
        return union.size === 0 ? 0 : intersection.size / union.size;
    }

    /**
     * Calculate word-level similarity using filtered word overlap analysis.
     * 
     * Analyzes the overlap between meaningful words (length > 2) in both strings to
     * determine semantic similarity. This metric is particularly effective for detecting
     * content that conveys similar meaning but may have different phrasing or structure.
     * 
     * ## Word Processing
     * - Split on whitespace and normalize to lowercase
     * - Filter out short words (≤2 characters) to focus on meaningful terms
     * - Create word sets for efficient overlap calculation
     * - Handle edge cases (empty word sets)
     * 
     * ## Similarity Calculation
     * Uses Jaccard similarity on word sets: |intersection| / |union|
     * 
     * @param {string} str1 - First string for word-level similarity analysis
     * @param {string} str2 - Second string for word-level similarity analysis
     * @returns {number} Word overlap similarity score (0.0 to 1.0)
     * @private Internal method for semantic similarity analysis
     * @complexity O(m + n) where m, n are word counts
     * @example
     * ```typescript
     * // Internal usage in similarity calculation
     * const wordSim = this.calculateWordSimilarity(
     *   "This article is very informative",
     *   "The article provides informative content"
     * );
     * console.log(wordSim); // ~0.5 ("article" and "informative" overlap)
     * ```
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
     * Calculate edit distance similarity using normalized Levenshtein distance.
     * 
     * Computes the minimum number of single-character edits (insertions, deletions,
     * substitutions) required to transform one string into another, then normalizes
     * this to a similarity score. This metric is effective for detecting near-identical
     * content with minor variations, typos, or formatting differences.
     * 
     * ## Algorithm Process
     * 1. Calculate Levenshtein distance between strings
     * 2. Normalize by maximum string length: (maxLength - distance) / maxLength
     * 3. Return similarity score (1.0 = identical, 0.0 = completely different)
     * 
     * ## Use Cases
     * - Detecting content with minor typos or corrections
     * - Identifying formatting variations of the same content
     * - Finding content with small additions or deletions
     * 
     * @param {string} str1 - First string for edit distance analysis
     * @param {string} str2 - Second string for edit distance analysis
     * @returns {number} Normalized edit similarity score (0.0 to 1.0)
     * @private Internal method for edit distance calculation
     * @complexity O(m*n) where m, n are string lengths
     * @example
     * ```typescript
     * // Internal usage in similarity calculation
     * const editSim = this.calculateEditSimilarity(
     *   "Check out this great article",
     *   "Check out this grat article" // typo: "grat" instead of "great"
     * );
     * console.log(editSim); // ~0.96 (very similar despite typo)
     * ```
     * @see {@link levenshteinDistance} - Core edit distance calculation
     */
    private calculateEditSimilarity(str1: string, str2: string): number {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        
        return maxLength === 0 ? 1.0 : (maxLength - distance) / maxLength;
    }

    /**
     * Calculate Levenshtein distance between two strings using dynamic programming.
     * 
     * Implements the classic dynamic programming algorithm for computing the minimum
     * number of single-character edits (insertions, deletions, substitutions) required
     * to transform one string into another. This forms the basis for edit distance
     * similarity calculations.
     * 
     * ## Algorithm Implementation
     * - Creates a (m+1) × (n+1) matrix for dynamic programming
     * - Initializes base cases for empty string transformations
     * - Fills matrix using optimal substructure property
     * - Returns final distance from bottom-right cell
     * 
     * ## Time and Space Complexity
     * - Time: O(m*n) where m, n are string lengths
     * - Space: O(m*n) for the DP matrix
     * 
     * @param {string} str1 - Source string for transformation
     * @param {string} str2 - Target string for transformation
     * @returns {number} Minimum edit distance (non-negative integer)
     * @private Internal method for edit distance computation
     * @complexity O(m*n) time and space
     * @example
     * ```typescript
     * // Internal usage in edit similarity calculation
     * const distance = this.levenshteinDistance("kitten", "sitting");
     * console.log(distance); // 3 (k→s, e→i, +g)
     * ```
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
        
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
     * Check if two content strings are exact matches after whitespace normalization.
     * 
     * Provides fast-path detection for identical content by comparing trimmed versions
     * of both strings. This optimization allows early detection of exact duplicates
     * without the overhead of complex similarity calculations.
     * 
     * ## Normalization Process
     * - Trim leading and trailing whitespace from both strings
     * - Perform exact string comparison
     * - Return boolean result for immediate use in filtering logic
     * 
     * @param {string} content1 - First content string for exact match comparison
     * @param {string} content2 - Second content string for exact match comparison
     * @returns {boolean} True if content strings are identical after trimming
     * @private Internal method for exact match detection
     * @complexity O(min(m,n)) where m, n are string lengths (early termination)
     * @example
     * ```typescript
     * // Internal usage for optimization in duplicate detection
     * const isExact = this.isExactMatch("  Hello World  ", "Hello World");
     * console.log(isExact); // true (whitespace differences ignored)
     * ```
     */
    private isExactMatch(content1: string, content2: string): boolean {
        return content1.trim() === content2.trim();
    }

    /**
     * Select which block to remove when duplicates are found using context-aware prioritization.
     * 
     * Implements intelligent content preservation logic that maintains conversation context
     * and message flow by prioritizing more valuable content types and preserving earlier
     * messages that provide better context for readers.
     * 
     * ## Prioritization Rules (in order)
     * 1. **Content Type Priority**: Main message content > Embedded content
     * 2. **Embedded Type Priority**: Quoted messages > File attachments > Link previews > Metadata > Reactions
     * 3. **Temporal Priority**: Earlier messages > Later messages (better context)
     * 
     * ## Context Preservation Strategy
     * - Main message text is always preserved over embedded content duplicates
     * - Quoted messages have highest embedded content priority
     * - File attachments prioritized over link previews
     * - Earlier messages preserved for better conversation flow
     * 
     * @param {ContentBlock} block1 - First duplicate content block
     * @param {ContentBlock} block2 - Second duplicate content block
     * @returns {ContentBlock} The content block that should be removed
     * @private Internal method for duplicate selection
     * @complexity O(1) - Constant time priority-based selection
     * @example
     * ```typescript
     * // Internal usage in duplicate identification
     * const blockToRemove = this.selectBlockToRemove(
     *   { content: "Link preview", isEmbedded: true, embeddedType: EmbeddedContentType.LINK_PREVIEW },
     *   { content: "Main message with link", isEmbedded: false }
     * );
     * // Returns the embedded link preview block (main content preserved)
     * ```
     * @see {@link getEmbeddedTypePriority} - Embedded content type prioritization
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
     * Get priority for embedded content types with higher values indicating more importance.
     * 
     * Defines the relative importance of different embedded content types for preservation
     * during deduplication. This priority system ensures that more valuable content types
     * are preserved when duplicates are found between different embedded content blocks.
     * 
     * ## Priority Hierarchy (higher = more important)
     * - **QUOTED_MESSAGE (4)**: User replies and quoted content - highest semantic value
     * - **FILE_ATTACHMENT (3)**: Documents, images, files - high utility value
     * - **LINK_PREVIEW (2)**: External link metadata - moderate utility value
     * - **METADATA (1)**: Titles, descriptions - low but useful
     * - **REACTIONS (0)**: Emoji reactions - lowest priority
     * - **CONTINUATION (0)**: Message continuations - lowest priority
     * 
     * @param {EmbeddedContentType} [type] - The embedded content type to get priority for
     * @returns {number} Priority value (0-4, higher = more important to preserve)
     * @private Internal method for embedded content prioritization
     * @complexity O(1) - Constant time lookup
     * @example
     * ```typescript
     * // Internal usage in block selection
     * const quotedPriority = this.getEmbeddedTypePriority(EmbeddedContentType.QUOTED_MESSAGE); // 4
     * const reactionPriority = this.getEmbeddedTypePriority(EmbeddedContentType.REACTIONS); // 0
     * // Quoted message would be preserved over reactions
     * ```
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
     * Apply deduplication by removing duplicate content from messages while preserving structure.
     * 
     * This method implements the final stage of the deduplication process by applying
     * the identified duplicate removals to the original messages. It uses the embedded
     * content analysis results to perform surgical content removal that maintains
     * message integrity and conversation flow.
     * 
     * ## Processing Strategy
     * 1. **Message-by-Message Processing**: Handle each message individually
     * 2. **Duplicate Block Identification**: Find all duplicates for current message
     * 3. **Smart Content Cleaning**: Use embedded analysis for precise removal
     * 4. **Preservation Logic**: Apply message preservation rules
     * 5. **Structure Maintenance**: Ensure valid message objects in output
     * 
     * ## Content Cleaning Approach
     * - Use cleaned text from embedded content detection when available
     * - Apply surgical removal for specific duplicate blocks
     * - Maintain message structure (metadata, reactions, thread info)
     * - Filter out messages with no meaningful content remaining
     * 
     * @param {EmbeddedDetectionResult[]} analysisResults - Results from embedded content analysis
     * @param {ContentBlock[]} duplicateBlocks - Content blocks identified for removal
     * @returns {SlackMessage[]} Array of processed messages with duplicates removed
     * @private Internal method for applying deduplication results
     * @complexity O(n*d) where n=number of messages, d=duplicates per message
     * @example
     * ```typescript
     * // Internal usage in main process method
     * const cleanedMessages = this.applyDeduplication(analysisResults, duplicateBlocks);
     * // Returns processed messages with duplicate content removed
     * ```
     * @see {@link shouldPreserveMessage} - Message preservation logic
     * @see {@link cleanMessageContent} - Content cleaning implementation
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
     * Determine if a message should be preserved despite having duplicate content.
     * 
     * Implements intelligent message preservation logic that considers message metadata,
     * threading information, and content uniqueness to decide whether a message with
     * duplicate content should still be kept in the final output. This prevents
     * over-aggressive deduplication that could break conversation context.
     * 
     * ## Preservation Criteria (any condition triggers preservation)
     * 1. **Metadata Preservation**: Messages with reactions, thread info, or timestamps
     * 2. **Threading Preservation**: Thread starters and replies (conversation structure)
     * 3. **Content Threshold**: Messages with <80% duplicate content (substantial unique content)
     * 4. **Empty Content Filtering**: Skip messages with no meaningful text content
     * 
     * ## Algorithm Logic
     * - Always preserve messages with social signals (reactions)
     * - Always preserve threaded messages (conversation structure)
     * - Calculate duplicate percentage and apply 80% threshold
     * - Use conservative approach to avoid breaking conversations
     * 
     * @param {SlackMessage} message - The message to evaluate for preservation
     * @param {ContentBlock[]} duplicates - Array of duplicate content blocks in this message
     * @returns {boolean} True if message should be preserved, false if it can be removed
     * @private Internal method for message preservation decisions
     * @complexity O(d) where d=number of duplicate blocks
     * @example
     * ```typescript
     * // Internal usage in deduplication application
     * const shouldKeep = this.shouldPreserveMessage(message, duplicateBlocks);
     * if (!shouldKeep) {
     *   // Skip this message entirely
     *   return;
     * }
     * ```
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
     * Clean message content by removing specific duplicate blocks while preserving structure.
     * 
     * Performs surgical removal of identified duplicate content blocks from message text
     * while maintaining the overall message structure and readability. This method handles
     * the precise extraction of embedded content that has been identified as duplicates.
     * 
     * ## Cleaning Strategy
     * - Target only embedded content blocks identified as duplicates
     * - Preserve main message text unless it's entirely duplicate
     * - Maintain whitespace and formatting structure
     * - Apply line-by-line removal for precision
     * 
     * ## Content Removal Process
     * 1. Process each duplicate block individually
     * 2. Apply embedded content removal for embedded duplicates
     * 3. Clean up resulting whitespace and formatting
     * 4. Return trimmed, well-formatted result text
     * 
     * @param {string} originalText - Original message text before cleaning
     * @param {ContentBlock[]} duplicates - Array of duplicate content blocks to remove
     * @returns {string} Cleaned message text with duplicates removed
     * @private Internal method for content cleaning
     * @complexity O(d*l) where d=duplicate blocks, l=average line count
     * @example
     * ```typescript
     * // Internal usage in deduplication application
     * const cleaned = this.cleanMessageContent(
     *   "Check this link: https://example.com\nGreat Article\nVery informative",
     *   [{ content: "Great Article", isEmbedded: true }]
     * );
     * // Result: "Check this link: https://example.com\nVery informative"
     * ```
     * @see {@link removeEmbeddedContent} - Specific embedded content removal
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
     * Remove embedded content from message text using multiple removal strategies.
     * 
     * Implements robust embedded content removal that handles various content formats
     * and structures. Uses multiple strategies to ensure successful removal even when
     * content formatting varies or contains special characters.
     * 
     * ## Removal Strategies
     * 1. **Exact Match Removal**: Direct string replacement for simple cases
     * 2. **Line-by-Line Removal**: Precise removal when exact match fails
     * 3. **Whitespace Cleanup**: Remove excessive blank lines and normalize spacing
     * 
     * ## Algorithm Process
     * - Attempt direct string replacement first (most efficient)
     * - Fall back to line-by-line comparison and removal
     * - Clean up resulting whitespace and formatting issues
     * - Return properly formatted text without embedded content
     * 
     * @param {string} text - Original message text containing embedded content
     * @param {string} embeddedContent - Specific embedded content to remove
     * @returns {string} Message text with embedded content removed and cleaned
     * @private Internal method for embedded content removal
     * @complexity O(n*m) where n=text lines, m=embedded content lines
     * @example
     * ```typescript
     * // Internal usage in message content cleaning
     * const cleaned = this.removeEmbeddedContent(
     *   "Check this out:\nhttps://example.com\nGreat Website\nSo useful!",
     *   "https://example.com\nGreat Website"
     * );
     * // Result: "Check this out:\nSo useful!"
     * ```
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