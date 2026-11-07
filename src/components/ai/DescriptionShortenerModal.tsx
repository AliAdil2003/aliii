'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  X,
  RefreshCw,
  Sliders,
  AlertCircle,
  FileText,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import { Product } from '@/types';

interface DescriptionShortenerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProductIds: string[];
  onApplyShortenedDescriptions: (updatedProducts: Product[]) => void;
}

export default function DescriptionShortenerModal({
  isOpen,
  onClose,
  products,
  selectedProductIds,
  onApplyShortenedDescriptions,
}: DescriptionShortenerModalProps) {
  const [mode, setMode] = useState<'very_short' | 'short' | 'medium' | 'custom'>('short');
  const [customWordLimit, setCustomWordLimit] = useState(20);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [applied, setApplied] = useState(false);

  if (!isOpen) return null;

  // Determine target products to shorten
  const targetProducts =
    selectedProductIds.length > 0
      ? products.filter((p) => selectedProductIds.includes(p.id))
      : products;

  const getWordLimit = () => {
    if (mode === 'very_short') return 12;
    if (mode === 'short') return 20;
    if (mode === 'medium') return 35;
    return customWordLimit || 20;
  };

  // Run shortening
  const handleStartShortening = async () => {
    setProcessing(true);
    setProgress({ current: 0, total: targetProducts.length });

    const limit = getWordLimit();
    const updatedMap = new Map<string, Product>();

    // Copy initial products
    products.forEach((p) => updatedMap.set(p.id, { ...p }));

    for (let i = 0; i < targetProducts.length; i++) {
      const prod = targetProducts[i];
      setProgress({ current: i + 1, total: targetProducts.length });

      const textToShorten = prod.shopifyDescription || prod.originalDescription;

      if (textToShorten && textToShorten.trim()) {
        try {
          const res = await fetch('/api/ai/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalDescription: textToShorten,
              mode,
              wordLimit: limit,
              productName: prod.name,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const existing = updatedMap.get(prod.id)!;
            existing.shortenedDescription = data.shortenedDescription;
            existing.activeDescriptionType = 'shortened';
          }
        } catch (err) {
          console.error('Error shortening product', prod.name, err);
        }
      }
    }

    const allUpdated = Array.from(updatedMap.values());
    setPreviewProducts(allUpdated);
    setProcessing(false);
    setApplied(true);
  };

  const handleSaveAndClose = () => {
    if (previewProducts.length > 0) {
      onApplyShortenedDescriptions(previewProducts);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-cairo text-white">
                مساعد اختصار الأوصاف بالذكاء الاصطناعي
              </h2>
              <p className="text-xs text-slate-400">
                تلخيص الأوصاف الأصلية حصراً دون اختراع أي مواصفات أو تفاصيل جديدة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Strict Fact Preservation Notice (Requirement 9 & 10) */}
        <div className="bg-amber-50/80 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>ضمان الدقة:</strong> يعتمد التلخيص على النص الأصلي في ملف Excel فقط مع حفظ
              أرقام الموديلات والمواصفات والأبعاد دون أي تزييف.
            </span>
          </div>
          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            الأصل محفوظ دائماً
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Target Selection & Mode Configuration */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                المنتجات المستهدفة: {targetProducts.length} منتج
                {selectedProductIds.length > 0 ? ' (المحددة فقط)' : ' (جميع منتجات الكتالوج)'}
              </span>
              <span className="text-[11px] text-slate-500">
                الحد الأقصى الحالي: {getWordLimit()} كلمة
              </span>
            </div>

            {/* Shortening Modes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('very_short')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  mode === 'very_short'
                    ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-semibold'
                }`}
              >
                <div className="text-xs">شديد الإيجاز</div>
                <div className="text-[10px] opacity-80 mt-0.5">~12 كلمة</div>
              </button>

              <button
                type="button"
                onClick={() => setMode('short')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  mode === 'short'
                    ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-semibold'
                }`}
              >
                <div className="text-xs">موجز (موصى به)</div>
                <div className="text-[10px] opacity-80 mt-0.5">~20 كلمة</div>
              </button>

              <button
                type="button"
                onClick={() => setMode('medium')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  mode === 'medium'
                    ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-semibold'
                }`}
              >
                <div className="text-xs">متوسط التفصيل</div>
                <div className="text-[10px] opacity-80 mt-0.5">~35 كلمة</div>
              </button>

              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  mode === 'custom'
                    ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-semibold'
                }`}
              >
                <div className="text-xs">حد مخصص</div>
                <div className="text-[10px] opacity-80 mt-0.5">حدد عدد الكلمات</div>
              </button>
            </div>

            {mode === 'custom' && (
              <div className="flex items-center gap-3 pt-2">
                <label className="text-xs font-bold text-slate-700">
                  الحد الأقصى للكلمات (Maximum words):
                </label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={customWordLimit}
                  onChange={(e) => setCustomWordLimit(parseInt(e.target.value, 10) || 20)}
                  className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-center font-bold"
                />
              </div>
            )}
          </div>

          {/* Action Button & Progress */}
          {!applied && !processing && (
            <div className="text-center py-2">
              <button
                onClick={handleStartShortening}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 mx-auto"
              >
                <Sparkles className="w-4 h-4" />
                بدء التلخيص الآن ({targetProducts.length} منتج)
              </button>
            </div>
          )}

          {/* Progress Bar */}
          {processing && (
            <div className="space-y-2 text-center py-4">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                <span>
                  جاري تلخيص المنتجات ({progress.current} من {progress.total})...
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.round((progress.current / (progress.total || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Results Preview */}
          {applied && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  تم تلخيص الأوصاف بنجاح! راجع النتيجة قبل التطبيق النهائي:
                </span>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {previewProducts
                  .filter((p) => selectedProductIds.length === 0 || selectedProductIds.includes(p.id))
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs"
                    >
                      <div className="font-bold text-slate-900">{p.name}</div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-slate-500 block text-[10px] font-bold mb-1 flex items-center justify-between">
                            <span>{p.shopifyDescription ? 'وصف متجر Shopify:' : 'الوصف الأصلي:'}</span>
                            {p.shopifyDescription && (
                              <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded font-bold">Shopify</span>
                            )}
                          </span>
                          <p className="text-slate-600 line-clamp-3">
                            {p.shopifyDescription || p.originalDescription || '(فارغ)'}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200">
                          <span className="text-amber-700 block text-[10px] font-bold mb-1 flex items-center justify-between">
                            <span>الوصف المختصر بالذكاء:</span>
                            <span className="text-[9px]">
                              {p.shortenedDescription.split(/\s+/).filter(Boolean).length} كلمة
                            </span>
                          </span>
                          <textarea
                            rows={2}
                            value={p.shortenedDescription}
                            onChange={(e) => {
                              const newText = e.target.value;
                              setPreviewProducts((prev) =>
                                prev.map((item) =>
                                  item.id === p.id
                                    ? { ...item, shortenedDescription: newText }
                                    : item
                                )
                              );
                            }}
                            className="w-full bg-transparent border-0 text-slate-800 text-[11px] focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            إلغاء
          </button>

          {applied && (
            <button
              onClick={handleSaveAndClose}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              تطبيق الأوصاف على الكتالوج
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
