import { 
  FormatStrategyFactory as IFormatStrategyFactory, 
  FormatStrategy, 
  FormatStrategyConstructor 
} from '../../interfaces';
import { FormatStrategyType, ParsedMaps } from '../../types/formatters.types'; // Correct import
import { SlackFormatSettings } from '../../types/settings.types';
import { Logger } from '../../utils/logger'; // Import Logger

/**
 * Centralized factory for creating and managing format strategy instances.
 * Implements both Factory and Singleton patterns for efficient strategy management.
 * 
 * **Design Patterns:**
 * - **Factory Pattern**: Creates strategy instances based on type identifiers
 * - **Singleton Pattern**: Ensures single factory instance across application
 * - **Registry Pattern**: Manages strategy constructor registration
 * - **Lazy Initialization**: Creates strategies only when needed
 * 
 * **Key Features:**
 * - Dynamic strategy registration and discovery
 * - Dependency injection for settings and parsed maps
 * - Instance caching for performance optimization
 * - Automatic cleanup on settings changes
 * - Error handling with graceful fallbacks
 * 
 * **Lifecycle Management:**
 * 1. **Registration**: Strategy constructors registered by type
 * 2. **Dependency Update**: Settings and maps provided for instantiation
 * 3. **Lazy Creation**: Strategies created on first request
 * 4. **Caching**: Instances cached for reuse
 * 5. **Invalidation**: Cache cleared when dependencies change
 * 
 * **Thread Safety:**
 * - Singleton pattern ensures single instance
 * - Map operations are synchronous
 * - No shared mutable state between strategies
 * 
 * @implements {IFormatStrategyFactory}
 * 
 * @example
 * Basic factory usage:
 * ```typescript
 * import { StandardFormatStrategy } from './standard-format-strategy';
 * import { BracketFormatStrategy } from './bracket-format-strategy';
 * 
 * const factory = FormatStrategyFactory.getInstance();
 * 
 * // Register strategies
 * factory.registerStrategy('standard', StandardFormatStrategy);
 * factory.registerStrategy('bracket', BracketFormatStrategy);
 * 
 * // Update dependencies
 * factory.updateDependencies(settings, parsedMaps);
 * 
 * // Get strategy instances
 * const standardStrategy = factory.getStrategyByType('standard');
 * const bracketStrategy = factory.getStrategyByType('bracket');
 * ```
 * 
 * Advanced usage with error handling:
 * ```typescript
 * const factory = FormatStrategyFactory.getInstance();
 * 
 * // Register with validation
 * try {
 *   factory.registerStrategy('custom', CustomStrategy);
 * } catch (error) {
 *   console.error('Strategy registration failed:', error);
 * }
 * 
 * // Safe strategy retrieval
 * const strategy = factory.getStrategyByType('custom');
 * if (!strategy) {
 *   // Fallback logic
 *   const defaultStrategy = factory.getStrategyByType('standard');
 * }
 * ```
 * 
 * @see {@link StandardFormatStrategy} - Standard Obsidian format
 * @see {@link BracketFormatStrategy} - Bracket notation format
 * @see {@link MixedFormatStrategy} - Adaptive mixed format
 */
export class FormatStrategyFactory implements IFormatStrategyFactory {
  /** Singleton instance of the factory */
  private static instance: FormatStrategyFactory;

  /** Registry of strategy constructors mapped by type identifier */
  private strategyConstructors: Map<FormatStrategyType, FormatStrategyConstructor> = new Map();
  
  /** Cache of instantiated strategy instances for reuse */
  private strategyInstances: Map<FormatStrategyType, FormatStrategy> = new Map();
  
  /** Current formatter settings for strategy instantiation */
  private currentSettings: SlackFormatSettings | null = null;
  
  /** Current parsed data maps for strategy instantiation */
  private currentParsedMaps: ParsedMaps | null = null;

  /**
   * Private constructor to enforce singleton pattern.
   * Prevents direct instantiation - use getInstance() instead.
   * 
   * @private
   */
  private constructor() {}

