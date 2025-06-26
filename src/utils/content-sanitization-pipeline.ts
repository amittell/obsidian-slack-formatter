/**
 * Configurable content sanitization pipeline with pluggable text processors.
 * Provides a flexible architecture for chaining text processing operations.
 * @module content-sanitization-pipeline
 */

import { Logger } from './logger';
import { textNormalizationEngine, type TextNormalizationOptions, type TextNormalizationResult } from './text-normalization-engine';
import { contentPreservationValidator, type ContentValidationResult } from './content-preservation-validator';

/**
 * Base interface for pipeline processors
 */
export interface PipelineProcessor {
    /** Unique identifier for this processor */
    id: string;
    /** Human-readable name */
    name: string;
    /** Description of what this processor does */
    description: string;
    /** Whether this processor is enabled */
    enabled: boolean;
    /** Priority order (lower numbers run first) */
    priority: number;
    /** Process text and return result */
    process(text: string, context: ProcessingContext): ProcessorResult;
}

/**
 * Processing context passed between processors
 */
export interface ProcessingContext {
    /** Original input text (never modified) */
    originalText: string;
    /** Current stage in pipeline */
    stage: string;
    /** Accumulated metadata from previous processors */
    metadata: Record<string, any>;
    /** Processing options */
    options: PipelineOptions;
    /** Debug mode flag */
    debug: boolean;
}

/**
 * Result from a single processor
 */
export interface ProcessorResult {
    /** Processed text */
    text: string;
    /** Whether any changes were made */
    modified: boolean;
    /** Success status */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Metadata to pass to next processor */
    metadata?: Record<string, any>;
    /** Processing time in milliseconds */
    processingTime?: number;
}

/**
 * Pipeline configuration options
 */
export interface PipelineOptions {
    /** Whether to validate content preservation */
    validatePreservation?: boolean;
    /** Validation strictness */
    validationStrictness?: 'lenient' | 'normal' | 'strict';
    /** Whether to stop on first error */
    stopOnError?: boolean;
    /** Whether to collect detailed timing information */
    collectTiming?: boolean;
    /** Maximum processing time per processor (ms) */
    timeoutMs?: number;
    /** Custom processor configurations */
    processorConfigs?: Record<string, any>;
}

/**
 * Complete pipeline result
 */
export interface PipelineResult {
    /** Final processed text */
    text: string;
    /** Whether any changes were made */
    modified: boolean;
    /** Overall success status */
    success: boolean;
    /** Results from each processor */
    processorResults: Array<{ processor: string; result: ProcessorResult }>;
    /** Content validation result (if enabled) */
    validation?: ContentValidationResult;
    /** Total processing time */
    totalTime: number;
    /** Any errors encountered */
    errors: string[];
    /** Summary of all changes made */
    changeSummary: string[];
}

/**
 * Built-in text encoding processor
 */
export class EncodingCorrectionProcessor implements PipelineProcessor {
    id = 'encoding-correction';
    name = 'Encoding Correction';
    description = 'Corrects character encoding issues and smart quotes';
    enabled = true;
    priority = 10;

    constructor(private options: TextNormalizationOptions = {}) {}

    process(text: string, context: ProcessingContext): ProcessorResult {
        const startTime = Date.now();
        try {
            const result = textNormalizationEngine.normalize(text, {
                correctEncoding: true,
                convertSmartQuotes: true,
                normalizeUnicode: false,
                normalizeWhitespace: false,
                aggressive: false,
                ...this.options
            });

            return {
                text: result.normalizedText,
                modified: result.wasChanged,
                success: true,
                metadata: {
                    encodingIssues: result.encodingDetection.issues,
                    corrections: result.encodingCorrections.corrections,
                    steps: result.steps
                },
                processingTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                text,
                modified: false,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime: Date.now() - startTime
            };
        }
    }
}

/**
 * Built-in whitespace normalization processor
 */
