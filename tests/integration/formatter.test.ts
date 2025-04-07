import * as fs from 'fs';
import * as path from 'path';
import { SlackFormatter } from '../../src/formatter/slack-formatter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { SlackFormatSettings } from '../../src/types/settings.types';
import { parseJsonMap } from '../../src/utils'; // Assuming parseJsonMap is exported from utils

// Define paths
const samplesDir = path.join(__dirname, '../../samples');
const sampleFiles = fs.readdirSync(samplesDir).filter(file => file.endsWith('.txt'));

// Define Settings Configurations
const settingsC1: SlackFormatSettings = { ...DEFAULT_SETTINGS, debug: false }; // Default

const settingsC2: SlackFormatSettings = { // No Features
    ...DEFAULT_SETTINGS,
    enableCodeBlocks: false,
    enableMentions: false,
    enableEmoji: false,
    enableTimestampParsing: false,
    enableSubThreadLinks: false,
    debug: false,
};

const settingsC3: SlackFormatSettings = { // Custom Maps
    ...DEFAULT_SETTINGS,
    userMapJson: JSON.stringify({
        "U07JC6P29UM": "Alex Mapped", // Map @alexm based on likely ID from samples
        "User1": "Mapped User1" // Example generic mapping
    }),
    emojiMapJson: JSON.stringify({
        ...JSON.parse(DEFAULT_SETTINGS.emojiMapJson), // Keep defaults
        "bufo-clap": "👏", // Custom mapping
        "bufo-cowboy": "🤠✨", // Custom mapping with extra char
        "no_entry": "🚫", // Override default
        "test-emoji": "🧪" // Add a test one
    }),
    debug: false,
};

const settingsC4: SlackFormatSettings = { // Thread Collapse
    ...DEFAULT_SETTINGS,
    collapseThreads: true,
    threadCollapseThreshold: 3,
    debug: false,
};

const settingsConfigs: { name: string; settings: SlackFormatSettings }[] = [
    { name: 'C1-Default', settings: settingsC1 },
    { name: 'C2-NoFeatures', settings: settingsC2 },
    { name: 'C3-CustomMaps', settings: settingsC3 },
    { name: 'C4-ThreadCollapse', settings: settingsC4 },
];

// Helper to create formatter instance
const createFormatter = (settings: SlackFormatSettings): SlackFormatter => {
    const userMapResult = parseJsonMap(settings.userMapJson || '{}', 'User Map');
    const emojiMapResult = parseJsonMap(settings.emojiMapJson || '{}', 'Emoji Map');
    const userMap = userMapResult ?? {};
    const emojiMap = emojiMapResult ?? {};
    // Handle potential errors during map parsing if necessary, though snapshot will catch inconsistencies
    return new SlackFormatter(settings, userMap, emojiMap);
};

// Create Test Suite
describe('SlackFormatter Integration Tests (Snapshot)', () => {
    sampleFiles.forEach(file => {
        describe(`Sample: ${file}`, () => {
            const filePath = path.join(samplesDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');

            settingsConfigs.forEach(config => {
                // Skip thread collapse test for files without obvious threads if desired
                // if (config.name === 'C4-ThreadCollapse' && !content.includes('replies')) {
                //     it.skip(`should format correctly with settings: ${config.name}`, () => {});
                //     return;
                // }

                it(`should format correctly with settings: ${config.name}`, () => {
                    try {
                        const formatter = createFormatter(config.settings);
                        const formattedContent = formatter.formatSlackContent(content);
                        // Use snapshot testing
                        expect(formattedContent).toMatchSnapshot(config.name);
                    } catch (error) {
                        // Fail test explicitly on error during formatting
                        console.error(`Error formatting ${file} with ${config.name}:`, error);
                        throw error;
                    }
                });
            });
        
            // Add tests for specific error/edge cases from TESTING_PLAN.md
            it('ERROR_INVALID_JSON: should handle invalid userMapJson gracefully', () => {
                const invalidSettings: SlackFormatSettings = {
                    ...DEFAULT_SETTINGS,
                    userMapJson: '{ "invalid json": ', // Intentionally invalid JSON
                    debug: false,
                };
                // We expect the formatter to be created, potentially with warnings (not easily testable here)
                // and fall back to empty maps. Let's test formatting with default settings behavior.
                const formatter = createFormatter(invalidSettings);
                const testInput = "User1 [10:00 AM]\nHello"; // Simple input
                const formattedContent = formatter.formatSlackContent(testInput);
                // Snapshot should match default formatting as the map is ignored/empty
                expect(formattedContent).toMatchSnapshot('ERROR_INVALID_JSON');
            });
        
            it('FORMAT_UNKNOWN: should handle non-Slack input gracefully', () => {
                const formatter = createFormatter(settingsC1); // Use default settings
                const ambiguousInput = "This is just a regular line of text.\nMaybe another line.";
                const formattedContent = formatter.formatSlackContent(ambiguousInput);
                // Expect the formatter to likely return the input largely unchanged or with minimal processing
                expect(formattedContent).toMatchSnapshot('FORMAT_UNKNOWN');
            });
        });
    });
});