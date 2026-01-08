import { initDB, getTreeData, clearAllData, updateBranchTitle, getNodesByBranch, updateBranchSummary, getAllBranches } from '../storage/db.js';
import { calculateLayout, compressLayout } from '../tree/layout.js';
import { TreeRenderer } from '../tree/renderer.js';
import { initSummarizer, generateSummary, isSummarizerAvailable } from './summarizer.js';

let renderer = null;
let tooltip = null;
let editInput = null;

async function init() {
  await initDB();

  // Initialize AI summarizer (fails gracefully if not available)
  await initSummarizer();

  const canvas = document.getElementById('tree-canvas');
  const container = document.getElementById('canvas-container');
  tooltip = document.getElementById('tooltip');

  // Create inline edit input
  editInput = document.createElement('input');
  editInput.type = 'text';
  editInput.id = 'edit-input';
  editInput.className = 'hidden';
  document.body.appendChild(editInput);

  renderer = new TreeRenderer(canvas, {
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onHeaderClick: handleHeaderClick
  });

  function handleResize() {
    const rect = container.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    loadAndRender();
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  document.getElementById('btn-reset').addEventListener('click', () => {
    renderer.resetView();
  });

  document.getElementById('btn-fit').addEventListener('click', () => {
    renderer.fitToView();
  });

  document.getElementById('btn-clear').addEventListener('click', async () => {
    if (confirm('Clear all browsing history data? This cannot be undone.')) {
      await clearAllData();
      await loadAndRender();
    }
  });

  await loadAndRender();

  document.addEventListener('mousemove', (e) => {
    if (!tooltip.classList.contains('hidden')) {
      positionTooltip(e.clientX, e.clientY);
    }
  });
}

async function loadAndRender() {
  try {
    // Update summaries first if AI is available
    await updateAllSummaries();

    const data = await getTreeData();

    // Get list of currently open tabs
    const openTabs = await chrome.tabs.query({});
    const openTabIds = new Set(openTabs.map(tab => tab.id));

    const canvasRect = renderer.canvas.getBoundingClientRect();

    let layout = calculateLayout(data, canvasRect.width, openTabIds);
    layout = compressLayout(layout, canvasRect.width);

    // Pass AI availability info to renderer
    renderer.setAiAvailable(isSummarizerAvailable());
    renderer.setLayout(layout);

    if (layout.positionedNodes.length > 0) {
      renderer.fitToWidth();
    }
  } catch (err) {
    console.error('Failed to load tree data:', err);
  }
}

async function updateAllSummaries() {
  if (!isSummarizerAvailable()) return;

  try {
    const branches = await getAllBranches();

    for (const branch of branches) {
      // Only update if no summary exists yet (or could check timestamp)
      if (!branch.summary) {
        const nodes = await getNodesByBranch(branch.id);
        if (nodes.length > 0) {
          nodes.sort((a, b) => a.timestamp - b.timestamp);

          const summary = await generateSummary(nodes.map(n => ({
            title: n.title,
            url: n.url
          })));

          if (summary) {
            await updateBranchSummary(branch.id, summary);
          }
        }
      }
    }
  } catch (err) {
    console.log('Canopy: Summary update skipped:', err);
  }
}

function handleNodeClick(node) {
  if (node && node.url) {
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

function handleHeaderClick(header) {
  showEditInput(header);
}

function showEditInput(header) {
  const canvas = renderer.canvas;
  const canvasRect = canvas.getBoundingClientRect();

  // Convert world coordinates to screen coordinates
  const screenX = header.x * renderer.scale + renderer.offsetX + canvasRect.left;
  const screenY = header.y * renderer.scale + renderer.offsetY + canvasRect.top;
  const screenWidth = header.width * renderer.scale;
  const screenHeight = header.height * renderer.scale;

  editInput.value = header.title;
  editInput.style.left = `${screenX}px`;
  editInput.style.top = `${screenY}px`;
  editInput.style.width = `${screenWidth}px`;
  editInput.style.height = `${screenHeight}px`;
  editInput.style.fontSize = `${17 * renderer.scale}px`;
  editInput.classList.remove('hidden');
  editInput.focus();
  editInput.select();

  const branchId = header.branch.id;

  async function saveAndClose() {
    const newTitle = editInput.value.trim();
    if (newTitle && newTitle !== header.title) {
      await updateBranchTitle(branchId, newTitle);
      await loadAndRender();
    }
    editInput.classList.add('hidden');
    editInput.removeEventListener('blur', handleBlur);
    editInput.removeEventListener('keydown', handleKeydown);
  }

  function handleBlur() {
    saveAndClose();
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAndClose();
    } else if (e.key === 'Escape') {
      editInput.classList.add('hidden');
      editInput.removeEventListener('blur', handleBlur);
      editInput.removeEventListener('keydown', handleKeydown);
    }
  }

  editInput.addEventListener('blur', handleBlur);
  editInput.addEventListener('keydown', handleKeydown);
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

init().catch(err => {
  console.error('Failed to initialize Canopy:', err);
});
