import { hardenPuppeteerPage, readJsonBody, errorResponse } from '@/lib/security/server';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { CustomerOrderPayload } from '@/types';
import { sanitizeOrderPayload } from '@/lib/security/orderPayload';
import { HttpError } from '@/lib/security/server';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num;
  return n.toLocaleString('en-US');
}

function formatArabicDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  return date.toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function generateCustomerOrderHtml(payload: CustomerOrderPayload): string {
  const { customerInfo, items, catalogTitle, totalItems, totalQuantity, totalAmount, currency, createdAt, pricingTier } = payload;
  const orderDate = formatArabicDate(createdAt);
  const orderRef = `ORD-${Date.now().toString().slice(-6)}`;
  const tierLabel = 'سعر الجملة';

  const rowsHtml = items
    .map((item, index) => {
      const imgHtml = item.imageData
        ? `<img src="${item.imageData}" alt="" style="width: 44px; height: 44px; object-fit: contain; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; display: block; margin: 0 auto;" />`
        : `<div style="width: 44px; height: 44px; border-radius: 8px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 10px; margin: 0 auto;">بدون صورة</div>`;

      const retailVal = item.retailPrice || item.unitPrice;
      const wholesaleVal = item.wholesalePrice || item.unitPrice;
      const isWholesaleActive = pricingTier !== 'retail';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; ${index % 2 === 1 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;'}">
          <td style="padding: 10px 6px; text-align: center; font-weight: bold; color: #64748b; font-size: 11px;">
            ${index + 1}
          </td>
          <td style="padding: 10px 6px; text-align: center; width: 52px;">
            ${imgHtml}
          </td>
          <td style="padding: 10px 10px; text-align: right;">
            <div style="font-weight: 700; color: #0f172a; font-size: 12px; line-height: 1.4;">${item.name}</div>
            ${item.description ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 2px; line-height: 1.35; max-height: 2.7em; overflow: hidden;">${item.description}</div>` : ''}
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 3px; font-size: 9.5px;">
              ${item.barcode ? `<span style="font-family: monospace; color: #0f172a; background: #f1f5f9; padding: 1px 5px; border-radius: 4px; border: 1px solid #cbd5e1;">الباركود: <b>${item.barcode}</b></span>` : ''}
              ${item.internalReference ? `<span style="color: #64748b;">المرجع: <b style="font-family: monospace;">${item.internalReference}</b></span>` : ''}
            </div>
          </td>
          <td style="padding: 10px 6px; text-align: center; color: #475569; font-size: 11px;">
            <span style="background: #e2e8f0; color: #334155; padding: 2px 6px; border-radius: 6px; font-weight: 600; font-size: 10px;">
              ${item.category || 'عام'}
            </span>
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 600; color: #475569; font-size: 11px; white-space: nowrap;">
            ${formatNumber(retailVal)} <span style="font-size: 9px; color: #94a3b8;">${currency}</span>
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: #01334e; font-size: 12px; white-space: nowrap;">
            ${formatNumber(wholesaleVal)} <span style="font-size: 9px; color: #64748b;">${currency}</span>
          </td>
          <td style="padding: 10px 6px; text-align: center; white-space: nowrap;">
            <span style="display: inline-block; background: #01334e; color: #ffffff; font-weight: 800; font-size: 13px; padding: 3px 10px; border-radius: 8px; border: 1px solid #012336;">
              ${item.requestedQuantity}
            </span>
          </td>
          <td style="padding: 10px 10px; text-align: left; font-weight: 800; color: #0f172a; font-size: 13px; white-space: nowrap;">
            ${formatNumber(item.subtotal)} <span style="font-size: 10px; color: #64748b;">${currency}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>طلبية زبون - ${customerInfo.name || 'عميل'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    }
    body {
      background: #ffffff;
      color: #0f172a;
      padding: 24px 28px;
      font-size: 12px;
      line-height: 1.5;
    }
    @page {
      size: A4 portrait;
      margin: 15mm 10mm 15mm 10mm;
    }
    .header-card {
      background: linear-gradient(135deg, #01334e 0%, #012336 100%);
      border-radius: 16px;
      padding: 20px 24px;
      color: #ffffff;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #023c5c;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #cbd5e1;
      margin-top: 2px;
      font-weight: 600;
    }
    .order-badge {
      background: #ffffff;
      color: #01334e;
      font-weight: 900;
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 10px;
      display: inline-block;
      margin-bottom: 6px;
    }
    .order-meta {
      font-size: 11px;
      color: #cbd5e1;
      text-align: left;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 2fr 1.2fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .customer-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 18px;
    }
    .summary-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .box-title {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .info-label {
      color: #64748b;
      font-weight: 600;
    }
    .info-value {
      font-weight: 700;
      color: #0f172a;
    }
    .table-container {
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      background: #01334e;
      color: #ffffff;
      font-weight: 800;
      font-size: 11px;
      padding: 10px 8px;
      text-align: center;
      border-left: 1px solid #023c5c;
    }
    thead th:last-child {
      border-left: none;
    }
    .notes-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 11px;
      color: #92400e;
    }
    .footer-bar {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- Top Header Card -->
  <div class="header-card">
    <div>
      <div class="brand-title">${catalogTitle || 'E-Zone Iraq'}</div>
      <div class="brand-subtitle">طلبية سلة المنتجات للزبون • كشف أسعار وكميات (مفرد وجملة)</div>
    </div>
    <div style="text-align: left;">
      <div class="order-badge">طلبية شراء معتمدة</div>
      <div class="order-meta">كود الطلبية: <strong style="font-family: monospace; color: #ffffff;">${orderRef}</strong></div>
      <div class="order-meta">${orderDate}</div>
    </div>
  </div>

  <!-- Info Grid -->
  <div class="info-grid">
    <!-- Customer Info -->
    <div class="customer-box">
      <div class="box-title">بيانات الزبون / المتجر</div>
      <div class="info-row">
        <span class="info-label">اسم الزبون / الشركة:</span>
        <span class="info-value" style="font-size: 13px; color: #0284c7;">${customerInfo.name || 'عميل نقدي'}</span>
      </div>
      ${customerInfo.phone ? `
      <div class="info-row">
        <span class="info-label">رقم الهاتف / الواتساب:</span>
        <span class="info-value" style="direction: ltr; font-family: monospace;">${customerInfo.phone}</span>
      </div>` : ''}
      ${customerInfo.address ? `
      <div class="info-row">
        <span class="info-label">عنوان التوصيل / المدينة:</span>
        <span class="info-value">${customerInfo.address}</span>
      </div>` : ''}
      <div class="info-row">
        <span class="info-label">نوع التسعير المعتمد:</span>
        <span class="info-value" style="color: #0284c7; font-weight: 800;">${tierLabel}</span>
      </div>
    </div>

    <!-- Quick Financial Summary -->
    <div class="summary-box">
      <div class="box-title" style="color: #166534; border-color: #bbf7d0;">ملخص الحساب</div>
      <div class="info-row">
        <span class="info-label">عدد المواد المختلفة:</span>
        <span class="info-value">${totalItems} مادة</span>
      </div>
      <div class="info-row">
        <span class="info-label">إجمالي عدد القطع:</span>
        <span class="info-value" style="color: #047857; font-size: 14px;">${totalQuantity} قطعة</span>
      </div>
      <div class="info-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #bbf7d0;">
        <span class="info-label" style="font-weight: 800; color: #0f172a;">المبلغ الإجمالي (${tierLabel}):</span>
        <span class="info-value" style="font-size: 15px; font-weight: 900; color: #0f172a;">
          ${formatNumber(totalAmount)} <span style="font-size: 10px;">${currency}</span>
        </span>
      </div>
    </div>
  </div>

  <!-- Notes if available -->
  ${customerInfo.notes ? `
  <div class="notes-card">
    <strong>ملاحظات الطلبية:</strong> ${customerInfo.notes}
  </div>` : ''}

  <!-- Order Table -->
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th style="width: 52px;">الصورة</th>
          <th style="text-align: right; padding-right: 10px;">اسم المنتج والمواصفات</th>
          <th style="width: 90px;">الفئة</th>
          <th style="width: 90px; color: #cbd5e1;">سعر المفرد</th>
          <th style="width: 95px; color: #ffffff; font-weight: 900;">سعر الجملة</th>
          <th style="width: 75px;">الكمية</th>
          <th style="width: 105px; text-align: left; padding-left: 10px;">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #01334e; color: #ffffff; font-weight: 800;">
          <td colspan="6" style="padding: 12px 16px; text-align: right; font-size: 13px;">
            الإجمالي النهائي للطلبية (${totalItems} مادة مختارة بحساب ${tierLabel}):
          </td>
          <td style="padding: 12px 8px; text-align: center; font-size: 14px; color: #ffffff; font-weight: 900;">
            ${totalQuantity} قطعة
          </td>
          <td style="padding: 12px 14px; text-align: left; font-size: 15px; color: #ffffff; font-weight: 900; white-space: nowrap;">
            ${formatNumber(totalAmount)} ${currency}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer-bar">
    <div>تم استخراج ملف الطلبية تلقائياً عبر منصة الكتالوج التفاعلية • E-Zone Iraq</div>
    <div>تاريخ وتوقيت الإصدار: ${new Date().toLocaleString('ar-IQ')}</div>
  </div>

</body>
</html>
  `;
}

export async function POST(req: NextRequest) {
  const uniqueUserDataDir = `/tmp/puppeteer_order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  let browser: any = null;

  try {
    // Public endpoint: validate + HTML-escape every field before rendering
    const raw = await readJsonBody(req, 30 * 1024 * 1024);
    const payload: CustomerOrderPayload = sanitizeOrderPayload(raw, { escape: true });

    const html = generateCustomerOrderHtml(payload);
    const chromePath =
      process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: ['load', 'networkidle0'] });
    await page.evaluateHandle('document.fonts.ready');

    // Wait for product images if any
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

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });

    await browser.close();
    browser = null;

    try {
      if (fs.existsSync(uniqueUserDataDir)) {
        fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
      }
    } catch {}

    const safeName = (payload.customerInfo?.name || 'Customer').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
    const filename = `Order_${safeName}_${Date.now()}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    if (!(error instanceof HttpError)) logger.error('Customer Order PDF Generation Error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    try {
      if (fs.existsSync(uniqueUserDataDir)) {
        fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
      }
    } catch {}

    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Public endpoint: do not leak internal error details
    return NextResponse.json({ error: 'فشل إنشاء ملف PDF للطلبية' }, { status: 500 });
  }
}
