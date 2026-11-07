'use client';

import React, { useState, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  AlertCircle,
  Package,
  Download,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { CatalogTemplate, Product } from '@/types';
import { calculateItemsPerPage, getPageDimensions } from '@/lib/pdf/pageLayout';

interface LivePagePreviewProps {
  products: Product[];
  template: CatalogTemplate;
  onOpenExport?: (pageIndex?: number) => void;
}

export default function LivePagePreview({ products, template, onOpenExport }: LivePagePreviewProps) {
  const [zoom, setZoom] = useState<number>(75);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [quickExporting, setQuickExporting] = useState<'png' | 'pdf' | null>(null);

  const { page, table, typography, image, price, barcode, header, footer } = template;

  // Active products, sorted by category grouping order if enabled
  const sortedActiveProducts = useMemo(() => {
    const list = products.filter((p) => p.includedInCatalog);
    if (!template.categoryGrouping?.enabled) {
      return [...list].sort((a, b) => {
        const ordA = typeof a.order === 'number' ? a.order : 0;
        const ordB = typeof b.order === 'number' ? b.order : 0;
        if (ordA !== ordB) return ordA - ordB;
        return (a.name || '').localeCompare(b.name || '', 'ar');
      });
    }

    const order = template.categoryGrouping.categoryOrder || [];
    const orderMap = new Map<string, number>();
    order.forEach((cat, idx) => orderMap.set(cat, idx));

    return [...list].sort((a, b) => {
      const catA = (a.category && a.category.trim()) || 'عام';
      const catB = (b.category && b.category.trim()) || 'عام';
      const orderA = orderMap.has(catA) ? orderMap.get(catA)! : 9999;
      const orderB = orderMap.has(catB) ? orderMap.get(catB)! : 9999;
      if (orderA !== orderB) return orderA - orderB;
      const ordA = typeof a.order === 'number' ? a.order : 0;
      const ordB = typeof b.order === 'number' ? b.order : 0;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [products, template.categoryGrouping]);

  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.includedInCatalog) {
        const cat = (p.category && p.category.trim()) || 'عام';
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Exact physical page dimensions in pixels and mm (100% synchronized with PDF export)
  const sheetDimensions = useMemo(() => {
    const { widthPx, heightPx } = getPageDimensions(page);
    return { width: widthPx, height: heightPx };
  }, [page]);

  // Exact items per page matching the print engine 1:1
  const itemsPerPage = useMemo(() => {
    return calculateItemsPerPage(template);
  }, [template]);

  const totalPages = Math.ceil(sortedActiveProducts.length / itemsPerPage) || 1;

  // Products for current preview page
  const pageProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedActiveProducts.slice(start, start + itemsPerPage);
  }, [sortedActiveProducts, currentPage, itemsPerPage]);

  const handleQuickExportCurrentPage = async (format: 'png' | 'pdf') => {
    try {
      setQuickExporting(format);
      const res = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: sortedActiveProducts,
          template,
          options: {
            filename: `كتالوج_صفحة_${currentPage}`,
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
            exportMode: 'exact_studio_preview',
            exportFormat: format === 'png' ? 'png_image' : 'pdf',
            pageIndex: currentPage,
          },
        }),
      });

      if (!res.ok) throw new Error('فشل التصدير السريع');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `كتالوج_صفحة_${currentPage}.${format === 'png' ? 'png' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Quick export error:', err);
    } finally {
      setQuickExporting(null);
    }
  };

  const formatPrice = (val: number | string) => {
    if (val === undefined || val === null || val === '') return '-';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return String(val);
    const formatted = num.toLocaleString('en-US');
    return price.currencyPosition === 'prefix'
      ? `${price.currency} ${formatted}`
      : `${formatted} ${price.currency}`;
  };

  const getProductDesc = (p: Product) => {
    if (p.activeDescriptionType === 'custom' && p.customDescription) {
      return p.customDescription;
    }
    if (p.activeDescriptionType === 'shortened' && p.shortenedDescription) {
      return p.shortenedDescription;
    }
    return p.originalDescription || '';
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden select-none">
      {/* Canvas Top Control Bar */}
      <div className="h-12 bg-slate-950/80 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white flex items-center gap-1.5 font-cairo">
            <FileText className="w-4 h-4 text-sky-400" />
            معاينة الصفحة الحية (Live Print Canvas)
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            {page.size} {page.orientation === 'portrait' ? 'عمودي' : 'أفقي'}
          </span>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1 rounded text-slate-300 hover:text-white disabled:opacity-30"
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-sky-400 font-inter text-[11px]">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1 rounded text-slate-300 hover:text-white disabled:opacity-30"
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Real-Size Export Actions */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 rounded-lg p-1 border border-slate-800">
          <button
            onClick={() => handleQuickExportCurrentPage('png')}
            disabled={quickExporting !== null}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-950/70 hover:bg-purple-900/90 text-purple-300 hover:text-white border border-purple-800/60 font-bold text-[11px] transition-colors disabled:opacity-50"
            title="تصدير هذه الصفحة الحالية كصورة PNG بالقياس الحقيقي (300 DPI)"
          >
            {quickExporting === 'png' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>حفظ صفحة {currentPage} (PNG)</span>
          </button>

          <button
            onClick={() => (onOpenExport ? onOpenExport(currentPage) : handleQuickExportCurrentPage('pdf'))}
            disabled={quickExporting !== null}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-950/70 hover:bg-sky-900/90 text-sky-300 hover:text-white border border-sky-800/60 font-bold text-[11px] transition-colors disabled:opacity-50"
            title="تصدير بالقياس الحقيقي المطابق للاستوديو (1:1)"
          >
            {quickExporting === 'pdf' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>تصدير قياس حقيقي (1:1)</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(25, z - 25))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            title="تصغير"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-bold text-[11px] font-inter w-10 text-center text-slate-200">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(150, z + 25))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            title="تكبير"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(75)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            title="ملاءمة الشاشة"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport (Scrollable Workspace) */}
      <div className="flex-1 overflow-auto p-8 flex items-start justify-center canvas-checkerboard">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: `${sheetDimensions.width}px`,
            minHeight: `${sheetDimensions.height}px`,
            padding: `${page.margins.top}mm ${page.margins.left}mm ${page.margins.bottom}mm ${page.margins.right}mm`,
          }}
          className="bg-white shadow-2xl relative text-slate-900 border border-slate-300 flex flex-col justify-between"
          dir="rtl"
        >
          {/* Main Printable Content */}
          <div className="flex-1 flex flex-col">
            {/* Header (Banner / Image / Text) */}
            {header.enabled && (!header.showOnFirstPageOnly || currentPage === 1) && (
              <header
                style={{
                  backgroundColor: header.background || 'transparent',
                  borderBottom: header.borderBottom ? '1px solid #e2e8f0' : 'none',
                }}
                className="mb-3 w-full"
              >
                {/* 1. Image Banner Mode */}
                {header.bannerImage && (header.type === 'image' || !header.type) && (
                  <div
                    style={{
                      height: `${header.bannerHeight || header.height || 70}px`,
                      borderRadius: `${header.bannerBorderRadius || 0}px`,
                    }}
                    className="w-full flex items-center justify-center overflow-hidden"
                  >
                    <img
                      src={header.bannerImage}
                      alt="Header Banner"
                      style={{
                        objectFit: header.bannerFit || 'contain',
                        borderRadius: `${header.bannerBorderRadius || 0}px`,
                      }}
                      className="w-full h-full"
                    />
                  </div>
                )}

                {/* 2. Both: Banner + Info Bar */}
                {header.bannerImage && header.type === 'both' && (
                  <div className="space-y-1.5 w-full">
                    <div
                      style={{
                        height: `${header.bannerHeight || header.height || 70}px`,
                        borderRadius: `${header.bannerBorderRadius || 0}px`,
                      }}
                      className="w-full flex items-center justify-center overflow-hidden"
                    >
                      <img
                        src={header.bannerImage}
                        alt="Header Banner"
                        style={{
                          objectFit: header.bannerFit || 'contain',
                          borderRadius: `${header.bannerBorderRadius || 0}px`,
                        }}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[8pt] text-slate-500 pt-1 border-t border-slate-200 font-tajawal">
                      <div>
                        {header.companyName} {header.catalogTitle ? `• ${header.catalogTitle}` : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        {header.showDate && <span>التاريخ: {new Date().toLocaleDateString('ar-IQ')}</span>}
                        <span>صفحة {currentPage} من {totalPages}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Text Only Mode */}
                {(!header.bannerImage || header.type === 'text') && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div>
                      <h1
                        style={{
                          fontFamily: typography.headerText.fontFamily,
                          fontSize: `${typography.headerText.fontSize}pt`,
                          fontWeight: typography.headerText.fontWeight,
                          color: typography.headerText.color,
                          lineHeight: typography.headerText.lineHeight,
                        }}
                      >
                        {header.companyName || 'Catalog Studio'}
                      </h1>
                      <p className="text-[9pt] text-slate-500 font-tajawal">
                        {header.catalogTitle || 'كتالوج المنتجات الرسمي'}
                      </p>
                    </div>

                    <div className="text-left text-[8pt] text-slate-500 font-tajawal">
                      {header.showDate && (
                        <div>التاريخ: {new Date().toLocaleDateString('ar-IQ')}</div>
                      )}
                      <div>صفحة {currentPage} من {totalPages}</div>
                    </div>
                  </div>
                )}
              </header>
            )}

            {/* Content (Table Layout vs Cards Layout) */}
            {sortedActiveProducts.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold">لا توجد منتجات مضمنة في هذا الكتالوج</p>
                <p className="text-xs text-slate-400 mt-1">
                  قم بتمكين المنتجات من تبويب "المنتجات" بالأسفل لتظهر في الطباعة
                </p>
              </div>
            ) : template.layoutType === 'cards' ? (
              <div className="grid grid-cols-2 gap-3 flex-1">
                {(() => {
                  let lastCat = '';
                  return pageProducts.map((p) => {
                    const desc = getProductDesc(p);
                    const currentCat = (p.category && p.category.trim()) || 'عام';
                    const showCatHeader =
                      template.categoryGrouping?.enabled &&
                      template.categoryGrouping?.showHeader !== false &&
                      currentCat !== lastCat;
                    if (showCatHeader) {
                      lastCat = currentCat;
                    }

                    return (
                      <React.Fragment key={p.id}>
                        {showCatHeader && (
                          <div
                            style={{
                              backgroundColor: template.categoryGrouping?.headerBackground || '#0f172a',
                              color: template.categoryGrouping?.headerTextColor || '#ffffff',
                            }}
                            className="col-span-2 py-2 px-3 rounded-xl flex items-center justify-between font-bold text-xs shadow-sm border border-slate-700/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                              <span className="font-cairo text-xs font-bold">قسم: {currentCat}</span>
                            </div>
                            {template.categoryGrouping?.showProductCount !== false && (
                              <span className="text-[10px] font-normal opacity-85 bg-white/10 px-2.5 py-0.5 rounded-full font-mono">
                                {categoryProductCounts[currentCat] || 0} منتج
                              </span>
                            )}
                          </div>
                        )}
                        <div
                          style={{
                            border: `${table.borders.outerWidth}px solid ${table.borders.outerColor}`,
                            padding: `${table.cellPadding.top}px`,
                          }}
                          className="rounded-lg bg-white flex flex-col justify-between"
                        >
                          <div className="flex gap-2.5 items-start">
                            <div
                              style={{
                                width: `${image.width}px`,
                                height: `${image.height}px`,
                                border: `${image.borderWidth}px solid ${image.borderColor}`,
                                borderRadius: `${image.borderRadius}px`,
                                backgroundColor: image.background,
                              }}
                              className="flex items-center justify-center overflow-hidden flex-shrink-0"
                            >
                              {p.imageData && p.imageStatus === 'valid' ? (
                                <img
                                  src={p.imageData}
                                  alt={p.name}
                                  style={{ objectFit: image.fitMode }}
                                  className="w-full h-full"
                                />
                              ) : (
                                <span className="text-[8pt] text-slate-400">بدون صورة</span>
                              )}
                            </div>

                            <div className="flex-1">
                              <span className="inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[7.5pt] font-semibold mb-1">
                                {p.category || 'عام'}
                              </span>
                              <h3
                                style={{
                                  fontFamily: typography.productName.fontFamily,
                                  fontSize: `${typography.productName.fontSize}pt`,
                                  fontWeight: typography.productName.fontWeight,
                                  color: typography.productName.color,
                                  lineHeight: typography.productName.lineHeight,
                                }}
                                className="line-clamp-2"
                              >
                                {p.name}
                              </h3>
                              <p
                                style={{
                                  fontFamily: typography.description.fontFamily,
                                  fontSize: `${typography.description.fontSize}pt`,
                                  fontWeight: typography.description.fontWeight,
                                  color: typography.description.color,
                                }}
                                className="mt-1 line-clamp-2"
                              >
                                {desc}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                            {barcode.showBarcode && p.barcode && (
                              <span
                                style={{
                                  fontFamily: barcode.fontFamily,
                                  fontSize: `${barcode.fontSize}pt`,
                                  letterSpacing: `${barcode.letterSpacing}px`,
                                  color: barcode.color,
                                }}
                                className="font-inter"
                              >
                                {p.barcode}
                              </span>
                            )}
                            <div className="text-left">
                              {p.salePrice !== undefined && p.salePrice !== '' && p.customerPrice !== undefined && p.salePrice !== p.customerPrice ? (
                                <div className="flex flex-col items-end">
                                  <span
                                    style={{
                                      fontFamily: price.fontFamily,
                                      fontSize: `${price.fontSize}pt`,
                                      fontWeight: price.fontWeight,
                                      color: price.color,
                                    }}
                                  >
                                    {formatPrice(p.customerPrice ?? p.price)}
                                  </span>
                                  <span className="text-[7.5pt] text-slate-500 font-semibold">
                                    جملة: {formatPrice(p.salePrice)}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  style={{
                                    fontFamily: price.fontFamily,
                                    fontSize: `${price.fontSize}pt`,
                                    fontWeight: price.fontWeight,
                                    color: price.color,
                                  }}
                                >
                                  {formatPrice(p.customerPrice ?? p.price)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            ) : (
              /* Standard Table Layout with Repeating Header */
              <table
                style={{
                  border: `${table.borders.outerWidth}px solid ${table.borders.outerColor}`,
                }}
                className="w-full border-collapse"
              >
                <thead
                  style={{
                    backgroundColor: table.headerBackground,
                    color: table.headerTextColor,
                  }}
                >
                  <tr>
                    {table.columns
                      .filter((c) => c.visible)
                      .map((col) => (
                        <th
                          key={col.id}
                          style={{
                            width: `${col.width}%`,
                            fontFamily: typography.tableHeader.fontFamily,
                            fontSize: `${typography.tableHeader.fontSize}pt`,
                            fontWeight: typography.tableHeader.fontWeight,
                            padding: `${table.cellPadding.top}px ${table.cellPadding.right}px`,
                            borderBottom: `${table.borders.horizontalWidth}px solid ${table.borders.outerColor}`,
                            borderLeft: `${table.borders.verticalWidth}px solid rgba(255,255,255,0.15)`,
                            textAlign: col.alignment || (col.key === 'name' ? 'right' : 'center'),
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastCat = '';
                    const visibleColsCount = table.columns.filter((c) => c.visible).length;

                    return pageProducts.map((p, rowIdx) => {
                      const desc = getProductDesc(p);
                      const isEven = rowIdx % 2 === 1;
                      const currentCat = (p.category && p.category.trim()) || 'عام';
                      const showCatHeader =
                        template.categoryGrouping?.enabled &&
                        template.categoryGrouping?.showHeader !== false &&
                        currentCat !== lastCat;
                      if (showCatHeader) {
                        lastCat = currentCat;
                      }

                      return (
                        <React.Fragment key={p.id}>
                          {showCatHeader && (
                            <tr className="category-header-row">
                              <td
                                colSpan={visibleColsCount}
                                style={{
                                  backgroundColor: template.categoryGrouping?.headerBackground || '#0f172a',
                                  color: template.categoryGrouping?.headerTextColor || '#ffffff',
                                  padding: '7px 14px',
                                  fontWeight: '700',
                                  fontSize: `${template.categoryGrouping?.headerFontSize || 9.5}pt`,
                                  fontFamily: typography.productName.fontFamily || 'Cairo, sans-serif',
                                  borderTop: '2px solid #0284c7',
                                  borderBottom: '1px solid #334155',
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                                    <span>قسم: {currentCat}</span>
                                  </div>
                                  {template.categoryGrouping?.showProductCount !== false && (
                                    <span className="text-[8pt] font-normal opacity-85 bg-white/10 px-2.5 py-0.5 rounded-full font-mono">
                                      {categoryProductCounts[currentCat] || 0} منتج
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr
                            style={{
                          backgroundColor:
                            isEven && table.alternateRowBackground
                              ? table.alternateRowBackground
                              : '#ffffff',
                          borderBottom: `${table.borders.horizontalWidth}px solid ${table.borders.horizontalColor}`,
                          minHeight: `${table.minRowHeight || table.rowHeight}px`,
                        }}
                      >
                        {table.columns
                          .filter((c) => c.visible)
                          .map((col) => {
                            if (col.key === 'imageData') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                  }}
                                  className="text-center"
                                >
                                  <div
                                    style={{
                                      width: `${image.width}px`,
                                      height: `${image.height}px`,
                                      border: `${image.borderWidth}px solid ${image.borderColor}`,
                                      borderRadius: `${image.borderRadius}px`,
                                      backgroundColor: image.background,
                                    }}
                                    className="flex items-center justify-center overflow-hidden mx-auto"
                                  >
                                    {p.imageData && p.imageStatus === 'valid' ? (
                                      <img
                                        src={p.imageData}
                                        alt={p.name}
                                        style={{ objectFit: image.fitMode }}
                                        className="w-full h-full"
                                      />
                                    ) : (
                                      <span className="text-[7pt] text-slate-400">
                                        {p.imageStatus === 'invalid' ? '⚠️ تالفة' : 'بدون صورة'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            if (col.key === 'name') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px ${table.cellPadding.right}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'right',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontFamily: typography.productName.fontFamily,
                                      fontSize: `${typography.productName.fontSize}pt`,
                                      fontWeight: typography.productName.fontWeight,
                                      color: typography.productName.color,
                                      lineHeight: typography.productName.lineHeight,
                                    }}
                                  >
                                    {p.name}
                                  </div>
                                  {p.shopifyUrl && (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center gap-1 text-[7pt] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                        🔗 شراء أونلاين من ezoneiraq.com
                                      </span>
                                    </div>
                                  )}
                                </td>
                              );
                            }

                            if ((col.key as string) === 'description' || col.key === 'originalDescription') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px ${table.cellPadding.right}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'right',
                                  }}
                                >
                                  {desc ? (
                                    <div
                                      style={{
                                        fontFamily: typography.description.fontFamily,
                                        fontSize: `${typography.description.fontSize}pt`,
                                        fontWeight: typography.description.fontWeight,
                                        color: typography.description.color,
                                        lineHeight: typography.description.lineHeight,
                                        whiteSpace: 'pre-line',
                                      }}
                                    >
                                      {desc}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 text-xs">-</span>
                                  )}
                                </td>
                              );
                            }

                            if (col.key === 'barcode') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'center',
                                  }}
                                >
                                  {barcode.showBarcode && p.barcode ? (
                                    <span
                                      style={{
                                        fontFamily: barcode.fontFamily,
                                        fontSize: `${barcode.fontSize}pt`,
                                        letterSpacing: `${barcode.letterSpacing}px`,
                                        color: barcode.color,
                                      }}
                                      className="font-inter block"
                                    >
                                      {p.barcode}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              );
                            }

                            if (col.key === 'category') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'center',
                                  }}
                                >
                                  <span className="inline-block bg-slate-100 text-slate-700 text-[8pt] font-semibold px-2 py-0.5 rounded">
                                    {p.category || 'عام'}
                                  </span>
                                  {p.internalReference && (
                                    <span className="block text-[7pt] text-slate-400 mt-1 font-inter">
                                      {p.internalReference}
                                    </span>
                                  )}
                                </td>
                              );
                            }

                            if (col.key === 'customerPrice') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'center',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontFamily: price.fontFamily,
                                      fontSize: `${price.fontSize}pt`,
                                      fontWeight: price.fontWeight,
                                      color: price.color,
                                    }}
                                  >
                                    {formatPrice(p.customerPrice ?? p.price)}
                                  </div>
                                </td>
                              );
                            }

                            if (col.key === 'salePrice') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'center',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontFamily: price.fontFamily,
                                      fontSize: `${price.fontSize}pt`,
                                      fontWeight: '600',
                                      color: '#334155',
                                    }}
                                  >
                                    {p.salePrice !== undefined && p.salePrice !== ''
                                      ? formatPrice(p.salePrice)
                                      : '-'}
                                  </div>
                                </td>
                              );
                            }

                            if (col.key === 'stock') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'center',
                                  }}
                                >
                                  <span
                                    className={`inline-block text-[7.5pt] font-bold px-2 py-0.5 rounded ${
                                      p.stock === 0
                                        ? 'bg-rose-100 text-rose-800'
                                        : p.stock < 5
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {p.stock === 0 ? 'نفذ المخزون' : `${p.stock}`}
                                  </span>
                                </td>
                              );
                            }

                            if (col.key === 'internalReference') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'center',
                                  }}
                                >
                                  <span className="font-mono text-[8pt] text-slate-600">
                                    {p.internalReference || '-'}
                                  </span>
                                </td>
                              );
                            }

                            if (col.key === 'price') {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: `${table.cellPadding.top}px`,
                                    verticalAlign: table.verticalAlignment,
                                    borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                    textAlign: col.alignment || 'center',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontFamily: price.fontFamily,
                                      fontSize: `${price.fontSize}pt`,
                                      fontWeight: price.fontWeight,
                                      color: price.color,
                                    }}
                                  >
                                    {formatPrice(p.customerPrice ?? p.price)}
                                  </div>
                                  <div className="mt-1">
                                    <span
                                      className={`inline-block text-[7pt] font-bold px-1.5 py-0.5 rounded ${
                                        p.stock === 0
                                          ? 'bg-rose-100 text-rose-800'
                                          : p.stock < 5
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      {p.stock === 0 ? 'نفذ المخزون' : `المتوفر: ${p.stock}`}
                                    </span>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={col.id}
                                style={{
                                  padding: `${table.cellPadding.top}px`,
                                  verticalAlign: table.verticalAlignment,
                                  borderLeft: `${table.borders.verticalWidth}px solid ${table.borders.verticalColor}`,
                                  textAlign: col.alignment || 'center',
                                }}
                              >
                                {(p as any)[col.key] || '-'}
                              </td>
                            );
                          })}
                      </tr>
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
              </table>
            )}
          </div>

          {/* Footer (with image banner support, especially on the last page) */}
          {footer.enabled && (() => {
            const isLastPage = currentPage === totalPages;
            const shouldShowBanner =
              !!footer.bannerImage &&
              (footer.showOnLastPageOnly !== false ? isLastPage : true);

            return (
              <footer
                style={{
                  borderTop:
                    footer.borderTop && !shouldShowBanner ? '1px solid #e2e8f0' : 'none',
                }}
                className="mt-3 flex-shrink-0"
              >
                {shouldShowBanner && (
                  <div
                    style={{
                      height: `${footer.bannerHeight || 80}px`,
                      backgroundColor: footer.background || 'transparent',
                      borderRadius: `${footer.bannerBorderRadius || 0}px`,
                    }}
                    className="w-full flex items-center justify-center overflow-hidden mb-2 border border-slate-100"
                  >
                    <img
                      src={footer.bannerImage}
                      alt="Footer Banner"
                      style={{
                        objectFit: footer.bannerFit || 'contain',
                        borderRadius: `${footer.bannerBorderRadius || 0}px`,
                      }}
                      className="w-full h-full"
                    />
                  </div>
                )}

                {(footer.type !== 'image' || !shouldShowBanner) && (
                  <div
                    style={{
                      height: `${footer.height || 24}px`,
                      color: footer.textColor || '#64748b',
                      borderTop: shouldShowBanner && footer.borderTop ? '1px solid #e2e8f0' : 'none',
                    }}
                    className="flex items-center justify-between pt-1 text-[8pt] text-slate-400 font-tajawal"
                  >
                    <div>{footer.customText || 'Catalog Studio'}</div>
                    {footer.showPageNumber && (
                      <div>الصفحة {currentPage} من {totalPages}</div>
                    )}
                  </div>
                )}
              </footer>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
