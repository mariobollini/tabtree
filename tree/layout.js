// Tree layout algorithm
// Converts raw nodes/branches data into positioned elements for rendering
// Layout: vertical timeline (newest at top), each branch is a vertical column

const NODE_HEIGHT = 50;
const NODE_WIDTH = 220;
const VERTICAL_GAP = 15;
const HORIZONTAL_GAP = 40;
const LEFT_MARGIN = 30;

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
  const nodeYPositions = new Map();
  sortedNodes.forEach((node, index) => {
    nodeYPositions.set(node.id, VERTICAL_GAP + index * (NODE_HEIGHT + VERTICAL_GAP));
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

  // Calculate bounds
  const maxX = sortedBranches.length > 0
    ? LEFT_MARGIN + sortedBranches.length * (NODE_WIDTH + HORIZONTAL_GAP)
    : viewportWidth;
  const maxY = VERTICAL_GAP + sortedNodes.length * (NODE_HEIGHT + VERTICAL_GAP);

  return {
    positionedNodes,
    connections,
    bounds: {
      width: Math.max(maxX, viewportWidth),
      height: maxY + VERTICAL_GAP
    }
  };
}

// Compress layout to fit viewport while maintaining readability
export function compressLayout(layout, viewportWidth, minNodeWidth = 150) {
  const { positionedNodes, connections, bounds } = layout;

  if (bounds.width <= viewportWidth || positionedNodes.length === 0) {
    return layout;
  }

  // Calculate compression ratio
  const availableWidth = viewportWidth - (LEFT_MARGIN * 2);
  const contentWidth = bounds.width - (LEFT_MARGIN * 2);
  const ratio = Math.max(0.5, availableWidth / contentWidth); // Don't compress too much

  // Apply compression
  const compressedNodes = positionedNodes.map(pos => ({
    ...pos,
    x: LEFT_MARGIN + (pos.x - LEFT_MARGIN) * ratio,
    width: Math.max(pos.width * ratio, minNodeWidth)
  }));

  return {
    positionedNodes: compressedNodes,
    connections,
    bounds: {
      width: viewportWidth,
      height: bounds.height
    }
  };
}
