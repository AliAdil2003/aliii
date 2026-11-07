import { CatalogTemplate, Product, PDFExportOptions } from '@/types';
import { getPageDimensions, calculateItemsPerPage, chunkProductsIntoPages } from './pageLayout';

export function generateCatalogHtml(
  products: Product[],
  template: CatalogTemplate,
  options: PDFExportOptions
): string {
  const { page, table, typography, image, price, barcode, header, footer } = template;

  const safeBorders = {
    outerWidth: table?.borders?.outerWidth ?? 1,
    outerColor: table?.borders?.outerColor || '#e2e8f0',
    horizontalWidth: table?.borders?.horizontalWidth ?? 1,
    horizontalColor: table?.borders?.horizontalColor || '#e2e8f0',
    verticalWidth: table?.borders?.verticalWidth ?? 0,
    verticalColor: table?.borders?.verticalColor || '#e2e8f0',
  };

  const safeCellPadding = {
    top: table?.cellPadding?.top ?? 8,
    right: table?.cellPadding?.right ?? 8,
    bottom: table?.cellPadding?.bottom ?? 8,
    left: table?.cellPadding?.left ?? 8,
  };

  const safeImage = {
    width: image?.width || 60,
    height: image?.height || 60,
    borderWidth: image?.borderWidth ?? 0,
    borderColor: image?.borderColor || '#e2e8f0',
    borderRadius: image?.borderRadius ?? 4,
    background: image?.background || '#ffffff',
    fitMode: image?.fitMode || 'contain',
  };

  // Active products included in catalog
  const activeProducts = products.filter((p) => p.includedInCatalog);

  // Category counts
  const categoryCounts: Record<string, number> = {};
  products.forEach((p) => {
    if (p.includedInCatalog) {
      const cat = (p.category && p.category.trim()) || 'عام';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });

  // Sort products by category grouping order if enabled
  let processedProducts = [...activeProducts];
  if (template.categoryGrouping?.enabled) {
    const order = template.categoryGrouping.categoryOrder || [];
    const orderMap = new Map<string, number>();
    order.forEach((cat, idx) => orderMap.set(cat, idx));

    processedProducts.sort((a, b) => {
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
  } else {
    processedProducts.sort((a, b) => {
      const ordA = typeof a.order === 'number' ? a.order : 0;
      const ordB = typeof b.order === 'number' ? b.order : 0;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }

  // Dimensions
  const pageDims = getPageDimensions(page);
  const isContinuous = options.exportMode === 'continuous_flow';
  const isSingleLongPage = options.exportMode === 'single_long_page';

  // Items per page matching LivePagePreview 1:1
  const itemsPerPage = calculateItemsPerPage(template);
  const allPageChunks = chunkProductsIntoPages(processedProducts, itemsPerPage);
  const totalPages = Math.max(1, allPageChunks.length);

  // If specific pageIndex was requested (1-based index)
  let pagesToRender: { pageIndex: number; products: Product[] }[] = [];
  if (options.pageIndex && options.pageIndex > 0 && options.pageIndex <= totalPages) {
    const idx = options.pageIndex - 1;
    pagesToRender = [{ pageIndex: idx, products: allPageChunks[idx] || [] }];
  } else {
    pagesToRender = allPageChunks.map((chunk, idx) => ({
      pageIndex: idx,
      products: chunk,
    }));
  }

  // Currency helper
  const formatPrice = (val: number | string) => {
    if (val === undefined || val === null || val === '') return '-';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return String(val);

    const formatted = num.toLocaleString('en-US');
    return price.currencyPosition === 'prefix'
      ? `${price.currency} ${formatted}`
      : `${formatted} ${price.currency}`;
  };

  // Safe description helper
  const getProductDescription = (p: Product) => {
    if (p.activeDescriptionType === 'custom' && p.customDescription) {
      return p.customDescription;
    }
    if (p.activeDescriptionType === 'shortened' && p.shortenedDescription) {
      return p.shortenedDescription;
    }
    return p.shopifyDescription || p.originalDescription || '';
  };

  // Helper to render header for a specific page
  const renderHeader = (pageNumber: number) => {
    if (!header.enabled) return '';
    if (header.showOnFirstPageOnly && pageNumber > 1 && !isSingleLongPage) return '';

    const pageCountLabel = isSingleLongPage
      ? `صفحة واحدة متصلة (${processedProducts.length} منتج)`
      : `صفحة ${pageNumber} من ${totalPages}`;

    if (header.bannerImage && (header.type === 'image' || !header.type)) {
      return `
        <header class="catalog-header-banner" style="width: 100%; height: ${header.bannerHeight || header.height || 70}px; display: flex; justify-content: center; align-items: center; margin-bottom: 12px; border-radius: ${header.bannerBorderRadius || 0}px; overflow: hidden; background: ${header.background || 'transparent'}; flex-shrink: 0;">
          <img src="${header.bannerImage}" alt="Header Banner" style="width: 100%; height: 100%; object-fit: ${header.bannerFit || 'contain'}; border-radius: ${header.bannerBorderRadius || 0}px;" />
        </header>`;
    }

    if (header.bannerImage && header.type === 'both') {
      return `
        <header class="catalog-header-both" style="width: 100%; margin-bottom: 12px; flex-shrink: 0;">
          <div style="width: 100%; height: ${header.bannerHeight || header.height || 70}px; display: flex; justify-content: center; align-items: center; border-radius: ${header.bannerBorderRadius || 0}px; overflow: hidden; background: ${header.background || 'transparent'};">
            <img src="${header.bannerImage}" alt="Header Banner" style="width: 100%; height: 100%; object-fit: ${header.bannerFit || 'contain'};" />
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 5px; font-size: 8pt; color: #64748b; font-family: 'Tajawal', sans-serif; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            <div>${header.companyName || ''} ${header.catalogTitle ? `• ${header.catalogTitle}` : ''}</div>
            <div style="display: flex; gap: 12px; align-items: center;">
              ${header.showDate ? `<span>التاريخ: ${new Date().toLocaleDateString('ar-IQ')}</span>` : ''}
              <span>${pageCountLabel}</span>
            </div>
          </div>
        </header>`;
    }

    return `
      <header class="catalog-header" style="width: 100%; height: ${header.height}px; display: flex; align-items: center; justify-content: space-between; border-bottom: ${header.borderBottom ? '2px solid #0f172a' : 'none'}; padding-bottom: 8px; margin-bottom: 12px; background: ${header.background}; flex-shrink: 0;">
        <div>
          <div class="brand-title">${header.companyName || 'Catalog Studio'}</div>
          <div class="catalog-sub">${header.catalogTitle || 'كتالوج المنتجات الرسمي'}</div>
        </div>
        <div class="header-meta">
          ${header.showDate ? `<div>التاريخ: ${new Date().toLocaleDateString('ar-IQ')}</div>` : ''}
          <div>${pageCountLabel}</div>
        </div>
      </header>`;
  };

  // Helper to render footer for a specific page
  const renderFooter = (pageNumber: number) => {
    if (!footer.enabled) return '';
    const isLastPage = pageNumber === totalPages;
    const shouldShowBanner =
      !!footer.bannerImage &&
      (footer.showOnLastPageOnly !== false ? isLastPage || isSingleLongPage : true);

    const footerPageLabel = isSingleLongPage
      ? `صفحة واحدة متصلة (${processedProducts.length} منتج)`
      : `الصفحة ${pageNumber} من ${totalPages}`;

    const bannerHtml = shouldShowBanner
      ? `<div class="catalog-footer-banner-container" style="width: 100%; height: ${footer.bannerHeight || 80}px; display: flex; justify-content: center; align-items: center; border-radius: ${footer.bannerBorderRadius || 0}px; overflow: hidden; background: ${footer.background || 'transparent'}; margin-bottom: 6px;">
          <img src="${footer.bannerImage}" alt="Footer Banner" style="width: 100%; height: 100%; object-fit: ${footer.bannerFit || 'contain'}; border-radius: ${footer.bannerBorderRadius || 0}px;" />
        </div>`
      : '';

    if (shouldShowBanner && (footer.type === 'image' || (!footer.type && !footer.customText && !footer.showPageNumber))) {
      return `
        <footer class="catalog-footer catalog-footer-image-only" style="width: 100%; margin-top: 8px; flex-shrink: 0; display: flex; flex-direction: column;">
          ${bannerHtml}
        </footer>`;
    }

    if (shouldShowBanner && (footer.type === 'both' || !footer.type)) {
      return `
        <footer class="catalog-footer catalog-footer-with-banner" style="width: 100%; margin-top: 8px; flex-shrink: 0; display: flex; flex-direction: column;">
          ${bannerHtml}
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: ${footer.borderTop ? '1px solid #e2e8f0' : 'none'}; font-size: 8pt; color: ${footer.textColor || '#64748b'}; font-family: 'Tajawal', sans-serif;">
            <div>${footer.customText || ''}</div>
            ${footer.showPageNumber ? `<div>${footerPageLabel}</div>` : ''}
          </div>
        </footer>`;
    }

    return `
      <footer class="catalog-footer" style="height: ${footer.height || 26}px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; border-top: ${footer.borderTop ? '1px solid #e2e8f0' : 'none'}; padding-top: 6px; font-size: 8pt; color: ${footer.textColor || '#64748b'}; font-family: 'Tajawal', sans-serif;">
        <div>${footer.customText || ''}</div>
        ${footer.showPageNumber ? `<div>${footerPageLabel}</div>` : ''}
      </footer>`;
  };

  // Helper to render table rows for a chunk of products
  const renderTableRows = (pageChunk: Product[], startIndex: number) => {
    let lastCat = '';
    const visibleCols = table.columns.filter((c) => c.visible);
    const visibleColsCount = visibleCols.length;

    return pageChunk
      .map((p, rowIdx) => {
        const desc = getProductDescription(p);
        const currentCat = (p.category && p.category.trim()) || 'عام';
        const showCatHeader =
          template.categoryGrouping?.enabled &&
          template.categoryGrouping?.showHeader !== false &&
          currentCat !== lastCat;

        if (showCatHeader) {
          lastCat = currentCat;
        }

        const catHeaderHtml = showCatHeader
          ? `<tr class="category-header-row">
              <td colspan="${visibleColsCount}" class="category-header-cell" style="background-color: ${template.categoryGrouping?.headerBackground || '#0f172a'}; color: ${template.categoryGrouping?.headerTextColor || '#ffffff'}; font-size: ${template.categoryGrouping?.headerFontSize || 9.5}pt; font-family: '${typography.productName.fontFamily}', Cairo, sans-serif;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span>🏷️ قسم: ${currentCat}</span>
                  ${template.categoryGrouping?.showProductCount !== false ? `<span style="font-size: 8pt; font-weight: normal; opacity: 0.85;">(${categoryCounts[currentCat] || 0} منتج)</span>` : ''}
                </div>
              </td>
            </tr>`
          : '';

        return `
        ${catHeaderHtml}
        <tr style="min-height: ${table.minRowHeight || table.rowHeight}px; background-color: ${rowIdx % 2 === 1 && table.alternateRowBackground ? table.alternateRowBackground : '#ffffff'};">
        ${visibleCols
          .map((col) => {
            if (col.key === 'imageData') {
              return `
              <td style="text-align: ${col.alignment || 'center'};">
                <div class="product-img-box">
                  ${
                    p.imageData && p.imageStatus === 'valid'
                      ? `<img src="${p.imageData}" alt="${p.name}" />`
                      : `<div class="img-placeholder">${
                          p.imageStatus === 'invalid' ? '⚠️ خطأ بالصورة' : 'بدون صورة'
                        }</div>`
                  }
                </div>
              </td>`;
            }

            if (col.key === 'name') {
              return `
              <td style="text-align: ${col.alignment || 'right'};">
                <div class="product-name">${p.name}</div>
                ${
                  p.shopifyUrl
                    ? `<div style="margin-top: 4px;">
                        <a href="${p.shopifyUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 3px; font-size: 7.5pt; font-weight: bold; color: #059669; text-decoration: none; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">
                          <span>🔗 شراء أونلاين من ezoneiraq.com</span>
                        </a>
                      </div>`
                    : ''
                }
              </td>`;
            }

            if ((col.key as string) === 'description' || col.key === 'originalDescription') {
              return `
              <td style="text-align: ${col.alignment || 'right'};">
                <div class="product-desc" style="white-space: pre-line; line-height: 1.4;">${desc || '-'}</div>
              </td>`;
            }

            if (col.key === 'barcode') {
              return `
              <td style="text-align: ${col.alignment || 'center'};">
                ${barcode.showBarcode && p.barcode ? `<div class="product-barcode">${p.barcode}</div>` : '-'}
              </td>`;
            }

            if (col.key === 'category') {
              return `
              <td style="text-align: ${col.alignment || 'center'};">
                <div class="product-tag">${p.category || 'عام'}</div>
                ${p.internalReference ? `<div class="product-ref">${p.internalReference}</div>` : ''}
              </td>`;
            }

            if (col.key === 'customerPrice') {
              return `
              <td style="text-align: ${col.alignment || 'center'};">
                <div class="product-price">${formatPrice(p.customerPrice ?? p.price)}</div>
              </td>`;
            }

            if (col.key === 'salePrice') {
              return `
              <td style="text-align: ${col.alignment || 'center'};">
                <div style="font-size: 9.5pt; font-weight: 600; color: #334155;">
                  ${p.salePrice !== undefined && p.salePrice !== '' ? formatPrice(p.salePrice) : '-'}
                </div>
              </td>`;
            }

            if (col.key === 'stock') {
              return `
              <td style="text-align: ${col.alignment || 'center'};">
                <span class="stock-badge ${
                  p.stock === 0 ? 'stock-zero' : p.stock < 5 ? 'stock-low' : 'stock-good'
                }">
                  ${p.stock === 0 ? 'نفذ المخزون' : `${p.stock}`}
                </span>
              </td>`;
            }

            if (col.key === 'internalReference') {
              return `
              <td style="text-align: ${col.alignment || 'center'};">
                <div class="product-ref">${p.internalReference || '-'}</div>
              </td>`;
            }

            if (col.key === 'price') {
              return `
              <td style="text-align: ${col.alignment || 'center'};">
                <div class="product-price">${formatPrice(p.customerPrice ?? p.price)}</div>
                <div style="margin-top: 4px;">
                  <span class="stock-badge ${
                    p.stock === 0 ? 'stock-zero' : p.stock < 5 ? 'stock-low' : 'stock-good'
                  }">
                    ${p.stock === 0 ? 'نفذ المخزون' : `الكمية: ${p.stock}`}
                  </span>
                </div>
              </td>`;
            }

            return `<td style="text-align: ${col.alignment || 'center'};">${(p as any)[col.key] || '-'}</td>`;
          })
          .join('')}
      </tr>`;
      })
      .join('');
  };

  // Helper to render cards for a chunk of products
  const renderCards = (pageChunk: Product[]) => {
    let lastCat = '';
    return `
      <div class="cards-grid">
        ${pageChunk
          .map((p) => {
            const desc = getProductDescription(p);
            const currentCat = (p.category && p.category.trim()) || 'عام';
            const showCatHeader =
              template.categoryGrouping?.enabled &&
              template.categoryGrouping?.showHeader !== false &&
              currentCat !== lastCat;
            if (showCatHeader) {
              lastCat = currentCat;
            }

            const catBannerHtml = showCatHeader
              ? `<div class="category-card-banner" style="background-color: ${template.categoryGrouping?.headerBackground || '#0f172a'}; color: ${template.categoryGrouping?.headerTextColor || '#ffffff'}; font-size: ${template.categoryGrouping?.headerFontSize || 10}pt; font-family: '${typography.productName.fontFamily}', Cairo, sans-serif;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span>🏷️ قسم: ${currentCat}</span>
                  </div>
                  ${template.categoryGrouping?.showProductCount !== false ? `<span style="font-size: 8.5pt; font-weight: normal; opacity: 0.85;">(${categoryCounts[currentCat] || 0} منتج)</span>` : ''}
                </div>`
              : '';

            return `
            ${catBannerHtml}
            <div class="product-card">
              <div style="display: flex; gap: 10px; align-items: flex-start;">
                <div class="product-img-box">
                  ${
                    p.imageData && p.imageStatus === 'valid'
                      ? `<img src="${p.imageData}" alt="${p.name}" />`
                      : `<div class="img-placeholder">بدون صورة</div>`
                  }
                </div>
                <div style="flex: 1;">
                  <span class="product-tag">${p.category || 'عام'}</span>
                  <h3 class="product-name">${p.name}</h3>
                  <p class="product-desc">${desc}</p>
                  ${
                    p.shopifyUrl
                      ? `<div style="margin-top: 4px;">
                          <a href="${p.shopifyUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 3px; font-size: 7.5pt; font-weight: bold; color: #059669; text-decoration: none; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">
                            <span>🔗 شراء من ezoneiraq.com</span>
                          </a>
                        </div>`
                      : ''
                  }
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-top: 1px solid #f1f5f9; padding-top: 8px;">
                <div>
                  ${barcode.showBarcode && p.barcode ? `<div class="product-barcode">${p.barcode}</div>` : ''}
                  ${p.internalReference ? `<div class="product-ref">REF: ${p.internalReference}</div>` : ''}
                </div>
                <div style="text-align: left;">
                  <div class="product-price">${formatPrice(p.customerPrice ?? p.price)}</div>
                  ${
                    p.salePrice !== undefined && p.salePrice !== '' && p.customerPrice !== undefined && p.salePrice !== p.customerPrice
                      ? `<div style="font-size: 7.5pt; color: #64748b; font-weight: 600;">جملة: ${formatPrice(p.salePrice)}</div>`
                      : ''
                  }
                  <span class="stock-badge ${p.stock === 0 ? 'stock-zero' : p.stock < 5 ? 'stock-low' : 'stock-good'}">
                    ${p.stock === 0 ? 'نفذ المخزون' : `الكمية: ${p.stock}`}
                  </span>
                </div>
              </div>
            </div>`;
          })
          .join('')}
      </div>`;
  };

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${options.filename || 'Product_Catalog'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700&family=Noto+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    @page {
      size: ${isSingleLongPage ? `${pageDims.widthMm}mm auto` : `${pageDims.widthMm}mm ${pageDims.heightMm}mm`};
      margin: ${isSingleLongPage ? '0' : isContinuous ? `${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm` : '0'};
    }

    html, body {
      background: #ffffff;
      color: #0f172a;
      direction: rtl;
      text-align: right;
      font-family: '${typography.productName.fontFamily}', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
    }

    /* Single Continuous Long Page Styling */
    .catalog-long-page {
      width: ${pageDims.widthMm}mm;
      min-width: ${pageDims.widthMm}mm;
      max-width: ${pageDims.widthMm}mm;
      margin: 0 auto;
      box-sizing: border-box;
      padding: ${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      position: relative;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: auto;
      break-inside: auto;
    }

    /* Exact Studio 1:1 Page Sheet Styling */
    .catalog-page {
      width: ${pageDims.widthMm}mm;
      height: ${pageDims.heightMm}mm;
      min-height: ${pageDims.heightMm}mm;
      max-height: ${pageDims.heightMm}mm;
      box-sizing: border-box;
      padding: ${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
      background: #ffffff;
      position: relative;
    }

    .catalog-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .catalog-page-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Print header */
    .catalog-header .brand-title {
      font-family: '${typography.headerText.fontFamily}', sans-serif;
      font-size: ${typography.headerText.fontSize}pt;
      font-weight: ${typography.headerText.fontWeight};
      color: ${typography.headerText.color};
      line-height: ${typography.headerText.lineHeight};
    }

    .catalog-header .catalog-sub {
      font-family: 'Tajawal', sans-serif;
      font-size: 8.5pt;
      color: #64748b;
      margin-top: 2px;
    }

    .catalog-header .header-meta {
      font-family: 'Tajawal', sans-serif;
      font-size: 8pt;
      color: #64748b;
      text-align: left;
    }

    /* Print footer */
    .catalog-footer {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 8px;
      margin-top: 8px;
      border-top: ${footer.borderTop ? '1px solid #e2e8f0' : 'none'};
      font-family: '${typography.footerText.fontFamily}', sans-serif;
      font-size: ${typography.footerText.fontSize}pt;
      color: ${typography.footerText.color};
    }

    /* Table styling */
    table.catalog-table {
      width: 100%;
      border-collapse: collapse;
      border: ${safeBorders.outerWidth}px solid ${safeBorders.outerColor};
    }

    thead.table-header {
      background-color: ${table.headerBackground || '#0f172a'};
      color: ${table.headerTextColor || '#ffffff'};
    }

    thead.table-header th {
      background-color: ${table.headerBackground || '#0f172a'};
      color: ${table.headerTextColor || '#ffffff'};
      font-family: '${typography.tableHeader.fontFamily}', sans-serif;
      font-size: ${typography.tableHeader.fontSize}pt;
      font-weight: ${typography.tableHeader.fontWeight};
      padding: ${safeCellPadding.top}px ${safeCellPadding.right}px ${safeCellPadding.bottom}px ${safeCellPadding.left}px;
      border-bottom: ${safeBorders.horizontalWidth}px solid ${safeBorders.outerColor};
      border-left: ${safeBorders.verticalWidth}px solid rgba(255,255,255,0.15);
      text-align: center;
    }

    tbody.table-body tr {
      border-bottom: ${safeBorders.horizontalWidth}px solid ${safeBorders.horizontalColor};
    }

    tbody.table-body td {
      padding: ${safeCellPadding.top}px ${safeCellPadding.right}px ${safeCellPadding.bottom}px ${safeCellPadding.left}px;
      vertical-align: ${table.verticalAlignment || 'middle'};
      border-left: ${safeBorders.verticalWidth}px solid ${safeBorders.verticalColor};
    }

    /* Element specific styling */
    .product-img-box {
      width: ${safeImage.width}px;
      height: ${safeImage.height}px;
      border: ${safeImage.borderWidth}px solid ${safeImage.borderColor};
      border-radius: ${safeImage.borderRadius}px;
      background-color: ${safeImage.background};
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin: 0 auto;
    }

    .product-img-box img {
      width: 100%;
      height: 100%;
      object-fit: ${safeImage.fitMode};
      image-rendering: -webkit-optimize-contrast;
    }

    .img-placeholder {
      font-size: 8pt;
      color: #94a3b8;
      text-align: center;
      padding: 4px;
    }

    .product-name {
      font-family: '${typography.productName.fontFamily}', sans-serif;
      font-size: ${typography.productName.fontSize}pt;
      font-weight: ${typography.productName.fontWeight};
      color: ${typography.productName.color};
      line-height: ${typography.productName.lineHeight};
      margin-bottom: 3px;
    }

    .product-desc {
      font-family: '${typography.description.fontFamily}', sans-serif;
      font-size: ${typography.description.fontSize}pt;
      font-weight: ${typography.description.fontWeight};
      color: ${typography.description.color};
      line-height: ${typography.description.lineHeight};
    }

    .product-price {
      font-family: '${price.fontFamily || typography.price.fontFamily}', sans-serif;
      font-size: ${price.fontSize || typography.price.fontSize}pt;
      font-weight: ${price.fontWeight || typography.price.fontWeight};
      color: ${price.color || typography.price.color};
      text-align: ${price.alignment};
      white-space: nowrap;
    }

    .product-barcode {
      font-family: '${barcode.fontFamily || typography.barcode.fontFamily}', monospace, sans-serif;
      font-size: ${barcode.fontSize || typography.barcode.fontSize}pt;
      color: ${barcode.color || typography.barcode.color};
      letter-spacing: ${barcode.letterSpacing || 1}px;
      text-align: ${barcode.alignment};
      white-space: nowrap;
      direction: ltr;
      display: inline-block;
    }

    .product-tag {
      display: inline-block;
      font-family: '${typography.category.fontFamily}', sans-serif;
      font-size: ${typography.category.fontSize}pt;
      font-weight: ${typography.category.fontWeight};
      color: ${typography.category.color};
      background: #f1f5f9;
      border-radius: 4px;
      padding: 2px 6px;
      margin-bottom: 3px;
    }

    .product-ref {
      font-family: '${typography.internalReference.fontFamily}', monospace;
      font-size: ${typography.internalReference.fontSize}pt;
      color: ${typography.internalReference.color};
      direction: ltr;
    }

    .stock-badge {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      border-radius: 4px;
      padding: 2px 6px;
    }
    .stock-zero {
      background: #fee2e2;
      color: #b91c1c;
    }
    .stock-low {
      background: #fef3c7;
      color: #b45309;
    }
    .stock-good {
      background: #dcfce7;
      color: #15803d;
    }

    /* Cards Layout */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      width: 100%;
    }

    .product-card {
      border: ${safeBorders.outerWidth}px solid ${safeBorders.outerColor};
      border-radius: 8px;
      padding: 10px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .category-header-row {
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
    }
    .category-header-cell {
      padding: 7px 14px;
      font-weight: 700;
      border-top: 2px solid #0284c7;
      border-bottom: 1px solid #cbd5e1;
    }
    .category-card-banner {
      grid-column: 1 / -1;
      border-radius: 8px;
      padding: 8px 14px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-after: avoid !important;
      break-after: avoid !important;
      box-sizing: border-box;
      margin-top: 4px;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  ${
    isSingleLongPage
      ? `
      <!-- Single Continuous Long Page Mode -->
      <div class="catalog-long-page" id="long-page-catalog">
        ${renderHeader(1)}
        <div style="width: 100%; flex: 1;">
          ${
            template.layoutType === 'cards'
              ? renderCards(processedProducts)
              : `<table class="catalog-table">
                  <thead class="table-header">
                    <tr>
                      ${table.columns
                        .filter((c) => c.visible)
                        .map((col) => `<th style="width: ${col.width}%; text-align: ${col.alignment || (col.key === 'name' ? 'right' : 'center')};">${col.label}</th>`)
                        .join('')}
                    </tr>
                  </thead>
                  <tbody class="table-body">
                    ${renderTableRows(processedProducts, 0)}
                  </tbody>
                </table>`
          }
        </div>
        ${renderFooter(1)}
      </div>`
      : isContinuous
      ? `
      <!-- Continuous Flow Mode -->
      <div style="width: 100%;">
        ${renderHeader(1)}
        ${
          template.layoutType === 'cards'
            ? renderCards(processedProducts)
            : `<table class="catalog-table">
                <thead class="table-header">
                  <tr>
                    ${table.columns
                      .filter((c) => c.visible)
                      .map((col) => `<th style="width: ${col.width}%; text-align: ${col.alignment || (col.key === 'name' ? 'right' : 'center')};">${col.label}</th>`)
                      .join('')}
                  </tr>
                </thead>
                <tbody class="table-body">
                  ${renderTableRows(processedProducts, 0)}
                </tbody>
              </table>`
        }
        ${renderFooter(1)}
      </div>`
      : `
      <!-- Discrete Exact 1:1 Studio Preview Mode -->
      ${pagesToRender
        .map(({ pageIndex, products: pageChunk }) => {
          const pageNumber = pageIndex + 1;
          return `
          <div class="catalog-page" id="page-${pageNumber}" data-page="${pageNumber}">
            <div class="catalog-page-body">
              ${renderHeader(pageNumber)}
              ${
                pageChunk.length === 0
                  ? `<div style="padding: 40px; text-align: center; color: #94a3b8;">لا توجد منتجات في هذه الصفحة</div>`
                  : template.layoutType === 'cards'
                  ? renderCards(pageChunk)
                  : `<table class="catalog-table">
                      <thead class="table-header">
                        <tr>
                          ${table.columns
                            .filter((c) => c.visible)
                            .map((col) => `<th style="width: ${col.width}%; text-align: ${col.alignment || (col.key === 'name' ? 'right' : 'center')};">${col.label}</th>`)
                            .join('')}
                        </tr>
                      </thead>
                      <tbody class="table-body">
                        ${renderTableRows(pageChunk, pageIndex * itemsPerPage)}
                      </tbody>
                    </table>`
              }
            </div>
            ${renderFooter(pageNumber)}
          </div>`;
        })
        .join('')}
    `
  }
</body>
</html>`;
}
