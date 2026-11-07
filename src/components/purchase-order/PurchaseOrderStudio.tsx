'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Palette,
  LayoutTemplate,
  FileText,
  Building2,
  Package,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Plus,
  Minus,
  Edit2,
  AlignRight,
  AlignCenter,
  AlignLeft,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  FileCheck,
  Table as TableIcon,
  ShieldCheck,
  Layers,
  Save,
} from 'lucide-react';
import {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderTableDesign,
  PurchaseOrderColumnConfig,
  PurchaseOrderColumnKey,
} from '@/types';
import {
  createDefaultPurchaseOrderDesign,
  HEADER_PRESET_COLORS,
} from '@/lib/purchase-order/defaultDesign';
import PurchaseOrderTemplateModal from './PurchaseOrderTemplateModal';

interface PurchaseOrderStudioProps {
  order: PurchaseOrder;
  selectedItems: PurchaseOrderItem[];
  supplierName: string;
  orderNotes: string;
  design: PurchaseOrderTableDesign;
  onChangeDesign: (newDesign: PurchaseOrderTableDesign) => void;
  onUpdateItem: (id: string, updates: Partial<PurchaseOrderItem>) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  onExport: (format: 'xlsx' | 'pdf') => Promise<void>;
  isExporting: 'xlsx' | 'pdf' | null;
  onBackToSelection: () => void;
  onSyncFromOdoo?: () => Promise<void>;
  isSyncingOdoo?: boolean;
  onSaveProject?: () => Promise<void>;
  isSavingProject?: boolean;
}

