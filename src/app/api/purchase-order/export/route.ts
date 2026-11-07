import { hardenPuppeteerPage, readJsonBody, errorResponse } from '@/lib/security/server';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderColumnConfig } from '@/types';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

// ==========================================
// Helper: Filter selected items with quantity
// ==========================================
function getSelectedItems(order: PurchaseOrder): PurchaseOrderItem[] {
  return order.items.filter((item) => item.selected && item.requestedQuantity > 0);
}

// ==========================================
// Helper: Format date in Arabic
// ==========================================
function formatArabicDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

// ==========================================
// XLSX Export
// ==========================================
function generateXlsx(
  order: PurchaseOrder,
  options: { showStock?: boolean; showPrice?: boolean } = {}
): Buffer {
  const selectedItems = getSelectedItems(order);
  const design = order.design;
  const wb = XLSX.utils.book_new();

  const titleText = design?.orderTitle || `طلبية مورد: ${order.supplierName}`;
  const titleRow = [titleText];
  const dateRow = [`التاريخ: ${formatArabicDate(order.createdAt)}`];
  const summaryRow = [
    `عدد المنتجات: ${selectedItems.length}`,
    '',
    `إجمالي الكمية المطلوبة: ${selectedItems.reduce((sum, i) => sum + i.requestedQuantity, 0)} قطعة`,
  ];
  const emptyRow: string[] = [];

  let columnHeaders: string[] = [];
  let colsWidths: { wch: number }[] = [];
  let visibleColumns: PurchaseOrderColumnConfig[] = [];

  if (design && design.columns && design.columns.length > 0) {
    visibleColumns = [...design.columns]
      .filter((c) => c.visible && c.key !== 'image')
      .sort((a, b) => a.order - b.order);

    columnHeaders = visibleColumns.map((c) => c.label);
    colsWidths = visibleColumns.map((c) => {
      if (c.key === 'productName') return { wch: 38 };
      if (c.key === 'requestedQuantity') return { wch: 22 };
      if (c.key === 'barcode') return { wch: 18 };
      if (c.key === 'index') return { wch: 6 };
      if (c.key === 'notes') return { wch: 26 };
      return { wch: 16 };
    });
  } else {
    const showStock = Boolean(options.showStock);
    const showPrice = Boolean(options.showPrice);

    columnHeaders = ['#', 'اسم المنتج', 'الباركود', 'الكمية المطلوبة (العدد)', 'الفئة', 'المرجع الداخلي'];
    colsWidths = [{ wch: 5 }, { wch: 38 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 18 }];

    if (showStock) {
      columnHeaders.push('الكمية في المخزن');
      colsWidths.push({ wch: 16 });
    }
    if (showPrice) {
      columnHeaders.push('السعر');
      colsWidths.push({ wch: 14 });
    }
    columnHeaders.push('ملاحظات');
    colsWidths.push({ wch: 25 });
  }

  // Build data rows
  const dataRows = selectedItems.map((item, idx) => {
    if (visibleColumns.length > 0) {
      return visibleColumns.map((col) => {
        switch (col.key) {
          case 'index':
            return idx + 1;
          case 'productName':
            return item.productName;
          case 'barcode':
            return item.barcode || '';
          case 'requestedQuantity':
            return item.requestedQuantity;
          case 'category':
            return item.category || '';
          case 'internalReference':
            return item.internalReference || '';
          case 'currentStock':
            return item.currentStock;
          case 'customerPrice': {
            const num = typeof item.customerPrice === 'number' ? item.customerPrice : parseFloat(item.customerPrice) || 0;
            return num;
          }
          case 'notes':
            return item.notes || '';
          default:
            return '';
        }
      });
    }

    // Default fallback rows
    const row: (string | number)[] = [
      idx + 1,
      item.productName,
      item.barcode || '',
      item.requestedQuantity,
      item.category || '',
      item.internalReference || '',
    ];

    if (options.showStock) row.push(item.currentStock);
    if (options.showPrice) {
      const priceVal = typeof item.customerPrice === 'number' ? item.customerPrice : parseFloat(item.customerPrice) || 0;
      row.push(priceVal);
    }
    row.push(item.notes || '');
    return row;
  });

  // Combine all rows
  const allRows = [titleRow, dateRow, summaryRow, emptyRow, columnHeaders, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  ws['!cols'] = colsWidths;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnHeaders.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columnHeaders.length - 1 } },
  ];
  ws['!RTL'] = true;

  XLSX.utils.book_append_sheet(wb, ws, 'طلبية المورد');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

