import { 
  FormatStrategyFactory as IFormatStrategyFactory, 
  FormatStrategy, 
  FormatStrategyConstructor 
} from '../../interfaces';
import { FormatStrategyType, ParsedMaps } from '../../types/formatters.types'; // Correct import
import { SlackFormatSettings } from '../../types/settings.types';
import { Logger } from '../../utils/logger'; // Import Logger

/**
 * Factory for creating and selecting format strategies.
 * Implements the Factory pattern for strategy selection with on-demand instantiation.
 * Uses Singleton pattern.
 */
export class FormatStrategyFactory implements IFormatStrategyFactory {
  private static instance: FormatStrategyFactory;

  // Store constructors mapped by type
  private strategyConstructors: Map<FormatStrategyType, FormatStrategyConstructor> = new Map();
  // Store cached instances
  private strategyInstances: Map<FormatStrategyType, FormatStrategy> = new Map();
  // Store dependencies needed for instantiation
  private currentSettings: SlackFormatSettings | null = null;
  private currentParsedMaps: ParsedMaps | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of the factory
   * @returns Factory instance
   */
  public static getInstance(): FormatStrategyFactory {
    if (!FormatStrategyFactory.instance) {
      FormatStrategyFactory.instance = new FormatStrategyFactory();
    }
    return FormatStrategyFactory.instance;
  }

  /**
   * Register a strategy constructor with the factory
   * @param type Strategy type identifier
   * @param constructor Strategy constructor function
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
   * Updates the dependencies used for instantiating strategies.
   * Clears existing instances as they were created with old dependencies.
   * @param settings The current formatter settings.
   * @param parsedMaps The current parsed maps.
   */
  public updateDependencies(settings: SlackFormatSettings, parsedMaps: ParsedMaps): void {
    Logger.info('FormatStrategyFactory', 'Updating dependencies and clearing cached strategy instances.');
    this.currentSettings = settings;
    this.currentParsedMaps = parsedMaps;
    // Clear cached instances as they depend on the old settings/maps
    this.strategyInstances.clear(); 
  }

  /**
   * Get a specific strategy instance by type. Instantiates and caches if needed.
   * @param type Strategy type to find
   * @returns Matching strategy instance or null if type not registered or dependencies not set.
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
   * Clear all registered strategy constructors and cached instances.
   */
  public clearStrategies(): void {
    Logger.info('FormatStrategyFactory', 'Clearing all registered constructors and cached instances.');
    this.strategyConstructors.clear();
    this.strategyInstances.clear();
    // Optionally clear dependencies too, depending on desired reset behavior
    // this.currentSettings = null;
    // this.currentParsedMaps = null;
  }
}