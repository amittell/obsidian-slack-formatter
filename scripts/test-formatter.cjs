#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load the built plugin
const pluginPath = path.join(__dirname, '..', 'main.js');
const pluginCode = fs.readFileSync(pluginPath, 'utf8');

// Create a minimal mock of Obsidian API
global.obsidian = {
    Plugin: class Plugin {
        constructor() {}
        addCommand() {}
        addSettingTab() {}
        loadData() { return Promise.resolve({}); }
        saveData() { return Promise.resolve(); }
        registerEvent() {}
    },
    PluginSettingTab: class PluginSettingTab {},
    Setting: class Setting {
        setName() { return this; }
        setDesc() { return this; }
        addText() { return this; }
        addToggle() { return this; }
        addTextArea() { return this; }
    },
    MarkdownRenderer: {
        render: async () => {}
    },
    Modal: class Modal {
        constructor() {}
        open() {}
        close() {}
    },
    Notice: class Notice {
        constructor(msg) { console.log('Notice:', msg); }
    }
};

// Mock global context for eval
global.module = {};
global.exports = {};

// Evaluate the plugin code to get access to the formatter
eval(pluginCode);

// Access the SlackFormatter class from the evaluated code
const formatter = new this.SlackFormatter({
    userMapJson: '{}',
    emojiMapJson: '{}',
    detectCodeBlocks: true,
    convertUserMentions: true,
    replaceEmoji: true,
    parseSlackTimes: true,
    highlightThreads: true,
    convertSlackLinks: true,
    debug: true
});

// Read the test conversation
const testText = fs.readFileSync(path.join(__dirname, '..', 'test-slack-conversation.txt'), 'utf8');

console.log('=== Testing Slack Formatter ===\n');
console.log('Input text length:', testText.length, 'characters\n');

// Format the text
const result = formatter.format(testText);

console.log('=== Formatted Result ===\n');
console.log(result);

// Save the result for inspection
fs.writeFileSync(path.join(__dirname, '..', 'test-result.md'), result);
console.log('\n=== Result saved to test-result.md ===');