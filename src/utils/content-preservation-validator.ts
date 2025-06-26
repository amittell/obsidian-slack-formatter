/**
 * Content preservation validator to ensure text processing doesn't lose semantic content.
 * Provides comprehensive validation of text transformations.
 * @module content-preservation-validator
 */

import { Logger } from './logger';

/**
 * Content validation result
 */
export interface ContentValidationResult {
    /** Overall validation status */
    isValid: boolean;
    /** Confidence score (0-1) that content is preserved */
    confidence: number;
    /** Specific validation checks and their results */
    checks: ValidationCheck[];
    /** Summary of issues found */
    issues: string[];
    /** Recommendations for improvement */
    recommendations: string[];
    /** Metrics about the content changes */
    metrics: ContentMetrics;
}

/**
 * Individual validation check result
 */
export interface ValidationCheck {
    /** Name of the validation check */
    name: string;
    /** Whether this check passed */
    passed: boolean;
    /** Severity of failure (if any) */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** Description of what was checked */
    description: string;
    /** Details about the result */
    details?: string;
    /** Confidence in this check's result */
    confidence: number;
}

/**
 * Content metrics comparing original and processed text
 */
export interface ContentMetrics {
    /** Character count change */
    characterChange: number;
    /** Word count change */
    wordChange: number;
    /** Line count change */
    lineChange: number;
    /** Percentage of content preserved */
    preservationRate: number;
    /** Number of URLs preserved */
    urlsPreserved: number;
    /** Number of mentions preserved */
    mentionsPreserved: number;
    /** Number of emoji preserved */
    emojiPreserved: number;
    /** Code blocks preserved */
    codeBlocksPreserved: number;
}

/**
 * Content preservation validator
 */
export class ContentPreservationValidator {
    
