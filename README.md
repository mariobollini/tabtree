# Canopy

**See your browsing history as a tree.** Each tab becomes a vertical timeline, showing exactly how you navigated the web. Visualize your research trails, understand your browsing patterns, and never lose track of that page you saw "a few clicks ago."

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Chrome](https://img.shields.io/badge/chrome-120%2B-green.svg)

## Installation

1. **Clone or download:**
   ```bash
   git clone git@github.com:mariobollini/canopy.git
   ```
   Or [download the zip](https://github.com/mariobollini/canopy/archive/refs/tags/v0.1.0.zip)

2. **Load into Chrome:**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `canopy` folder

3. **Start browsing:**
   - The extension tracks automatically
   - Open a new tab to see your history tree
   - The more you browse, the more interesting it gets

## Features

### 🌳 Tree Visualization
Your browsing history laid out spatially:
- **Each tab = one column** - see all your research paths side-by-side
- **Vertical timeline** - newest at top, scroll down to travel back in time
- **Cross-tab connections** - see when you opened new tabs from links
- **Time bands** - horizontal lines every 15 minutes show progression
- **Epoch markers** - "Recent", "Today", "Yesterday" help orient you in time

### ⏱️ Duration Tracking
See what actually mattered:
- **Variable height nodes** - taller pages = more time spent viewing them
- **Visual distinction** - quick clickthroughs (< 10s) are compact, meaningful pages (> 60s) stand out
- **Live duration** - open tabs show real-time viewing duration
- **Smart defaults** - closed tabs get reasonable duration estimates

### 🎯 Smart Summaries
Understand what each tab was about at a glance:
- **AI-powered summaries** - uses Chrome's built-in Gemini Nano when available
- **Keyword extraction** - fallback to smart pattern detection
- Examples: "Reading documentation (5 pages)" or "Researching react, hooks, state"
- **Editable titles** - click any column header to customize

### 📍 Smooth Navigation
Move through your history effortlessly:
- **Auto-pan** - scrolling down automatically shows relevant columns
- **Horizontal scroll** - Shift+wheel to move between tabs
- **Sticky headers** - column titles follow as you explore
- **Click to revisit** - any node opens that page instantly
- **Zoom controls** - in/out/fit buttons for perfect view

### 🎨 Clean Design
- **Minimal interface** - light theme, clean typography, no clutter
- **Real favicons** - actual site icons from your history
- **Smooth 60fps** - canvas-based rendering for fluid interaction
- **Responsive layout** - adapts from 1 to 6 columns based on screen width

### 🔒 Privacy First
- **100% local** - all data stays on your computer (IndexedDB)
- **No servers** - nothing leaves your browser
- **No tracking** - respects incognito mode
- **No telemetry** - zero analytics or phone-home behavior

## How It Works

Canopy uses Chrome's `webNavigation` API to track page visits as they happen. Everything is stored locally in IndexedDB - nothing ever leaves your computer. Each tab gets a unique branch ID, and pages within a tab are linked chronologically to form your browsing tree.

The visualization is rendered on HTML Canvas for smooth 60fps performance. The layout algorithm positions nodes by time (Y-axis) and tab (X-axis), with intelligent auto-panning to keep relevant content in view.

## Usage Tips

- **Scroll down** to travel back in time
- **Shift + scroll** to move between tab columns
- **Drag** to pan around freely
- **Click any node** to revisit that page
- **Click column headers** to rename tabs
- **Hover nodes** to see full URL and view duration

## Tech Stack

Built with vanilla JavaScript:
- Canvas API for rendering
- IndexedDB for local storage
- Chrome Extension Manifest V3
- Zero external dependencies

## FAQ

**Nothing shows up when I open a new tab?**
Browse a few pages first - the extension needs some history to visualize.

**AI summaries not working?**
Chrome's built-in AI (Gemini Nano) isn't widely available yet. The extension automatically falls back to keyword-based summaries.

**Can I export my tree?**
Not yet - coming in a future version!

## Contributing

Found a bug? Want a feature? [Open an issue](https://github.com/mariobollini/canopy/issues) or submit a PR!

## License

MIT - free to use and modify

---

Made by [@mariobollini](https://github.com/mariobollini) • v0.1.0
