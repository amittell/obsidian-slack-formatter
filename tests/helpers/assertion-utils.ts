/**
 * Assertion Utilities
 * Provides common assertion patterns and validation functions used across test files
 */

import { expect } from '@jest/globals';

export interface ParsedMessage {
  username: string;
  timestamp?: string;
  text?: string;
  reactions?: any[];
  [key: string]: any;
}

export interface UserValidationResult {
  detected: string[];
  expected: string[];
  missing: string[];
  unexpected: string[];
  unknownUserCount: number;
  hasUnknownUserRegression: boolean;
}

export interface ContentValidationResult {
  found: string[];
  missing: string[];
  allFound: boolean;
}

/**
 * Validates that messages contain expected users without Unknown User regression
 */
export function assertUserValidation(
  messages: ParsedMessage[],
  expectedUsers: string[],
  options: {
    allowUnknownUser?: boolean;
    strictOrder?: boolean;
    requireAll?: boolean;
  } = {}
): UserValidationResult {
  const detected = [...new Set(messages.map(m => m.username))];
  const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
  const unknownUserCount = unknownUserMessages.length;

  const missing = expectedUsers.filter(user => !detected.includes(user));
  const unexpected = detected.filter(
    user => !expectedUsers.includes(user) && user !== 'Unknown User'
  );

  const result: UserValidationResult = {
    detected,
    expected: expectedUsers,
    missing,
    unexpected,
    unknownUserCount,
    hasUnknownUserRegression: unknownUserCount > 0,
  };

  // Core assertions
  if (!options.allowUnknownUser) {
    expect(unknownUserCount).toBe(0);
  }

  if (options.requireAll !== false) {
    expectedUsers.forEach(user => {
      expect(detected).toContain(user);
    });
  }

  return result;
}

/**
 * Validates message count within expected range
 */
export function assertMessageCount(
  messages: ParsedMessage[],
  expected: number | { min?: number; max?: number; exact?: number }
): void {
  if (typeof expected === 'number') {
    expect(messages.length).toBe(expected);
  } else {
    if (expected.exact !== undefined) {
      expect(messages.length).toBe(expected.exact);
    }
    if (expected.min !== undefined) {
      expect(messages.length).toBeGreaterThanOrEqual(expected.min);
    }
    if (expected.max !== undefined) {
      expect(messages.length).toBeLessThanOrEqual(expected.max);
    }
  }
}

/**
 * Validates that critical content is preserved in formatted output
 */
export function assertContentPreservation(
  formattedOutput: string,
  criticalContent: string[]
): ContentValidationResult {
  const found: string[] = [];
  const missing: string[] = [];

  criticalContent.forEach(content => {
    if (formattedOutput.includes(content)) {
      found.push(content);
    } else {
      missing.push(content);
    }
  });

  const result: ContentValidationResult = {
    found,
    missing,
    allFound: missing.length === 0,
  };

  // Assert all content is preserved
  missing.forEach(content => {
    expect(formattedOutput).toContain(content);
  });

  return result;
}

/**
 * Validates username attribution in formatted output
 */
export function assertUsernameAttribution(
  formattedOutput: string,
  expectedUsers: string[],
  options: {
    allowUnknownUser?: boolean;
    formatPattern?: RegExp;
  } = {}
): void {
  const formatPattern = options.formatPattern || />\s*\*\*([^*]+)\*\*/g;
  const usernameMatches = formattedOutput.match(formatPattern) || [];
  const extractedUsernames = usernameMatches.map(match =>
    match.replace(/>\s*\*\*/, '').replace(/\*\*/, '')
  );

  expectedUsers.forEach(expectedUser => {
    const found = extractedUsernames.some(
      extracted => extracted.includes(expectedUser) || expectedUser.includes(extracted)
    );
    expect(found).toBe(true);
  });

  if (!options.allowUnknownUser) {
    const hasUnknownUser = extractedUsernames.some(username => username.includes('Unknown User'));
    expect(hasUnknownUser).toBe(false);
  }
}

/**
 * Validates message boundaries and separation
 */
export function assertMessageBoundaries(
  messages: ParsedMessage[],
  testCases: Array<{
    username: string;
    contentIncludes?: string;
    contentExcludes?: string;
    timestampIncludes?: string;
  }>
): void {
  testCases.forEach((testCase, index) => {
    const matchingMessages = messages.filter(m => m.username === testCase.username);

    expect(matchingMessages.length).toBeGreaterThan(0);

    if (testCase.contentIncludes) {
      const hasContent = matchingMessages.some(m => m.text?.includes(testCase.contentIncludes!));
      expect(hasContent).toBe(true);
    }

    if (testCase.contentExcludes) {
      const hasExcludedContent = matchingMessages.some(m =>
        m.text?.includes(testCase.contentExcludes!)
      );
      expect(hasExcludedContent).toBe(false);
    }

    if (testCase.timestampIncludes) {
      const hasTimestamp = matchingMessages.some(m =>
        m.timestamp?.includes(testCase.timestampIncludes!)
      );
      expect(hasTimestamp).toBe(true);
    }
  });
}

/**
 * Validates user differentiation (e.g., Clay vs Bo (Clay))
 */
