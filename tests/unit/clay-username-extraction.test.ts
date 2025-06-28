/**
 * Test Clay app message username extraction
 */

import {
  isAppMessage,
  extractAppUsername,
  extractUsername,
  MessageFormat,
} from '../../src/utils/username-utils.js';
import { IntelligentMessageParser } from '../../src/formatter/stages/intelligent-message-parser.js';
import { DEFAULT_SETTINGS } from '../../src/settings.js';

describe('Clay Username Extraction', () => {
  describe('username-utils functions', () => {
    const clayFormats = [
      ' (https://app.slack.com/services/B071TQU3SAH)Clay',
      ' (https://app.slack.com/services/B071TQU3SAH)Clay Jun 8th at 6:28 PM',
      ' (https://app.slack.com/services/B071TQU3SAH)Clay\nJun 8th at 6:28 PM',
    ];

    test.each(clayFormats)('should identify Clay format as app message: %s', format => {
      expect(isAppMessage(format)).toBe(true);
    });

    test.each(clayFormats)('should extract "Clay" from app username: %s', format => {
      expect(extractAppUsername(format)).toBe('Clay');
    });

    test.each(clayFormats)('should extract "Clay" with APP message format: %s', format => {
      expect(extractUsername(format, MessageFormat.APP)).toBe('Clay');
    });
  });

  describe('IntelligentMessageParser.extractUserAndTime', () => {
    let parser: IntelligentMessageParser;

    beforeEach(() => {
      parser = new IntelligentMessageParser(DEFAULT_SETTINGS, { userMap: {}, emojiMap: {} });
    });

    test('should extract Clay from basic app format', () => {
      const clayFormat = ' (https://app.slack.com/services/B071TQU3SAH)Clay';

      // @ts-ignore - accessing private method for testing
      const result = parser.extractUserAndTime(clayFormat);

      expect(result.username).toBe('Clay');
      expect(result.timestamp).toBeUndefined();
    });

    test('should extract Clay and timestamp from app format with timestamp', () => {
      const clayWithTimestamp =
        ' (https://app.slack.com/services/B071TQU3SAH)Clay Jun 8th at 6:28 PM';

      // @ts-ignore - accessing private method for testing
      const result = parser.extractUserAndTime(clayWithTimestamp);

      expect(result.username).toBe('Clay');
      expect(result.timestamp).toBe('6:28 PM');
    });

    test('should extract Clay from multiline app format', () => {
      const clayMultiline = ' (https://app.slack.com/services/B071TQU3SAH)Clay\nJun 8th at 6:28 PM';

      // @ts-ignore - accessing private method for testing
      const result = parser.extractUserAndTime(clayMultiline);

      expect(result.username).toBe('Clay');
      expect(result.timestamp).toBe('6:28 PM');
    });
  });

  describe('Edge cases', () => {
    test('should handle other app names correctly', () => {
      const githubFormat = ' (https://app.slack.com/services/B123456789)GitHub';
      expect(extractAppUsername(githubFormat)).toBe('GitHub');

      const slackFormat = ' (https://app.slack.com/services/BXXXXXXXX)Slack';
      expect(extractAppUsername(slackFormat)).toBe('Slack');
    });

    test('should not extract spaces in app names', () => {
      // This should only extract the app name, not the timestamp
      const appWithTimestamp = ' (https://app.slack.com/services/B123)AppName Some other text';
      expect(extractAppUsername(appWithTimestamp)).toBe('AppName');
    });
  });
});
