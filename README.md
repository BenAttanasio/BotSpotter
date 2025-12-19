# BotSpotter 🤖

A Chrome extension that highlights potentially AI-generated text based on common linguistic patterns.

## Features

### Detection
- **Pattern-based detection**: Identifies text containing common AI-generated phrases
- **Customizable patterns**: Add, remove, or modify detection patterns
- **Adjustable sensitivity**: Set how many patterns must match before highlighting
- **Dynamic detection**: Automatically scans new content as pages update

### Highlighting
- **Three highlight styles**: Background color, border, or underline
- **Color picker with presets**: Choose from 10 curated colors or pick your own
- **Adjustable opacity**: Fine-tune highlight visibility
- **Optional AI badge**: Small indicator on detected content

### Settings
- **Domain exclusions**: Disable detection on specific websites
- **Settings persistence**: Your preferences are saved across sessions
- **Import/Export**: Backup and restore your settings
- **Reset to defaults**: Easily restore original settings

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder

## Usage

### Popup Controls
- **Toggle**: Enable/disable detection
- **Color presets**: Click a color swatch to quickly change highlight color
- **Custom color**: Use the color picker or enter a hex code
- **Opacity slider**: Adjust highlight transparency
- **Style options**: Choose between background, border, or underline highlighting
- **Rescan**: Re-analyze the current page

### Options Page
Access via the popup's "Settings" button or right-click the extension icon > Options

- **Detection Patterns**: Add or remove phrases to look for
- **Sensitivity**: Require multiple pattern matches before highlighting
- **Show Badge**: Toggle the "AI" indicator on detected content
- **Excluded Domains**: Add websites where detection should be disabled
- **Backup/Restore**: Export settings to JSON or import from a backup

## Default Detection Patterns

The extension looks for these commonly AI-generated phrases:
- "isn't just about"
- "—it's about"
- "more than just"
- "; it's a"
- "it's important to"
- "dive into" / "delve into"
- "in today's world"
- "landscape"
- "navigate"
- "foster"
- "leverage"
- "in conclusion"
- "it's worth noting"
- "I cannot and will not"
- "boundaries"
- "I cannot provide"
- "I cannot assist"

## Privacy

- All detection happens locally in your browser
- No data is sent to external servers
- Settings are stored in Chrome's sync storage (syncs across your Chrome profile)

## Version History

### v1.1.0
- Added color picker with preset swatches
- Added adjustable opacity
- Added multiple highlight styles (background, border, underline)
- Added domain exclusion feature
- Added sensitivity settings
- Added import/export functionality
- Improved settings persistence
- Changed default color to subtle light yellow (#fffde7)
- Fixed pattern syncing between storage and content script
- Added rescan button
- Improved UI/UX

### v1.0.0
- Initial release
- Basic pattern detection
- Simple highlight functionality

## License

MIT License - See LICENSE file for details
