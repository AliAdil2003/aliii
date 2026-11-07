'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  X,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Maximize2,
  Layers,
  Ruler,
} from 'lucide-react';
import { CatalogTemplate, Product, PDFExportOptions } from '@/types';
import { AppService } from '@/lib/appwrite/service';
import {
  calculateItemsPerPage,
  getPageDimensions,
  calculateCatalogDimensions,
  CatalogDimensionInfo,
} from '@/lib/pdf/pageLayout';

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  template: CatalogTemplate;
  projectName: string;
  projectId: string;
  initialPageIndex?: number;
  initialExportMode?: 'exact_studio_preview' | 'continuous_flow' | 'single_long_page';
}

const EXPORT_STEPS = [
  'تحضير بيانات المنتجات والأسعار وتطبيق القياسات...',
  'معالجة صور المنتجات واستخراج صيغ Base64 عالية النقاء...',
  'تطبيق أبعاد الاستوديو وحساب قياس الصفحة والترويسة...',
  'توليد الملف بالقياس المطلوب بجودة طباعة فائقة (300 DPI)...',
  'اكتمل التصدير بنجاح!',
];

export default function PDFExportModal({
  isOpen,
  onClose,
  products,
  template,
  projectName,
  projectId,
  initialPageIndex,
  initialExportMode,
}: PDFExportModalProps) {
  const activeProducts = useMemo(
    () => products.filter((p) => p.includedInCatalog),
    [products]
  );

  const itemsPerPage = useMemo(
    () => calculateItemsPerPage(template),
    [template]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(activeProducts.length / itemsPerPage)),
    [activeProducts.length, itemsPerPage]
  );

  const pageDims = useMemo(
    () => getPageDimensions(template.page),
    [template.page]
  );

  const [options, setOptions] = useState<PDFExportOptions>({
    filename: `${projectName || 'كتالوج_المنتجات'}_${new Date().toISOString().slice(0, 10)}`,
    pageSize: template.page.size,
    orientation: template.page.orientation,
    quality: 'print_300dpi',
    imageQuality: 95,
    includeHeader: template.header.enabled,
    includeFooter: template.footer.enabled,
    pageNumbers: true,
    bleed: template.page.bleed || 3,
    cropMarks: template.page.cropMarks || false,
    safeMargins: true,
    exportMode: initialExportMode || 'exact_studio_preview',
    exportFormat: 'pdf',
    pageIndex: initialPageIndex,
  });

  const dimensions = useMemo(
    () => calculateCatalogDimensions(template, products, options.exportMode),
    [template, products, options.exportMode]
  );

  const [confirmedDimensions, setConfirmedDimensions] = useState<{
    text: string;
    widthCm: string;
    heightCm: string;
    widthMm: string;
    heightMm: string;
  } | null>(null);

  React.useEffect(() => {
    if (initialExportMode) {
      setOptions((prev) => ({ ...prev, exportMode: initialExportMode }));
    }
  }, [initialExportMode, isOpen]);

  const [pageScope, setPageScope] = useState<'all' | 'specific'>(
    initialPageIndex ? 'specific' : 'all'
  );
  const [selectedPageNum, setSelectedPageNum] = useState<number>(
    initialPageIndex || 1
  );

  const [generating, setGenerating] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [downloadReadyUrl, setDownloadReadyUrl] = useState<string | null>(null);
  const [downloadReadyFilename, setDownloadReadyFilename] = useState<string>('');
  const [fallbackHtmlData, setFallbackHtmlData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setGenerating(true);
    setError(null);
    setFallbackHtmlData(null);
    setCurrentStepIdx(0);

    // Step 1: Preparing products
    await new Promise((r) => setTimeout(r, 350));
    setCurrentStepIdx(1);

    // Step 2: Processing images
    await new Promise((r) => setTimeout(r, 400));
    setCurrentStepIdx(2);

    // Step 3: Creating pages
    await new Promise((r) => setTimeout(r, 350));
    setCurrentStepIdx(3);

    const exportOptions: PDFExportOptions = {
      ...options,
      pageIndex: options.exportMode === 'single_long_page' ? undefined : pageScope === 'specific' ? selectedPageNum : undefined,
    };

    try {
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: activeProducts,
          template,
          options: exportOptions,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        if (errJson.fallbackHtml) {
          setFallbackHtmlData(errJson.fallbackHtml);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(errJson.fallbackHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 500);
          }
          setCurrentStepIdx(4);
          return;
        }
        throw new Error(errJson.error || errJson.message || 'فشل توليد الملف من الخادم');
      }

      const contentType = response.headers.get('content-type') || '';
      const isLongPage = options.exportMode === 'single_long_page';

      const rawMeasuredText = response.headers.get('x-catalog-dimensions-text');
      let measuredText: string | null = null;
      if (rawMeasuredText) {
        try {
          measuredText = decodeURIComponent(rawMeasuredText);
        } catch (_) {
          measuredText = rawMeasuredText;
        }
      }
      const measuredWidthCm = response.headers.get('x-catalog-width-cm');
      const measuredHeightCm = response.headers.get('x-catalog-height-cm');
      const measuredWidthMm = response.headers.get('x-catalog-width-mm');
      const measuredHeightMm = response.headers.get('x-catalog-height-mm');

      if (measuredText) {
        setConfirmedDimensions({
          text: measuredText,
          widthCm: measuredWidthCm || dimensions.widthCm,
          heightCm: measuredHeightCm || dimensions.heightCm,
          widthMm: measuredWidthMm || String(dimensions.widthMm),
          heightMm: measuredHeightMm || String(dimensions.heightMm),
        });
      }

      if (contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const sizeTag = isLongPage ? `_صفحة_طويلة_${dimensions.widthCm}x${dimensions.heightCm}سم` : pageScope === 'specific' ? `_صفحة_${selectedPageNum}` : '';
        const fileName = `${options.filename}${sizeTag}.pdf`;
        setDownloadReadyUrl(url);
        setDownloadReadyFilename(fileName);

        // Auto trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Record in export history
        await AppService.addExport({
          id: 'exp_' + Date.now(),
          projectId,
          filename: fileName,
          date: new Date().toISOString(),
          productCount: isLongPage ? activeProducts.length : pageScope === 'specific' ? Math.min(itemsPerPage, activeProducts.length) : activeProducts.length,
          templateName: template.name,
          fileSize: blob.size,
          downloadUrl: url,
        });

        setCurrentStepIdx(4);
      } else if (contentType.includes('image/png')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const fileName = `${options.filename}${isLongPage ? '_صفحة_طويلة' : pageScope === 'specific' ? `_صفحة_${selectedPageNum}` : ''}.png`;
        setDownloadReadyUrl(url);
        setDownloadReadyFilename(fileName);

        // Auto trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Record in export history
        await AppService.addExport({
          id: 'exp_' + Date.now(),
          projectId,
          filename: fileName,
          date: new Date().toISOString(),
          productCount: isLongPage ? activeProducts.length : Math.min(itemsPerPage, activeProducts.length),
          templateName: template.name,
          fileSize: blob.size,
          downloadUrl: url,
        });

        setCurrentStepIdx(4);
      } else {
        // Fallback HTML for direct print window
        const data = await response.json();
        if (data.fallbackHtml) {
          setFallbackHtmlData(data.fallbackHtml);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(data.fallbackHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 500);
          }
          setCurrentStepIdx(4);
        } else {
          throw new Error(data.error || 'حدث خطأ أثناء تصدير الملف');
        }
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء توليد الكتالوج');
    } finally {
      setGenerating(false);
    }
  };

  const handleDirectBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-cairo text-white">
                تصدير الكتالوج بالقياس الحقيقي (Real-Size Studio Export)
              </h2>
              <p className="text-xs text-slate-400">
                مطابق تماماً لمعاينة الاستوديو 1:1 بالأبعاد الحقيقية والصفحات الدقيقة
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

        {/* Feature Highlights & Live Dimensions Banner */}
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-sky-500/10 border-b border-amber-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm flex-shrink-0">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600">
                  {options.exportMode === 'single_long_page'
                    ? 'القياس الحقيقي للصفحة الطويلة:'
                    : 'القياس الحقيقي للصفحات:'}
                </span>
                <span className="text-xs font-black text-amber-950 font-cairo bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300">
                  {confirmedDimensions?.text || dimensions.dimensionsText}
                </span>
                {options.exportMode === 'single_long_page' && (
                  <span className="text-[10px] text-slate-500 font-bold bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                    {dimensions.dimensionsMmText} • {dimensions.heightM} متر
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {options.exportMode === 'single_long_page'
                  ? `العرض: ${dimensions.widthCm} سم | الارتفاع: ${dimensions.heightCm} سم • يشمل ${dimensions.productCount} منتج في صفحة واحدة`
                  : `العرض: ${dimensions.widthCm} سم | الارتفاع: ${dimensions.heightCm} سم • إجمالي ${dimensions.pageCount} صفحة (${template.page.size})`}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setOptions((prev) => ({ ...prev, exportFormat: 'pdf' }));
              setTimeout(() => handleStartExport(), 50);
            }}
            disabled={generating}
            type="button"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 disabled:opacity-50"
            title="حفظ مباشر وفوري لملف PDF بهذا القياس الموضح"
          >
            {generating && options.exportFormat === 'pdf' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>حفظ PDF بهذا القياس فوراً</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* 1. Export Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              نمط التصدير (Export Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setOptions({ ...options, exportMode: 'single_long_page' })}
                className={`p-3 rounded-xl text-right border transition-all flex flex-col justify-between sm:col-span-2 ${
                  options.exportMode === 'single_long_page'
                    ? 'border-amber-500 bg-amber-50/90 ring-2 ring-amber-500/30 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 font-cairo">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                    صفحة واحدة طويلة ممتدة (Single Long Page)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black font-cairo">
                      📐 القياس: {dimensions.dimensionsText}
                    </span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
                      ⭐ للموبايل والواتساب
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  ملف واحد متصل بقياس طويل يحتوي على جميع المنتجات في صفحة واحدة بدون أي فواصل صفحات (مثالي للعرض على الهاتف، الواتساب، والطباعة المتصلة)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setOptions({ ...options, exportMode: 'exact_studio_preview' })}
                className={`p-3 rounded-xl text-right border transition-all flex flex-col justify-between ${
                  options.exportMode === 'exact_studio_preview'
                    ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 font-cairo">
                    <Layers className="w-3.5 h-3.5 text-sky-600" />
                    صفحات مقسمة (A4 / متعدد الصفحات)
                  </span>
                  <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">
                    للطباعة والتجليد
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تصدير صفحات منفصلة مطابقة لشاشة المعاينة تماماً بنفس الأبعاد والهيدر وأرقام الصفحات
                </p>
              </button>

              <button
                type="button"
                onClick={() => setOptions({ ...options, exportMode: 'continuous_flow' })}
                className={`p-3 rounded-xl text-right border transition-all flex flex-col justify-between ${
                  options.exportMode === 'continuous_flow'
                    ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 font-cairo">
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    تدفق مستمر متعدد الصفحات (Flow)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  جدول متصل واحد يتوزع تلقائياً على عدة صفحات وفق ارتفاع المحتوى
                </p>
              </button>
            </div>
          </div>

          {/* 2. Export Format (PDF vs High-Res PNG Image) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              صيغة التصدير (Format)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  options.exportFormat === 'pdf'
                    ? 'border-sky-500 bg-sky-50/70 text-sky-950 font-bold'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  checked={options.exportFormat === 'pdf'}
                  onChange={() => setOptions({ ...options, exportFormat: 'pdf' })}
                  className="accent-sky-600"
                />
                <FileText className="w-4 h-4 text-sky-600" />
                <span>ملف PDF للطباعة (Vector PDF)</span>
              </label>

              <label
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  options.exportFormat === 'png_image'
                    ? 'border-sky-500 bg-sky-50/70 text-sky-950 font-bold'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  checked={options.exportFormat === 'png_image'}
                  onChange={() => setOptions({ ...options, exportFormat: 'png_image' })}
                  className="accent-sky-600"
                />
                <ImageIcon className="w-4 h-4 text-purple-600" />
                <span>صورة عالية الدقة (High-Res PNG)</span>
              </label>
            </div>
          </div>

          {/* 3. Page Scope (All vs Specific Page or Single Long Page Notice) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              نطاق الصفحات المراد تصديرها
            </label>
            {options.exportMode === 'single_long_page' ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-xs block">
                      تصدير صفحة واحدة طويلة ممتدة
                    </span>
                    <span className="text-[11px] text-amber-800 block">
                      سيتم تضمين جميع المنتجات ({activeProducts.length} منتج) في صفحة واحدة ممتدة بدون أي فواصل صفحات.
                    </span>
                  </div>
                </div>
                <span className="text-[10px] bg-amber-200/90 text-amber-900 font-black px-2.5 py-1 rounded-lg">
                  صفحة واحدة فقط
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <label
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer ${
                    pageScope === 'all'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-950 font-bold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="pageScope"
                    checked={pageScope === 'all'}
                    onChange={() => setPageScope('all')}
                    className="accent-sky-600"
                  />
                  <span>جميع الصفحات ({totalPages} صفحة)</span>
                </label>

                <div
                  className={`flex items-center justify-between p-2 rounded-xl border ${
                    pageScope === 'specific'
                      ? 'border-sky-500 bg-sky-50/70'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="pageScope"
                      checked={pageScope === 'specific'}
                      onChange={() => setPageScope('specific')}
                      className="accent-sky-600"
                    />
                    <span>صفحة محددة:</span>
                  </label>
                  <select
                    disabled={pageScope !== 'specific'}
                    value={selectedPageNum}
                    onChange={(e) => setSelectedPageNum(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold font-inter text-slate-900 disabled:opacity-40"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        صفحة {num} من {totalPages}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 4. Export Filename */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم الملف (Filename)
            </label>
            <input
              type="text"
              value={options.filename}
              onChange={(e) => setOptions({ ...options, filename: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold font-inter"
            />
          </div>

          {/* 5. Quality & Image Quality */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">جودة التوليد</label>
              <select
                value={options.quality}
                onChange={(e) => setOptions({ ...options, quality: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="print_300dpi">دقة فائقة 300 DPI (أعلى وضوح ونقاء)</option>
                <option value="high">جودة عالية (High Quality)</option>
                <option value="standard">قياسي (حجم ملف أخف)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                جودة الصور ({options.imageQuality}%)
              </label>
              <input
                type="range"
                min={70}
                max={100}
                value={options.imageQuality}
                onChange={(e) =>
                  setOptions({ ...options, imageQuality: Number(e.target.value) })
                }
                className="w-full accent-sky-500 mt-2"
              />
            </div>
          </div>

          {/* 6. Header, Footer, Crop Marks Toggles */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                checked={options.includeHeader}
                onChange={(e) => setOptions({ ...options, includeHeader: e.target.checked })}
                className="rounded text-sky-600"
              />
              <span className="font-bold text-[11px]">ترويسة الصفحة (Header)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                checked={options.includeFooter}
                onChange={(e) => setOptions({ ...options, includeFooter: e.target.checked })}
                className="rounded text-sky-600"
              />
              <span className="font-bold text-[11px]">تذييل الصفحة (Footer)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                checked={options.pageNumbers}
                onChange={(e) => setOptions({ ...options, pageNumbers: e.target.checked })}
                className="rounded text-sky-600"
              />
              <span className="font-bold text-[11px]">أرقام الصفحات</span>
            </label>
          </div>

          {/* Progress Indicators */}
          {generating && (
            <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/60 space-y-3">
              <div className="flex items-center gap-2 text-sky-900 font-bold">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                <span>جاري معالجة الكتالوج بالقياس الحقيقي...</span>
              </div>

              <div className="space-y-1.5 pr-2">
                {EXPORT_STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      idx < currentStepIdx
                        ? 'text-emerald-600 font-bold'
                        : idx === currentStepIdx
                        ? 'text-sky-800 font-extrabold animate-pulse'
                        : 'text-slate-400'
                    }`}
                  >
                    <span>{idx < currentStepIdx ? '✓' : idx === currentStepIdx ? '●' : '○'}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStepIdx === 4 && (
            <div className="space-y-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="block font-black text-xs">
                      {options.exportMode === 'single_long_page'
                        ? 'تم تجهيز وحفظ ملف الصفحة الطويلة المتصلة بنجاح!'
                        : 'تم تجهيز وحفظ الملف بالقياس الحقيقي بنجاح!'}
                    </span>
                    <span className="block text-[11px] text-emerald-700 font-normal mt-0.5">
                      القياس النهائي المعتمد للملف:{' '}
                      <strong className="text-emerald-950 font-black">
                        {confirmedDimensions?.text || dimensions.dimensionsText}
                      </strong>{' '}
                      ({confirmedDimensions ? `${confirmedDimensions.widthMm} × ${confirmedDimensions.heightMm} مم` : dimensions.dimensionsMmText})
                    </span>
                  </div>
                </div>
                {downloadReadyUrl && (
                  <a
                    href={downloadReadyUrl}
                    download={downloadReadyFilename}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تحميل الملف
                  </a>
                )}
              </div>

              {fallbackHtmlData && (
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center justify-between">
                  <span className="text-[11px]">
                    يمكنك أيضاً حفظ الكتالوج أو طباعته فوراً عبر نافذة الطباعة المباشرة:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(fallbackHtmlData);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => printWindow.print(), 500);
                      }
                    }}
                    className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    حفظ / طباعة مباشرة
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDirectBrowserPrint}
              type="button"
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              طباعة مباشرة عبر المتصفح
            </button>

            <button
              onClick={handleStartExport}
              disabled={generating}
              type="button"
              className={`px-6 py-2.5 rounded-xl font-black text-xs transition-colors shadow-md flex items-center gap-2 disabled:opacity-50 ${
                options.exportMode === 'single_long_page'
                  ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-amber-500/20'
                  : 'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 shadow-sky-500/20'
              }`}
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري التوليد...
                </>
              ) : options.exportMode === 'single_long_page' ? (
                options.exportFormat === 'png_image' ? (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    تصدير صورة صفحة طويلة (PNG)
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    تصدير صفحة واحدة طويلة (PDF)
                  </>
                )
              ) : options.exportFormat === 'png_image' ? (
                <>
                  <ImageIcon className="w-4 h-4" />
                  تصدير صورة عالية الدقة (PNG)
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  توليد وتحميل بالقياس الحقيقي (PDF)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
