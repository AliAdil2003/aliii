import { AppService } from './service';

export const db = {
  getProjects: () => AppService.getProjects(),
  getProject: (id: string) => AppService.getProject(id),
  saveProject: (p: any) => AppService.saveProject(p),
  deleteProject: (id: string) => AppService.deleteProject(id),
  getProducts: (projectId: string) => AppService.getProducts(projectId),
  saveProducts: (projectId: string, products: any[]) => AppService.saveProducts(projectId, products),
  getTemplates: () => AppService.getTemplates(),
  saveTemplate: (t: any) => AppService.saveTemplate(t),
  deleteTemplate: (id: string) => AppService.deleteTemplate(id),
};
