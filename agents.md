# TabTree - Implementation Notes

## Overview

TabTree is a Chrome extension that visualizes browsing history as a tree. This document captures implementation details, architecture decisions, and context for future development.

**Version:** 0.1.0
**Status:** Stable, feature-complete for MVP
**Tech Stack:** Vanilla JavaScript, Canvas API, IndexedDB, Chrome Extension Manifest V3

---

## Architecture

### File Structure

```
tabtree/
├── manifest.json              # Extension configuration (Manifest V3)
├── background/
│   └── service-worker.js      # Tracks navigation events, manages data
├── storage/
│   └── db.js                  # IndexedDB operations and data model
├── tree/
│   ├── layout.js              # Tree layout algorithm (positioning nodes)
│   └── renderer.js            # Canvas rendering engine
├── newtab/
│   ├── newtab.html            # New tab page entry point
│   ├── newtab.js              # Main application logic
│   ├── newtab.css             # Styles for UI
│   └── summarizer.js          # AI summarization (Chrome AI + heuristic fallback)
└── icons/                     # Extension icons (16, 48, 128px)
```

### Data Flow

```
Browser Navigation Event
        ↓
service-worker.js (tracks event)
        ↓
db.js (stores in IndexedDB)
        ↓
newtab.js (loads on new tab)
        ↓
layout.js (calculates positions)
        ↓
renderer.js (draws on canvas)
```

---

## Core Concepts

### Simplified Branching Model

**Original Plan:** Nested parent-child relationships between tabs
**Final Implementation:** Flat model where each tab is an independent column

**Rationale:** User feedback indicated the nested model was too complex. The flat "tab = column" model is more intuitive and matches mental model of browser tabs.

**Current Rules:**
- Each tab gets its own branch/column
- Pages within a tab are linked chronologically (parent-child within branch)
- Tabs are sorted by creation time (oldest left, newest right)

### Data Model

#### Node (Page Visit)
```javascript
{
  id: string,           // UUID
  url: string,          // Page URL
  title: string,        // Page title
  favicon: string,      // Favicon URL (chrome-extension://.../pageUrl=...)
  timestamp: number,    // Visit time (milliseconds)
  tabId: number,        // Chrome tab ID
  branchId: string,     // Which branch/tab this belongs to
  parentNodeId: string  // Previous node in same branch (null if first)
}
```

#### Branch (Tab)
```javascript
{
  id: string,           // UUID
  parentNodeId: null,   // Always null (flat model)
  tabId: number,        // Chrome tab ID
  createdAt: number,    // Tab creation time
  isTrunk: true,        // Always true (every tab is a trunk)
  customTitle: string,  // User-set title (optional)
  summary: string       // AI-generated or heuristic summary (optional)
}
```

#### Tab Mapping (Ephemeral)
```javascript
{
  tabId: number,        // Chrome tab ID (key)
  branchId: string      // Current branch for this tab
}
```

**Note:** Tab mappings are cleared on browser restart since Chrome tab IDs aren't persistent.

---

## Key Algorithms

### Layout Algorithm (tree/layout.js)

**Input:** Nodes, branches, viewport width, open tab IDs
**Output:** Positioned nodes and headers with coordinates

**Process:**
1. Sort branches by creation time (oldest = leftmost)
2. Assign each branch a fixed X position (column)
3. Sort nodes by timestamp (newest first)
4. Assign Y positions chronologically (newest at top)
5. Build connections between parent-child nodes within same branch
6. Generate branch headers with positioning

**Column Positioning:**
```javascript
X = LEFT_MARGIN + columnIndex * (NODE_WIDTH + HORIZONTAL_GAP)
```

**Time Positioning:**
```javascript
Y = HEADER_HEIGHT + VERTICAL_GAP + nodeIndex * (NODE_HEIGHT + VERTICAL_GAP)
```

**Constants:**
- NODE_WIDTH: 280px
- NODE_HEIGHT: 60px
- VERTICAL_GAP: 16px
- HORIZONTAL_GAP: 28px
- LEFT_MARGIN: 40px (for time labels)
- HEADER_HEIGHT: 85px

### Compression Logic

**When:** Only compress if columns < max visible AND content doesn't fit viewport

**Max Visible Columns (Responsive):**
- Desktop (>1600px): 6 columns
- Laptop (>1200px): 4 columns
- Tablet (>768px): 3 columns
- Mobile: 1 column

If more columns than max visible, **don't compress** - let them overflow horizontally.

### Timeline Background (tree/renderer.js)

**15-Minute Bands:**
- Draw horizontal line every 15 minutes based on node timestamps
- Opacity: `rgba(0,0,0,0.15)` for visibility
- Calculated by finding closest node to each time interval

