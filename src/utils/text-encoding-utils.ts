/**
 * Text encoding detection and correction utilities.
 * Handles character encoding issues, smart quotes, and text normalization.
 * @module text-encoding-utils
 */

import { Logger } from './logger';

/**
 * Character encoding detection results
 */
export interface EncodingDetectionResult {
    /** Detected encoding (utf-8, ascii, iso-8859-1, etc.) */
    encoding: string;
    /** Confidence level (0-1) */
    confidence: number;
    /** Whether the text contains non-ASCII characters */
    hasNonAscii: boolean;
    /** Whether the text contains potential encoding issues */
    hasEncodingIssues: boolean;
    /** Specific issues found */
    issues: string[];
}

/**
 * Text correction result
 */
export interface TextCorrectionResult {
    /** Corrected text */
    correctedText: string;
    /** Whether any corrections were made */
    wasChanged: boolean;
    /** List of corrections applied */
    corrections: string[];
}

/**
 * Common character encoding issues and their corrections
 */
const ENCODING_CORRECTIONS: Record<string, string> = {
    // Smart quotes to regular quotes
    '\u201C': '"',  // Left double quotation mark
    '\u201D': '"',  // Right double quotation mark
    '\u2018': "'",  // Left single quotation mark  
    '\u2019': "'",  // Right single quotation mark
    
    // Dashes
    '\u2013': '-',  // En dash
    '\u2014': '--', // Em dash
    '\u2015': '--', // Horizontal bar
    
    // Ellipsis
    '\u2026': '...',
    
    // Common Windows-1252 to UTF-8 issues
    'â€™': "'",  // Apostrophe/right single quote
    'â€œ': '"',  // Left double quote
    'â€': '"',   // Right double quote
    'â€"': '--', // Em dash
    'â€¦': '...', // Ellipsis
    
    // Latin-1 supplement issues
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã±': 'ñ',
    'Ã¼': 'ü',
    
    // Other common corruptions
    'â„¢': '™',   // Trademark
    'Â®': '®',    // Registered trademark
    'Â©': '©',    // Copyright
    'Â°': '°',    // Degree symbol
};

/**
 * Patterns that indicate potential encoding issues
 */
