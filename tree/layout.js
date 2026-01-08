// Tree layout algorithm
// Converts raw nodes/branches data into positioned elements for rendering
// Layout: vertical timeline (newest at top), each branch is a vertical column

const NODE_HEIGHT = 60;
const NODE_WIDTH = 280;
const VERTICAL_GAP = 16;
const HORIZONTAL_GAP = 28;
const LEFT_MARGIN = 40;
const HEADER_HEIGHT = 50; // Space for column headers

export function calculateLayout(data, viewportWidth) {
  const { nodes, branches } = data;

  if (nodes.length === 0) {
    return { positionedNodes: [], connections: [], bounds: { width: 0, height: 0 } };
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

  // Assign Y positions based on chronological order (newest at top)
  // Add HEADER_HEIGHT to leave room for column titles
  const nodeYPositions = new Map();
  sortedNodes.forEach((node, index) => {
    nodeYPositions.set(node.id, HEADER_HEIGHT + VERTICAL_GAP + index * (NODE_HEIGHT + VERTICAL_GAP));
  });

  // Build positioned nodes
  const positionedNodes = sortedNodes.map(node => ({
    node,
    branch: branches.find(b => b.id === node.branchId),
    x: branchXPositions.get(node.branchId) || LEFT_MARGIN,
    y: nodeYPositions.get(node.id),
    width: NODE_WIDTH,
    height: NODE_HEIGHT
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

  // Build branch headers with positions
  const branchHeaders = sortedBranches.map(branch => {
    const branchNodes = nodesByBranch.get(branch.id) || [];
    // Sort by timestamp to get the first (oldest) node for default title
    const sortedBranchNodes = [...branchNodes].sort((a, b) => a.timestamp - b.timestamp);
    const firstNode = sortedBranchNodes[0];

    return {
      branch,
      x: branchXPositions.get(branch.id),
      y: 10,
      width: NODE_WIDTH,
      height: HEADER_HEIGHT - 15,
      // Use custom title if set, otherwise use first page title
      title: branch.customTitle || (firstNode?.title) || 'New Tab',
      isCustom: !!branch.customTitle
    };
  });

  // Calculate bounds
  const maxX = sortedBranches.length > 0
    ? LEFT_MARGIN + sortedBranches.length * (NODE_WIDTH + HORIZONTAL_GAP)
    : viewportWidth;
  const maxY = HEADER_HEIGHT + VERTICAL_GAP + sortedNodes.length * (NODE_HEIGHT + VERTICAL_GAP);

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

// Compress layout to fit viewport while maintaining readability
export function compressLayout(layout, viewportWidth, minNodeWidth = 150) {
  const { positionedNodes, connections, branchHeaders, bounds } = layout;

  if (bounds.width <= viewportWidth || positionedNodes.length === 0) {
    return layout;
  }

  // Calculate compression ratio
  const availableWidth = viewportWidth - (LEFT_MARGIN * 2);
  const contentWidth = bounds.width - (LEFT_MARGIN * 2);
  const ratio = Math.max(0.5, availableWidth / contentWidth); // Don't compress too much

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
