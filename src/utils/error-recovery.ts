import { Logger } from './logger.js';

/**
 * Error recovery strategy configuration
 */
interface RecoveryStrategy {
    name: string;
    description: string;
    errorTypes: string[];
    priority: number;
    maxRetries: number;
    backoffMs: number;
    fallbackAction: 'skip' | 'default' | 'partial' | 'retry';
    recoveryFunction?: (error: Error, context: any) => any;
}

/**
 * Error recovery context
 */
interface RecoveryContext {
    operation: string;
    input: any;
    attempt: number;
    maxAttempts: number;
    previousErrors: Error[];
    metadata: Record<string, any>;
}

/**
 * Recovery result
 */
interface RecoveryResult {
    success: boolean;
    result?: any;
    strategy: string;
    attemptsUsed: number;
    errors: Error[];
    fallbackUsed: boolean;
    recovery: 'full' | 'partial' | 'failed';
}

/**
 * Error boundary configuration
 */
interface ErrorBoundaryConfig {
    enableRecovery: boolean;
    enableLogging: boolean;
    enableMetrics: boolean;
    maxConcurrentRecoveries: number;
    globalTimeout: number;
    strategies: RecoveryStrategy[];
}

/**
 * Comprehensive error recovery and graceful degradation system
 */
export class ErrorRecoverySystem {
    private config: ErrorBoundaryConfig;
    private activeRecoveries: Map<string, RecoveryContext> = new Map();
    private recoveryStats: Map<string, {
        attempts: number;
        successes: number;
        failures: number;
        averageTime: number;
    }> = new Map();

    constructor(config?: Partial<ErrorBoundaryConfig>) {
        this.config = {
            enableRecovery: true,
            enableLogging: true,
            enableMetrics: true,
            maxConcurrentRecoveries: 10,
            globalTimeout: 30000, // 30 seconds
            strategies: this.getDefaultStrategies(),
            ...config
        };

        Logger.info('ErrorRecoverySystem', 'Error recovery system initialized', {
            strategiesCount: this.config.strategies.length,
            enableRecovery: this.config.enableRecovery
        });
    }

    /**
     * Execute operation with error recovery
     */
    public async executeWithRecovery<T>(
        operation: string,
        fn: () => Promise<T> | T,
        context?: any
    ): Promise<RecoveryResult> {
        const recoveryId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const startTime = Date.now();

        if (!this.config.enableRecovery) {
            // Direct execution without recovery
            try {
                const result = await this.ensurePromise(fn());
                return {
                    success: true,
                    result,
                    strategy: 'direct',
                    attemptsUsed: 1,
                    errors: [],
                    fallbackUsed: false,
                    recovery: 'full'
                };
            } catch (error) {
                return {
                    success: false,
                    strategy: 'direct',
                    attemptsUsed: 1,
                    errors: [error as Error],
                    fallbackUsed: false,
                    recovery: 'failed'
                };
            }
        }

        // Check concurrent recovery limit
        if (this.activeRecoveries.size >= this.config.maxConcurrentRecoveries) {
            Logger.warn('ErrorRecoverySystem', 'Max concurrent recoveries reached', {
                active: this.activeRecoveries.size,
                limit: this.config.maxConcurrentRecoveries
            });
            
            return this.createFailureResult('concurrent-limit-exceeded', [], 0);
        }

        const recoveryContext: RecoveryContext = {
            operation,
            input: context,
            attempt: 0,
            maxAttempts: 3,
            previousErrors: [],
            metadata: { startTime, recoveryId }
        };

        this.activeRecoveries.set(recoveryId, recoveryContext);

        try {
            const result = await this.attemptWithRecovery(fn, recoveryContext);
            this.updateStats(operation, true, Date.now() - startTime);
            return result;
        } catch (error) {
            this.updateStats(operation, false, Date.now() - startTime);
            return this.createFailureResult('all-strategies-failed', recoveryContext.previousErrors, recoveryContext.attempt);
        } finally {
            this.activeRecoveries.delete(recoveryId);
        }
    }

