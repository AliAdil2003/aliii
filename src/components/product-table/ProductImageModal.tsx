'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  X,
  Check,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { Product } from '@/types';

interface ProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSaveImage: (productId: string, newImageData: string) => void;
}

export default function ProductImageModal({
  isOpen,
  onClose,
  product,
  onSaveImage,
}: ProductImageModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      const current = product.imageData || '';
      setImagePreview(current);
      setUrlInput(current.startsWith('http') ? current : '');
      setValidationStatus(current ? 'valid' : 'idle');
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const validateAndSetImage = (dataUrlOrUri: string) => {
    if (!dataUrlOrUri || !dataUrlOrUri.trim()) {
      setImagePreview('');
      setValidationStatus('idle');
      return;
    }

    setIsValidating(true);
    const img = new Image();
    img.onload = () => {
      setImagePreview(dataUrlOrUri);
      setValidationStatus('valid');
      setIsValidating(false);
    };
    img.onerror = () => {
      setImagePreview(dataUrlOrUri);
      setValidationStatus('invalid');
      setIsValidating(false);
    };
    img.src = dataUrlOrUri;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPG, JPEG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        validateAndSetImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      validateAndSetImage(urlInput.trim());
    }
  };

  const handleRemoveImage = () => {
    setImagePreview('');
    setUrlInput('');
    setValidationStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = () => {
    onSaveImage(product.id, imagePreview);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden text-right flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-cairo text-white">
                تعديل وتعيين صورة المنتج
              </h2>
              <p className="text-xs text-slate-400 line-clamp-1 max-w-[280px]">
                {product.name}
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
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Live Preview Canvas */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-48 h-48 rounded-2xl border-2 border-slate-700 bg-white p-2 shadow-inner flex items-center justify-center overflow-hidden group">
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 transition-colors"
                      title="تغيير الصورة"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-2 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-400 transition-colors"
                      title="حذف الصورة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-1.5 p-4 text-center">
                  <ImageIcon className="w-10 h-10 text-slate-300 stroke-1" />
                  <span className="text-xs font-semibold">لا توجد صورة محددة</span>
                  <span className="text-[10px] text-slate-400">
                    اختر صورة من جهازك أو الصق رابطاً
                  </span>
                </div>
              )}
            </div>

            {/* Status indicator */}
            {isValidating && (
              <div className="mt-2 text-xs text-sky-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري فحص الصورة...</span>
              </div>
            )}
            {!isValidating && validationStatus === 'valid' && (
              <div className="mt-2 text-[11px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>صورة صالحة وجاهزة للكتالوج والـ PDF</span>
              </div>
            )}
            {!isValidating && validationStatus === 'invalid' && (
              <div className="mt-2 text-[11px] text-rose-400 font-bold flex items-center gap-1 bg-rose-950/50 px-2.5 py-0.5 rounded-full border border-rose-800/60">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>تعذر تحميل الصورة، يرجى التأكد من الصيغة أو الرابط</span>
              </div>
            )}
          </div>

          {/* Mode Switcher: Upload vs URL */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>رفع من الجهاز</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'url'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>رابط صورة أو Base64</span>
            </button>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-2xl cursor-pointer text-center transition-all flex flex-col items-center justify-center space-y-2 ${
                  isDragging
                    ? 'border-sky-500 bg-sky-950/20'
                    : 'border-slate-700 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-800/40'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-sky-400 flex items-center justify-center shadow-sm">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-white">
                  اضغط لاختيار صورة من جهازك
                </div>
                <p className="text-[11px] text-slate-400">
                  أو اسحب وأفلت ملف الصورة هنا (يدعم PNG, JPG, JPEG, WEBP)
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: URL Input */}
          {activeTab === 'url' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                أدخل رابط الصورة (URL) أو كود Base64:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.png أو data:image/..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-inter"
                />
                <button
                  type="button"
                  onClick={handleUrlApply}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  معاينة
                </button>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              يتم حفظ الصورة المعدلة بتنسيق مشفر فائق السرعة وتظهر تلقائياً في جداول الكتالوج وبطاقات المعاينة الحية وملفات الـ PDF دون المساس بملف Excel الأصلي.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              إلغاء
            </button>
            {imagePreview && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 text-xs font-bold transition-colors flex items-center gap-1"
                title="إزالة الصورة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>إزالة الصورة</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
          >
            <Check className="w-4 h-4" />
            <span>حفظ واعتماد الصورة</span>
          </button>
        </div>
      </div>
    </div>
  );
}