  /**
   * Gets the singleton instance of the format strategy factory.
   * Creates the instance on first access (lazy initialization).
   * 
   * @static
   * @returns {FormatStrategyFactory} The singleton factory instance
   * 
   * @example
   * ```typescript
   * // Get factory instance
   * const factory = FormatStrategyFactory.getInstance();
   * 
   * // Multiple calls return same instance
   * const sameFactory = FormatStrategyFactory.getInstance();
   * console.log(factory === sameFactory); // true
   * ```
   */
  public static getInstance(): FormatStrategyFactory {
    if (!FormatStrategyFactory.instance) {
      FormatStrategyFactory.instance = new FormatStrategyFactory();
    }
    return FormatStrategyFactory.instance;
  }

  /**
   * Registers a strategy constructor with the factory.
   * Enables dynamic strategy discovery and instantiation.
   * 
   * **Registration Effects:**
   * - Adds constructor to internal registry
   * - Clears any cached instance of the same type
   * - Logs registration for debugging
   * - Warns if overwriting existing registration
   * 
   * @param {FormatStrategyType} type - Unique identifier for the strategy type
   * @param {FormatStrategyConstructor} constructor - Constructor function for the strategy
   * 
   * @example
   * ```typescript
   * import { CustomFormatStrategy } from './custom-format-strategy';
   * 
   * const factory = FormatStrategyFactory.getInstance();
   * 
   * // Register new strategy
   * factory.registerStrategy('custom', CustomFormatStrategy);
   * 
   * // Register with overwrite warning
   * factory.registerStrategy('custom', ImprovedCustomStrategy);
   * // Logs: "Strategy type 'custom' is already registered. Overwriting."
   * ```
   * 
   * @see {@link getStrategyByType} - Retrieve registered strategies
   */
  public registerStrategy(type: FormatStrategyType, constructor: FormatStrategyConstructor): void {
    if (this.strategyConstructors.has(type)) {
        Logger.warn('FormatStrategyFactory', `Strategy type "${type}" is already registered. Overwriting.`);
    }
    this.strategyConstructors.set(type, constructor);
    // Clear any cached instance for this type, as the constructor might have changed
    this.strategyInstances.delete(type); 
    Logger.info('FormatStrategyFactory', `Registered strategy constructor for type "${type}".`);
  }