**Epoch Gradient:**
```javascript
Recent (< 1hr):     rgba(0,0,0,0.01)  // Almost white
Today (< 24hr):     rgba(0,0,0,0.02)  // Very light gray
This Week (< 7d):   rgba(0,0,0,0.035) // Light gray
Older (> 7d):       rgba(0,0,0,0.05)  // Medium gray
```

**Labels (Screen Space):**
- Rendered after coordinate transforms to avoid fading
- Epoch labels: 14px, bold, every epoch boundary
- Time labels: 12px, every hour

### Auto-Pan on Scroll

**Goal:** Automatically reveal columns as you scroll through time

**Implementation:**
1. On vertical scroll, calculate visible Y range
2. Find columns with nodes in that Y range
3. If leftmost visible column is off-screen left (threshold: 100px), pan left
4. If rightmost visible column is off-screen right, pan right
5. Use easing (20% per frame) to smooth the motion

**Threshold:** 100px prevents stuttering from tiny adjustments

### Sticky Headers

**Goal:** Keep column headers visible when scrolled past

**Implementation:**
1. For each header, check if it's above viewport
2. If yes, find topmost visible node in that branch
3. Reposition header above that node (Y - HEADER_HEIGHT - 10px)
4. Works same as closed tab headers

### Closed Tab Detection

**Process:**
1. On render, query Chrome for currently open tabs: `chrome.tabs.query({})`
2. Build set of open tab IDs
3. In layout, mark branches as closed if `!openTabIds.has(branch.tabId)`
4. Closed tab headers:
   - Show "CLOSED" badge
   - Reposition above topmost visible node

---

## Summarization System

### Two-Tier Approach

**Tier 1: Chrome AI (Gemini Nano)**
- Check if `window.ai.summarizer` exists
- Create summarizer with: `type: 'key-points', format: 'plain-text', length: 'short'`
- Feed page titles as numbered list
- Extract first 2 sentences
- **Availability:** Extremely limited (requires Chrome Canary + flags)

**Tier 2: Heuristic Fallback**
- Extract keywords from page titles (filter stop words, numbers)
- Count word frequencies
- Detect patterns:
  - "documentation", "docs", "guide", "tutorial" → "Reading documentation"
  - "github", "repository", "code" → "Reviewing code"
  - "shop", "buy", "price" → "Shopping"
  - "news", "article" → "Reading news"
  - Single domain + multiple pages → "Browsing [domain]"
- Generate contextual summary with page count

**Example Outputs:**
- "Reading documentation (5 pages)"
- "Researching react, hooks, state"
- "Shopping (3 pages)"
- "Browsing github"

### Implementation (newtab/summarizer.js)

```javascript
// AI attempt
if (isSummarizerAvailable()) {
  summary = await generateSummary(pages);
}

// Fallback
if (!summary) {
  summary = generateHeuristicSummary(pages);
}
```

**Update Trigger:** On page load, check all branches without summaries and generate them.

---

## Canvas Rendering

### Coordinate System

**World Space:** Absolute positions where nodes live
**Screen Space:** Viewport coordinates after transform

**Transform:**
```javascript
ctx.translate(offsetX, offsetY);  // Pan offset
ctx.scale(scale, scale);          // Zoom (always 1.0 in current impl)
```

**Note:** Scale locked at 1.0. Original design had zoom, but user preferred natural scrolling.

### Rendering Order (Back to Front)

1. **Timeline Background** (world space)
   - Epoch gradient regions
   - 15-minute band lines

2. **Branch Rails** (world space)
   - Vertical colored background columns

3. **Connections** (world space)
   - Lines between parent-child nodes

4. **Nodes** (world space)
   - Favicon, title, timestamp

5. **Headers** (world space)
   - Title, summary, CLOSED badge

6. **Timeline Labels** (screen space)
   - Epoch labels, time labels on left

7. **Scroll Cues** (screen space)
   - Column counter, arrows, fade effects

### Hover Detection

**Hit Testing:**
```javascript
// Convert screen coords to world coords
worldX = (screenX - offsetX) / scale;
worldY = (screenY - offsetY) / scale;

// Check if inside node bounds
if (worldX >= node.x && worldX <= node.x + node.width &&
    worldY >= node.y && worldY <= node.y + node.height) {
  // Hit!
}
```

### Performance

- **Favicon Caching:** Map of URL → Image, loaded async
- **Hover Debouncing:** Only re-render when hover state changes
- **Visible Filtering:** Only render timeline labels in viewport
- **No Virtual Scrolling:** Canvas handles 10,000+ nodes efficiently without culling

---

## Chrome Extension APIs Used

### Background Service Worker

