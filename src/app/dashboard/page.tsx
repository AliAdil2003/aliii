'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Upload,
  FolderKanban,
  FileSpreadsheet,
  FileText,
  Clock,
  Layers,
  Copy,
  Trash2,
  ExternalLink,
  Sparkles,
  Download,
  AlertCircle,
  PackageCheck,
  CheckCircle2,
  Warehouse,
  ShoppingCart,
  Zap,
  Heart,
  Activity,
  MoreVertical,
  Moon,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { AppService } from '@/lib/appwrite/service';
import { Project, CatalogTemplate, ExportHistoryItem } from '@/types';
import NewCatalogWizard from '@/components/wizard/NewCatalogWizard';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<CatalogTemplate[]>([]);
  const [exportsList, setExportsList] = useState<ExportHistoryItem[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [p, t, e] = await Promise.all([
      AppService.getProjects(),
      AppService.getTemplates(),
      AppService.getExports(),
    ]);
    setProjects(p);
    setTemplates(t);
    setExportsList(e);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    if (searchParams.get('action') === 'new') {
      setIsWizardOpen(true);
    }
  }, [searchParams]);

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
    await loadData();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('هل أنت متأكد من حذف هذا الكتالوج؟ لن يتأثر ملف Excel الأصلي.')) {
      await AppService.deleteProject(id);
      await loadData();
    }
  };

  const totalProducts = projects.reduce((acc, curr) => acc + (curr.productCount || 0), 0);

  return (
    <div className="space-y-7">
      {/* ========================================================= */}
      {/* 1. Header Overview (Matching "Health Overview" in reference) */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-slate-900 tracking-tight">
            نظرة عامة على الكتالوجات والمخزن
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            تحكم كامل في كتالوجات المنتجات، المخزون الحي، والربط المباشر مع Odoo و Shopify!
          </p>
        </div>

        {/* Action Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2.5 rounded-full bg-[#01334E] hover:bg-[#023C5C] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>+ كتالوج جديد</span>
          </button>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-xs flex items-center gap-2 border border-slate-200/60"
            title="جلب المنتجات ومزامنة المخزون مباشرة من نظام Odoo ERP"
          >
            <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
            <span>مخزن Odoo ERP</span>
          </button>

          <Link
            href="/purchase-order"
            className="px-4 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-xs flex items-center gap-2 border border-slate-200/60"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
            <span>طلبية المورد</span>
          </Link>

          <div className="px-4 py-2.5 rounded-full bg-white shadow-xs text-xs font-bold text-slate-700 flex items-center gap-1.5 border border-slate-200/60">
            <span>اليوم</span>
            <span className="text-[10px] text-slate-400">▾</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. Visual Analytics Widgets (Exact Layout from Reference Image) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* --------------------------------------------------------- */}
        {/* CARD 1 (Left / Energy Used Style): Bubbles & Progress */}
        {/* --------------------------------------------------------- */}
        <div className="lg:col-span-4 bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-slate-900" />
                </div>
                <span>إجمالي المنتجات</span>
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {/* Big Stat with +5% Lime Badge */}
            <div className="flex items-baseline gap-2.5 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-inter">
                {totalProducts > 0 ? totalProducts.toLocaleString() : '4,3k'}
              </span>
              <span className="text-[11px] font-bold text-slate-400">صنف مسجل</span>
              <span className="text-[10px] font-black bg-[#01334E] text-white px-2 py-0.5 rounded-full">
                +5%
              </span>
            </div>

            {/* Overlapping Visual Bubbles (Matching reference diagram) */}
            <div className="relative h-44 my-4 flex items-center justify-center">
              {/* Navy Surface Bubble */}
              <div className="absolute left-6 w-28 h-28 rounded-full bg-[#023C5C] flex flex-col items-center justify-center text-white font-inter shadow-inner z-10 transition-transform hover:scale-105">
                <span className="font-black text-xl leading-none">2,6k</span>
                <span className="text-[10px] font-bold text-white/90 mt-0.5 font-cairo">متوفر في المخزن</span>
              </div>

              {/* Deep Navy Bubble */}
              <div className="absolute right-10 top-4 w-24 h-24 rounded-full bg-[#012336] flex flex-col items-center justify-center text-white font-inter shadow-lg z-20 transition-transform hover:scale-105 border border-white/10">
                <span className="font-black text-lg leading-none">1,2k</span>
                <span className="text-[9px] font-bold text-slate-300 mt-0.5 font-cairo">مخزن Odoo</span>
              </div>

              {/* Navy Accent Bubble */}
              <div className="absolute right-20 bottom-1 w-20 h-20 rounded-full bg-[#01334E] flex flex-col items-center justify-center text-white font-inter shadow-md z-30 transition-transform hover:scale-105 border border-white/20">
                <span className="font-black text-base leading-none">500</span>
                <span className="text-[9px] font-extrabold text-white mt-0.5 font-cairo">Shopify</span>
              </div>
            </div>
          </div>

          {/* Progress Bars (Matching reference) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-900 font-inter">45%</span>
                <span className="text-slate-500 font-normal flex items-center gap-1.5">
                  <span>منتجات مع الصور والباركود</span>
                  <span className="w-2 h-2 rounded-full bg-[#B6B5FF]"></span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#B6B5FF] rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-900 font-inter">30%</span>
                <span className="text-slate-500 font-normal flex items-center gap-1.5">
                  <span>مزامنة المخزون الحي</span>
                  <span className="w-2 h-2 rounded-full bg-[#17181D]"></span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#17181D] rounded-full" style={{ width: '30%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-900 font-inter">25%</span>
                <span className="text-slate-500 font-normal flex items-center gap-1.5">
                  <span>وصف وروابط شوبيفاي</span>
                  <span className="w-2 h-2 rounded-full bg-[#01334E]"></span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#01334E] rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* CARD 2 & 3 (Center): Metric Cards + Dark Analytics Card */}
        {/* --------------------------------------------------------- */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Top Row: Two Compact Metric Cards (Heart Rate & Activity Style) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Heart Rate / Connection Status */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>ربط Odoo</span>
                </div>
                <MoreVertical className="w-3.5 h-3.5 text-slate-300" />
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 font-inter">100%</span>
                  <span className="text-[10px] text-emerald-600 font-bold">متصل</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">مخزن E-Zone</p>
              </div>
            </div>

            {/* Activity / DPI Quality */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Activity className="w-3.5 h-3.5 text-sky-500" />
                  <span>دقة الطباعة</span>
                </div>
                <MoreVertical className="w-3.5 h-3.5 text-slate-300" />
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 font-inter">300</span>
                  <span className="text-[10px] text-sky-600 font-bold">DPI</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">جاهز للطباعة A4</p>
              </div>
            </div>
          </div>

          {/* Bottom Card: Dark Analytics Card (Sleep Analysis Style from Reference) */}
          <div className="bg-[#01334E] text-white rounded-[28px] p-6 shadow-sm flex-1 flex flex-col justify-between relative overflow-hidden border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Moon className="w-4 h-4 text-white/80" />
                <span>تحليلات الإنتاج والتصدير</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer">
                <span>شهرياً</span>
                <span>▾</span>
              </div>
            </div>

            {/* Metrics with Color Bar Indicators */}
            <div className="grid grid-cols-2 gap-4 my-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-8 rounded-full bg-white"></div>
                <div>
                  <span className="text-xl font-black text-white font-inter">85%</span>
                  <span className="text-[10px] text-slate-300 block -mt-1 font-cairo">كفاءة الكتالوج</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-8 rounded-full bg-white/40"></div>
                <div>
                  <span className="text-xl font-black text-white font-inter">
                    {exportsList.length > 0 ? exportsList.length : '12'}
                  </span>
                  <span className="text-[10px] text-slate-300 block -mt-1 font-cairo">كتالوج مُصدّر</span>
                </div>
              </div>
            </div>

            {/* Striped Bar Chart Graphic (Matching reference styling) */}
            <div className="pt-4 border-t border-white/10">
              <div className="h-24 flex items-end justify-between gap-1.5 px-1">
                {/* Column 1 */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-white/10 rounded-full h-12"></div>
                  <span className="text-[9px] text-slate-400 font-inter">يناير</span>
                </div>

                {/* Column 2 */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-white/10 rounded-full h-16"></div>
                  <span className="text-[9px] text-slate-400 font-inter">فبراير</span>
                </div>

                {/* Column 3 */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-white/10 rounded-full h-14"></div>
                  <span className="text-[9px] text-slate-400 font-inter">مارس</span>
                </div>

                {/* Column 4 - Active White */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-white rounded-full h-22 shadow-md shadow-white/20"></div>
                  <span className="text-[9px] text-white font-black font-inter">أبريل ↗</span>
                </div>

                {/* Column 5 - Active White/60 */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-white/60 rounded-full h-18"></div>
                  <span className="text-[9px] text-white/80 font-bold font-inter">مايو</span>
                </div>

                {/* Column 6 */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-white/10 rounded-full h-14"></div>
                  <span className="text-[9px] text-slate-400 font-inter">يونيو</span>
                </div>

                {/* Column 7 */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-white/10 rounded-full h-16"></div>
                  <span className="text-[9px] text-slate-400 font-inter">يوليو</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* CARD 4 (Right / Wellness Index Style): Dot Matrix Grid */}
        {/* --------------------------------------------------------- */}
        <div className="lg:col-span-4 bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <span className="text-base font-black font-inter">%</span>
                <span>مؤشر الجاهزية والجودة</span>
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {/* Big Stat with +10% Lime Badge */}
            <div className="flex items-baseline gap-2.5 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-inter">
                78
              </span>
              <span className="text-xs font-bold text-slate-400">%</span>
              <span className="text-[10px] font-black bg-[#01334E] text-white px-2 py-0.5 rounded-full">
                +10%
              </span>
            </div>

            {/* Dot Matrix Visual (Matching reference diagram) */}
            <div className="py-6 flex items-center justify-center">
              <div className="grid grid-cols-7 gap-2.5">
                {[
                  0.3, 0.4, 0.7, 0.5, 0.9, 0.4, 0.6,
                  0.5, 0.8, 0.4, 0.6, 0.7, 0.8, 0.9,
                  0.4, 0.6, 0.5, 0.8, 0.4, 0.9, 0.5,
                  0.7, 0.5, 0.8, 0.9, 0.6, 0.7, 0.8,
                  0.3, 0.9, 0.6, 0.4, 0.8, 0.5, 0.7,
                ].map((intensity, idx) => {
                  const isNavy = idx === 11 || idx === 25;
                  const isHighlighted = intensity > 0.6;
                  return (
                    <div
                      key={idx}
                      style={{ opacity: isNavy ? 1 : intensity }}
                      className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 cursor-pointer ${
                        isNavy
                          ? 'bg-[#01334E]'
                          : isHighlighted
                          ? 'bg-[#023C5C]'
                          : 'bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>تحديث المخزون والأسعار</span>
            <span className="font-bold text-slate-800">تلقائي فوري</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. Projects Section (Clean White Cards) */}
      {/* ========================================================= */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black font-cairo text-slate-900 tracking-tight">
              المشاريع والكتالوجات الحالية
            </h2>
            <p className="text-xs text-slate-500">
              افتح أي مشروع لبدء التعديل، اختصار الأوصاف، أو توليد ملف الـ PDF
            </p>
          </div>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs border border-slate-200/60 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#01334E]" />
            <span>مشروع جديد</span>
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-[28px] border border-slate-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">لا توجد مشاريع حتى الآن</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              ابدأ برفع ملف Excel أو استورد مباشرة من مخزن Odoo لإنشاء أول كتالوج
            </p>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-5 py-2.5 rounded-full bg-[#01334E] hover:bg-[#023C5C] text-white text-xs font-bold transition-transform active:scale-95 shadow-sm"
            >
              إنشاء أول كتالوج الآن
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project) => {
              const isPO = project.type === 'purchase_order';

              return (
                <div
                  key={project.id}
                  onClick={() =>
                    router.push(
                      isPO ? `/purchase-order?id=${project.id}` : `/project/${project.id}`
                    )
                  }
                  className="bg-white rounded-[24px] border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all cursor-pointer flex flex-col justify-between group"
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
                          isPO
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-white bg-[#01334E]'
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
                        onClick={(e) => handleDuplicate(project, e)}
                        title={isPO ? 'تكرار الطلبية' : 'تكرار الكتالوج'}
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
      </div>

      {/* Global New Catalog Wizard Modal */}
      {isWizardOpen && (
        <NewCatalogWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onCreated={(id) => router.push(`/project/${id}`)}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-12 text-slate-500 font-bold">
          جاري تحميل لوحة التحكم...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
