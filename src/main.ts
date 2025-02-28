/**
 * Obsidian Slack Formatter Plugin
 * @version 0.0.8
 * Author: Alex Mittell
 * 
 * Formats Slack conversations pasted into Obsidian
 */
import { Plugin, Editor, Notice, Menu, MenuItem, Platform } from 'obsidian';
import { SlackFormatter } from './formatter';
import { SimpleSlackFormatter } from './formatter/simple-formatter';
import { SlackFormatSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { SlackFormatSettingTab } from './ui/settings-tab';

export default class SlackFormatPlugin extends Plugin {
	settings: SlackFormatSettings;
	formatter: SlackFormatter;

	async onload() {
		console.log('Loading Slack formatter plugin v0.0.8');

		// Load settings
		await this.loadSettings();

		// Initialize formatter
		this.initFormatter();

		// Add settings tab
		this.addSettingTab(new SlackFormatSettingTab(this.app, this));

		// Register paste handler command for palette
		this.addCommand({
			id: 'format-slack',
			name: 'Format Slack paste',
			icon: 'clipboard-list',
			editorCallback: async (editor: Editor) => {
				const clipboardContent = await navigator.clipboard.readText();
				this.formatAndInsert(editor, clipboardContent);
			}
		});

		// Add paste handler for Cmd+Shift+V
		this.registerEvent(
			this.app.workspace.on(
				'editor-paste',
				this.handlePasteEvent.bind(this)
			)
		);

		// Add the context menu command
		this.registerEvent(
			this.app.workspace.on(
				'editor-menu',
				(menu: Menu, editor: Editor) => {
					menu.addItem((item: MenuItem) => {
						item
						.setTitle('Format as Slack conversation')
						.setIcon('clipboard-list')
						.onClick(async () => {
							// If there's a selection, format just that
							const selection = editor.getSelection();
							if (selection) {
								this.formatAndInsert(editor, selection);
							} else {
								// Otherwise try to get from clipboard
								const clipboardContent = await navigator.clipboard.readText();
								this.formatAndInsert(editor, clipboardContent);
							}
						});
					});
				}
			)
		);
	}

	/**
	 * Initialize the formatter with current settings
	 */
	private initFormatter() {
		try {
			// Parse JSON maps from settings
			const userMap = this.parseJsonMap(this.settings.userMapJson);
			const emojiMap = this.parseJsonMap(this.settings.emojiMapJson);
			const channelMap = this.parseJsonMap(this.settings.channelMapJson);

			// Initialize the formatter with settings and maps
			this.formatter = new SlackFormatter(
				this.settings,
				userMap,
				emojiMap,
				channelMap
			);
			
			console.log("Slack formatter initialized successfully");
		} catch (error) {
			console.error("Error initializing formatter:", error);
			new Notice("Failed to initialize Slack formatter. Check settings.");
		}
	}

	/**
	 * Parse a JSON string into a map safely
	 */
	private parseJsonMap(jsonStr: string): Record<string, string> {
		try {
			if (!jsonStr || jsonStr.trim() === '') return {};
			return JSON.parse(jsonStr);
		} catch (e) {
			console.error("Failed to parse JSON map:", e);
			return {};
		}
	}

	/**
	 * Parse the JSON maps from settings
	 * This method is called from settings UI
	 */
	public parseJsonMaps() {
		this.initFormatter();
	}

	/**
	 * Handle paste events with modifier keys
	 */
	private handlePasteEvent(evt: ClipboardEvent, editor: Editor) {
		try {
			// Check specifically for Cmd+Shift+V (Mac) or Ctrl+Shift+V (Windows/Linux)
			const isCmdShiftV = (Platform.isMacOS && evt.metaKey && evt.shiftKey) || 
								(!Platform.isMacOS && evt.ctrlKey && evt.shiftKey);
			
			if (isCmdShiftV) {
				// Always intercept Cmd+Shift+V regardless of settings
				evt.preventDefault();
				
				// Get the clipboard text
				if (evt.clipboardData) {
					const text = evt.clipboardData.getData('text/plain');
					if (text) {
						// Always attempt to format the text, even if it doesn't look like Slack
						this.formatAndInsert(editor, text);
						return;
					}
				} else {
					console.log("No clipboard data available");
				}
			}
			
			// If interceptPaste is true and it's just Cmd+V with no Shift, 
			// we still need to check if it's Slack content
			if (this.settings.interceptPaste && 
				((Platform.isMacOS && evt.metaKey && !evt.shiftKey) || 
				(!Platform.isMacOS && evt.ctrlKey && !evt.shiftKey))) {
				
				if (evt.clipboardData) {
					const text = evt.clipboardData.getData('text/plain');
					if (text && this.formatter.isLikelySlack(text)) {
						evt.preventDefault();
						this.formatAndInsert(editor, text);
					}
				}
			}
		} catch (error) {
			console.error("Error in paste handler:", error);
			new Notice("Error handling paste event");
		}
	}

	/**
	 * Format text and insert it into the editor
	 */
	formatAndInsert(editor: Editor, text: string) {
		try {
			if (!text) {
				new Notice('No text to format');
				return;
			}

			// Format using the main formatter
			let formatted = this.formatter.formatSlackContent(text);

			// Insert into editor
			editor.replaceSelection(formatted);

			// Show success message
			if (this.settings.showSuccessMessage) {
				new Notice('Slack message formatted!');
			}
		} catch (error) {
			console.error("Error formatting text:", error);
			new Notice('Error formatting Slack text');
		}
	}

	/**
	 * Format with YAML frontmatter
	 */
	formatWithFrontmatter(text: string): string {
		return this.formatter.buildNoteWithFrontmatter(text);
	}

	onunload() {
		console.log('Unloading Slack formatter plugin');
	}

	async loadSettings() {
		try {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		} catch (error) {
			console.error("Error loading settings:", error);
			this.settings = { ...DEFAULT_SETTINGS };
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Reinitialize formatter with new settings
		this.initFormatter();
	}
}