**webNavigation API:**
- `onCommitted`: Main navigation events (page loads)
- `onHistoryStateUpdated`: SPA navigation (single-page apps)
- Filter: `frameId === 0` (main frame only)

**tabs API:**
- `onRemoved`: Clean up tab mappings when tabs close

**Permissions Required:**
```json
"permissions": ["tabs", "webNavigation", "storage"]
```

### New Tab Page

**tabs API:**
- `chrome.tabs.query({})`: Get currently open tabs for closed detection

**favicon API:**
- `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${url}&size=32`
- Built-in Chrome API for fetching favicons

---

## Design Decisions

### Why Canvas Instead of SVG?

- **Performance:** Canvas handles 10,000+ nodes smoothly
- **Custom rendering:** Full control over timeline background and effects
- **Lower memory:** No DOM nodes for each history item

**Trade-off:** Can't use CSS for styling, must implement hover states manually

### Why Flat Branching Instead of Nested?

- **User feedback:** "Too complex, everything connecting to the right"
- **Mental model:** Users think of tabs as independent, not nested
- **Simplicity:** Easier to understand "tab = column"

### Why 15-Minute Bands?

- **Balance:** Visible enough to show progression, not too cluttered
- **Hourly labels:** Every 4 bands (60 min / 15 min = 4)
- **User request:** "Make bands more obvious"

### Why No Zoom?

- **User preference:** "Natural scrolling" feels better than pinch-zoom
- **Simplicity:** One less interaction to learn
- **Focus:** Vertical scroll = time, horizontal scroll = columns

---

## Known Issues & Limitations

### Tab ID Persistence

**Problem:** Chrome tab IDs reset on browser restart
**Impact:** Tabs from previous session show as "CLOSED"
**Workaround:** Could implement session detection, but adds complexity

### AI Availability

**Problem:** Chrome AI not widely available (requires Canary + flags)
**Solution:** Heuristic fallback provides useful summaries
**Future:** When Chrome AI launches, users get automatic upgrade

### Incognito Tracking

**By Design:** Extension doesn't request incognito permission
**Rationale:** Privacy-focused, no tracking of sensitive browsing

### Memory with Large History

**Current:** No issues up to 10,000+ nodes
**Future:** Could implement virtual scrolling if needed (render only visible nodes)

---

## Testing Checklist

- [ ] Basic tracking: Open tabs, navigate, see history
- [ ] Timeline: Bands visible, labels readable, gradient clear
- [ ] Summaries: Heuristic summaries appear (AI optional)
- [ ] Scrolling: Vertical scroll through time, horizontal for columns
- [ ] Auto-pan: Scrolling reveals correct columns
- [ ] Closed tabs: Badge appears, header repositions
- [ ] Sticky headers: Headers follow visible nodes
- [ ] Click navigation: Clicking nodes opens pages
- [ ] Editable headers: Click titles to rename
- [ ] Favicon loading: Real favicons appear (or placeholders)
- [ ] Browser restart: Data persists, tabs marked as closed
- [ ] Clear data: Chrome's clear browsing data removes history

---

## Future Enhancements (Post-MVP)

### High Priority
- Search/filter by URL, title, or date
- Export tree as image or JSON
- Delete individual branches
- Keyboard navigation (arrow keys)

### Medium Priority
- Collapsible branches (fold/unfold)
- Session labels and colors
- Time-spent metrics per page
- Dark mode support

### Low Priority
- Cross-device sync (requires server)
- Thumbnail previews
- Analytics dashboard
- Chrome Web Store listing

---

## Development Notes

### Adding a New Feature

1. **Data Model:** Update `storage/db.js` if new fields needed
2. **Layout:** Modify `tree/layout.js` for positioning logic
3. **Rendering:** Update `tree/renderer.js` for visual changes
4. **Events:** Add tracking in `background/service-worker.js`
5. **UI:** Wire up in `newtab/newtab.js`

### Debugging Tips

- **Console logging:** Check background service worker console separately
- **IndexedDB:** Use Chrome DevTools → Application → IndexedDB → tabtree
- **Canvas debugging:** Add `console.log` in render methods (avoid in loops)
- **Performance:** Use Chrome DevTools → Performance → Record

### Code Style

- Vanilla JavaScript (ES6+)
- No external dependencies
- Async/await for promises
- Comments for non-obvious logic
- Constants at top of files

---

## Version History

### v0.1.0 (2026-01-08)
First stable release with complete feature set:
- Tree visualization with timeline
- AI + heuristic summaries
- Horizontal scrolling with auto-pan
- Sticky headers and closed tab detection
- Timeline bands and epoch markers
- Editable column titles
- Light minimalist design

---

*This document should be updated as implementation evolves. Include gotchas, lessons learned, and context for future developers.*
