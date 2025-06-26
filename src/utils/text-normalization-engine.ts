/**
 * Comprehensive text normalization engine for consistent character handling.
 * Provides configurable text processing with semantic content preservation.
 * @module text-normalization-engine
 */

import { Logger } from './logger';
import { 
    detectTextEncoding, 
    correctEncodingIssues, 
    normalizeUnicode, 
    convertSmartQuotes,
    validateTextIntegrity,
    type EncodingDetectionResult,
    type TextCorrectionResult
} from './text-encoding-utils';

/**
 * Text normalization options
 */
export interface TextNormalizationOptions {
    /** Correct character encoding issues */
    correctEncoding?: boolean;
    /** Convert smart quotes to ASCII equivalents */
    convertSmartQuotes?: boolean;
    /** Normalize Unicode characters */
    normalizeUnicode?: boolean;
    /** Unicode normalization form */
    unicodeForm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
    /** Normalize whitespace */
    normalizeWhitespace?: boolean;
    /** Preserve formatting whitespace (overrides normalizeWhitespace for code blocks) */
    preserveCodeFormatting?: boolean;
    /** Normalize line endings to LF */
    normalizeLineEndings?: boolean;
    /** Remove zero-width characters */
    removeZeroWidth?: boolean;
    /** Apply aggressive corrections */
    aggressive?: boolean;
    /** Validate output integrity */
    validateIntegrity?: boolean;
}

/**
 * Text normalization result
 */
export interface TextNormalizationResult {
    /** Normalized text */
    normalizedText: string;
    /** Whether any changes were made */
    wasChanged: boolean;
    /** Encoding detection result */
    encodingDetection: EncodingDetectionResult;
    /** Encoding corrections applied */
    encodingCorrections: TextCorrectionResult;
    /** List of all normalization steps applied */
    steps: string[];
    /** Validation result if enabled */
    validation?: {
        isValid: boolean;
        issues: string[];
        lengthChange: number;
    };
}

/**
 * Zero-width and invisible character patterns
 */
const ZERO_WIDTH_CHARS = [
    '\u200B', // Zero Width Space
    '\u200C', // Zero Width Non-Joiner  
    '\u200D', // Zero Width Joiner
    '\u2060', // Word Joiner
    '\uFEFF', // Zero Width No-Break Space (BOM)
    '\u061C', // Arabic Letter Mark
    '\u180E', // Mongolian Vowel Separator
];

/**
 * Code block detection patterns
 */
