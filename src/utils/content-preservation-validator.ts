import { Logger } from './logger';

export interface ContentValidationResult {
  isValid: boolean;
  confidence: number;
  checks: ValidationCheck[];
  issues: string[];
  recommendations: string[];
  metrics: ContentMetrics;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details?: string;
  confidence: number;
}

export interface ContentMetrics {
  characterChange: number;
  wordChange: number;
  lineChange: number;
  preservationRate: number;
  urlsPreserved: number;
  mentionsPreserved: number;
  emojiPreserved: number;
  codeBlocksPreserved: number;
}

export class ContentPreservationValidator {
  validate(
    original: string,
    processed: string,
    options: {
      strictness?: 'lenient' | 'normal' | 'strict';
      checkUrls?: boolean;
      checkMentions?: boolean;
      checkEmoji?: boolean;
      checkCodeBlocks?: boolean;
      lengthTolerance?: number;
    } = {}
  ): ContentValidationResult {
    try {
      const opts = {
        strictness: 'normal' as const,
        checkUrls: true,
        checkMentions: true,
        checkEmoji: true,
        checkCodeBlocks: true,
        lengthTolerance: 0.1,
        ...options,
      };

      const checks: ValidationCheck[] = [];
      const issues: string[] = [];
      const recommendations: string[] = [];

      const metrics = this.calculateMetrics(original, processed);

      checks.push(this.checkBasicIntegrity(original, processed, opts.lengthTolerance));
      checks.push(this.checkAlphanumericPreservation(original, processed));
      checks.push(this.checkStructuralElements(original, processed));

      if (opts.checkUrls) {
        checks.push(this.checkUrlPreservation(original, processed));
      }

      if (opts.checkMentions) {
        checks.push(this.checkMentionPreservation(original, processed));
      }

      if (opts.checkEmoji) {
        checks.push(this.checkEmojiPreservation(original, processed));
      }

      if (opts.checkCodeBlocks) {
        checks.push(this.checkCodeBlockPreservation(original, processed));
      }

      checks.push(this.checkSentenceStructure(original, processed));
      checks.push(this.checkKeywordPreservation(original, processed));

      const failedChecks = checks.filter(check => !check.passed);
      const criticalFailures = failedChecks.filter(check => check.severity === 'critical');
      const highFailures = failedChecks.filter(check => check.severity === 'high');

      const isValid =
        criticalFailures.length === 0 &&
        (opts.strictness === 'lenient' || highFailures.length === 0);

      const avgConfidence =
        checks.reduce((sum, check) => sum + check.confidence, 0) / checks.length;
      const severityPenalty = criticalFailures.length * 0.3 + highFailures.length * 0.1;
      const confidence = Math.max(0, avgConfidence - severityPenalty);

      for (const check of failedChecks) {
        issues.push(`${check.name}: ${check.details || check.description}`);
        if (check.severity === 'critical' || check.severity === 'high') {
          recommendations.push(
            `Address ${check.name.toLowerCase()} to improve content preservation`
          );
        }
      }

      if (metrics.preservationRate < 0.9) {
        recommendations.push('Consider less aggressive text processing to preserve more content');
      }

      if (Math.abs(metrics.characterChange) > original.length * 0.2) {
        recommendations.push('Review character-level changes for potential over-processing');
      }

      return {
        isValid,
        confidence,
        checks,
        issues,
        recommendations,
        metrics,
      };
    } catch (error) {
      Logger.error('ContentPreservationValidator', 'Error during validation', error);
      return this.createErrorResult(original, processed);
    }
  }

  quickValidate(original: string, processed: string): boolean {
    try {
      const originalWords = original.match(/\w+/g)?.length || 0;
      const processedWords = processed.match(/\w+/g)?.length || 0;
      const wordLossRate =
        originalWords === 0 ? 0 : (originalWords - processedWords) / originalWords;
      if (wordLossRate > 0.1) return false;

      if (!original.includes('�') && processed.includes('�')) return false;

      const lengthChangeRate =
        original.length === 0 ? 0 : Math.abs(processed.length - original.length) / original.length;
      if (lengthChangeRate > 0.5) return false;

      return true;
    } catch (error) {
      Logger.warn('ContentPreservationValidator', 'Error in quick validation', error);
      return false;
    }
  }

  private calculateMetrics(original: string, processed: string): ContentMetrics {
    const originalChars = original.length;
    const processedChars = processed.length;
    const originalWords = original.match(/\w+/g)?.length || 0;
    const processedWords = processed.match(/\w+/g)?.length || 0;
    const originalLines = original.split('\n').length;
    const processedLines = processed.split('\n').length;

    const preservationRate = this.calculatePreservationRate(original, processed);

    return {
      characterChange: processedChars - originalChars,
      wordChange: processedWords - originalWords,
      lineChange: processedLines - originalLines,
      preservationRate,
      urlsPreserved: this.countPreservedUrls(original, processed),
      mentionsPreserved: this.countPreservedMentions(original, processed),
      emojiPreserved: this.countPreservedEmoji(original, processed),
      codeBlocksPreserved: this.countPreservedCodeBlocks(original, processed),
    };
  }

