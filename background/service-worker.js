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
  console.log('TabTree: Database initialized');
}).catch(err => {
  console.error('TabTree: Failed to initialize database', err);
});

// Track tab relationships
const pendingTabParents = new Map(); // tabId → openerTabId
const lastNodePerTab = new Map(); // tabId → nodeId

// Listen for tab creation to capture parent relationships
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId) {
    pendingTabParents.set(tab.id, tab.openerTabId);
    console.log('TabTree: Tab', tab.id, 'opened from tab', tab.openerTabId);
  }
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

// Create a new branch with optional parent tracking
async function createBranch(tabId, openerNodeId = null) {
  const branch = {
    id: generateId(),
    parentNodeId: null,  // Keep for backward compatibility
    openerNodeId,        // Which node opened this tab
    tabId,
    createdAt: Date.now(),
    isTrunk: openerNodeId === null  // True only if no opener
  };

  await addBranch(branch);
  await setTabMapping(tabId, branch.id);

  console.log('TabTree: Created branch', branch.id, 'for tab', tabId,
              openerNodeId ? `(opened from node ${openerNodeId})` : '(trunk)');
  return branch;
}

// Create a new node (page visit)
async function createNode(tabId, url, title, transitionType = null) {
  let branchId = await getTabMapping(tabId);

  // If no branch exists for this tab, create one
  if (!branchId) {
    let openerNodeId = null;

    // Check if this tab was opened from another tab via a link click
    // Chrome sets openerTabId even for manual new tabs (Cmd+T), so we must
    // verify the transition was actually from clicking a link
    if (pendingTabParents.has(tabId)) {
      const openerTabId = pendingTabParents.get(tabId);
      pendingTabParents.delete(tabId); // Clean up

      // Only establish connection if this was a link click or form submit
      const linkTransitions = ['link', 'form_submit'];
      if (transitionType && linkTransitions.includes(transitionType)) {
        // Try in-memory map first, then fall back to database
        openerNodeId = lastNodePerTab.get(openerTabId);
        if (!openerNodeId) {
          // Fetch latest node from database for this opener tab
          const openerNode = await getLatestNodeForTab(openerTabId);
          openerNodeId = openerNode?.id || null;
        }

        console.log('TabTree: Tab', tabId, 'opened from tab', openerTabId, 'with node', openerNodeId);
      } else {
        console.log('TabTree: Tab', tabId, 'has opener', openerTabId, 'but transition was', transitionType, '- treating as independent');
      }
    }

    const branch = await createBranch(tabId, openerNodeId);
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

  // Update last node tracker
  lastNodePerTab.set(tabId, node.id);

  console.log('TabTree: Created node', node.id, 'for', url);

  return node;
}

// Listen for tab removal to clean up mappings
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabMapping(tabId);
  lastNodePerTab.delete(tabId);
  pendingTabParents.delete(tabId);
  console.log('TabTree: Cleaned up tab', tabId);
});

// Listen for navigation commits (actual page loads)
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!shouldTrackUrl(details.url)) return;

  const skipTransitions = ['auto_subframe', 'manual_subframe'];
  if (skipTransitions.includes(details.transitionType)) return;

  try {
    const tab = await chrome.tabs.get(details.tabId);
    await createNode(details.tabId, details.url, tab.title, details.transitionType);
  } catch (err) {
    console.error('TabTree: Error creating node', err);
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
    console.error('TabTree: Error creating node for SPA navigation', err);
  }
});

console.log('TabTree: Service worker initialized');