  /**
   * Updates the dependencies used for strategy instantiation.
   * Invalidates all cached strategy instances to ensure they use current data.
   * 
   * **Dependency Management:**
   * - Updates internal settings and parsed maps references
   * - Clears all cached strategy instances
   * - Forces recreation of strategies with new dependencies
   * - Logs dependency update for debugging
   * 
   * **When to Call:**
   * - Settings configuration changes
   * - New Slack export data loaded
   * - User or emoji mappings updated
   * - Timezone or formatting preferences changed
   * 
   * @param {SlackFormatSettings} settings - Updated formatter configuration
   * @param {ParsedMaps} parsedMaps - Updated user, channel, and emoji mappings
   * 
   * @example
   * ```typescript
   * const factory = FormatStrategyFactory.getInstance();
   * 
   * // Initial setup
   * factory.updateDependencies(initialSettings, initialMaps);
   * const strategy1 = factory.getStrategyByType('standard');
   * 
   * // Settings change - strategies need new dependencies
   * const updatedSettings = { ...initialSettings, timeZone: 'UTC' };
   * factory.updateDependencies(updatedSettings, initialMaps);
   * 
   * // Next strategy request creates new instance with updated settings
   * const strategy2 = factory.getStrategyByType('standard');
   * console.log(strategy1 !== strategy2); // true - new instance created
   * ```
   */
  public updateDependencies(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void {
    Logger.info('FormatStrategyFactory', 'Updating dependencies and clearing cached strategy instances.');
    this.currentSettings = settings;
    this.currentParsedMaps = parsedMaps;
    // Clear cached instances as they depend on the old settings/maps
    this.strategyInstances.clear(); 
  }

  /**
   * Retrieves a strategy instance by type, with lazy instantiation and caching.
   * Implements the Factory pattern with performance optimizations.
   * 
   * **Retrieval Process:**
   * 1. Check cache for existing instance
   * 2. Validate constructor registration
   * 3. Verify dependencies are available
   * 4. Instantiate strategy with current dependencies
   * 5. Cache instance for future requests
   * 6. Return strategy or null on failure
   * 
   * **Error Conditions:**
   * - Strategy type not registered
   * - Dependencies not set via updateDependencies()
   * - Constructor throws during instantiation
   * 
   * @param {FormatStrategyType} type - Strategy type identifier to retrieve
   * @returns {FormatStrategy | null} Strategy instance or null if unavailable
   * 
   * @example
   * Successful retrieval:
   * ```typescript
   * const factory = FormatStrategyFactory.getInstance();
   * factory.registerStrategy('standard', StandardFormatStrategy);
   * factory.updateDependencies(settings, maps);
   * 
   * const strategy = factory.getStrategyByType('standard');
   * if (strategy) {
   *   const formatted = strategy.formatToMarkdown(messages);
   * }
   * ```
   * 
   * Error handling:
   * ```typescript
   * const strategy = factory.getStrategyByType('nonexistent');
   * if (!strategy) {
   *   console.error('Strategy not available, using fallback');
   *   const fallback = factory.getStrategyByType('standard');
   * }
   * ```
   * 
   * Performance caching:
   * ```typescript
   * const strategy1 = factory.getStrategyByType('standard');
   * const strategy2 = factory.getStrategyByType('standard');
   * console.log(strategy1 === strategy2); // true - same cached instance
   * ```
   */
  public getStrategyByType(type: FormatStrategyType): FormatStrategy | null {
    // Return cached instance if available
    if (this.strategyInstances.has(type)) {
      return this.strategyInstances.get(type) as FormatStrategy;
    }

    // Check if constructor is registered
    const constructor = this.strategyConstructors.get(type);
    if (!constructor) {
      Logger.warn('FormatStrategyFactory', `No strategy constructor registered for type "${type}".`);
      return null;
    }

    // Check if dependencies are set
    if (!this.currentSettings || !this.currentParsedMaps) {
      Logger.error('FormatStrategyFactory', `Cannot instantiate strategy "${type}" because dependencies (settings/maps) have not been set.`);
      return null;
    }

    // Instantiate, cache, and return
    try {
      Logger.info('FormatStrategyFactory', `Instantiating strategy for type "${type}".`);
      const instance = new constructor(this.currentSettings, this.currentParsedMaps);
      this.strategyInstances.set(type, instance);
      return instance;
    } catch (error) {
      Logger.error('FormatStrategyFactory', `Error instantiating strategy for type "${type}".`, { error });
      return null;
    }
  }

  /**
   * Clears all registered strategies and cached instances.
   * Useful for testing, cleanup, or complete factory reset.
   * 
   * **Cleanup Operations:**
   * - Removes all registered strategy constructors
   * - Clears all cached strategy instances
   * - Preserves current dependencies for future registrations
   * - Logs cleanup operation for debugging
   * 
   * **Use Cases:**
   * - Unit test cleanup between test cases
   * - Plugin system strategy management
   * - Memory cleanup in long-running applications
   * - Development mode hot reloading
   * 
   * @example
   * ```typescript
   * const factory = FormatStrategyFactory.getInstance();
   * 
   * // Register some strategies
   * factory.registerStrategy('standard', StandardFormatStrategy);
   * factory.registerStrategy('bracket', BracketFormatStrategy);
   * 
   * // Clear everything
   * factory.clearStrategies();
   * 
   * // Factory is now empty but ready for new registrations
   * const strategy = factory.getStrategyByType('standard'); // Returns null
   * ```
   * 
   * Test cleanup pattern:
   * ```typescript
   * afterEach(() => {
   *   FormatStrategyFactory.getInstance().clearStrategies();
   * });
   * ```
   */
  public clearStrategies(): void {
    Logger.info('FormatStrategyFactory', 'Clearing all registered constructors and cached instances.');
    this.strategyConstructors.clear();
    this.strategyInstances.clear();
    // Dependencies preserved for future use - clear manually if needed:
    // this.currentSettings = null;
    // this.currentParsedMaps = null;
  }
}