  private calculatePreservationRate(original: string, processed: string): number {
    const originalWords = new Set(original.toLowerCase().match(/\w+/g) || []);
    const processedWords = new Set(processed.toLowerCase().match(/\w+/g) || []);

    if (originalWords.size === 0) return 1;

    const intersection = new Set([...originalWords].filter(word => processedWords.has(word)));
    return intersection.size / originalWords.size;
  }

  private checkBasicIntegrity(
    original: string,
    processed: string,
    tolerance: number
  ): ValidationCheck {
    const lengthChange =
      original.length === 0 ? 0 : Math.abs(processed.length - original.length) / original.length;
    const passed = lengthChange <= tolerance;

    return {
      name: 'Basic Integrity',
      passed,
      severity: lengthChange > 0.5 ? 'critical' : lengthChange > 0.2 ? 'high' : 'medium',
      description: 'Checks for reasonable length changes',
      details: passed
        ? 'Length change within tolerance'
        : `Length changed by ${(lengthChange * 100).toFixed(1)}%`,
      confidence: 0.9,
    };
  }

  private checkAlphanumericPreservation(original: string, processed: string): ValidationCheck {
    const originalAlpha = original.match(/[a-zA-Z0-9]/g)?.length || 0;
    const processedAlpha = processed.match(/[a-zA-Z0-9]/g)?.length || 0;
    const lossRate = originalAlpha > 0 ? (originalAlpha - processedAlpha) / originalAlpha : 0;
    const passed = lossRate <= 0.05;

    return {
      name: 'Alphanumeric Content',
      passed,
      severity: lossRate > 0.2 ? 'critical' : lossRate > 0.1 ? 'high' : 'medium',
      description: 'Checks preservation of letters and numbers',
      details: passed
        ? 'Alphanumeric content preserved'
        : `Lost ${(lossRate * 100).toFixed(1)}% of alphanumeric characters`,
      confidence: 0.95,
    };
  }

  private checkStructuralElements(original: string, processed: string): ValidationCheck {
    const originalSentences = original.split(/[.!?]+/).filter(s => s.trim()).length;
    const processedSentences = processed.split(/[.!?]+/).filter(s => s.trim()).length;
    const structuralLoss =
      originalSentences > 0
        ? Math.abs(originalSentences - processedSentences) / originalSentences
        : 0;
    const passed = structuralLoss <= 0.1;

    return {
      name: 'Structural Elements',
      passed,
      severity: structuralLoss > 0.3 ? 'high' : 'medium',
      description: 'Checks preservation of sentence structure',
      details: passed
        ? 'Sentence structure preserved'
        : `Sentence count changed by ${(structuralLoss * 100).toFixed(1)}%`,
      confidence: 0.8,
    };
  }

  private checkUrlPreservation(original: string, processed: string): ValidationCheck {
    const originalUrls = original.match(/https?:\/\/[^\s<>]+/g) || [];
    const processedUrls = processed.match(/https?:\/\/[^\s<>]+/g) || [];
    const preservationRate =
      originalUrls.length > 0 ? processedUrls.length / originalUrls.length : 1;
    const passed = preservationRate >= 0.9;

    return {
      name: 'URL Preservation',
      passed,
      severity: preservationRate < 0.7 ? 'high' : 'medium',
      description: 'Checks preservation of URLs',
      details: `${processedUrls.length}/${originalUrls.length} URLs preserved`,
      confidence: 0.9,
    };
  }

  private checkMentionPreservation(original: string, processed: string): ValidationCheck {
    const originalMentions = original.match(/@\w+|<@[A-Z0-9]+>/g) || [];
    const processedMentions = processed.match(/@\w+|<@[A-Z0-9]+>|\[\[[^\]]+\]\]/g) || [];
    const preservationRate =
      originalMentions.length > 0
        ? Math.min(processedMentions.length / originalMentions.length, 1)
        : 1;
    const passed = preservationRate >= 0.8;