export class WhitespaceNormalizationProcessor implements PipelineProcessor {
    id = 'whitespace-normalization';
    name = 'Whitespace Normalization';
    description = 'Normalizes whitespace while preserving code formatting';
    enabled = true;
    priority = 20;

    constructor(private preserveCodeFormatting = true) {}

    process(text: string, context: ProcessingContext): ProcessorResult {
        const startTime = Date.now();
        try {
            const result = textNormalizationEngine.normalize(text, {
                correctEncoding: false,
                normalizeWhitespace: true,
                preserveCodeFormatting: this.preserveCodeFormatting,
                normalizeLineEndings: true,
                removeZeroWidth: true,
                aggressive: false
            });

            return {
                text: result.normalizedText,
                modified: result.wasChanged,
                success: true,
                metadata: {
                    steps: result.steps
                },
                processingTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                text,
                modified: false,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime: Date.now() - startTime
            };
        }
    }
}

/**
 * Built-in Unicode normalization processor
 */
export class UnicodeNormalizationProcessor implements PipelineProcessor {
    id = 'unicode-normalization';
    name = 'Unicode Normalization';
    description = 'Normalizes Unicode characters to canonical forms';
    enabled = true;
    priority = 15;

    constructor(private form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' = 'NFC') {}

    process(text: string, context: ProcessingContext): ProcessorResult {
        const startTime = Date.now();
        try {
            const result = textNormalizationEngine.normalize(text, {
                correctEncoding: false,
                normalizeUnicode: true,
                unicodeForm: this.form,
                aggressive: false
            });

            return {
                text: result.normalizedText,
                modified: result.wasChanged,
                success: true,
                metadata: {
                    unicodeForm: this.form,
                    steps: result.steps
                },
                processingTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                text,
                modified: false,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime: Date.now() - startTime
            };
        }
    }
}

/**
 * Content sanitization pipeline
 */
export class ContentSanitizationPipeline {
    private processors: PipelineProcessor[] = [];
    private readonly defaultOptions: Required<PipelineOptions> = {
        validatePreservation: true,
        validationStrictness: 'normal',
        stopOnError: false,
        collectTiming: true,
        timeoutMs: 5000,
        processorConfigs: {}
    };

    constructor(options: PipelineOptions = {}) {
        // Register default processors
        this.addProcessor(new EncodingCorrectionProcessor());
        this.addProcessor(new UnicodeNormalizationProcessor());
        this.addProcessor(new WhitespaceNormalizationProcessor());
    }

