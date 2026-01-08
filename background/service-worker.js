import {
  initDB,
  generateId,
  addNode,
  addBranch,
  getBranch,
  getTabMapping,
  setTabMapping,
  removeTabMapping,
  getLatestNodeForTab
} from '../storage/db.js';

// Initialize database on startup
initDB().then(() => {
  console.log('Canopy: Database initialized');
}).catch(err => {
  console.error('Canopy: Failed to initialize database', err);
});

// Track which tab opened which tab (for parent relationships)
const tabOpeners = new Map();

// Helper to check if URL should be tracked
function shouldTrackUrl(url) {
  if (!url) return false;
  // Skip internal Chrome pages, extension pages, and empty tabs
  if (url.startsWith('chrome://')) return false;
  if (url.startsWith('chrome-extension://')) return false;
  if (url.startsWith('about:')) return false;
  if (url === 'edge://newtab/') return false;
  if (url === '') return false;
  return true;
}

// Helper to get favicon URL
function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    // Use Chrome's favicon service
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
  } catch {
    return null;
  }
}

// Create a new branch (tab)
async function createBranch(tabId, parentNodeId = null, isTrunk = false) {
  const branch = {
    id: generateId(),
    parentNodeId,
    tabId,
    createdAt: Date.now(),
    isTrunk
  };

  await addBranch(branch);
  await setTabMapping(tabId, branch.id);

  console.log('Canopy: Created branch', branch.id, 'for tab', tabId, isTrunk ? '(trunk)' : '');
  return branch;
}

// Create a new node (page visit)
async function createNode(tabId, url, title) {
  let branchId = await getTabMapping(tabId);

  // If no branch exists for this tab, create one (trunk)
  if (!branchId) {
    const parentNodeId = tabOpeners.get(tabId) || null;
    const isTrunk = !parentNodeId;
    const branch = await createBranch(tabId, parentNodeId, isTrunk);
    branchId = branch.id;
    tabOpeners.delete(tabId);
  }

  // Get the latest node for this tab to set as parent
  const latestNode = await getLatestNodeForTab(tabId);

  const node = {
    id: generateId(),
    url,
    title: title || url,
    favicon: getFaviconUrl(url),
    timestamp: Date.now(),
    tabId,
    branchId,
    parentNodeId: latestNode?.id || null
  };

  await addNode(node);
  console.log('Canopy: Created node', node.id, 'for', url);
  return node;
}

// Listen for tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  // Store the opener tab ID if this tab was opened from another tab
  if (tab.openerTabId) {
    // Get the current node of the opener tab to use as parent
    const openerNode = await getLatestNodeForTab(tab.openerTabId);
    if (openerNode) {
      tabOpeners.set(tab.id, openerNode.id);
      console.log('Canopy: Tab', tab.id, 'opened from node', openerNode.id);
    }
  }
});

// Listen for tab removal to clean up mappings
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabMapping(tabId);
  tabOpeners.delete(tabId);
  console.log('Canopy: Cleaned up tab', tabId);
});

// Listen for navigation commits (actual page loads)
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only track main frame navigations
  if (details.frameId !== 0) return;

  // Skip URLs we shouldn't track
  if (!shouldTrackUrl(details.url)) return;

  // Skip certain transition types
  const skipTransitions = ['auto_subframe', 'manual_subframe'];
  if (skipTransitions.includes(details.transitionType)) return;

  try {
    // Get tab info for title
    const tab = await chrome.tabs.get(details.tabId);
    await createNode(details.tabId, details.url, tab.title);
  } catch (err) {
    console.error('Canopy: Error creating node', err);
  }
});

// Listen for title updates (pages often load with empty titles initially)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // We mainly care about title updates to enrich existing nodes
  // But for simplicity in MVP, we capture title at navigation time
  // Future enhancement: update node titles when they change
});

// Listen for history state updates (single-page apps)
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!shouldTrackUrl(details.url)) return;

  try {
    const tab = await chrome.tabs.get(details.tabId);
    await createNode(details.tabId, details.url, tab.title);
  } catch (err) {
    console.error('Canopy: Error creating node for SPA navigation', err);
  }
});

console.log('Canopy: Service worker initialized');
