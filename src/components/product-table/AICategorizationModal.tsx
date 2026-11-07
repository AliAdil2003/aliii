'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ArrowRight,
  RefreshCw,
  Sliders,
  Check,
  ChevronDown,
  ListOrdered,
  Tag,
  Zap,
  Cpu,
  Info,
} from 'lucide-react';
import { Product } from '@/types';
import { STANDARD_CATALOG_CATEGORIES } from '@/lib/ai/gemini';

interface AICategorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProductIds?: string[];
  onApplyClassifications: (
    updatedProducts: Product[],
    recommendedCategoryOrder?: string[]
  ) => void;
}

interface ClassifiedItem {
  id: string;
  name: string;
  originalCategory: string;
  suggestedCategory: string;
  confidence: number;
  reason?: string;
  accepted: boolean;
  imageData?: string;
}

export default function AICategorizationModal({
  isOpen,
  onClose,
  products,
  selectedProductIds = [],
  onApplyClassifications,
}: AICategorizationModalProps) {
  // Step: 'configure' | 'processing' | 'review'
  const [step, setStep] = useState<'configure' | 'processing' | 'review'>('configure');

  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    hasKey: boolean;
    isGeminiLive: boolean;
    model: string;
    message: string;
    latencyMs?: number;
  }>({
    tested: false,
    hasKey: false,
    isGeminiLive: false,
    model: 'none',
    message: 'جاري فحص الاتصال بمحرك الذكاء الاصطناعي...',
  });

  // Scope selection
  const [scope, setScope] = useState<'all' | 'uncategorized' | 'selected'>('all');

  // Custom Categories list to enforce
  const [targetCategories, setTargetCategories] = useState<string[]>([
    ...STANDARD_CATALOG_CATEGORIES,
  ]);
  const [newCatInput, setNewCatInput] = useState('');

  // Results
  const [results, setResults] = useState<ClassifiedItem[]>([]);
  const [recommendedOrder, setRecommendedOrder] = useState<string[]>([]);
  const [engineUsed, setEngineUsed] = useState<string>('');
  const [autoEnableGrouping, setAutoEnableGrouping] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set default scope when opening
  useEffect(() => {
    if (isOpen) {
      if (selectedProductIds.length > 0) {
        setScope('selected');
      } else {
        setScope('all');
      }
      setStep('configure');
      setResults([]);
      setErrorMsg(null);
      checkGeminiConnection();
    }
  }, [isOpen, selectedProductIds]);

  const checkGeminiConnection = async () => {
    try {
      const res = await fetch('/api/ai/test-connection', { method: 'GET' });
      const data = await res.json();
      if (data.hasKey) {
        // Test live prompt
        const testRes = await fetch('/api/ai/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const testData = await testRes.json();
        setConnectionStatus({
          tested: true,
          hasKey: true,
          isGeminiLive: testData.success,
          model: testData.model || data.currentModel || 'Google Gemini 2.5 Flash',
          message: testData.message,
          latencyMs: testData.latencyMs,
        });
      } else {
        setConnectionStatus({
          tested: true,
          hasKey: false,
          isGeminiLive: false,
          model: 'Heuristic Engine',
          message:
            'محرك الاستخراج والتصنيف الذكي المحلي جاهز للعمل الفوري (بدون مفتاح API). يمكنك إضافة مفتاح Gemini في الإعدادات لدقة أعمق.',
        });
      }
    } catch {
      setConnectionStatus({
        tested: true,
        hasKey: false,
        isGeminiLive: false,
        model: 'Heuristic Engine',
        message: 'محرك التحليل الاستخراجي المحلي نشط وجاهز.',
      });
    }
  };

  // Determine target products based on scope
  const targetProducts = useMemo(() => {
    if (scope === 'selected' && selectedProductIds.length > 0) {
      return products.filter((p) => selectedProductIds.includes(p.id));
    }
    if (scope === 'uncategorized') {
      return products.filter(
        (p) => !p.category || p.category.trim() === '' || p.category === 'عام'
      );
    }
    return products;
  }, [products, scope, selectedProductIds]);

  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (trimmed && !targetCategories.includes(trimmed)) {
      setTargetCategories([...targetCategories, trimmed]);
      setNewCatInput('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setTargetCategories(targetCategories.filter((c) => c !== cat));
  };

  const startClassification = async () => {
    if (targetProducts.length === 0) {
      setErrorMsg('لا توجد منتجات مطابقة للنطاق المحدد.');
      return;
    }

    setStep('processing');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: targetProducts,
          preferredCategories: targetCategories,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'حدث خطأ أثناء تصنيف المنتجات.');
      }

      const data = await res.json();
      const classified: ClassifiedItem[] = (data.classifications || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        originalCategory: c.originalCategory || 'عام',
        suggestedCategory: c.suggestedCategory || 'عام',
        confidence: c.confidence || 0.9,
        reason: c.reason,
        accepted: true,
        imageData: c.imageData || targetProducts.find((p) => p.id === c.id)?.imageData,
      }));

      setResults(classified);
      setRecommendedOrder(data.categoryOrder || targetCategories);
      setEngineUsed(
        data.source === 'gemini'
          ? (data.modelUsed || 'Google Gemini 2.5 Flash (Vision Multimodal)')
          : 'محرك التحليل الذكي (الصور والكلمات المفتاحية)'
      );
      setStep('review');
    } catch (err: any) {
      setErrorMsg(err.message || 'فشلت عملية التصنيف.');
      setStep('configure');
    }
  };

  const handleUpdateItemCategory = (id: string, newCat: string) => {
    setResults(
      results.map((r) => (r.id === id ? { ...r, suggestedCategory: newCat } : r))
    );
  };

  const handleToggleAccept = (id: string) => {
    setResults(
      results.map((r) => (r.id === id ? { ...r, accepted: !r.accepted } : r))
    );
  };

  const handleApply = () => {
    // Build category map from accepted results
    const resultMap = new Map<string, string>();
    results.forEach((r) => {
      if (r.accepted && r.suggestedCategory) {
        resultMap.set(r.id, r.suggestedCategory);
      }
    });

    const updatedProducts = products.map((p) => {
      if (resultMap.has(p.id)) {
        return {
          ...p,
          category: resultMap.get(p.id)!,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    onApplyClassifications(
      updatedProducts,
      autoEnableGrouping ? recommendedOrder : undefined
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cairo text-white flex items-center gap-2">
                تصنيف المنتجات بالذكاء الاصطناعي (Gemini AI)
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  v2.0
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تحليل أسماء ومواصفات المنتجات وتجميعها تلقائياً بتسلسل تجاري منظم (شواحن، كابلات، بنوك طاقة...)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Engine Status Banner */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div
                className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                  connectionStatus.isGeminiLive
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  <span>محرك التحليل النشط:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                      connectionStatus.isGeminiLive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {connectionStatus.model}
                  </span>
                  {connectionStatus.latencyMs && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({connectionStatus.latencyMs}ms)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {connectionStatus.message}
                </p>
              </div>
            </div>

            <button
              onClick={checkGeminiConnection}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold whitespace-nowrap self-end sm:self-center"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث الفحص</span>
            </button>
          </div>

          {/* STEP 1: CONFIGURE */}
          {step === 'configure' && (
            <div className="space-y-6">
              {/* Scope Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span>1. تحديد نطاق المنتجات المراد تصنيفها:</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      scope === 'all'
                        ? 'bg-sky-950/40 border-sky-500 text-white shadow-lg shadow-sky-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-sm text-white">جميع المنتجات</div>
                    <div className="text-xs text-slate-400 mt-1">
                      تصنيف وترتيب كافة المنتجات في الملف
                    </div>
                    <div className="mt-3 text-xs font-mono font-bold text-sky-400">
                      {products.length} منتج
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('uncategorized')}
                    className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      scope === 'uncategorized'
                        ? 'bg-sky-950/40 border-sky-500 text-white shadow-lg shadow-sky-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-sm text-white">غير المصنفة فقط</div>
                    <div className="text-xs text-slate-400 mt-1">
                      المنتجات الخالية من فئة أو المصنفة "عام"
                    </div>
                    <div className="mt-3 text-xs font-mono font-bold text-sky-400">
                      {
                        products.filter(
                          (p) => !p.category || p.category.trim() === '' || p.category === 'عام'
                        ).length
                      }{' '}
                      منتج
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={selectedProductIds.length === 0}
                    onClick={() => setScope('selected')}
                    className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      selectedProductIds.length === 0
                        ? 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-900'
                        : scope === 'selected'
                        ? 'bg-sky-950/40 border-sky-500 text-white shadow-lg shadow-sky-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-sm text-white">المحددة فقط</div>
                    <div className="text-xs text-slate-400 mt-1">
                      المنتجات المختارة بعلامة صح في الجدول
                    </div>
                    <div className="mt-3 text-xs font-mono font-bold text-sky-400">
                      {selectedProductIds.length} منتج محدد
                    </div>
                  </button>
                </div>
              </div>

              {/* Taxonomy / Target Categories Configuration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-400" />
                    <span>2. الفئات المعتمدة للتصنيف والتسلسل التجاري:</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {targetCategories.length} فئة معتمدة
                  </span>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {targetCategories.map((cat, idx) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-bold text-slate-200 group"
                      >
                        <span className="text-[10px] font-mono text-sky-400">{idx + 1}.</span>
                        <span>{cat}</span>
                        {targetCategories.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                            title="إزالة هذه الفئة"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Add Custom Category Input */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <input
                      type="text"
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      placeholder="إضافة فئة تجارية مخصصة..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold transition-colors"
                    >
                      إضافة فئة
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetCategories([...STANDARD_CATALOG_CATEGORIES])}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs transition-colors"
                      title="استعادة الفئات القياسية"
                    >
                      استعادة الافتراضي
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin" />
                <Sparkles className="w-6 h-6 text-sky-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-cairo">
                  جاري تحليل وتصنيف المنتجات...
                </h3>
                <p className="text-xs text-slate-400">
                  يتم فحص الأسماء والمواصفات ومطابقتها مع أفضل الفئات التجارية المعتمدة ({targetProducts.length} منتج)
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW RESULTS */}
          {step === 'review' && (
            <div className="space-y-5">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400">المنتجات المصنفة</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {results.filter((r) => r.accepted).length} من {results.length}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400">الفئات الناتجة</span>
                  <span className="text-sm font-bold font-mono text-sky-400">
                    {new Set(results.filter((r) => r.accepted).map((r) => r.suggestedCategory)).size} فئة
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400">المحرك المستخدم</span>
                  <span className="text-xs font-bold text-amber-300">{engineUsed}</span>
                </div>
              </div>

              {/* Recommended Catalog Order Sequence */}
              <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-800/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-sky-300 font-cairo">
                      التسلسل التجاري المقترح لعرض الفئات في الكتالوج:
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoEnableGrouping}
                      onChange={(e) => setAutoEnableGrouping(e.target.checked)}
                      className="rounded border-slate-700 text-sky-500 focus:ring-sky-500"
                    />
                    <span>تطبيق هذا التسلسل تلقائياً في مصمم الكتالوج</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {recommendedOrder
                    .filter((cat) =>
                      results.some((r) => r.accepted && r.suggestedCategory === cat)
                    )
                    .map((cat, idx) => (
                      <span
                        key={cat}
                        className="px-2.5 py-1 rounded-lg bg-sky-900/60 border border-sky-700/70 text-[11px] font-bold text-white flex items-center gap-1.5"
                      >
                        <span className="w-4 h-4 rounded-full bg-sky-500 text-slate-950 font-mono text-[9px] flex items-center justify-center font-black">
                          {idx + 1}
                        </span>
                        <span>{cat}</span>
                      </span>
                    ))}
                </div>
              </div>

              {/* Products Table with editable suggestions */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold sticky top-0 border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">اعتماد</th>
                        <th className="p-3 w-14 text-center">الصورة</th>
                        <th className="p-3">اسم المنتج</th>
                        <th className="p-3 w-28 text-center">الفئة الحالية</th>
                        <th className="p-3 w-44 text-center">الفئة المقترحة (الذكاء الاصطناعي)</th>
                        <th className="p-3 w-20 text-center">الدقة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {results.map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            !item.accepted ? 'opacity-40 line-through' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.accepted}
                              onChange={() => handleToggleAccept(item.id)}
                              className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 cursor-pointer"
                            />
                          </td>

                          <td className="p-2 text-center">
                            {item.imageData && item.imageData.length > 20 ? (
                              <img
                                src={item.imageData}
                                alt=""
                                className="w-10 h-10 object-contain rounded-lg border border-slate-700 bg-white mx-auto shadow-sm"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg border border-slate-800 bg-slate-950 text-slate-600 flex items-center justify-center text-[9px] mx-auto">
                                بلا صورة
                              </div>
                            )}
                          </td>

                          <td className="p-3 font-semibold text-white">
                            <div>{item.name}</div>
                            {item.reason && (
                              <div className="text-[10px] text-sky-300 font-normal mt-0.5 line-clamp-1">
                                {item.reason}
                              </div>
                            )}
                          </td>

                          <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                            {item.originalCategory || 'عام'}
                          </td>

                          <td className="p-3 text-center">
                            <select
                              value={item.suggestedCategory}
                              disabled={!item.accepted}
                              onChange={(e) => handleUpdateItemCategory(item.id, e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-sky-300 focus:outline-none focus:border-sky-500 w-full"
                            >
                              {targetCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                item.confidence >= 0.9
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              %{Math.round(item.confidence * 100)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
          >
            إلغاء
          </button>

          {step === 'configure' && (
            <button
              type="button"
              onClick={startClassification}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>بدء التصنيف الذكي ({targetProducts.length} منتج)</span>
            </button>
          )}

          {step === 'review' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('configure')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                تعديل الإعدادات
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" />
                <span>
                  تطبيق التصنيف وحفظ الفئات ({results.filter((r) => r.accepted).length} منتج)
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
