# Canopy

A Chrome extension that visualizes your browsing history as a tree, making it easy to understand how you explored the web across different tabs over time.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Chrome](https://img.shields.io/badge/chrome-120%2B-green.svg)

## Quick Start (For Testers)

### Installation

1. **Download the extension:**
   - Option A: Clone the repo: `git clone git@github.com:mariobollini/canopy.git`
   - Option B: [Download v0.1.0 zip](https://github.com/mariobollini/canopy/archive/refs/tags/v0.1.0.zip)

2. **Load into Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top right corner)
   - Click **"Load unpacked"**
   - Select the `canopy` folder (or unzipped folder)

3. **Start browsing:**
   - The extension starts tracking immediately
   - Open a **new tab** to see your history tree
   - You'll need some browsing history for it to show anything interesting!

### What to Test

**Basic Features:**
- ✅ Open multiple tabs, browse around, then open a new tab - do you see your history?
- ✅ Are pages grouped by tab (columns)?
- ✅ Does scrolling down show older history?
- ✅ Can you click nodes to revisit pages?

**Timeline:**
- ✅ Do you see horizontal bands every 15 minutes?
- ✅ Does the background get darker as you scroll back in time?
- ✅ Are there time labels on the left (e.g., "2:30 PM", "Today", "Yesterday")?

**Summaries:**
- ✅ Does each column have a summary under the title?
- ✅ If you browse docs, does it say "Reading documentation"?
- ✅ If you browse GitHub, does it mention "code" or "repository"?

**Navigation:**
- ✅ Open 7+ tabs - do columns overflow with scroll?
- ✅ Does scrolling down automatically pan to show relevant columns?
- ✅ Can you manually scroll left/right (Shift+wheel or trackpad)?

**Edge Cases:**
- ✅ Close a tab - does it get a "CLOSED" badge?
- ✅ When you scroll down, do column headers follow the visible nodes?
- ✅ Does the extension work after restarting Chrome?

### Known Limitations

- **AI Summaries**: Chrome's built-in AI is experimental. If you see "AI not available", that's normal - the extension falls back to smart keyword extraction.
- **Tab ID Persistence**: After restarting Chrome, tabs from the previous session appear as closed tabs.
- **Incognito Mode**: Extension doesn't track incognito browsing (by design for privacy).

## Features

### 🌳 Tree Visualization
- **Each tab is a column** - see all your tabs side-by-side
- **Vertical timeline** - newest pages at top, scroll down for older history
- **15-minute bands** - horizontal lines show time progression
- **Epoch markers** - "Recent", "Today", "Yesterday", "This Week", "Older"

### 🎯 Smart Summaries
- **AI-powered** (when available) - uses Chrome's built-in Gemini Nano
- **Heuristic fallback** - keyword extraction and pattern detection
- Summaries like: "Reading documentation (5 pages)" or "Researching react, hooks, state"

### 📍 Navigation
- **Horizontal scrolling** - up to 6 columns visible at once (responsive)
- **Auto-pan** - automatically shows relevant columns as you scroll through time
- **Sticky headers** - column titles follow you as you scroll
- **Click to open** - click any node to revisit that page

### ⚡ Interactive Details
- **Relative timestamps** - "2m ago", "1h ago" on each node
- **Editable headers** - click column titles to rename them
- **Closed tab badges** - see which tabs are no longer open
- **Time labels** - hourly timestamps on the left margin

### 🎨 Design
- **Light minimalist** - clean white background, soft colors
- **High contrast** - easy-to-read text and icons
- **Real favicons** - actual site icons, not placeholders
- **Smooth interactions** - 60fps scrolling and panning

## How It Works

### Data Collection
- Tracks page visits using Chrome's `webNavigation` API
- Stores data locally in IndexedDB (nothing leaves your computer)
- Each tab gets a unique branch ID
- Pages in the same tab are linked chronologically

### Visualization
- Canvas-based rendering for smooth performance
- Layout algorithm positions nodes by time (Y-axis) and tab (X-axis)
- Timeline bands drawn every 15 minutes
- Background gradient shifts at epoch boundaries

### Privacy
- ✅ All data stays local (no servers, no cloud)
- ✅ No tracking in incognito mode
- ✅ Can be cleared via Chrome's "Clear browsing data"
- ✅ No analytics or telemetry

## Keyboard Shortcuts

- **Scroll down/up** - Travel through time
- **Shift + Scroll** - Scroll horizontally through columns
- **Drag** - Pan around the tree
- **Click node** - Open that page

## Troubleshooting

**Nothing shows up when I open a new tab:**
- Make sure you've browsed to a few pages first
- Check that the extension is enabled at `chrome://extensions/`
- Look for errors in the browser console (F12)

**Summaries show error messages:**
- Chrome's AI isn't widely available yet (requires Chrome 127+ or Canary)
- The extension falls back to keyword-based summaries automatically
- Enable at `chrome://flags/#optimization-guide-on-device-model` if you want to try AI

**Performance is slow with lots of history:**
- The extension handles 10,000+ nodes efficiently
- Try clearing old history: Chrome Settings → Privacy → Clear browsing data

**Can I export my tree?**
- Not yet! This is on the roadmap for future versions

## Development

Built with vanilla JavaScript:
- **Canvas API** for rendering
- **IndexedDB** for storage
- **Chrome Extension Manifest V3**
- No external dependencies

See `agents.md` for detailed implementation notes.

## Contributing

Found a bug? Have a feature idea?
- Open an issue: https://github.com/mariobollini/canopy/issues
- Or submit a pull request!

## License

MIT License - feel free to use and modify!

---

**Version 0.1.0** - First stable release with timeline visualization
