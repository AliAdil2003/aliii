import { CatalogTemplate, PageSettings, Product } from '@/types';

export interface PageDimensionInfo {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
}

/**
 * Calculates page dimensions in millimeters and standard 96 DPI screen pixels
 */
export function getPageDimensions(page: PageSettings): PageDimensionInfo {
  const isLandscape = page.orientation === 'landscape';
  let widthMm = 210;
  let heightMm = 297;

  if (page.size === 'A3') {
    widthMm = 297;
    heightMm = 420;
  } else if (page.size === 'A5') {
    widthMm = 148;
    heightMm = 210;
  } else if (page.size === 'letter') {
    widthMm = 215.9;
    heightMm = 279.4;
  } else if (page.size === 'legal') {
    widthMm = 215.9;
    heightMm = 355.6;
  } else if (page.size === 'custom' && page.width && page.height) {
    widthMm = page.width;
    heightMm = page.height;
  }

  // Swap width and height if landscape orientation
  if (isLandscape && page.size !== 'custom') {
    const temp = widthMm;
    widthMm = heightMm;
    heightMm = temp;
  }

  const widthPx = Math.round(widthMm * 3.7795275591);
  const heightPx = Math.round(heightMm * 3.7795275591);

  return { widthMm, heightMm, widthPx, heightPx };
}

/**
 * Calculates the exact number of product items that fit cleanly on each physical page
 * matching the Studio live preview calculation 1:1.
 */
export function calculateItemsPerPage(template: CatalogTemplate): number {
  if (template.layoutType === 'cards') {
    return 6; // 2 columns x 3 rows grid
  }

  const { page, header, footer, table } = template;
  const { heightPx } = getPageDimensions(page);

  const headerHeight = header.enabled ? (header.bannerHeight || header.height || 60) : 0;
  const footerHeight = footer.enabled ? (footer.height || 30) : 0;
  const marginsPx = (page.margins.top + page.margins.bottom) * 3.7795275591;
  const tableHeaderPx = 48; // Table column header height

  const usableHeightPx = heightPx - marginsPx - headerHeight - footerHeight - tableHeaderPx;
  const rowH = Math.max(50, table.rowHeight || 90);

  return Math.max(1, Math.floor(Math.max(300, usableHeightPx) / rowH));
}

/**
 * Slices products into discrete pages
 */
export function chunkProductsIntoPages(
  products: Product[],
  itemsPerPage: number
): Product[][] {
  if (products.length === 0) return [[]];
  const pages: Product[][] = [];
  for (let i = 0; i < products.length; i += itemsPerPage) {
    pages.push(products.slice(i, i + itemsPerPage));
  }
  return pages;
}

export interface CatalogDimensionInfo {
  widthMm: number;
  heightMm: number;
  widthCm: string;
  heightCm: string;
  heightM: string;
  widthPx: number;
  heightPx: number;
  productCount: number;
  pageCount: number;
  isSingleLongPage: boolean;
  dimensionsText: string;
  dimensionsMmText: string;
}

/**
 * Calculates estimated physical dimensions (width, height in cm/mm/meters)
 * for both discrete pages and single long continuous page mode.
 */
export function calculateCatalogDimensions(
  template: CatalogTemplate,
  products: Product[],
  mode: 'single_long_page' | 'exact_studio_preview' | 'continuous_flow' = 'single_long_page'
): CatalogDimensionInfo {
  const activeProducts = products.filter((p) => p.includedInCatalog);
  const pageDims = getPageDimensions(template.page);
  const isSingleLongPage = mode === 'single_long_page';

  if (!isSingleLongPage) {
    const itemsPerPage = calculateItemsPerPage(template);
    const totalPages = Math.max(1, Math.ceil(activeProducts.length / itemsPerPage));
    const widthCm = (pageDims.widthMm / 10).toFixed(1);
    const heightCm = (pageDims.heightMm / 10).toFixed(1);
    return {
      widthMm: pageDims.widthMm,
      heightMm: pageDims.heightMm,
      widthCm,
      heightCm,
      heightM: (pageDims.heightMm / 1000).toFixed(2),
      widthPx: pageDims.widthPx,
      heightPx: pageDims.heightPx,
      productCount: activeProducts.length,
      pageCount: totalPages,
      isSingleLongPage: false,
      dimensionsText: `${widthCm} × ${heightCm} سم`,
      dimensionsMmText: `${pageDims.widthMm} × ${pageDims.heightMm} مم`,
    };
  }

  // Single Long Page calculation
  const { page, header, footer, table } = template;
  const marginsMm = (page.margins?.top || 10) + (page.margins?.bottom || 10);

  // Header height
  let headerHeightPx = 0;
  if (header.enabled) {
    if (header.bannerImage && header.type === 'both') {
      headerHeightPx = (header.bannerHeight || header.height || 70) + 25 + 12;
    } else {
      headerHeightPx = (header.height || 60) + 12;
    }
  }

  // Footer height
  let footerHeightPx = 0;
  if (footer.enabled) {
    if (footer.bannerImage) {
      footerHeightPx = (footer.bannerHeight || 80) + (footer.type === 'both' ? (footer.height || 26) + 12 : 8);
    } else {
      footerHeightPx = (footer.height || 30) + 8;
    }
  }

  // Content height
  let contentHeightPx = 0;
  if (template.layoutType === 'cards') {
    const cols = 2;
    const rows = Math.ceil(activeProducts.length / cols);
    const cardRowHeight = Math.max(120, table.rowHeight || 170);
    const cardGap = 12;
    contentHeightPx = rows * (cardRowHeight + cardGap);
  } else {
    // Table mode
    const tableHeaderPx = 48;
    const rowHeightPx = Math.max(50, table.minRowHeight || table.rowHeight || 90);

    let catHeaderPx = 0;
    if (template.categoryGrouping?.enabled && template.categoryGrouping?.showHeader !== false) {
      const distinctCats = new Set(
        activeProducts.map((p) => (p.category && p.category.trim()) || 'عام')
      );
      catHeaderPx = distinctCats.size * 38;
    }

    contentHeightPx = tableHeaderPx + (activeProducts.length * rowHeightPx) + catHeaderPx;
  }

  const totalPx = headerHeightPx + contentHeightPx + footerHeightPx;
  // Convert px to mm (1 px = 25.4 / 96 mm) + margins + 4mm buffer
  const calculatedHeightMm = Math.ceil((totalPx * 25.4) / 96) + marginsMm + 4;
  const widthMm = pageDims.widthMm;

  const widthCm = (widthMm / 10).toFixed(1);
  const heightCm = (calculatedHeightMm / 10).toFixed(1);
  const heightM = (calculatedHeightMm / 1000).toFixed(2);

  return {
    widthMm,
    heightMm: calculatedHeightMm,
    widthCm,
    heightCm,
    heightM,
    widthPx: pageDims.widthPx,
    heightPx: totalPx,
    productCount: activeProducts.length,
    pageCount: 1,
    isSingleLongPage: true,
    dimensionsText: `${widthCm} × ${heightCm} سم`,
    dimensionsMmText: `${widthMm} × ${calculatedHeightMm} مم`,
  };
}
