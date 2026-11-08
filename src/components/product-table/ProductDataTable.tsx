'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  ArrowUpDown,
  Sparkles,
  Package,
  AlertTriangle,
  FileCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Scissors,
  Camera,
  Warehouse,
  RefreshCw,
  CheckCircle2,
  AlertCircle as AlertCircleIcon,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Tag,
  ShoppingBag,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  Download,
  Loader2,
} from 'lucide-react';
import { Product, StockFilterConfig, StockFilterMode } from '@/types';
import {
  DEFAULT_EXCEL_EXPORT_CONFIG,
  exportCatalogToExcel,
} from '@/lib/excel/catalogExport';
import AICategorizationModal from './AICategorizationModal';
import NameShortenerModal from '../ai/NameShortenerModal';
import ProductImageModal from './ProductImageModal';

interface ProductDataTableProps {
  products: Product[];
  onUpdateProducts: (updated: Product[]) => void;
  onOpenShortener: (selectedIds: string[]) => void;
  currency?: string;
  onUpdateCategoryOrder?: (categoryOrder: string[]) => void;
  onOpenExcelExport?: (selectedIds?: string[]) => void;
}

export default function ProductDataTable({
  products,
  onUpdateProducts,
  onOpenShortener,
  currency = 'د.ع',
  onUpdateCategoryOrder,
  onOpenExcelExport,
}: ProductDataTableProps) {
  const [isCategorizationOpen, setIsCategorizationOpen] = useState(false);
  const [isNameShortenerOpen, setIsNameShortenerOpen] = useState(false);
  const [imageModalProduct, setImageModalProduct] = useState<Product | null>(null);
  const [isSyncingOdoo, setIsSyncingOdoo] = useState(false);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);
  const [odooSyncNotification, setOdooSyncNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stockFilter, setStockFilter] = useState<StockFilterConfig>({ mode: 'all' });
  const [customStockMin, setCustomStockMin] = useState<number>(0);
  const [customStockMax, setCustomStockMax] = useState<number>(4);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'included' | 'excluded'>('all');
  const [sortField, setSortField] = useState<keyof Product>('order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Advanced selection & excel export state
  const [isHeaderSelectionMenuOpen, setIsHeaderSelectionMenuOpen] = useState(false);
  const [isExcelExportMenuOpen, setIsExcelExportMenuOpen] = useState(false);
  const [isDirectExporting, setIsDirectExporting] = useState(false);
  const [directExportProgress, setDirectExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [directExportSuccess, setDirectExportSuccess] = useState(false);

  // Inline category editing state
  const [inlineCategoryEditingId, setInlineCategoryEditingId] = useState<string | null>(null);
  const [inlineCategoryValue, setInlineCategoryValue] = useState<string>('');

  // Bulk category modal state
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [bulkCategoryValue, setBulkCategoryValue] = useState('');

  // Drag and drop reordering state
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);

  const handleSyncFromOdoo = async () => {
    setIsSyncingOdoo(true);
    setOdooSyncNotification(null);

    try {
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
          projectId: products[0]?.projectId,
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

      onUpdateProducts(updatedProducts);

      let successMsg = `تم تحديث كميات ومخزون ${data.updatedCount || 0} منتج مباشرة من مخزن Odoo بنجاح!`;
      if (data.newCount && data.newCount > 0) {
        successMsg = `تم بنجاح تحديث ${data.updatedCount || 0} منتج، وإضافة ${data.newCount} منتج جديد نضاف في Odoo إلى الملف تلقائياً!`;
      }
      setOdooSyncNotification({
        type: 'success',
        message: successMsg,
      });
      setTimeout(() => setOdooSyncNotification(null), 8000);
    } catch (err: any) {
      setOdooSyncNotification({
        type: 'error',
        message: err.message || 'تعذر الاتصال بـ Odoo. يرجى التأكد من إعدادات الربط في صفحة الإعدادات.',
      });
    } finally {
      setIsSyncingOdoo(false);
    }
  };

  const handleSyncFromShopify = async () => {
    setIsSyncingShopify(true);
    setOdooSyncNotification(null);

    try {
      const res = await fetch('/api/shopify/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'فشلت عملية دمج بيانات متجر Shopify');
      }

      if (data.enrichedProducts && Array.isArray(data.enrichedProducts)) {
        onUpdateProducts(data.enrichedProducts);
      }

      setOdooSyncNotification({
        type: 'success',
        message: data.message || `تم بنجاح دمج أوصاف وروابط شراء متجر Shopify لـ ${data.matchedCount} منتج!`,
      });
      setTimeout(() => setOdooSyncNotification(null), 6000);
    } catch (err: any) {
      setOdooSyncNotification({
        type: 'error',
        message: `خطأ في دمج بيانات متجر Shopify: ${err.message}`,
      });
    } finally {
      setIsSyncingShopify(false);
    }
  };

  const handleSaveProductImage = (productId: string, newImageData: string) => {
    const isNewValid = Boolean(newImageData && newImageData.trim().length > 0);
    const status: 'valid' | 'missing' = isNewValid ? 'valid' : 'missing';
    const updated = products.map((p) =>
      p.id === productId
        ? {
            ...p,
            imageData: newImageData,
            imageStatus: status,
            imageError: undefined,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    onUpdateProducts(updated);
    if (editingProduct && editingProduct.id === productId) {
      setEditingProduct({
        ...editingProduct,
        imageData: newImageData,
        imageStatus: status,
        imageError: undefined,
      });
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search filter
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.internalReference && p.internalReference.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // 2. Stock filter (Section 8)
      if (stockFilter.mode === 'zero' && p.stock !== 0) return false;
      if (stockFilter.mode === 'less_than_5' && !(p.stock < 5)) return false;
      if (stockFilter.mode === 'less_than_or_equal_5' && !(p.stock <= 5)) return false;
      if (stockFilter.mode === 'greater_than_0' && !(p.stock > 0)) return false;
      if (stockFilter.mode === 'greater_than_5' && !(p.stock > 5)) return false;
      if (stockFilter.mode === 'custom') {
        const min = stockFilter.min ?? 0;
        const max = stockFilter.max ?? 999999;
        if (p.stock < min || p.stock > max) return false;
      }

      // 3. Category filter
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;

      // 4. Included / Excluded filter
      if (statusFilter === 'included' && !p.includedInCatalog) return false;
      if (statusFilter === 'excluded' && p.includedInCatalog) return false;

      return true;
    });
  }, [products, search, stockFilter, categoryFilter, statusFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      if (sortField === 'order') {
        const ordA = typeof a.order === 'number' ? a.order : 0;
        const ordB = typeof b.order === 'number' ? b.order : 0;
        return sortOrder === 'asc' ? ordA - ordB : ordB - ordA;
      }
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortOrder === 'asc'
        ? String(aVal || '').localeCompare(String(bVal || ''))
        : String(bVal || '').localeCompare(String(aVal || ''));
    });
  }, [filteredProducts, sortField, sortOrder]);

  // Reorder helper to re-assign 1..N order
  const handleReorderProducts = (reorderedList: Product[]) => {
    const updated = reorderedList.map((p, idx) => ({
      ...p,
      order: idx + 1,
      updatedAt: new Date().toISOString(),
    }));
    onUpdateProducts(updated);
  };

  // Move product step up or down
  const handleMoveProductStep = (productId: string, direction: 'up' | 'down') => {
    const list = [...products].sort((a, b) => {
      const ordA = typeof a.order === 'number' ? a.order : 0;
      const ordB = typeof b.order === 'number' ? b.order : 0;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });

    const currentIndex = list.findIndex((p) => p.id === productId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[currentIndex];
    list[currentIndex] = list[targetIndex];
    list[targetIndex] = temp;

    handleReorderProducts(list);
  };

  // Move product to exact order number (Sequence)
  const handleMoveProductToOrder = (productId: string, targetOrder: number) => {
    const list = [...products].sort((a, b) => {
      const ordA = typeof a.order === 'number' ? a.order : 0;
      const ordB = typeof b.order === 'number' ? b.order : 0;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });

    const currentIndex = list.findIndex((p) => p.id === productId);
    if (currentIndex === -1) return;

    const targetIndex = Math.max(0, Math.min(list.length - 1, targetOrder - 1));
    if (targetIndex === currentIndex) return;

    const [movedItem] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, movedItem);

    handleReorderProducts(list);
  };

  // Quick save inline category change
  const handleSaveProductCategory = (productId: string, newCat: string) => {
    const trimmed = newCat.trim();
    const updated = products.map((p) =>
      p.id === productId
        ? { ...p, category: trimmed || 'عام', updatedAt: new Date().toISOString() }
        : p
    );
    onUpdateProducts(updated);
    setInlineCategoryEditingId(null);
  };

  // Bulk category update for selected products
  const handleBulkApplyCategory = (newCat: string) => {
    if (!newCat.trim() || selectedIds.size === 0) return;
    const trimmed = newCat.trim();
    const updated = products.map((p) =>
      selectedIds.has(p.id)
        ? { ...p, category: trimmed, updatedAt: new Date().toISOString() }
        : p
    );
    onUpdateProducts(updated);
    setIsBulkCategoryOpen(false);
    setBulkCategoryValue('');
  };

  // Normalize orders to sequential 1, 2, 3...
  const handleNormalizeOrders = () => {
    const list = [...products].sort((a, b) => {
      const ordA = typeof a.order === 'number' ? a.order : 0;
      const ordB = typeof b.order === 'number' ? b.order : 0;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
    handleReorderProducts(list);
  };

  // Pagination slice
  const totalPages = Math.ceil(sortedProducts.length / pageSize) || 1;
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Selection handlers
  const handleSelectAll = () => {
    const newSet = new Set<string>();
    sortedProducts.forEach((p) => newSet.add(p.id));
    setSelectedIds(newSet);
    setIsHeaderSelectionMenuOpen(false);
  };

  const handleSelectAllOnPage = () => {
    const newSet = new Set(selectedIds);
    paginatedProducts.forEach((p) => newSet.add(p.id));
    setSelectedIds(newSet);
    setIsHeaderSelectionMenuOpen(false);
  };

  const handleSelectIncluded = () => {
    const newSet = new Set<string>();
    sortedProducts.filter((p) => p.includedInCatalog).forEach((p) => newSet.add(p.id));
    setSelectedIds(newSet);
    setIsHeaderSelectionMenuOpen(false);
  };

  const handleSelectWithImages = () => {
    const newSet = new Set<string>();
    sortedProducts.filter((p) => Boolean(p.imageData)).forEach((p) => newSet.add(p.id));
    setSelectedIds(newSet);
    setIsHeaderSelectionMenuOpen(false);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    setIsHeaderSelectionMenuOpen(false);
  };

  const isAllSelected =
    sortedProducts.length > 0 && sortedProducts.every((p) => selectedIds.has(p.id));
  const isAllOnPageSelected =
    paginatedProducts.length > 0 && paginatedProducts.every((p) => selectedIds.has(p.id));

  const handleToggleHeaderCheckbox = () => {
    if (isAllSelected) {
      handleDeselectAll();
    } else {
      handleSelectAll();
    }
  };

  // Quick Direct Excel Export
  const handleQuickExcelExport = async (includeImages: boolean) => {
    try {
      setIsDirectExporting(true);
      setDirectExportProgress(null);
      setDirectExportSuccess(false);

      const targetScope = selectedIds.size > 0 ? 'selected' : 'included';
      const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : [];

      const res = await exportCatalogToExcel(
        products,
        {
          ...DEFAULT_EXCEL_EXPORT_CONFIG,
          currency,
          includeImages,
          scope: targetScope,
          selectedIds: targetIds,
          columns: {
            ...DEFAULT_EXCEL_EXPORT_CONFIG.columns,
            image: includeImages,
          },
        },
        (current, total) => {
          setDirectExportProgress({ current, total });
        }
      );

      if (res.success) {
        setDirectExportSuccess(true);
        setTimeout(() => {
          setDirectExportSuccess(false);
          setDirectExportProgress(null);
        }, 4000);
      }
    } catch (err: any) {
      alert('خطأ أثناء تصدير ملف الإكسل: ' + (err.message || ''));
    } finally {
      setIsDirectExporting(false);
      setIsExcelExportMenuOpen(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Toggle single product inclusion
  const handleToggleInclude = (productId: string) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        return { ...p, includedInCatalog: !p.includedInCatalog };
      }
      return p;
    });
    onUpdateProducts(updated);
  };

  // Bulk include / exclude
  const handleBulkSetIncluded = (included: boolean) => {
    if (selectedIds.size === 0) return;
    const updated = products.map((p) => {
      if (selectedIds.has(p.id)) {
        return { ...p, includedInCatalog: included };
      }
      return p;
    });
    onUpdateProducts(updated);
  };

  // Save edited product
  const handleSaveEdit = (edited: Product) => {
    let updated = products.map((p) => (p.id === edited.id ? edited : p));
    if (edited.order !== undefined) {
      updated = [...updated]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p, idx) => ({ ...p, order: idx + 1 }));
    }
    onUpdateProducts(updated);
    setEditingProduct(null);
  };

  const inStockCount = useMemo(() => {
    return products.filter((p) => (p.stock || 0) > 0).length;
  }, [products]);

  const includedCount = useMemo(() => {
    return products.filter((p) => Boolean(p.includedInCatalog)).length;
  }, [products]);

  const shopifyCount = useMemo(() => {
    return products.filter((p) => Boolean((p as any).shopifyProduct?.handle)).length;
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      const s = p.stock || 0;
      return s > 0 && s <= 4;
    }).length;
  }, [products]);

  const zeroStockCount = useMemo(() => {
    return products.filter((p) => (p.stock || 0) === 0).length;
  }, [products]);

  return (
    <div className="space-y-4">
      {/* 1. Quick KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-[22px] border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400">إجمالي الأصناف</span>
            <p className="text-xl font-black text-slate-900 font-inter">{products.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[22px] border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400">المتوفر بالمخزن</span>
            <p className="text-xl font-black text-emerald-600 font-inter">{inStockCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[22px] border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400">المضمن بالكتالوج</span>
            <p className="text-xl font-black text-slate-900 font-inter">{includedCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#01334E] text-white flex items-center justify-center font-bold">
            <Eye className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[22px] border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400">شوبيفاي متصل</span>
            <p className="text-xl font-black text-indigo-600 font-inter">{shopifyCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 2. Modern Stock Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800 font-cairo">
              فلتر المخزون السريع:
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStockFilter({ mode: 'all' })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                stockFilter.mode === 'all'
                  ? 'bg-[#17181D] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              جميع المنتجات ({products.length})
            </button>

            <button
              onClick={() => setStockFilter({ mode: 'greater_than_0' })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                stockFilter.mode === 'greater_than_0'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              متوفر فقط ({inStockCount})
            </button>

            <button
              onClick={() => setStockFilter({ mode: 'less_than_5' })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                stockFilter.mode === 'less_than_5'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              مخزون قليل أقل من 5 ({lowStockCount})
            </button>

            <button
              onClick={() => setStockFilter({ mode: 'zero' })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                stockFilter.mode === 'zero'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              نفذ المخزون ({zeroStockCount})
            </button>
          </div>
        </div>

        {/* Custom Stock Range & Category Filter */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">نطاق مخصص:</span>
            <input
              type="number"
              value={customStockMin}
              onChange={(e) => setCustomStockMin(parseInt(e.target.value, 10) || 0)}
              className="w-16 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 text-center font-bold"
              placeholder="الحد الأدنى"
            />
            <span className="text-slate-400">إلى</span>
            <input
              type="number"
              value={customStockMax}
              onChange={(e) => setCustomStockMax(parseInt(e.target.value, 10) || 0)}
              className="w-16 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 text-center font-bold"
              placeholder="الحد الأقصى"
            />
            <button
              onClick={() =>
                setStockFilter({ mode: 'custom', min: customStockMin, max: customStockMax })
              }
              className={`px-3 py-1 rounded-full font-bold ${
                stockFilter.mode === 'custom'
                  ? 'bg-[#17181D] text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              تطبيق النطاق
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">حالة الإدراج:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-bold focus:outline-none"
              >
                <option value="all">الكل ({products.length})</option>
                <option value="included">
                  المضمنة في الكتالوج ({products.filter((p) => p.includedInCatalog).length})
                </option>
                <option value="excluded">
                  المستبعدة من PDF ({products.filter((p) => !p.includedInCatalog).length})
                </option>
              </select>
            </div>

            {categories.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold">الفئة:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-bold focus:outline-none"
                >
                  <option value="all">جميع الفئات ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Toolbar & Bulk Actions */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الباركود، المرجع..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="text-xs text-slate-500 font-bold whitespace-nowrap">
            {filteredProducts.length} من {products.length} منتج
          </div>

          {/* Quick Page Size Pill Selector (عرض منتجات للـ 1000) */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-bold whitespace-nowrap text-[11px]">عرض:</span>
            <div className="flex items-center gap-1">
              {[10, 25, 50, 100, 250, 500, 1000].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold font-inter transition-all ${
                    pageSize === size
                      ? 'bg-[#01334E] text-white shadow-xs scale-105'
                      : 'text-slate-600 hover:bg-slate-200/80'
                  }`}
                  title={`عرض ${size} منتج في الصفحة`}
                >
                  {size}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPageSize(sortedProducts.length > 1000 ? sortedProducts.length : 1000);
                  setCurrentPage(1);
                }}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                  pageSize >= (sortedProducts.length || 1000)
                    ? 'bg-[#01334E] text-white shadow-xs scale-105'
                    : 'text-slate-600 hover:bg-slate-200/80'
                }`}
                title="عرض جميع المنتجات في الصفحة الواحدة"
              >
                الكل
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Action Buttons & Excel Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 ? (
            <>
              <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1.5 rounded-lg border border-sky-200 flex items-center gap-1">
                <span>محدد:</span>
                <strong className="font-inter">{selectedIds.size}</strong>
                <span>من</span>
                <strong className="font-inter">{sortedProducts.length}</strong>
              </span>

              {selectedIds.size < sortedProducts.length && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                  title="تحديد كافة المنتجات في الجدول (جميع الصفحات)"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>تحديد الكل ({sortedProducts.length})</span>
                </button>
              )}

              <button
                onClick={() => setIsNameShortenerOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Scissors className="w-3.5 h-3.5 text-amber-200" />
                اختصار أسماء المحدد
              </button>

              <button
                onClick={() => setIsCategorizationOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                تصنيف المحدد بالذكاء الاصطناعي
              </button>

              <button
                onClick={() => onOpenShortener(Array.from(selectedIds))}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                اختصار الوصف للمحدد
              </button>

              <button
                onClick={() => handleBulkSetIncluded(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                title="استبعاد من الطباعة بدون حذف من الملف"
              >
                <EyeOff className="w-3.5 h-3.5" />
                استبعاد من PDF
              </button>

              <button
                onClick={() => handleBulkSetIncluded(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                إدراج في PDF
              </button>

              <button
                onClick={() => {
                  setBulkCategoryValue('');
                  setIsBulkCategoryOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Tag className="w-3.5 h-3.5 text-teal-200" />
                تعديل فئة المحدد
              </button>

              {/* Split Excel Export Button for Selected Items */}
              <div className="relative inline-flex items-center shadow-sm">
                <button
                  type="button"
                  onClick={() => onOpenExcelExport?.(Array.from(selectedIds))}
                  disabled={isDirectExporting}
                  className="px-3.5 py-1.5 rounded-r-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  title="تصدير المنتجات المحددة إلى ملف Excel (.xlsx)"
                >
                  {isDirectExporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  )}
                  <span>تصدير المحدد إلى Excel ({selectedIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsExcelExportMenuOpen((prev) => !prev)}
                  disabled={isDirectExporting}
                  className="px-2 py-1.5 rounded-l-lg bg-emerald-700 hover:bg-emerald-600 text-emerald-100 border-r border-emerald-500 text-xs transition-colors"
                  title="خيارات إضافية لتصدير المحدد إلى Excel مع أو بدون صور"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Excel Menu for Selected Items */}
                {isExcelExportMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsExcelExportMenuOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs animate-fadeIn space-y-1">
                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-100">
                        تصدير {selectedIds.size} منتج محدد:
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickExcelExport(true)}
                        className="w-full text-right px-3 py-2 rounded-lg hover:bg-indigo-50 text-slate-800 hover:text-indigo-900 font-bold transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-indigo-600" />
                          <span>تصدير مع صور المنتجات</span>
                        </div>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-inter">
                          Excel 🖼️
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickExcelExport(false)}
                        className="w-full text-right px-3 py-2 rounded-lg hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 font-bold transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>تصدير بدون صور (سريع)</span>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-inter">
                          ⚡ سريع
                        </span>
                      </button>

                      <div className="border-t border-slate-100 my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsExcelExportMenuOpen(false);
                          onOpenExcelExport?.(Array.from(selectedIds));
                        }}
                        className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-bold transition-colors flex items-center gap-2"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                        <span>تخصيص الخصومات والأعمدة...</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleDeselectAll}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                إلغاء التحديد
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                title="تحديد كافة المنتجات في الجدول (جميع الصفحات)"
              >
                <CheckSquare className="w-3.5 h-3.5 text-sky-600" />
                <span>تحديد الكل ({sortedProducts.length})</span>
              </button>

              <button
                type="button"
                onClick={handleSelectAllOnPage}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                title="تحديد المنتجات في الصفحة الحالية فقط"
              >
                تحديد صفحة العرض ({paginatedProducts.length})
              </button>

              <button
                onClick={handleNormalizeOrders}
                title="إعادة ترقيم تسلسل المنتجات بالتتابع 1، 2، 3..."
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                إعادة ترقيم التسلسل
              </button>

              <button
                onClick={() => setIsNameShortenerOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Scissors className="w-3.5 h-3.5" />
                اختصار أسماء المنتجات (AI)
              </button>

              <button
                onClick={() => setIsCategorizationOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                تصنيف وترتيب الفئات بالذكاء الاصطناعي (Gemini)
              </button>

              <button
                onClick={() => onOpenShortener([])}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                اختصار جميع الأوصاف بالذكاء الاصطناعي
              </button>

              <button
                type="button"
                onClick={handleSyncFromOdoo}
                disabled={isSyncingOdoo}
                title="مزامنة وتحديث كميات وأسعار المنتجات مباشرة من مخزن Odoo"
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSyncingOdoo ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Warehouse className="w-3.5 h-3.5 text-emerald-200" />
                )}
                <span>تحديث المخزون والأسعار من Odoo</span>
              </button>

              <button
                type="button"
                onClick={handleSyncFromShopify}
                disabled={isSyncingShopify}
                title="دمج الأوصاف التسويقية وروابط الشراء المباشرة من متجر Shopify (ezoneiraq.com)"
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSyncingShopify ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-200" />
                )}
                <span>دمج أوصاف وروابط Shopify</span>
              </button>

              {/* Split Excel Export Button for Whole Catalog */}
              <div className="relative inline-flex items-center shadow-sm">
                <button
                  type="button"
                  onClick={() => onOpenExcelExport?.()}
                  disabled={isDirectExporting}
                  title="تصدير بيانات الكتالوج إلى ملف Excel (.xlsx)"
                  className="px-3.5 py-1.5 rounded-r-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isDirectExporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  )}
                  <span>تصدير ملف Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsExcelExportMenuOpen((prev) => !prev)}
                  disabled={isDirectExporting}
                  className="px-2 py-1.5 rounded-l-lg bg-emerald-700 hover:bg-emerald-600 text-emerald-100 border-r border-emerald-500 text-xs transition-colors"
                  title="خيارات إضافية لتصدير الكتالوج إلى Excel مع أو بدون صور"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Excel Menu for Whole Catalog */}
                {isExcelExportMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsExcelExportMenuOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs animate-fadeIn space-y-1">
                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-100">
                        خيارات تصدير ملف الإكسل:
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickExcelExport(true)}
                        className="w-full text-right px-3 py-2 rounded-lg hover:bg-indigo-50 text-slate-800 hover:text-indigo-900 font-bold transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-indigo-600" />
                          <span>تصدير مع صور المنتجات</span>
                        </div>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-inter">
                          Excel 🖼️
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickExcelExport(false)}
                        className="w-full text-right px-3 py-2 rounded-lg hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 font-bold transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>تصدير بدون صور (سريع)</span>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-inter">
                          ⚡ سريع
                        </span>
                      </button>

                      <div className="border-t border-slate-100 my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsExcelExportMenuOpen(false);
                          onOpenExcelExport?.();
                        }}
                        className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-bold transition-colors flex items-center gap-2"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                        <span>تخصيص الخصومات والأعمدة...</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Direct Excel Export Progress & Notification Banners */}
      {isDirectExporting && (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-3.5 rounded-xl border border-indigo-500/40 text-xs flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
            <div>
              <span className="font-bold block">
                {directExportProgress
                  ? `جاري تجهيز وتضمين صور المنتجات في ملف Excel (${directExportProgress.current} من أصل ${directExportProgress.total})...`
                  : 'جاري إنشاء ورقة وتنسيق ملف الإكسل...'}
              </span>
              <span className="text-[11px] text-indigo-300">
                يرجى الانتظار، سيتم بدء تحميل الملف تلقائياً فور الانتهاء.
              </span>
            </div>
          </div>
          {directExportProgress && (
            <div className="text-left font-inter font-black text-sm text-indigo-300">
              {Math.round((directExportProgress.current / directExportProgress.total) * 100)}%
            </div>
          )}
        </div>
      )}

      {directExportSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-3 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-bold">تم تصدير وتنزيل ملف Excel بنجاح!</span>
          </div>
          <button
            onClick={() => setDirectExportSuccess(false)}
            className="text-slate-500 hover:text-slate-800 text-xs px-2 py-0.5 rounded font-bold"
          >
            ✕ إغلاق
          </button>
        </div>
      )}

      {/* Odoo Sync Notification Banner */}
      {odooSyncNotification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-sm animate-fadeIn ${
            odooSyncNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {odooSyncNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircleIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span className="font-bold">{odooSyncNotification.message}</span>
          </div>
          <button
            onClick={() => setOdooSyncNotification(null)}
            className="text-slate-500 hover:text-slate-800 text-xs px-2 py-0.5 rounded font-bold"
          >
            ✕ إغلاق
          </button>
        </div>
      )}

      {/* Bulk Selection Notification Banner */}
      {selectedIds.size > 0 && selectedIds.size < sortedProducts.length && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-950 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600 flex-shrink-0" />
            <span>
              تم تحديد <strong className="font-inter font-bold">{selectedIds.size}</strong> منتج.
              هل ترغب بتحديد كافة المنتجات في الكتالوج (<strong className="font-inter font-bold">{sortedProducts.length}</strong> منتج)؟
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow-xs"
            >
              تحديد كافة الـ {sortedProducts.length} منتج
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1 text-sky-700 hover:text-sky-900 font-bold transition-colors"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Products Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
              <tr>
                <th className="p-3 w-16 text-center relative">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = !isAllSelected && selectedIds.size > 0;
                        }
                      }}
                      onChange={handleToggleHeaderCheckbox}
                      title={
                        isAllSelected
                          ? 'إلغاء تحديد كافة المنتجات'
                          : 'تحديد كافة المنتجات في الكتالوج'
                      }
                      className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsHeaderSelectionMenuOpen((prev) => !prev);
                      }}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                      title="خيارات التحديد المتقدمة"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  {isHeaderSelectionMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsHeaderSelectionMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs text-right space-y-1 font-normal font-cairo text-slate-800">
                        <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-100">
                          خيارات تحديد المنتجات:
                        </div>

                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-sky-50 text-slate-800 font-bold transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-3.5 h-3.5 text-sky-600" />
                            <span>تحديد الكل في الكتالوج</span>
                          </div>
                          <span className="font-inter font-bold text-sky-700 text-[11px]">
                            {sortedProducts.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSelectAllOnPage}
                          className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-bold transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            <span>تحديد المعروض بالصفحة</span>
                          </div>
                          <span className="font-inter font-bold text-slate-600 text-[11px]">
                            {paginatedProducts.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSelectIncluded}
                          className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-bold transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>تحديد المضمنة في PDF</span>
                          </div>
                          <span className="font-inter font-bold text-slate-600 text-[11px]">
                            {products.filter((p) => p.includedInCatalog).length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSelectWithImages}
                          className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-bold transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                            <span>تحديد التي لها صور فقط</span>
                          </div>
                          <span className="font-inter font-bold text-slate-600 text-[11px]">
                            {products.filter((p) => Boolean(p.imageData)).length}
                          </span>
                        </button>

                        {selectedIds.size > 0 && (
                          <>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              type="button"
                              onClick={handleDeselectAll}
                              className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 font-bold transition-colors flex items-center justify-between"
                            >
                              <span>إلغاء التحديد</span>
                              <span className="font-inter font-bold text-[11px]">
                                ({selectedIds.size})
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </th>
                <th
                  onClick={() => {
                    setSortField('order');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="p-3 w-28 text-center cursor-pointer hover:text-amber-300"
                  title="الترتيب والتسلسل اليدوي للمنتج في الكتالوج"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span># التسلسل</span>
                    <ArrowUpDown className="w-3 h-3 text-amber-400" />
                  </div>
                </th>
                <th className="p-3 w-16 text-center">الصورة</th>
                <th
                  onClick={() => {
                    setSortField('name');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="p-3 w-56 cursor-pointer hover:text-sky-300"
                >
                  <div className="flex items-center gap-1">
                    <span>اسم المنتج ورابط الشراء</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3 min-w-[220px]">
                  <div className="flex items-center gap-1">
                    <span>الوصف</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      Shopify / AI
                    </span>
                  </div>
                </th>
                <th className="p-3 w-32 text-center">الباركود</th>
                <th
                  onClick={() => {
                    setSortField('customerPrice' as any);
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="p-3 w-28 text-center cursor-pointer hover:text-sky-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>سعر بيع الزبون</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('salePrice' as any);
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="p-3 w-28 text-center cursor-pointer hover:text-sky-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>سعر البيع (الجملة)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('stock');
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="p-3 w-28 text-center cursor-pointer hover:text-sky-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>المخزون</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3 w-28 text-center">الفئة / المرجع</th>
                <th className="p-3 w-28 text-center">الإدراج في PDF</th>
                <th className="p-3 w-20 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">
                    لا توجد منتجات تطابق الفلاتر المحددة
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, idx) => {
                  const isSelected = selectedIds.has(product.id);
                  const isIncluded = product.includedInCatalog;

                  return (
                    <tr
                      key={product.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedProductId(product.id);
                        e.dataTransfer.setData('text/plain', product.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedProductId && draggedProductId !== product.id) {
                          setDragOverProductId(product.id);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverProductId(null);
                        if (!draggedProductId || draggedProductId === product.id) return;

                        const list = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                        const sourceIdx = list.findIndex((p) => p.id === draggedProductId);
                        const targetIdx = list.findIndex((p) => p.id === product.id);
                        if (sourceIdx === -1 || targetIdx === -1) return;

                        const [moved] = list.splice(sourceIdx, 1);
                        list.splice(targetIdx, 0, moved);
                        setDraggedProductId(null);
                        handleReorderProducts(list);
                      }}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isIncluded ? 'opacity-55 bg-slate-50/40' : ''
                      } ${isSelected ? 'bg-sky-50/50' : ''} ${
                        dragOverProductId === product.id
                          ? 'border-t-2 border-b-2 border-amber-500 bg-amber-50/40'
                          : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(product.id)}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>

                      {/* Sequence / Order Control Cell */}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div
                            className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-amber-500 hover:bg-slate-100 rounded"
                            title="اسحب الصف لتغيير التسلسل يدوياً"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>

                          <input
                            type="number"
                            min={1}
                            max={products.length}
                            defaultValue={product.order || 1}
                            key={`${product.id}-${product.order}`}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val !== product.order) {
                                handleMoveProductToOrder(product.id, val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseInt((e.target as HTMLInputElement).value, 10);
                                if (!isNaN(val) && val !== product.order) {
                                  handleMoveProductToOrder(product.id, val);
                                }
                              }
                            }}
                            title="رقم التسلسل: اكتب الرقم واضغط Enter لنقل المنتج مباشرة"
                            className="w-12 bg-slate-50 hover:bg-white border border-slate-300 rounded text-center py-1 font-black font-inter text-xs text-amber-700 hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />

                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveProductStep(product.id, 'up')}
                              title="تحريك للأعلى خطوة واحدة"
                              className="p-0.5 hover:bg-slate-200 text-slate-500 hover:text-amber-600 rounded transition-colors"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveProductStep(product.id, 'down')}
                              title="تحريك للأسفل خطوة واحدة"
                              className="p-0.5 hover:bg-slate-200 text-slate-500 hover:text-amber-600 rounded transition-colors"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Image Preview with Base64 support & Quick Edit */}
                      <td className="p-3 text-center">
                        <div
                          onClick={() => setImageModalProduct(product)}
                          title="اضغط لتعديل أو تغيير صورة المنتج"
                          className="relative w-12 h-12 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center mx-auto shadow-sm cursor-pointer group hover:border-sky-500 hover:ring-2 hover:ring-sky-200 transition-all"
                        >
                          {product.imageData && product.imageStatus === 'valid' ? (
                            <img
                              src={product.imageData}
                              alt={product.name}
                              className="w-full h-full object-contain p-0.5"
                            />
                          ) : (
                            <span className="text-[9px] text-slate-400 font-bold p-1 text-center">
                              {product.imageStatus === 'invalid' ? '⚠️ تالفة' : 'بلا صورة'}
                            </span>
                          )}
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Camera className="w-4 h-4" />
                          </div>
                        </div>
                      </td>

                      {/* Column 1: Product Name & Shopify Purchase Link */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs font-cairo">
                            {product.name}
                          </span>
                          {product.shortenedName && product.name === product.shortenedName && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200"
                              title={`الاسم الأصلي في Excel: ${product.originalName || product.name}`}
                            >
                              اسم مختصر
                            </span>
                          )}
                        </div>

                        {/* Online Purchase Link with Store Badge */}
                        {product.shopifyUrl ? (
                          <div className="mt-1.5">
                            <a
                              href={product.shopifyUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10.5px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md font-bold transition-all shadow-xs group/link"
                              title="فتح صفحة المنتج مباشرة على متجر ezoneiraq.com"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ShoppingBag className="w-3 h-3 text-emerald-600 group-hover/link:scale-110 transition-transform" />
                              <span>رابط الشراء (ezoneiraq.com)</span>
                              <ExternalLink className="w-2.5 h-2.5 text-emerald-600 opacity-70" />
                            </a>
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-slate-400">
                            (لا يوجد رابط شراء)
                          </div>
                        )}
                      </td>

                      {/* Column 2: Dedicated Description (Shopify marketing description / AI / Custom) */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                                product.activeDescriptionType === 'shortened'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : product.shopifyDescription
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : product.activeDescriptionType === 'custom'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {product.activeDescriptionType === 'shortened'
                                ? 'مختصر بالذكاء (Gemini)'
                                : product.activeDescriptionType === 'custom'
                                ? 'معدل يدوياً'
                                : product.shopifyDescription
                                ? 'وصف متجر Shopify'
                                : 'الوصف الأصلي'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed whitespace-pre-line font-tajawal">
                            {product.activeDescriptionType === 'custom' && product.customDescription
                              ? product.customDescription
                              : product.activeDescriptionType === 'shortened' &&
                                product.shortenedDescription
                              ? product.shortenedDescription
                              : product.shopifyDescription || product.originalDescription || '(لا يوجد وصف)'}
                          </p>
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="p-3 text-center font-inter font-semibold text-slate-700 tracking-wider">
                        {product.barcode ? (
                          <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            {product.barcode}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Customer Price (سعر بيع الزبون) */}
                      <td className="p-3 text-center font-bold text-sky-700">
                        {typeof (product.customerPrice ?? product.price) === 'number'
                          ? `${Number(product.customerPrice ?? product.price).toLocaleString()} ${currency}`
                          : `${product.customerPrice ?? product.price} ${currency}`}
                      </td>

                      {/* Sale Price (سعر البيع) */}
                      <td className="p-3 text-center font-semibold text-slate-700">
                        {product.salePrice !== undefined && product.salePrice !== ''
                          ? typeof product.salePrice === 'number'
                            ? `${Number(product.salePrice).toLocaleString()} ${currency}`
                            : `${product.salePrice} ${currency}`
                          : '-'}
                      </td>

                      {/* Stock with Stock Badge */}
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            product.stock === 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : product.stock < 5
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {product.stock === 0 ? 'نفذ (0)' : product.stock}
                        </span>
                      </td>

                      {/* Category & Internal Ref (Editable) */}
                      <td className="p-3 text-center">
                        {inlineCategoryEditingId === product.id ? (
                          <div className="flex flex-col gap-1 items-center animate-fadeIn">
                            <input
                              type="text"
                              list="table-category-options"
                              value={inlineCategoryValue}
                              onChange={(e) => setInlineCategoryValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveProductCategory(product.id, inlineCategoryValue);
                                } else if (e.key === 'Escape') {
                                  setInlineCategoryEditingId(null);
                                }
                              }}
                              autoFocus
                              placeholder="الفئة..."
                              className="w-28 text-center bg-white border border-sky-400 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveProductCategory(product.id, inlineCategoryValue)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shadow-sm"
                                title="حفظ الفئة"
                              >
                                حفظ ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineCategoryEditingId(null)}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px]"
                                title="إلغاء"
                              >
                                إلغاء ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative inline-flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => {
                                setInlineCategoryEditingId(product.id);
                                setInlineCategoryValue(product.category || 'عام');
                              }}
                              className="inline-flex items-center gap-1 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-800 font-bold px-2 py-0.5 rounded text-[10px] mb-1 transition-colors border border-slate-200 hover:border-sky-300 shadow-xs"
                              title="اضغط لتعديل فئة هذا المنتج"
                            >
                              <span>{product.category || 'عام'}</span>
                              <Edit2 className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 text-sky-600" />
                            </button>
                            {product.internalReference && (
                              <span className="block text-[10px] text-slate-400 font-inter">
                                {product.internalReference}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Included in Catalog Toggle */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleInclude(product.id)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors inline-flex items-center gap-1 ${
                            isIncluded
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {isIncluded ? (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              مضمن بالكتالوج
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-slate-400" />
                              مستبعد من PDF
                            </>
                          )}
                        </button>
                      </td>

                      {/* Row Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setImageModalProduct(product)}
                            title="تعديل صورة المنتج"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProduct(product)}
                            title="تعديل المنتج"
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>عرض</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-inter"
            >
              <option value={10}>10 منتجات</option>
              <option value={25}>25 منتج</option>
              <option value={50}>50 منتج</option>
              <option value={100}>100 منتج</option>
              <option value={250}>250 منتج</option>
              <option value={500}>500 منتج</option>
              <option value={1000}>1,000 منتج</option>
              <option value={5000}>عرض الكل (كافة المنتجات)</option>
            </select>
            <span>منتج لكل صفحة</span>
          </div>

          <div className="flex items-center gap-3">
            <span>
              الصفحة {currentPage} من {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Product Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 font-cairo">
              تعديل بيانات المنتج في الكتالوج
            </h3>
            <p className="text-xs text-slate-500">
              التعديلات هنا تؤثر فقط على الكتالوج وملف الـ PDF المطبوع دون المساس بملف Excel
              الأصلي.
            </p>

            <div className="space-y-3">
              {/* Product Image Preview & Quick Edit Trigger */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                  {editingProduct.imageData && editingProduct.imageStatus === 'valid' ? (
                    <img
                      src={editingProduct.imageData}
                      alt={editingProduct.name}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">بلا صورة</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-800">صورة المنتج</div>
                  <div className="text-[11px] text-slate-500">
                    {editingProduct.imageData && editingProduct.imageStatus === 'valid'
                      ? 'صورة معتمدة وجاهزة للكتالوج والطباعة'
                      : 'لا توجد صورة صالحة لهذا المنتج'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImageModalProduct(editingProduct)}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:border-sky-500 hover:text-sky-700 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Camera className="w-3.5 h-3.5 text-sky-600" />
                  <span>تعديل الصورة</span>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    اسم المنتج المعروض في الكتالوج
                  </label>
                  {editingProduct.originalName && editingProduct.shortenedName && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingProduct({
                            ...editingProduct,
                            name: editingProduct.originalName!,
                            activeNameType: 'original',
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${
                          editingProduct.name === editingProduct.originalName
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        الاسم الأصلي
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingProduct({
                            ...editingProduct,
                            name: editingProduct.shortenedName!,
                            activeNameType: 'shortened',
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${
                          editingProduct.name === editingProduct.shortenedName
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        الاسم المختصر
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      name: e.target.value,
                      customName: e.target.value,
                      activeNameType: 'custom',
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر بيع الزبون</label>
                  <input
                    type="number"
                    value={editingProduct.customerPrice ?? editingProduct.price}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingProduct({
                        ...editingProduct,
                        customerPrice: val,
                        price: val,
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع (الجملة)</label>
                  <input
                    type="number"
                    value={editingProduct.salePrice ?? ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        salePrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المخزون</label>
                  <input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stock: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Category & Order in Modal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تصنيف المنتج (الفئة / Category)
                  </label>
                  <input
                    type="text"
                    list="modal-category-options"
                    value={editingProduct.category || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, category: e.target.value })
                    }
                    placeholder="اختر أو اكتب فئة جديدة..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                  <datalist id="modal-category-options">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>

                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400 self-center">فئات حالية:</span>
                      {categories.slice(0, 8).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingProduct({ ...editingProduct, category: c })}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            editingProduct.category === c
                              ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تسلسل المنتج (# Order)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingProduct.order || 1}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        order: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-inter text-center"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    موقع المنتج في الكتالوج
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الباركود (Barcode)
                </label>
                <input
                  type="text"
                  value={editingProduct.barcode}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, barcode: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-inter"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع الوصف المعتمد
                </label>
                <div className="flex gap-2">
                  {(['original', 'shortened', 'custom'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        setEditingProduct({
                          ...editingProduct,
                          activeDescriptionType: mode,
                        })
                      }
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        editingProduct.activeDescriptionType === mode
                          ? 'bg-sky-50 border-sky-500 text-sky-700'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {mode === 'original'
                        ? 'الأصلي'
                        : mode === 'shortened'
                        ? 'المختصر بالذكاء'
                        : 'مخصص'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    نص الوصف للطباعة
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      const textToShorten = editingProduct.shopifyDescription || editingProduct.originalDescription;
                      if (!textToShorten) return;
                      try {
                        const res = await fetch('/api/ai/shorten', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            originalDescription: textToShorten,
                            mode: 'short',
                            wordLimit: 20,
                            productName: editingProduct.name,
                          }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setEditingProduct({
                            ...editingProduct,
                            shortenedDescription: data.shortenedDescription,
                            activeDescriptionType: 'shortened',
                          });
                        }
                      } catch (err) {
                        console.error('Error shortening description:', err);
                      }
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors"
                    title="اختصار وصف هذا المنتج تلقائياً باستخدام نموذج Gemini الذكي"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>اختصار الوصف بـ Gemini</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={
                    editingProduct.activeDescriptionType === 'custom'
                      ? editingProduct.customDescription || ''
                      : editingProduct.activeDescriptionType === 'shortened'
                      ? editingProduct.shortenedDescription
                      : editingProduct.originalDescription
                  }
                  onChange={(e) => {
                    const text = e.target.value;
                    if (editingProduct.activeDescriptionType === 'custom') {
                      setEditingProduct({ ...editingProduct, customDescription: text });
                    } else if (editingProduct.activeDescriptionType === 'shortened') {
                      setEditingProduct({ ...editingProduct, shortenedDescription: text });
                    }
                  }}
                  disabled={editingProduct.activeDescriptionType === 'original'}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs disabled:opacity-60"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(editingProduct)}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-sky-500 hover:bg-sky-400 rounded-xl shadow-sm"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Datalist for table inline category editing */}
      <datalist id="table-category-options">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Bulk Category Change Modal */}
      {isBulkCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-right">
            <h3 className="text-base font-bold text-slate-900 font-cairo">
              تعديل فئة المنتجات المحددة ({selectedIds.size} منتج)
            </h3>
            <p className="text-xs text-slate-500">
              اختر فئة موجودة أو اكتب اسم فئة جديدة لتطبيقها على جميع المنتجات المحددة دفعة واحدة.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الفئة الجديدة
              </label>
              <input
                type="text"
                list="bulk-category-options"
                value={bulkCategoryValue}
                onChange={(e) => setBulkCategoryValue(e.target.value)}
                placeholder="اكتب اسم الفئة أو اختر من القائمة..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                autoFocus
              />
              <datalist id="bulk-category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBulkCategoryValue(c)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        bulkCategoryValue === c
                          ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkCategoryOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleBulkApplyCategory(bulkCategoryValue)}
                disabled={!bulkCategoryValue.trim()}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-sky-500 hover:bg-sky-400 rounded-xl shadow-sm disabled:opacity-50"
              >
                تطبيق الفئة على المحدد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modern Bulk Action Capsule */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#01334E] text-white px-5 py-3 rounded-full shadow-2xl border border-white/10 flex items-center gap-3 animate-fadeIn">
          <span className="text-xs font-black bg-white text-[#01334E] px-3 py-1 rounded-full font-inter">
            {selectedIds.size} محدد
          </span>

          <div className="h-4 w-px bg-white/20" />

          <button
            type="button"
            onClick={() => handleBulkSetIncluded(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-white hover:text-emerald-300 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>تضمين في الكتالوج</span>
          </button>

          <button
            type="button"
            onClick={() => handleBulkSetIncluded(false)}
            className="flex items-center gap-1.5 text-xs font-bold text-white hover:text-rose-300 transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5 text-rose-400" />
            <span>استبعاد</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenShortener(Array.from(selectedIds))}
            className="flex items-center gap-1.5 text-xs font-bold text-white hover:underline"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>اختصار الأوصاف (Gemini)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNameShortenerOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-orange-300 hover:underline"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>اختصار الأسماء</span>
          </button>

          <button
            type="button"
            onClick={handleDeselectAll}
            className="text-xs text-slate-400 hover:text-white px-2"
          >
            إلغاء
          </button>
        </div>
      )}

      {/* AI Categorization Modal */}
      <AICategorizationModal
        isOpen={isCategorizationOpen}
        onClose={() => setIsCategorizationOpen(false)}
        products={products}
        selectedProductIds={Array.from(selectedIds)}
        onApplyClassifications={(updatedProducts, recommendedOrder) => {
          onUpdateProducts(updatedProducts);
          if (recommendedOrder && onUpdateCategoryOrder) {
            onUpdateCategoryOrder(recommendedOrder);
          }
        }}
      />

      {/* Product Name Shortener Modal */}
      <NameShortenerModal
        isOpen={isNameShortenerOpen}
        onClose={() => setIsNameShortenerOpen(false)}
        products={products}
        selectedProductIds={Array.from(selectedIds)}
        onApplyShortenedNames={(updatedProducts) => {
          onUpdateProducts(updatedProducts);
        }}
      />

      {/* Product Image Editor Modal */}
      <ProductImageModal
        isOpen={!!imageModalProduct}
        onClose={() => setImageModalProduct(null)}
        product={imageModalProduct}
        onSaveImage={handleSaveProductImage}
      />
    </div>
  );
}
