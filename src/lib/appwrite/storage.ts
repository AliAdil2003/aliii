import { storage, APPWRITE_CONFIG, isAppwriteConfigured } from './client';
import { ID } from 'appwrite';

export const appStorage = {
  async uploadFile(file: File): Promise<string> {
    if (!isAppwriteConfigured) {
      // In offline/local mode, convert to object URL or base64
      return URL.createObjectURL(file);
    }
    try {
      const res = await storage.createFile(APPWRITE_CONFIG.bucketId, ID.unique(), file);
      return storage.getFileView(APPWRITE_CONFIG.bucketId, res.$id).toString();
    } catch (err) {
      console.warn('Appwrite file upload failed, using blob URL:', err);
      return URL.createObjectURL(file);
    }
  },
};