export function assertUserDifferentiation(
  messages: ParsedMessage[],
  differentiationRules: Array<{
    username: string;
    requiredContent: string;
    requiredTimestamp?: string;
    count?: number;
  }>
): void {
  differentiationRules.forEach(rule => {
    const matchingMessages = messages.filter(
      msg => msg.username === rule.username && msg.text?.includes(rule.requiredContent)
    );

    if (rule.count !== undefined) {
      expect(matchingMessages.length).toBe(rule.count);
    } else {
      expect(matchingMessages.length).toBeGreaterThan(0);
    }

    if (rule.requiredTimestamp) {
      const hasTimestamp = matchingMessages.some(m =>
        m.timestamp?.includes(rule.requiredTimestamp!)
      );
      expect(hasTimestamp).toBe(true);
    }
  });
}

/**
 * Validates performance metrics
 */
export function assertPerformanceMetrics(
  times: number[],
  thresholds: {
    maxAverage?: number;
    maxSingle?: number;
    minCharactersPerSecond?: number;
  },
  inputSize?: number
): void {
  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const maxTime = Math.max(...times);

  if (thresholds.maxAverage) {
    expect(avgTime).toBeLessThan(thresholds.maxAverage);
  }

  if (thresholds.maxSingle) {
    expect(maxTime).toBeLessThan(thresholds.maxSingle);
  }

  if (thresholds.minCharactersPerSecond && inputSize) {
    const charactersPerSecond = (inputSize / avgTime) * 1000;
    expect(charactersPerSecond).toBeGreaterThan(thresholds.minCharactersPerSecond);
  }
}

/**
 * Validates formatted output structure (callouts, separators, etc.)
 */
export function assertFormattedStructure(
  formattedOutput: string,
  expectations: {
    calloutHeaders?: number;
    messageSeparators?: number;
    messageBlocks?: number;
    calloutPattern?: RegExp;
    separatorPattern?: RegExp;
  }
): void {
  const calloutPattern = expectations.calloutPattern || /> \[!slack\]\+/g;
  const separatorPattern = expectations.separatorPattern || /\n\n---\n\n/g;

  const calloutHeaders = (formattedOutput.match(calloutPattern) || []).length;
  const messageSeparators = (formattedOutput.match(separatorPattern) || []).length;
  const messageBlocks = formattedOutput.split(separatorPattern).length;

  if (expectations.calloutHeaders !== undefined) {
    expect(calloutHeaders).toBe(expectations.calloutHeaders);
  }

  if (expectations.messageSeparators !== undefined) {
    expect(messageSeparators).toBe(expectations.messageSeparators);
  }

  if (expectations.messageBlocks !== undefined) {
    expect(messageBlocks).toBe(expectations.messageBlocks);
  }
}

/**
 * Validates that no content merging has occurred between messages
 */
export function assertNoContentMerging(
  messages: ParsedMessage[],
  separationRules: Array<{
    username: string;
    shouldContain: string;
    shouldNotContain: string;
  }>
): void {
  separationRules.forEach(rule => {
    const userMessages = messages.filter(m => m.username === rule.username);

    const messageWithExpected = userMessages.find(m => m.text?.includes(rule.shouldContain));
    expect(messageWithExpected).toBeTruthy();

    // Ensure the message with expected content doesn't have excluded content
    expect(messageWithExpected?.text).not.toContain(rule.shouldNotContain);
  });
}

/**
 * Validates regression fixes by checking specific patterns
 */
export function assertRegressionFix(
  messages: ParsedMessage[],
  regressionChecks: {
    minMessageCount?: number;
    noUnknownUser?: boolean;
    noTimestampAsUsername?: boolean;
    noContentTruncation?: boolean;
    specificFixes?: Array<{
      description: string;
      check: (messages: ParsedMessage[]) => boolean;
    }>;
  }
): void {
  if (regressionChecks.minMessageCount) {
    expect(messages.length).toBeGreaterThanOrEqual(regressionChecks.minMessageCount);
  }

  if (regressionChecks.noUnknownUser) {
    const unknownUserMessages = messages.filter(m => m.username === 'Unknown User');
    expect(unknownUserMessages.length).toBe(0);
  }

  if (regressionChecks.noTimestampAsUsername) {
    const hasTimestampUsername = messages.some(
      m =>
        m.username?.includes('Jun ') ||
        m.username?.includes('at ') ||
        m.username?.includes('PM') ||
        m.username?.includes('AM')
    );
    expect(hasTimestampUsername).toBe(false);
  }

  if (regressionChecks.specificFixes) {
    regressionChecks.specificFixes.forEach(fix => {
      expect(fix.check(messages)).toBe(true);
    });
  }
}

/**
 * Creates a comprehensive validation suite for common test patterns
 */
export function createValidationSuite(
  messages: ParsedMessage[],
  expectedUsers: string[],
  criticalContent: string[],
  formattedOutput?: string
) {
  return {
    validateUsers: (options?: Parameters<typeof assertUserValidation>[2]) =>
      assertUserValidation(messages, expectedUsers, options),

    validateMessageCount: (expected: Parameters<typeof assertMessageCount>[1]) =>
      assertMessageCount(messages, expected),

    validateContent: () =>
      formattedOutput ? assertContentPreservation(formattedOutput, criticalContent) : null,

    validateAttribution: (options?: Parameters<typeof assertUsernameAttribution>[2]) =>
      formattedOutput ? assertUsernameAttribution(formattedOutput, expectedUsers, options) : null,

    validateNoRegression: () =>
      assertRegressionFix(messages, {
        noUnknownUser: true,
        noTimestampAsUsername: true,
      }),
  };
}
