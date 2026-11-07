'use client';

import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Type,
  Image as ImageIcon,
  DollarSign,
  Barcode as BarcodeIcon,
  LayoutTemplate,
  ChevronDown,
  Palette,
  Columns,
  Maximize,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Upload,
  Trash2,
  Sparkles,
  FileImage,
  Check,
  ArrowUp,
  ArrowDown,
  Plus,
  RotateCcw,
  Edit2,
  GripVertical,
  Eye,
  EyeOff,
  FolderTree,
  Tag,
  ListOrdered,
} from 'lucide-react';
import { CatalogTemplate, TableColumnConfig, CategoryGroupingSettings, Product } from '@/types';
import { DEFAULT_HEADER_BANNER } from '@/lib/templates/headerBanner';

interface PropertiesPanelProps {
  template: CatalogTemplate;
  onChangeTemplate: (updated: CatalogTemplate) => void;
  products?: Product[];
}

export default function PropertiesPanel({
  template,
  onChangeTemplate,
  products = [],
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<
    'table' | 'categories' | 'typography' | 'image' | 'price_barcode' | 'header_footer'
  >('table');

  const [selectedTypographyElement, setSelectedTypographyElement] = useState<
    keyof CatalogTemplate['typography']
  >('productName');

  const updateTemplate = (updater: (prev: CatalogTemplate) => CatalogTemplate) => {
    onChangeTemplate(updater(template));
  };

  const [showAddColumnMenu, setShowAddColumnMenu] = useState(false);

  const AVAILABLE_COLUMNS_OPTIONS: {
    key: string;
    label: string;
    defaultWidth: number;
    defaultAlignment: 'right' | 'center' | 'left';
  }[] = [
    { key: 'imageData', label: 'الصورة', defaultWidth: 10, defaultAlignment: 'center' },
    { key: 'name', label: 'اسم المنتج ورابط الشراء', defaultWidth: 26, defaultAlignment: 'right' },
    { key: 'description', label: 'الوصف', defaultWidth: 22, defaultAlignment: 'right' },
    { key: 'barcode', label: 'الباركود', defaultWidth: 14, defaultAlignment: 'center' },
    { key: 'category', label: 'الفئة / المرجع', defaultWidth: 12, defaultAlignment: 'center' },
    { key: 'customerPrice', label: 'سعر الزبون', defaultWidth: 12, defaultAlignment: 'center' },
    { key: 'salePrice', label: 'سعر البيع', defaultWidth: 12, defaultAlignment: 'center' },
    { key: 'price', label: 'السعر العام', defaultWidth: 12, defaultAlignment: 'center' },
    { key: 'stock', label: 'المخزون المتوفر', defaultWidth: 10, defaultAlignment: 'center' },
    { key: 'internalReference', label: 'المرجع الداخلي', defaultWidth: 12, defaultAlignment: 'center' },
  ];

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    updateTemplate((prev) => {
      const cols = [...prev.table.columns];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= cols.length) return prev;

      const temp = cols[index];
      cols[index] = cols[targetIndex];
      cols[targetIndex] = temp;

      const reordered = cols.map((col, idx) => ({ ...col, order: idx + 1 }));
      return {
        ...prev,
        table: {
          ...prev.table,
          columns: reordered,
        },
      };
    });
  };

  const updateColumn = (index: number, updates: Partial<TableColumnConfig>) => {
    updateTemplate((prev) => {
      const newCols = [...prev.table.columns];
      newCols[index] = { ...newCols[index], ...updates };
      return {
        ...prev,
        table: {
          ...prev.table,
          columns: newCols,
        },
      };
    });
  };

  const removeColumn = (index: number) => {
    updateTemplate((prev) => {
      if (prev.table.columns.length <= 1) return prev;
      const newCols = prev.table.columns.filter((_, idx) => idx !== index);
      const reordered = newCols.map((col, idx) => ({ ...col, order: idx + 1 }));
      return {
        ...prev,
        table: {
          ...prev.table,
          columns: reordered,
        },
      };
    });
  };

  const addColumn = (
    key: string,
    label: string,
    defaultWidth: number = 14,
    defaultAlignment: 'right' | 'center' | 'left' = 'center'
  ) => {
    updateTemplate((prev) => {
      const newCol: TableColumnConfig = {
        id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        key: key as any,
        label,
        width: defaultWidth,
        visible: true,
        alignment: defaultAlignment,
        order: prev.table.columns.length + 1,
      };
      return {
        ...prev,
        table: {
          ...prev.table,
          columns: [...prev.table.columns, newCol],
        },
      };
    });
    setShowAddColumnMenu(false);
  };

  const autoBalanceWidths = () => {
    updateTemplate((prev) => {
      const visibleCols = prev.table.columns.filter((c) => c.visible);
      if (visibleCols.length === 0) return prev;
      const totalWidth = visibleCols.reduce((sum, c) => sum + (c.width || 0), 0);

      const newCols = prev.table.columns.map((c) => {
        if (!c.visible) return c;
        const normalized = Math.max(5, Math.round((c.width / (totalWidth || 1)) * 100));
        return { ...c, width: normalized };
      });

      const currentSum = newCols.filter((c) => c.visible).reduce((s, c) => s + c.width, 0);
      const diff = 100 - currentSum;
      if (diff !== 0) {
        const lastVisibleIdx = newCols.map((c, i) => (c.visible ? i : -1)).filter((i) => i !== -1).pop();
        if (lastVisibleIdx !== undefined && lastVisibleIdx !== -1) {
          newCols[lastVisibleIdx] = {
            ...newCols[lastVisibleIdx],
            width: Math.max(5, newCols[lastVisibleIdx].width + diff),
          };
        }
      }

      return {
        ...prev,
        table: {
          ...prev.table,
          columns: newCols,
        },
      };
    });
  };

  const resetDefaultColumns = () => {
    updateTemplate((prev) => ({
      ...prev,
      table: {
        ...prev.table,
        columns: [
          { id: 'col_img', key: 'imageData' as any, label: 'الصورة', width: 12, visible: true, alignment: 'center', order: 1 },
          { id: 'col_name', key: 'name', label: 'اسم المنتج والوصف', width: 38, visible: true, alignment: 'right', order: 2 },
          { id: 'col_barcode', key: 'barcode', label: 'الباركود', width: 14, visible: true, alignment: 'center', order: 3 },
          { id: 'col_cat', key: 'category', label: 'الفئة / المرجع', width: 12, visible: true, alignment: 'center', order: 4 },
          { id: 'col_customer_price', key: 'customerPrice' as any, label: 'سعر الزبون', width: 12, visible: true, alignment: 'center', order: 5 },
          { id: 'col_sale_price', key: 'salePrice' as any, label: 'سعر البيع', width: 12, visible: true, alignment: 'center', order: 6 },
        ],
      },
    }));
  };

  const totalVisibleWidth = template.table.columns
    .filter((c) => c.visible)
    .reduce((sum, c) => sum + (c.width || 0), 0);

  // Category Grouping calculations & helpers
  const productCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (products && products.length > 0) {
      products.forEach((p) => {
        if (p.includedInCatalog) {
          const cat = (p.category && p.category.trim()) || 'عام';
          counts[cat] = (counts[cat] || 0) + 1;
        }
      });
    }
    return counts;
  }, [products]);

  const distinctCategories = useMemo(() => {
    const cats = Object.keys(productCategoryCounts);
    return cats.length > 0 ? cats : ['عام'];
  }, [productCategoryCounts]);

  const categoryGrouping: CategoryGroupingSettings = template.categoryGrouping || {
    enabled: true,
    categoryOrder: distinctCategories,
    showHeader: true,
    headerBackground: '#0f172a',
    headerTextColor: '#ffffff',
    headerFontSize: 10,
    showProductCount: true,
    pageBreakPerCategory: false,
  };

  const orderedCategories = useMemo(() => {
    const saved = categoryGrouping.categoryOrder || [];
    const fromSaved = saved.filter((cat) => distinctCategories.includes(cat));
    const remaining = distinctCategories.filter((cat) => !saved.includes(cat));
    return [...fromSaved, ...remaining];
  }, [categoryGrouping.categoryOrder, distinctCategories]);

  const updateCategoryGrouping = (updates: Partial<CategoryGroupingSettings>) => {
    updateTemplate((prev) => ({
      ...prev,
      categoryGrouping: {
        ...(prev.categoryGrouping || {
          enabled: true,
          categoryOrder: orderedCategories,
          showHeader: true,
          headerBackground: '#0f172a',
          headerTextColor: '#ffffff',
          headerFontSize: 10,
          showProductCount: true,
          pageBreakPerCategory: false,
        }),
        ...updates,
      },
    }));
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const currentList = [...orderedCategories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const temp = currentList[index];
    currentList[index] = currentList[targetIndex];
    currentList[targetIndex] = temp;

    updateCategoryGrouping({
      categoryOrder: currentList,
      enabled: true,
    });
  };

  const sortCategoriesAlphabetical = () => {
    const sorted = [...orderedCategories].sort((a, b) => a.localeCompare(b, 'ar'));
    updateCategoryGrouping({ categoryOrder: sorted, enabled: true });
  };

  const sortCategoriesByCount = () => {
    const sorted = [...orderedCategories].sort(
      (a, b) => (productCategoryCounts[b] || 0) - (productCategoryCounts[a] || 0)
    );
    updateCategoryGrouping({ categoryOrder: sorted, enabled: true });
  };

  const resetCategoryOrder = () => {
    updateCategoryGrouping({ categoryOrder: distinctCategories });
  };

  const sortCategoriesWithAI = async () => {
    // Commercial catalog sequence: شواحن أولاً، ثم كابلات، ثم بنوك طاقة، ثم صوتيات، ثم ساعات، إلخ.
    const priorityCategories = [
      'شواحن وبطاريات',
      'شواحن',
      'كابلات وتوصيلات',
      'كابلات',
      'كيبلات',
      'بنوك طاقة (Power Banks)',
      'بنوك طاقة',
      'بور بانك',
      'باور بانك',
      'صوتيات وسماعات',
      'صوتيات',
      'سماعات',
      'ساعات ذكية وملحقاتها',
      'ساعات ذكية',
      'ساعات',
      'ملحقات وشواحن سيارات',
      'ملحقات سيارات',
      'حوامل ومثبتات الهواتف',
      'حوامل',
      'محولات وموزعات Hubs',
      'محولات',
      'حماية وكفرات',
      'حماية',
      'ملحقات حواسيب وإلكترونيات',
      'أجهزة وإلكترونيات متنوعة',
      'عام',
    ];

    const getScore = (cat: string) => {
      const lower = cat.toLowerCase();
      const idx = priorityCategories.findIndex((p) =>
        lower.includes(p.toLowerCase()) || p.toLowerCase().includes(lower)
      );
      return idx >= 0 ? idx : 999;
    };

    const sorted = [...orderedCategories].sort((a, b) => {
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.localeCompare(b, 'ar');
    });

    updateCategoryGrouping({ categoryOrder: sorted, enabled: true });

    // Deep reordering via Google Gemini if available
    try {
      const dummyProducts = orderedCategories.map((cat, i) => ({
        id: `cat-${i}`,
        name: cat,
        category: cat,
      }));
      const res = await fetch('/api/ai/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: dummyProducts }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.recommendedCategoryOrder) && data.recommendedCategoryOrder.length > 0) {
          const finalOrder = [
            ...data.recommendedCategoryOrder.filter((c: string) => orderedCategories.includes(c)),
            ...orderedCategories.filter((c: string) => !data.recommendedCategoryOrder.includes(c)),
          ];
          updateCategoryGrouping({ categoryOrder: finalOrder, enabled: true });
        }
      }
    } catch {
      // Keep heuristic sorted
    }
  };

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800 text-white flex flex-col h-full select-none overflow-hidden">
      {/* Panel Top Tabs */}
      <div className="bg-slate-950 border-b border-slate-800 p-1.5 grid grid-cols-6 gap-1 text-center">
        <button
          onClick={() => setActiveTab('table')}
          title="إعدادات الصفحة والجدول"
          className={`py-2 rounded-lg text-xs font-bold transition-colors flex flex-col items-center gap-1 ${
            activeTab === 'table'
              ? 'bg-sky-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="text-[9px]">الجدول</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          title="تصنيف وترتيب تسلسل الفئات"
          className={`py-2 rounded-lg text-xs font-bold transition-colors flex flex-col items-center gap-1 ${
            activeTab === 'categories'
              ? 'bg-sky-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="text-[9px]">الفئات</span>
        </button>

        <button
          onClick={() => setActiveTab('typography')}
          title="إعدادات الخطوط والنصوص"
          className={`py-2 rounded-lg text-xs font-bold transition-colors flex flex-col items-center gap-1 ${
            activeTab === 'typography'
              ? 'bg-sky-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span className="text-[9px]">الخط</span>
        </button>

        <button
          onClick={() => setActiveTab('image')}
          title="إعدادات صورة المنتج"
          className={`py-2 rounded-lg text-xs font-bold transition-colors flex flex-col items-center gap-1 ${
            activeTab === 'image'
              ? 'bg-sky-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span className="text-[9px]">الصورة</span>
        </button>

        <button
          onClick={() => setActiveTab('price_barcode')}
          title="السعر والباركود"
          className={`py-2 rounded-lg text-xs font-bold transition-colors flex flex-col items-center gap-1 ${
            activeTab === 'price_barcode'
              ? 'bg-sky-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span className="text-[9px]">السعر</span>
        </button>

        <button
          onClick={() => setActiveTab('header_footer')}
          title="الترويسة والتذييل"
          className={`py-2 rounded-lg text-xs font-bold transition-colors flex flex-col items-center gap-1 ${
            activeTab === 'header_footer'
              ? 'bg-sky-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          <span className="text-[9px]">الهيدر</span>
        </button>
      </div>

      {/* Panel Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
        {/* TAB 1: TABLE & PAGE SETTINGS */}
        {activeTab === 'table' && (
          <div className="space-y-5">
            {/* Page Size & Orientation */}
            <div className="space-y-3">
              <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
                إعدادات الصفحة (Page Setup)
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">قياس الورق</label>
                  <select
                    value={template.page.size}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        page: { ...prev.page, size: e.target.value as any },
                      }))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="A4">A4 (قياسي)</option>
                    <option value="A3">A3 (كتالوج كبير)</option>
                    <option value="A5">A5 (كتيب صغير)</option>
                    <option value="letter">Letter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">الاتجاه</label>
                  <select
                    value={template.page.orientation}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        page: { ...prev.page, orientation: e.target.value as any },
                      }))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="portrait">عمودي (Portrait)</option>
                    <option value="landscape">أفقي (Landscape)</option>
                  </select>
                </div>
              </div>

              {/* Margins */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  الهوامش (Margins بالملليمتر)
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div>
                    <span className="text-[9px] text-slate-500 block">أعلى</span>
                    <input
                      type="number"
                      value={template.page.margins.top}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          page: {
                            ...prev.page,
                            margins: { ...prev.page.margins, top: Number(e.target.value) },
                          },
                        }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">أسفل</span>
                    <input
                      type="number"
                      value={template.page.margins.bottom}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          page: {
                            ...prev.page,
                            margins: { ...prev.page.margins, bottom: Number(e.target.value) },
                          },
                        }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">يمين</span>
                    <input
                      type="number"
                      value={template.page.margins.right}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          page: {
                            ...prev.page,
                            margins: { ...prev.page.margins, right: Number(e.target.value) },
                          },
                        }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">يسار</span>
                    <input
                      type="number"
                      value={template.page.margins.left}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          page: {
                            ...prev.page,
                            margins: { ...prev.page.margins, left: Number(e.target.value) },
                          },
                        }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-800" />

            {/* Table Rows & Heights */}
            <div className="space-y-3">
              <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
                صفوف الجدول (Row Dimensions)
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    ارتفاع الصف ({template.table.rowHeight}px)
                  </label>
                  <input
                    type="range"
                    min={60}
                    max={160}
                    value={template.table.rowHeight}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        table: { ...prev.table, rowHeight: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    الهامش الداخلي للخلية (Padding)
                  </label>
                  <input
                    type="number"
                    value={template.table.cellPadding.top}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        table: {
                          ...prev.table,
                          cellPadding: {
                            top: Number(e.target.value),
                            bottom: Number(e.target.value),
                            left: Number(e.target.value),
                            right: Number(e.target.value),
                          },
                        },
                      }))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-center font-bold"
                  />
                </div>
              </div>

              {/* Header & Row Backgrounds */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">خلفية ترويسة الجدول</label>
                  <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <input
                      type="color"
                      value={template.table.headerBackground}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          table: { ...prev.table, headerBackground: e.target.value },
                        }))
                      }
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[10px] font-mono text-slate-300">
                      {template.table.headerBackground}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">خلفية الصفوف البديلة</label>
                  <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <input
                      type="color"
                      value={template.table.alternateRowBackground || '#f8fafc'}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          table: { ...prev.table, alternateRowBackground: e.target.value },
                        }))
                      }
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[10px] font-mono text-slate-300">
                      {template.table.alternateRowBackground || '#f8fafc'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-800" />

            {/* Column Order, Labels, Widths & Visibility */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sky-400 text-xs uppercase tracking-wider">
                    أعمدة الجدول والترتيب
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    تقديم وتأخير الأعمدة وتعديل العرض والتسمية
                  </p>
                </div>
                <div
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    totalVisibleWidth === 100
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}
                  title={totalVisibleWidth === 100 ? 'العرض متطابق 100%' : 'مجموع العرض يجب أن يكون 100%'}
                >
                  المجموع: {totalVisibleWidth}%
                </div>
              </div>

              {/* Action Buttons: Auto-balance & Reset */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={autoBalanceWidths}
                  className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                  title="توزيع العرض تلقائياً ليصبح المجموع 100%"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>موازنة 100%</span>
                </button>
                <button
                  type="button"
                  onClick={resetDefaultColumns}
                  className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
                  title="استعادة ترتيب وأعمدة الجدول الافتراضية"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>الافتراضي</span>
                </button>
              </div>

              {/* Column Cards */}
              <div className="space-y-2">
                {template.table.columns.map((col, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === template.table.columns.length - 1;

                  return (
                    <div
                      key={col.id || `col_${idx}`}
                      className={`p-2.5 rounded-xl border transition-all ${
                        col.visible
                          ? 'bg-slate-800/90 border-slate-700 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800/60 opacity-60'
                      }`}
                    >
                      {/* Top Row: Reorder Buttons, Badge, Title Input, Toggle & Delete */}
                      <div className="flex items-center gap-1.5">
                        {/* Order Badge */}
                        <span
                          className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 text-sky-400 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                          title={`الترتيب: #${idx + 1}`}
                        >
                          {idx + 1}
                        </span>

                        {/* Move Up Button (moves to the right in RTL / closer to start) */}
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => moveColumn(idx, 'up')}
                          className={`p-1 rounded border transition-colors ${
                            isFirst
                              ? 'text-slate-600 border-slate-800 cursor-not-allowed'
                              : 'text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-700 border-slate-700'
                          }`}
                          title="تقديم للأمام (لليمين في الجدول)"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>

                        {/* Move Down Button (moves to the left in RTL / closer to end) */}
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => moveColumn(idx, 'down')}
                          className={`p-1 rounded border transition-colors ${
                            isLast
                              ? 'text-slate-600 border-slate-800 cursor-not-allowed'
                              : 'text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-700 border-slate-700'
                          }`}
                          title="تأخير للخلف (لليسار في الجدول)"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>

                        {/* Column Label Input */}
                        <input
                          type="text"
                          value={col.label}
                          onChange={(e) => updateColumn(idx, { label: e.target.value })}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-sky-500 placeholder-slate-500"
                          placeholder="اسم العمود"
                          title="تعديل تسمية العمود"
                        />

                        {/* Visibility Toggle Button */}
                        <button
                          type="button"
                          onClick={() => updateColumn(idx, { visible: !col.visible })}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            col.visible
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                              : 'text-slate-500 bg-slate-900 border-slate-800'
                          }`}
                          title={col.visible ? 'إخفاء العمود من الجدول' : 'إظهار العمود في الجدول'}
                        >
                          {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        {/* Remove Column Button */}
                        {template.table.columns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColumn(idx)}
                            className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                            title="حذف العمود من الجدول"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Bottom Row: Alignment and Width Settings */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-700/60 text-[10px]">
                        {/* Alignment Selector */}
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-[10px]">المحاذاة:</span>
                          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateColumn(idx, { alignment: 'right' })}
                              className={`p-1 rounded ${
                                col.alignment === 'right' || (!col.alignment && col.key === 'name')
                                  ? 'bg-sky-500 text-slate-950 font-bold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="محاذاة لليمين"
                            >
                              <AlignRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateColumn(idx, { alignment: 'center' })}
                              className={`p-1 rounded ${
                                col.alignment === 'center' || (!col.alignment && col.key !== 'name')
                                  ? 'bg-sky-500 text-slate-950 font-bold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="محاذاة للوسط"
                            >
                              <AlignCenter className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateColumn(idx, { alignment: 'left' })}
                              className={`p-1 rounded ${
                                col.alignment === 'left'
                                  ? 'bg-sky-500 text-slate-950 font-bold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="محاذاة لليسار"
                            >
                              <AlignLeft className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Width Input */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[10px]">العرض:</span>
                          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5">
                            <input
                              type="number"
                              min={5}
                              max={80}
                              value={col.width}
                              onChange={(e) =>
                                updateColumn(idx, {
                                  width: Math.max(5, Math.min(80, Number(e.target.value) || 5)),
                                })
                              }
                              className="w-8 bg-transparent text-center text-xs font-bold text-sky-400 focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Column Dropdown / Button */}
              <div className="pt-1">
                {showAddColumnMenu ? (
                  <div className="p-3 bg-slate-800/95 border border-slate-700 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-400">
                      <span>اختر العمود المراد إضافته:</span>
                      <button
                        type="button"
                        onClick={() => setShowAddColumnMenu(false)}
                        className="text-slate-400 hover:text-white text-[11px]"
                      >
                        إلغاء ×
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                      {AVAILABLE_COLUMNS_OPTIONS.map((opt) => {
                        const isAlreadyAdded = template.table.columns.some((c) => c.key === opt.key);
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => addColumn(opt.key, opt.label, opt.defaultWidth, opt.defaultAlignment)}
                            className={`p-2 rounded-lg border text-right text-xs transition-colors flex items-center justify-between ${
                              isAlreadyAdded
                                ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                : 'bg-slate-900 border-slate-700 text-white hover:bg-slate-700 hover:border-sky-500'
                            }`}
                          >
                            <span className="truncate">{opt.label}</span>
                            <Plus className="w-3 h-3 text-sky-400 flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddColumnMenu(true)}
                    className="w-full py-2 bg-slate-800/70 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-sky-500 rounded-xl text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة عمود جديد إلى الجدول</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: CATEGORIES & GROUPING */}
        {activeTab === 'categories' && (
          <div className="space-y-5">
            {/* Master Toggle */}
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">تصنيف الكتالوج حسب الفئة</h4>
                  <p className="text-[10px] text-slate-400">
                    تجميع المنتجات وعرضها بتسلسل الفئات المخصص
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryGrouping.enabled}
                    onChange={(e) => updateCategoryGrouping({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              <div className="bg-sky-950/40 border border-sky-800/50 rounded-lg p-2.5 text-[10px] text-sky-300 flex items-start gap-2 leading-relaxed">
                <Sparkles className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <span>
                  استخدم أزرار الأسهم (<strong className="text-white">↑</strong> / <strong className="text-white">↓</strong>) أدناه لترتيب تسلسل ظهور الفئات في الكتالوج (مثلاً: <strong>شاحن</strong> أولاً، ثم <strong>كيبل</strong>، ثم <strong>بور بانك</strong>...).
                </span>
              </div>
            </div>

            {/* Quick Sort Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5" />
                  ترتيب تسلسل الفئات ({orderedCategories.length})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  إجمالي المنتجات: {products.filter((p) => p.includedInCatalog).length}
                </span>
              </div>

              <button
                type="button"
                onClick={sortCategoriesWithAI}
                className="w-full py-2 px-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm shadow-sky-600/20"
                title="ترتيب تجاري تلقائي بالذكاء الاصطناعي (شواحن، ثم كابلات، ثم بنوك طاقة...)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>ترتيب تجاري ذكي بالذكاء الاصطناعي (Gemini)</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={sortCategoriesAlphabetical}
                  className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-[10px] font-medium transition-colors"
                  title="ترتيب أبجدي من أ إلى ي"
                >
                  أبجدي (أ - ي)
                </button>
                <button
                  type="button"
                  onClick={sortCategoriesByCount}
                  className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-[10px] font-medium transition-colors"
                  title="الفئات التي تحتوي منتجات أكثر تظهر أولاً"
                >
                  الأكثر منتجات
                </button>
                <button
                  type="button"
                  onClick={resetCategoryOrder}
                  className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-lg text-[10px] transition-colors"
                  title="استعادة الترتيب التلقائي"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Reorderable Categories List */}
            <div className="space-y-1.5">
              {orderedCategories.map((cat, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === orderedCategories.length - 1;
                const count = productCategoryCounts[cat] || 0;

                return (
                  <div
                    key={cat}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      categoryGrouping.enabled
                        ? 'bg-slate-800/90 border-slate-700 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Sequence Badge */}
                      <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 text-sky-400 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>

                      {/* Reorder Buttons */}
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={isFirst || !categoryGrouping.enabled}
                          onClick={() => moveCategory(idx, 'up')}
                          className={`p-1 rounded border transition-colors ${
                            isFirst || !categoryGrouping.enabled
                              ? 'text-slate-600 border-slate-800 cursor-not-allowed'
                              : 'text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-700 border-slate-700'
                          }`}
                          title="تقديم الفئة للأعلى لتظهر أولاً في الكتالوج"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast || !categoryGrouping.enabled}
                          onClick={() => moveCategory(idx, 'down')}
                          className={`p-1 rounded border transition-colors ${
                            isLast || !categoryGrouping.enabled
                              ? 'text-slate-600 border-slate-800 cursor-not-allowed'
                              : 'text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-700 border-slate-700'
                          }`}
                          title="تأخير الفئة للأسفل لتظهر لاحقاً في الكتالوج"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Category Label */}
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-xs text-white truncate block">
                          {cat}
                        </span>
                      </div>
                    </div>

                    {/* Count Badge */}
                    <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-full text-[10px] font-bold text-sky-400 font-mono flex-shrink-0">
                      {count} منتج
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-slate-800" />

            {/* Display & Header Styling Options */}
            <div className="space-y-3">
              <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
                خيارات ترويسة وفواصل الفئات
              </h4>

              {/* Show Header Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                <span className="text-xs font-bold text-white">
                  إظهار شريط فاصل لكل فئة في الجدول والكتالوج
                </span>
                <input
                  type="checkbox"
                  checked={categoryGrouping.showHeader}
                  onChange={(e) => updateCategoryGrouping({ showHeader: e.target.checked })}
                  className="rounded border-slate-600 text-sky-500 focus:ring-0"
                />
              </div>

              {/* Show Count Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                <span className="text-xs font-bold text-white">
                  إظهار عدد المنتجات في شريط الفئة
                </span>
                <input
                  type="checkbox"
                  checked={categoryGrouping.showProductCount !== false}
                  onChange={(e) => updateCategoryGrouping({ showProductCount: e.target.checked })}
                  className="rounded border-slate-600 text-sky-500 focus:ring-0"
                />
              </div>

              {/* Page Break per Category Toggle */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                <div>
                  <span className="text-xs font-bold text-white block">
                    بدء كل فئة في صفحة مستقلة جديدة
                  </span>
                  <span className="text-[9px] text-slate-400">
                    فاصل صفحات (Page Break) عند بداية كل فئة
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={categoryGrouping.pageBreakPerCategory || false}
                  onChange={(e) => updateCategoryGrouping({ pageBreakPerCategory: e.target.checked })}
                  className="rounded border-slate-600 text-sky-500 focus:ring-0"
                />
              </div>

              {/* Header Colors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    لون خلفية شريط الفئة
                  </label>
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg p-1.5">
                    <input
                      type="color"
                      value={categoryGrouping.headerBackground || '#0f172a'}
                      onChange={(e) => updateCategoryGrouping({ headerBackground: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[10px] font-mono text-slate-300">
                      {categoryGrouping.headerBackground || '#0f172a'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    لون نص عنوان الفئة
                  </label>
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg p-1.5">
                    <input
                      type="color"
                      value={categoryGrouping.headerTextColor || '#ffffff'}
                      onChange={(e) => updateCategoryGrouping({ headerTextColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-[10px] font-mono text-slate-300">
                      {categoryGrouping.headerTextColor || '#ffffff'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TYPOGRAPHY */}
        {activeTab === 'typography' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">
                اختر العنصر المراد تنسيقه:
              </label>
              <select
                value={selectedTypographyElement}
                onChange={(e) => setSelectedTypographyElement(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-sky-400"
              >
                <option value="productName">اسم المنتج (Product Name)</option>
                <option value="description">وصف المنتج (Description)</option>
                <option value="price">السعر (Price)</option>
                <option value="barcode">الباركود (Barcode)</option>
                <option value="category">الفئة / التصنيف</option>
                <option value="tableHeader">ترويسة الجدول</option>
                <option value="headerText">عنوان الكتالوج الرئيسي</option>
                <option value="footerText">نص التذييل</option>
              </select>
            </div>

            {/* Typography Controls for selected element */}
            {(() => {
              const currentFont = template.typography[selectedTypographyElement];
              const updateFont = (field: keyof typeof currentFont, val: any) => {
                updateTemplate((prev) => ({
                  ...prev,
                  typography: {
                    ...prev.typography,
                    [selectedTypographyElement]: {
                      ...prev.typography[selectedTypographyElement],
                      [field]: val,
                    },
                  },
                }));
              };

              return (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">نوع الخط العربي / الإنجليزي</label>
                    <select
                      value={currentFont.fontFamily}
                      onChange={(e) => updateFont('fontFamily', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="Cairo">Cairo (خط عربي عصري معتمد)</option>
                      <option value="Tajawal">Tajawal (خط مقروء ونظيف)</option>
                      <option value="Noto Sans Arabic">Noto Sans Arabic</option>
                      <option value="Inter">Inter (للأرقام والرموز)</option>
                      <option value="Arial">Arial</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">حجم الخط ({currentFont.fontSize}pt)</label>
                      <input
                        type="range"
                        min={6}
                        max={24}
                        step={0.5}
                        value={currentFont.fontSize}
                        onChange={(e) => updateFont('fontSize', Number(e.target.value))}
                        className="w-full accent-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">سماكة الخط (Weight)</label>
                      <select
                        value={currentFont.fontWeight}
                        onChange={(e) => updateFont('fontWeight', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                      >
                        <option value="400">عادي (Regular)</option>
                        <option value="500">متوسط (Medium)</option>
                        <option value="600">نصف عريض (SemiBold)</option>
                        <option value="700">عريض (Bold)</option>
                        <option value="800">شديد العرض (Black)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">لون النص</label>
                      <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <input
                          type="color"
                          value={currentFont.color}
                          onChange={(e) => updateFont('color', e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <span className="text-[10px] font-mono text-slate-300">
                          {currentFont.color}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">المحاذاة</label>
                      <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => updateFont('alignment', 'right')}
                          className={`flex-1 p-1 rounded flex items-center justify-center ${
                            currentFont.alignment === 'right' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'
                          }`}
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateFont('alignment', 'center')}
                          className={`flex-1 p-1 rounded flex items-center justify-center ${
                            currentFont.alignment === 'center' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'
                          }`}
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateFont('alignment', 'left')}
                          className={`flex-1 p-1 rounded flex items-center justify-center ${
                            currentFont.alignment === 'left' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'
                          }`}
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 3: IMAGE SETTINGS */}
        {activeTab === 'image' && (
          <div className="space-y-4">
            <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
              إعدادات صور المنتجات (Image Controls)
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  العرض ({template.image.width}px)
                </label>
                <input
                  type="range"
                  min={40}
                  max={140}
                  value={template.image.width}
                  onChange={(e) =>
                    updateTemplate((prev) => ({
                      ...prev,
                      image: { ...prev.image, width: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  الارتفاع ({template.image.height}px)
                </label>
                <input
                  type="range"
                  min={40}
                  max={140}
                  value={template.image.height}
                  onChange={(e) =>
                    updateTemplate((prev) => ({
                      ...prev,
                      image: { ...prev.image, height: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1">نمط الملاءمة (Fit Mode)</label>
              <select
                value={template.image.fitMode}
                onChange={(e) =>
                  updateTemplate((prev) => ({
                    ...prev,
                    image: { ...prev.image, fitMode: e.target.value as any },
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                <option value="contain">احتواء كامل (Contain - يحفظ الأبعاد الأصلية)</option>
                <option value="cover">تغطية الإطار (Cover)</option>
                <option value="fill">تمدد كامل (Fill)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  استدارة الحواف ({template.image.borderRadius}px)
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={template.image.borderRadius}
                  onChange={(e) =>
                    updateTemplate((prev) => ({
                      ...prev,
                      image: { ...prev.image, borderRadius: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">إطار الصورة</label>
                <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <input
                    type="color"
                    value={template.image.borderColor}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        image: { ...prev.image, borderColor: e.target.value },
                      }))
                    }
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="text-[10px] font-mono text-slate-300">
                    {template.image.borderColor}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PRICE & BARCODE */}
        {activeTab === 'price_barcode' && (
          <div className="space-y-4">
            <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
              إعدادات السعر (Price Settings)
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">رمز العملة</label>
                <input
                  type="text"
                  value={template.price.currency}
                  onChange={(e) =>
                    updateTemplate((prev) => ({
                      ...prev,
                      price: { ...prev.price, currency: e.target.value },
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-center"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">موضع رمز العملة</label>
                <select
                  value={template.price.currencyPosition}
                  onChange={(e) =>
                    updateTemplate((prev) => ({
                      ...prev,
                      price: { ...prev.price, currencyPosition: e.target.value as any },
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs"
                >
                  <option value="suffix">بعد الرقم (25,000 د.ع)</option>
                  <option value="prefix">قبل الرقم (د.ع 25,000)</option>
                </select>
              </div>
            </div>

            <div className="h-px bg-slate-800" />

            <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
              إعدادات الباركود (Barcode Settings)
            </h4>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={template.barcode.showBarcode}
                  onChange={(e) =>
                    updateTemplate((prev) => ({
                      ...prev,
                      barcode: { ...prev.barcode, showBarcode: e.target.checked },
                    }))
                  }
                  className="rounded border-slate-700 text-sky-500"
                />
                <span className="text-xs font-bold">إظهار رقم الباركود في الجدول</span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">تباعد الأحرف (Letter Spacing)</label>
                  <input
                    type="number"
                    value={template.barcode.letterSpacing}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        barcode: { ...prev.barcode, letterSpacing: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">حجم الباركود</label>
                  <input
                    type="number"
                    value={template.barcode.fontSize}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        barcode: { ...prev.barcode, fontSize: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-center font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: HEADER & FOOTER */}
        {activeTab === 'header_footer' && (
          <div className="space-y-4">
            <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
              ترويسة الصفحة (Page Header)
            </h4>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.header.enabled}
                onChange={(e) =>
                  updateTemplate((prev) => ({
                    ...prev,
                    header: { ...prev.header, enabled: e.target.checked },
                  }))
                }
                className="rounded border-slate-700 text-sky-500"
              />
              <span className="text-xs font-bold">تفعيل ترويسة الصفحة على كل الصفحات</span>
            </label>

            {template.header.enabled && (
              <div className="space-y-4 pt-1">
                {/* Header Type Selector */}
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1.5">نوع الهيدر</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, type: 'image' },
                        }))
                      }
                      className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all ${
                        template.header.type === 'image' || (!template.header.type && template.header.bannerImage)
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      صورة بانر
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, type: 'text' },
                        }))
                      }
                      className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all ${
                        template.header.type === 'text'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      نص وعنوان
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, type: 'both' },
                        }))
                      }
                      className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all ${
                        template.header.type === 'both'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      صورة + نص
                    </button>
                  </div>
                </div>

                {/* Placement Toggle: First Page Only vs All Pages */}
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white">مكان ظهور الهيدر:</span>
                    <span className="text-[10px] text-sky-400 font-semibold">
                      {template.header.showOnFirstPageOnly ? 'الصفحة الأولى فقط' : 'جميع الصفحات'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, showOnFirstPageOnly: true },
                        }))
                      }
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold transition-all border ${
                        template.header.showOnFirstPageOnly
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      في بداية الملف فقط (الصفحة 1)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          header: { ...prev.header, showOnFirstPageOnly: false },
                        }))
                      }
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold transition-all border ${
                        !template.header.showOnFirstPageOnly
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      تكرار في كل الصفحات
                    </button>
                  </div>
                </div>

                {/* Banner Image Upload & Controls */}
                {(template.header.type === 'image' || template.header.type === 'both' || !template.header.type) && (
                  <div className="space-y-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                        <FileImage className="w-3.5 h-3.5" />
                        صورة هيدر الملف (Header Banner)
                      </label>
                      {template.header.bannerImage && (
                        <button
                          type="button"
                          onClick={() =>
                            updateTemplate((prev) => ({
                              ...prev,
                              header: { ...prev.header, bannerImage: undefined },
                            }))
                          }
                          className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          حذف
                        </button>
                      )}
                    </div>

                    {/* Banner Preview */}
                    {template.header.bannerImage ? (
                      <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950 p-1 relative group">
                        <div
                          style={{
                            height: `${Math.min(template.header.bannerHeight || 60, 80)}px`,
                            backgroundColor: template.header.background || '#ffffff',
                          }}
                          className="w-full rounded flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={template.header.bannerImage}
                            alt="Banner Preview"
                            style={{
                              objectFit: template.header.bannerFit || 'contain',
                            }}
                            className="w-full h-full"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center border border-dashed border-slate-700 rounded-lg text-[10px] text-slate-400">
                        لم يتم تعيين صورة هيدر بعد
                      </div>
                    )}

                    {/* Upload Buttons */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg py-2 px-3 text-xs font-bold cursor-pointer transition-colors shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>استيراد صورة هيدر من جهازك</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp, image/svg+xml"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const dataUrl = event.target?.result as string;
                              if (dataUrl) {
                                updateTemplate((prev) => ({
                                  ...prev,
                                  header: {
                                    ...prev.header,
                                    bannerImage: dataUrl,
                                    type: prev.header.type === 'text' ? 'image' : (prev.header.type || 'image'),
                                  },
                                }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          updateTemplate((prev) => ({
                            ...prev,
                            header: {
                              ...prev.header,
                              bannerImage: DEFAULT_HEADER_BANNER,
                              type: prev.header.type === 'text' ? 'image' : (prev.header.type || 'image'),
                            },
                          }))
                        }
                        className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg py-1.5 px-3 text-[11px] font-semibold transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>استخدام هيدر المنطقة التقنية (EZ | Moxedo)</span>
                      </button>
                    </div>

                    {/* Banner Height & Fit Settings */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/60">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">ارتفاع الهيدر (px)</label>
                        <input
                          type="number"
                          min={30}
                          max={160}
                          value={template.header.bannerHeight || template.header.height || 70}
                          onChange={(e) =>
                            updateTemplate((prev) => {
                              const val = Number(e.target.value);
                              return {
                                ...prev,
                                header: { ...prev.header, bannerHeight: val, height: val },
                              };
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-center text-xs font-bold text-sky-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">ملاءمة الصورة</label>
                        <select
                          value={template.header.bannerFit || 'contain'}
                          onChange={(e) =>
                            updateTemplate((prev) => ({
                              ...prev,
                              header: { ...prev.header, bannerFit: e.target.value as any },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                        >
                          <option value="contain">احتواء كامل (Contain)</option>
                          <option value="cover">ملء المساحة (Cover)</option>
                          <option value="fill">تمدد (Fill)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Text Settings (When type is 'text' or 'both') */}
                {(template.header.type === 'text' || template.header.type === 'both') && (
                  <div className="space-y-3 pt-1 border-t border-slate-800">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">اسم الشركة / المؤسسة</label>
                      <input
                        type="text"
                        value={template.header.companyName || ''}
                        onChange={(e) =>
                          updateTemplate((prev) => ({
                            ...prev,
                            header: { ...prev.header, companyName: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">عنوان الكتالوج الفرعي</label>
                      <input
                        type="text"
                        value={template.header.catalogTitle || ''}
                        onChange={(e) =>
                          updateTemplate((prev) => ({
                            ...prev,
                            header: { ...prev.header, catalogTitle: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={template.header.showDate}
                        onChange={(e) =>
                          updateTemplate((prev) => ({
                            ...prev,
                            header: { ...prev.header, showDate: e.target.checked },
                          }))
                        }
                        className="rounded border-slate-700 text-sky-500"
                      />
                      <span className="text-[11px] text-slate-300">إظهار تاريخ إصدار الكتالوج</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="h-px bg-slate-800" />

            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
                تذييل الصفحة (Page Footer)
              </h4>
              {template.footer.bannerImage && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  {template.footer.showOnLastPageOnly !== false ? 'صورة في الصفحة الأخيرة ⭐' : 'صورة في كل الصفحات'}
                </span>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.footer.enabled}
                onChange={(e) =>
                  updateTemplate((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, enabled: e.target.checked },
                  }))
                }
                className="rounded border-slate-700 text-sky-500"
              />
              <span className="text-xs font-bold">تفعيل تذييل الصفحة (Footer)</span>
            </label>

            {template.footer.enabled && (
              <div className="space-y-4 pt-1">
                {/* Footer Type Selector */}
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1.5">نوع الفوتر</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, type: 'image' },
                        }))
                      }
                      className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all ${
                        template.footer.type === 'image'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      صورة بانر
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, type: 'text' },
                        }))
                      }
                      className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all ${
                        template.footer.type === 'text' || (!template.footer.type && !template.footer.bannerImage)
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      نص وأرقام
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, type: 'both' },
                        }))
                      }
                      className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all ${
                        template.footer.type === 'both' || (!template.footer.type && template.footer.bannerImage)
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      صورة + نص
                    </button>
                  </div>
                </div>

                {/* Placement Toggle: Last Page Only vs All Pages */}
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white">مكان ظهور صورة الفوتر:</span>
                    <span className="text-[10px] text-amber-400 font-bold">
                      {template.footer.showOnLastPageOnly !== false ? 'الصفحة الأخيرة فقط ⭐' : 'جميع الصفحات'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, showOnLastPageOnly: true },
                        }))
                      }
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold transition-all border ${
                        template.footer.showOnLastPageOnly !== false
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      الصفحة الأخيرة فقط (خاتمة)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, showOnLastPageOnly: false },
                        }))
                      }
                      className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold transition-all border ${
                        template.footer.showOnLastPageOnly === false
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      تكرار في كل الصفحات
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    💡 عند اختيار "الصفحة الأخيرة فقط"، تظهر الصورة كخاتمة في نهاية الكتالوج لعرض معلومات التواصل والحسابات دون حجب مساحة المنتجات في الصفحات السابقة.
                  </p>
                </div>

                {/* Footer Banner Image Upload & Controls */}
                <div className="space-y-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                      <FileImage className="w-3.5 h-3.5" />
                      صورة ذيل الصفحة (Footer Banner)
                    </label>
                    {template.footer.bannerImage && (
                      <button
                        type="button"
                        onClick={() =>
                          updateTemplate((prev) => ({
                            ...prev,
                            footer: { ...prev.footer, bannerImage: undefined },
                          }))
                        }
                        className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        حذف
                      </button>
                    )}
                  </div>

                  {/* Banner Preview */}
                  {template.footer.bannerImage ? (
                    <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950 p-1 relative group">
                      <div
                        style={{
                          height: `${Math.min(template.footer.bannerHeight || 70, 90)}px`,
                          backgroundColor: template.footer.background || '#ffffff',
                        }}
                        className="w-full rounded flex items-center justify-center overflow-hidden"
                      >
                        <img
                          src={template.footer.bannerImage}
                          alt="Footer Banner Preview"
                          style={{
                            objectFit: template.footer.bannerFit || 'contain',
                            borderRadius: `${template.footer.bannerBorderRadius || 0}px`,
                          }}
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center border border-dashed border-slate-700 rounded-lg text-[10px] text-slate-400">
                      لم يتم تعيين صورة لذيل الصفحة بعد
                    </div>
                  )}

                  {/* Upload Button */}
                  <label className="flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-lg py-2 px-3 text-xs font-bold cursor-pointer transition-colors shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span>استيراد صورة لذيل الصفحة من جهازك</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          if (dataUrl) {
                            updateTemplate((prev) => ({
                              ...prev,
                              footer: {
                                ...prev.footer,
                                bannerImage: dataUrl,
                                type: prev.footer.type === 'text' ? 'both' : (prev.footer.type || 'both'),
                                showOnLastPageOnly: prev.footer.showOnLastPageOnly !== false,
                              },
                            }));
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                  </label>

                  {/* Banner Height & Fit Settings */}
                  {template.footer.bannerImage && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-700/60">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            ارتفاع الصورة ({template.footer.bannerHeight || 80}px)
                          </label>
                          <input
                            type="range"
                            min={40}
                            max={250}
                            step={5}
                            value={template.footer.bannerHeight || 80}
                            onChange={(e) =>
                              updateTemplate((prev) => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  bannerHeight: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full accent-sky-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">طريقة الملاءمة</label>
                          <select
                            value={template.footer.bannerFit || 'contain'}
                            onChange={(e) =>
                              updateTemplate((prev) => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  bannerFit: e.target.value as any,
                                },
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs font-semibold"
                          >
                            <option value="contain">احتواء كامل (Contain)</option>
                            <option value="cover">ملء وتغطية (Cover)</option>
                            <option value="fill">تمدد كامل (Fill)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            تدوير الحواف ({template.footer.bannerBorderRadius || 0}px)
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={24}
                            value={template.footer.bannerBorderRadius || 0}
                            onChange={(e) =>
                              updateTemplate((prev) => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  bannerBorderRadius: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full accent-sky-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">لون خلفية الحاوية</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={template.footer.background || '#ffffff'}
                              onChange={(e) =>
                                updateTemplate((prev) => ({
                                  ...prev,
                                  footer: {
                                    ...prev.footer,
                                    background: e.target.value,
                                  },
                                }))
                              }
                              className="w-8 h-8 rounded border border-slate-700 bg-slate-800 cursor-pointer"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">
                              {template.footer.background || '#ffffff'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text & Page Numbers Options */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">نص التذييل المخصص</label>
                    <input
                      type="text"
                      value={template.footer.customText || ''}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          footer: { ...prev.footer, customText: e.target.value },
                        }))
                      }
                      placeholder="مثال: أسعار المنتجات قابلة للتغيير دون إشعار مسبق"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-800/40 border border-slate-700/60">
                      <input
                        type="checkbox"
                        checked={template.footer.showPageNumber}
                        onChange={(e) =>
                          updateTemplate((prev) => ({
                            ...prev,
                            footer: {
                              ...prev.footer,
                              showPageNumber: e.target.checked,
                            },
                          }))
                        }
                        className="rounded border-slate-700 text-sky-500"
                      />
                      <span className="text-[11px] text-slate-300">أرقام الصفحات</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-800/40 border border-slate-700/60">
                      <input
                        type="checkbox"
                        checked={template.footer.borderTop}
                        onChange={(e) =>
                          updateTemplate((prev) => ({
                            ...prev,
                            footer: {
                              ...prev.footer,
                              borderTop: e.target.checked,
                            },
                          }))
                        }
                        className="rounded border-slate-700 text-sky-500"
                      />
                      <span className="text-[11px] text-slate-300">خط فاصل علوي</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
