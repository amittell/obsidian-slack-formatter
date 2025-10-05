import { Logger } from './logger';

export interface EncodingDetectionResult {
  encoding: string;
  confidence: number;
  hasNonAscii: boolean;
  hasEncodingIssues: boolean;
  issues: string[];
}

export interface TextCorrectionResult {
  correctedText: string;
  wasChanged: boolean;
  corrections: string[];
}

export interface SanitizeTextOptions {
  correctEncoding?: boolean;
  normalizeUnicode?: boolean;
  aggressive?: boolean;
  preserveFormatting?: boolean;
}

const ENCODING_CORRECTIONS: Record<string, string> = {
  '\u201C': '"',
  '\u201D': '"',
  '\u2018': "'",
  '\u2019': "'",
  '\u2013': '--',
  '\u2014': '--',
  '\u2015': '--',
  '\u2026': '...',
  'â€™': "'",
  'â€œ': '"',
  'â€': '"',
  'â€"': '--',
  'â€¦': '...',
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã­': 'í',
  'Ã³': 'ó',
  '\u00c3\u00ba': 'ú',
  'Ã±': 'ñ',
  'Ã¼': 'ü',
  'â„¢': '™',
  'Â®': '®',
  'Â©': '©',
  'Â°': '°',
};

const ENCODING_ISSUE_PATTERNS = [
  /â€[™œ"']/g,
  /Ã[¡-¿]/g,
  /Â[®©°]/g,
  /[\u2013\u2014\u2026\u201C\u201D\u2018\u2019]/g,
];

export function detectTextEncoding(text: string): EncodingDetectionResult {
  try {
    const result: EncodingDetectionResult = {
      encoding: 'utf-8',
      confidence: 0.8,
      hasNonAscii: false,
      hasEncodingIssues: false,
      issues: [],
    };

    const nonAsciiMatch = text.match(/[^\x00-\x7F]/g);
    if (nonAsciiMatch) {
      result.hasNonAscii = true;
    }

    for (const pattern of ENCODING_ISSUE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        result.hasEncodingIssues = true;
        result.issues.push(`Found ${matches.length} instances of pattern: ${pattern.source}`);
        result.confidence = Math.max(0.3, result.confidence - 0.2);
      }
    }

    for (const [corrupted] of Object.entries(ENCODING_CORRECTIONS)) {
      if (corrupted.length > 1 && text.includes(corrupted)) {
        result.hasEncodingIssues = true;
        result.issues.push(`Found potentially corrupted sequence: "${corrupted}"`);
      }
    }

    if (!result.hasNonAscii) {
      result.encoding = 'ascii';
      result.confidence = 0.95;
    } else {
      try {
        const encoded = new TextEncoder().encode(text);
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
        if (decoded === text) {
          result.encoding = 'utf-8';
          result.confidence = result.hasEncodingIssues ? 0.7 : 0.9;
        } else {
          result.encoding = 'windows-1252-corrupted';
          result.confidence = 0.4;
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
    Logger.warn('text-encoding-utils', 'Error detecting text encoding', error);
    return {
      encoding: 'unknown',
      confidence: 0.1,
      hasNonAscii: false,
      hasEncodingIssues: true,
      issues: ['Error during encoding detection'],
    };
  }
}

export function correctEncodingIssues(text: string, aggressive = false): TextCorrectionResult {
  try {
    let corrected = text;
    const corrections: string[] = [];

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

    if (aggressive) {
      const lineEndingsBefore = corrected.match(/\r\n|\r|\n/g)?.length || 0;
      corrected = corrected.replace(/\r\n|\r/g, '\n');
      const lineEndingsAfter = corrected.match(/\r\n|\r|\n/g)?.length || 0;
      if (lineEndingsBefore !== lineEndingsAfter) {
        corrections.push('Normalized line endings');
      }

      const spaceBefore = corrected.match(/[ \t]{2,}/g)?.length || 0;
      corrected = corrected.replace(/[ \t]{2,}/g, ' ');
      const spaceAfter = corrected.match(/[ \t]{2,}/g)?.length || 0;
      if (spaceBefore > spaceAfter) {
        corrections.push('Normalized multiple spaces');
      }
    }

    return {
      correctedText: corrected,
      wasChanged: corrections.length > 0,
      corrections,
    };
  } catch (error) {
    Logger.warn('text-encoding-utils', 'Error correcting encoding issues', error);
    return {
      correctedText: text,
      wasChanged: false,
      corrections: ['Error during correction process'],
    };
  }
}

export function normalizeUnicode(
  text: string,
  form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' = 'NFC'
): string {
  try {
    return text.normalize(form);
  } catch (error) {
    Logger.warn('text-encoding-utils', 'Error normalizing Unicode', error);
    return text;
  }
}

export function sanitizeText(text: string, options: SanitizeTextOptions = {}): string {
  try {
    let sanitized = text;

    if (options.correctEncoding !== false) {
      const correction = correctEncodingIssues(sanitized, options.aggressive);
      sanitized = correction.correctedText;
    }

    if (options.normalizeUnicode !== false) {
      sanitized = normalizeUnicode(sanitized);
    }

    if (!options.preserveFormatting) {
      sanitized = sanitized.trim();
    }

    return sanitized;
  } catch (error) {
    Logger.warn('text-encoding-utils', 'Error sanitizing text', error);
    return text;
  }
}

export function hasEncodingCorruption(text: string): boolean {
  try {
    if (/â€[™œ"']/.test(text)) return true;
    if (/Ã[¡-¿]/.test(text)) return true;
    if (/Â[®©°]/.test(text)) return true;
    if (text.includes('�')) return true;
    return false;
  } catch (error) {
    Logger.warn('text-encoding-utils', 'Error checking encoding corruption', error);
    return false;
  }
}

export function convertSmartQuotes(text: string): string {
  try {
    return text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  } catch (error) {
    Logger.warn('text-encoding-utils', 'Error converting smart quotes', error);
    return text;
  }
}

export function validateTextIntegrity(
  original: string,
  processed: string
): { isValid: boolean; issues: string[]; lengthChange: number } {
  try {
    const issues: string[] = [];
    const lengthChange = processed.length - original.length;

    if (Math.abs(lengthChange) > original.length * 0.1) {
      issues.push(`Significant length change: ${lengthChange} characters`);
    }

    const originalAlphaNum = original.match(/[a-zA-Z0-9]/g)?.length || 0;
    const processedAlphaNum = processed.match(/[a-zA-Z0-9]/g)?.length || 0;
    const alphaNumLoss = originalAlphaNum - processedAlphaNum;

    if (alphaNumLoss > 0) {
      issues.push(`Lost ${alphaNumLoss} alphanumeric characters`);
    }

    if (!original.includes('�') && processed.includes('�')) {
      issues.push('Introduced replacement characters (�)');
    }

    return {
      isValid: issues.length === 0,
      issues,
      lengthChange,
    };
  } catch (error) {
    Logger.warn('text-encoding-utils', 'Error validating text integrity', error);
    return {
      isValid: false,
      issues: ['Error during validation'],
      lengthChange: 0,
    };
  }
}
