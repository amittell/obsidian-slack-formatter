/**
 * Parser Setup Utilities
 * Provides consistent parser initialization patterns used across test files
 */

import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser';
import { FlexibleMessageParser } from '../../src/formatter/stages/flexible-message-parser';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { StandardFormatStrategy } from '../../src/formatter/strategies/standard-format-strategy';
import { DEFAULT_SETTINGS } from '../../src/settings';

export interface TestParserConfig {
  debug?: boolean;
  userMap?: Record<string, string>;
  emojiMap?: Record<string, string>;
  settings?: any;
}

export interface ParsedMaps {
  userMap: Record<string, string>;
  emojiMap: Record<string, string>;
}

export interface ParserTestSuite {
  intelligentParser: IntelligentMessageParser;
  flexibleParser: FlexibleMessageParser;
  slackFormatter: SlackFormatter;
  standardFormatStrategy: StandardFormatStrategy;
  parsedMaps: ParsedMaps;
}

/**
 * Creates a standardized parser test suite with consistent configuration
 */
export function createParserTestSuite(config: TestParserConfig = {}): ParserTestSuite {
  const defaultConfig: TestParserConfig = {
    debug: false,
    userMap: {},
    emojiMap: {},
    settings: DEFAULT_SETTINGS,
  };

  const finalConfig = { ...defaultConfig, ...config };
  const settings = { ...finalConfig.settings, debug: finalConfig.debug };
  const parsedMaps: ParsedMaps = {
    userMap: finalConfig.userMap!,
    emojiMap: finalConfig.emojiMap!,
  };

  const intelligentParser = new IntelligentMessageParser(settings, parsedMaps);
  const flexibleParser = new FlexibleMessageParser();
  const slackFormatter = new SlackFormatter(settings, parsedMaps.userMap, parsedMaps.emojiMap);
  const standardFormatStrategy = new StandardFormatStrategy(settings, parsedMaps);

  return {
    intelligentParser,
    flexibleParser,
    slackFormatter,
    standardFormatStrategy,
    parsedMaps,
  };
}

/**
 * Creates a simple intelligent parser for basic tests
 */
export function createIntelligentParser(config: TestParserConfig = {}): IntelligentMessageParser {
  const suite = createParserTestSuite(config);
  return suite.intelligentParser;
}

/**
 * Creates a parser with debug logging enabled
 */
export function createDebugParser(
  userMap: Record<string, string> = {},
  emojiMap: Record<string, string> = {}
): IntelligentMessageParser {
  return createIntelligentParser({
    debug: true,
    userMap,
    emojiMap,
  });
}

/**
 * Creates a parser with production-like settings (no debug)
 */
export function createProductionParser(
  userMap: Record<string, string> = {},
  emojiMap: Record<string, string> = {}
): IntelligentMessageParser {
  return createIntelligentParser({
    debug: false,
    userMap,
    emojiMap,
  });
}

/**
 * Creates a parser specifically for regression testing
 */
export function createRegressionTestParser(): IntelligentMessageParser {
  return new IntelligentMessageParser(
    { ...DEFAULT_SETTINGS, debug: false },
    { userMap: {}, emojiMap: {} }
  );
}

/**
 * Creates both intelligent and flexible parsers for comparison tests
 */
export function createComparisonParsers(config: TestParserConfig = {}): {
  intelligent: IntelligentMessageParser;
  flexible: FlexibleMessageParser;
} {
  const suite = createParserTestSuite(config);
  return {
    intelligent: suite.intelligentParser,
    flexible: suite.flexibleParser,
  };
}

/**
 * Creates a complete formatting pipeline for integration tests
 */
export function createFormattingPipeline(config: TestParserConfig = {}): {
  parser: IntelligentMessageParser;
  formatter: SlackFormatter;
  strategy: StandardFormatStrategy;
  parseAndFormat: (input: string) => string;
  parseMessages: (input: string) => any[];
} {
  const suite = createParserTestSuite(config);

  return {
    parser: suite.intelligentParser,
    formatter: suite.slackFormatter,
    strategy: suite.standardFormatStrategy,
    parseAndFormat: (input: string) => suite.slackFormatter.formatSlackContent(input),
    parseMessages: (input: string) => suite.intelligentParser.parse(input, config.debug ?? false),
  };
}

/**
 * Creates a parser test setup for boundary detection tests
 */
export function createBoundaryTestSetup(): {
  intelligentParser: IntelligentMessageParser;
  flexibleParser: FlexibleMessageParser;
} {
  const intelligentParser = new IntelligentMessageParser(
    { debug: false },
    { userMap: {}, emojiMap: {} }
  );
  const flexibleParser = new FlexibleMessageParser();

  return { intelligentParser, flexibleParser };
}

/**
 * Creates a comprehensive validation setup for pipeline tests
 */
export function createComprehensiveTestSetup(): ParserTestSuite {
  const settings = { ...DEFAULT_SETTINGS, debug: false };
  const parsedMaps = { userMap: {}, emojiMap: {} };

  return createParserTestSuite({
    settings,
    userMap: parsedMaps.userMap,
    emojiMap: parsedMaps.emojiMap,
    debug: false,
  });
}

/**
 * Helper to create beforeEach setup function for common test patterns
 */
export function createBeforeEachSetup(config: TestParserConfig = {}) {
  return (): ParserTestSuite => {
    return createParserTestSuite(config);
  };
}

/**
 * Creates a parser with specific user mappings for testing user resolution
 */
export function createParserWithUsers(
  userMappings: Record<string, string>
): IntelligentMessageParser {
  return createIntelligentParser({
    debug: false,
    userMap: userMappings,
    emojiMap: {},
  });
}

/**
 * Creates a performance test setup with timing utilities
 */
export function createPerformanceTestSetup(config: TestParserConfig = {}): {
  parser: IntelligentMessageParser;
  timeExecution: (fn: () => any) => { result: any; time: number };
  timeMultipleExecutions: (
    fn: () => any,
    iterations: number
  ) => { results: any[]; times: number[]; avgTime: number };
} {
  const parser = createIntelligentParser(config);

  const timeExecution = (fn: () => any) => {
    const start = Date.now();
    const result = fn();
    const time = Date.now() - start;
    return { result, time };
  };

  const timeMultipleExecutions = (fn: () => any, iterations: number) => {
    const results: any[] = [];
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, time } = timeExecution(fn);
      results.push(result);
      times.push(time);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    return { results, times, avgTime };
  };

  return { parser, timeExecution, timeMultipleExecutions };
}
