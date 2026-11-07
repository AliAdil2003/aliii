'use client';

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  X,
  Percent,
  Layers,
  Filter,
  CheckCircle2,
  Sliders,
  DollarSign,
  Package,
  Eye,
  Check,
  ChevronDown,
  Sparkles,
  ArrowUpDown,
  Tag,
} from 'lucide-react';
import { Product, CatalogExcelExportConfig, CatalogDiscountMode } from '@/types';
import {
  DEFAULT_EXCEL_EXPORT_CONFIG,
  exportCatalogToExcel,
  prepareCatalogExportData,
} from '@/lib/excel/catalogExport';

interface CatalogExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  projectName: string;
  currency?: string;
  initialSelectedIds?: string[];
}

export default function CatalogExcelExportModal({
  isOpen,
  onClose,
  products,
  projectName,
  currency = 'د.ع',
  initialSelectedIds = [],
}: CatalogExcelExportModalProps) {
  // تجميع كافة الفئات المتوفرة بالمنتجات
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      const c = (p.category || 'عام').trim();
      if (c) cats.add(c);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [products]);

  // إعدادات التصدير
  const [config, setConfig] = useState<CatalogExcelExportConfig>(() => ({
    ...DEFAULT_EXCEL_EXPORT_CONFIG,
    projectName: projectName || 'كتالوج المنتجات',
    currency,
    scope: initialSelectedIds.length > 0 ? 'selected' : 'included',
    selectedIds: initialSelectedIds,
    fixedDiscountPercent: 10,
    categoryDiscounts: {},
  }));

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'discount' | 'columns' | 'filters'>('discount');

  // حساب البيانات والمعاينة الفورية
  const previewData = useMemo(() => {
    return prepareCatalogExportData(products, config);
  }, [products, config]);

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      setIsExporting(true);
      const res = exportCatalogToExcel(products, {
        ...config,
        projectName: projectName || config.projectName,
        currency,
      });

      if (res.success) {
        setExportSuccess(true);
        setTimeout(() => {
          setExportSuccess(false);
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء تصدير ملف الإكسل: ' + (err.message || ''));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCategoryDiscountChange = (category: string, percent: number) => {
    setConfig((prev) => ({
      ...prev,
      categoryDiscounts: {
        ...prev.categoryDiscounts,
        [category]: Math.max(0, Math.min(100, percent)),
      },
    }));
  };

  const toggleColumn = (key: keyof typeof config.columns) => {
    setConfig((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        [key]: !prev.columns[key],
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-[28px] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        {/* ========================================== */}
        {/* Modal Header */}
        {/* ========================================== */}
        <div className="bg-[#17181D] px-6 py-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black font-cairo">تصدير الكتالوج إلى Excel (.xlsx)</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
                  مع الخصم وفئة المنتج
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                توليد جدول إكسل احترافي يحتوي على فئات المنتجات، نسب ومبالغ الخصم، والأسعار قبل وبعد الخصم
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================== */}
        {/* Live Metrics Bar */}
        {/* ========================================== */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px]">المنتجات المصدرة</span>
            <span className="font-black text-slate-900 text-sm font-inter">
              {previewData.rows.length} <span className="text-[11px] font-normal text-slate-500">منتج</span>
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px]">فئات المنتجات</span>
            <span className="font-black text-indigo-700 text-sm font-inter">
              {previewData.categoriesCount} <span className="text-[11px] font-normal text-slate-500">فئة</span>
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px]">متوسط نسبة الخصم</span>
            <span className="font-black text-emerald-600 text-sm font-inter">
              {previewData.averageDiscountPercent}%
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px]">إجمالي المخزون</span>
            <span className="font-black text-slate-900 text-sm font-inter">
              {previewData.totalStock.toLocaleString('en-US')} <span className="text-[11px] font-normal text-slate-500">قطعة</span>
            </span>
          </div>
        </div>

        {/* ========================================== */}
        {/* Modal Navigation Tabs */}
        {/* ========================================== */}
        <div className="px-6 pt-4 border-b border-slate-100 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('discount')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'discount'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>خيارات الخصم والأسعار</span>
          </button>

          <button
            onClick={() => setActiveTab('columns')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'columns'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>أعمدة الملف وفئة المنتج</span>
          </button>

          <button
            onClick={() => setActiveTab('filters')}
            className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'filters'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>نطاق المنتجات والترتيب</span>
          </button>
        </div>

        {/* ========================================== */}
        {/* Modal Body / Tab Contents */}
        {/* ========================================== */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: خيارات الخصم */}
          {activeTab === 'discount' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  طريقة احتساب الخصم في ملف الإكسل:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mode 1: Auto */}
                  <div
                    onClick={() => setConfig((prev) => ({ ...prev, discountMode: 'auto' }))}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      config.discountMode === 'auto'
                        ? 'border-emerald-500 bg-emerald-50/40 text-slate-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        حساب تلقائي من فارق السعرين
                      </span>
                      {config.discountMode === 'auto' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      يتم حساب الخصم آلياً من الفارق بين (سعر بيع الزبون) و(سعر الجملة/البيع) لكل منتج، أو من أي نسبة خصم مسجلة مسبقاً.
                    </p>
                  </div>

                  {/* Mode 2: Fixed Percent */}
                  <div
                    onClick={() => setConfig((prev) => ({ ...prev, discountMode: 'fixed_percent' }))}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      config.discountMode === 'fixed_percent'
                        ? 'border-emerald-500 bg-emerald-50/40 text-slate-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                        <Percent className="w-4 h-4 text-indigo-600" />
                        تطبيق نسبة خصم موحدة (%)
                      </span>
                      {config.discountMode === 'fixed_percent' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      تطبيق نسبة خصم مئوية موحدة (مثل 10%، 15%، 20%) على كافة المنتجات المصدرة.
                    </p>
                  </div>

                  {/* Mode 3: Per Category */}
                  <div
                    onClick={() => setConfig((prev) => ({ ...prev, discountMode: 'per_category' }))}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      config.discountMode === 'per_category'
                        ? 'border-emerald-500 bg-emerald-50/40 text-slate-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                        <Layers className="w-4 h-4 text-amber-600" />
                        خصم مخصص حسب فئة المنتج
                      </span>
                      {config.discountMode === 'per_category' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      تحديد نسبة خصم مستقلة لكل فئة من فئات المنتجات (مثلاً: إكسسوارات 20%، شواحن 10%).
                    </p>
                  </div>

                  {/* Mode 4: Fixed Amount */}
                  <div
                    onClick={() => setConfig((prev) => ({ ...prev, discountMode: 'fixed_amount' }))}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      config.discountMode === 'fixed_amount'
                        ? 'border-emerald-500 bg-emerald-50/40 text-slate-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                        <DollarSign className="w-4 h-4 text-teal-600" />
                        مبلغ خصم ثابت ({currency})
                      </span>
                      {config.discountMode === 'fixed_amount' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      خصم مبلغ نقدي محدد وثابت من سعر كل قطعة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fixed Percent Selector */}
              {config.discountMode === 'fixed_percent' && (
                <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 space-y-3">
                  <span className="text-xs font-bold text-indigo-950 block">
                    حدد نسبة الخصم المئوية المطلوبة:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[5, 10, 15, 20, 25, 30, 40, 50].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, fixedDiscountPercent: rate }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-inter transition-all ${
                          config.fixedDiscountPercent === rate
                            ? 'bg-indigo-600 text-white shadow-sm scale-105'
                            : 'bg-white text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                    <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-xl border border-indigo-200">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.fixedDiscountPercent}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            fixedDiscountPercent: Math.max(0, Math.min(100, Number(e.target.value))),
                          }))
                        }
                        className="w-14 text-center font-bold text-xs outline-none font-inter"
                      />
                      <span className="text-xs font-bold text-indigo-800">%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Fixed Amount Selector */}
              {config.discountMode === 'fixed_amount' && (
                <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-100 space-y-2">
                  <span className="text-xs font-bold text-teal-950 block">
                    أدخل مبلغ الخصم المالي لكل قطعة ({currency}):
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={config.fixedDiscountAmount}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          fixedDiscountAmount: Math.max(0, Number(e.target.value)),
                        }))
                      }
                      className="px-3 py-2 bg-white rounded-xl border border-teal-200 text-sm font-bold font-inter outline-none w-48 text-slate-900"
                      placeholder="مثال: 5000"
                    />
                    <span className="text-xs font-bold text-teal-800">{currency}</span>
                  </div>
                </div>
              )}

              {/* Per Category Discounts Table */}
              {config.discountMode === 'per_category' && (
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-700" />
                      تحديد نسب الخصم بحسب فئات المنتجات ({availableCategories.length} فئة):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultMap: Record<string, number> = {};
                        availableCategories.forEach((c) => (defaultMap[c] = 10));
                        setConfig((prev) => ({ ...prev, categoryDiscounts: defaultMap }));
                      }}
                      className="text-[11px] text-amber-800 underline font-bold"
                    >
                      تعيين 10% للجميع
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {availableCategories.map((cat) => {
                      const count = products.filter((p) => (p.category || 'عام').trim() === cat).length;
                      const currentVal = config.categoryDiscounts[cat] ?? 0;

                      return (
                        <div
                          key={cat}
                          className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-amber-100 text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{cat}</span>
                            <span className="text-[10px] text-slate-400 font-inter">
                              ({count} منتج)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={currentVal}
                                onChange={(e) =>
                                  handleCategoryDiscountChange(cat, Number(e.target.value))
                                }
                                className="w-12 text-center text-xs font-bold font-inter outline-none bg-transparent"
                              />
                              <span className="text-slate-500 font-bold">%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: الأعمدة وفئة المنتج */}
          {activeTab === 'columns' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 flex items-start gap-3">
                <Tag className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">
                    فئة المنتج والخصم مدمجان في ملف Excel
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                    يحتوي الملف المصدر على عمود <strong>فئة المنتج</strong> بشكل بارز في بداية الجدول لتسهيل الفرز والتصنيف، بالإضافة لأعمدة الخصم المالي والنسبي.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  اختر الأعمدة التي ترغب بتضمينها في ورقة الإكسل:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                  {[
                    { key: 'category', label: 'فئة المنتج', badge: 'موصى به', color: 'bg-emerald-50 text-emerald-700' },
                    { key: 'originalPrice', label: `السعر قبل الخصم (${currency})`, badge: 'أساسي' },
                    { key: 'discountPercent', label: 'نسبة الخصم %', badge: 'أساسي' },
                    { key: 'discountAmount', label: `مبلغ الخصم (${currency})`, badge: 'أساسي' },
                    { key: 'finalPrice', label: `السعر بعد الخصم (${currency})`, badge: 'أساسي' },
                    { key: 'name', label: 'اسم المنتج' },
                    { key: 'barcode', label: 'الباركود' },
                    { key: 'internalReference', label: 'المرجع الداخلي (SKU)' },
                    { key: 'stock', label: 'المخزون المتوفر' },
                    { key: 'salePrice', label: `سعر الجملة (${currency})` },
                    { key: 'unit', label: 'الوحدة' },
                    { key: 'status', label: 'الحالة في الكتالوج' },
                    { key: 'shopifyUrl', label: 'رابط الشراء أونلاين' },
                    { key: 'description', label: 'الوصف' },
                    { key: 'index', label: 'تسلسل (#)' },
                  ].map((col) => {
                    const isChecked = config.columns[col.key as keyof typeof config.columns];
                    return (
                      <div
                        key={col.key}
                        onClick={() => toggleColumn(col.key as keyof typeof config.columns)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-50/40 text-slate-900 font-bold'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-md flex items-center justify-center ${
                              isChecked ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span>{col.label}</span>
                        </div>
                        {col.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              col.color || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {col.badge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: الفلاتر والنطاق */}
          {activeTab === 'filters' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-2">
                  نطاق المنتجات المراد تصديرها:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div
                    onClick={() => setConfig((prev) => ({ ...prev, scope: 'included' }))}
                    className={`p-3 rounded-xl border cursor-pointer ${
                      config.scope === 'included'
                        ? 'border-emerald-500 bg-emerald-50/40 font-bold text-slate-900'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>المنتجات المدرجة بالكتالوج</span>
                      {config.scope === 'included' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {products.filter((p) => p.includedInCatalog).length} منتج
                    </span>
                  </div>

                  <div
                    onClick={() => setConfig((prev) => ({ ...prev, scope: 'all' }))}
                    className={`p-3 rounded-xl border cursor-pointer ${
                      config.scope === 'all'
                        ? 'border-emerald-500 bg-emerald-50/40 font-bold text-slate-900'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>جميع منتجات المشروع</span>
                      {config.scope === 'all' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {products.length} منتج
                    </span>
                  </div>

                  {initialSelectedIds.length > 0 && (
                    <div
                      onClick={() => setConfig((prev) => ({ ...prev, scope: 'selected' }))}
                      className={`p-3 rounded-xl border cursor-pointer ${
                        config.scope === 'selected'
                          ? 'border-emerald-500 bg-emerald-50/40 font-bold text-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>المنتجات المحددة فقط</span>
                        {config.scope === 'selected' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {initialSelectedIds.length} منتج محدد
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, sortByCategory: !prev.sortByCategory }))
                  }
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={config.sortByCategory}
                    readOnly
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="font-bold text-slate-800">
                    ترتيب وفرز المنتجات في ملف الإكسل بحسب فئة المنتج
                  </span>
                </label>

                <label
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      excludeOutOfStock: !prev.excludeOutOfStock,
                    }))
                  }
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={config.excludeOutOfStock}
                    readOnly
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="font-bold text-slate-800">
                    استبعاد المنتجات نافذة المخزون (الكمية = 0)
                  </span>
                </label>

                <label
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      includeSummary: !prev.includeSummary,
                    }))
                  }
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={config.includeSummary}
                    readOnly
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="font-bold text-slate-800">
                    تضمين ترويسة معلومات الكتالوج وصف الإجماليات في أعلى وأسفل الورقة
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* Quick Preview Table (Sample 3 rows) */}
          {/* ========================================== */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                معاينة عينة من أسطر الإكسل ({Math.min(3, previewData.rows.length)} من {previewData.rows.length}):
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                الاتجاه في الإكسل: من اليمين لليسار (RTL)
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto text-xs bg-slate-50/50">
              <table className="w-full text-right">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    {config.columns.category && <th className="p-2 text-indigo-700">فئة المنتج</th>}
                    {config.columns.name && <th className="p-2">اسم المنتج</th>}
                    {config.columns.barcode && <th className="p-2">الباركود</th>}
                    {config.columns.originalPrice && <th className="p-2">السعر الأصلي</th>}
                    {config.columns.discountPercent && <th className="p-2 text-emerald-700">نسبة الخصم</th>}
                    {config.columns.discountAmount && <th className="p-2 text-emerald-700">مبلغ الخصم</th>}
                    {config.columns.finalPrice && <th className="p-2 text-slate-900 font-black">السعر النهائي</th>}
                    {config.columns.stock && <th className="p-2">المخزون</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {previewData.rows.slice(0, 3).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {config.columns.category && (
                        <td className="p-2 font-bold text-indigo-700 whitespace-nowrap">
                          {r.category}
                        </td>
                      )}
                      {config.columns.name && (
                        <td className="p-2 font-medium max-w-[180px] truncate">{r.name}</td>
                      )}
                      {config.columns.barcode && (
                        <td className="p-2 font-mono text-[11px] text-slate-500">{r.barcode || '—'}</td>
                      )}
                      {config.columns.originalPrice && (
                        <td className="p-2 font-inter whitespace-nowrap">
                          {r.originalPrice.toLocaleString('en-US')} {currency}
                        </td>
                      )}
                      {config.columns.discountPercent && (
                        <td className="p-2 font-bold text-emerald-600 font-inter">
                          {r.discountPercent}%
                        </td>
                      )}
                      {config.columns.discountAmount && (
                        <td className="p-2 font-bold text-emerald-700 font-inter whitespace-nowrap">
                          {r.discountAmount.toLocaleString('en-US')} {currency}
                        </td>
                      )}
                      {config.columns.finalPrice && (
                        <td className="p-2 font-black text-slate-950 font-inter whitespace-nowrap">
                          {r.finalPrice.toLocaleString('en-US')} {currency}
                        </td>
                      )}
                      {config.columns.stock && (
                        <td className="p-2 font-inter font-bold">{r.stock}</td>
                      )}
                    </tr>
                  ))}
                  {previewData.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-400">
                        لا توجد منتجات تطابق الفلاتر المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* Modal Footer Actions */}
        {/* ========================================== */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            جاهز لتصدير <strong className="text-slate-900 font-inter">{previewData.rows.length}</strong> صنف مع فئاتهم وخصوماتهم
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors flex-1 sm:flex-initial"
            >
              إلغاء
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting || previewData.rows.length === 0}
              className={`px-6 py-2.5 rounded-full font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 flex-1 sm:flex-initial ${
                exportSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105 active:scale-95 disabled:opacity-50'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري إنشاء ملف Excel...</span>
                </>
              ) : exportSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم التصدير بنجاح!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تصدير ملف Excel (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
