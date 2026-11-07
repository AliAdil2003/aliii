import { Project, Product, CatalogTemplate, ExportHistoryItem } from '@/types';

const DB_NAME = 'CatalogStudioDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products'); // key is projectId
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('exports')) {
          db.createObjectStore('exports', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta'); // key is arbitrary string
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (err) => {
        console.warn('IndexedDB open error:', err);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked');
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

export const IndexedDBStorage = {
  // --- Projects ---
  async getAllProjects(): Promise<Project[] | null> {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const req = store.getAll();

        req.onsuccess = () => {
          resolve((req.result as Project[]) || []);
        };
        req.onerror = () => {
          resolve(null);
        };
      } catch (e) {
        console.warn('IndexedDB getAllProjects error:', e);
        resolve(null);
      }
    });
  },

  async getProject(id: string): Promise<Project | null> {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const req = store.get(id);

        req.onsuccess = () => {
          resolve((req.result as Project) || null);
        };
        req.onerror = () => {
          resolve(null);
        };
      } catch (e) {
        console.warn('IndexedDB getProject error:', e);
        resolve(null);
      }
    });
  },

  async saveProject(project: Project): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        const req = store.put(project);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        console.warn('IndexedDB saveProject error:', e);
        resolve(false);
      }
    });
  },

  async deleteProject(id: string): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(['projects', 'products'], 'readwrite');
        tx.objectStore('projects').delete(id);
        tx.objectStore('products').delete(id);

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        console.warn('IndexedDB deleteProject error:', e);
        resolve(false);
      }
    });
  },

  // --- Products ---
  async getProducts(projectId: string): Promise<Product[] | null> {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const req = store.get(projectId);

        req.onsuccess = () => {
          resolve((req.result as Product[]) || null);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        console.warn('IndexedDB getProducts error:', e);
        resolve(null);
      }
    });
  },

  async saveProducts(projectId: string, products: Product[]): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        const req = store.put(products, projectId);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        console.warn('IndexedDB saveProducts error:', e);
        resolve(false);
      }
    });
  },

  // --- Templates ---
  async getAllTemplates(): Promise<CatalogTemplate[] | null> {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('templates', 'readonly');
        const store = tx.objectStore('templates');
        const req = store.getAll();

        req.onsuccess = () => resolve((req.result as CatalogTemplate[]) || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async saveTemplate(template: CatalogTemplate): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('templates', 'readwrite');
        const store = tx.objectStore('templates');
        const req = store.put(template);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  async deleteTemplate(id: string): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('templates', 'readwrite');
        const store = tx.objectStore('templates');
        const req = store.delete(id);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  // --- Exports ---
  async getAllExports(): Promise<ExportHistoryItem[] | null> {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('exports', 'readonly');
        const store = tx.objectStore('exports');
        const req = store.getAll();

        req.onsuccess = () => resolve((req.result as ExportHistoryItem[]) || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async saveExport(item: ExportHistoryItem): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('exports', 'readwrite');
        const store = tx.objectStore('exports');
        const req = store.put(item);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  async deleteExport(id: string): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('exports', 'readwrite');
        const store = tx.objectStore('exports');
        const req = store.delete(id);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  // --- Meta (KeyValue) ---
  async getMeta<T = any>(key: string): Promise<T | null> {
    const db = await getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('meta', 'readonly');
        const store = tx.objectStore('meta');
        const req = store.get(key);

        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  async setMeta(key: string, value: any): Promise<boolean> {
    const db = await getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        const req = store.put(value, key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },
};
