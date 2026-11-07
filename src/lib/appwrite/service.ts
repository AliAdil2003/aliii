import {
  client,
  account,
  databases,
  storage,
  isAppwriteConfigured,
  APPWRITE_CONFIG,
} from './client';
import { LocalStorageAdapter, LocalUser } from './fallbackAdapter';
import { Project, Product, CatalogTemplate, ExportHistoryItem } from '@/types';
import { ID, Query } from 'appwrite';

export const AppService = {
  // Auth
  async getCurrentUser(): Promise<LocalUser | null> {
    if (!isAppwriteConfigured) {
      return await LocalStorageAdapter.getCurrentUser();
    }
    try {
      const res = await account.get();
      return {
        id: res.$id,
        name: res.name || 'مستخدم الكتالوج',
        email: res.email,
      };
    } catch {
      return await LocalStorageAdapter.getCurrentUser();
    }
  },

  async login(email: string, password: string): Promise<LocalUser> {
    if (!isAppwriteConfigured) {
      const user: LocalUser = {
        id: 'usr_' + Date.now(),
        name: email.split('@')[0] || 'مدير الكتالوج',
        email,
      };
      await LocalStorageAdapter.setCurrentUser(user);
      return user;
    }
    try {
      await account.createEmailPasswordSession(email, password);
      const res = await account.get();
      return {
        id: res.$id,
        name: res.name || 'مستخدم الكتالوج',
        email: res.email,
      };
    } catch (err: any) {
      throw new Error(err.message || 'فشل تسجيل الدخول عبر Appwrite');
    }
  },

  async logout(): Promise<void> {
    if (!isAppwriteConfigured) {
      await LocalStorageAdapter.setCurrentUser(null);
      return;
    }
    try {
      await account.deleteSession('current');
    } catch (err) {
      console.warn('Logout session delete error:', err);
    }
    await LocalStorageAdapter.setCurrentUser(null);
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    if (!isAppwriteConfigured) {
      return await LocalStorageAdapter.getProjects();
    }
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.projects,
        [Query.orderDesc('$updatedAt')]
      );
      return res.documents.map((doc: any) => ({
        id: doc.$id,
        userId: doc.userId,
        name: doc.name,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        rowCount: doc.rowCount,
        columnCount: doc.columnCount,
        detectedColumns: JSON.parse(doc.detectedColumns || '[]'),
        columnMapping: JSON.parse(doc.columnMapping || '{}'),
        settings: JSON.parse(doc.settings || '{}'),
        productCount: doc.productCount,
        includedProductCount: doc.includedProductCount,
        createdAt: doc.$createdAt,
        updatedAt: doc.$updatedAt,
      }));
    } catch {
      return await LocalStorageAdapter.getProjects();
    }
  },

  async getProject(id: string): Promise<Project | null> {
    if (!isAppwriteConfigured) {
      return await LocalStorageAdapter.getProject(id);
    }
    try {
      const doc: any = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.projects,
        id
      );
      return {
        id: doc.$id,
        userId: doc.userId,
        name: doc.name,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        rowCount: doc.rowCount,
        columnCount: doc.columnCount,
        detectedColumns: JSON.parse(doc.detectedColumns || '[]'),
        columnMapping: JSON.parse(doc.columnMapping || '{}'),
        settings: JSON.parse(doc.settings || '{}'),
        productCount: doc.productCount,
        includedProductCount: doc.includedProductCount,
        createdAt: doc.$createdAt,
        updatedAt: doc.$updatedAt,
      };
    } catch {
      return await LocalStorageAdapter.getProject(id);
    }
  },

  async saveProject(project: Project): Promise<void> {
    await LocalStorageAdapter.saveProject(project);
    if (!isAppwriteConfigured) return;

    try {
      const payload = {
        userId: project.userId,
        name: project.name,
        fileName: project.fileName,
        fileSize: project.fileSize,
        rowCount: project.rowCount,
        columnCount: project.columnCount,
        detectedColumns: JSON.stringify(project.detectedColumns),
        columnMapping: JSON.stringify(project.columnMapping),
        settings: JSON.stringify(project.settings),
        productCount: project.productCount,
        includedProductCount: project.includedProductCount,
      };

      try {
        await databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.projects,
          project.id,
          payload
        );
      } catch {
        await databases.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.projects,
          project.id,
          payload
        );
      }
    } catch (err) {
      console.warn('Appwrite sync project error, saved locally:', err);
    }
  },

  async deleteProject(id: string): Promise<void> {
    await LocalStorageAdapter.deleteProject(id);
    if (!isAppwriteConfigured) return;
    try {
      await databases.deleteDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.projects,
        id
      );
    } catch (err) {
      console.warn('Appwrite delete project error:', err);
    }
  },

  // Products
  async getProducts(projectId: string): Promise<Product[]> {
    if (!isAppwriteConfigured) {
      return await LocalStorageAdapter.getProducts(projectId);
    }
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.products,
        [Query.equal('projectId', projectId), Query.limit(5000), Query.orderAsc('order')]
      );
      if (res.documents.length === 0) {
        return await LocalStorageAdapter.getProducts(projectId);
      }
      return res.documents.map((d: any) => ({
        id: d.$id,
        projectId: d.projectId,
        name: d.name,
        originalName: d.originalName || d.name,
        shortenedName: d.shortenedName || '',
        activeNameType: d.activeNameType || 'original',
        originalDescription: d.originalDescription,
        shortenedDescription: d.shortenedDescription,
        customDescription: d.customDescription,
        activeDescriptionType: d.activeDescriptionType || 'original',
        barcode: d.barcode,
        price: d.price,
        salePrice: d.salePrice ?? d.price,
        customerPrice: d.customerPrice ?? d.price,
        stock: d.stock,
        category: d.category,
        internalReference: d.internalReference,
        unit: d.unit,
        currency: d.currency,
        imageData: d.imageData,
        imageStatus: d.imageStatus || 'valid',
        includedInCatalog: d.includedInCatalog !== false,
        order: d.order || 1,
        createdAt: d.$createdAt,
        updatedAt: d.$updatedAt,
      }));
    } catch {
      return await LocalStorageAdapter.getProducts(projectId);
    }
  },

  async saveProducts(projectId: string, products: Product[]): Promise<void> {
    await LocalStorageAdapter.saveProducts(projectId, products);
  },

  // Templates
  async getTemplates(): Promise<CatalogTemplate[]> {
    return await LocalStorageAdapter.getTemplates();
  },

  async saveTemplate(template: CatalogTemplate): Promise<void> {
    await LocalStorageAdapter.saveTemplate(template);
  },

  async deleteTemplate(id: string): Promise<void> {
    await LocalStorageAdapter.deleteTemplate(id);
  },

  // Exports
  async getExports(): Promise<ExportHistoryItem[]> {
    return await LocalStorageAdapter.getExports();
  },

  async addExport(item: ExportHistoryItem): Promise<void> {
    await LocalStorageAdapter.addExport(item);
  },

  async deleteExport(id: string): Promise<void> {
    await LocalStorageAdapter.deleteExport(id);
  },
};
