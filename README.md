## README.md

Below is a suggested **README.md** for your repository, incorporating all the latest features and instructions:

```md
# Slack Formatter Plugin for Obsidian

**A feature-rich plugin that converts Slack conversations into clean, Markdown-formatted callouts in Obsidian.**  

- Detects user/time pairs  
- Converts `@username` to `[[username]]` links  
- Transforms `<https://url|Text>` into `[Text](url)`  
- Converts code fences ```` ```js ````  
- Parses dates (`Feb 2, 2025`) and times (`10:25 AM`)  
- Links Slack threads if a Slack archive URL is present  
- Optional emoji replacement (`:smile:` → 😄)  
- Configurable limit to avoid performance issues with huge pastes

## Features

1. **Hotkeys**  
   - **Default**: `Cmd+Shift+V` (macOS) or `Ctrl+Shift+V` (Windows/Linux) to paste and format.  
   - **Option**: Intercept normal `Cmd+V` if Slack text is detected.

2. **Callout-Style Messages**  
   Each Slack message is turned into an Obsidian [callout](https://help.obsidian.md/How+to/Use+callouts), like:
   ```md
   > [!quote] [[Alice]] [time:: 2025-02-05 09:15 AM]
   > Hello! This is a Slack message.
   ```

3. **Slack Metadata Filtering**  
   Skips lines like "joined", "left", "NEW", or "View thread" (optionally linking the thread if a URL is available).

4. **User & Channel Mapping**  
   - `<@U123ABC>` can become `[[Alice]]` if specified in `User Map (JSON)`.  
   - Channels like `C01234` can be mapped to `#general` in the **Channel Map**.

5. **Emoji Map**  
   - Convert `:smile:` to 😄 or `:thumbsup:` to 👍 using a user-defined JSON map.

6. **Code Block Handling**  
   - Detects lines starting with ```` ``` ```` (with optional language) and preserves them as Obsidian code fences.

7. **Date & Time Parsing**  
   - Detect lines like `Feb 2, 2025` to set a “current date” for subsequent times (`10:25 AM`).  
   - Final timestamps appear as `YYYY-MM-DD HH:mm AM/PM` in `[time:: ...]` for Dataview queries.

8. **Large Paste Protection**  
   - A **Max Lines** setting truncates extremely large Slack logs to avoid performance issues.

## Installation

### 1. From Source (Developers)
1. Clone the repository:
   ```bash
   git clone https://github.com/amittell/obsidian-slack-formatter.git
   ```
2. Install dependencies:
   ```bash
   cd obsidian-slack-formatter
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Copy or symlink the compiled `main.js` and `manifest.json` (and `styles.css` if present) into your Vault’s `.obsidian/plugins/obsidian-slack-formatter/` folder.

### 2. Manual Installation
1. Download the latest release files (`main.js` and `manifest.json`) from this repo (or build them yourself).
2. Place them in a new folder:  
   ```
   YOUR_VAULT/.obsidian/plugins/obsidian-slack-formatter/
   ```
3. In Obsidian, go to **Settings → Community Plugins**, disable “Safe mode” if necessary, and **enable** “Slack Formatter Plugin”.

## Configuration

Open **Settings → Community Plugins → Slack Formatter Plugin**. The following options are available:

- **Hotkey Behavior**  
  - `Cmd+Shift+V (default)` – Trigger the format command manually.  
  - `Intercept Cmd+V` – Automatically detect Slack text and convert it on normal paste.  
- **Detect & Preserve Code Blocks**  
  - If enabled, lines with triple backticks ```` ``` ```` become code fences in Markdown.  
- **`@username => [[username]]`**  
  - Converts any `@alice` mention into `[[alice]]`.  
- **Convert `:emoji:` => actual emoji**  
  - Use a user-editable JSON map to transform Slack emojis to Unicode.  
- **Parse Slack Times & Dates**  
  - If enabled, lines like `10:25 AM` are combined with any detected date line (`Feb 2, 2025`) to produce a full date/time.  
- **Highlight Slack Threads**  
  - If Slack text references “View thread” or “replies,” the plugin can generate a clickable link if an archive URL is included, or note `(no link)` otherwise.  
- **Max lines to process**  
  - Prevents performance issues. E.g., if you set `20000`, any paste exceeding 20,000 lines is truncated.

### JSON Maps
**User Map (JSON)**  
Example:
```json
{
  "U123ABC": "Alice",
  "UXYZ987": "Bob"
}
```
Slack text `<@U123ABC>` → `[[Alice]]`.

**Channel Map (JSON)**  
```json
{
  "C01234": "general",
  "C99988": "random"
}
```
Slack thread archives with `C01234` become “#general” in the link label.

**Emoji Map (JSON)**  
```json
{
  "smile": "😄",
  "thumbsup": "👍"
}
```
Any `:smile:` is replaced with `😄`.

## Usage

1. **Copy Slack conversation** from your Slack client or web app.  
2. In Obsidian, either:
   - Press the **hotkey** you configured (default `Cmd+Shift+V`).  
   - Or **Cmd+V** (if interception is enabled).  
3. Your Slack text is converted into Markdown callouts, with user/time blocks, links, emojis, code fences, etc.

## Example

**Raw Slack snippet:**
```
February 5th, 2025
Alice (Datadog)
10:25 AM
Hey team, just deployed to staging
Bob
10:27 AM
@Alice Great! Let's test it thoroughly
View thread <https://workspace.slack.com/archives/C01234/p1675601254.000400>
```

**Result in Obsidian:**
```md
> [!quote] [[Alice]] [time:: 2025-02-05 10:25 AM]
> Hey team, just deployed to staging

> [!quote] [[Bob]] [time:: 2025-02-05 10:27 AM]
> [[Alice]] Great! Let's test it thoroughly

- [Thread in #general at 1675601254.000400](https://workspace.slack.com/archives/C01234/p1675601254.000400)
```

## Troubleshooting

- **Plugin Not Loading**:  
  Restart Obsidian and ensure you have placed `main.js` and `manifest.json` in the correct folder, then enable under **Settings → Community Plugins**.  
- **Formatting Issues**:  
  Check Obsidian’s console (`Ctrl+Shift+I` or `Cmd+Opt+I`) for errors.  
- **Clipboard Permissions**:  
  If you see an error about “Clipboard API not available,” ensure Obsidian has permission to read your clipboard.  
- **Truncated Pasting**:  
  If you pasted an extremely large Slack log, the plugin truncates after the configured **Max lines**. Increase the limit in **Settings** if needed.

## Contributing

Pull requests and feature suggestions are welcome. If you have a large Slack export or specific use cases, feel free to test and share logs to improve detection and parsing.

## License

[MIT](LICENSE)
```

---

### Notes on the Updated README

- We integrated **all** the plugin’s features in a clear structure (Installation, Configuration, Usage, Examples, Troubleshooting).  
- The example shows how a real Slack snippet transforms.  
- We reference how to build from source and how to install manually, covering the typical Obsidian plugin workflow.

With this updated code (including a user-configurable **maxLines**) and README, your Slack Formatter Plugin is now well-documented, user-friendly, and ready for advanced Slack -> Obsidian conversions! Enjoy.
