'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Type,
  ArrowRight,
  RefreshCw,
  Sliders,
  Check,
  ShieldCheck,
  Edit3,
  Scissors,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import { Product, NameShortenMode } from '@/types';

interface NameShortenerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProductIds?: string[];
  onApplyShortenedNames: (updatedProducts: Product[]) => void;
}

interface ShortenedNameReviewItem {
  id: string;
  originalName: string;
  shortenedName: string;
  wordCount: number;
  reductionPercent: number;
  reason?: string;
  accepted: boolean;
}

export default function NameShortenerModal({
  isOpen,
  onClose,
  products,
  selectedProductIds = [],
  onApplyShortenedNames,
}: NameShortenerModalProps) {
  const [step, setStep] = useState<'configure' | 'processing' | 'review'>('configure');

  // Shortening Mode
  const [mode, setMode] = useState<NameShortenMode>('short');
  const [customWordLimit, setCustomWordLimit] = useState<number>(5);

  // Scope: 'all' | 'long_only' | 'selected'
  const [scope, setScope] = useState<'all' | 'long_only' | 'selected'>('all');

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    hasKey: boolean;
    isGeminiLive: boolean;
    model: string;
    message: string;
  }>({
    tested: false,
    hasKey: false,
    isGeminiLive: false,
    model: 'none',
    message: 'جاري فحص الاتصال بمحرك الذكاء الاصطناعي...',
  });

  // Results & Review
  const [results, setResults] = useState<ShortenedNameReviewItem[]>([]);
  const [engineUsed, setEngineUsed] = useState<string>('');
  const [setActiveInCatalog, setSetActiveInCatalog] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        setConnectionStatus({
          tested: true,
          hasKey: true,
          isGeminiLive: true,
          model: 'Google Gemini 1.5 Flash',
          message: 'محرك Google Gemini 1.5 Flash نشط ومستعد لاختصار الأسماء بذكاء سياقي عالي.',
        });
      } else {
        setConnectionStatus({
          tested: true,
          hasKey: false,
          isGeminiLive: false,
          model: 'Heuristic Title Engine',
          message: 'محرك الاختصار الذكي المدمج نشط محلياً دون الحاجة لمفتاح API.',
        });
      }
    } catch {
      setConnectionStatus({
        tested: true,
        hasKey: false,
        isGeminiLive: false,
        model: 'Heuristic Title Engine',
        message: 'محرك الاختصار الاستخراجي المحلي نشط.',
      });
    }
  };

  // Target products according to scope
  const targetProducts = useMemo(() => {
    if (scope === 'selected' && selectedProductIds.length > 0) {
      return products.filter((p) => selectedProductIds.includes(p.id));
    }
    if (scope === 'long_only') {
      return products.filter((p) => (p.name || '').length > 30);
    }
    return products;
  }, [products, scope, selectedProductIds]);

  const handleStartShortening = async () => {
    if (targetProducts.length === 0) {
      setErrorMsg('لا توجد منتجات مطابقة للنطاق المحدد.');
      return;
    }

    setStep('processing');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/shorten-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: targetProducts.map((p) => ({
            id: p.id,
            name: p.originalName || p.name,
            category: p.category,
            internalReference: p.internalReference,
          })),
          mode,
          maxWords: mode === 'custom' ? customWordLimit : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'حدث خطأ أثناء اختصار أسماء المنتجات.');
      }

      const data = await res.json();
      const reviewItems: ShortenedNameReviewItem[] = (data.results || []).map((item: any) => ({
        id: item.id,
        originalName: item.originalName,
        shortenedName: item.shortenedName,
        wordCount: item.wordCount,
        reductionPercent: item.reductionPercent,
        reason: item.reason,
        accepted: true,
      }));

      setResults(reviewItems);
      setEngineUsed(
        data.source === 'gemini'
          ? 'Google Gemini 1.5 Flash'
          : 'محرك الاختصار الذكي المدمج'
      );
      setStep('review');
    } catch (err: any) {
      setErrorMsg(err.message || 'فشلت عملية اختصار الأسماء.');
      setStep('configure');
    }
  };

  const handleUpdateItemShortenedName = (id: string, newName: string) => {
    setResults(
      results.map((r) => {
        if (r.id === id) {
          const words = newName.trim().split(/\s+/).filter(Boolean);
          const initialLen = r.originalName.length;
          const finalLen = newName.length;
          const reduction = initialLen > 0 ? Math.max(0, Math.round(((initialLen - finalLen) / initialLen) * 100)) : 0;
          return {
            ...r,
            shortenedName: newName,
            wordCount: words.length,
            reductionPercent: reduction,
          };
        }
        return r;
      })
    );
  };

  const handleToggleAccept = (id: string) => {
    setResults(
      results.map((r) => (r.id === id ? { ...r, accepted: !r.accepted } : r))
    );
  };

  const handleApply = () => {
    const resultMap = new Map<string, string>();
    results.forEach((r) => {
      if (r.accepted && r.shortenedName.trim()) {
        resultMap.set(r.id, r.shortenedName.trim());
      }
    });

    const updated = products.map((p) => {
      const orig = p.originalName || p.name;
      if (resultMap.has(p.id)) {
        const shortName = resultMap.get(p.id)!;
        return {
          ...p,
          originalName: orig,
          shortenedName: shortName,
          name: setActiveInCatalog ? shortName : p.name,
          activeNameType: setActiveInCatalog ? ('shortened' as const) : p.activeNameType || ('original' as const),
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...p,
        originalName: orig,
      };
    });

    onApplyShortenedNames(updated);
    onClose();
  };

  if (!isOpen) return null;

  // Calculate average reduction
  const avgReduction = results.length > 0
    ? Math.round(
        results.filter((r) => r.accepted).reduce((acc, curr) => acc + curr.reductionPercent, 0) /
          Math.max(1, results.filter((r) => r.accepted).length)
      )
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-cairo text-white flex items-center gap-2">
                مساعد اختصار أسماء المنتجات (Product Name Shortener)
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  AI + Smart
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تقليص الأسماء الطويلة من ملف Excel إلى عناوين تجارية أنيقة وموجزة تناسب جداول الكتالوج المطبوع
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
                  <span>محرك الاختصار النشط:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                      connectionStatus.isGeminiLive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {connectionStatus.model}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {connectionStatus.message}
                </p>
              </div>
            </div>
          </div>

          {/* STEP 1: CONFIGURE */}
          {step === 'configure' && (
            <div className="space-y-6">
              {/* Scope Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span>1. تحديد نطاق المنتجات المراد اختصار أسمائها:</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      scope === 'all'
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-sm text-white">جميع المنتجات</div>
                    <div className="text-xs text-slate-400 mt-1">
                      اختصار أسماء كافة المنتجات في الكتالوج
                    </div>
                    <div className="mt-3 text-xs font-mono font-bold text-amber-400">
                      {products.length} منتج
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('long_only')}
                    className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      scope === 'long_only'
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-sm text-white">الأسماء الطويلة فقط</div>
                    <div className="text-xs text-slate-400 mt-1">
                      المنتجات التي تتجاوز 30 حرفاً وتشغل أسطراً زائدة
                    </div>
                    <div className="mt-3 text-xs font-mono font-bold text-amber-400">
                      {products.filter((p) => (p.name || '').length > 30).length} منتج طويل
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
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-sm text-white">المحددة فقط</div>
                    <div className="text-xs text-slate-400 mt-1">
                      المنتجات المختارة بعلامة صح في الجدول
                    </div>
                    <div className="mt-3 text-xs font-mono font-bold text-amber-400">
                      {selectedProductIds.length} منتج محدد
                    </div>
                  </button>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Type className="w-4 h-4 text-amber-400" />
                  <span>2. اختيار نمط الاختصار المستهدف:</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('very_short')}
                    className={`p-3.5 rounded-2xl border text-right transition-all ${
                      mode === 'very_short'
                        ? 'bg-sky-950/50 border-sky-400 text-white'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-xs text-white">فائق الاختصار</div>
                    <div className="text-[11px] text-slate-400 mt-1">3 - 4 كلمات فقط</div>
                    <div className="text-[10px] text-sky-400 font-mono mt-2">
                      مثال: شاحن أنكر 20W
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('short')}
                    className={`p-3.5 rounded-2xl border text-right transition-all ${
                      mode === 'short'
                        ? 'bg-sky-950/50 border-sky-400 text-white'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-xs text-white flex items-center justify-between">
                      <span>متوازن (موصى به)</span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                        الأفضل
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">4 - 6 كلمات متوازنة</div>
                    <div className="text-[10px] text-sky-400 font-mono mt-2">
                      مثال: شاحن جداري أنكر نانو 30W
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('medium')}
                    className={`p-3.5 rounded-2xl border text-right transition-all ${
                      mode === 'medium'
                        ? 'bg-sky-950/50 border-sky-400 text-white'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-xs text-white">شامل للمواصفات</div>
                    <div className="text-[11px] text-slate-400 mt-1">6 - 8 كلمات توضيحية</div>
                    <div className="text-[10px] text-sky-400 font-mono mt-2">
                      مثال: شاحن جداري أنكر 65W GaN منفذين
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('custom')}
                    className={`p-3.5 rounded-2xl border text-right transition-all ${
                      mode === 'custom'
                        ? 'bg-sky-950/50 border-sky-400 text-white'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold text-xs text-white">حد مخصص</div>
                    <div className="text-[11px] text-slate-400 mt-1">تحديد الحد يدوياً</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        type="number"
                        min="2"
                        max="12"
                        value={customWordLimit}
                        onChange={(e) => setCustomWordLimit(parseInt(e.target.value, 10) || 5)}
                        className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-center text-xs font-bold text-sky-400"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-[10px] text-slate-400">كلمات</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Safety notice */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-400">
                <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-white">ضمان حفظ الاسم الأصلي:</strong> يتم الاحتفاظ بالاسم الأصلي كما هو في ملف Excel دائماً في قاعدة البيانات. لن يتم حذف أي معلومة، ويمكنك التبديل بين الاسم الأصلي والمختصر في أي وقت.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                <Scissors className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-cairo">
                  جاري تحليل واختصار أسماء المنتجات...
                </h3>
                <p className="text-xs text-slate-400">
                  يتم حذف الحشو والعبارات التسويقية والاحتفاظ بالماركة والنوع والمواصفات الأساسية ({targetProducts.length} منتج)
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
                  <span className="text-xs text-slate-400">المنتجات المعتمدة</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {results.filter((r) => r.accepted).length} من {results.length}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400">متوسط توفير المساحة</span>
                  <span className="text-sm font-bold font-mono text-amber-400">
                    %{avgReduction} تقليص
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400">المحرك المستخدم</span>
                  <span className="text-xs font-bold text-sky-300">{engineUsed}</span>
                </div>
              </div>

              {/* Toggle to activate in catalog */}
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300 font-cairo">
                    تطبيق الأسماء المختصرة كاسم أساسي نشط في الكتالوج والـ PDF:
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setActiveInCatalog}
                    onChange={(e) => setSetActiveInCatalog(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>عرض الاسم المختصر فوراً في جدول الكتالوج</span>
                </label>
              </div>

              {/* Review Table with inline editing */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold sticky top-0 border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">اعتماد</th>
                        <th className="p-3 w-5/12">الاسم الأصلي (Excel)</th>
                        <th className="p-3 w-5/12">الاسم المختصر المقترح (قابل للتعديل)</th>
                        <th className="p-3 w-20 text-center">نسبة الوفر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {results.map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            !item.accepted ? 'opacity-40' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.accepted}
                              onChange={() => handleToggleAccept(item.id)}
                              className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>

                          <td className="p-3">
                            <div className="text-slate-300 font-medium leading-relaxed">
                              {item.originalName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {item.originalName.length} حرف
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.shortenedName}
                                disabled={!item.accepted}
                                onChange={(e) =>
                                  handleUpdateItemShortenedName(item.id, e.target.value)
                                }
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            {item.reason && (
                              <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                                {item.reason}
                              </div>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                item.reductionPercent > 20
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              %{item.reductionPercent}
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
              onClick={handleStartShortening}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Scissors className="w-4 h-4" />
              <span>بدء اختصار الأسماء ({targetProducts.length} منتج)</span>
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
                  تطبيق وحفظ الأسماء المختصرة ({results.filter((r) => r.accepted).length} منتج)
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
