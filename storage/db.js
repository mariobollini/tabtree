const DB_NAME = 'canopy';
const DB_VERSION = 1;

let db = null;

export async function initDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Nodes store - individual page visits
      if (!database.objectStoreNames.contains('nodes')) {
        const nodesStore = database.createObjectStore('nodes', { keyPath: 'id' });
        nodesStore.createIndex('branchId', 'branchId', { unique: false });
        nodesStore.createIndex('timestamp', 'timestamp', { unique: false });
        nodesStore.createIndex('tabId', 'tabId', { unique: false });
        nodesStore.createIndex('url', 'url', { unique: false });
      }

      // Branches store - represents tabs
      if (!database.objectStoreNames.contains('branches')) {
        const branchesStore = database.createObjectStore('branches', { keyPath: 'id' });
        branchesStore.createIndex('tabId', 'tabId', { unique: false });
        branchesStore.createIndex('parentNodeId', 'parentNodeId', { unique: false });
        branchesStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Tab mapping store - maps Chrome tab IDs to branch IDs
      if (!database.objectStoreNames.contains('tabMap')) {
        database.createObjectStore('tabMap', { keyPath: 'tabId' });
      }
    };
  });
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Node operations
export async function addNode(node) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['nodes'], 'readwrite');
    const store = transaction.objectStore('nodes');
    const request = store.add(node);
    request.onsuccess = () => resolve(node);
    request.onerror = () => reject(request.error);
  });
}

export async function getNode(id) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['nodes'], 'readonly');
    const store = transaction.objectStore('nodes');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getNodesByBranch(branchId) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['nodes'], 'readonly');
    const store = transaction.objectStore('nodes');
    const index = store.index('branchId');
    const request = index.getAll(branchId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllNodes() {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['nodes'], 'readonly');
    const store = transaction.objectStore('nodes');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getLatestNodeForTab(tabId) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['nodes'], 'readonly');
    const store = transaction.objectStore('nodes');
    const index = store.index('tabId');
    const request = index.getAll(tabId);
    request.onsuccess = () => {
      const nodes = request.result;
      if (nodes.length === 0) {
        resolve(null);
      } else {
        // Return the most recent node for this tab
        nodes.sort((a, b) => b.timestamp - a.timestamp);
        resolve(nodes[0]);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Branch operations
export async function addBranch(branch) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['branches'], 'readwrite');
    const store = transaction.objectStore('branches');
    const request = store.add(branch);
    request.onsuccess = () => resolve(branch);
    request.onerror = () => reject(request.error);
  });
}

export async function getBranch(id) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['branches'], 'readonly');
    const store = transaction.objectStore('branches');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllBranches() {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['branches'], 'readonly');
    const store = transaction.objectStore('branches');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getBranchByTabId(tabId) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['branches'], 'readonly');
    const store = transaction.objectStore('branches');
    const index = store.index('tabId');
    const request = index.get(tabId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Tab mapping operations
export async function setTabMapping(tabId, branchId) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['tabMap'], 'readwrite');
    const store = transaction.objectStore('tabMap');
    const request = store.put({ tabId, branchId });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getTabMapping(tabId) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['tabMap'], 'readonly');
    const store = transaction.objectStore('tabMap');
    const request = store.get(tabId);
    request.onsuccess = () => resolve(request.result?.branchId || null);
    request.onerror = () => reject(request.error);
  });
}

export async function removeTabMapping(tabId) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['tabMap'], 'readwrite');
    const store = transaction.objectStore('tabMap');
    const request = store.delete(tabId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get complete tree data for visualization
export async function getTreeData() {
  const [nodes, branches] = await Promise.all([
    getAllNodes(),
    getAllBranches()
  ]);

  return { nodes, branches };
}

// Clear all data
export async function clearAllData() {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['nodes', 'branches', 'tabMap'], 'readwrite');
    transaction.objectStore('nodes').clear();
    transaction.objectStore('branches').clear();
    transaction.objectStore('tabMap').clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