    /**
     * Execute synchronous operation with error boundary
     */
    public executeSync<T>(
        operation: string,
        fn: () => T,
        context?: any
    ): RecoveryResult {
        try {
            const result = fn();
            return {
                success: true,
                result,
                strategy: 'direct',
                attemptsUsed: 1,
                errors: [],
                fallbackUsed: false,
                recovery: 'full'
            };
        } catch (error) {
            const recoveredResult = this.applySyncRecovery(operation, error as Error, context);
            
            if (recoveredResult !== null) {
                return {
                    success: true,
                    result: recoveredResult,
                    strategy: 'sync-recovery',
                    attemptsUsed: 1,
                    errors: [error as Error],
                    fallbackUsed: true,
                    recovery: 'partial'
                };
            }

            return {
                success: false,
                strategy: 'sync-recovery',
                attemptsUsed: 1,
                errors: [error as Error],
                fallbackUsed: false,
                recovery: 'failed'
            };
        }
    }

    /**
     * Register custom recovery strategy
     */
    public registerStrategy(strategy: RecoveryStrategy): void {
        // Remove existing strategy with same name
        this.config.strategies = this.config.strategies.filter(s => s.name !== strategy.name);
        
        // Add new strategy in priority order
        this.config.strategies.push(strategy);
        this.config.strategies.sort((a, b) => b.priority - a.priority);

        Logger.info('ErrorRecoverySystem', `Registered recovery strategy: ${strategy.name}`, {
            priority: strategy.priority,
            errorTypes: strategy.errorTypes
        });
    }

    /**
     * Get recovery statistics
     */
    public getStatistics(): {
        totalRecoveries: number;
        successRate: number;
        activeRecoveries: number;
        strategyStats: Record<string, any>;
        operationStats: Record<string, any>;
    } {
        const operationStats: Record<string, any> = {};
        let totalAttempts = 0;
        let totalSuccesses = 0;

        for (const [operation, stats] of this.recoveryStats) {
            operationStats[operation] = {
                ...stats,
                successRate: stats.attempts > 0 ? stats.successes / stats.attempts : 0
            };
            totalAttempts += stats.attempts;
            totalSuccesses += stats.successes;
        }

        return {
            totalRecoveries: totalAttempts,
            successRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
            activeRecoveries: this.activeRecoveries.size,
            strategyStats: this.getStrategyStats(),
            operationStats
        };
    }

    /**
     * Generate recovery report
     */
    public generateRecoveryReport(): string {
        const stats = this.getStatistics();
        
        return `
# Error Recovery System Report
Generated: ${new Date().toISOString()}

## Summary
- Total Recovery Attempts: ${stats.totalRecoveries}
- Overall Success Rate: ${(stats.successRate * 100).toFixed(1)}%
- Active Recoveries: ${stats.activeRecoveries}

## Operation Statistics
${Object.entries(stats.operationStats).map(([operation, opStats]: [string, any]) => `
### ${operation}
- Attempts: ${opStats.attempts}
- Successes: ${opStats.successes}
- Success Rate: ${(opStats.successRate * 100).toFixed(1)}%
- Average Time: ${opStats.averageTime.toFixed(2)}ms
`).join('')}

## Recovery Strategies
${this.config.strategies.map(strategy => `
### ${strategy.name}
- Priority: ${strategy.priority}
- Error Types: ${strategy.errorTypes.join(', ')}
- Max Retries: ${strategy.maxRetries}
- Fallback: ${strategy.fallbackAction}
`).join('')}

## Recommendations
${this.generateRecommendations().map(rec => `- ${rec}`).join('\n')}
`;
    }

    /**
     * Attempt operation with recovery strategies
     */
    private async attemptWithRecovery<T>(
        fn: () => Promise<T> | T,
        context: RecoveryContext
    ): Promise<RecoveryResult> {
        const maxAttempts = Math.max(...this.config.strategies.map(s => s.maxRetries)) + 1;
        context.maxAttempts = maxAttempts;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            context.attempt = attempt;

            try {
                const result = await this.ensurePromise(fn());
                
                if (this.config.enableLogging && attempt > 1) {
                    Logger.info('ErrorRecoverySystem', `Recovery successful on attempt ${attempt}`, {
                        operation: context.operation,
                        previousErrors: context.previousErrors.length
                    });
                }

                return {
                    success: true,
                    result,
                    strategy: attempt === 1 ? 'direct' : 'retry',
                    attemptsUsed: attempt,
                    errors: context.previousErrors,
                    fallbackUsed: false,
                    recovery: 'full'
                };
            } catch (error) {
                context.previousErrors.push(error as Error);

                if (this.config.enableLogging) {
                    Logger.warn('ErrorRecoverySystem', `Attempt ${attempt} failed for operation: ${context.operation}`, {
                        error: (error as Error).message,
                        errorType: (error as Error).constructor.name
                    });
                }

                // Try recovery strategies
                const recovery = await this.applyRecoveryStrategy(error as Error, context);
                if (recovery !== null) {
                    return {
                        success: true,
                        result: recovery,
                        strategy: 'strategy-recovery',
                        attemptsUsed: attempt,
                        errors: context.previousErrors,
                        fallbackUsed: true,
                        recovery: 'partial'
                    };
                }

                // Wait before retry (exponential backoff)
                if (attempt < maxAttempts) {
                    const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await this.sleep(backoffMs);
                }
            }
        }

