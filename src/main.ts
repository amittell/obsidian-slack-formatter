/**
 * Obsidian Slack Formatter Plugin
 * @version 0.0.8
 * Author: Alex Mittell
 * 
 * Formats Slack conversations pasted into Obsidian
 */
import { Plugin, Editor, Notice, Menu, MenuItem, Platform } from 'obsidian';
import { SlackFormatter } from './formatter/index';
import { DEFAULT_SETTINGS } from './settings';
import { SlackFormatSettingTab } from './ui/settings-tab';
import { ConfirmSlackModal, SlackPreviewModal } from './ui/modals';
import { SlackFormatSettings } from './types';

export default class SlackFormatPlugin extends Plugin {
	settings!: SlackFormatSettings;
	formatter!: SlackFormatter;

	async onload(): Promise<void> {
		console.log('Loading Slack formatter plugin v0.0.8');

		// Load settings
		await this.loadSettings();

		// Initialize formatter
		this.initFormatter();

		// Add settings tab
		this.addSettingTab(new SlackFormatSettingTab(this.app, this));

		// Register specific hotkey for Cmd+Shift+V / Ctrl+Shift+V
		this.addCommand({
			id: 'format-slack-paste-hotkey',
			name: 'Format Slack paste with hotkey',
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "v",
				},
			],
			editorCallback: async (editor: Editor) => {
				console.log("[SlackFormat] Hotkey command triggered");
				const clipboardContent = await navigator.clipboard.readText();
				this.formatAndInsert(editor, clipboardContent);
			}
		});

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

		// Add paste handler for Cmd+Shift+V as backup
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
		
		// Add a direct DOM event listener for the keyboard shortcut as a last resort
		// This is needed because Obsidian might be capturing the event before our handlers
		document.addEventListener('keydown', (e: KeyboardEvent) => {
			// Check for Cmd+Shift+V or Ctrl+Shift+V
			const isCmdShiftV = (Platform.isMacOS && e.metaKey && e.shiftKey && e.key.toLowerCase() === 'v') || 
							   (!Platform.isMacOS && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v');
			
			if (isCmdShiftV) {
				console.log("[SlackFormat] Direct keydown event for Cmd+Shift+V detected");
				
				// Get the active editor if available
				const activeLeaf = this.app.workspace.activeLeaf;
				if (activeLeaf && activeLeaf.view && activeLeaf.view.getViewType() === "markdown") {
					// @ts-ignore - Accessing internal API
					const editor = activeLeaf.view.editor;
					if (editor) {
						e.preventDefault();
						e.stopPropagation();
						
						// Use setTimeout to ensure this runs after any other event handlers
						setTimeout(async () => {
							try {
								const clipboardContent = await navigator.clipboard.readText();
								this.formatAndInsert(editor, clipboardContent);
							} catch (error) {
								console.error("[SlackFormat] Error processing clipboard:", error);
							}
						}, 0);
						
						return false;
					}
				}
			}
			return true;
		}, true); // Using capture phase to get the event before other handlers
	}

	/**
	 * Initialize the formatter with current settings
	 */
	private initFormatter(): void {
		try {
			console.log('Initializing formatter...');
			
			// Parse the JSON maps
			const userMap = this.parseJsonMap(this.settings.userMap);
			const emojiMap = this.parseJsonMap(this.settings.emojiMap);
			const channelMap = this.parseJsonMap(this.settings.channelMap);
			
			// Create formatter
			this.formatter = new SlackFormatter(
				this.settings,
				userMap,
				emojiMap,
				channelMap
			);
			
			console.log("Slack formatter initialized successfully");
		} catch (error) {
			console.error("Error initializing formatter:", error);
			// Initialize with empty maps as fallback
			this.formatter = new SlackFormatter(
				this.settings,
				{}, // empty userMap
				{}, // empty emojiMap
				{}  // empty channelMap
			);
			new Notice("Warning: Initialized formatter with empty maps due to settings error.");
		}
	}

	/**
	 * Parse a JSON string into a map safely
	 */
	private parseJsonMap(jsonStr: string): Record<string, string> {
		try {
			if (!jsonStr || jsonStr.trim() === '') {
				return {};
			}
			return JSON.parse(jsonStr);
		} catch (error) {
			console.error('Failed to parse JSON map:', error);
			return {};
		}
	}

	/**
	 * Parse the JSON maps from settings
	 * This method is called from settings UI
	 */
	public parseJsonMaps(): void {
		this.initFormatter();
	}

	/**
	 * Handle paste events with modifier keys
	 */
	private handlePasteEvent(evt: ClipboardEvent, editor: Editor): void {
		try {
			// Check specifically for Cmd+Shift+V (Mac) or Ctrl+Shift+V (Windows/Linux)
			const metaKey = evt.metaKey;
			const ctrlKey = evt.ctrlKey;
			const shiftKey = evt.shiftKey;
			
			const isCmdShiftV = (Platform.isMacOS && metaKey && shiftKey) || 
								(!Platform.isMacOS && ctrlKey && shiftKey);
			
			// Debug logging to help diagnose issues
			console.log("[SlackFormat] Paste event detected", {
				metaKey,
				shiftKey,
				isMacOS: Platform.isMacOS,
				isCmdShiftV
			});
			
			if (isCmdShiftV) {
				// Always intercept Cmd+Shift+V regardless of settings
				console.log("[SlackFormat] Cmd+Shift+V detected, preventing default");
				evt.preventDefault();
				evt.stopPropagation();
				
				// Get the clipboard text
				if (evt.clipboardData) {
					const text = evt.clipboardData.getData('text/plain');
					if (text) {
						console.log("[SlackFormat] Got clipboard text, length:", text.length);
						// Always attempt to format the text, even if it doesn't look like Slack
						this.formatAndInsert(editor, text);
						return;
					} else {
						console.log("[SlackFormat] No text in clipboard");
					}
				} else {
					console.log("[SlackFormat] No clipboard data available");
				}
			}
			
			// If hotkeyMode is set to interceptCmdV and it's just Cmd+V with no Shift, 
			// we still need to check if it's Slack content
			if (this.settings.hotkeyMode === 'interceptCmdV' && 
				((Platform.isMacOS && metaKey && !shiftKey) || 
				(!Platform.isMacOS && ctrlKey && !shiftKey))) {
				
				if (evt.clipboardData) {
					const text = evt.clipboardData.getData('text/plain');
					if (text && this.formatter.isLikelySlack(text)) {
						// It looks like Slack content, handle based on settings
						evt.preventDefault();
						evt.stopPropagation();
						
						// If confirmation dialog is enabled, show it
						if (this.settings.enableConfirmationDialog) {
							new ConfirmSlackModal(this.app, (confirmed) => {
								if (confirmed) {
									this.formatAndInsert(editor, text);
								} else {
									// Just insert the plain text
									editor.replaceSelection(text);
								}
							}).open();
						} else {
							// No dialog needed, format directly
							this.formatAndInsert(editor, text);
						}
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
	private formatAndInsert(editor: Editor, text: string): void {
		try {
			if (!text) {
				new Notice("No text to format");
				return;
			}
			
			console.log("[SlackFormat] Attempting to format text", text.substring(0, 100) + "...");

			// If preview pane is enabled, show the preview first
			if (this.settings.enablePreviewPane) {
				new SlackPreviewModal(
					this.app, 
					text, 
					(formattedText) => {
						if (formattedText) {
							editor.replaceSelection(formattedText);
						}
					},
					this.formatter
				).open();
				return;
			}
			
			// Otherwise format directly
			const formattedText = this.formatter.formatSlackContent(text);
			editor.replaceSelection(formattedText);
			
			if (this.settings.showSuccessMessage) {
				new Notice("Slack message formatted!");
			}
		} catch (error) {
			console.error("Error formatting text:", error);
			new Notice("Error formatting Slack text");
		}
	}

	/**
	 * Format with YAML frontmatter
	 */
	public formatWithFrontmatter(text: string): string {
		return this.formatter.buildNoteWithFrontmatter(text);
	}

	onunload(): void {
		console.log("Unloading Slack formatter plugin");
	}

	async loadSettings(): Promise<void> {
		try {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		} catch (error) {
			console.error("Error loading settings:", error);
			this.settings = { ...DEFAULT_SETTINGS };
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.initFormatter();
	}
}
