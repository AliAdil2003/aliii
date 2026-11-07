import { hardenPuppeteerPage, readJsonBody, errorResponse } from '@/lib/security/server';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { generateCatalogHtml } from '@/lib/pdf/htmlTemplate';
import { getPageDimensions } from '@/lib/pdf/pageLayout';
import { CatalogTemplate, Product, PDFExportOptions } from '@/types';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const uniqueUserDataDir = `/tmp/puppeteer_catalog_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  let browser: any = null;

  try {
    const body = await readJsonBody(req, 50 * 1024 * 1024);
    const { products, template, options } = body as {
      products: Product[];
      template: CatalogTemplate;
      options: PDFExportOptions;
    };

    if (!products || !template) {
      return NextResponse.json({ error: 'بيانات المنتجات أو القالب مفقودة' }, { status: 400 });
    }

    const html = generateCatalogHtml(products, template, options);

    // Chrome executable path on macOS
    const chromePath =
      process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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

      // Page dimensions
      const { widthMm, heightMm, widthPx, heightPx } = getPageDimensions(template.page);
      const isLandscape = (options.orientation || template.page.orientation) === 'landscape';
      const isContinuous = options.exportMode === 'continuous_flow';
      const isSingleLongPage = options.exportMode === 'single_long_page';

      // Set viewport matching the real-life 96-DPI dimensions with high-density scale (2x or 3x for 300 DPI)
      const scaleFactor = options.quality === 'print_300dpi' ? 3 : 2;
      await page.setViewport({
        width: widthPx,
        height: isSingleLongPage ? 2000 : heightPx,
        deviceScaleFactor: scaleFactor,
      });

      await page.setContent(html, {
        waitUntil: ['load', 'networkidle0'],
      });

      // Wait for Arabic and Latin web fonts and images to be completely loaded
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

      // If single long page mode, calculate the exact pixel height and convert to mm
      let effectiveHeightMm = heightMm;
      if (isSingleLongPage) {
        const contentHeightPx = await page.evaluate(() => {
          const el = document.querySelector('.catalog-long-page') || document.body;
          const rect = el.getBoundingClientRect();
          return Math.ceil(Math.max(rect.height, el.scrollHeight, document.body.scrollHeight));
        });
        // Convert px (96 DPI) to mm, add a small 4mm buffer to prevent page spill
        effectiveHeightMm = Math.ceil((contentHeightPx * 25.4) / 96) + 4;
      }

      // 1. High-Res PNG Image Export Mode
      if (options.exportFormat === 'png_image') {
        let imageBuffer: Buffer | Uint8Array;
        const targetPageSelector = isSingleLongPage
          ? '.catalog-long-page'
          : options.pageIndex
          ? `#page-${options.pageIndex}`
          : '.catalog-page';
        const pageEl = await page.$(targetPageSelector);

        if (pageEl) {
          imageBuffer = await pageEl.screenshot({ type: 'png' });
        } else {
          imageBuffer = await page.screenshot({ fullPage: true, type: 'png' });
        }

        await browser.close();
        browser = null;
        try {
          fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
        } catch (_) {}

        const filename = `${options.filename || 'catalog_page'}${
          isSingleLongPage ? '_صفحة_طويلة' : options.pageIndex ? `_p${options.pageIndex}` : ''
        }.png`;

        return new NextResponse(imageBuffer as any, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Cache-Control': 'no-cache',
          },
        });
      }

      // 2. Exact Studio 1:1 or Single Long Page PDF Export Mode
      const pdfBuffer = await page.pdf({
        width: `${widthMm}mm`,
        height: `${effectiveHeightMm}mm`,
        landscape: isLandscape,
        printBackground: true,
        preferCSSPageSize: !isSingleLongPage,
        displayHeaderFooter: false,
        pageRanges: isSingleLongPage ? '1' : undefined,
        margin: isContinuous
          ? {
              top: `${template.page.margins.top}mm`,
              right: `${template.page.margins.right}mm`,
              bottom: `${template.page.margins.bottom}mm`,
              left: `${template.page.margins.left}mm`,
            }
          : { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });

      await browser.close();
      browser = null;
      try {
        fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
      } catch (_) {}

      const filename = `${options.filename || 'catalog'}${isSingleLongPage ? '_صفحة_طويلة' : ''}.pdf`;
      const widthCm = (widthMm / 10).toFixed(1);
      const heightCm = (effectiveHeightMm / 10).toFixed(1);

      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-cache',
          'X-Catalog-Width-Mm': String(widthMm),
          'X-Catalog-Height-Mm': String(effectiveHeightMm),
          'X-Catalog-Width-Cm': widthCm,
          'X-Catalog-Height-Cm': heightCm,
          'X-Catalog-Dimensions-Text': encodeURIComponent(`${widthCm} × ${heightCm} سم`),
          'Access-Control-Expose-Headers':
            'X-Catalog-Width-Mm, X-Catalog-Height-Mm, X-Catalog-Width-Cm, X-Catalog-Height-Cm, X-Catalog-Dimensions-Text',
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
      logger.warn('Puppeteer error, returning HTML fallback for client print:', puppeteerErr);
      return NextResponse.json(
        {
          fallbackHtml: html,
          message: 'فشل تشغيل محرك تحويل PDF من الخادم',
          error: puppeteerErr.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    try {
      fs.rmSync(uniqueUserDataDir, { recursive: true, force: true });
    } catch (_) {}
    logger.error('PDF generation endpoint error:', error);
    return NextResponse.json({ error: error.message || 'فشل توليد ملف PDF' }, { status: 500 });
  }
}