    /**
     * Validate that processed text preserves the semantic content of the original.
     * @param original - Original text before processing
     * @param processed - Text after processing
     * @param options - Validation options
     * @returns Comprehensive validation result
     */
    validate(
        original: string, 
        processed: string,
        options: {
            /** Strictness level for validation */
            strictness?: 'lenient' | 'normal' | 'strict';
            /** Whether to check URL preservation */
            checkUrls?: boolean;
            /** Whether to check mention preservation */
            checkMentions?: boolean;
            /** Whether to check emoji preservation */
            checkEmoji?: boolean;
            /** Whether to check code block preservation */
            checkCodeBlocks?: boolean;
            /** Custom tolerance for length changes (0-1) */
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
                ...options
            };

            const checks: ValidationCheck[] = [];
            const issues: string[] = [];
            const recommendations: string[] = [];

            // Calculate metrics
            const metrics = this.calculateMetrics(original, processed);

            // Run validation checks
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

            // Determine overall validity and confidence
            const failedChecks = checks.filter(check => !check.passed);
            const criticalFailures = failedChecks.filter(check => check.severity === 'critical');
            const highFailures = failedChecks.filter(check => check.severity === 'high');

            const isValid = criticalFailures.length === 0 && 
                           (opts.strictness === 'lenient' || highFailures.length === 0);

            // Calculate confidence based on check results
            const avgConfidence = checks.reduce((sum, check) => sum + check.confidence, 0) / checks.length;
            const severityPenalty = (criticalFailures.length * 0.3) + (highFailures.length * 0.1);
            const confidence = Math.max(0, avgConfidence - severityPenalty);

            // Collect issues and recommendations
            for (const check of failedChecks) {
                issues.push(`${check.name}: ${check.details || check.description}`);
                
                if (check.severity === 'critical' || check.severity === 'high') {
                    recommendations.push(`Address ${check.name.toLowerCase()} to improve content preservation`);
                }
            }

            // Add metric-based recommendations
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
                metrics
            };
        } catch (error) {
            Logger.error('ContentPreservationValidator', 'Error during validation:', error);
            return this.createErrorResult(original, processed);
        }
    }

    /**
     * Quick validation with minimal overhead.
     * @param original - Original text
     * @param processed - Processed text
     * @returns Simple boolean result
     */
    quickValidate(original: string, processed: string): boolean {
        try {
            // Quick checks for major content loss
            const originalWords = original.match(/\w+/g)?.length || 0;
            const processedWords = processed.match(/\w+/g)?.length || 0;
            
            // Allow for reasonable word count changes
            const wordLossRate = (originalWords - processedWords) / originalWords;
            if (wordLossRate > 0.1) return false; // More than 10% word loss
            
            // Check for introduction of corruption indicators
            if (!original.includes('�') && processed.includes('�')) return false;
            
            // Check for severe length changes
            const lengthChangeRate = Math.abs(processed.length - original.length) / original.length;
            if (lengthChangeRate > 0.5) return false; // More than 50% length change
            
            return true;
        } catch (error) {
            Logger.warn('ContentPreservationValidator', 'Error in quick validation:', error);
            return false;
        }
    }

    /**
     * Calculate content metrics.
     * @private
     */
    private calculateMetrics(original: string, processed: string): ContentMetrics {
        const originalChars = original.length;
        const processedChars = processed.length;
        const originalWords = original.match(/\w+/g)?.length || 0;
        const processedWords = processed.match(/\w+/g)?.length || 0;
        const originalLines = original.split('\n').length;
        const processedLines = processed.split('\n').length;

        // Calculate preservation rate based on common n-grams
        const preservationRate = this.calculatePreservationRate(original, processed);

        return {
            characterChange: processedChars - originalChars,
            wordChange: processedWords - originalWords,
            lineChange: processedLines - originalLines,
            preservationRate,
            urlsPreserved: this.countPreservedUrls(original, processed),
            mentionsPreserved: this.countPreservedMentions(original, processed),
            emojiPreserved: this.countPreservedEmoji(original, processed),
            codeBlocksPreserved: this.countPreservedCodeBlocks(original, processed)
        };
    }

    /**
     * Calculate content preservation rate using word overlap.
     * @private
     */
    private calculatePreservationRate(original: string, processed: string): number {
        const originalWords = new Set(original.toLowerCase().match(/\w+/g) || []);
        const processedWords = new Set(processed.toLowerCase().match(/\w+/g) || []);
        
        if (originalWords.size === 0) return 1.0;
        
        const intersection = new Set([...originalWords].filter(word => processedWords.has(word)));
        return intersection.size / originalWords.size;
    }

    /**
     * Check basic text integrity.
     * @private
     */
    private checkBasicIntegrity(original: string, processed: string, tolerance: number): ValidationCheck {
        const lengthChange = Math.abs(processed.length - original.length) / original.length;
        const passed = lengthChange <= tolerance;
        
        return {
            name: 'Basic Integrity',
            passed,
            severity: lengthChange > 0.5 ? 'critical' : lengthChange > 0.2 ? 'high' : 'medium',
            description: 'Checks for reasonable length changes',
            details: passed ? 'Length change within tolerance' : `Length changed by ${(lengthChange * 100).toFixed(1)}%`,
            confidence: 0.9
        };
    }

    /**
     * Check preservation of alphanumeric content.
     * @private
     */
    private checkAlphanumericPreservation(original: string, processed: string): ValidationCheck {
        const originalAlpha = original.match(/[a-zA-Z0-9]/g)?.length || 0;
        const processedAlpha = processed.match(/[a-zA-Z0-9]/g)?.length || 0;
        const lossRate = originalAlpha > 0 ? (originalAlpha - processedAlpha) / originalAlpha : 0;
        
        const passed = lossRate <= 0.05; // Allow 5% loss
        
        return {
            name: 'Alphanumeric Content',
            passed,
            severity: lossRate > 0.2 ? 'critical' : lossRate > 0.1 ? 'high' : 'medium',
            description: 'Checks preservation of letters and numbers',
            details: passed ? 'Alphanumeric content preserved' : `Lost ${(lossRate * 100).toFixed(1)}% of alphanumeric characters`,
            confidence: 0.95
        };
    }

    /**
     * Check preservation of structural elements.
     * @private
     */
    private checkStructuralElements(original: string, processed: string): ValidationCheck {
        const originalSentences = original.split(/[.!?]+/).filter(s => s.trim()).length;
        const processedSentences = processed.split(/[.!?]+/).filter(s => s.trim()).length;
        const structuralLoss = originalSentences > 0 ? Math.abs(originalSentences - processedSentences) / originalSentences : 0;
        
        const passed = structuralLoss <= 0.1;
        
        return {
            name: 'Structural Elements',
            passed,
            severity: structuralLoss > 0.3 ? 'high' : 'medium',
            description: 'Checks preservation of sentence structure',
            details: passed ? 'Sentence structure preserved' : `Sentence count changed by ${(structuralLoss * 100).toFixed(1)}%`,
            confidence: 0.8
        };
    }

    /**
     * Check URL preservation.
     * @private
     */
    private checkUrlPreservation(original: string, processed: string): ValidationCheck {
        const originalUrls = original.match(/https?:\/\/[^\s<>]+/g) || [];
        const processedUrls = processed.match(/https?:\/\/[^\s<>]+/g) || [];
        
        const preservationRate = originalUrls.length > 0 ? processedUrls.length / originalUrls.length : 1;
        const passed = preservationRate >= 0.9;
        
        return {
            name: 'URL Preservation',
            passed,
            severity: preservationRate < 0.7 ? 'high' : 'medium',
            description: 'Checks preservation of URLs',
            details: `${processedUrls.length}/${originalUrls.length} URLs preserved`,
            confidence: 0.9
        };
    }

    /**
     * Check mention preservation.
     * @private
     */
    private checkMentionPreservation(original: string, processed: string): ValidationCheck {
        const originalMentions = original.match(/@\w+|<@[A-Z0-9]+>/g) || [];
        const processedMentions = processed.match(/@\w+|<@[A-Z0-9]+>|\[\[\w+\]\]/g) || [];
        
        const preservationRate = originalMentions.length > 0 ? 
            Math.min(processedMentions.length / originalMentions.length, 1) : 1;
        const passed = preservationRate >= 0.8;
        
        return {
            name: 'Mention Preservation',
            passed,
            severity: preservationRate < 0.5 ? 'high' : 'medium',
            description: 'Checks preservation of user mentions',
            details: `${Math.min(processedMentions.length, originalMentions.length)}/${originalMentions.length} mentions preserved`,
            confidence: 0.85
        };
    }

    /**
     * Check emoji preservation.
     * @private
     */
    private checkEmojiPreservation(original: string, processed: string): ValidationCheck {
        const originalEmoji = original.match(/:[a-zA-Z0-9_+-]+:|[\u{1F300}-\u{1F9FF}]/gu) || [];
        const processedEmoji = processed.match(/:[a-zA-Z0-9_+-]+:|[\u{1F300}-\u{1F9FF}]/gu) || [];
        
        const preservationRate = originalEmoji.length > 0 ? processedEmoji.length / originalEmoji.length : 1;
        const passed = preservationRate >= 0.7; // More lenient for emoji conversion
        
        return {
            name: 'Emoji Preservation',
            passed,
            severity: 'low', // Emoji changes are usually acceptable
            description: 'Checks preservation of emoji',
            details: `${processedEmoji.length}/${originalEmoji.length} emoji preserved`,
            confidence: 0.7
        };
    }

    /**
     * Check code block preservation.
     * @private
     */
    private checkCodeBlockPreservation(original: string, processed: string): ValidationCheck {
        const originalCodeBlocks = original.match(/```[\s\S]*?```|`[^`\n]+`/g) || [];
        const processedCodeBlocks = processed.match(/```[\s\S]*?```|`[^`\n]+`/g) || [];
        
        const preservationRate = originalCodeBlocks.length > 0 ? processedCodeBlocks.length / originalCodeBlocks.length : 1;
        const passed = preservationRate >= 0.9;
        
        return {
            name: 'Code Block Preservation',
            passed,
            severity: preservationRate < 0.8 ? 'high' : 'medium',
            description: 'Checks preservation of code blocks',
            details: `${processedCodeBlocks.length}/${originalCodeBlocks.length} code blocks preserved`,
            confidence: 0.9
        };
    }

    /**
     * Check sentence structure preservation.
     * @private
     */
    private checkSentenceStructure(original: string, processed: string): ValidationCheck {
        // Simple heuristic based on sentence-ending punctuation
        const originalSentenceEnds = original.match(/[.!?]/g)?.length || 0;
        const processedSentenceEnds = processed.match(/[.!?]/g)?.length || 0;
        
        const preservationRate = originalSentenceEnds > 0 ? processedSentenceEnds / originalSentenceEnds : 1;
        const passed = preservationRate >= 0.8;
        
        return {
            name: 'Sentence Structure',
            passed,
            severity: preservationRate < 0.6 ? 'medium' : 'low',
            description: 'Checks preservation of sentence endings',
            details: `${processedSentenceEnds}/${originalSentenceEnds} sentence endings preserved`,
            confidence: 0.7
        };
    }

    /**
     * Check preservation of important keywords.
     * @private
     */
    private checkKeywordPreservation(original: string, processed: string): ValidationCheck {
        // Extract potential keywords (capitalized words, technical terms)
        const originalKeywords = new Set(original.match(/\b[A-Z]\w+\b|\b\w*[A-Z]\w*\b/g) || []);
        const processedKeywords = new Set(processed.match(/\b[A-Z]\w+\b|\b\w*[A-Z]\w*\b/g) || []);
        
        if (originalKeywords.size === 0) {
            return {
                name: 'Keyword Preservation',
                passed: true,
                severity: 'low',
                description: 'Checks preservation of capitalized keywords',
                details: 'No keywords detected',
                confidence: 0.6
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
            confidence: 0.75
        };
    }

    /**
     * Helper methods for counting preserved elements.
     * @private
     */
    private countPreservedUrls(original: string, processed: string): number {
        const originalUrls = original.match(/https?:\/\/[^\s<>]+/g) || [];
        const processedUrls = processed.match(/https?:\/\/[^\s<>]+/g) || [];
        return Math.min(originalUrls.length, processedUrls.length);
    }

    private countPreservedMentions(original: string, processed: string): number {
        const originalMentions = original.match(/@\w+|<@[A-Z0-9]+>/g) || [];
        const processedMentions = processed.match(/@\w+|<@[A-Z0-9]+>|\[\[\w+\]\]/g) || [];
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

    /**
     * Create error result when validation fails.
     * @private
     */
    private createErrorResult(original: string, processed: string): ContentValidationResult {
        return {
            isValid: false,
            confidence: 0,
            checks: [{
                name: 'Validation Error',
                passed: false,
                severity: 'critical',
                description: 'Error occurred during validation',
                confidence: 0
            }],
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
                codeBlocksPreserved: 0
            }
        };
    }
}

/**
 * Default content preservation validator instance
 */
export const contentPreservationValidator = new ContentPreservationValidator();