    return {
      name: 'Mention Preservation',
      passed,
      severity: preservationRate < 0.5 ? 'high' : 'medium',
      description: 'Checks preservation of user mentions',
      details: `${Math.min(processedMentions.length, originalMentions.length)}/${originalMentions.length} mentions preserved`,
      confidence: 0.85,
    };
  }

  private checkEmojiPreservation(original: string, processed: string): ValidationCheck {
    const originalEmoji = original.match(/:[a-zA-Z0-9_+-]+:|[\u{1F300}-\u{1F9FF}]/gu) || [];
    const processedEmoji = processed.match(/:[a-zA-Z0-9_+-]+:|[\u{1F300}-\u{1F9FF}]/gu) || [];
    const preservationRate =
      originalEmoji.length > 0 ? processedEmoji.length / originalEmoji.length : 1;
    const passed = preservationRate >= 0.7;

    return {
      name: 'Emoji Preservation',
      passed,
      severity: 'low',
      description: 'Checks preservation of emoji',
      details: `${processedEmoji.length}/${originalEmoji.length} emoji preserved`,
      confidence: 0.7,
    };
  }

  private checkCodeBlockPreservation(original: string, processed: string): ValidationCheck {
    const originalCodeBlocks = original.match(/```[\s\S]*?```|`[^`\n]+`/g) || [];
    const processedCodeBlocks = processed.match(/```[\s\S]*?```|`[^`\n]+`/g) || [];
    const preservationRate =
      originalCodeBlocks.length > 0 ? processedCodeBlocks.length / originalCodeBlocks.length : 1;
    const passed = preservationRate >= 0.9;

    return {
      name: 'Code Block Preservation',
      passed,
      severity: preservationRate < 0.8 ? 'high' : 'medium',
      description: 'Checks preservation of code blocks',
      details: `${processedCodeBlocks.length}/${originalCodeBlocks.length} code blocks preserved`,
      confidence: 0.9,
    };
  }

  private checkSentenceStructure(original: string, processed: string): ValidationCheck {
    const originalSentenceEnds = original.match(/[.!?]/g)?.length || 0;
    const processedSentenceEnds = processed.match(/[.!?]/g)?.length || 0;
    const preservationRate =
      originalSentenceEnds > 0 ? processedSentenceEnds / originalSentenceEnds : 1;
    const passed = preservationRate >= 0.8;

    return {
      name: 'Sentence Structure',
      passed,
      severity: preservationRate < 0.6 ? 'medium' : 'low',
      description: 'Checks preservation of sentence endings',
      details: `${processedSentenceEnds}/${originalSentenceEnds} sentence endings preserved`,
      confidence: 0.7,
    };
  }

  private checkKeywordPreservation(original: string, processed: string): ValidationCheck {
    const originalKeywords = new Set(original.match(/\b[A-Z]\w+\b|\b\w*[A-Z]\w*\b/g) || []);
    const processedKeywords = new Set(processed.match(/\b[A-Z]\w+\b|\b\w*[A-Z]\w*\b/g) || []);

    if (originalKeywords.size === 0) {
      return {
        name: 'Keyword Preservation',
        passed: true,
        severity: 'low',
        description: 'Checks preservation of capitalized keywords',
        details: 'No keywords detected',
        confidence: 0.6,
      };
    }

    const intersection = new Set([...originalKeywords].filter(word => processedKeywords.has(word)));
    const preservationRate = intersection.size / originalKeywords.size;
    const passed = preservationRate >= 0.8;

    return {
      name: 'Keyword Preservation',
      passed,
      severity: preservationRate < 0.6 ? 'medium' : 'low',
      description: 'Checks preservation of capitalized keywords',
      details: `${intersection.size}/${originalKeywords.size} keywords preserved`,
      confidence: 0.75,
    };
  }

  private countPreservedUrls(original: string, processed: string): number {
    const originalUrls = original.match(/https?:\/\/[^\s<>]+/g) || [];
    const processedUrls = processed.match(/https?:\/\/[^\s<>]+/g) || [];
    return Math.min(originalUrls.length, processedUrls.length);
  }

  private countPreservedMentions(original: string, processed: string): number {
    const originalMentions = original.match(/@\w+|<@[A-Z0-9]+>/g) || [];
    const processedMentions = processed.match(/@\w+|<@[A-Z0-9]+>|\[\[[^\]]+\]\]/g) || [];
    return Math.min(originalMentions.length, processedMentions.length);
  }

  private countPreservedEmoji(original: string, processed: string): number {
    const originalEmoji = original.match(/:[a-zA-Z0-9_+-]+:|[\u{1F300}-\u{1F9FF}]/gu) || [];
    const processedEmoji = processed.match(/:[a-zA-Z0-9_+-]+:|[\u{1F300}-\u{1F9FF}]/gu) || [];
    return Math.min(originalEmoji.length, processedEmoji.length);
  }

  private countPreservedCodeBlocks(original: string, processed: string): number {
    const originalCodeBlocks = original.match(/```[\s\S]*?```|`[^`\n]+`/g) || [];
    const processedCodeBlocks = processed.match(/```[\s\S]*?```|`[^`\n]+`/g) || [];
    return Math.min(originalCodeBlocks.length, processedCodeBlocks.length);
  }

  private createErrorResult(original: string, processed: string): ContentValidationResult {
    return {
      isValid: false,
      confidence: 0,
      checks: [
        {
          name: 'Validation Error',
          passed: false,
          severity: 'critical',
          description: 'Error occurred during validation',
          confidence: 0,
        },
      ],
      issues: ['Validation process failed'],
      recommendations: ['Review validation process and input data'],
      metrics: {
        characterChange: processed.length - original.length,
        wordChange: 0,
        lineChange: 0,
        preservationRate: 0,
        urlsPreserved: 0,
        mentionsPreserved: 0,
        emojiPreserved: 0,
        codeBlocksPreserved: 0,
      },
    };
  }
}

export const contentPreservationValidator = new ContentPreservationValidator();
