# Canopy - Product Requirements Document

## Overview

**Canopy** is a Chrome extension that visualizes browsing history as a branching tree rather than a linear list. It reveals how concepts and pages connect by showing the relationship between tabs and navigation paths.

## Problem Statement

Traditional browser history is presented as a flat, chronological list. This makes it difficult to:
- Understand how you arrived at a particular page
- See the relationship between research branches
- Recall the context of why you opened certain tabs
- Visualize browsing sessions as connected journeys

## Solution

A tree-based visualization where:
- **Vertical axis** = chronological timeline (newest at top, scroll down for older)
- **Horizontal axis** = branching structure showing tab relationships
- Users can see at a glance how their browsing session unfolded and how pages relate

## Core Concepts

### Tree Structure

| Concept | Definition |
|---------|------------|
| **Trunk** | A browsing session or manually typed URL (entry point) |
| **Branch** | A tab - each new tab creates a new branch from its parent |
| **Node** | A single page visit within a tab |

### Branching Rules

1. **New tab from link** → Creates a new branch off the node where the link was clicked
2. **Link clicked in same tab** → Adds a new node to the current branch (extends it)
3. **Returning to a tab after time** → Adds a new node to that existing branch (preserves tab identity while showing recency)
4. **Manually typed URL in new tab** → Creates a new trunk (root-level branch)

### Visual Layout

- **Vertical scrolling**: Time flows vertically; most recent activity at the top
- **Smart width compression**: Branches compress horizontally to fit viewport while remaining readable
- **Nodes display**: Favicon + page title (clean, minimal)

## MVP Features (v1.0)

### Must Have

- [ ] **Tree visualization** on new tab page
  - Vertical timeline layout with newest at top
  - Horizontal branching showing tab relationships
  - Smart compression algorithm for branch width

- [ ] **Node display**
  - Favicon for each page
  - Page title (truncated if needed)
  - Visual indication of current position

- [ ] **Basic interactions**
  - Click node to open that page in current tab
  - Zoom in/out of tree view
  - Pan/scroll to navigate the tree

- [ ] **History tracking**
  - Track new tab creation and parent relationship
  - Track navigation within tabs
  - Track tab switches and activity resumption

- [ ] **Data management**
  - Local storage only (IndexedDB)
  - Retention matches Chrome's history setting
  - Fresh start from installation (no import)

### Explicitly Not in MVP

- Search/filter functionality
- Annotations, tags, or labels
- Thumbnail previews
- Time-spent metrics
- Branch collapsing
- Data export/import
- Cross-device sync
- Incognito tracking (never)

## Technical Requirements

### Platform
- Chrome Extension (Manifest V3)
- Target Chrome version: 120+

### Tech Stack
- **Vanilla JavaScript** - no framework overhead
- **Canvas or SVG** - for tree rendering (evaluate performance)
- **IndexedDB** - for local history storage
- **Chrome APIs**: tabs, history, storage, webNavigation

### Architecture

```
canopy/
├── manifest.json          # Extension manifest (V3)
├── newtab/
│   ├── newtab.html        # New tab page
│   ├── newtab.js          # Tree visualization logic
│   └── newtab.css         # Styles
├── background/
│   └── service-worker.js  # Event tracking, data management
├── storage/
│   └── db.js              # IndexedDB operations
├── tree/
│   ├── renderer.js        # Canvas/SVG rendering
│   ├── layout.js          # Tree layout algorithm
│   └── compression.js     # Width compression logic
└── icons/
    └── ...                # Extension icons
```

### Data Model

```javascript
// Node (page visit)
{
  id: string,              // Unique identifier
  url: string,             // Page URL
  title: string,           // Page title
  favicon: string,         // Favicon URL or data URI
  timestamp: number,       // Visit time (ms since epoch)
  tabId: number,           // Chrome tab ID (for tracking)
  branchId: string,        // Which branch this belongs to
  parentNodeId: string,    // Previous node in branch (or null if first)
}

// Branch (tab)
{
  id: string,              // Unique identifier
  parentNodeId: string,    // Node this branch spawned from (null if trunk)
  tabId: number,           // Chrome tab ID
  createdAt: number,       // When tab was created
  isTrunk: boolean,        // True if this is a root branch
}
```

### Privacy & Security

- **No remote data transmission** - all data stays local
- **No incognito tracking** - extension should not request incognito access
- **No sensitive data capture** - only URLs, titles, favicons
- **User can clear data** - respect Chrome's "Clear browsing data"

### Performance Targets

- New tab page loads in < 500ms
- Smooth 60fps panning/zooming
- Handle 10,000+ nodes without degradation
- Minimal memory footprint when not viewing tree

## User Experience

### New Tab Page

When user opens a new tab:
1. Display tree visualization immediately (cached/progressive render)
2. Most recent activity visible at top without scrolling
3. Current session's branches prominently visible
4. Older history accessible by scrolling down

### Interactions

| Action | Result |
|--------|--------|
| Click node | Navigate to that URL in current tab |
| Scroll | Move up/down timeline |
| Pinch/scroll wheel | Zoom in/out |
| Drag | Pan the view |

### Visual Design Principles

- **Minimal and clean** - focus on the tree, not UI chrome
- **High contrast** - easy to read favicons and titles
- **Responsive** - works on various screen sizes
- **Dark/light mode** - respect system preference

## Success Metrics

For v1.0, success is defined as:
1. Extension installs and runs without errors
2. Tree accurately represents browsing history with correct parent-child relationships
3. Visualization is readable and navigable
4. Performance targets are met
5. No data leaves the user's device

## Future Considerations (Post-MVP)

These are explicitly out of scope for v1.0 but worth considering for future versions:
- Search and filter by URL, title, or date
- Collapse/expand branches
- Session labels and color coding
- Export tree as image or data
- Keyboard navigation
- Branch pruning/deletion
- "Focus mode" showing only one branch

## Open Questions

1. **Compression algorithm**: What's the best approach for compressing branch width while maintaining readability? Options: logarithmic scaling, fisheye distortion, or dynamic based on viewport.

2. **Tab ID persistence**: Chrome tab IDs are not persistent across browser restarts. Need to handle session boundaries gracefully.

3. **Performance threshold**: At what node count should we start virtualizing/culling off-screen nodes?

---

*This document serves as the source of truth for Canopy development. Update as decisions are made.*
