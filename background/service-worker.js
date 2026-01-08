import {
  initDB,
  generateId,
  addNode,
  addBranch,
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

// Helper to check if URL should be tracked
function shouldTrackUrl(url) {
  if (!url) return false;
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
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
  } catch {
    return null;
  }
}

// Create a new branch (every tab is a trunk - simple model)
async function createBranch(tabId) {
  const branch = {
    id: generateId(),
    parentNodeId: null,  // All branches are trunks for now
    tabId,
    createdAt: Date.now(),
    isTrunk: true
  };

  await addBranch(branch);
  await setTabMapping(tabId, branch.id);

  console.log('Canopy: Created branch', branch.id, 'for tab', tabId);
  return branch;
}

// Create a new node (page visit)
async function createNode(tabId, url, title) {
  let branchId = await getTabMapping(tabId);

  // If no branch exists for this tab, create one
  if (!branchId) {
    const branch = await createBranch(tabId);
    branchId = branch.id;
  }

  // Get the latest node for this tab to link as parent (within same branch)
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

// Listen for tab removal to clean up mappings
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabMapping(tabId);
  console.log('Canopy: Cleaned up tab', tabId);
});

// Listen for navigation commits (actual page loads)
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!shouldTrackUrl(details.url)) return;

  const skipTransitions = ['auto_subframe', 'manual_subframe'];
  if (skipTransitions.includes(details.transitionType)) return;

  try {
    const tab = await chrome.tabs.get(details.tabId);
    await createNode(details.tabId, details.url, tab.title);
  } catch (err) {
    console.error('Canopy: Error creating node', err);
  }
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
