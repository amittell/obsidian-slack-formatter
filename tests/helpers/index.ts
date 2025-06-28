/**
 * Test Helpers Index
 * Central export point for all test utility functions and classes
 */

// Debug utilities - inline to avoid CI module resolution issues
export interface DebugLoggerConfig {
  enabled: boolean;
  prefix?: string;
  includeTimestamp?: boolean;
  includeFileInfo?: boolean;
}

export class TestDebugLogger {
  private config: DebugLoggerConfig;
  private testName: string;

  constructor(testName: string, config: Partial<DebugLoggerConfig> = {}) {
    this.testName = testName;
    this.config = {
      enabled: process.env.DEBUG_TESTS === 'true' || config.enabled === true,
      prefix: config.prefix || '===',
      includeTimestamp: config.includeTimestamp ?? false,
      includeFileInfo: config.includeFileInfo ?? false,
      ...config,
    };
  }

  static create(testName: string, enabled?: boolean): TestDebugLogger {
    return new TestDebugLogger(testName, { enabled });
  }

  log(message: string): void {
    if (!this.config.enabled) return;
    const timestamp = this.config.includeTimestamp ? `[${new Date().toISOString()}] ` : '';
    const prefix = this.config.prefix ? `${this.config.prefix} ` : '';
    console.log(`${timestamp}${prefix}${this.testName}: ${message}`);
  }

  logParsingResults(messages: any[], inputLength: number): void {
    if (!this.config.enabled) return;
    this.log(`Parsed ${messages.length} messages from ${inputLength} characters`);
  }

  logUserValidation(messages: any[], expectedUsers: string[]): void {
    if (!this.config.enabled) return;
    const detectedUsers = [...new Set(messages.map((m: any) => m.username))];
    this.log(`Expected users: ${expectedUsers.join(', ')}`);
    this.log(`Detected users: ${detectedUsers.join(', ')}`);
  }

  logContentIntegrity(formatted: string, criticalContent: string[]): void {
    if (!this.config.enabled) return;
    this.log(`Formatted length: ${formatted.length} characters`);
    this.log(`Critical content preserved: ${criticalContent.length} items`);
  }

  logSuccess(message: string): void {
    if (!this.config.enabled) return;
    this.log(`✅ ${message}`);
  }
}

export function debugLog(message: string, enabled = false): void {
  if (enabled) console.log(`[DEBUG] ${message}`);
}

export function debugLogTest(testName: string, message: string, enabled = false): void {
  if (enabled) console.log(`[DEBUG:${testName}] ${message}`);
}

// Test logging utilities - inline to avoid CI module resolution issues
export class TestLogger {
  private static isEnabled =
    process.env.TEST_DEBUG === 'true' || process.env.NODE_ENV === 'development';

  static log(...args: any[]): void {
    if (TestLogger.isEnabled) {
      console.log('[TEST]', ...args);
    }
  }

  static error(...args: any[]): void {
    console.error('[TEST ERROR]', ...args);
  }

  static warn(...args: any[]): void {
    console.warn('[TEST WARN]', ...args);
  }

  static enable(): void {
    TestLogger.isEnabled = true;
  }

  static disable(): void {
    TestLogger.isEnabled = false;
  }

  static isLoggingEnabled(): boolean {
    return TestLogger.isEnabled;
  }
}

// Parser setup utilities
export {
  createParserTestSuite,
  createIntelligentParser,
  createDebugParser,
  createProductionParser,
  createRegressionTestParser,
  createComparisonParsers,
  createFormattingPipeline,
  createBoundaryTestSetup,
  createComprehensiveTestSetup,
  createBeforeEachSetup,
  createParserWithUsers,
  createPerformanceTestSetup,
  type TestParserConfig,
  type ParsedMaps,
  type ParserTestSuite,
} from './parser-setup';

// Assertion utilities
export {
  assertUserValidation,
  assertMessageCount,
  assertContentPreservation,
  assertUsernameAttribution,
  assertMessageBoundaries,
  assertUserDifferentiation,
  assertPerformanceMetrics,
  assertFormattedStructure,
  assertNoContentMerging,
  assertRegressionFix,
  createValidationSuite,
  type ParsedMessage,
  type UserValidationResult,
  type ContentValidationResult,
} from './assertion-utils';

