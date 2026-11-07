'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Save,
  Check,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Palette,
  FileSpreadsheet,
} from 'lucide-react';
import { PurchaseOrderTableDesign, SavedPurchaseOrderTemplate } from '@/types';
import {
  getAllPurchaseOrderTemplates,
  savePurchaseOrderTemplate,
  deletePurchaseOrderTemplate,
} from '@/lib/purchase-order/templateStorage';

interface PurchaseOrderTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDesign: PurchaseOrderTableDesign;
  onApplyDesign: (newDesign: PurchaseOrderTableDesign) => void;
  supplierName?: string;
}

export default function PurchaseOrderTemplateModal({
  isOpen,
  onClose,
  currentDesign,
  onApplyDesign,
  supplierName = '',
}: PurchaseOrderTemplateModalProps) {
  const [templates, setTemplates] = useState<SavedPurchaseOrderTemplate[]>([]);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadTemplates = () => {
    const list = getAllPurchaseOrderTemplates(supplierName);
    setTemplates(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setIsSavingNew(false);
      setSaveSuccess(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
    }
  }, [isOpen, supplierName]);

  if (!isOpen) return null;

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    const newTemplate: SavedPurchaseOrderTemplate = {
      id: `po_tpl_${Date.now()}`,
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim() || 'قالب مخصص تم حفظه من تصميم جدول الطلبية',
      design: {
        ...currentDesign,
        // Preserve general structure but keep reusable
        columns: currentDesign.columns.map((c) => ({ ...c })),
      },
      createdAt: new Date().toISOString(),
      isDefault: false,
    };

    savePurchaseOrderTemplate(newTemplate);
    loadTemplates();
    setNewTemplateName('');
    setNewTemplateDesc('');
    setIsSavingNew(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('هل أنت متأكد من حذف هذا القالب المخصص؟')) {
      deletePurchaseOrderTemplate(id);
      loadTemplates();
    }
  };

  const handleApply = (tpl: SavedPurchaseOrderTemplate) => {
    onApplyDesign({
      ...tpl.design,
      // Maintain the current order's supplier and title while adopting columns, styling, and setup
      companyName: currentDesign.companyName || tpl.design.companyName,
      orderTitle: currentDesign.orderTitle || tpl.design.orderTitle,
    });
    setAppliedId(tpl.id);
    setTimeout(() => {
      setAppliedId(null);
      onClose();
    }, 600);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-5 max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black font-cairo text-slate-900">
                قوالب استوديو طلبية المورد
              </h2>
              <p className="text-xs text-slate-500">
                احفظ تصميم جدولك كقالب للاستخدام المستقبلي، أو طبق قالباً جاهزاً بضغطة زر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toggle to Save Current Design */}
        <div className="shrink-0">
          {!isSavingNew ? (
            <div className="flex items-center justify-between bg-amber-50/60 border border-amber-200/80 p-3.5 rounded-2xl">
              <div>
                <div className="font-bold text-xs text-amber-900">
                  هل يعجبك تصميم الجدول الحالي؟
                </div>
                <div className="text-[11px] text-amber-700">
                  يمكنك حفظ الألوان، ترتيب الأعمدة، وتنسيق الصفحة كقالب لاستعماله في طلبيات أخرى
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSavingNew(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>حفظ كقالب جديد</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveCurrent} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">حفظ التصميم الحالي كقالب جديد:</span>
                <button
                  type="button"
                  onClick={() => setIsSavingNew(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  إلغاء
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="اسم القالب (مثال: قالب طلبيات ماكس سيدو المفضل)..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                />

                <input
                  type="text"
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="وصف مختصر للقالب (اختياري)..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSavingNew(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>تأكيد الحفظ</span>
                </button>
              </div>
            </form>
          )}

          {saveSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 mt-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>تم حفظ القالب بنجاح وإضافته لقائمتك!</span>
            </div>
          )}
        </div>

        {/* Templates List */}
        <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
          <div className="text-[11px] font-bold text-slate-500 mb-1">
            القوالب المتوفرة ({templates.length}):
          </div>

          {templates.map((tpl) => {
            const isApplied = appliedId === tpl.id;
            const isCustom = !tpl.isDefault;

            return (
              <div
                key={tpl.id}
                onClick={() => handleApply(tpl)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isApplied
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/30'
                    : 'border-slate-200 bg-white hover:border-amber-500 hover:shadow-xs'
                }`}
              >
                {/* Left Preview Badge */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-white"
                    style={{
                      backgroundColor: tpl.design.headerBackground,
                      color: tpl.design.headerTextColor,
                    }}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 font-cairo truncate">
                        {tpl.name}
                      </span>
                      {isCustom ? (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          قالبك المخصص
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          قالب جاهز
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {tpl.description || 'قالب لتنسيق طلبية المورد'}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                      <span>قياس الصفحة: {tpl.design.pageSize === 'single_long_page' ? 'صفحة ممتدة مستمرة' : tpl.design.pageSize}</span>
                      <span>•</span>
                      <span>الأعمدة الظاهرة: {tpl.design.columns.filter((c) => c.visible).length} أعمدة</span>
                    </div>
                  </div>
                </div>

                {/* Right Action */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(tpl.id, e)}
                      title="حذف القالب المخصص"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleApply(tpl)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    {isApplied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تم التطبيق!</span>
                      </>
                    ) : (
                      <span>تطبيق</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
