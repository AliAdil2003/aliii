'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  ArrowUpDown,
  Search,
  Tag,
  Check,
  Package,
  Layers,
  Sparkles,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { Product } from '@/types';

interface ProductSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdateProducts: (updated: Product[]) => void;
  categories: string[];
}

export default function ProductSequenceModal({
  isOpen,
  onClose,
  products,
  onUpdateProducts,
  categories,
}: ProductSequenceModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isAiReordering, setIsAiReordering] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ message: string; model?: string } | null>(null);

  // Keep a local working copy of products sorted by order
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const ordA = typeof a.order === 'number' ? a.order : 0;
      const ordB = typeof b.order === 'number' ? b.order : 0;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [products]);

  if (!isOpen) return null;

  // Filtered list for display
  const displayProducts = sortedProducts.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchBarcode = p.barcode?.toLowerCase().includes(q);
      const matchCat = p.category?.toLowerCase().includes(q);
      if (!matchName && !matchBarcode && !matchCat) return false;
    }
    return true;
  });

  const handleReorder = (newSortedList: Product[]) => {
    // Re-assign normalized sequential 1..N order
    const updated = newSortedList.map((p, idx) => ({
      ...p,
      order: idx + 1,
      updatedAt: new Date().toISOString(),
    }));
    onUpdateProducts(updated);
  };

  const handleMoveStep = (productId: string, direction: 'up' | 'down') => {
    const list = [...sortedProducts];
    const currentIndex = list.findIndex((p) => p.id === productId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[currentIndex];
    list[currentIndex] = list[targetIndex];
    list[targetIndex] = temp;

    handleReorder(list);
  };

  const handleMoveToExtreme = (productId: string, to: 'top' | 'bottom') => {
    const list = [...sortedProducts];
    const currentIndex = list.findIndex((p) => p.id === productId);
    if (currentIndex === -1) return;

    const [item] = list.splice(currentIndex, 1);
    if (to === 'top') {
      list.unshift(item);
    } else {
      list.push(item);
    }

    handleReorder(list);
  };

  const handleSetExactOrder = (productId: string, targetOrder: number) => {
    const list = [...sortedProducts];
    const currentIndex = list.findIndex((p) => p.id === productId);
    if (currentIndex === -1) return;

    const targetIndex = Math.max(0, Math.min(list.length - 1, targetOrder - 1));
    if (targetIndex === currentIndex) return;

    const [item] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, item);

    handleReorder(list);
  };

  const handleCategoryChange = (productId: string, newCategory: string) => {
    const updated = products.map((p) =>
      p.id === productId
        ? { ...p, category: newCategory.trim(), updatedAt: new Date().toISOString() }
        : p
    );
    onUpdateProducts(updated);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) return;

    const list = [...sortedProducts];
    const sourceIndex = list.findIndex((p) => p.id === draggedId);
    const targetIndex = list.findIndex((p) => p.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedItem] = list.splice(sourceIndex, 1);
    list.splice(targetIndex, 0, movedItem);

    setDraggedId(null);
    handleReorder(list);
  };

  const handleAutoNormalize = () => {
    handleReorder([...sortedProducts]);
  };

  const handleAiReorder = async () => {
    setIsAiReordering(true);
    setAiFeedback(null);
    try {
      const res = await fetch('/api/ai/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.orderedProductIds)) {
        const idMap = new Map(products.map((p) => [p.id, p]));
        const reorderedList: Product[] = [];
        data.orderedProductIds.forEach((id: string, idx: number) => {
          const item = idMap.get(id);
          if (item) {
            reorderedList.push({
              ...item,
              order: idx + 1,
              updatedAt: new Date().toISOString(),
            });
            idMap.delete(id);
          }
        });
        // Append any remaining products
        idMap.forEach((item) => {
          reorderedList.push({
            ...item,
            order: reorderedList.length + 1,
            updatedAt: new Date().toISOString(),
          });
        });

        onUpdateProducts(reorderedList);
        setAiFeedback({
          message: data.reason || 'تم الترتيب التجاري للمنتجات بنجاح عبر Google Gemini',
          model: data.modelUsed,
        });
      } else {
        alert(data.error || 'تعذر استكمال الترتيب التجاري بالذكاء الاصطناعي');
      }
    } catch (err: any) {
      alert(`خطأ أثناء الترتيب: ${err.message || 'فشل الاتصال'}`);
    } finally {
      setIsAiReordering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black font-cairo text-white">
                ترتيب وتسلسل المنتجات وتعديل الفئات
              </h2>
              <p className="text-xs text-slate-400">
                غيّر تسلسل أي منتج يدوياً بالسحب أو كتابة رقم الترتيب أو اضغط ترتيب Gemini التجاري الذكي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAiReorder}
              disabled={isAiReordering}
              title="ترتيب تجاري احترافي لكتالوج المبيعات عبر Gemini 2.5 Flash"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              {isAiReordering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري ترتيب Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ترتيب تجاري بـ Gemini</span>
                </>
              )}
            </button>
            <button
              onClick={handleAutoNormalize}
              title="إعادة ترقيم التسلسل بالتتابع (1, 2, 3...)"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors flex items-center gap-1.5 border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ترقيم</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AI Feedback Banner */}
        {aiFeedback && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{aiFeedback.message}</span>
              {aiFeedback.model && (
                <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {aiFeedback.model}
                </span>
              )}
            </div>
            <button
              onClick={() => setAiFeedback(null)}
              className="text-amber-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar: Filter & Search */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث عن منتج لتغيير ترتيبه..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold"
              >
                <option value="all">جميع الفئات ({sortedProducts.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="text-slate-400 text-xs font-semibold">
            عرض {displayProducts.length} من {products.length} منتج
          </div>
        </div>

        {/* Product Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayProducts.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              لا توجد منتجات تطابق البحث
            </div>
          ) : (
            displayProducts.map((product, idx) => {
              const currentOrder = product.order ?? idx + 1;
              const isFirst = idx === 0;
              const isLast = idx === displayProducts.length - 1;
              const isDragOver = dragOverId === product.id;

              return (
                <div
                  key={product.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, product.id)}
                  onDragOver={(e) => handleDragOver(e, product.id)}
                  onDrop={(e) => handleDrop(e, product.id)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                    isDragOver
                      ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/40'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Drag Handle & Order Controls */}
                  <div className="flex items-center gap-2">
                    <div
                      className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-800"
                      title="اسحب وأفلت لإعادة الترتيب"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Numeric Direct Input */}
                    <div className="flex items-center gap-1" title="رقم التسلسل الحالي (اكتب رقماً لنقله مباشرة)">
                      <span className="text-[10px] font-bold text-slate-400">#</span>
                      <input
                        type="number"
                        min={1}
                        max={products.length}
                        defaultValue={currentOrder}
                        key={`${product.id}-${currentOrder}`}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val !== currentOrder) {
                            handleSetExactOrder(product.id, val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value, 10);
                            if (!isNaN(val) && val !== currentOrder) {
                              handleSetExactOrder(product.id, val);
                            }
                          }
                        }}
                        className="w-12 bg-slate-950 border border-slate-700 rounded-lg py-1 text-center font-black font-inter text-xs text-amber-400 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Step Movement Buttons */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleMoveStep(product.id, 'up')}
                        disabled={isFirst}
                        title="تحريك لأعلى خطوة واحدة"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveStep(product.id, 'down')}
                        disabled={isLast}
                        title="تحريك لأسفل خطوة واحدة"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveToExtreme(product.id, 'top')}
                        disabled={isFirst}
                        title="نقل إلى أعلى القائمة أولاً"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ChevronsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveToExtreme(product.id, 'bottom')}
                        disabled={isLast}
                        title="نقل إلى أسفل القائمة آخراً"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ChevronsDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Middle: Product Thumbnail & Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0 mx-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {product.imageData && product.imageStatus === 'valid' ? (
                        <img
                          src={product.imageData}
                          alt={product.name}
                          className="w-full h-full object-contain p-0.5"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-slate-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-white truncate font-cairo">
                        {product.name}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        {product.barcode && (
                          <span className="font-inter tracking-wider bg-slate-800 px-1.5 py-0.5 rounded">
                            {product.barcode}
                          </span>
                        )}
                        <span>السعر: {product.customerPrice ?? product.price}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Category Switcher */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative">
                      <select
                        value={product.category || 'عام'}
                        onChange={(e) => handleCategoryChange(product.id, e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-[11px] text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        {!categories.includes(product.category || 'عام') && (
                          <option value={product.category || 'عام'}>
                            {product.category || 'عام'}
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            يتم تحديث المعاينة الحية للكتالوج وملف PDF فورياً مع كل تعديل.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
          >
            تم وإنهاء
          </button>
        </div>
      </div>
    </div>
  );
}
