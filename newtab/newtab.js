import { initDB, getTreeData } from '../storage/db.js';
import { calculateLayout, compressLayout } from '../tree/layout.js';
import { TreeRenderer } from '../tree/renderer.js';

let renderer = null;
let tooltip = null;

async function init() {
  // Initialize database
  await initDB();

  // Get DOM elements
  const canvas = document.getElementById('tree-canvas');
  const container = document.getElementById('canvas-container');
  tooltip = document.getElementById('tooltip');

  // Initialize renderer
  renderer = new TreeRenderer(canvas, {
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover
  });

  // Set up resize handling
  function handleResize() {
    const rect = container.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    loadAndRender();
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  // Set up control buttons
  document.getElementById('btn-reset').addEventListener('click', () => {
    renderer.resetView();
  });

  document.getElementById('btn-fit').addEventListener('click', () => {
    renderer.fitToView();
  });

  // Initial load
  await loadAndRender();

  // Track mouse for tooltip positioning
  document.addEventListener('mousemove', (e) => {
    if (!tooltip.classList.contains('hidden')) {
      positionTooltip(e.clientX, e.clientY);
    }
  });
}

async function loadAndRender() {
  try {
    const data = await getTreeData();
    const canvasRect = renderer.canvas.getBoundingClientRect();

    // Calculate layout
    let layout = calculateLayout(data, canvasRect.width);

    // Compress if needed
    layout = compressLayout(layout, canvasRect.width);

    renderer.setLayout(layout);

    // Fit to view on initial load if there's content
    if (layout.positionedNodes.length > 0) {
      renderer.fitToView();
    }
  } catch (err) {
    console.error('Failed to load tree data:', err);
  }
}

function handleNodeClick(node) {
  if (node && node.url) {
    // Navigate to the URL in the current tab
    window.location.href = node.url;
  }
}

function handleNodeHover(node) {
  if (node) {
    showTooltip(node);
  } else {
    hideTooltip();
  }
}

function showTooltip(node) {
  const time = new Date(node.timestamp).toLocaleString();
  tooltip.innerHTML = `
    <div class="tooltip-title">${escapeHtml(node.title || 'Untitled')}</div>
    <div class="tooltip-url">${escapeHtml(node.url)}</div>
    <div class="tooltip-time">${time}</div>
  `;
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  tooltip.classList.add('hidden');
}

function positionTooltip(x, y) {
  const padding = 15;
  const rect = tooltip.getBoundingClientRect();

  let left = x + padding;
  let top = y + padding;

  // Keep tooltip in viewport
  if (left + rect.width > window.innerWidth) {
    left = x - rect.width - padding;
  }
  if (top + rect.height > window.innerHeight) {
    top = y - rect.height - padding;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start the app
init().catch(err => {
  console.error('Failed to initialize Canopy:', err);
});