const ENCODING_ISSUE_PATTERNS = [
    /â€[™œ"]/g,          // Windows-1252 smart quotes/em dash patterns
    /Ã[¡-¿]/g,           // Latin-1 supplement corruption
    /Â[®©°]/g,           // Common symbol corruptions
    /[^\x00-\x7F]{2,}/g, // Multiple consecutive non-ASCII chars (suspicious)
];

/**
 * Detect the encoding of text and identify potential issues.
 * @param text - The text to analyze
 * @returns EncodingDetectionResult with detected encoding and issues
 */
export function detectTextEncoding(text: string): EncodingDetectionResult {
    try {
        const result: EncodingDetectionResult = {
            encoding: 'utf-8',
            confidence: 0.8,
            hasNonAscii: false,
            hasEncodingIssues: false,
            issues: []
        };

        // Check for non-ASCII characters
        const nonAsciiMatch = text.match(/[^\x00-\x7F]/g);
        if (nonAsciiMatch) {
            result.hasNonAscii = true;
        }

        // Check for encoding issue patterns
        for (const pattern of ENCODING_ISSUE_PATTERNS) {
            const matches = text.match(pattern);
            if (matches) {
                result.hasEncodingIssues = true;
                result.issues.push(`Found ${matches.length} instances of pattern: ${pattern.source}`);
                result.confidence = Math.max(0.3, result.confidence - 0.2); // Lower confidence
            }
        }

        // Check for common corrupted sequences
        for (const [corrupted] of Object.entries(ENCODING_CORRECTIONS)) {
            if (text.includes(corrupted) && corrupted.length > 1) {
                result.hasEncodingIssues = true;
                result.issues.push(`Found potentially corrupted sequence: "${corrupted}"`);
            }
        }

        // Estimate encoding based on character distribution
        if (!result.hasNonAscii) {
            result.encoding = 'ascii';
            result.confidence = 0.95;
        } else if (result.hasEncodingIssues) {
            result.encoding = 'windows-1252-corrupted';
            result.confidence = 0.4;
        } else {
            // Check for valid UTF-8 sequences
            try {
                const encoded = new TextEncoder().encode(text);
                const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
                if (decoded === text) {
                    result.encoding = 'utf-8';
                    result.confidence = 0.9;
                }
            } catch {
                result.encoding = 'unknown';
                result.confidence = 0.2;
                result.hasEncodingIssues = true;
                result.issues.push('Text contains invalid UTF-8 sequences');
            }
        }

        return result;
    } catch (error) {
        Logger.warn('text-encoding-utils', 'Error detecting text encoding:', error);
        return {
            encoding: 'unknown',
            confidence: 0.1,
            hasNonAscii: false,
            hasEncodingIssues: true,
            issues: ['Error during encoding detection']
        };
    }
}

/**
 * Correct common character encoding issues in text.
 * @param text - The text to correct
 * @param aggressive - Whether to apply aggressive corrections (default: false)
 * @returns TextCorrectionResult with corrected text and applied corrections
 */
export function correctEncodingIssues(text: string, aggressive = false): TextCorrectionResult {
    try {
        let corrected = text;
        const corrections: string[] = [];

        // Apply character-by-character corrections
        for (const [wrong, right] of Object.entries(ENCODING_CORRECTIONS)) {
            if (corrected.includes(wrong)) {
                const beforeLength = corrected.length;
                corrected = corrected.replaceAll(wrong, right);
                const afterLength = corrected.length;
                
                if (beforeLength !== afterLength || !corrected.includes(wrong)) {
                    corrections.push(`Corrected "${wrong}" → "${right}"`);
                }
            }
        }

        // Aggressive corrections (apply with caution)
        if (aggressive) {
            // Fix multiple spaces
            const spaceBefore = corrected.match(/\s{2,}/g)?.length || 0;
            corrected = corrected.replace(/\s{2,}/g, ' ');
            const spaceAfter = corrected.match(/\s{2,}/g)?.length || 0;
            if (spaceBefore > spaceAfter) {
                corrections.push('Normalized multiple spaces');
            }

            // Fix line ending inconsistencies
            const lineEndingsBefore = corrected.match(/\r\n|\r|\n/g)?.length || 0;
            corrected = corrected.replace(/\r\n|\r/g, '\n');
            const lineEndingsAfter = corrected.match(/\r\n|\r|\n/g)?.length || 0;
            if (lineEndingsBefore !== lineEndingsAfter) {
                corrections.push('Normalized line endings');
            }
        }

        return {
            correctedText: corrected,
            wasChanged: corrections.length > 0,
            corrections
        };
    } catch (error) {
        Logger.warn('text-encoding-utils', 'Error correcting encoding issues:', error);
        return {
            correctedText: text,
            wasChanged: false,
            corrections: ['Error during correction process']
        };
    }
}

/**
 * Normalize Unicode characters to their canonical forms.
 * @param text - The text to normalize
 * @param form - Unicode normalization form (NFC, NFD, NFKC, NFKD)
 * @returns Normalized text
 */
export function normalizeUnicode(text: string, form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' = 'NFC'): string {
    try {
        return text.normalize(form);
    } catch (error) {
        Logger.warn('text-encoding-utils', 'Error normalizing Unicode:', error);
        return text;
    }
}

/**
 * Sanitize text for safe processing while preserving semantic content.
 * @param text - The text to sanitize
 * @param options - Sanitization options
 * @returns Sanitized text
 */
export function sanitizeText(text: string, options: {
    /** Whether to correct encoding issues */
    correctEncoding?: boolean;
    /** Whether to normalize Unicode */
    normalizeUnicode?: boolean;
    /** Whether to apply aggressive corrections */
    aggressive?: boolean;
    /** Whether to preserve formatting whitespace */
    preserveFormatting?: boolean;
} = {}): string {
    try {
        let sanitized = text;
        
        // Correct encoding issues if requested
        if (options.correctEncoding !== false) {
            const correctionResult = correctEncodingIssues(sanitized, options.aggressive);
            sanitized = correctionResult.correctedText;
        }
        
        // Normalize Unicode if requested
        if (options.normalizeUnicode !== false) {
            sanitized = normalizeUnicode(sanitized);
        }
        
        // Basic sanitization without destroying formatting
        if (!options.preserveFormatting) {
            // Only trim leading/trailing whitespace, preserve internal formatting
            sanitized = sanitized.trim();
        }
        
        return sanitized;
    } catch (error) {
        Logger.warn('text-encoding-utils', 'Error sanitizing text:', error);
        return text;
    }
}

/**
 * Check if text contains common encoding corruption patterns.
 * @param text - The text to check
 * @returns True if corruption patterns are detected
 */
export function hasEncodingCorruption(text: string): boolean {
    try {
        // Check for Windows-1252 to UTF-8 double-encoding patterns
        if (/â€[™œ"']/.test(text)) return true;
        
        // Check for Latin-1 corruption patterns
        if (/Ã[¡-¿]/.test(text)) return true;
        
        // Check for symbol corruption patterns
        if (/Â[®©°]/.test(text)) return true;
        
        // Check for replacement character (indicates failed decoding)
        if (text.includes('�')) return true;
        
        return false;
    } catch (error) {
        Logger.warn('text-encoding-utils', 'Error checking encoding corruption:', error);
        return false;
    }
}

/**
 * Convert smart quotes to regular ASCII quotes.
 * @param text - The text to process
 * @returns Text with smart quotes converted
 */
export function convertSmartQuotes(text: string): string {
    try {
        return text
            .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
            .replace(/[\u2018\u2019]/g, "'"); // Smart single quotes/apostrophes
    } catch (error) {
        Logger.warn('text-encoding-utils', 'Error converting smart quotes:', error);
        return text;
    }
}

/**
 * Validate that text processing hasn't corrupted the content.
 * @param original - Original text
 * @param processed - Processed text
 * @returns Validation result with issues found
 */
export function validateTextIntegrity(original: string, processed: string): {
    isValid: boolean;
    issues: string[];
    lengthChange: number;
} {
    try {
        const issues: string[] = [];
        const lengthChange = processed.length - original.length;
        
        // Check for significant length changes
        if (Math.abs(lengthChange) > original.length * 0.1) {
            issues.push(`Significant length change: ${lengthChange} characters`);
        }
        
        // Check for loss of alphanumeric content
        const originalAlphaNum = original.match(/[a-zA-Z0-9]/g)?.length || 0;
        const processedAlphaNum = processed.match(/[a-zA-Z0-9]/g)?.length || 0;
        const alphaNumLoss = originalAlphaNum - processedAlphaNum;
        
        if (alphaNumLoss > 0) {
            issues.push(`Lost ${alphaNumLoss} alphanumeric characters`);
        }
        
        // Check for introduction of replacement characters
        if (!original.includes('�') && processed.includes('�')) {
            issues.push('Introduced replacement characters (�)');
        }
        
        return {
            isValid: issues.length === 0,
            issues,
            lengthChange
        };
    } catch (error) {
        Logger.warn('text-encoding-utils', 'Error validating text integrity:', error);
        return {
            isValid: false,
            issues: ['Error during validation'],
            lengthChange: 0
        };
    }
}