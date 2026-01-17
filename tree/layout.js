// Tree layout algorithm
// Converts raw nodes/branches data into positioned elements for rendering
// Layout: vertical timeline (newest at top), each branch is a vertical column

const NODE_HEIGHT = 60;
const NODE_WIDTH = 280;
const VERTICAL_GAP = 16;
const HORIZONTAL_GAP = 28;
const LEFT_MARGIN = 40;
const HEADER_HEIGHT = 85; // Space for column headers + summary

const MIN_NODE_HEIGHT = 36;   // 60% of base for quick views (< 10s)
const MAX_NODE_HEIGHT = 90;   // 150% of base for meaningful views (> 60s)
const DEFAULT_DURATION_MS = 60000; // 1 minute for closed tab last nodes

/**
 * Calculate view duration for each node based on timestamps
 * Duration is calculated as the time between consecutive navigations in the same tab
 * @param {Array} nodes - All nodes
 * @param {Set} openTabIds - Set of currently open tab IDs
 * @returns {Map<string, number>} Map of nodeId -> duration in milliseconds
 */
function calculateNodeDurations(nodes, openTabIds) {
  // Group nodes by tab
  const nodesByTab = new Map();
  for (const node of nodes) {
    if (!nodesByTab.has(node.tabId)) {
      nodesByTab.set(node.tabId, []);
    }
    nodesByTab.get(node.tabId).push(node);
  }

  const durationsMap = new Map();
  const now = Date.now();

  // Calculate duration for each node
  for (const [tabId, tabNodes] of nodesByTab) {
    // Sort by timestamp ascending (oldest first)
    const sorted = [...tabNodes].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i];
      const nextNode = sorted[i + 1];

      if (nextNode) {
        // Duration = time until next navigation in same tab
        const duration = nextNode.timestamp - node.timestamp;
        durationsMap.set(node.id, Math.max(duration, 0)); // Guard against negative
      } else {
        // Last node in tab
        if (openTabIds.has(tabId)) {
          // Tab still open - calculate live duration up to now
          const liveDuration = now - node.timestamp;
          durationsMap.set(node.id, Math.max(liveDuration, 0));
        } else {
          // Tab closed - use default duration
          durationsMap.set(node.id, DEFAULT_DURATION_MS);
        }
      }
    }
  }

  return durationsMap;
}

/**
 * Calculate node height based on view duration
 * Linear scale: <10s = 60%, 10-60s = 60-150%, >60s = 150%
 * @param {number} durationMs - Duration in milliseconds
 * @returns {number} Height in pixels
 */
function calculateNodeHeight(durationMs) {
  const durationSeconds = durationMs / 1000;

  // Clamp to avoid extreme values (max 10 minutes)
  const clampedDuration = Math.min(durationSeconds, 600);

  if (clampedDuration < 10) {
    // < 10s: scale from MIN to BASE (36px to 60px)
    const ratio = clampedDuration / 10;
    return MIN_NODE_HEIGHT + (NODE_HEIGHT - MIN_NODE_HEIGHT) * ratio;
  } else if (clampedDuration < 60) {
    // 10s - 60s: scale from BASE to MAX (60px to 90px)
    const ratio = (clampedDuration - 10) / 50;
    return NODE_HEIGHT + (MAX_NODE_HEIGHT - NODE_HEIGHT) * ratio;
  } else {
    // 60s+: cap at MAX
    return MAX_NODE_HEIGHT;
  }
}

