import { Client, Account, Databases, Storage } from 'appwrite';

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';

export const isAppwriteConfigured = Boolean(
  projectId && projectId.trim() !== '' && projectId !== 'YOUR_PROJECT_ID'
);

export const client = new Client();

if (isAppwriteConfigured) {
  client.setEndpoint(endpoint).setProject(projectId);
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const APPWRITE_CONFIG = {
  databaseId: process.env.APPWRITE_DATABASE_ID || 'catalog_studio',
  bucketId: process.env.APPWRITE_BUCKET_ID || 'catalog_files',
  collections: {
    users: 'users',
    projects: 'projects',
    products: 'products',
    templates: 'templates',
    exports: 'exports',
    projectSettings: 'project_settings',
    descriptionVersions: 'description_versions',
  },
};