export default function PurchaseOrderStudio({
  order,
  selectedItems,
  supplierName,
  orderNotes,
  design,
  onChangeDesign,
  onUpdateItem,
  onAdjustQuantity,
  onExport,
  isExporting,
  onBackToSelection,
  onSyncFromOdoo,
  isSyncingOdoo = false,
  onSaveProject,
  isSavingProject = false,
}: PurchaseOrderStudioProps) {
  // Studio navigation tabs: columns, styling, page_header
  const [activeTab, setActiveTab] = useState<'columns' | 'styling' | 'page_header'>('columns');

  // Templates modal state
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  // Preview zoom level (default 100%)
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Quick search in items within preview
  const [previewSearch, setPreviewSearch] = useState<string>('');

  // Total quantity
  const totalRequestedQuantity = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.requestedQuantity, 0);
  }, [selectedItems]);

  // Sorted and visible columns
  const sortedColumns = useMemo(() => {
    return [...design.columns].sort((a, b) => a.order - b.order);
  }, [design.columns]);

  const visibleColumns = useMemo(() => {
    return sortedColumns.filter((c) => c.visible);
  }, [sortedColumns]);

  // Filtered items in preview if search is typed
  const displayedItems = useMemo(() => {
    if (!previewSearch.trim()) return selectedItems;
    const q = previewSearch.toLowerCase();
    return selectedItems.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q) ||
        item.internalReference.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [selectedItems, previewSearch]);

  // ==========================================
  // Column Management Handlers
  // ==========================================
  const handleToggleColumnVisibility = (colId: string) => {
    const updated = design.columns.map((c) => {
      if (c.id === colId) {
        return { ...c, visible: !c.visible };
      }
      return c;
    });
    onChangeDesign({ ...design, columns: updated });
  };

  const handleMoveColumn = (colId: string, direction: 'up' | 'down') => {
    const sorted = [...design.columns].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === colId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap positions
    const temp = sorted[index];
    sorted[index] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    // Re-assign order indices 0, 1, 2...
    const updated = sorted.map((col, idx) => ({ ...col, order: idx }));
    onChangeDesign({ ...design, columns: updated });
  };

  const handleUpdateColumnLabel = (colId: string, newLabel: string) => {
    const updated = design.columns.map((c) => {
      if (c.id === colId) {
        return { ...c, label: newLabel };
      }
      return c;
    });
    onChangeDesign({ ...design, columns: updated });
  };

  const handleUpdateColumnAlignment = (
    colId: string,
    alignment: 'right' | 'center' | 'left'
  ) => {
    const updated = design.columns.map((c) => {
      if (c.id === colId) {
        return { ...c, alignment };
      }
      return c;
    });
    onChangeDesign({ ...design, columns: updated });
  };

  const handleUpdateColumnWidth = (colId: string, width: number) => {
    const updated = design.columns.map((c) => {
      if (c.id === colId) {
        return { ...c, width: Math.max(3, Math.min(80, width)) };
      }
      return c;
    });
    onChangeDesign({ ...design, columns: updated });
  };

  const handleResetColumns = () => {
    if (window.confirm('هل تريد إعادة تعيين ترتيب وعناوين الأعمدة للافتراضي؟')) {
      const defaultDesign = createDefaultPurchaseOrderDesign(supplierName);
      onChangeDesign({ ...design, columns: defaultDesign.columns });
    }
  };

  // Helper to render cell content according to column key
  const renderCellContent = (item: PurchaseOrderItem, col: PurchaseOrderColumnConfig, idx: number) => {
    switch (col.key) {
      case 'index':
        return <span className="font-bold text-slate-400 font-inter">{idx + 1}</span>;

      case 'image':
        return (
          <div
            className="rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center mx-auto shadow-xs"
            style={{
              width: design.imageSize === 'small' ? 36 : design.imageSize === 'large' ? 60 : 46,
              height: design.imageSize === 'small' ? 36 : design.imageSize === 'large' ? 60 : 46,
            }}
          >
            {item.imageData && item.imageStatus === 'valid' ? (
              <img
                src={item.imageData}
                alt={item.productName}
                className="w-full h-full p-0.5"
                style={{ objectFit: design.imageFit }}
              />
            ) : (
              <Package className="w-4 h-4 text-slate-300" />
            )}
          </div>
        );

      case 'productName':
        return (
          <div className="font-bold text-slate-900 font-cairo text-[12px] leading-snug">
            {item.productName}
          </div>
        );

      case 'barcode':
        return (
          <span className="font-mono text-[11px] font-semibold text-slate-700 tracking-wider">
            {item.barcode || '—'}
          </span>
        );

      case 'requestedQuantity':
        return (
          <div className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1">
            <button
              type="button"
              onClick={() => onAdjustQuantity(item.id, -1)}
              className="w-5 h-5 rounded-md bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center shadow-xs"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-10 text-center font-black font-inter text-sm text-amber-700">
              {item.requestedQuantity}
            </span>
            <button
              type="button"
              onClick={() => onAdjustQuantity(item.id, 1)}
              className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center justify-center font-bold shadow-xs"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        );

      case 'category':
        return (
          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
            {item.category || 'عام'}
          </span>
        );

      case 'internalReference':
        return <span className="font-mono text-[11px] text-slate-500">{item.internalReference || '—'}</span>;

      case 'currentStock':
        return (
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
              item.currentStock === 0
                ? 'bg-rose-100 text-rose-800'
                : item.currentStock < 5
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {item.currentStock}
          </span>
        );

      case 'customerPrice':
        return (
          <span className="font-mono font-bold text-slate-700">
            {typeof item.customerPrice === 'number'
              ? item.customerPrice.toLocaleString('en-US')
              : item.customerPrice || '—'}
          </span>
        );

      case 'notes':
        return (
          <input
            type="text"
            value={item.notes || ''}
            onChange={(e) => onUpdateItem(item.id, { notes: e.target.value })}
            placeholder="ملاحظة..."
            className="w-full bg-slate-50/70 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-amber-500 rounded px-2 py-1 text-[11px] text-slate-800 transition-colors"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* ========================================== */}
      {/* Studio Top Control & Action Bar */}
      {/* ========================================== */}
      <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 text-white border border-slate-800 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Left Info & Title */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button
            type="button"
            onClick={onBackToSelection}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors shadow-xs"
            title="رجوع لتعديل الكميات واختيار المواد"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                استوديو طلبية المورد
              </span>
              <span className="text-xs text-slate-400">
                المورد: <span className="text-white font-bold">{supplierName}</span>
              </span>
            </div>
            <h1 className="text-lg font-black font-cairo text-white">
              استوديو تصميم وتخصيص جدول الطلبية
            </h1>
          </div>
        </div>

        {/* Center Zoom & Setup Controls */}
        <div className="flex items-center gap-2 bg-slate-800/80 rounded-2xl p-1.5 border border-slate-700 text-xs">
          {/* Page Layout Selector */}
          <select
            value={design.pageSize === 'single_long_page' ? 'single_long_page' : design.orientation}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'single_long_page') {
                onChangeDesign({ ...design, pageSize: 'single_long_page' });
              } else {
                onChangeDesign({
                  ...design,
                  pageSize: 'A4',
                  orientation: val as 'portrait' | 'landscape',
                });
              }
            }}
            className="bg-slate-900 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500"
          >
            <option value="portrait">A4 عمودي (صفحات متعددة)</option>
            <option value="landscape">A4 أفقي (صفحات متعددة)</option>
            <option value="single_long_page">صفحة واحدة طويلة ممتدة (مستمرة)</option>
          </select>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="تصغير"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300 w-10 text-center font-bold">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="تكبير"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Actions: Export Buttons & Odoo Sync */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
          {/* Templates Button */}
          <button
            type="button"
            onClick={() => setIsTemplatesModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700 shadow-xs"
            title="إدارة واختيار وحفظ قوالب جدول الطلبية"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>القوالب</span>
          </button>

          {/* Save Project Button */}
          {onSaveProject && (
            <button
              type="button"
              onClick={onSaveProject}
              disabled={isSavingProject}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700 shadow-xs disabled:opacity-50"
              title="حفظ هذه الطلبية في قائمة المشاريع والكتالوجات"
            >
              <Save className={`w-3.5 h-3.5 text-emerald-400 ${isSavingProject ? 'animate-spin' : ''}`} />
              <span>{isSavingProject ? 'جاري الحفظ...' : 'حفظ المشروع'}</span>
            </button>
          )}

          {onSyncFromOdoo && (
            <button
              type="button"
              onClick={onSyncFromOdoo}
              disabled={isSyncingOdoo}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs transition-colors flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
              title="تحديث رصيد المخزن والأسعار من خادم Odoo مباشرة"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncingOdoo ? 'animate-spin' : ''}`} />
              <span>{isSyncingOdoo ? 'جاري التحديث...' : 'تحديث من Odoo'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onExport('xlsx')}
            disabled={isExporting !== null}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting === 'xlsx' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>تصدير Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => onExport('pdf')}
            disabled={isExporting !== null}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting === 'pdf' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>تصدير PDF بالجدول المخصص</span>
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* Main Studio 2-Column Work Area */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================== */}
        {/* Sidebar: Table Customization Studio Panel */}
        {/* ========================================== */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-5">
          {/* Studio Navigation Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1 text-xs font-bold font-cairo">
            <button
              type="button"
              onClick={() => setActiveTab('columns')}
              className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'columns'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
              <span>أعمدة الجدول</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('styling')}
              className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'styling'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-sky-500" />
              <span>المظهر والألوان</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('page_header')}
              className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'page_header'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <span>الترويسة والصفحة</span>
            </button>
          </div>

          {/* TAB 1: COLUMNS CUSTOMIZATION */}
          {activeTab === 'columns' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Privacy notice banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>حماية سرية البيانات:</strong> السعر والمخزون مخفيان تلقائياً. يمكنك تفعيلهما بالنقر على أيقونة العين إذا كنت ترغب بتضمينهما.
                </div>
              </div>

              {/* Columns list */}
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {sortedColumns.map((col, index) => (
                  <div
                    key={col.id}
                    className={`rounded-2xl border p-3 transition-all ${
                      col.visible
                        ? 'bg-white border-slate-200 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Move order buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveColumn(col.id, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveColumn(col.id, 'down')}
                          disabled={index === sortedColumns.length - 1}
                          className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Center: Editable Column Label */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={col.label}
                          onChange={(e) => handleUpdateColumnLabel(col.id, e.target.value)}
                          className="w-full text-xs font-bold text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-amber-500 rounded px-1.5 py-0.5 focus:outline-none"
                          title="انقر لتعديل عنوان العمود"
                        />
                        <div className="text-[10px] text-slate-400 px-1.5">
                          {col.key === 'requestedQuantity' && 'الكمية المطلوبة من المورد'}
                          {col.key === 'currentStock' && 'رصيد المخزن الحالي (مخفي افتراضياً)'}
                          {col.key === 'customerPrice' && 'سعر المنتج (مخفي افتراضياً)'}
                          {col.key === 'productName' && 'اسم وموديل المنتج'}
                          {col.key === 'barcode' && 'رمز الباركود'}
                          {col.key === 'image' && 'صورة مصغرة'}
                          {col.key === 'index' && 'تسلسل ترقيمي'}
                          {col.key === 'category' && 'تصنيف الصنف'}
                          {col.key === 'internalReference' && 'الرمز الداخلي (SKU)'}
                          {col.key === 'notes' && 'ملاحظات تفصيلية'}
                        </div>
                      </div>

                      {/* Right: Visibility Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleColumnVisibility(col.id)}
                        className={`p-1.5 rounded-xl transition-colors ${
                          col.visible
                            ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                            : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                        }`}
                        title={col.visible ? 'إخفاء العمود' : 'إظهار العمود'}
                      >
                        {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Column Alignment & Width Options (if visible) */}
                    {col.visible && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                        {/* Alignment */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px]">المحاذاة:</span>
                          <div className="flex bg-slate-100 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateColumnAlignment(col.id, 'right')}
                              className={`p-1 rounded ${col.alignment === 'right' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400'}`}
                            >
                              <AlignRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateColumnAlignment(col.id, 'center')}
                              className={`p-1 rounded ${col.alignment === 'center' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400'}`}
                            >
                              <AlignCenter className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateColumnAlignment(col.id, 'left')}
                              className={`p-1 rounded ${col.alignment === 'left' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400'}`}
                            >
                              <AlignLeft className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Width */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px]">العرض:</span>
                          <input
                            type="range"
                            min={4}
                            max={60}
                            value={col.width}
                            onChange={(e) => handleUpdateColumnWidth(col.id, Number(e.target.value))}
                            className="w-16 accent-amber-500 cursor-pointer"
                          />
                          <span className="font-mono text-[10px] w-6 text-left">{col.width}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Reset columns button */}
              <button
                type="button"
                onClick={handleResetColumns}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط ترتيب وتسميات الأعمدة</span>
              </button>
            </div>
          )}

          {/* TAB 2: STYLING & COLORS */}
          {activeTab === 'styling' && (
            <div className="space-y-5 animate-fadeIn text-xs">
              {/* Header Background Preset Palette */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  لون ترويسة الجدول (Header Color):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {HEADER_PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.bg}
                      type="button"
                      onClick={() =>
                        onChangeDesign({
                          ...design,
                          headerBackground: preset.bg,
                          headerTextColor: preset.text,
                        })
                      }
                      className={`h-9 rounded-xl flex items-center justify-center text-[10px] font-bold border transition-transform ${
                        design.headerBackground === preset.bg
                          ? 'ring-2 ring-amber-500 scale-105 border-white shadow-sm'
                          : 'border-transparent hover:scale-102'
                      }`}
                      style={{ backgroundColor: preset.bg, color: preset.text }}
                    >
                      {design.headerBackground === preset.bg && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={design.headerBackground}
                    onChange={(e) => onChangeDesign({ ...design, headerBackground: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0"
                  />
                  <input
                    type="text"
                    value={design.headerBackground}
                    onChange={(e) => onChangeDesign({ ...design, headerBackground: e.target.value })}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono"
                  />
                  <span className="text-[11px] text-slate-500">لون مخصص</span>
                </div>
              </div>

              {/* Alternate Row Background (Zebra striping) */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  تلوين الصفوف التبادلية (Zebra Striping):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'رمادي ناعم (افتراضي)', val: '#f8fafc' },
                    { label: 'أزرق ثلجي ناعم', val: '#f0f9ff' },
                    { label: 'كهرماني ناعم', val: '#fefce8' },
                    { label: 'أبيض بالكامل (بدون تظليل)', val: '#ffffff' },
                  ].map((z) => (
                    <button
                      key={z.val}
                      type="button"
                      onClick={() => onChangeDesign({ ...design, alternateRowBackground: z.val })}
                      className={`p-2 rounded-xl text-center border font-bold text-[11px] transition-all ${
                        design.alternateRowBackground === z.val
                          ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Highlight Quantity Column toggle */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">إبراز عمود الكمية المطلوبة</div>
                  <div className="text-[10px] text-slate-500">
                    تمييز خانات الكميات بلون كهرماني واضح للمورد
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={design.highlightQuantity}
                  onChange={(e) => onChangeDesign({ ...design, highlightQuantity: e.target.checked })}
                  className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              {/* Font Size & Padding */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">حجم الخط:</label>
                  <select
                    value={design.fontSize}
                    onChange={(e) =>
                      onChangeDesign({
                        ...design,
                        fontSize: e.target.value as 'small' | 'medium' | 'large',
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="small">صغير (11px)</option>
                    <option value="medium">متوسط (12px)</option>
                    <option value="large">كبير (14px)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">كثافة الصفوف:</label>
                  <select
                    value={design.rowPadding}
                    onChange={(e) =>
                      onChangeDesign({
                        ...design,
                        rowPadding: e.target.value as 'compact' | 'normal' | 'relaxed',
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="compact">مدمج (Compact)</option>
                    <option value="normal">عادي (Normal)</option>
                    <option value="relaxed">متباعد (Relaxed)</option>
                  </select>
                </div>
              </div>

              {/* Image Size & Fit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">حجم الصور:</label>
                  <select
                    value={design.imageSize}
                    onChange={(e) =>
                      onChangeDesign({
                        ...design,
                        imageSize: e.target.value as 'small' | 'medium' | 'large',
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="small">صغير (36px)</option>
                    <option value="medium">متوسط (46px)</option>
                    <option value="large">كبير (60px)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">وضعية الصورة:</label>
                  <select
                    value={design.imageFit}
                    onChange={(e) =>
                      onChangeDesign({
                        ...design,
                        imageFit: e.target.value as 'contain' | 'cover',
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="contain">احتواء كامل (Contain)</option>
                    <option value="cover">ملء الإطار (Cover)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PAGE & HEADER */}
          {activeTab === 'page_header' && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">عنوان الطلبية (الوثيقة):</label>
                <input
                  type="text"
                  value={design.orderTitle}
                  onChange={(e) => onChangeDesign({ ...design, orderTitle: e.target.value })}
                  placeholder="طلب شراء واستيراد بضائع"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">اسم شركتك / المتجر:</label>
                <input
                  type="text"
                  value={design.companyName}
                  onChange={(e) => onChangeDesign({ ...design, companyName: e.target.value })}
                  placeholder="شركة E-ZONE للتجارة"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">وصف فرعي / بيانات الاتصال:</label>
                <input
                  type="text"
                  value={design.companySubtitle}
                  onChange={(e) => onChangeDesign({ ...design, companySubtitle: e.target.value })}
                  placeholder="هاتف / بريد إلكتروني أو ملاحظة سريعة"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">بطاقات إحصائيات الطلبية</div>
                  <div className="text-[10px] text-slate-500">
                    إظهار بطاقات عدد الأصناف وإجمالي القطع المطلوبة أعلى الجدول
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={design.showSummaryCards}
                  onChange={(e) =>
                    onChangeDesign({ ...design, showSummaryCards: e.target.checked })
                  }
                  className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  ملاحظات أو شروط ختامية (في ذيل الملف):
                </label>
                <textarea
                  rows={3}
                  value={design.footerNotes}
                  onChange={(e) => onChangeDesign({ ...design, footerNotes: e.target.value })}
                  placeholder="ملاحظات وشروط استلام البضائع..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* Center: Live Sheet Canvas Preview */}
        {/* ========================================== */}
        <div className="lg:col-span-8 space-y-3">
          {/* Filter/Search inside preview */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <span className="font-bold text-slate-800 font-cairo">
                معاينة مباشرة حية للجدول:
              </span>
              <span className="text-[11px] text-slate-500">
                ({selectedItems.length} صنف معتمد - {totalRequestedQuantity} قطعة)
              </span>
            </div>

            <div className="w-48 sm:w-64">
              <input
                type="text"
                placeholder="بحث سريع داخل المعاينة..."
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Interactive Document Sheet Canvas */}
          <div className="bg-slate-800/60 rounded-3xl p-3 sm:p-6 border border-slate-700/50 overflow-x-auto min-h-[600px] flex justify-center items-start shadow-inner">
            <div
              className="bg-white text-slate-900 rounded-2xl shadow-2xl transition-all duration-200 border border-slate-200 p-6 sm:p-8"
              style={{
                width: design.orientation === 'landscape' ? '1060px' : '820px',
                minHeight: design.pageSize === 'single_long_page' ? 'auto' : '1100px',
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
              }}
            >
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-5 mb-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 inline-block mb-1">
                    {design.companySubtitle || 'طلب شراء بضائع رسمي'}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black font-cairo text-slate-900">
                    {design.orderTitle || `طلبية مورد: ${supplierName}`}
                  </h2>
                  <div className="text-xs text-slate-600 mt-1 flex items-center gap-3">
                    <span>
                      الشركة المشترية: <strong>{design.companyName}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      المورد المستهدف: <strong className="text-amber-700">{supplierName}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-left text-xs text-slate-500 font-inter">
                  <div className="font-bold text-slate-800">
                    {new Date().toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="text-[11px]">PO Ref: #{order.id?.slice(0, 8) || 'PO-2026'}</div>
                </div>
              </div>

              {/* Order Notes (if set) */}
              {orderNotes && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900">
                  <span className="font-bold ml-1">شروط وملاحظات:</span>
                  {orderNotes}
                </div>
              )}

              {/* Summary Cards */}
              {design.showSummaryCards && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-slate-500 block">عدد المواد المحددة</span>
                    <strong className="text-base text-slate-900 font-inter">
                      {selectedItems.length}
                    </strong>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-amber-700 block">إجمالي الكمية المطلوبة</span>
                    <strong className="text-base text-amber-800 font-inter">
                      {totalRequestedQuantity} قطعة
                    </strong>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-500 block">تاريخ الطلبية</span>
                    <strong className="text-xs text-slate-800">
                      {new Date().toLocaleDateString('ar-EG')}
                    </strong>
                  </div>
                </div>
              )}

              {/* ========================================== */}
              {/* THE CUSTOMIZED TABLE */}
              {/* ========================================== */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                <table className="w-full text-right" style={{ fontSize: design.fontSize === 'small' ? '11px' : design.fontSize === 'large' ? '14px' : '12px' }}>
                  <thead style={{ backgroundColor: design.headerBackground, color: design.headerTextColor }}>
                    <tr>
                      {visibleColumns.map((col) => (
                        <th
                          key={col.id}
                          className="font-bold font-cairo whitespace-nowrap border-b border-black/10"
                          style={{
                            width: `${col.width}%`,
                            textAlign: col.alignment,
                            padding:
                              design.rowPadding === 'compact'
                                ? '6px 8px'
                                : design.rowPadding === 'relaxed'
                                ? '12px 14px'
                                : '8px 10px',
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={visibleColumns.length}
                          className="text-center p-8 text-slate-400 font-bold"
                        >
                          لا توجد منتجات مطابقة لنتيجة البحث.
                        </td>
                      </tr>
                    ) : (
                      displayedItems.map((item, idx) => {
                        const isEven = idx % 2 === 1;
                        const rowBg = isEven ? design.alternateRowBackground : '#ffffff';

                        return (
                          <tr
                            key={item.id}
                            style={{ backgroundColor: rowBg }}
                            className="hover:bg-amber-50/30 transition-colors"
                          >
                            {visibleColumns.map((col) => (
                              <td
                                key={col.id}
                                style={{
                                  textAlign: col.alignment,
                                  padding:
                                    design.rowPadding === 'compact'
                                      ? '4px 8px'
                                      : design.rowPadding === 'relaxed'
                                      ? '10px 14px'
                                      : '6px 10px',
                                }}
                              >
                                {renderCellContent(item, col, idx)}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Document Footer Notes */}
              {design.footerNotes && (
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-600 leading-relaxed text-center">
                  {design.footerNotes}
                </div>
              )}

              {/* Watermark / Brand stamp */}
              <div className="mt-8 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span>تم إنشاء هذا المستند عبر منصة E-zone</span>
                <span>الصفحة 1 من 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Manager Modal */}
      <PurchaseOrderTemplateModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        currentDesign={design}
        onApplyDesign={onChangeDesign}
        supplierName={supplierName}
      />
    </div>
  );
}