export function calculateLayout(data, viewportWidth, openTabIds = new Set()) {
  const { nodes, branches } = data;

  if (nodes.length === 0) {
    return { positionedNodes: [], connections: [], branchHeaders: [], bounds: { width: 0, height: 0 } };
  }

  // Sort branches by creation time (oldest first = leftmost)
  const sortedBranches = [...branches].sort((a, b) => a.createdAt - b.createdAt);

  // Assign each branch a fixed X column
  const branchXPositions = new Map();
  sortedBranches.forEach((branch, index) => {
    branchXPositions.set(branch.id, LEFT_MARGIN + index * (NODE_WIDTH + HORIZONTAL_GAP));
  });

  // Group nodes by branch
  const nodesByBranch = new Map();
  for (const node of nodes) {
    if (!nodesByBranch.has(node.branchId)) {
      nodesByBranch.set(node.branchId, []);
    }
    nodesByBranch.get(node.branchId).push(node);
  }

  // Sort all nodes by timestamp (newest first) for Y positioning
  const sortedNodes = [...nodes].sort((a, b) => b.timestamp - a.timestamp);

  // Calculate view durations for all nodes
  const durationsMap = calculateNodeDurations(nodes, openTabIds);

  // Assign Y positions based on chronological order with variable heights (newest at top)
  // Add HEADER_HEIGHT to leave room for column titles
  const nodeYPositions = new Map();
  const nodeHeights = new Map();
  let currentY = HEADER_HEIGHT + VERTICAL_GAP;

  sortedNodes.forEach((node) => {
    const duration = durationsMap.get(node.id) || 0;
    const height = calculateNodeHeight(duration);

    nodeYPositions.set(node.id, currentY);
    nodeHeights.set(node.id, height);

    currentY += height + VERTICAL_GAP;
  });

  // Build positioned nodes
  const positionedNodes = sortedNodes.map(node => ({
    node,
    branch: branches.find(b => b.id === node.branchId),
    x: branchXPositions.get(node.branchId) || LEFT_MARGIN,
    y: nodeYPositions.get(node.id),
    width: NODE_WIDTH,
    height: nodeHeights.get(node.id) || NODE_HEIGHT,
    duration: durationsMap.get(node.id) // Include for tooltips
  }));

  // Build connections (only within same branch)
  const connections = [];
  const nodePositionMap = new Map(positionedNodes.map(p => [p.node.id, p]));

  for (const pos of positionedNodes) {
    if (pos.node.parentNodeId) {
      const parentPos = nodePositionMap.get(pos.node.parentNodeId);
      // Only connect if same branch
      if (parentPos && parentPos.node.branchId === pos.node.branchId) {
        connections.push({
          type: 'branch',
          from: parentPos,
          to: pos
        });
      }
    }
  }

  // Build cross-branch connections (parent tab → child tab)
  for (const branch of sortedBranches) {
    if (branch.openerNodeId) {
      // Find the opener node position
      const openerNodePos = nodePositionMap.get(branch.openerNodeId);

      if (openerNodePos) {
        // Find child branch nodes
        const childBranchNodes = positionedNodes
          .filter(pos => pos.node.branchId === branch.id)
          .sort((a, b) => a.y - b.y); // Sort by Y position

        if (childBranchNodes.length > 0) {
          // Get the oldest (bottom-most) node in child branch
          const oldestChildNode = childBranchNodes[childBranchNodes.length - 1];

          // Create cross-branch connection
          connections.push({
            type: 'cross-branch',
            from: openerNodePos,
            to: oldestChildNode, // Base of child column
            branch: branch
          });
        }
      }
    }
  }

  // Build branch headers with positions
  const branchHeaders = sortedBranches.map(branch => {
    const branchNodes = nodesByBranch.get(branch.id) || [];
    // Sort by timestamp to get the first (oldest) node for default title
    const sortedBranchNodes = [...branchNodes].sort((a, b) => a.timestamp - b.timestamp);
    const firstNode = sortedBranchNodes[0];

    // Check if this tab is still open
    const isOpen = openTabIds.has(branch.tabId);

    // For closed tabs, position header above the most recent (top) node
    let headerY = 10;
    if (!isOpen && branchNodes.length > 0) {
      // Find the most recent node (highest in the tree)
      const mostRecentNode = [...branchNodes].sort((a, b) => b.timestamp - a.timestamp)[0];
      const mostRecentNodeY = nodeYPositions.get(mostRecentNode.id);
      // Position header 10px above the node
      headerY = mostRecentNodeY - HEADER_HEIGHT - 10;
    }

    return {
      branch,
      x: branchXPositions.get(branch.id),
      y: headerY,
      width: NODE_WIDTH,
      height: HEADER_HEIGHT - 15,
      // Use custom title if set, otherwise use first page title
      title: branch.customTitle || (firstNode?.title) || 'New Tab',
      summary: branch.summary || null,
      isCustom: !!branch.customTitle,
      isClosed: !isOpen
    };
  });

  // Calculate bounds
  const maxX = sortedBranches.length > 0
    ? LEFT_MARGIN + sortedBranches.length * (NODE_WIDTH + HORIZONTAL_GAP)
    : viewportWidth;
  const maxY = currentY; // Already accumulated from Y-positioning loop

  return {
    positionedNodes,
    connections,
    branchHeaders,
    bounds: {
      width: Math.max(maxX, viewportWidth),
      height: maxY + VERTICAL_GAP
    }
  };
}

// Calculate max visible columns based on viewport width
export function getMaxVisibleColumns(viewportWidth) {
  if (viewportWidth > 1600) return 6;
  if (viewportWidth > 1200) return 4;
  if (viewportWidth > 768) return 3;
  return 1;
}

// Compress layout to fit viewport while maintaining readability
// Only compresses if columns fit within max visible threshold
export function compressLayout(layout, viewportWidth, minNodeWidth = 150) {
  const { positionedNodes, connections, branchHeaders, bounds } = layout;

  if (positionedNodes.length === 0) {
    return layout;
  }

  // Calculate how many columns we have
  const numColumns = branchHeaders.length;
  const maxVisible = getMaxVisibleColumns(viewportWidth);

  // If we have more columns than max visible, don't compress - let them overflow
  if (numColumns > maxVisible) {
    return layout;
  }

  // If content already fits, don't compress
  if (bounds.width <= viewportWidth) {
    return layout;
  }

  // Only compress if we have few columns that almost fit
  const availableWidth = viewportWidth - (LEFT_MARGIN * 2);
  const contentWidth = bounds.width - (LEFT_MARGIN * 2);
  const ratio = Math.max(0.5, availableWidth / contentWidth);

  // Apply compression to nodes
  const compressedNodes = positionedNodes.map(pos => ({
    ...pos,
    x: LEFT_MARGIN + (pos.x - LEFT_MARGIN) * ratio,
    width: Math.max(pos.width * ratio, minNodeWidth)
  }));

  // Apply compression to headers
  const compressedHeaders = branchHeaders.map(header => ({
    ...header,
    x: LEFT_MARGIN + (header.x - LEFT_MARGIN) * ratio,
    width: Math.max(header.width * ratio, minNodeWidth)
  }));

  return {
    positionedNodes: compressedNodes,
    connections,
    branchHeaders: compressedHeaders,
    bounds: {
      width: viewportWidth,
      height: bounds.height
    }
  };
}