const CODE_BLOCK_PATTERNS = [
    /```[\s\S]*?```/g,     // Triple backtick code blocks
    /`[^`\n]+`/g,          // Inline code
    /^    .+$/gm,          // Indented code blocks (4 spaces)
    /^\t.+$/gm,            // Indented code blocks (tab)
];

/**
 * Comprehensive text normalization engine
 */
export class TextNormalizationEngine {
    private readonly defaultOptions: Required<TextNormalizationOptions> = {
        correctEncoding: true,
        convertSmartQuotes: true,
        normalizeUnicode: true,
        unicodeForm: 'NFC',
        normalizeWhitespace: true,
        preserveCodeFormatting: true,
        normalizeLineEndings: true,
        removeZeroWidth: true,
        aggressive: false,
        validateIntegrity: true,
    };

    /**
     * Normalize text using the specified options.
     * @param text - The text to normalize
     * @param options - Normalization options
     * @returns Comprehensive normalization result
     */
    normalize(text: string, options: TextNormalizationOptions = {}): TextNormalizationResult {
        try {
            const opts = { ...this.defaultOptions, ...options };
            const steps: string[] = [];
            let normalized = text;
            let wasChanged = false;

            // Step 1: Detect encoding issues
            const encodingDetection = detectTextEncoding(text);
            steps.push(`Detected encoding: ${encodingDetection.encoding} (confidence: ${encodingDetection.confidence})`);

            // Step 2: Correct encoding issues
            let encodingCorrections: TextCorrectionResult = {
                correctedText: normalized,
                wasChanged: false,
                corrections: []
            };

            if (opts.correctEncoding && encodingDetection.hasEncodingIssues) {
                encodingCorrections = correctEncodingIssues(normalized, opts.aggressive);
                if (encodingCorrections.wasChanged) {
                    normalized = encodingCorrections.correctedText;
                    wasChanged = true;
                    steps.push(`Applied encoding corrections: ${encodingCorrections.corrections.join(', ')}`);
                }
            }

            // Step 3: Convert smart quotes
            if (opts.convertSmartQuotes) {
                const beforeQuotes = normalized;
                normalized = convertSmartQuotes(normalized);
                if (normalized !== beforeQuotes) {
                    wasChanged = true;
                    steps.push('Converted smart quotes to ASCII');
                }
            }

            // Step 4: Normalize Unicode
            if (opts.normalizeUnicode) {
                const beforeUnicode = normalized;
                normalized = normalizeUnicode(normalized, opts.unicodeForm);
                if (normalized !== beforeUnicode) {
                    wasChanged = true;
                    steps.push(`Applied Unicode ${opts.unicodeForm} normalization`);
                }
            }

            // Step 5: Remove zero-width characters
            if (opts.removeZeroWidth) {
                const beforeZeroWidth = normalized;
                normalized = this.removeZeroWidthChars(normalized);
                if (normalized !== beforeZeroWidth) {
                    wasChanged = true;
                    steps.push('Removed zero-width characters');
                }
            }

            // Step 6: Normalize line endings
            if (opts.normalizeLineEndings) {
                const beforeLineEndings = normalized;
                normalized = this.normalizeLineEndings(normalized);
                if (normalized !== beforeLineEndings) {
                    wasChanged = true;
                    steps.push('Normalized line endings to LF');
                }
            }

            // Step 7: Normalize whitespace (preserving code formatting)
            if (opts.normalizeWhitespace) {
                const beforeWhitespace = normalized;
                normalized = this.normalizeWhitespace(normalized, opts.preserveCodeFormatting);
                if (normalized !== beforeWhitespace) {
                    wasChanged = true;
                    steps.push('Normalized whitespace');
                }
            }

            // Step 8: Validate integrity if requested
            let validation;
            if (opts.validateIntegrity) {
                validation = validateTextIntegrity(text, normalized);
                if (!validation.isValid) {
                    steps.push(`Validation issues: ${validation.issues.join(', ')}`);
                }
            }

            return {
                normalizedText: normalized,
                wasChanged,
                encodingDetection,
                encodingCorrections,
                steps,
                validation
            };
        } catch (error) {
            Logger.error('TextNormalizationEngine', 'Error during text normalization:', error);
            return {
                normalizedText: text,
                wasChanged: false,
                encodingDetection: {
                    encoding: 'unknown',
                    confidence: 0,
                    hasNonAscii: false,
                    hasEncodingIssues: true,
                    issues: ['Error during normalization']
                },
                encodingCorrections: {
                    correctedText: text,
                    wasChanged: false,
                    corrections: []
                },
                steps: ['Error during normalization process']
            };
        }
    }

    /**
     * Quick normalization with safe defaults for Slack content.
     * @param text - The text to normalize
     * @returns Normalized text
     */
    quickNormalize(text: string): string {
        try {
            const result = this.normalize(text, {
                correctEncoding: true,
                convertSmartQuotes: true,
                normalizeUnicode: true,
                normalizeWhitespace: true,
                preserveCodeFormatting: true,
                aggressive: false,
                validateIntegrity: false // Skip validation for performance
            });
            return result.normalizedText;
        } catch (error) {
            Logger.warn('TextNormalizationEngine', 'Error in quick normalize:', error);
            return text;
        }
    }

    /**
     * Remove zero-width and invisible characters.
     * @private
     */
    private removeZeroWidthChars(text: string): string {
        let result = text;
        for (const char of ZERO_WIDTH_CHARS) {
            result = result.replaceAll(char, '');
        }
        return result;
    }

    /**
     * Normalize line endings to LF (\n).
     * @private
     */
    private normalizeLineEndings(text: string): string {
        return text.replace(/\r\n|\r/g, '\n');
    }

    /**
     * Normalize whitespace while preserving code formatting.
     * @private
     */
    private normalizeWhitespace(text: string, preserveCodeFormatting: boolean): string {
        if (!preserveCodeFormatting) {
            // Simple whitespace normalization
            return text
                .replace(/[ \t]+/g, ' ')  // Multiple spaces/tabs to single space
                .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double newline
                .trim();
        }

        // Preserve code formatting - extract code blocks first
        const codeBlocks: { placeholder: string; content: string }[] = [];
        let placeholderIndex = 0;
        let textWithPlaceholders = text;

        // Extract and replace code blocks with placeholders
        for (const pattern of CODE_BLOCK_PATTERNS) {
            textWithPlaceholders = textWithPlaceholders.replace(pattern, (match) => {
                const placeholder = `__CODE_BLOCK_${placeholderIndex++}__`;
                codeBlocks.push({ placeholder, content: match });
                return placeholder;
            });
        }

        // Normalize whitespace in non-code content
        textWithPlaceholders = textWithPlaceholders
            .replace(/[ \t]+/g, ' ')  // Multiple spaces/tabs to single space
            .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double newline
            .trim();

        // Restore code blocks
        for (const { placeholder, content } of codeBlocks) {
            textWithPlaceholders = textWithPlaceholders.replace(placeholder, content);
        }

        return textWithPlaceholders;
    }

    /**
     * Check if text needs normalization.
     * @param text - The text to check
     * @returns True if normalization is recommended
     */
    needsNormalization(text: string): boolean {
        try {
            // Quick checks for common issues
            if (text.includes('\r')) return true; // CRLF line endings
            if (/[\u201C\u201D\u2018\u2019\u2013\u2014\u2026]/.test(text)) return true; // Smart quotes/dashes
            if (ZERO_WIDTH_CHARS.some(char => text.includes(char))) return true;
            if (/\s{2,}/.test(text)) return true; // Multiple spaces
            
            // Check encoding issues
            const detection = detectTextEncoding(text);
            return detection.hasEncodingIssues;
        } catch (error) {
            Logger.warn('TextNormalizationEngine', 'Error checking normalization needs:', error);
            return false;
        }
    }

    /**
     * Get normalization statistics for text.
     * @param text - The text to analyze
     * @returns Statistics about potential normalizations
     */
    getStats(text: string): {
        hasSmartQuotes: boolean;
        hasZeroWidth: boolean;
        hasEncodingIssues: boolean;
        hasMultipleSpaces: boolean;
        hasCRLF: boolean;
        estimatedChanges: number;
    } {
        try {
            const detection = detectTextEncoding(text);
            
            return {
                hasSmartQuotes: /[\u201C\u201D\u2018\u2019\u2013\u2014\u2026]/.test(text),
                hasZeroWidth: ZERO_WIDTH_CHARS.some(char => text.includes(char)),
                hasEncodingIssues: detection.hasEncodingIssues,
                hasMultipleSpaces: /\s{2,}/.test(text),
                hasCRLF: text.includes('\r'),
                estimatedChanges: detection.issues.length + 
                    (text.match(/[\u201C\u201D\u2018\u2019\u2013\u2014\u2026]/g)?.length || 0) +
                    (text.match(/\s{2,}/g)?.length || 0) +
                    (text.includes('\r') ? 1 : 0)
            };
        } catch (error) {
            Logger.warn('TextNormalizationEngine', 'Error getting stats:', error);
            return {
                hasSmartQuotes: false,
                hasZeroWidth: false,
                hasEncodingIssues: false,
                hasMultipleSpaces: false,
                hasCRLF: false,
                estimatedChanges: 0
            };
        }
    }
}

/**
 * Default text normalization engine instance
 */
export const textNormalizationEngine = new TextNormalizationEngine();