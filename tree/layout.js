// Tree layout algorithm
// Converts raw nodes/branches data into positioned elements for rendering
// Layout: vertical timeline (newest at top), horizontal branching

const NODE_HEIGHT = 50;
const NODE_WIDTH = 200;
const VERTICAL_GAP = 20;
const HORIZONTAL_GAP = 30;
const BRANCH_INDENT = 40;

export function calculateLayout(data, viewportWidth) {
  const { nodes, branches } = data;

  if (nodes.length === 0) {
    return { positionedNodes: [], connections: [], bounds: { width: 0, height: 0 } };
  }

  // Build lookup maps
  const branchMap = new Map(branches.map(b => [b.id, b]));
  const nodesByBranch = new Map();
  const branchChildren = new Map(); // parentNodeId -> child branches

  // Group nodes by branch and sort by timestamp
  for (const node of nodes) {
    if (!nodesByBranch.has(node.branchId)) {
      nodesByBranch.set(node.branchId, []);
    }
    nodesByBranch.get(node.branchId).push(node);
  }

  // Sort nodes within each branch by timestamp (oldest first for processing)
  for (const [branchId, branchNodes] of nodesByBranch) {
    branchNodes.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Build branch hierarchy
  for (const branch of branches) {
    if (branch.parentNodeId) {
      if (!branchChildren.has(branch.parentNodeId)) {
        branchChildren.set(branch.parentNodeId, []);
      }
      branchChildren.get(branch.parentNodeId).push(branch);
    }
  }

  // Find trunk branches (no parent)
  const trunkBranches = branches.filter(b => b.isTrunk || !b.parentNodeId);
  trunkBranches.sort((a, b) => a.createdAt - b.createdAt);

  // Position tracking
  const positionedNodes = [];
  const connections = [];
  let currentY = VERTICAL_GAP;

  // Collect all nodes with their branch depth for sorting
  const allNodesWithMeta = [];

  function collectNodes(branch, depth) {
    const branchNodes = nodesByBranch.get(branch.id) || [];
    for (const node of branchNodes) {
      allNodesWithMeta.push({ node, branch, depth });

      // Recursively collect child branches
      const children = branchChildren.get(node.id) || [];
      for (const childBranch of children) {
        collectNodes(childBranch, depth + 1);
      }
    }
  }

  for (const trunk of trunkBranches) {
    collectNodes(trunk, 0);
  }

  // Sort all nodes by timestamp (newest first for display)
  allNodesWithMeta.sort((a, b) => b.node.timestamp - a.node.timestamp);

  // Calculate positions
  // Group nodes by time buckets to handle concurrent nodes
  const timeSlots = [];
  let lastTimestamp = null;
  let currentSlot = null;

  for (const item of allNodesWithMeta) {
    const timeDiff = lastTimestamp ? lastTimestamp - item.node.timestamp : Infinity;

    // If more than 1 second apart, new time slot
    if (timeDiff > 1000 || !currentSlot) {
      currentSlot = { y: currentY, items: [] };
      timeSlots.push(currentSlot);
      currentY += NODE_HEIGHT + VERTICAL_GAP;
    }

    currentSlot.items.push(item);
    lastTimestamp = item.node.timestamp;
  }

  // Position nodes within each time slot
  const branchXPositions = new Map();
  let nextBranchX = HORIZONTAL_GAP;

  for (const slot of timeSlots) {
    // Sort items in slot by branch depth, then by branch creation time
    slot.items.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.branch.createdAt - b.branch.createdAt;
    });

    for (const item of slot.items) {
      const { node, branch, depth } = item;

      // Determine X position for this branch
      let x;
      if (branchXPositions.has(branch.id)) {
        x = branchXPositions.get(branch.id);
      } else {
        // New branch - position based on parent or next available slot
        if (branch.parentNodeId) {
          // Find parent node's X position
          const parentPos = positionedNodes.find(p => p.node.id === branch.parentNodeId);
          if (parentPos) {
            x = parentPos.x + BRANCH_INDENT;
          } else {
            x = nextBranchX;
          }
        } else {
          x = nextBranchX;
        }
        branchXPositions.set(branch.id, x);
        nextBranchX = Math.max(nextBranchX, x + NODE_WIDTH + HORIZONTAL_GAP);
      }

      const positioned = {
        node,
        branch,
        x,
        y: slot.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      };
      positionedNodes.push(positioned);
    }
  }

  // Build connections
  // 1. Connect nodes within same branch (vertical lines)
  // 2. Connect parent nodes to child branches (branching lines)
  const nodePositionMap = new Map(positionedNodes.map(p => [p.node.id, p]));

  for (const pos of positionedNodes) {
    // Connect to parent node in same branch
    if (pos.node.parentNodeId) {
      const parentPos = nodePositionMap.get(pos.node.parentNodeId);
      if (parentPos && parentPos.branch.id === pos.branch.id) {
        connections.push({
          type: 'branch',
          from: parentPos,
          to: pos
        });
      }
    }

    // Connect from parent node to this branch's first node
    if (pos.branch.parentNodeId) {
      const parentPos = nodePositionMap.get(pos.branch.parentNodeId);
      const branchNodes = nodesByBranch.get(pos.branch.id) || [];
      const firstNode = branchNodes[0];
      if (parentPos && firstNode && pos.node.id === firstNode.id) {
        connections.push({
          type: 'spawn',
          from: parentPos,
          to: pos
        });
      }
    }
  }

  // Calculate bounds
  const maxX = Math.max(...positionedNodes.map(p => p.x + p.width), viewportWidth);
  const maxY = currentY;

  return {
    positionedNodes,
    connections,
    bounds: {
      width: maxX + HORIZONTAL_GAP,
      height: maxY + VERTICAL_GAP
    }
  };
}

// Compress layout to fit viewport while maintaining readability
export function compressLayout(layout, viewportWidth, minNodeWidth = 120) {
  const { positionedNodes, connections, bounds } = layout;

  if (bounds.width <= viewportWidth || positionedNodes.length === 0) {
    return layout; // No compression needed
  }

  // Calculate compression ratio
  const availableWidth = viewportWidth - (HORIZONTAL_GAP * 2);
  const contentWidth = bounds.width - (HORIZONTAL_GAP * 2);
  const ratio = availableWidth / contentWidth;

  // Apply compression
  const compressedNodes = positionedNodes.map(pos => ({
    ...pos,
    x: HORIZONTAL_GAP + (pos.x - HORIZONTAL_GAP) * ratio,
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
