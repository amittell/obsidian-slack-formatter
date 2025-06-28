# Slack Paste Formatter

An Obsidian plugin that transforms copied Slack conversations into beautifully formatted Obsidian callouts with support for user mentions, timestamps, emojis, code blocks, and thread management.

## Features

- **Smart Format Detection**: Automatically detects Slack conversation format (DMs, channels, threads)
- **User Mention Conversion**: Transforms `@username` mentions into Obsidian `[[username]]` links
- **Custom Emoji Support**: Replaces Slack custom emojis with Unicode equivalents or configured mappings
- **Code Block Preservation**: Maintains Slack code formatting with proper Markdown syntax
- **Timestamp Parsing**: Converts Slack timestamps to readable format with timezone support
- **Thread Management**: Collapsible thread support with configurable thresholds
- **Link Processing**: Converts Slack links to proper Markdown format
- **Preview Mode**: Optional preview pane before inserting formatted content
- **Multiple Input Methods**: Hotkey, command palette, and context menu integration

## Installation

### Manual Installation

1. Download the latest release from the releases page
2. Extract the plugin files to your Obsidian vault's plugins folder: `VaultFolder/.obsidian/plugins/slack-formatter/`
3. Enable the plugin in Obsidian's Community Plugins settings

### Development Installation

1. Clone this repository into your vault's plugins folder
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Enable the plugin in Obsidian

## Usage

### Quick Start

1. Copy a Slack conversation to your clipboard
2. In Obsidian, use one of these methods:
   - Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)
   - Open Command Palette and run "Format Slack paste"
   - Right-click in editor and select "Format as Slack conversation"
3. The conversation will be formatted as Obsidian callouts

### Input Format

The plugin accepts raw Slack conversation text like this:

```
User1
  3:13 PM
Hello chaps! Happy March!
3:13
Wanted to get your feedback on my update

User2
:face_with_thermometer:  3:14 PM
hi @user1 will look at it in a bit
```

### Output Format

The formatted output appears as Obsidian callouts:

```markdown
> [!slack]+ Message from User1
> **Time:** 3:13 PM
> Hello chaps! Happy March!
> Wanted to get your feedback on my update

> [!slack]+ Message from User2
> **Time:** 3:14 PM
> 🤒 hi [[user1]] will look at it in a bit
```

## Configuration

Access plugin settings through Settings → Community Plugins → Slack Formatter.

### Core Features

- **Detect Code Blocks**: Preserve Slack code formatting (default: enabled)
- **Convert User Mentions**: Transform @mentions to [[links]] (default: enabled)
- **Replace Emoji**: Convert custom emojis to Unicode (default: enabled)
- **Parse Slack Times**: Convert timestamps to readable format (default: enabled)
- **Highlight Threads**: Add special formatting for thread replies (default: enabled)
- **Convert Slack Links**: Process Slack link format (default: enabled)

### User Interface

- **Hotkey Mode**: Choose between `Cmd+Shift+V` or intercept regular `Cmd+V`
- **Preview Pane**: Show preview before inserting (default: enabled)
- **Confirmation Dialog**: Ask before formatting when auto-detecting (default: enabled)
- **Success Message**: Show notification after formatting (default: enabled)

### Thread Management

- **Collapse Threads**: Enable collapsible thread formatting (default: enabled)
- **Thread Collapse Threshold**: Minimum replies before collapsing (default: 10)

### Advanced Configuration

- **Max Lines**: Maximum lines to process (default: 5000)
- **Timezone**: Custom timezone for timestamp conversion
- **CSS Class**: Custom CSS class for frontmatter (default: "slack-conversation")
- **Title Format**: Custom title format (default: "# Slack Conversation")

### Custom Mappings

#### User Mapping

Map Slack user IDs to display names:

```json
{
  "U07JC6P29UM": "Alex Smith",
  "U12345678": "John Doe"
}
```

#### Emoji Mapping

Define custom emoji replacements:

```json
{
  "bufo-ty": "🙏",
  "bufo-thinking": "🤔",
  "custom-emoji": "🎉"
}
```

## Use Cases

### Meeting Notes

Format Slack discussions for meeting documentation:

- Preserve participant names and timestamps
- Convert mentions to proper links
- Maintain thread structure for Q&A sections

### Project Documentation

Archive important Slack conversations:

- Technical discussions with code blocks
- Decision-making processes
- Stakeholder feedback

### Knowledge Management

Transform Slack knowledge sharing into permanent notes:

- Expert advice and solutions
- Process explanations
- Reference materials

## Troubleshooting

### Common Issues

**Plugin not working after paste**

- Check if the text is recognized as Slack format
- Verify hotkey mode settings
- Try using the Command Palette instead

#### User mentions not converting

- Configure User Mapping in settings
- Ensure @ symbol is preserved in copied text

#### Custom emojis not replacing

- Add emoji mappings in Emoji Mapping settings
- Check that emoji names match exactly

#### Timestamps not parsing

- Set correct timezone in settings
- Verify timestamp format in original Slack text

### Performance

The plugin includes built-in performance protections:

- 5MB maximum input size
- 50,000 line processing limit
- Automatic chunking for large conversations
- Memory usage optimization

### Debug Mode

Enable debug mode in settings to:

- See detailed processing logs
- Identify parsing issues
- Report problems with specific conversations

## Contributing

### Development Setup

1. Clone the repository
2. Run `npm install`
3. Run `npm run dev` for development build with watch mode
4. Run `npm test` to run the test suite

### Building

- `npm run build` - Production build
- `npm run analyze` - Build analysis

### Testing

- `npm test` - Run all tests
- `npm test -- --watch` - Watch mode
- Test files are in `/tests` directory with unit, integration, and manual tests

## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: Report bugs or request features on GitHub
- **Documentation**: Check SPEC.md for technical details
- **Community**: Discuss in Obsidian community forums

## Changelog

### Version 0.0.8

- Comprehensive pipeline validation and regression fixes
- Enhanced username processing and boundary detection
- Performance optimizations for large conversations
- Improved thread handling and message parsing
- International character support

---

_Transform your Slack conversations into organized, searchable Obsidian notes with just one keypress._