// ==========================================
// PDF HTML Template
// ==========================================
function generatePurchaseOrderHtml(
  order: PurchaseOrder,
  options: { showStock?: boolean; showPrice?: boolean } = {}
): string {
  const selectedItems = getSelectedItems(order);
  const totalQuantity = selectedItems.reduce((sum, i) => sum + i.requestedQuantity, 0);
  const dateStr = formatArabicDate(order.createdAt);
  const design = order.design;

  // Custom design values or defaults
  const headerBg = design?.headerBackground || '#0f172a';
  const headerText = design?.headerTextColor || '#ffffff';
  const altRowBg = design?.alternateRowBackground || '#f8fafc';
  const fontSize = design?.fontSize === 'small' ? '11px' : design?.fontSize === 'large' ? '14px' : '12px';
  const cellPadding =
    design?.rowPadding === 'compact' ? '5px 6px' : design?.rowPadding === 'relaxed' ? '10px 12px' : '7px 8px';
  const imgSize = design?.imageSize === 'small' ? '36px' : design?.imageSize === 'large' ? '56px' : '44px';
  const imgFit = design?.imageFit || 'contain';
  const highlightQty = design?.highlightQuantity !== false;

  const orderTitle = design?.orderTitle || `طلبية شراء مواد - ${order.supplierName}`;
  const companyName = design?.companyName || 'شركة E-ZONE للتجارة';
  const companySubtitle = design?.companySubtitle || 'طلب شراء واستيراد رسمي';
  const footerNotes = design?.footerNotes || order.notes || '';

  // Determine active columns
  let activeColumns: PurchaseOrderColumnConfig[] = [];
  if (design && design.columns && design.columns.length > 0) {
    activeColumns = [...design.columns].filter((c) => c.visible).sort((a, b) => a.order - b.order);
  } else {
    const showStock = Boolean(options.showStock);
    const showPrice = Boolean(options.showPrice);
    activeColumns = [
      { id: '1', key: 'index', label: '#', width: 4, visible: true, alignment: 'center', order: 0 },
      { id: '2', key: 'image', label: 'صورة', width: 8, visible: true, alignment: 'center', order: 1 },
      { id: '3', key: 'productName', label: 'اسم المنتج', width: 36, visible: true, alignment: 'right', order: 2 },
      { id: '4', key: 'barcode', label: 'الباركود', width: 16, visible: true, alignment: 'center', order: 3 },
      { id: '5', key: 'requestedQuantity', label: 'الكمية المطلوبة (العدد)', width: 14, visible: true, alignment: 'center', order: 4 },
      { id: '6', key: 'category', label: 'الفئة', width: 10, visible: false, alignment: 'center', order: 5 },
      { id: '7', key: 'internalReference', label: 'المرجع الداخلي', width: 10, visible: false, alignment: 'center', order: 6 },
    ];
    if (showStock) {
      activeColumns.push({ id: '8', key: 'currentStock', label: 'المخزون الحالي', width: 10, visible: true, alignment: 'center', order: 7 });
    }
    if (showPrice) {
      activeColumns.push({ id: '9', key: 'customerPrice', label: 'السعر', width: 10, visible: true, alignment: 'center', order: 8 });
    }
    activeColumns.push({ id: '10', key: 'notes', label: 'ملاحظات', width: 12, visible: true, alignment: 'right', order: 9 });
  }

  // Build the table header HTML
  const theadHtml = activeColumns
    .map((col) => {
      const isQty = col.key === 'requestedQuantity';
      const bg = isQty && highlightQty ? '#d97706' : headerBg;
      return `<th style="width:${col.width}%; text-align:${col.alignment}; background:${bg}; color:#fff;">${col.label}</th>`;
    })
    .join('');

  // Build table rows HTML
  const itemRows = selectedItems
    .map((item, idx) => {
      const isEven = idx % 2 === 1;
      const rowBg = isEven ? altRowBg : '#ffffff';

      const cells = activeColumns
        .map((col) => {
          let content = '';
          let customClass = '';
          let cellStyle = `text-align:${col.alignment}; padding:${cellPadding};`;

          switch (col.key) {
            case 'index':
              content = `<span class="num" style="color:#64748b; font-weight:bold;">${idx + 1}</span>`;
              break;

            case 'image':
              content = item.imageData && item.imageStatus === 'valid'
                ? `<div class="img-wrapper"><img src="${item.imageData}" alt="${item.productName}" /></div>`
                : `<div class="no-image">لا توجد صورة</div>`;
              break;

            case 'productName':
              content = `<div class="p-name">${item.productName}</div>`;
              break;

            case 'barcode':
              content = `<span class="barcode-num">${item.barcode || '—'}</span>`;
              break;

            case 'requestedQuantity':
              if (highlightQty) {
                content = `<span class="qty-highlight">${item.requestedQuantity}</span>`;
              } else {
                content = `<strong class="num">${item.requestedQuantity}</strong>`;
              }
              break;

            case 'category':
              content = `<span class="tag">${item.category || 'عام'}</span>`;
              break;

            case 'internalReference':
              content = `<span class="ref-num">${item.internalReference || '—'}</span>`;
              break;

            case 'currentStock':
              content = `<span class="num">${item.currentStock}</span>`;
              break;

            case 'customerPrice': {
              const price =
                typeof item.customerPrice === 'number'
                  ? item.customerPrice.toLocaleString('en-US')
                  : item.customerPrice || '—';
              content = `<span class="num font-bold">${price}</span>`;
              break;
            }

            case 'notes':
              content = `<span class="notes-text">${item.notes || '—'}</span>`;
              break;

            default:
              content = '';
          }

          return `<td style="${cellStyle}">${content}</td>`;
        })
        .join('');

      return `<tr style="background:${rowBg};">${cells}</tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${orderTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Inter:wght@400;600;700;800&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
      direction: rtl;
      background: #fff;
      color: #0f172a;
      padding: 20px 24px;
      font-size: ${fontSize};
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 2px solid ${headerBg};
      margin-bottom: 16px;
    }

    .header-right .sub-title {
      font-size: 11px;
      font-weight: 700;
      color: #d97706;
      background: #fef3c7;
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 4px;
    }

    .header-right h1 {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .header-right .company-info {
      font-size: 12px;
      color: #475569;
    }

    .header-right .supplier-tag {
      font-weight: 700;
      color: #0369a1;
    }

    .header-left {
      text-align: left;
      font-size: 11px;
      color: #64748b;
      font-family: 'Inter', sans-serif;
    }

    .header-left .date {
      font-weight: 700;
      color: #0f172a;
      font-size: 12px;
      margin-bottom: 2px;
    }

    .summary-cards {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }

    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
    }

    .summary-card.highlight {
      background: #fef3c7;
      border-color: #fde68a;
      color: #92400e;
    }

    .summary-card strong {
      font-size: 14px;
      font-weight: 800;
      font-family: 'Inter', sans-serif;
      margin-right: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: ${fontSize};
      border: 1px solid #e2e8f0;
    }

    thead th {
      padding: 8px 6px;
      font-weight: 800;
      white-space: nowrap;
      border-bottom: 1px solid rgba(0,0,0,0.15);
    }

    tbody tr {
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }

    tbody td {
      vertical-align: middle;
    }

    .p-name {
      font-weight: 700;
      color: #0f172a;
      line-height: 1.4;
    }

    .barcode-num {
      font-family: 'Courier New', 'Inter', monospace;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      letter-spacing: 0.5px;
    }

    .ref-num {
      font-family: 'Inter', monospace;
      font-size: 10px;
      color: #64748b;
    }

    .tag {
      display: inline-block;
      padding: 2px 6px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 10px;
      color: #475569;
    }

    .num {
      font-family: 'Inter', sans-serif;
    }

    .qty-highlight {
      display: inline-block;
      background: #fef3c7;
      border: 1px solid #fde68a;
      color: #b45309;
      font-family: 'Inter', sans-serif;
      font-weight: 900;
      font-size: 13px;
      padding: 3px 10px;
      border-radius: 6px;
    }

    .img-wrapper {
      width: ${imgSize};
      height: ${imgSize};
      margin: 0 auto;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }

    .img-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: ${imgFit};
    }

    .no-image {
      width: ${imgSize};
      height: ${imgSize};
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      font-size: 8px;
      color: #94a3b8;
    }

    .notes-text {
      color: #64748b;
      font-size: 11px;
    }

    .order-notes {
      margin-top: 14px;
      padding: 10px 14px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      font-size: 11px;
      color: #92400e;
      page-break-inside: avoid;
    }

    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #94a3b8;
      page-break-inside: avoid;
    }

    @media print {
      body { padding: 10px; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-right">
      <div class="sub-title">${companySubtitle}</div>
      <h1>${orderTitle}</h1>
      <div class="company-info">
        الشركة المشترية: <strong>${companyName}</strong> &bull; المورد: <span class="supplier-tag">${order.supplierName}</span>
      </div>
    </div>
    <div class="header-left">
      <div class="date">${dateStr}</div>
      <div>PO Ref: #${order.id?.slice(0, 8) || 'PO-2026'}</div>
    </div>
  </div>

  ${
    design?.showSummaryCards !== false
      ? `
  <div class="summary-cards">
    <div class="summary-card">عدد الأصناف المطلوبة: <strong>${selectedItems.length}</strong></div>
    <div class="summary-card highlight">إجمالي الكمية المطلوبة: <strong>${totalQuantity} قطعة</strong></div>
    <div class="summary-card">المورد المعتمد: <strong>${order.supplierName}</strong></div>
  </div>
  `
      : ''
  }

  <table>
    <thead>
      <tr>
        ${theadHtml}
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  ${
    footerNotes
      ? `
  <div class="order-notes">
    <strong>شروط وملاحظات الطلبية:</strong> ${footerNotes}
  </div>
  `
      : ''
  }

  <div class="footer">
    <span>تم إنشاء هذه الطلبية بواسطة E-zone &bull; استوديو طلبيات الموردين</span>
    <span>تاريخ الطباعة: ${dateStr}</span>
  </div>
</body>
</html>`;
}

// ==========================================
// Main POST Handler
// ==========================================
export async function POST(req: NextRequest) {
  const uniqueUserDataDir = `/tmp/puppeteer_po_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  let browser: any = null;

  try {
    const body = await readJsonBody(req, 50 * 1024 * 1024);
    const { order, format, options } = body as {
      order: PurchaseOrder;
      format: 'xlsx' | 'pdf';
      options?: {
        showStock?: boolean;
        showPrice?: boolean;
      };
    };

    if (!order || !order.items) {
      return NextResponse.json(
        { error: 'بيانات الطلبية مفقودة' },
        { status: 400 }
      );
    }

    const exportOptions = {
      showStock: Boolean(options?.showStock),
      showPrice: Boolean(options?.showPrice),
    };

    // ==========================================
    // XLSX Export
    // ==========================================
    if (format === 'xlsx') {
      const buffer = generateXlsx(order, exportOptions);
      const filename = `طلبية_${order.supplierName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-cache',
        },
      });
    }

    // ==========================================
    // PDF Export
    // ==========================================
    if (format === 'pdf') {
      const html = generatePurchaseOrderHtml(order, exportOptions);

      const chromePath =
        process.env.CHROME_PATH ||
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

      try {
        browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-crash-reporter',
            '--disable-features=Crashpad',
            `--user-data-dir=${uniqueUserDataDir}`,
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-sync',
            '--no-first-run',
            '--font-render-hinting=none',
          ],
        });

        const page = await browser.newPage();
      await hardenPuppeteerPage(page);

        const isLandscape = order.design?.orientation === 'landscape';
        const isSingleLongPage = order.design?.pageSize === 'single_long_page';

        await page.setViewport({
          width: isLandscape ? 1400 : 1100,
          height: 900,
          deviceScaleFactor: 2,
        });

        await page.setContent(html, {
          waitUntil: ['load', 'networkidle0'],
        });

        // Wait for Arabic web fonts and images to load
        await page.evaluateHandle('document.fonts.ready');
        await page.evaluate(async () => {
          const imgs = Array.from(document.querySelectorAll('img'));
          await Promise.all(
            imgs.map((img) => {
              if (img.complete) return Promise.resolve();
              return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              });
            })
          );
        });

        let pdfBuffer: Buffer;

        if (isSingleLongPage) {
          // Calculate page content height for continuous long page
          const bodyHeightPx = await page.evaluate(() => document.body.scrollHeight);
          const heightMm = Math.max(297, Math.ceil(bodyHeightPx * 0.264583) + 20);

          pdfBuffer = await page.pdf({
            width: isLandscape ? '297mm' : '210mm',
            height: `${heightMm}mm`,
            printBackground: true,
            pageRanges: '1',
            displayHeaderFooter: false,
            margin: {
              top: '10mm',
              right: '10mm',
              bottom: '10mm',
              left: '10mm',
            },
          });
        } else {
          pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: isLandscape,
            printBackground: true,
            displayHeaderFooter: false,
            margin: {
              top: '12mm',
              right: '10mm',
              bottom: '12mm',
              left: '10mm',
            },
          });
        }

        await browser.close();
        browser = null;
        try {
          fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
        } catch (_) {}

        const filename = `طلبية_${order.supplierName}_${new Date().toISOString().slice(0, 10)}.pdf`;

        return new NextResponse(pdfBuffer as any, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Cache-Control': 'no-cache',
          },
        });
      } catch (puppeteerErr: any) {
        if (browser) {
          await browser.close().catch(() => {});
          browser = null;
        }
        try {
          fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
        } catch (_) {}
        logger.warn('Puppeteer error in purchase order PDF:', puppeteerErr);
        return NextResponse.json(
          {
            fallbackHtml: html,
            message: 'فشل تشغيل محرك تحويل PDF من الخادم',
            error: puppeteerErr.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'صيغة التصدير غير مدعومة. استخدم xlsx أو pdf' },
      { status: 400 }
    );
  } catch (error: any) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    try {
      fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
    } catch (_) {}
    logger.error('Purchase order export error:', error);
    return NextResponse.json(
      { error: error.message || 'فشل تصدير الطلبية' },
      { status: 500 }
    );
  }
}
