import { Logger } from './logger';
import {
  detectTextEncoding,
  correctEncodingIssues,
  normalizeUnicode as applyUnicodeNormalization,
  convertSmartQuotes,
  validateTextIntegrity,
  type EncodingDetectionResult,
  type TextCorrectionResult,
} from './text-encoding-utils';

export interface TextNormalizationOptions {
  correctEncoding?: boolean;
  convertSmartQuotes?: boolean;
  normalizeUnicode?: boolean;
  unicodeForm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
  normalizeWhitespace?: boolean;
  preserveCodeFormatting?: boolean;
  normalizeLineEndings?: boolean;
  removeZeroWidth?: boolean;
  aggressive?: boolean;
  validateIntegrity?: boolean;
}

export interface TextNormalizationResult {
  normalizedText: string;
  wasChanged: boolean;
  encodingDetection: EncodingDetectionResult;
  encodingCorrections: TextCorrectionResult;
  steps: string[];
  validation?: {
    isValid: boolean;
    issues: string[];
    lengthChange: number;
  };
}

// prettier-ignore
// Keeping one per line for readability when scanning unicode entries
const ZERO_WIDTH_CHARS = [
  '\u200B',
  '\u200C',
  '\u200D',
  '\u2060',
  '\uFEFF',
  '\u061C',
  '\u180E',
];

// prettier-ignore
// Pattern list is easier to diff when each expression is on its own line
const CODE_BLOCK_PATTERNS = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /^ {4}.+$/gm,
  /^\t.+$/gm,
];

export class TextNormalizationEngine {
  private readonly defaults: Required<TextNormalizationOptions> = {
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

  normalize(text: string, options: TextNormalizationOptions = {}): TextNormalizationResult {
    try {
      const opts = { ...this.defaults, ...options };
      const steps: string[] = [];
      let normalized = text;
      let wasChanged = false;

      const encodingDetection = detectTextEncoding(text);
      steps.push(
        `Detected encoding: ${encodingDetection.encoding} (confidence: ${encodingDetection.confidence})`
      );

      let encodingCorrections: TextCorrectionResult = {
        correctedText: normalized,
        wasChanged: false,
        corrections: [],
      };

      if (opts.correctEncoding && encodingDetection.hasEncodingIssues) {
        encodingCorrections = correctEncodingIssues(normalized, opts.aggressive);
        if (encodingCorrections.wasChanged) {
          normalized = encodingCorrections.correctedText;
          wasChanged = true;
          steps.push(`Applied encoding corrections: ${encodingCorrections.corrections.join(', ')}`);
        }
      }

      if (opts.convertSmartQuotes) {
        const before = normalized;
        normalized = convertSmartQuotes(normalized);
        if (normalized !== before) {
          wasChanged = true;
          steps.push('Converted smart quotes to ASCII');
        }
      }

      if (opts.normalizeUnicode) {
        const before = normalized;
        normalized = applyUnicodeNormalization(normalized, opts.unicodeForm);
        if (normalized !== before) {
          wasChanged = true;
          steps.push(`Applied Unicode ${opts.unicodeForm} normalization`);
        }
      }

      if (opts.removeZeroWidth) {
        const before = normalized;
        normalized = this.removeZeroWidthChars(normalized);
        if (normalized !== before) {
          wasChanged = true;
          steps.push('Removed zero-width characters');
        }
      }

      if (opts.normalizeLineEndings) {
        const before = normalized;
        normalized = this.normalizeLineEndings(normalized);
        if (normalized !== before) {
          wasChanged = true;
          steps.push('Normalized line endings to LF');
        }
      }

      if (opts.normalizeWhitespace) {
        const before = normalized;
        normalized = this.normalizeWhitespace(normalized, opts.preserveCodeFormatting);
        if (normalized !== before) {
          wasChanged = true;
          steps.push('Normalized whitespace');
        }
      }

      let validation: TextNormalizationResult['validation'];
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
        validation,
      };
    } catch (error) {
      Logger.error('TextNormalizationEngine', 'Error during text normalization', error);
      return {
        normalizedText: text,
        wasChanged: false,
        encodingDetection: {
          encoding: 'unknown',
          confidence: 0,
          hasNonAscii: false,
          hasEncodingIssues: true,
          issues: ['Normalization failed'],
        },
        encodingCorrections: {
          correctedText: text,
          wasChanged: false,
          corrections: [],
        },
        steps: ['Normalization failed'],
      };
    }
  }

  quickNormalize(text: string): string {
    try {
      return this.normalize(text, {
        correctEncoding: true,
        convertSmartQuotes: true,
        normalizeUnicode: true,
        normalizeWhitespace: true,
        preserveCodeFormatting: true,
        normalizeLineEndings: true,
        removeZeroWidth: true,
        aggressive: false,
        validateIntegrity: false,
      }).normalizedText;
    } catch (error) {
      Logger.warn('TextNormalizationEngine', 'Error in quickNormalize', error);
      return text;
    }
  }

  needsNormalization(text: string): boolean {
    try {
      if (text.includes('\r')) return true;
      if (/[\u201C\u201D\u2018\u2019\u2013\u2014\u2026]/.test(text)) return true;
      if (ZERO_WIDTH_CHARS.some(char => text.includes(char))) return true;
      if (/\s{2,}/.test(text)) return true;

      return detectTextEncoding(text).hasEncodingIssues;
    } catch (error) {
      Logger.warn('TextNormalizationEngine', 'Error checking normalization need', error);
      return false;
    }
  }

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
      const smartQuoteMatches =
        text.match(/[\u201C\u201D\u2018\u2019\u2013\u2014\u2026]/g)?.length || 0;
      const multipleSpaceMatches = text.match(/\s{2,}/g)?.length || 0;

      return {
        hasSmartQuotes: smartQuoteMatches > 0,
        hasZeroWidth: ZERO_WIDTH_CHARS.some(char => text.includes(char)),
        hasEncodingIssues: detection.hasEncodingIssues,
        hasMultipleSpaces: multipleSpaceMatches > 0,
        hasCRLF: text.includes('\r'),
        estimatedChanges:
          detection.issues.length +
          smartQuoteMatches +
          multipleSpaceMatches +
          (text.includes('\r') ? 1 : 0),
      };
    } catch (error) {
      Logger.warn('TextNormalizationEngine', 'Error gathering stats', error);
      return {
        hasSmartQuotes: false,
        hasZeroWidth: false,
        hasEncodingIssues: false,
        hasMultipleSpaces: false,
        hasCRLF: false,
        estimatedChanges: 0,
      };
    }
  }

  private removeZeroWidthChars(text: string): string {
    let result = text;
    for (const char of ZERO_WIDTH_CHARS) {
      result = result.replaceAll(char, '');
    }
    return result;
  }

  private normalizeLineEndings(text: string): string {
    return text.replace(/\r\n|\r/g, '\n');
  }

  private normalizeWhitespace(text: string, preserveCodeFormatting: boolean): string {
    if (!preserveCodeFormatting) {
      return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    }

    const codeBlocks: { placeholder: string; content: string }[] = [];
    let placeholderIndex = 0;
    let content = text;

    for (const pattern of CODE_BLOCK_PATTERNS) {
      content = content.replace(pattern, match => {
        const placeholder = `__CODE_BLOCK_${placeholderIndex++}__`;
        codeBlocks.push({ placeholder, content: match });
        return placeholder;
      });
    }

    content = content
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    for (const { placeholder, content: original } of codeBlocks) {
      content = content.replace(placeholder, original);
    }

    return content;
  }
}

export const textNormalizationEngine = new TextNormalizationEngine();