// Test fixtures
export {
  CLAY_CONVERSATION,
  CLAY_APP_ONLY,
  BO_CLAY_ONLY,
  JORGE_MESSAGE,
  THREAD_FORMAT_CONVERSATION,
  DM_FORMAT_CONVERSATION,
  MIXED_FORMAT_CONVERSATION,
  BILL_MEI_CONVERSATION,
  BOUNDARY_DETECTION_CONVERSATION,
  PERFORMANCE_TEST_CONVERSATION,
  REGRESSION_TEST_CONVERSATION,
  ALL_TEST_CONVERSATIONS,
  EDGE_CASE_CONVERSATIONS,
  getTestConversation,
  createTestConversation,
  getConversationForFeature,
  type TestConversation,
} from './test-fixtures';

// Performance utilities
export {
  measurePerformance,
  benchmarkFunction,
  validatePerformance,
  logPerformanceBenchmark,
  PerformanceTestSuite,
  quickBenchmark,
  PERFORMANCE_THRESHOLDS,
  getPerformanceThresholds,
  type PerformanceMetrics,
  type PerformanceBenchmark,
  type PerformanceSummary,
  type PerformanceThresholds,
} from './performance-utils';

/**
 * Quick setup function for common test patterns
 * Combines the most frequently used utilities
 */
export function setupTestSuite(
  testName: string,
  config: {
    debug?: boolean;
    userMap?: Record<string, string>;
    emojiMap?: Record<string, string>;
    conversation?: string;
    expectedUsers?: string[];
  } = {}
) {
  const logger = TestDebugLogger.create(testName, config.debug);
  const { parser, formatter, parseMessages, parseAndFormat } = createFormattingPipeline({
    debug: config.debug ?? false,
    userMap: config.userMap ?? {},
    emojiMap: config.emojiMap ?? {},
  });

  const testUtils = {
    logger,
    parser,
    formatter,
    parseMessages,
    parseAndFormat,

    // Common test patterns
    parseAndValidate: (input: string, expectedUsers: string[] = config.expectedUsers ?? []) => {
      const messages = parseMessages(input);
      logger.logParsingResults(messages, input.length);

      if (expectedUsers.length > 0) {
        const validation = assertUserValidation(messages, expectedUsers, {
          allowUnknownUser: false,
        });
        logger.logUserValidation(messages, expectedUsers);
        return { messages, validation };
      }

      return { messages };
    },

    fullPipelineTest: (input: string, expectedUsers: string[], criticalContent: string[]) => {
      const messages = parseMessages(input);
      const formatted = parseAndFormat(input);

      logger.logParsingResults(messages, input.length);

      const validation = createValidationSuite(messages, expectedUsers, criticalContent, formatted);
      const userValidation = validation.validateUsers();
      const contentValidation = validation.validateContent();

      logger.logUserValidation(messages, expectedUsers);
      if (contentValidation) {
        logger.logContentIntegrity(formatted, criticalContent);
      }

      return {
        messages,
        formatted,
        userValidation,
        contentValidation,
        validation,
      };
    },
  };

  return testUtils;
}

/**
 * Quick test for regression validation
 */
export function createRegressionTest(
  testName: string,
  conversation: string,
  expectedUsers: string[]
) {
  const logger = TestDebugLogger.create(testName);
  const parser = createRegressionTestParser();

  return {
    runTest: () => {
      const messages = parser.parse(conversation, false);
      logger.logParsingResults(messages, conversation.length);

      const validation = assertUserValidation(messages, expectedUsers, { allowUnknownUser: false });
      logger.logUserValidation(messages, expectedUsers);

      assertRegressionFix(messages, {
        minMessageCount: Math.max(2, expectedUsers.length - 1),
        noUnknownUser: true,
        noTimestampAsUsername: true,
      });

      logger.logSuccess('Regression test passed');
      return { messages, validation };
    },
  };
}

/**
 * Quick performance test setup
 */
export function createQuickPerformanceTest(testName: string, testInput: string) {
  const suite = new PerformanceTestSuite(getPerformanceThresholds());
  const parser = createProductionParser();

  return {
    runBenchmark: (iterations: number = 5) => {
      const benchmark = suite.benchmarkParser(
        testName,
        input => parser.parse(input, false),
        testInput,
        iterations,
        messages => messages.length
      );

      logPerformanceBenchmark(benchmark);
      const validation = validatePerformance(benchmark, getPerformanceThresholds());

      return { benchmark, validation };
    },
  };
}
