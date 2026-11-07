import { Project, Product, CatalogTemplate, ExportHistoryItem } from '@/types';
import { defaultTemplates } from '../templates/defaultTemplates';
import { INITIAL_SAMPLE_PRODUCTS } from '../sampleData/sampleProducts';
import { IndexedDBStorage } from '../storage/indexedDB';

const STORAGE_KEYS = {
  USER: 'catalog_studio_user',
  PROJECTS: 'catalog_studio_projects',
  PRODUCTS_PREFIX: 'catalog_studio_products_',
  TEMPLATES: 'catalog_studio_templates',
  EXPORTS: 'catalog_studio_exports',
};

export interface LocalUser {
  id: string;
  name: string;
  email: string;
}

// In-memory fast cache
const memoryProjects = new Map<string, Project>();
const memoryProducts = new Map<string, Product[]>();
const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  // Always check memory store FIRST
  if (memoryStore[key] !== undefined) return memoryStore[key];
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(key);
    if (val !== null) {
      memoryStore[key] = val;
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  memoryStore[key] = value;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    // Quota exceeded or private browsing - safe to ignore since IndexedDB and memory hold the data
  }
}

function safeRemoveItem(key: string): void {
  delete memoryStore[key];
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    // Ignore
  }
}

function createDefaultDemoProject(): Project {
  return {
    id: 'demo_project',
    userId: 'usr_demo_01',
    name: 'كتالوج أجهزة MOXEDO وإكسسوارات الهواتف',
    fileName: 'moxedo_catalog_sample.xlsx',
    fileSize: 45200,
    rowCount: INITIAL_SAMPLE_PRODUCTS.length,
    columnCount: 9,
    detectedColumns: [
      'اسم العرض',
      'وصف المنتج',
      'باركود',
      'الفئة',
      'سعر البيع',
      'سعر بيع الزبون',
      'الكمية في اليد',
      'صورة 512',
      'مرجع داخلي',
      'الوحدة',
    ],
    columnMapping: {
      productName: 'اسم العرض',
      description: 'وصف المنتج',
      barcode: 'باركود',
      category: 'الفئة',
      customerPrice: 'سعر بيع الزبون',
      salePrice: 'سعر البيع',
      price: 'سعر بيع الزبون',
      stock: 'الكمية في اليد',
      image: 'صورة 512',
      internalReference: 'مرجع داخلي',
      unit: 'الوحدة',
      currency: '',
      availableQuantity: '',
    },
    settings: {
      templateId: 'moxedo_default',
      template: defaultTemplates[0],
      stockFilter: { mode: 'all' },
      defaultCurrency: 'د.ع',
      currencyPosition: 'suffix',
    },
    productCount: INITIAL_SAMPLE_PRODUCTS.length,
    includedProductCount: INITIAL_SAMPLE_PRODUCTS.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export class LocalStorageAdapter {
  private static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  // --- User / Auth ---
  static async getCurrentUser(): Promise<LocalUser | null> {
    const data = safeGetItem(STORAGE_KEYS.USER);
    if (!data) {
      const demoUser: LocalUser = {
        id: 'usr_demo_01',
        name: 'مدير الكتالوج',
        email: 'admin@catalogstudio.pro',
      };
      safeSetItem(STORAGE_KEYS.USER, JSON.stringify(demoUser));
      return demoUser;
    }
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static async setCurrentUser(user: LocalUser | null): Promise<void> {
    if (user) {
      safeSetItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      safeRemoveItem(STORAGE_KEYS.USER);
    }
  }

  // --- Projects ---
  static async getProjects(): Promise<Project[]> {
    // 1. Check in-memory cache
    if (memoryProjects.size > 0) {
      return Array.from(memoryProjects.values());
    }

    // 2. Check IndexedDB
    let idbProjects = await IndexedDBStorage.getAllProjects();
    if (idbProjects && idbProjects.length > 0) {
      idbProjects.forEach((p) => memoryProjects.set(p.id, p));
      return idbProjects;
    }

    // 3. Check Server Disk API
    if (this.isBrowser()) {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.projects) && data.projects.length > 0) {
            for (const p of data.projects) {
              memoryProjects.set(p.id, p);
              await IndexedDBStorage.saveProject(p);
            }
            return data.projects;
          }
        }
      } catch (err) {
        // Server fetch failed, continue to localStorage fallback
      }
    }

    // 4. Check LocalStorage fallback
    const raw = safeGetItem(STORAGE_KEYS.PROJECTS);
    if (raw) {
      try {
        const list: Project[] = JSON.parse(raw);
        if (list.length > 0) {
          for (const p of list) {
            memoryProjects.set(p.id, p);
            await IndexedDBStorage.saveProject(p);
          }
          return list;
        }
      } catch (err) {
        // Parse error
      }
    }

    // 5. Initialize Demo Project if store is completely empty
    const demo = createDefaultDemoProject();
    memoryProjects.set(demo.id, demo);
    memoryProducts.set(demo.id, INITIAL_SAMPLE_PRODUCTS);

    await IndexedDBStorage.saveProject(demo);
    await IndexedDBStorage.saveProducts(demo.id, INITIAL_SAMPLE_PRODUCTS);

    safeSetItem(STORAGE_KEYS.PROJECTS, JSON.stringify([demo]));
    safeSetItem(STORAGE_KEYS.PRODUCTS_PREFIX + demo.id, JSON.stringify(INITIAL_SAMPLE_PRODUCTS));

    // Also persist demo to server
    if (this.isBrowser()) {
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demo),
      }).catch(() => {});
    }

    return [demo];
  }

  static async getProject(id: string): Promise<Project | null> {
    // 1. Check memory
    if (memoryProjects.has(id)) {
      return memoryProjects.get(id)!;
    }

    // 2. Check IndexedDB
    const idbProj = await IndexedDBStorage.getProject(id);
    if (idbProj) {
      memoryProjects.set(id, idbProj);
      return idbProj;
    }

    // 3. Check Server Disk API
    if (this.isBrowser()) {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.project) {
            memoryProjects.set(id, data.project);
            await IndexedDBStorage.saveProject(data.project);
            return data.project;
          }
        }
      } catch (err) {
        // Fallback
      }
    }

    // 4. Check LocalStorage
    const raw = safeGetItem(STORAGE_KEYS.PROJECTS);
    if (raw) {
      try {
        const list: Project[] = JSON.parse(raw);
        const found = list.find((p) => p.id === id);
        if (found) {
          memoryProjects.set(id, found);
          await IndexedDBStorage.saveProject(found);
          return found;
        }
      } catch {
        // Ignore
      }
    }

    // 5. If demo_project requested and not found, initialize it
    if (id === 'demo_project') {
      const demo = createDefaultDemoProject();
      memoryProjects.set(demo.id, demo);
      await IndexedDBStorage.saveProject(demo);
      return demo;
    }

    return null;
  }

  static async saveProject(project: Project): Promise<void> {
    const updated = {
      ...project,
      updatedAt: new Date().toISOString(),
      createdAt: project.createdAt || new Date().toISOString(),
    };

    // 1. Save in memory
    memoryProjects.set(project.id, updated);

    // 2. Save in IndexedDB
    await IndexedDBStorage.saveProject(updated);

    // 3. Save to server API asynchronously
    if (this.isBrowser()) {
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((err) => console.warn('Failed to sync project to server disk:', err));
    }

    // 4. Update localStorage safely (best-effort)
    try {
      const raw = safeGetItem(STORAGE_KEYS.PROJECTS);
      let list: Project[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((p) => p.id === project.id);
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.unshift(updated);
      }
      safeSetItem(STORAGE_KEYS.PROJECTS, JSON.stringify(list));
    } catch (err) {
      // Quota exceeded is normal and handled by IndexedDB
    }
  }

  static async deleteProject(id: string): Promise<void> {
    // 1. Remove from memory
    memoryProjects.delete(id);
    memoryProducts.delete(id);

    // 2. Remove from IndexedDB
    await IndexedDBStorage.deleteProject(id);

    // 3. Delete from server disk API
    if (this.isBrowser()) {
      fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(() => {});
    }

    // 4. Remove from localStorage
    try {
      const raw = safeGetItem(STORAGE_KEYS.PROJECTS);
      if (raw) {
        const list: Project[] = JSON.parse(raw);
        safeSetItem(STORAGE_KEYS.PROJECTS, JSON.stringify(list.filter((p) => p.id !== id)));
      }
      safeRemoveItem(STORAGE_KEYS.PRODUCTS_PREFIX + id);
    } catch (err) {
      // Ignore
    }
  }

  // --- Products ---
  static async getProducts(projectId: string): Promise<Product[]> {
    // 1. Check memory
    if (memoryProducts.has(projectId)) {
      return memoryProducts.get(projectId)!;
    }

    // 2. Check IndexedDB
    const idbProds = await IndexedDBStorage.getProducts(projectId);
    if (idbProds && Array.isArray(idbProds) && idbProds.length > 0) {
      memoryProducts.set(projectId, idbProds);
      return idbProds;
    }

    // 3. Check Server Disk API
    if (this.isBrowser()) {
      try {
        const res = await fetch(`/api/projects/${projectId}/products`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.products) && data.products.length > 0) {
            memoryProducts.set(projectId, data.products);
            await IndexedDBStorage.saveProducts(projectId, data.products);
            return data.products;
          }
        }
      } catch (err) {
        // Continue to localStorage fallback
      }
    }

    // 4. Check LocalStorage fallback
    const raw = safeGetItem(STORAGE_KEYS.PRODUCTS_PREFIX + projectId);
    if (raw) {
      try {
        const list: Product[] = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          memoryProducts.set(projectId, list);
          await IndexedDBStorage.saveProducts(projectId, list);
          return list;
        }
      } catch (err) {
        // Ignore
      }
    }

    // 5. Special demo project fallback
    if (projectId === 'demo_project') {
      memoryProducts.set(projectId, INITIAL_SAMPLE_PRODUCTS);
      await IndexedDBStorage.saveProducts(projectId, INITIAL_SAMPLE_PRODUCTS);
      return INITIAL_SAMPLE_PRODUCTS;
    }

    return [];
  }

  static async saveProducts(projectId: string, products: Product[]): Promise<void> {
    // 1. Save in memory
    memoryProducts.set(projectId, products);

    // 2. Save in IndexedDB (handles gigabytes, large Base64 images)
    await IndexedDBStorage.saveProducts(projectId, products);

    // 3. Update project metadata in memory & IndexedDB
    const proj = memoryProjects.get(projectId);
    if (proj) {
      proj.productCount = products.length;
      proj.includedProductCount = products.filter((p) => p.includedInCatalog).length;
      proj.updatedAt = new Date().toISOString();
      await IndexedDBStorage.saveProject(proj);
    }

    // 4. Save to Server Disk API in the background
    if (this.isBrowser()) {
      fetch(`/api/projects/${projectId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(products),
      }).catch((err) => console.warn('Failed to sync products to server disk:', err));
    }

    // 5. Best-effort localStorage save (only if payload is small, omit huge base64 images if quota fails)
    try {
      safeSetItem(STORAGE_KEYS.PRODUCTS_PREFIX + projectId, JSON.stringify(products));
    } catch (err) {
      // Ignored: IndexedDB and memory already hold all product data safely
    }
  }

  // --- Templates ---
  static async getTemplates(): Promise<CatalogTemplate[]> {
    const idbTemplates = await IndexedDBStorage.getAllTemplates();
    if (idbTemplates && idbTemplates.length > 0) {
      const defaultIds = new Set(defaultTemplates.map((t) => t.id));
      const customOnly = idbTemplates.filter((t) => !defaultIds.has(t.id));
      return [...defaultTemplates, ...customOnly];
    }

    const raw = safeGetItem(STORAGE_KEYS.TEMPLATES);
    if (!raw) {
      for (const t of defaultTemplates) {
        await IndexedDBStorage.saveTemplate(t);
      }
      safeSetItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(defaultTemplates));
      return defaultTemplates;
    }
    try {
      const custom = JSON.parse(raw) as CatalogTemplate[];
      const defaultIds = new Set(defaultTemplates.map((t) => t.id));
      const customOnly = custom.filter((t) => !defaultIds.has(t.id));
      return [...defaultTemplates, ...customOnly];
    } catch {
      return defaultTemplates;
    }
  }

  static async saveTemplate(template: CatalogTemplate): Promise<void> {
    await IndexedDBStorage.saveTemplate(template);

    const raw = safeGetItem(STORAGE_KEYS.TEMPLATES);
    let all: CatalogTemplate[] = [...defaultTemplates];
    if (raw) {
      try {
        all = JSON.parse(raw);
      } catch {
        all = [...defaultTemplates];
      }
    }
    const index = all.findIndex((t) => t.id === template.id);
    if (index >= 0) {
      all[index] = { ...template, updatedAt: new Date().toISOString() };
    } else {
      all.push({ ...template, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    safeSetItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(all));
  }

  static async deleteTemplate(id: string): Promise<void> {
    await IndexedDBStorage.deleteTemplate(id);

    const raw = safeGetItem(STORAGE_KEYS.TEMPLATES);
    if (raw) {
      try {
        const all: CatalogTemplate[] = JSON.parse(raw);
        const filtered = all.filter((t) => t.id !== id && !t.isDefault);
        safeSetItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(filtered));
      } catch (err) {
        // Ignore
      }
    }
  }

  // --- Exports ---
  static async getExports(): Promise<ExportHistoryItem[]> {
    const idbExports = await IndexedDBStorage.getAllExports();
    if (idbExports && idbExports.length > 0) {
      return idbExports;
    }

    const raw = safeGetItem(STORAGE_KEYS.EXPORTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static async addExport(item: ExportHistoryItem): Promise<void> {
    await IndexedDBStorage.saveExport(item);

    const list = await this.getExports();
    list.unshift(item);
    safeSetItem(STORAGE_KEYS.EXPORTS, JSON.stringify(list));
  }

  static async deleteExport(id: string): Promise<void> {
    await IndexedDBStorage.deleteExport(id);

    const list = (await this.getExports()).filter((e) => e.id !== id);
    safeSetItem(STORAGE_KEYS.EXPORTS, JSON.stringify(list));
  }
}
