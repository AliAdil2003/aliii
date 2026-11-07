'use client';

import React from 'react';
import {
  Image as ImageIcon,
  Type,
  FileText,
  Barcode,
  DollarSign,
  Package,
  Tag,
  Hash,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Columns,
  Eye,
  CheckCircle2,
  FolderTree,
  ArrowUpDown,
} from 'lucide-react';
import { CatalogTemplate, CatalogLayoutType, Product } from '@/types';

interface ElementsSidebarProps {
  template: CatalogTemplate;
  onChangeTemplate: (updated: CatalogTemplate) => void;
  products: Product[];
  onOpenTemplatesModal: () => void;
  onOpenSequenceModal?: () => void;
}

const AVAILABLE_ELEMENTS = [
  { id: 'img', label: 'صورة المنتج (Product Image)', icon: ImageIcon, field: 'imageData' },
  { id: 'name', label: 'اسم المنتج (Product Name)', icon: Type, field: 'name' },
  { id: 'desc', label: 'الوصف (Description)', icon: FileText, field: 'description' },
  { id: 'barcode', label: 'الباركود (Barcode)', icon: Barcode, field: 'barcode' },
  { id: 'customerPrice', label: 'سعر بيع الزبون (Customer Price)', icon: DollarSign, field: 'customerPrice' },
  { id: 'salePrice', label: 'سعر البيع (Sale / Wholesale Price)', icon: DollarSign, field: 'salePrice' },
  { id: 'price', label: 'السعر العام (General Price)', icon: DollarSign, field: 'price' },
  { id: 'stock', label: 'الكمية في اليد (Stock)', icon: Package, field: 'stock' },
  { id: 'cat', label: 'الفئة (Category)', icon: Tag, field: 'category' },
  { id: 'ref', label: 'المرجع الداخلي (Ref / SKU)', icon: Hash, field: 'internalReference' },
];

export default function ElementsSidebar({
  template,
  onChangeTemplate,
  products,
  onOpenTemplatesModal,
  onOpenSequenceModal,
}: ElementsSidebarProps) {
  const activeProductsCount = products.filter((p) => p.includedInCatalog).length;

  const setLayoutType = (layout: CatalogLayoutType) => {
    onChangeTemplate({ ...template, layoutType: layout });
  };

  const toggleColumnVisibility = (key: string, label?: string) => {
    const exists = template.table.columns.some((col) => col.key === key);
    let newCols;
    if (exists) {
      newCols = template.table.columns.map((col) => {
        if (col.key === key) {
          return { ...col, visible: !col.visible };
        }
        return col;
      });
    } else {
      newCols = [
        ...template.table.columns,
        {
          id: `col_${key}`,
          key: key as any,
          label: label || key,
          width: 14,
          visible: true,
          alignment: 'center' as const,
          order: template.table.columns.length + 1,
        },
      ];
    }
    onChangeTemplate({
      ...template,
      table: { ...template.table, columns: newCols },
    });
  };

  return (
    <div className="w-72 bg-slate-900 border-l border-slate-800 text-white flex flex-col h-full select-none overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-xs text-white font-cairo">عناصر الكتالوج والتخطيط</h3>
          <p className="text-[10px] text-slate-400">تخصيص هيكل الصفحة والعناصر المعروضة</p>
        </div>
        <button
          onClick={onOpenTemplatesModal}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors"
          title="اختيار أو حفظ قالب"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
        {/* Layout Style Switcher (Section 17) */}
        <div className="space-y-2">
          <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
            نمط التخطيط (Layout Mode)
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLayoutType('table')}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                template.layoutType === 'table'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 font-medium'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>جدول احترافي</span>
            </button>

            <button
              onClick={() => setLayoutType('cards')}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                template.layoutType === 'cards'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 font-medium'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>بطاقات شبكية</span>
            </button>
          </div>
        </div>

        {/* Category Grouping Quick Toggle Card */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <FolderTree className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">التصنيف حسب الفئة</span>
                <span className="text-[9.5px] text-slate-400">ترتيب المنتجات بأقسام الفئات</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={template.categoryGrouping?.enabled !== false}
              onChange={(e) =>
                onChangeTemplate({
                  ...template,
                  categoryGrouping: {
                    ...(template.categoryGrouping || {
                      categoryOrder: [],
                      showHeader: true,
                      headerBackground: '#0f172a',
                      headerTextColor: '#ffffff',
                    }),
                    enabled: e.target.checked,
                  },
                })
              }
              className="rounded border-slate-700 text-sky-500"
            />
          </div>
        </div>

        {/* Manual Reordering & Category Management Card */}
        {onOpenSequenceModal && (
          <div
            onClick={onOpenSequenceModal}
            className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:border-amber-500/60 cursor-pointer transition-all space-y-1.5 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-white block group-hover:text-amber-300 transition-colors">
                    ترتيب وتسلسل المنتجات
                  </span>
                  <span className="text-[9.5px] text-slate-400">
                    تغيير التسلسل يدوياً وتعديل الفئات
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                فتح ↺
              </span>
            </div>
          </div>
        )}

        {/* Catalog Elements Palette (Section 11) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
              عناصر المنتجات (Elements)
            </h4>
            <span className="text-[10px] text-slate-500">تفعيل / إخفاء</span>
          </div>

          <div className="space-y-1.5">
            {AVAILABLE_ELEMENTS.map((elem) => {
              const Icon = elem.icon;
              const matchingCol = template.table.columns.find((c) => c.key === elem.field);
              const isVisible = matchingCol ? matchingCol.visible : false;

              return (
                <div
                  key={elem.id}
                  onClick={() => toggleColumnVisibility(elem.field, elem.label)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isVisible
                      ? 'bg-slate-800/90 border-slate-700 text-white'
                      : 'bg-slate-950/60 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                        isVisible ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-600'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-xs">{elem.label}</span>
                  </div>

                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isVisible ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    {isVisible ? '✓' : '×'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Products Quick Status Bar */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">المنتجات المضمنة بالطباعة:</span>
            <span className="font-bold text-sky-400 font-inter">
              {activeProductsCount} / {products.length}
            </span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all"
              style={{
                width: `${Math.round((activeProductsCount / (products.length || 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
