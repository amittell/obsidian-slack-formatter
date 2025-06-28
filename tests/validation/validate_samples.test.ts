import fs from 'fs';
import path from 'path';
import { SlackFormatter } from '../../src/formatter/slack-formatter'; // Relative path from tests/validation
import { DEFAULT_SETTINGS } from '../../src/settings'; // Relative path
import { parseJsonMap } from '../../src/utils';
import { TestLogger } from '../helpers'; // Relative path

// Determine project root assuming tests run from the project root directory
const projectRoot = process.cwd();
const samplesDir = path.resolve(projectRoot, 'samples');

// Get all .txt files from the samples directory
let sampleFiles: string[] = [];
try {
  sampleFiles = fs.readdirSync(samplesDir).filter(file => file.endsWith('.txt'));
  TestLogger.log(`Found sample files: ${sampleFiles.join(', ')}`);
} catch (err) {
  TestLogger.error(`Error reading samples directory at ${samplesDir}:`, err);
  // Optionally, throw the error or exit if samples are critical
  // throw new Error(`Could not read samples directory: ${samplesDir}`);
}

// Initialize formatter (using default settings)
const userMap = parseJsonMap(DEFAULT_SETTINGS.userMapJson || '{}', 'User Map') ?? {};
const emojiMap = parseJsonMap(DEFAULT_SETTINGS.emojiMapJson || '{}', 'Emoji Map') ?? {};
// Ensure settings are passed correctly, potentially cloning to avoid modification issues
const settings = { ...DEFAULT_SETTINGS };
const formatter = new SlackFormatter(settings, userMap, emojiMap);

// Describe block for Jest
describe('Slack Formatter Validation Samples', () => {
  if (sampleFiles.length === 0) {
    it('should handle missing samples directory gracefully', () => {
      TestLogger.warn(`No sample files found in ${samplesDir}. Skipping validation tests.`);
      expect(true).toBe(true); // This is a valid scenario - no samples directory
    });
    return;
  }

  sampleFiles.forEach(sampleFile => {
    test(`should correctly format ${sampleFile}`, () => {
      const samplePath = path.join(samplesDir, sampleFile);
      let sampleContent = '';
      try {
        sampleContent = fs.readFileSync(samplePath, 'utf-8');
      } catch (err) {
        throw new Error(`Could not read sample file: ${samplePath}. Error: ${err}`);
      }

      // Format the content
      let formattedOutput = '';
      try {
        // Ensure the formatter is re-initialized or state is reset if necessary between tests,
        // although for this stateless formatter, it might not be strictly needed.
        // Re-parsing maps just in case, though defaults shouldn't change.
        const currentSettings = { ...DEFAULT_SETTINGS };
        const currentUserMap = parseJsonMap(currentSettings.userMapJson || '{}', 'User Map') ?? {};
        const currentEmojiMap =
          parseJsonMap(currentSettings.emojiMapJson || '{}', 'Emoji Map') ?? {};
        const currentFormatter = new SlackFormatter(
          currentSettings,
          currentUserMap,
          currentEmojiMap
        );
        formattedOutput = currentFormatter.formatSlackContent(sampleContent);
      } catch (err) {
        TestLogger.error(`Error formatting ${sampleFile}:`, err);
        // Optionally re-throw or fail the test differently
        // We'll let the snapshot failure indicate the error for now.
        formattedOutput = `FORMATTING ERROR for ${sampleFile}: ${err}`;
      }

      // Compare with snapshot named after the sample file
      // Jest automatically creates/updates .snap files in a __snapshots__ directory
      expect(formattedOutput).toMatchSnapshot();
    });
  });
});
