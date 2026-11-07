'use client';

import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { DuplicateBarcodeGroup } from '@/lib/excel/parser';
import { Product } from '@/types';

interface DuplicateBarcodeModalProps {
  duplicates: DuplicateBarcodeGroup[];
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onResolve: (resolvedProducts: Product[]) => void;
}

export default function DuplicateBarcodeModal({
  duplicates,
  products,
  isOpen,
  onClose,
  onResolve,
}: DuplicateBarcodeModalProps) {
  if (!isOpen || duplicates.length === 0) return null;

  // 1. Keep All: keep all duplicates as they are
  const handleKeepAll = () => {
    onResolve(products);
    onClose();
  };

  // 2. Keep First: remove duplicates keeping only the first occurrence
  const handleKeepFirst = () => {
    const indicesToRemove = new Set<number>();
    duplicates.forEach((group) => {
      // keep group.indices[0], remove rest
      for (let i = 1; i < group.indices.length; i++) {
        indicesToRemove.add(group.indices[i]);
      }
    });

    const filtered = products.filter((_, idx) => !indicesToRemove.has(idx));
    onResolve(filtered);
    onClose();
  };

  // 3. Keep Last: remove duplicates keeping only the last occurrence
  const handleKeepLast = () => {
    const indicesToRemove = new Set<number>();
    duplicates.forEach((group) => {
      // keep group.indices[last], remove earlier
      for (let i = 0; i < group.indices.length - 1; i++) {
        indicesToRemove.add(group.indices[i]);
      }
    });

    const filtered = products.filter((_, idx) => !indicesToRemove.has(idx));
    onResolve(filtered);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900 font-cairo">
              يوجد باركود مكرر في الملف
            </h3>
            <p className="text-xs text-amber-700">
              تم اكتشاف {duplicates.length} رمز باركود مكرر عبر منتجات متعددة. يرجى اختيار كيفية المعالجة:
            </p>
          </div>
        </div>

        {/* List of Duplicates */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {duplicates.map((dup, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 font-inter tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200">
                  {dup.barcode}
                </span>
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-100/70 px-2 py-0.5 rounded-full">
                  مكرر {dup.indices.length} مرات
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pr-2 border-r-2 border-amber-400">
                {dup.productNames.map((pName, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">#{dup.indices[pIdx] + 1}</span>
                    <span className="font-medium text-slate-800">{pName}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
          >
            إلغاء التعديل
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleKeepAll}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
            >
              الاحتفاظ بالجميع
            </button>
            <button
              onClick={handleKeepFirst}
              className="px-3.5 py-2 text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition-colors shadow-sm"
            >
              الاحتفاظ بالأول فقط
            </button>
            <button
              onClick={handleKeepLast}
              className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
            >
              الاحتفاظ بالأخير فقط
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
