import { Logger } from './logger';
import {
  textNormalizationEngine,
  type TextNormalizationOptions,
} from './text-normalization-engine';
import {
  contentPreservationValidator,
  type ContentValidationResult,
} from './content-preservation-validator';

export interface PipelineProcessor {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  process(text: string, context: ProcessingContext): ProcessorResult;
}

export interface ProcessingContext {
  originalText: string;
  stage: string;
  metadata: Record<string, unknown>;
  options: PipelineOptions;
  debug: boolean;
}

export interface ProcessorResult {
  text: string;
  modified: boolean;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  processingTime?: number;
}

export interface PipelineOptions {
  validatePreservation?: boolean;
  validationStrictness?: 'lenient' | 'normal' | 'strict';
  stopOnError?: boolean;
  collectTiming?: boolean;
  timeoutMs?: number;
}

export interface PipelineResult {
  text: string;
  modified: boolean;
  success: boolean;
  processorResults: Array<{ processor: string; result: ProcessorResult }>;
  validation?: ContentValidationResult;
  totalTime: number;
  errors: string[];
  changeSummary: string[];
}

export class EncodingCorrectionProcessor implements PipelineProcessor {
  id = 'encoding-correction';
  name = 'Encoding Correction';
  description = 'Corrects common encoding issues and smart quotes';
  enabled = true;
  priority = 10;

  constructor(private readonly options: TextNormalizationOptions = {}) {}

  process(text: string, _context: ProcessingContext): ProcessorResult {
    const start = Date.now();

    try {
      const result = textNormalizationEngine.normalize(text, {
        correctEncoding: true,
        convertSmartQuotes: true,
        normalizeUnicode: false,
        normalizeWhitespace: false,
        aggressive: false,
        validateIntegrity: false,
        ...this.options,
      });

      return {
        text: result.normalizedText,
        modified: result.wasChanged,
        success: true,
        metadata: {
          encodingIssues: result.encodingDetection.issues,
          corrections: result.encodingCorrections.corrections,
          steps: result.steps,
        },
        processingTime: Date.now() - start,
      };
    } catch (error) {
      return {
        text,
        modified: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - start,
      };
    }
  }
}

export class UnicodeNormalizationProcessor implements PipelineProcessor {
  id = 'unicode-normalization';
  name = 'Unicode Normalization';
  description = 'Normalizes Unicode characters to a consistent form';
  enabled = true;
  priority = 15;

  constructor(private readonly form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' = 'NFC') {}

  process(text: string, _context: ProcessingContext): ProcessorResult {
    const start = Date.now();

    try {
      const result = textNormalizationEngine.normalize(text, {
        correctEncoding: false,
        normalizeUnicode: true,
        unicodeForm: this.form,
        aggressive: false,
        validateIntegrity: false,
      });

      return {
        text: result.normalizedText,
        modified: result.wasChanged,
        success: true,
        metadata: { unicodeForm: this.form, steps: result.steps },
        processingTime: Date.now() - start,
      };
    } catch (error) {
      return {
        text,
        modified: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - start,
      };
    }
  }
}

export class WhitespaceNormalizationProcessor implements PipelineProcessor {
  id = 'whitespace-normalization';
  name = 'Whitespace Normalization';
  description = 'Trims redundant whitespace while preserving code blocks';
  enabled = true;
  priority = 20;

  constructor(private readonly preserveCodeFormatting = true) {}

  process(text: string, _context: ProcessingContext): ProcessorResult {
    const start = Date.now();

    try {
      const result = textNormalizationEngine.normalize(text, {
        correctEncoding: false,
        normalizeWhitespace: true,
        preserveCodeFormatting: this.preserveCodeFormatting,
        normalizeLineEndings: true,
        removeZeroWidth: true,
        aggressive: false,
        validateIntegrity: false,
      });

      return {
        text: result.normalizedText,
        modified: result.wasChanged,
        success: true,
        metadata: { steps: result.steps },
        processingTime: Date.now() - start,
      };
    } catch (error) {
      return {
        text,
        modified: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - start,
      };
    }
  }
}

export class ContentSanitizationPipeline {
  private processors: PipelineProcessor[] = [];

