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
} from 'lucide-react';
import { CatalogTemplate } from '@/types';
import { AppService } from '@/lib/appwrite/service';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: CatalogTemplate;
  onApplyTemplate: (template: CatalogTemplate) => void;
}

export default function TemplateManagerModal({
  isOpen,
  onClose,
  currentTemplate,
  onApplyTemplate,
}: TemplateManagerModalProps) {
  const [templates, setTemplates] = useState<CatalogTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadTemplates = async () => {
    const list = await AppService.getTemplates();
    setTemplates(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setIsSavingNew(false);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCurrentAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    const newTpl: CatalogTemplate = {
      ...currentTemplate,
      id: 'tpl_' + Date.now(),
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim() || 'قالب مخصص تم حفظه من التصميم الحالي',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await AppService.saveTemplate(newTpl);
    await loadTemplates();
    setNewTemplateName('');
    setNewTemplateDesc('');
    setIsSavingNew(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('هل أنت متأكد من حذف هذا القالب؟')) {
      await AppService.deleteTemplate(id);
      await loadTemplates();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-cairo text-white">قوالب التصميم المحفوظة</h2>
              <p className="text-xs text-slate-400">
                حفظ التصميم الحالي كقالب جاهز أو تطبيق قالب سابق بضغطة زر
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

        {savedSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>تم حفظ القالب بنجاح! يمكنك استخدامه مع أي ملف جديد.</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Save Current Design Button */}
          {!isSavingNew ? (
            <button
              onClick={() => setIsSavingNew(true)}
              className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-sky-400 hover:border-sky-500 bg-sky-50 hover:bg-sky-100/60 text-sky-800 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4 text-sky-600" />
              حفظ التصميم الحالي كقالب جديد (Save Current as Template)
            </button>
          ) : (
            <form
              onSubmit={handleSaveCurrentAsTemplate}
              className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 space-y-3"
            >
              <h4 className="text-xs font-bold text-sky-900">حفظ التصميم الحالي كقالب مخصص:</h4>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم القالب</label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="مثال: كتالوج موكسيدو المعتمد (MOXEDO Catalog)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  وصف مختصر للقالب
                </label>
                <input
                  type="text"
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="مثال: جدول A4 بخط Cairo وأسعار بالدينار العراقي"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSavingNew(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ القالب
                </button>
              </div>
            </form>
          )}

          {/* Existing Templates List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800">القوالب المتاحة للاستخدام:</h4>
            <div className="grid grid-cols-1 gap-2.5">
              {templates.map((tpl) => {
                const isCurrent = tpl.id === currentTemplate.id;

                return (
                  <div
                    key={tpl.id}
                    onClick={() => {
                      onApplyTemplate(tpl);
                      onClose();
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isCurrent
                        ? 'border-sky-500 bg-sky-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 group-hover:text-sky-600 transition-colors">
                          {tpl.name}
                        </span>
                        {tpl.isDefault && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            نظام
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-500 text-white">
                            مطبق حالياً
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{tpl.description}</p>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          onApplyTemplate(tpl);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                      >
                        تطبيق
                      </button>

                      {!tpl.isDefault && (
                        <button
                          onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                          title="حذف القالب"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
