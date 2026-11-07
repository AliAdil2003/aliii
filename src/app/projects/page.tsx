'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderKanban,
  Plus,
  Search,
  FileSpreadsheet,
  Copy,
  Trash2,
  ExternalLink,
  Layers,
  ArrowRight,
  Filter,
  ShoppingCart,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { AppService } from '@/lib/appwrite/service';
import { Project, Product } from '@/types';
import NewCatalogWizard from '@/components/wizard/NewCatalogWizard';
import CatalogExcelExportModal from '@/components/excel/CatalogExcelExportModal';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingProject, setExportingProject] = useState<Project | null>(null);
  const [exportingProducts, setExportingProducts] = useState<Product[]>([]);

  const handleOpenProjectExcelExport = async (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const prods = await AppService.getProducts(proj.id);
      setExportingProducts(prods);
      setExportingProject(proj);
    } catch (err: any) {
      alert('تعذر تحميل بيانات الكتالوج: ' + (err.message || ''));
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    const p = await AppService.getProjects();
    setProjects(p);
    setLoading(false);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDuplicate = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const clonedId = 'proj_' + Date.now();
    const clonedProject: Project = {
      ...project,
      id: clonedId,
      name: `${project.name} (نسخة)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const products = await AppService.getProducts(project.id);
    const clonedProducts = products.map((p) => ({
      ...p,
      id: `prod_${clonedId}_${Math.random().toString(36).substring(2, 9)}`,
      projectId: clonedId,
    }));

    await AppService.saveProject(clonedProject);
    await AppService.saveProducts(clonedId, clonedProducts);
    await loadProjects();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('هل أنت متأكد من حذف هذا المشروع نهائياً؟')) {
      await AppService.deleteProject(id);
      await loadProjects();
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.fileName && p.fileName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black font-cairo text-slate-900 tracking-tight">
              المشاريع والكتالوجات
            </h1>
            <span className="text-xs bg-[#01334E] text-white px-2.5 py-0.5 rounded-full font-bold">
              {projects.length} كتالوج
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            جميع كتالوجات المنتجات المحفوظة وإعدادات الطباعة الجاهزة
          </p>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="px-4 py-2.5 rounded-full bg-[#01334E] hover:bg-[#023C5C] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 self-start sm:self-auto hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>+ كتالوج جديد</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3 rounded-[24px] border border-slate-100 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الكتالوج أو الملف..."
            className="w-full bg-[#ECEEF2]/60 rounded-full pr-11 pl-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#01334E] border-none"
          />
        </div>

        <div className="text-xs text-slate-500 font-bold px-3">
          إجمالي النتائج: {filteredProjects.length} مشروع
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-[28px] border border-slate-100 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {search ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد مشاريع حتى الآن'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            {search ? 'جرّب البحث باسم آخر' : 'أنشئ أول كتالوج باستخدام المعالج السريع'}
          </p>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-5 py-2.5 rounded-full bg-[#01334E] text-white text-xs font-bold hover:bg-[#023C5C] transition-transform active:scale-95 shadow-sm"
          >
            إنشاء كتالوج جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const isPO = project.type === 'purchase_order';

            return (
              <div
                key={project.id}
                onClick={() =>
                  router.push(
                    isPO ? `/purchase-order?id=${project.id}` : `/project/${project.id}`
                  )
                }
                className="bg-white rounded-[24px] border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {isPO ? (
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3 text-amber-600" />
                        طلبية مورد
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {project.settings?.template?.name || 'قالب موكسيدو الافتراضي'}
                      </span>
                    )}

                    <span
                      className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        isPO ? 'text-amber-700 bg-amber-50' : 'text-white bg-[#01334E]'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {isPO ? 'طلبية نشطة' : 'جاهز للطباعة'}
                    </span>
                  </div>

                  <h3 className="font-bold text-base transition-colors font-cairo text-slate-900 group-hover:text-black line-clamp-1">
                    {project.name}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>
                      {project.purchaseOrderData?.supplierName
                        ? `المورد: ${project.purchaseOrderData.supplierName}`
                        : project.fileName || 'ملف بيانات مستورد'}
                    </span>
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#ECEEF2]/70 p-2.5 rounded-2xl">
                      <span className="text-slate-400 block text-[10px]">
                        {isPO ? 'الأصناف' : 'المنتجات'}
                      </span>
                      <span className="font-bold text-slate-800 font-inter">
                        {project.productCount || 0} صنف
                      </span>
                    </div>

                    <div className="bg-[#ECEEF2]/70 p-2.5 rounded-2xl">
                      <span className="text-slate-400 block text-[10px]">
                        {isPO ? 'الكمية المطلوبة' : 'آخر تعديل'}
                      </span>
                      <span
                        className={`font-bold font-inter ${
                          isPO ? 'text-amber-700' : 'text-slate-800'
                        }`}
                      >
                        {isPO
                          ? `${project.purchaseOrderData?.totalRequestedQuantity || 0} قطعة`
                          : new Date(project.updatedAt).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1 text-slate-900 group-hover:underline">
                    <span>{isPO ? 'متابعة الطلبية' : 'فتح الاستوديو'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleOpenProjectExcelExport(project, e)}
                      title="تصدير الكتالوج إلى Excel (.xlsx) مع الخصم وفئة المنتج"
                      className="p-1.5 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/order/${project.id}`, '_blank');
                      }}
                      title="فتح رابط طلب الزبائن التفاعلي"
                      className="p-1.5 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDuplicate(project, e)}
                      title="تكرار"
                      className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      title="حذف"
                      className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Catalog Wizard Modal */}
      {isWizardOpen && (
        <NewCatalogWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onCreated={(id) => router.push(`/project/${id}`)}
        />
      )}

      {/* Catalog Excel Export Modal */}
      {exportingProject && (
        <CatalogExcelExportModal
          isOpen={Boolean(exportingProject)}
          onClose={() => setExportingProject(null)}
          products={exportingProducts}
          projectName={exportingProject.name}
          currency={exportingProject.settings?.defaultCurrency || 'د.ع'}
        />
      )}
    </div>
  );
}
