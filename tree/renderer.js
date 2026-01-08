// Canvas-based tree renderer with pan/zoom support

export class TreeRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    // View state
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Interaction state
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Data
    this.layout = null;
    this.hoveredNode = null;

    // Callbacks
    this.onNodeClick = options.onNodeClick || null;
    this.onNodeHover = options.onNodeHover || null;

    // Colors (respect system preference)
    this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.colors = this.getColors();

    // Set up event listeners
    this.setupEventListeners();

    // Watch for color scheme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this.isDarkMode = e.matches;
      this.colors = this.getColors();
      this.render();
    });
  }

  getColors() {
    // Branch colors for visual distinction
    this.branchColors = this.isDarkMode
      ? ['#e94560', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da', '#fcbad3', '#a8d8ea']
      : ['#007bff', '#28a745', '#dc3545', '#fd7e14', '#6f42c1', '#20c997', '#e83e8c', '#17a2b8'];

    if (this.isDarkMode) {
      return {
        background: '#1a1a2e',
        nodeBg: '#16213e',
        nodeBorder: '#0f3460',
        nodeHover: '#1f4287',
        text: '#e8e8e8',
        textSecondary: '#a0a0a0',
        connection: '#4a5568',
        branchRail: 'rgba(255, 255, 255, 0.05)'
      };
    } else {
      return {
        background: '#f8f9fa',
        nodeBg: '#ffffff',
        nodeBorder: '#dee2e6',
        nodeHover: '#e9ecef',
        text: '#212529',
        textSecondary: '#6c757d',
        connection: '#6c757d',
        branchRail: 'rgba(0, 0, 0, 0.03)'
      };
    }
  }

  getBranchColor(branchId) {
    // Get a consistent color for each branch
    if (!this._branchColorMap) {
      this._branchColorMap = new Map();
    }
    if (!this._branchColorMap.has(branchId)) {
      const index = this._branchColorMap.size % this.branchColors.length;
      this._branchColorMap.set(branchId, this.branchColors[index]);
    }
    return this._branchColorMap.get(branchId);
  }

  setupEventListeners() {
    // Mouse events for pan
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Wheel event for zoom
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

    // Click event for node selection
    this.canvas.addEventListener('click', this.handleClick.bind(this));

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  resize(width, height) {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);
    this.render();
  }

  setLayout(layout) {
    this.layout = layout;
    this.render();
  }

  // Transform screen coordinates to world coordinates
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale
    };
  }

  // Transform world coordinates to screen coordinates
  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.scale + this.offsetX,
      y: worldY * this.scale + this.offsetY
    };
  }

  // Find node at position
  getNodeAtPosition(screenX, screenY) {
    if (!this.layout) return null;

    const world = this.screenToWorld(screenX, screenY);

    for (const pos of this.layout.positionedNodes) {
      if (
        world.x >= pos.x &&
        world.x <= pos.x + pos.width &&
        world.y >= pos.y &&
        world.y <= pos.y + pos.height
      ) {
        return pos;
      }
    }
    return null;
  }

  // Event handlers
  handleMouseDown(e) {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.canvas.style.cursor = 'grabbing';
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.render();
    } else {
      // Check for hover
      const node = this.getNodeAtPosition(x, y);
      if (node !== this.hoveredNode) {
        this.hoveredNode = node;
        this.canvas.style.cursor = node ? 'pointer' : 'grab';
        this.render();
        if (this.onNodeHover) {
          this.onNodeHover(node?.node || null);
        }
      }
    }
  }

  handleMouseUp() {
    this.isDragging = false;
    this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'grab';
  }

  handleWheel(e) {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom towards mouse position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, this.scale * zoomFactor));

    // Adjust offset to zoom towards mouse
    const worldBefore = this.screenToWorld(mouseX, mouseY);
    this.scale = newScale;
    const worldAfter = this.screenToWorld(mouseX, mouseY);

    this.offsetX += (worldAfter.x - worldBefore.x) * this.scale;
    this.offsetY += (worldAfter.y - worldBefore.y) * this.scale;

    this.render();
  }

  handleClick(e) {
    if (!this.onNodeClick) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = this.getNodeAtPosition(x, y);
    if (node) {
      this.onNodeClick(node.node);
    }
  }

  // Touch handlers
  handleTouchStart(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      this.isDragging = true;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    }
  }

  handleTouchMove(e) {
    if (e.touches.length === 1 && this.isDragging) {
      e.preventDefault();
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      this.render();
    }
  }

  handleTouchEnd() {
    this.isDragging = false;
  }

  // Rendering
  render() {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;

    // Clear canvas
    this.ctx.fillStyle = this.colors.background;
    this.ctx.fillRect(0, 0, width, height);

    if (!this.layout || this.layout.positionedNodes.length === 0) {
      this.renderEmptyState(width, height);
      return;
    }

    // Save context and apply transform
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    // Draw branch rails (vertical background stripes)
    this.renderBranchRails();

    // Draw connections (behind nodes)
    this.renderConnections();

    // Draw nodes
    this.renderNodes();

    this.ctx.restore();
  }

  renderBranchRails() {
    if (!this.layout || this.layout.positionedNodes.length === 0) return;

    // Group nodes by branch to find branch columns
    const branchColumns = new Map();
    for (const pos of this.layout.positionedNodes) {
      const branchId = pos.node.branchId;
      if (!branchColumns.has(branchId)) {
        branchColumns.set(branchId, { x: pos.x, width: pos.width, minY: pos.y, maxY: pos.y + pos.height });
      } else {
        const col = branchColumns.get(branchId);
        col.minY = Math.min(col.minY, pos.y);
        col.maxY = Math.max(col.maxY, pos.y + pos.height);
      }
    }

    // Draw a subtle vertical rail for each branch
    for (const [branchId, col] of branchColumns) {
      const color = this.getBranchColor(branchId);
      this.ctx.fillStyle = color + '15'; // 15 = ~8% opacity in hex
      this.ctx.fillRect(
        col.x - 5,
        col.minY - 10,
        col.width + 10,
        col.maxY - col.minY + 20
      );
    }
  }

  renderEmptyState(width, height) {
    this.ctx.fillStyle = this.colors.textSecondary;
    this.ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Start browsing to see your history tree', width / 2, height / 2);
  }

  renderConnections() {
    for (const conn of this.layout.connections) {
      const { from, to } = conn;

      // Use branch color for connections
      const branchColor = this.getBranchColor(to.node.branchId);

      this.ctx.beginPath();
      this.ctx.strokeStyle = branchColor;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';

      // Draw line from bottom of parent to top of child
      const startX = from.x + from.width / 2;
      const startY = from.y + from.height;
      const endX = to.x + to.width / 2;
      const endY = to.y;

      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    }
  }

  renderNodes() {
    for (const pos of this.layout.positionedNodes) {
      this.renderNode(pos);
    }
  }

  renderNode(pos) {
    const { node, x, y, width, height } = pos;
    const isHovered = this.hoveredNode === pos;
    const padding = 8;
    const iconSize = 24;
    const borderRadius = 8;
    const accentWidth = 4;

    // Get branch color for accent
    const branchColor = this.getBranchColor(node.branchId);

    // Node background
    this.ctx.fillStyle = isHovered ? this.colors.nodeHover : this.colors.nodeBg;
    this.ctx.strokeStyle = this.colors.nodeBorder;
    this.ctx.lineWidth = 1;

    this.roundRect(x, y, width, height, borderRadius);
    this.ctx.fill();
    this.ctx.stroke();

    // Colored left accent bar
    this.ctx.fillStyle = branchColor;
    this.ctx.beginPath();
    this.ctx.moveTo(x + accentWidth, y);
    this.ctx.lineTo(x, y);
    this.ctx.quadraticCurveTo(x, y, x, y + borderRadius);
    this.ctx.lineTo(x, y + height - borderRadius);
    this.ctx.quadraticCurveTo(x, y + height, x + accentWidth, y + height);
    this.ctx.closePath();
    this.ctx.fill();

    // Favicon placeholder
    this.ctx.fillStyle = this.colors.nodeBorder;
    this.ctx.fillRect(x + accentWidth + padding, y + (height - iconSize) / 2, iconSize, iconSize);

    // Title
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    const titleX = x + accentWidth + padding + iconSize + 8;
    const maxTitleWidth = width - accentWidth - padding * 2 - iconSize - 8;
    const title = this.truncateText(node.title || node.url, maxTitleWidth);
    this.ctx.fillText(title, titleX, y + height / 2);
  }

  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  truncateText(text, maxWidth) {
    const measured = this.ctx.measureText(text);
    if (measured.width <= maxWidth) return text;

    let truncated = text;
    while (truncated.length > 0 && this.ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }

  // Reset view to default
  resetView() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.render();
  }

  // Fit all content in view
  fitToView() {
    if (!this.layout || this.layout.positionedNodes.length === 0) return;

    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    const { bounds } = this.layout;

    const scaleX = (width - 40) / bounds.width;
    const scaleY = (height - 40) / bounds.height;
    this.scale = Math.min(scaleX, scaleY, 1);

    this.offsetX = (width - bounds.width * this.scale) / 2;
    this.offsetY = 20;

    this.render();
  }
}