  private readonly defaults: Required<PipelineOptions> = {
    validatePreservation: true,
    validationStrictness: 'normal',
    stopOnError: false,
    collectTiming: false,
    timeoutMs: 0,
  };

  constructor() {
    this.reset();
  }

  addProcessor(processor: PipelineProcessor): void {
    this.processors.push(processor);
    this.processors.sort((a, b) => a.priority - b.priority);
  }

  removeProcessor(id: string): boolean {
    const index = this.processors.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.processors.splice(index, 1);
    return true;
  }

  getProcessor(id: string): PipelineProcessor | undefined {
    return this.processors.find(p => p.id === id);
  }

  setProcessorEnabled(id: string, enabled: boolean): boolean {
    const processor = this.getProcessor(id);
    if (!processor) return false;
    processor.enabled = enabled;
    return true;
  }

  process(text: string, options: PipelineOptions = {}): PipelineResult {
    const opts = { ...this.defaults, ...options };
    const pipelineStart = Date.now();
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
      debug: false,
    };

    for (const processor of this.processors) {
      if (!processor.enabled) continue;

      const processorStart = Date.now();
      let result: ProcessorResult;

      try {
        if (opts.timeoutMs > 0) {
          result = this.processWithTimeout(processor, currentText, context, opts.timeoutMs);
        } else {
          result = processor.process(currentText, context);
        }

        if (opts.collectTiming && !result.processingTime) {
          result.processingTime = Date.now() - processorStart;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result = {
          text: currentText,
          modified: false,
          success: false,
          error: message,
          processingTime: Date.now() - processorStart,
        };
        errors.push(`${processor.name}: ${message}`);
        processorResults.push({ processor: processor.id, result });
        if (opts.stopOnError) break;
        continue;
      }

      processorResults.push({ processor: processor.id, result });

      if (result.success) {
        if (result.modified) {
          modified = true;
          changeSummary.push(`${processor.name}: Applied changes`);
        }

        currentText = result.text;

        if (result.metadata) {
          context.metadata = { ...context.metadata, ...result.metadata };
        }
      } else {
        errors.push(`${processor.name}: ${result.error ?? 'Unknown error'}`);
        if (opts.stopOnError) break;
      }
    }

    let validation: ContentValidationResult | undefined;
    if (opts.validatePreservation && modified) {
      try {
        validation = contentPreservationValidator.validate(text, currentText, {
          strictness: opts.validationStrictness,
        });

        if (!validation.isValid) {
          changeSummary.push(`Content validation: ${validation.issues.length} issues found`);
        }
      } catch (error) {
        errors.push(
          `Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      text: currentText,
      modified,
      success: errors.length === 0,
      processorResults,
      validation,
      totalTime: Date.now() - pipelineStart,
      errors,
      changeSummary,
    };
  }

  quickSanitize(text: string): string {
    try {
      const result = this.process(text, {
        validatePreservation: false,
        stopOnError: false,
        collectTiming: false,
        timeoutMs: 0,
      });

      return result.text;
    } catch (error) {
      Logger.warn('ContentSanitizationPipeline', 'Error in quickSanitize', error);
      return text;
    }
  }

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
        priority: p.priority,
      })),
    };
  }

  reset(): void {
    this.processors = [];
    this.addProcessor(new EncodingCorrectionProcessor());
    this.addProcessor(new UnicodeNormalizationProcessor());
    this.addProcessor(new WhitespaceNormalizationProcessor());
  }

  private processWithTimeout(
    processor: PipelineProcessor,
    text: string,
    context: ProcessingContext,
    timeoutMs: number
  ): ProcessorResult {
    const start = Date.now();

    try {
      const result = processor.process(text, context);
      const duration = Date.now() - start;

      if (duration > timeoutMs) {
        Logger.warn(
          'ContentSanitizationPipeline',
          `Processor exceeded timeout (${duration}ms > ${timeoutMs}ms)`
        );

        return {
          text,
          modified: false,
          success: false,
          error: `Processor completed but exceeded timeout (${duration}ms > ${timeoutMs}ms)`,
          processingTime: duration,
        };
      }

      if (!result.processingTime) {
        result.processingTime = duration;
      }

      return result;
    } catch (error) {
      return {
        text,
        modified: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - start,
      };
    }
  }
}

export const contentSanitizationPipeline = new ContentSanitizationPipeline();