    /**
     * Add a processor to the pipeline.
     */
    addProcessor(processor: PipelineProcessor): void {
        this.processors.push(processor);
        this.processors.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Remove a processor by ID.
     */
    removeProcessor(id: string): boolean {
        const index = this.processors.findIndex(p => p.id === id);
        if (index !== -1) {
            this.processors.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get processor by ID.
     */
    getProcessor(id: string): PipelineProcessor | undefined {
        return this.processors.find(p => p.id === id);
    }

    /**
     * Enable or disable a processor.
     */
    setProcessorEnabled(id: string, enabled: boolean): boolean {
        const processor = this.getProcessor(id);
        if (processor) {
            processor.enabled = enabled;
            return true;
        }
        return false;
    }

    /**
     * Process text through the pipeline.
     */
    process(text: string, options: PipelineOptions = {}): PipelineResult {
        const opts = { ...this.defaultOptions, ...options };
        const startTime = Date.now();
        const processorResults: Array<{ processor: string; result: ProcessorResult }> = [];
        const errors: string[] = [];
        const changeSummary: string[] = [];

        let currentText = text;
        let modified = false;

        const context: ProcessingContext = {
            originalText: text,
            stage: 'pipeline',
            metadata: {},
            options: opts,
            debug: false
        };

        // Process through each enabled processor
        for (const processor of this.processors) {
            if (!processor.enabled) {
                continue;
            }

            try {
                const processorStartTime = Date.now();
                let result: ProcessorResult;

                // Apply timeout if specified
                if (opts.timeoutMs && opts.timeoutMs > 0) {
                    result = this.processWithTimeout(processor, currentText, context, opts.timeoutMs);
                } else {
                    result = processor.process(currentText, context);
                }

                // Record timing if requested
                if (opts.collectTiming && !result.processingTime) {
                    result.processingTime = Date.now() - processorStartTime;
                }

                processorResults.push({ processor: processor.id, result });

                if (result.success) {
                    currentText = result.text;
                    modified = modified || result.modified;

                    // Update context metadata
                    if (result.metadata) {
                        context.metadata = { ...context.metadata, ...result.metadata };
                    }

                    // Add to change summary
                    if (result.modified) {
                        changeSummary.push(`${processor.name}: Applied changes`);
                    }
                } else {
                    errors.push(`${processor.name}: ${result.error || 'Unknown error'}`);
                    
                    if (opts.stopOnError) {
                        break;
                    }
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`${processor.name}: ${errorMsg}`);
                
                processorResults.push({
                    processor: processor.id,
                    result: {
                        text: currentText,
                        modified: false,
                        success: false,
                        error: errorMsg
                    }
                });

                if (opts.stopOnError) {
                    break;
                }
            }
        }

        // Validate content preservation if requested
        let validation: ContentValidationResult | undefined;
        if (opts.validatePreservation && modified) {
            try {
                validation = contentPreservationValidator.validate(text, currentText, {
                    strictness: opts.validationStrictness
                });

                if (!validation.isValid) {
                    changeSummary.push(`Content validation: ${validation.issues.length} issues found`);
                }
            } catch (error) {
                errors.push(`Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return {
            text: currentText,
            modified,
            success: errors.length === 0,
            processorResults,
            validation,
            totalTime: Date.now() - startTime,
            errors,
            changeSummary
        };
    }

    /**
     * Quick sanitization with safe defaults.
     */
    quickSanitize(text: string): string {
        try {
            const result = this.process(text, {
                validatePreservation: false,
                stopOnError: false,
                collectTiming: false
            });
            return result.text;
        } catch (error) {
            Logger.warn('ContentSanitizationPipeline', 'Error in quick sanitize:', error);
            return text;
        }
    }

    /**
     * Get pipeline statistics.
     */
    getStats(): {
        totalProcessors: number;
        enabledProcessors: number;
        processorList: Array<{ id: string; name: string; enabled: boolean; priority: number }>;
    } {
        return {
            totalProcessors: this.processors.length,
            enabledProcessors: this.processors.filter(p => p.enabled).length,
            processorList: this.processors.map(p => ({
                id: p.id,
                name: p.name,
                enabled: p.enabled,
                priority: p.priority
            }))
        };
    }

    /**
     * Reset pipeline to default configuration.
     */
    reset(): void {
        this.processors = [];
        this.addProcessor(new EncodingCorrectionProcessor());
        this.addProcessor(new UnicodeNormalizationProcessor());
        this.addProcessor(new WhitespaceNormalizationProcessor());
    }

    /**
     * Process with timeout protection.
     * @private
     */
    private processWithTimeout(
        processor: PipelineProcessor, 
        text: string, 
        context: ProcessingContext, 
        timeoutMs: number
    ): ProcessorResult {
        return new Promise<ProcessorResult>((resolve) => {
            const timer = setTimeout(() => {
                resolve({
                    text,
                    modified: false,
                    success: false,
                    error: `Processor timed out after ${timeoutMs}ms`
                });
            }, timeoutMs);

            try {
                const result = processor.process(text, context);
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                resolve({
                    text,
                    modified: false,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }) as ProcessorResult; // Type assertion for synchronous compatibility
    }
}

/**
 * Default content sanitization pipeline instance
 */
export const contentSanitizationPipeline = new ContentSanitizationPipeline();