        throw new Error(`All recovery attempts failed for operation: ${context.operation}`);
    }

    /**
     * Apply recovery strategy for error
     */
    private async applyRecoveryStrategy(error: Error, context: RecoveryContext): Promise<any> {
        const applicableStrategies = this.config.strategies.filter(strategy => 
            strategy.errorTypes.some(type => 
                error.constructor.name === type || 
                error.message.includes(type) ||
                type === '*'
            )
        );

        for (const strategy of applicableStrategies) {
            try {
                if (strategy.recoveryFunction) {
                    const result = await strategy.recoveryFunction(error, context);
                    
                    if (this.config.enableLogging) {
                        Logger.info('ErrorRecoverySystem', `Recovery strategy succeeded: ${strategy.name}`, {
                            operation: context.operation,
                            strategy: strategy.name
                        });
                    }
                    
                    return result;
                }

                // Apply fallback actions
                const fallbackResult = this.applyFallbackAction(strategy, error, context);
                if (fallbackResult !== null) {
                    return fallbackResult;
                }
            } catch (strategyError) {
                if (this.config.enableLogging) {
                    Logger.warn('ErrorRecoverySystem', `Recovery strategy failed: ${strategy.name}`, {
                        error: (strategyError as Error).message
                    });
                }
            }
        }

        return null;
    }

    /**
     * Apply synchronous recovery
     */
    private applySyncRecovery(operation: string, error: Error, context: any): any {
        const applicableStrategies = this.config.strategies.filter(strategy => 
            strategy.errorTypes.some(type => 
                error.constructor.name === type || 
                error.message.includes(type) ||
                type === '*'
            )
        );

        for (const strategy of applicableStrategies) {
            try {
                if (strategy.recoveryFunction) {
                    const result = strategy.recoveryFunction(error, { operation, input: context });
                    
                    if (this.config.enableLogging) {
                        Logger.info('ErrorRecoverySystem', `Sync recovery succeeded: ${strategy.name}`, {
                            operation,
                            strategy: strategy.name
                        });
                    }
                    
                    return result;
                }

                const fallbackResult = this.applyFallbackAction(strategy, error, { operation, input: context });
                if (fallbackResult !== null) {
                    return fallbackResult;
                }
            } catch (strategyError) {
                if (this.config.enableLogging) {
                    Logger.warn('ErrorRecoverySystem', `Sync recovery strategy failed: ${strategy.name}`, {
                        error: (strategyError as Error).message
                    });
                }
            }
        }

        return null;
    }

    /**
     * Apply fallback action
     */
    private applyFallbackAction(strategy: RecoveryStrategy, error: Error, context: any): any {
        switch (strategy.fallbackAction) {
            case 'skip':
                return undefined;
            case 'default':
                return this.getDefaultValue(context);
            case 'partial':
                return this.getPartialResult(context);
            case 'retry':
                // Retry is handled at a higher level
                return null;
            default:
                return null;
        }
    }

    /**
     * Get default value for operation
     */
    private getDefaultValue(context: any): any {
        if (context?.operation?.includes('parse')) {
            return { messages: [], metadata: { recovered: true } };
        }
        
        if (context?.operation?.includes('format')) {
            return 'standard';
        }

        return null;
    }

    /**
     * Get partial result for operation
     */
    private getPartialResult(context: any): any {
        if (context?.input) {
            return {
                partial: true,
                originalInput: context.input,
                recovered: true
            };
        }

        return { partial: true, recovered: true };
    }

    /**
     * Create failure result
     */
    private createFailureResult(strategy: string, errors: Error[], attempts: number): RecoveryResult {
        return {
            success: false,
            strategy,
            attemptsUsed: attempts,
            errors,
            fallbackUsed: false,
            recovery: 'failed'
        };
    }

    /**
     * Update recovery statistics
     */
    private updateStats(operation: string, success: boolean, duration: number): void {
        if (!this.config.enableMetrics) return;

        let stats = this.recoveryStats.get(operation);
        if (!stats) {
            stats = { attempts: 0, successes: 0, failures: 0, averageTime: 0 };
            this.recoveryStats.set(operation, stats);
        }

        stats.attempts++;
        if (success) {
            stats.successes++;
        } else {
            stats.failures++;
        }

        // Update average time
        stats.averageTime = (stats.averageTime * (stats.attempts - 1) + duration) / stats.attempts;
    }

    /**
     * Get strategy usage statistics
     */
    private getStrategyStats(): Record<string, any> {
        // This would track which strategies are used most frequently
        // For now, return basic info about configured strategies
        return this.config.strategies.reduce((acc, strategy) => {
            acc[strategy.name] = {
                priority: strategy.priority,
                errorTypes: strategy.errorTypes,
                hasCustomFunction: !!strategy.recoveryFunction
            };
            return acc;
        }, {} as Record<string, any>);
    }

    /**
     * Generate recommendations based on recovery patterns
     */
    private generateRecommendations(): string[] {
        const recommendations: string[] = [];
        const stats = this.getStatistics();

        // Check overall success rate
        if (stats.successRate < 0.8) {
            recommendations.push('Review error patterns and improve base implementation');
        }

        // Check for operations with high failure rates
        const problematicOps = Object.entries(stats.operationStats)
            .filter(([, opStats]: [string, any]) => opStats.successRate < 0.5)
            .map(([operation]) => operation);

        if (problematicOps.length > 0) {
            recommendations.push(`Focus on improving: ${problematicOps.join(', ')}`);
        }

        // Check if recoveries are too frequent
        if (stats.totalRecoveries > 100) {
            recommendations.push('High recovery usage indicates underlying issues need attention');
        }

        return recommendations;
    }

    /**
     * Get default recovery strategies
     */
    private getDefaultStrategies(): RecoveryStrategy[] {
        return [
            {
                name: 'parsing-error-recovery',
                description: 'Recovery for parsing failures',
                errorTypes: ['SyntaxError', 'TypeError', 'parsing'],
                priority: 100,
                maxRetries: 2,
                backoffMs: 100,
                fallbackAction: 'partial',
                recoveryFunction: (error, context) => {
                    if (context.operation?.includes('parse') && context.input) {
                        // Try simplified parsing
                        return {
                            messages: [],
                            metadata: { error: error.message, recovered: true, originalInput: context.input }
                        };
                    }
                    return null;
                }
            },
            {
                name: 'format-detection-recovery',
                description: 'Recovery for format detection failures',
                errorTypes: ['format', 'detection'],
                priority: 90,
                maxRetries: 1,
                backoffMs: 50,
                fallbackAction: 'default',
                recoveryFunction: (error, context) => {
                    // Default to standard format
                    return 'standard';
                }
            },
            {
                name: 'boundary-detection-recovery',
                description: 'Recovery for boundary detection failures',
                errorTypes: ['boundary', 'RangeError'],
                priority: 80,
                maxRetries: 1,
                backoffMs: 0,
                fallbackAction: 'skip'
            },
            {
                name: 'memory-error-recovery',
                description: 'Recovery for memory-related errors',
                errorTypes: ['OutOfMemoryError', 'RangeError'],
                priority: 70,
                maxRetries: 0,
                backoffMs: 0,
                fallbackAction: 'partial',
                recoveryFunction: (error, context) => {
                    // Force garbage collection if available
                    if (typeof global !== 'undefined' && global.gc) {
                        global.gc();
                    }
                    return { recovered: true, error: 'memory-limit' };
                }
            },
            {
                name: 'generic-error-recovery',
                description: 'Generic recovery for any error',
                errorTypes: ['*'],
                priority: 10,
                maxRetries: 1,
                backoffMs: 1000,
                fallbackAction: 'default'
            }
        ];
    }

    /**
     * Ensure value is a Promise
     */
    private async ensurePromise<T>(value: T | Promise<T>): Promise<T> {
        return await value;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export type { RecoveryStrategy, RecoveryContext, RecoveryResult, ErrorBoundaryConfig };