/**
 * Simple content sanitization utility for basic text cleaning
 */

/**
 * Sanitize text by normalizing whitespace and basic character encoding
 * @param text - The text to sanitize
 * @returns The sanitized text
 */
export function quickSanitize(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    // Normalize Unicode
    let result = text.normalize('NFC');

    // Fix common smart quotes and dashes
    result = result
      .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
      .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
      .replace(/[\u2013\u2014]/g, '-')  // En dash, Em dash
      .replace(/\u2026/g, '...');        // Ellipsis

    // Normalize whitespace (but preserve intentional formatting like code blocks)
    // Only collapse multiple spaces outside of code blocks
    const lines = result.split('\n');
    result = lines
      .map(line => {
        // Don't touch lines that look like code (indented or in code blocks)
        if (line.startsWith('    ') || line.startsWith('\t') || line.startsWith('```')) {
          return line;
        }
        // Collapse multiple spaces to single space
        return line.replace(/  +/g, ' ');
      })
      .join('\n');

    return result;
  } catch (error) {
    // If anything goes wrong, return original text
    return text;
  }
}

/**
 * Legacy pipeline interface for backward compatibility
 */
export const contentSanitizationPipeline = {
  quickSanitize,
  process: (text: string, _options?: any) => ({ text: quickSanitize(text), errors: [], validation: { isValid: true } })
};

export type PipelineOptions = any;
