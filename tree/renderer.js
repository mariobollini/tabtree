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
    this.hoveredHeader = null;
    this.aiAvailable = false;

    // Favicon cache
    this.faviconCache = new Map();

    // Callbacks
    this.onNodeClick = options.onNodeClick || null;
    this.onNodeHover = options.onNodeHover || null;
    this.onHeaderClick = options.onHeaderClick || null;

    // Light minimalist colors
    this.colors = {
      background: '#ffffff',
      nodeBg: '#ffffff',
      nodeBorder: '#e5e5e5',
      nodeHover: '#fafafa',
      text: '#222222',
      textSecondary: '#888888',
      timestamp: '#aaaaaa'
    };

    // Softer, more elegant branch colors
    this.branchColors = [
      '#5B8DEF', // soft blue
      '#6FCF97', // soft green
      '#F2994A', // soft orange
      '#BB6BD9', // soft purple
      '#EB5757', // soft red
      '#56CCF2', // sky blue
      '#F2C94C', // soft yellow
      '#9B51E0'  // violet
    ];

    this.setupEventListeners();
  }

  getBranchColor(branchId) {
    if (!this._branchColorMap) {
      this._branchColorMap = new Map();
    }
    if (!this._branchColorMap.has(branchId)) {
      const index = this._branchColorMap.size % this.branchColors.length;
      this._branchColorMap.set(branchId, this.branchColors[index]);
    }
    return this._branchColorMap.get(branchId);
  }

  // Format relative time
  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  loadFavicon(url) {
    if (!url) return null;
    if (this.faviconCache.has(url)) {
      return this.faviconCache.get(url);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    this.faviconCache.set(url, { loading: true, img: null });

    img.onload = () => {
      this.faviconCache.set(url, { loading: false, img });
      this.render();
    };

    img.onerror = () => {
      this.faviconCache.set(url, { loading: false, img: null });
    };

    img.src = url;
    return { loading: true, img: null };
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    this.canvas.addEventListener('click', this.handleClick.bind(this));
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
    if (layout && layout.positionedNodes) {
      for (const pos of layout.positionedNodes) {
        if (pos.node.favicon) {
          this.loadFavicon(pos.node.favicon);
        }
      }
    }
    this.render();
  }

  setAiAvailable(available) {
    this.aiAvailable = available;
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale
    };
  }

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

  getHeaderAtPosition(screenX, screenY) {
    if (!this.layout || !this.layout.branchHeaders) return null;
    const world = this.screenToWorld(screenX, screenY);
    for (const header of this.layout.branchHeaders) {
      if (
        world.x >= header.x &&
        world.x <= header.x + header.width &&
        world.y >= header.y &&
        world.y <= header.y + header.height
      ) {
        return header;
      }
    }
    return null;
  }

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
      const node = this.getNodeAtPosition(x, y);
      const header = this.getHeaderAtPosition(x, y);

      let needsRender = false;

      if (node !== this.hoveredNode) {
        this.hoveredNode = node;
        needsRender = true;
        if (this.onNodeHover) {
          this.onNodeHover(node?.node || null);
        }
      }

      if (header !== this.hoveredHeader) {
        this.hoveredHeader = header;
        needsRender = true;
      }

      this.canvas.style.cursor = (node || header) ? 'pointer' : 'default';

      if (needsRender) {
        this.render();
      }
    }
  }

  handleMouseUp() {
    this.isDragging = false;
    this.canvas.style.cursor = (this.hoveredNode || this.hoveredHeader) ? 'pointer' : 'default';
  }

  handleWheel(e) {
    e.preventDefault();

    // Scroll vertically through time (like a normal page)
    // Scrolling down = go back in time (move view down)
    const scrollSpeed = 1.5;
    this.offsetY -= e.deltaY * scrollSpeed;

    // Clamp to reasonable bounds
    if (this.layout) {
      const viewHeight = this.canvas.height / this.dpr;
      const maxScroll = 50; // Allow some overscroll at top
      const minScroll = -(this.layout.bounds.height * this.scale - viewHeight + 100);
      this.offsetY = Math.min(maxScroll, Math.max(minScroll, this.offsetY));
    }

    this.render();
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const header = this.getHeaderAtPosition(x, y);
    if (header && this.onHeaderClick) {
      this.onHeaderClick(header);
      return;
    }

    const node = this.getNodeAtPosition(x, y);
    if (node && this.onNodeClick) {
      this.onNodeClick(node.node);
    }
  }

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

  render() {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;

    this.ctx.fillStyle = this.colors.background;
    this.ctx.fillRect(0, 0, width, height);

    if (!this.layout || this.layout.positionedNodes.length === 0) {
      this.renderEmptyState(width, height);
      return;
    }

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    this.renderBranchRails();
    this.renderConnections();
    this.renderNodes();
    this.renderHeaders();

    this.ctx.restore();
  }

  renderBranchRails() {
    if (!this.layout || this.layout.positionedNodes.length === 0) return;

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

    for (const [branchId, col] of branchColumns) {
      const color = this.getBranchColor(branchId);
      this.ctx.fillStyle = color + '08';
      this.ctx.beginPath();
      this.ctx.roundRect(col.x - 10, col.minY - 20, col.width + 20, col.maxY - col.minY + 40, 12);
      this.ctx.fill();
    }
  }

  renderEmptyState(width, height) {
    this.ctx.fillStyle = this.colors.textSecondary;
    this.ctx.font = '20px "Inter", "SF Pro Display", -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Start browsing to see your history tree', width / 2, height / 2);
  }

  renderConnections() {
    for (const conn of this.layout.connections) {
      const { from, to } = conn;
      const branchColor = this.getBranchColor(to.node.branchId);

      this.ctx.beginPath();
      this.ctx.strokeStyle = branchColor + '40';
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';

      const startX = from.x + from.width / 2;
      const startY = from.y + from.height;
      const endX = to.x + to.width / 2;
      const endY = to.y;

      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    }
  }

  renderHeaders() {
    if (!this.layout.branchHeaders) return;

    for (const header of this.layout.branchHeaders) {
      this.renderHeader(header);
    }
  }

  renderHeader(header) {
    const { branch, x, y, width, height, title, summary, isClosed } = header;
    const isHovered = this.hoveredHeader === header;
    const branchColor = this.getBranchColor(branch.id);

    const maxWidth = width - 8;
    const titleY = y + 15;

    // Header text
    this.ctx.fillStyle = isHovered ? branchColor : this.colors.text;
    this.ctx.font = `600 17px "Inter", "SF Pro Display", -apple-system, sans-serif`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    // Add space for CLOSED badge if needed
    const titleMaxWidth = isClosed ? maxWidth - 75 : maxWidth;
    const displayTitle = this.truncateText(title, titleMaxWidth);
    this.ctx.fillText(displayTitle, x + 4, titleY);

    // CLOSED badge for closed tabs
    if (isClosed) {
      const titleWidth = this.ctx.measureText(displayTitle).width;
      const badgeX = x + 8 + titleWidth;
      const badgeY = titleY - 2;

      this.ctx.fillStyle = this.colors.textSecondary + '30';
      this.ctx.fillRect(badgeX, badgeY, 65, 20);

      this.ctx.fillStyle = this.colors.textSecondary;
      this.ctx.font = `600 11px "Inter", "SF Pro Display", -apple-system, sans-serif`;
      this.ctx.textBaseline = 'top';
      this.ctx.fillText('CLOSED', badgeX + 6, badgeY + 4);
    }

    // Summary text (if available)
    if (summary) {
      this.ctx.fillStyle = this.colors.textSecondary;
      this.ctx.font = `13px "Inter", "SF Pro Display", -apple-system, sans-serif`;
      this.ctx.textBaseline = 'top';

      // Wrap summary to multiple lines if needed
      const summaryY = titleY + 24;
      const lines = this.wrapText(summary, maxWidth);
      lines.forEach((line, index) => {
        if (index < 2) { // Max 2 lines
          this.ctx.fillText(line, x + 4, summaryY + (index * 16));
        }
      });
    } else if (isHovered) {
      // Show AI error message on hover if no summary
      this.ctx.fillStyle = this.colors.textSecondary;
      this.ctx.font = `italic 13px "Inter", "SF Pro Display", -apple-system, sans-serif`;
      this.ctx.textBaseline = 'top';

      const errorMsg = this.aiAvailable
        ? 'AI summary unavailable'
        : 'AI not available (requires Chrome 127+)';
      const summaryY = titleY + 24;
      this.ctx.fillText(errorMsg, x + 4, summaryY);
    }

    // Edit hint on hover (position below everything)
    if (isHovered) {
      this.ctx.fillStyle = branchColor + '80';
      this.ctx.font = `12px "Inter", "SF Pro Display", -apple-system, sans-serif`;
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillText('click to edit', x + 4, y + height - 4);
    }

    // Colored underline
    this.ctx.strokeStyle = branchColor + '40';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 4, titleY + 20);
    this.ctx.lineTo(x + Math.min(this.ctx.measureText(displayTitle).width + 4, width - 8), titleY + 20);
    this.ctx.stroke();
  }

  renderNodes() {
    for (const pos of this.layout.positionedNodes) {
      this.renderNode(pos);
    }
  }

  renderNode(pos) {
    const { node, x, y, width, height } = pos;
    const isHovered = this.hoveredNode === pos;
    const padding = 14;
    const iconSize = 22;
    const borderRadius = 12;
    const accentWidth = 4;

    const branchColor = this.getBranchColor(node.branchId);

    // Shadow on hover
    if (isHovered) {
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
      this.ctx.shadowBlur = 16;
      this.ctx.shadowOffsetY = 4;
    }

    // Node background
    this.ctx.fillStyle = isHovered ? this.colors.nodeHover : this.colors.nodeBg;
    this.ctx.strokeStyle = this.colors.nodeBorder;
    this.ctx.lineWidth = 1;

    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, borderRadius);
    this.ctx.fill();
    this.ctx.stroke();

    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;

    // Colored left accent bar
    this.ctx.fillStyle = branchColor;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, accentWidth, height, [borderRadius, 0, 0, borderRadius]);
    this.ctx.fill();

    // Favicon
    const iconX = x + accentWidth + padding;
    const iconY = y + (height - iconSize) / 2;

    const cached = node.favicon ? this.faviconCache.get(node.favicon) : null;
    if (cached && cached.img && !cached.loading) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.roundRect(iconX, iconY, iconSize, iconSize, 5);
      this.ctx.clip();
      this.ctx.drawImage(cached.img, iconX, iconY, iconSize, iconSize);
      this.ctx.restore();
    } else {
      this.ctx.fillStyle = branchColor + '18';
      this.ctx.beginPath();
      this.ctx.roundRect(iconX, iconY, iconSize, iconSize, 5);
      this.ctx.fill();

      try {
        const domain = new URL(node.url).hostname.replace('www.', '');
        const letter = domain.charAt(0).toUpperCase();
        this.ctx.fillStyle = branchColor;
        this.ctx.font = `600 ${iconSize * 0.55}px "Inter", "SF Pro Display", -apple-system, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(letter, iconX + iconSize / 2, iconY + iconSize / 2);
      } catch {}
    }

    // Timestamp (right side)
    const timestamp = this.formatRelativeTime(node.timestamp);
    this.ctx.fillStyle = this.colors.timestamp;
    this.ctx.font = '13px "Inter", "SF Pro Display", -apple-system, sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    const timestampX = x + width - padding;
    this.ctx.fillText(timestamp, timestampX, y + height / 2);

    // Title (left side, after favicon, before timestamp)
    const timestampWidth = this.ctx.measureText(timestamp).width + 12;
    const titleX = iconX + iconSize + 12;
    const maxTitleWidth = width - accentWidth - padding * 2 - iconSize - 12 - timestampWidth;

    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = '16px "Inter", "SF Pro Display", -apple-system, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    const title = this.truncateText(node.title || node.url, maxTitleWidth);
    this.ctx.fillText(title, titleX, y + height / 2);
  }

  truncateText(text, maxWidth) {
    if (!text) return '';
    const measured = this.ctx.measureText(text);
    if (measured.width <= maxWidth) return text;

    let truncated = text;
    while (truncated.length > 0 && this.ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
  }

  wrapText(text, maxWidth) {
    if (!text) return [];

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const measured = this.ctx.measureText(testLine);

      if (measured.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  resetView() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.render();
  }

  // Fit content to width and position at top (for initial view)
  fitToWidth() {
    if (!this.layout || this.layout.positionedNodes.length === 0) return;

    const width = this.canvas.width / this.dpr;
    const { bounds } = this.layout;

    // Scale to fit width, but not smaller than 0.7 and not larger than 1
    const scaleX = (width - 60) / bounds.width;
    this.scale = Math.min(Math.max(scaleX, 0.7), 1);

    // Center horizontally, start at top
    this.offsetX = (width - bounds.width * this.scale) / 2;
    this.offsetY = 30;

    this.render();
  }

  // Fit all content in view (for "Fit" button)
  fitToView() {
    if (!this.layout || this.layout.positionedNodes.length === 0) return;

    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    const { bounds } = this.layout;

    const scaleX = (width - 80) / bounds.width;
    const scaleY = (height - 80) / bounds.height;
    this.scale = Math.min(scaleX, scaleY, 1);

    this.offsetX = (width - bounds.width * this.scale) / 2;
    this.offsetY = 40;

    this.render();
  }
}
