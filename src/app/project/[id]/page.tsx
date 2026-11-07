'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Palette,
  Download,
  Save,
  Sparkles,
  ArrowRight,
  Layers,
  SlidersHorizontal,
  CheckCircle2,
  RefreshCw,
  Eye,
  Scissors,
  AlertCircle,
  LayoutGrid,
  Columns2,
  Maximize2,
  Search,
  Filter,
  Package,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  Share2,
} from 'lucide-react';
import { AppService } from '@/lib/appwrite/service';
import { Project, Product, CatalogTemplate } from '@/types';
import { defaultTemplates } from '@/lib/templates/defaultTemplates';
import ProductDataTable from '@/components/product-table/ProductDataTable';
import CatalogDesigner from '@/components/designer/CatalogDesigner';
import LivePagePreview from '@/components/designer/LivePagePreview';
import DescriptionShortenerModal from '@/components/ai/DescriptionShortenerModal';
import NameShortenerModal from '@/components/ai/NameShortenerModal';
import PDFExportModal from '@/components/pdf/PDFExportModal';
import TemplateManagerModal from '@/components/templates/TemplateManagerModal';
import CustomerOrderShareModal from '@/components/share/CustomerOrderShareModal';
import CatalogExcelExportModal from '@/components/excel/CatalogExcelExportModal';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [template, setTemplate] = useState<CatalogTemplate>(defaultTemplates[0]);
  
  // Tri-Mode Workspace: 'table' (Data Hub) | 'split' (Interactive Split Studio) | 'designer' (Full Canvas DTP)
  const [activeView, setActiveView] = useState<'table' | 'split' | 'designer'>('table');
  const [splitSearch, setSplitSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Modals state
  const [isShortenerOpen, setIsShortenerOpen] = useState(false);
  const [shortenerSelectedIds, setShortenerSelectedIds] = useState<string[]>([]);
  const [isNameShortenerOpen, setIsNameShortenerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExcelExportModalOpen, setIsExcelExportModalOpen] = useState(false);
  const [excelSelectedIds, setExcelSelectedIds] = useState<string[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSyncingOdoo, setIsSyncingOdoo] = useState(false);

  const handleSyncFromOdoo = async () => {
    if (!project || products.length === 0) return;
    try {
      setIsSyncingOdoo(true);
      setSaveStatus('جاري المزامنة مع Odoo...');

      const syncPayload = products.map((p) => ({
        id: p.id,
        odooId: p.odooId,
        internalReference: p.internalReference,
        barcode: p.barcode,
        category: p.category,
      }));

      const projectCategories = Array.from(
        new Set(products.map((p) => p.category).filter((c) => Boolean(c) && c !== 'عام'))
      );

      const res = await fetch('/api/odoo/sync-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: syncPayload,
          projectId: project.id,
          categories: projectCategories,
          autoAddNewProducts: true,
          enrichWithShopify: true,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'فشلت المزامنة مع Odoo');
      }

      let updatedProducts = [...products];

      if (data.updates && data.updates.length > 0) {
        const updateMap = new Map<string, any>(data.updates.map((u: any) => [u.id, u]));
        updatedProducts = updatedProducts.map((p) => {
          const u = updateMap.get(p.id);
          if (u) {
            return {
              ...p,
              stock: u.stock,
              customerPrice: u.customerPrice,
              salePrice: u.salePrice ?? p.salePrice,
              price: u.customerPrice,
              odooId: u.odooId || p.odooId,
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        });
      }

      // If new products were found in Odoo, append them to the project!
      if (data.newProducts && Array.isArray(data.newProducts) && data.newProducts.length > 0) {
        updatedProducts = [...updatedProducts, ...data.newProducts];
      }

      await handleUpdateProducts(updatedProducts);

      let msg = `تم تحديث ${data.updatedCount || 0} منتج بنجاح`;
      if (data.newCount && data.newCount > 0) {
        msg = `تم تحديث ${data.updatedCount || 0} منتج وإضافة ${data.newCount} منتج جديد من Odoo للملف!`;
      }
      setSaveStatus(msg);
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (err: any) {
      setSaveStatus('خطأ: ' + (err.message || 'فشلت المزامنة'));
      setTimeout(() => setSaveStatus(null), 4000);
    } finally {
      setIsSyncingOdoo(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setNotFound(false);
    let proj: Project | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      proj = await AppService.getProject(projectId);
      if (proj) break;
      await new Promise((res) => setTimeout(res, 300));
    }

    if (!proj) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    setProject(proj);
    setTemplate(proj.settings?.template || defaultTemplates[0]);

    const prods = await AppService.getProducts(projectId);
    setProducts(prods);
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      load();
    }
  }, [projectId]);

  const handleUpdateProducts = async (updated: Product[]) => {
    setProducts(updated);
    await AppService.saveProducts(projectId, updated);
  };

  const handleUpdateTemplate = async (updated: CatalogTemplate) => {
    setTemplate(updated);
    if (project) {
      const updatedProj: Project = {
        ...project,
        settings: {
          ...project.settings,
          template: updated,
        },
      };
      setProject(updatedProj);
      await AppService.saveProject(updatedProj);
    }
  };

  const handleManualSave = async () => {
    if (!project) return;
    setSaveStatus('جاري الحفظ...');
    const updatedProj: Project = {
      ...project,
      productCount: products.length,
      includedProductCount: products.filter((p) => p.includedInCatalog).length,
      settings: {
        ...project.settings,
        template,
      },
      updatedAt: new Date().toISOString(),
    };
    await AppService.saveProject(updatedProj);
    await AppService.saveProducts(projectId, products);
    setSaveStatus('تم الحفظ بنجاح');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // Toggle inclusion of single product in split view
  const handleToggleProductInclusion = (productId: string) => {
    const updated = products.map((p) =>
      p.id === productId ? { ...p, includedInCatalog: !p.includedInCatalog } : p
    );
    handleUpdateProducts(updated);
  };

  // Filtered products for Split View quick list
  const splitFilteredProducts = useMemo(() => {
    if (!splitSearch.trim()) return products;
    const q = splitSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, splitSearch]);

  const includedCount = useMemo(
    () => products.filter((p) => p.includedInCatalog).length,
    [products]
  );

  if (notFound) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[60vh]">
        <div className="bg-white rounded-[28px] border border-slate-100 p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black font-cairo text-slate-900">
            تعذر العثور على هذا الكتالوج
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            قد يكون هذا الكتالوج قيد المعالجة أو تم نقله. يمكنك إعادة المحاولة الآن أو الرجوع إلى لوحة التحكم.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => load()}
              className="px-4 py-2.5 rounded-full bg-[#17181D] hover:bg-black text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
            <Link
              href="/projects"
              className="px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
            >
              العودة للمشاريع
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !project) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-white px-6 py-3.5 rounded-full shadow-sm border border-slate-100">
          <RefreshCw className="w-4 h-4 animate-spin text-[#17181D]" />
          <span>جاري تحميل بيانات واستوديو الكتالوج...</span>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Full DTP Canvas Designer Mode
  // --------------------------------------------------------------------------
  if (activeView === 'designer') {
    return (
      <CatalogDesigner
        project={project}
        products={products}
        template={template}
        onChangeTemplate={handleUpdateTemplate}
        onSaveProject={handleManualSave}
        onBackToTable={() => setActiveView('table')}
        onOpenShortener={() => {
          setShortenerSelectedIds([]);
          setIsShortenerOpen(true);
        }}
        onUpdateProducts={handleUpdateProducts}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* ========================================================= */}
      {/* 1. Executive Studio Control Bar */}
      {/* ========================================================= */}
      <div className="bg-[#17181D] rounded-[28px] p-5 sm:p-6 text-white shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-5 border border-white/5">
        <div>
          {/* Breadcrumb & Project Tag */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Link
              href="/projects"
              className="text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <span>المشاريع</span>
              <span>/</span>
            </Link>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white text-[#01334E]">
              كتالوج نشط
            </span>
            <span className="text-xs text-slate-400">
              الملف: <span className="text-slate-200 font-bold">{project.fileName || 'مخزن Odoo'}</span>
            </span>
          </div>

          {/* Project Title */}
          <h1 className="text-xl sm:text-2xl font-black font-cairo text-white tracking-tight">
            {project.name}
          </h1>

          {/* Live Metric Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-2.5">
            <span className="bg-white/10 px-3 py-1 rounded-full font-bold">
              إجمالي المنتجات: <strong className="text-white font-inter">{products.length}</strong>
            </span>
            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
              جاهز للطباعة: <strong className="font-inter">{includedCount}</strong>
            </span>
            <span className="bg-white/10 px-3 py-1 rounded-full">
              القالب: <strong className="text-white font-bold">{template.name}</strong>
            </span>
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mr-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              مزامنة فورية
            </span>
          </div>
        </div>

        {/* View Switcher Segmented Control & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* View Mode Segmented Pill Switcher */}
          <div className="bg-white/10 p-1 rounded-full flex items-center gap-1 border border-white/10 self-start sm:self-auto">
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all ${
                activeView === 'table'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>جدول البيانات</span>
            </button>

            <button
              onClick={() => setActiveView('split')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all ${
                activeView === 'split'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>المصمم المقسم</span>
              <span className="text-[9px] bg-[#01334E] text-white px-1.5 py-0.2 rounded-full font-black">
                سريع
              </span>
            </button>

            <button
              onClick={() => setActiveView('designer')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-white transition-all hover:bg-white/10"
            >
              <Palette className="w-3.5 h-3.5 text-sky-400" />
              <span>المصمم الكامل</span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {saveStatus && (
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1 bg-emerald-950/70 px-3 py-1.5 rounded-full border border-emerald-600 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {saveStatus}
              </span>
            )}

            <button
              onClick={handleSyncFromOdoo}
              disabled={isSyncingOdoo}
              title="مزامنة المخزون والأسعار وإضافة المنتجات الجديدة من Odoo تلقائياً للملف"
              className="px-3.5 py-2 rounded-full bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/30 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncingOdoo ? 'animate-spin' : ''}`} />
              <span>{isSyncingOdoo ? 'جاري المزامنة...' : 'تحديث Odoo (+منتجات جديدة)'}</span>
            </button>

            <button
              onClick={() => setIsNameShortenerOpen(true)}
              title="اختصار أسماء المنتجات عبر الذكاء الاصطناعي"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-orange-300 text-xs font-bold transition-colors"
            >
              <Scissors className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setShortenerSelectedIds([]);
                setIsShortenerOpen(true);
              }}
              title="اختصار الأوصاف التسويقية عبر Gemini"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-amber-300 text-xs font-bold transition-colors"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsTemplatesModalOpen(true)}
              title="تغيير واختيار قالب التصميم"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-purple-300 text-xs font-bold transition-colors"
            >
              <Layers className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2.5 rounded-full bg-white hover:bg-slate-100 text-[#01334E] font-black text-xs transition-all shadow-md flex items-center gap-1.5 hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>تصدير PDF (300 DPI)</span>
            </button>

            <button
              onClick={() => {
                setExcelSelectedIds([]);
                setIsExcelExportModalOpen(true);
              }}
              title="تصدير بيانات الكتالوج إلى ملف Excel (.xlsx) متضمناً نسب ومبالغ الخصم وفئات المنتجات"
              className="px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md flex items-center gap-1.5 hover:scale-105 active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>تصدير Excel للكتالوج</span>
            </button>

            <button
              onClick={() => setIsShareModalOpen(true)}
              title="مشاركة رابط الكتالوج مع الزبائن لاختيار عدد القطع وإصدار PDF"
              className="px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-1.5 hover:scale-105 active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة رابط الطلب للزبائن</span>
            </button>

            <button
              onClick={handleManualSave}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="حفظ التغييرات"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. Workspace View: Full Table vs Split Studio */}
      {/* ========================================================= */}
      {activeView === 'table' ? (
        /* Full Data Hub View */
        <ProductDataTable
          products={products}
          onUpdateProducts={handleUpdateProducts}
          onOpenShortener={(ids) => {
            setShortenerSelectedIds(ids);
            setIsShortenerOpen(true);
          }}
          onOpenExcelExport={(selectedIds) => {
            setExcelSelectedIds(selectedIds || []);
            setIsExcelExportModalOpen(true);
          }}
          currency={project.settings?.defaultCurrency || 'د.ع'}
          onUpdateCategoryOrder={(categoryOrder) => {
            handleUpdateTemplate({
              ...template,
              categoryGrouping: {
                enabled: true,
                categoryOrder,
                showHeader: template.categoryGrouping?.showHeader ?? true,
                showProductCount: template.categoryGrouping?.showProductCount ?? true,
                headerBackground: template.categoryGrouping?.headerBackground || '#0f172a',
                headerTextColor: template.categoryGrouping?.headerTextColor || '#38bdf8',
                headerFontSize: template.categoryGrouping?.headerFontSize || 11,
                pageBreakPerCategory: template.categoryGrouping?.pageBreakPerCategory ?? false,
              },
            });
          }}
        />
      ) : (
        /* Split Interactive Studio View (Live Preview + Quick Controller) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT/RIGHT CONTROLLER: Compact Product List (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-[28px] border border-slate-100 p-5 shadow-sm space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Columns2 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900 font-cairo">
                  التحكم السريع في المنتجات
                </h3>
              </div>
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                {splitFilteredProducts.length} صنف
              </span>
            </div>

            {/* Quick Search in Split Mode */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={splitSearch}
                onChange={(e) => setSplitSearch(e.target.value)}
                placeholder="بحث سريع بالاسم، الباركود، الفئة..."
                className="w-full bg-[#ECEEF2]/70 rounded-full pr-9 pl-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#01334E] border-none"
              />
            </div>

            {/* Products Quick Reorder & Toggle List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {splitFilteredProducts.map((p, idx) => {
                const isIncluded = Boolean(p.includedInCatalog);
                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs ${
                      isIncluded
                        ? 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
                        : 'bg-slate-50/70 border-dashed border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Inclusion Checkbox */}
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => handleToggleProductInclusion(p.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title={isIncluded ? 'استبعاد من الطباعة' : 'تضمين في الطباعة'}
                      />

                      {/* Image Thumbnail */}
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {p.imageData ? (
                          <img
                            src={p.imageData}
                            alt={p.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      {/* Product Name & Details */}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate font-cairo">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{p.category || 'عام'}</span>
                          <span>•</span>
                          <span className="font-inter">{p.barcode || 'بدون باركود'}</span>
                          <span>•</span>
                          <span className="font-bold text-slate-700 font-inter">
                            {Number(p.customerPrice || 0).toLocaleString()} {project.settings?.defaultCurrency || 'د.ع'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Pill */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        (p.stock || 0) > 5
                          ? 'bg-emerald-50 text-emerald-700'
                          : (p.stock || 0) > 0
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {p.stock ?? 0} بالمخزن
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Split Footer Hint */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>أي تعديل هنا ينعكس فوراً على المعاينة المجاورة.</span>
              <button
                onClick={() => setActiveView('designer')}
                className="font-bold text-indigo-600 hover:text-indigo-700"
              >
                تخصيص القالب والخطوط ↗
              </button>
            </div>
          </div>

          {/* RIGHT/LEFT PREVIEW: Live Reactive Page Preview (7 Cols) */}
          <div className="lg:col-span-7 bg-[#01334E] rounded-[28px] p-5 shadow-sm text-white max-h-[85vh] overflow-y-auto flex flex-col items-center border border-white/10">
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white font-cairo">المعاينة الحية للكتالوج</span>
                <span className="text-[10px] bg-white text-[#01334E] px-2 py-0.5 rounded-full font-bold">
                  300 DPI
                </span>
              </div>
              <button
                onClick={() => setActiveView('designer')}
                className="text-xs text-white/80 hover:text-white flex items-center gap-1 font-bold"
              >
                <Maximize2 className="w-3 h-3 text-white" />
                <span>تكبير المصمم الكامل</span>
              </button>
            </div>

            {/* Embedded Live Page Preview Canvas */}
            <div className="w-full flex justify-center py-2">
              <LivePagePreview
                products={products}
                template={template}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. Global AI & Export Modals */}
      {/* ========================================================= */}
      <NameShortenerModal
        isOpen={isNameShortenerOpen}
        onClose={() => setIsNameShortenerOpen(false)}
        products={products}
        selectedProductIds={[]}
        onApplyShortenedNames={handleUpdateProducts}
      />

      <DescriptionShortenerModal
        isOpen={isShortenerOpen}
        onClose={() => setIsShortenerOpen(false)}
        products={products}
        selectedProductIds={shortenerSelectedIds}
        onApplyShortenedDescriptions={handleUpdateProducts}
      />

      <PDFExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        products={products}
        template={template}
        projectName={project.name}
        projectId={project.id}
      />

      <CatalogExcelExportModal
        isOpen={isExcelExportModalOpen}
        onClose={() => setIsExcelExportModalOpen(false)}
        products={products}
        projectName={project.name}
        currency={project.settings?.defaultCurrency || 'د.ع'}
        initialSelectedIds={excelSelectedIds}
      />

      <TemplateManagerModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        currentTemplate={template}
        onApplyTemplate={handleUpdateTemplate}
      />

      <CustomerOrderShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        project={project}
      />
    </div>
  );
}
