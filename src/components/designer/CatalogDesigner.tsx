'use client';

import React, { useState, useMemo } from 'react';
import {
  Save,
  Download,
  Layers,
  Sparkles,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  Maximize2,
  Ruler,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react';
import { CatalogTemplate, Product, Project } from '@/types';
import { calculateCatalogDimensions } from '@/lib/pdf/pageLayout';
import { AppService } from '@/lib/appwrite/service';
import ElementsSidebar from './ElementsSidebar';
import LivePagePreview from './LivePagePreview';
import PropertiesPanel from './PropertiesPanel';
import TemplateManagerModal from '../templates/TemplateManagerModal';
import PDFExportModal from '../pdf/PDFExportModal';
import ProductSequenceModal from './ProductSequenceModal';

interface CatalogDesignerProps {
  project: Project;
  products: Product[];
  template: CatalogTemplate;
  onChangeTemplate: (updated: CatalogTemplate) => void;
  onSaveProject: () => void;
  onBackToTable: () => void;
  onOpenShortener: () => void;
  onUpdateProducts?: (updated: Product[]) => void;
}

export default function CatalogDesigner({
  project,
  products,
  template,
  onChangeTemplate,
  onSaveProject,
  onBackToTable,
  onOpenShortener,
  onUpdateProducts,
}: CatalogDesignerProps) {
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isPDFExportModalOpen, setIsPDFExportModalOpen] = useState(false);
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
  const [exportModalInitialPage, setExportModalInitialPage] = useState<number | undefined>(undefined);
  const [exportModalMode, setExportModalMode] = useState<'exact_studio_preview' | 'continuous_flow' | 'single_long_page'>('exact_studio_preview');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const longPageDimensions = useMemo(
    () => calculateCatalogDimensions(template, products, 'single_long_page'),
    [template, products]
  );
  const [isDirectSaving, setIsDirectSaving] = useState(false);
  const [directSaveToast, setDirectSaveToast] = useState<string | null>(null);

  const handleSave = () => {
    onSaveProject();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleDirectSaveLongPagePdf = async () => {
    try {
      setIsDirectSaving(true);
      setDirectSaveToast(null);
      const activeProducts = products.filter((p) => p.includedInCatalog);
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: activeProducts,
          template,
          options: {
            filename: `${project.name || 'كتالوج'}_صفحة_طويلة_${longPageDimensions.widthCm}x${longPageDimensions.heightCm}سم`,
            pageSize: template.page.size,
            orientation: template.page.orientation,
            quality: 'print_300dpi',
            imageQuality: 95,
            includeHeader: template.header.enabled,
            includeFooter: template.footer.enabled,
            pageNumbers: true,
            bleed: 3,
            cropMarks: false,
            safeMargins: true,
            exportMode: 'single_long_page',
            exportFormat: 'pdf',
          },
        }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok || !contentType.includes('application/pdf')) {
        let errorMsg = 'فشل توليد ملف PDF من الخادم';
        try {
          const errData = await response.json();
          if (errData.error) errorMsg += `: ${errData.error}`;
          if (errData.fallbackHtml) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(errData.fallbackHtml);
              printWindow.document.close();
              printWindow.focus();
              setTimeout(() => printWindow.print(), 500);
              setDirectSaveToast('تم فتح الكتالوج للطباعة / الحفظ المباشر كـ PDF');
              return;
            }
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const rawDimText = response.headers.get('x-catalog-dimensions-text');
      let measuredText = longPageDimensions.dimensionsText;
      if (rawDimText) {
        try {
          measuredText = decodeURIComponent(rawDimText);
        } catch (_) {
          measuredText = rawDimText;
        }
      }
      const blob = await response.blob();
      if (!blob || blob.size < 100) {
        throw new Error('الملف المستلم غير مكتمل أو فارغ');
      }

      const url = URL.createObjectURL(blob);
      const fileName = `${project.name || 'كتالوج'}_صفحة_طويلة_${longPageDimensions.widthCm}x${longPageDimensions.heightCm}سم.pdf`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      await AppService.addExport({
        id: 'exp_' + Date.now(),
        projectId: project.id,
        filename: fileName,
        date: new Date().toISOString(),
        productCount: activeProducts.length,
        templateName: template.name,
        fileSize: blob.size,
        downloadUrl: url,
      });

      setDirectSaveToast(`تم حفظ PDF بالقياس الفعلي: ${measuredText}`);
      setTimeout(() => setDirectSaveToast(null), 4500);
    } catch (err: any) {
      console.error('Direct save error:', err);
      alert('حدث خطأ أثناء حفظ الملف: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsDirectSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#17181D]">
      {/* Studio Top Control Bar */}
      <div className="h-14 bg-[#17181D] border-b border-white/10 px-5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToTable}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>جدول المنتجات</span>
          </button>

          <div className="h-5 w-px bg-white/10" />

          <div>
            <h2 className="text-xs font-bold text-white font-cairo line-clamp-1">
              {project.name}
            </h2>
            <p className="text-[10px] text-white/70">
              القالب الحالي: <span className="text-white font-bold">{template.name}</span> ({template.layoutType})
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {directSaveToast && (
            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-950/80 px-3 py-1 rounded-lg border border-emerald-600 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {directSaveToast}
            </span>
          )}

          {saveSuccess && (
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              تم حفظ التغييرات
            </span>
          )}

          {/* Live Dimension Indicator Tag */}
          <div
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold font-cairo"
            title="القياس المحسوب للملف عند التصدير كصفحة واحدة طويلة مستمرة"
          >
            <Ruler className="w-3.5 h-3.5 text-amber-400" />
            <span>قياس الصفحة:</span>
            <span className="font-black text-amber-400 font-inter text-[11px] bg-amber-500/20 px-1.5 py-0.5 rounded">
              {longPageDimensions.dimensionsText}
            </span>
          </div>

          {onUpdateProducts && (
            <button
              onClick={() => setIsSequenceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition-all border border-amber-500/40 shadow-sm"
              title="ترتيب وتسلسل المنتجات وتعديل الفئات يدوياً"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span>ترتيب وتسلسل المنتجات</span>
            </button>
          )}

          <button
            onClick={onOpenShortener}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            اختصار الأوصاف
          </button>

          <button
            onClick={() => setIsTemplatesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            القوالب
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors border border-slate-700"
          >
            <Save className="w-4 h-4 text-sky-400" />
            حفظ المشروع
          </button>

          {/* Direct 1-Click Save PDF Button with Dimensions */}
          <button
            onClick={handleDirectSaveLongPagePdf}
            disabled={isDirectSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/25 hover:scale-[1.02] disabled:opacity-60"
            title={`حفظ وتنزيل فوري لملف PDF بصفحة واحدة طويلة بهذا القياس (${longPageDimensions.dimensionsText})`}
          >
            {isDirectSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ بالقياس...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>حفظ PDF مباشر ({longPageDimensions.dimensionsText})</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setExportModalMode('single_long_page');
              setExportModalInitialPage(undefined);
              setIsPDFExportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition-all"
            title="خيارات وتخصيص تصدير الصفحة الطويلة"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>خيارات التصدير</span>
          </button>

          <button
            onClick={() => {
              setExportModalMode('exact_studio_preview');
              setIsPDFExportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white hover:bg-slate-100 text-[#01334E] text-xs font-black transition-all shadow-md hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>تصدير PDF (300 DPI)</span>
          </button>
        </div>
      </div>

      {/* 3-Column Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Elements & Layout Sidebar */}
        <ElementsSidebar
          template={template}
          onChangeTemplate={onChangeTemplate}
          products={products}
          onOpenTemplatesModal={() => setIsTemplatesModalOpen(true)}
          onOpenSequenceModal={() => setIsSequenceModalOpen(true)}
        />

        {/* CENTER: Live Reactive Preview */}
        <LivePagePreview
          products={products}
          template={template}
          onOpenExport={(pageIdx) => {
            setExportModalInitialPage(pageIdx);
            setExportModalMode('exact_studio_preview');
            setIsPDFExportModalOpen(true);
          }}
        />

        {/* RIGHT: Properties Panel */}
        <PropertiesPanel
          template={template}
          onChangeTemplate={onChangeTemplate}
          products={products}
        />
      </div>

      {/* Modals */}
      {onUpdateProducts && (
        <ProductSequenceModal
          isOpen={isSequenceModalOpen}
          onClose={() => setIsSequenceModalOpen(false)}
          products={products}
          onUpdateProducts={onUpdateProducts}
          categories={categories}
        />
      )}

      <TemplateManagerModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        currentTemplate={template}
        onApplyTemplate={onChangeTemplate}
      />

      <PDFExportModal
        isOpen={isPDFExportModalOpen}
        onClose={() => {
          setIsPDFExportModalOpen(false);
          setExportModalInitialPage(undefined);
        }}
        products={products}
        template={template}
        projectName={project.name}
        projectId={project.id}
        initialPageIndex={exportModalInitialPage}
        initialExportMode={exportModalMode}
      />
    </div>
  );
}
