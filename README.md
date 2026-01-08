# Canopy

A Chrome extension that visualizes your browsing history as a branching tree instead of a linear list.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `canopy` directory
5. Open a new tab to see your browsing tree

## How It Works

- **New tab** = Creates a new branch from the page that opened it
- **Click a link** = Adds a node to the current branch
- **Navigate in same tab** = Extends the current branch
- **Open new tab page** = View your browsing tree

## Features

- Vertical timeline with newest activity at top
- Horizontal branching shows tab relationships
- Pan and zoom to navigate the tree
- Click any node to revisit that page
- Dark/light mode support

## Development

The extension is built with vanilla JavaScript and uses:
- Canvas API for rendering
- IndexedDB for local storage
- Chrome Extension Manifest V3

See `agents.md` for the full product requirements document.
