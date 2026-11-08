import {
  Product,
  CatalogExcelExportConfig,
  CatalogDiscountMode,
  CatalogExcelExportColumns,
} from '@/types';

export const DEFAULT_EXCEL_COLUMNS: CatalogExcelExportColumns = {
  index: true,
  image: false, // صورة المنتج في الإكسل
  category: true, // فئة المنتج - أساسية دائماً
  name: true,
  barcode: true,
  internalReference: true,
  originalPrice: true, // السعر قبل الخصم
  discountPercent: true, // نسبة الخصم %
  discountAmount: true, // مبلغ الخصم
  finalPrice: true, // السعر بعد الخصم
  salePrice: false, // سعر الجملة / البيع الأساسي
  stock: true,
  unit: false,
  status: false,
  description: false,
  shopifyUrl: false,
};

export const DEFAULT_EXCEL_EXPORT_CONFIG: CatalogExcelExportConfig = {
  projectName: 'كتالوج المنتجات',
  currency: 'د.ع',
  includeSummary: true,
  includeImages: false,
  scope: 'included',
  excludeOutOfStock: false,
  sortByCategory: true,
  discountMode: 'auto',
  fixedDiscountPercent: 10,
  fixedDiscountAmount: 0,
  categoryDiscounts: {},
  columns: DEFAULT_EXCEL_COLUMNS,
};

export interface ProcessedProductRow {
  product: Product;
  index: number;
  category: string;
  name: string;
  barcode: string;
  internalReference: string;
  originalPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  salePrice: number;
  stock: number;
  unit: string;
  status: string;
  description: string;
  shopifyUrl: string;
}

/**
 * تحويل القيمة الرقمية بأمان
 */
export function safeNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * منع ثغرات حقن صيغ الإكسل (CSV/Excel Formula Injection)
 */
export function sanitizeCellValue(val: unknown): string | number {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    return `'${str}`;
  }
  return str;
}

/**
 * حساب قيم الخصم والأسعار لكل منتج وفق النمط المحدد
 */
export function calculateProductDiscount(
  product: Product,
  mode: CatalogDiscountMode,
  options: {
    fixedPercent?: number;
    fixedAmount?: number;
    categoryDiscounts?: Record<string, number>;
  }
): {
  originalPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  salePrice: number;
} {
  const customerPriceVal = safeNumber(product.customerPrice);
  const basePriceVal = safeNumber(product.price);
  const salePriceVal = safeNumber(product.salePrice);

  // السعر الأصلي / سعر الزبون الأساسي
  const originalPrice = customerPriceVal > 0 ? customerPriceVal : (basePriceVal > 0 ? basePriceVal : salePriceVal);
  const category = (product.category || 'عام').trim();

  let discountPercent = 0;
  let discountAmount = 0;
  let finalPrice = originalPrice;

  if (mode === 'auto') {
    // النمط التلقائي: احتساب الخصم من الفارق بين سعر بيع الزبون وسعر البيع / الجملة
    if (originalPrice > 0 && salePriceVal > 0 && originalPrice > salePriceVal) {
      discountAmount = originalPrice - salePriceVal;
      discountPercent = Math.round(((originalPrice - salePriceVal) / originalPrice) * 1000) / 10;
      finalPrice = salePriceVal;
    } else if (product.discountPercentage && product.discountPercentage > 0) {
      discountPercent = product.discountPercentage;
      discountAmount = Math.round(originalPrice * (discountPercent / 100));
      finalPrice = Math.max(0, originalPrice - discountAmount);
    } else if (product.discount && product.discount > 0) {
      discountAmount = product.discount;
      discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 1000) / 10 : 0;
      finalPrice = Math.max(0, originalPrice - discountAmount);
    } else {
      discountAmount = 0;
      discountPercent = 0;
      finalPrice = originalPrice > 0 ? originalPrice : salePriceVal;
    }
  } else if (mode === 'fixed_percent') {
    // نسبة مئوية موحدة لجميع المنتجات
    const rate = Math.max(0, Math.min(100, options.fixedPercent ?? 0));
    discountPercent = rate;
    discountAmount = Math.round(originalPrice * (rate / 100));
    finalPrice = Math.max(0, originalPrice - discountAmount);
  } else if (mode === 'fixed_amount') {
    // مبلغ خصم ثابت
    const amount = Math.max(0, options.fixedAmount ?? 0);
    discountAmount = Math.min(originalPrice, amount);
    discountPercent = originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 1000) / 10 : 0;
    finalPrice = Math.max(0, originalPrice - discountAmount);
  } else if (mode === 'per_category') {
    // نسبة خصم مخصصة لكل فئة
    const catRate = options.categoryDiscounts?.[category] ?? options.fixedPercent ?? 0;
    const rate = Math.max(0, Math.min(100, catRate));
    discountPercent = rate;
    discountAmount = Math.round(originalPrice * (rate / 100));
    finalPrice = Math.max(0, originalPrice - discountAmount);
  }

  return {
    originalPrice,
    discountPercent,
    discountAmount,
    finalPrice,
    salePrice: salePriceVal,
  };
}

/**
 * معالجة وتجهيز بيانات المنتجات للتصدير
 */
export function prepareCatalogExportData(
  products: Product[],
  config: CatalogExcelExportConfig
): {
  rows: ProcessedProductRow[];
  totalStock: number;
  totalOriginalValue: number;
  totalFinalValue: number;
  totalDiscountAmount: number;
  averageDiscountPercent: number;
  categoriesCount: number;
} {
  // 1. فلترة المنتجات حسب النطاق (Scope)
  let filtered = [...products];

  if (config.scope === 'included') {
    filtered = filtered.filter((p) => p.includedInCatalog);
  } else if (config.scope === 'selected' && config.selectedIds && config.selectedIds.length > 0) {
    const selSet = new Set(config.selectedIds);
    filtered = filtered.filter((p) => selSet.has(p.id));
  }

  // 2. استبعاد المنتجات منعدمة المخزون إذا تم تفعيل الخيار
  if (config.excludeOutOfStock) {
    filtered = filtered.filter((p) => p.stock > 0);
  }

  // 3. فلترة الفئات المحددة
  if (config.selectedCategories && config.selectedCategories.length > 0) {
    const catSet = new Set(config.selectedCategories);
    filtered = filtered.filter((p) => catSet.has(p.category || 'عام'));
  }

  // 4. ترتيب المنتجات (حسب الفئة ثم التسلسل)
  if (config.sortByCategory) {
    filtered.sort((a, b) => {
      const catA = (a.category || 'عام').localeCompare(b.category || 'عام', 'ar');
      if (catA !== 0) return catA;
      return (a.order || 0) - (b.order || 0);
    });
  } else {
    filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // 5. احتساب البيانات التفصيلية والإحصائيات
  let totalStock = 0;
  let totalOriginalValue = 0;
  let totalFinalValue = 0;
  let totalDiscountAmount = 0;
  let sumDiscountPercent = 0;
  const categoriesSet = new Set<string>();

  const rows: ProcessedProductRow[] = filtered.map((p, idx) => {
    const cat = (p.category || 'عام').trim();
    categoriesSet.add(cat);

    const calc = calculateProductDiscount(p, config.discountMode, {
      fixedPercent: config.fixedDiscountPercent,
      fixedAmount: config.fixedDiscountAmount,
      categoryDiscounts: config.categoryDiscounts,
    });

    const activeName =
      p.activeNameType === 'shortened' && p.shortenedName
        ? p.shortenedName
        : p.name || p.originalName || '';

    const activeDesc =
      p.activeDescriptionType === 'shortened' && p.shortenedDescription
        ? p.shortenedDescription
        : p.originalDescription || '';

    totalStock += p.stock || 0;
    totalOriginalValue += calc.originalPrice * (p.stock > 0 ? p.stock : 1);
    totalFinalValue += calc.finalPrice * (p.stock > 0 ? p.stock : 1);
    totalDiscountAmount += calc.discountAmount * (p.stock > 0 ? p.stock : 1);
    sumDiscountPercent += calc.discountPercent;

    return {
      product: p,
      index: idx + 1,
      category: cat,
      name: activeName,
      barcode: p.barcode || '',
      internalReference: p.internalReference || '',
      originalPrice: calc.originalPrice,
      discountPercent: calc.discountPercent,
      discountAmount: calc.discountAmount,
      finalPrice: calc.finalPrice,
      salePrice: calc.salePrice,
      stock: p.stock || 0,
      unit: p.unit || 'قطعة',
      status: p.includedInCatalog ? 'مدرج بالكتالوج' : 'مستبعد',
      description: activeDesc,
      shopifyUrl: p.shopifyUrl || '',
    };
  });

  const averageDiscountPercent = rows.length > 0 ? Math.round((sumDiscountPercent / rows.length) * 10) / 10 : 0;

  return {
    rows,
    totalStock,
    totalOriginalValue,
    totalFinalValue,
    totalDiscountAmount,
    averageDiscountPercent,
    categoriesCount: categoriesSet.size,
  };
}

/**
 * تجهيز صورة المنتج بصيغة Base64 المتوافقة مع ExcelJS
 */
export async function getCleanImageBase64(
  imageUrlOrData?: string
): Promise<{ base64: string; extension: 'png' | 'jpeg' } | null> {
  if (!imageUrlOrData) return null;

  // 1. فحص ما إذا كانت سلسلة base64 مباشرة بصيغة PNG أو JPEG
  const dataUriMatch = imageUrlOrData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (dataUriMatch) {
    const ext = dataUriMatch[1].toLowerCase() === 'jpg' ? 'jpeg' : (dataUriMatch[1].toLowerCase() as 'png' | 'jpeg');
    return { base64: dataUriMatch[2], extension: ext };
  }

  // 2. إذا كانت سلسلة Base64 نقية بدون data URI
  if (/^[A-Za-z0-9+/=]+$/.test(imageUrlOrData) && imageUrlOrData.length > 200) {
    return { base64: imageUrlOrData, extension: 'png' };
  }

  // 3. إذا كانت WebP أو SVG أو رابط خارجي (URL)، نقوم بتحويلها إلى PNG عبر Canvas في المتصفح
  if (typeof window !== 'undefined') {
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          img.src = '';
          reject(new Error('Image load timeout'));
        }, 3500);
        img.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Failed to load image'));
        };
        img.src = imageUrlOrData;
      });

      const canvas = document.createElement('canvas');
      const maxDim = 240;
      let w = img.naturalWidth || img.width || 120;
      let h = img.naturalHeight || img.height || 120;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/png', 0.9);
      const cleanBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      return { base64: cleanBase64, extension: 'png' };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * إنشاء ملف الإكسل وحفظه مع دعم إدراج الصور والتنسيق الاحترافي
 */
export async function exportCatalogToExcel(
  products: Product[],
  config: CatalogExcelExportConfig,
  onProgress?: (current: number, total: number) => void
): Promise<{
  success: boolean;
  filename: string;
  rowCount: number;
}> {
  const ExcelJS = await import('exceljs');
  const WorkbookClass = ExcelJS.Workbook || (ExcelJS as any).default?.Workbook;
  const workbook = new WorkbookClass();
  workbook.creator = 'E-ZONE Catalog Studio';
  workbook.created = new Date();

  const currency = config.currency || 'د.ع';
  const projectName = config.projectName || 'كتالوج المنتجات';
  const cols = config.columns;
  const shouldIncludeImages = Boolean(config.includeImages || cols.image);

  const {
    rows,
    totalStock,
    totalOriginalValue,
    totalFinalValue,
    totalDiscountAmount,
    averageDiscountPercent,
    categoriesCount,
  } = prepareCatalogExportData(products, config);

  const safeSheetName = projectName.slice(0, 31).replace(/[:\\\/?*\[\]]/g, '_') || 'الكتالوج';
  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [{ state: 'normal', rightToLeft: true }],
    properties: { defaultRowHeight: 22 },
  });

  let currentRowIdx = 1;

  // ==========================================
  // 1. ترويسة معلومات الكتالوج والملخص
  // ==========================================
  if (config.includeSummary) {
    const titleRow = worksheet.getRow(currentRowIdx++);
    titleRow.getCell(1).value = `كتالوج المنتجات: ${projectName}`;
    titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
    titleRow.height = 26;

    const metaRow1 = worksheet.getRow(currentRowIdx++);
    metaRow1.getCell(1).value = `تاريخ الإصدار: ${new Date().toLocaleDateString('ar-IQ')} ${new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}`;
    metaRow1.getCell(3).value = `العملة المعتمدة: ${currency}`;
    metaRow1.getCell(5).value = `نوع الخصم: ${
      config.discountMode === 'auto'
        ? 'تلقائي (سعر الزبون - سعر البيع)'
        : config.discountMode === 'fixed_percent'
        ? `نسبة موحدة (${config.fixedDiscountPercent}%)`
        : config.discountMode === 'fixed_amount'
        ? `مبلغ ثابت (${config.fixedDiscountAmount.toLocaleString('en-US')} ${currency})`
        : 'مخصص حسب الفئة'
    }`;
    metaRow1.font = { name: 'Arial', size: 10, color: { argb: 'FF475569' } };

    const metaRow2 = worksheet.getRow(currentRowIdx++);
    metaRow2.getCell(1).value = `إجمالي الأصناف: ${rows.length}`;
    metaRow2.getCell(3).value = `عدد الفئات: ${categoriesCount}`;
    metaRow2.getCell(5).value = `إجمالي المخزون: ${totalStock.toLocaleString('en-US')}`;
    metaRow2.getCell(7).value = `متوسط الخصم: ${averageDiscountPercent}%`;
    metaRow2.font = { name: 'Arial', size: 10, color: { argb: 'FF475569' } };

    currentRowIdx++; // سطر فارغ فاصل
  }

  // ==========================================
  // 2. إعداد وتحديد أعمدة الجدول
  // ==========================================
  interface ColDef {
    key: string;
    header: string;
    width: number;
    isImage?: boolean;
    align?: 'center' | 'left' | 'right';
  }

  const colDefs: ColDef[] = [];
  if (cols.index) colDefs.push({ key: 'index', header: '#', width: 8, align: 'center' });
  if (shouldIncludeImages) {
    colDefs.push({ key: 'image', header: 'صورة المنتج', width: 16, isImage: true, align: 'center' });
  }
  if (cols.category) colDefs.push({ key: 'category', header: 'فئة المنتج', width: 22, align: 'center' });
  if (cols.name) colDefs.push({ key: 'name', header: 'اسم المنتج', width: 38, align: 'right' });
  if (cols.barcode) colDefs.push({ key: 'barcode', header: 'الباركود', width: 20, align: 'center' });
  if (cols.internalReference) colDefs.push({ key: 'internalReference', header: 'المرجع الداخلي (SKU)', width: 20, align: 'center' });
  if (cols.originalPrice) colDefs.push({ key: 'originalPrice', header: `السعر قبل الخصم (${currency})`, width: 18, align: 'center' });
  if (cols.discountPercent) colDefs.push({ key: 'discountPercent', header: 'نسبة الخصم %', width: 14, align: 'center' });
  if (cols.discountAmount) colDefs.push({ key: 'discountAmount', header: `مبلغ الخصم (${currency})`, width: 16, align: 'center' });
  if (cols.finalPrice) colDefs.push({ key: 'finalPrice', header: `السعر بعد الخصم (${currency})`, width: 18, align: 'center' });
  if (cols.salePrice) colDefs.push({ key: 'salePrice', header: `سعر الجملة (${currency})`, width: 16, align: 'center' });
  if (cols.stock) colDefs.push({ key: 'stock', header: 'المخزون المتوفر', width: 14, align: 'center' });
  if (cols.unit) colDefs.push({ key: 'unit', header: 'الوحدة', width: 12, align: 'center' });
  if (cols.status) colDefs.push({ key: 'status', header: 'الحالة في الكتالوج', width: 16, align: 'center' });
  if (cols.description) colDefs.push({ key: 'description', header: 'الوصف', width: 35, align: 'right' });
  if (cols.shopifyUrl) colDefs.push({ key: 'shopifyUrl', header: 'رابط الشراء أونلاين', width: 35, align: 'left' });

  worksheet.columns = colDefs.map((c) => ({
    width: c.width,
  }));

  // سطر الترويسة
  const headerRow = worksheet.getRow(currentRowIdx++);
  headerRow.height = 28;
  colDefs.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF17181D' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });

  const imageColIdx = colDefs.findIndex((c) => c.isImage);

  // ==========================================
  // 3. كتابة صفوف المنتجات
  // ==========================================
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    if (onProgress && (rIdx % 5 === 0 || rIdx === rows.length - 1)) {
      onProgress(rIdx + 1, rows.length);
    }

    const row = worksheet.getRow(currentRowIdx);
    if (shouldIncludeImages) {
      row.height = 60;
    } else {
      row.height = 22;
    }

    colDefs.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.alignment = { vertical: 'middle', horizontal: col.align || 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (rIdx % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      switch (col.key) {
        case 'index':
          cell.value = r.index;
          break;
        case 'image':
          cell.value = '';
          break;
        case 'category':
          cell.value = r.category;
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF4338CA' } };
          break;
        case 'name':
          cell.value = r.name;
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF0F172A' } };
          break;
        case 'barcode':
          cell.value = r.barcode;
          cell.font = { name: 'Courier New', size: 10 };
          break;
        case 'internalReference':
          cell.value = r.internalReference;
          cell.font = { name: 'Courier New', size: 10 };
          break;
        case 'originalPrice':
          cell.value = r.originalPrice;
          cell.numFmt = '#,##0';
          break;
        case 'discountPercent':
          cell.value = `${r.discountPercent}%`;
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF059669' } };
          break;
        case 'discountAmount':
          cell.value = r.discountAmount;
          cell.numFmt = '#,##0';
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF047857' } };
          break;
        case 'finalPrice':
          cell.value = r.finalPrice;
          cell.numFmt = '#,##0';
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF0F172A' } };
          break;
        case 'salePrice':
          cell.value = r.salePrice;
          cell.numFmt = '#,##0';
          break;
        case 'stock':
          cell.value = r.stock;
          cell.numFmt = '#,##0';
          break;
        case 'unit':
          cell.value = r.unit;
          break;
        case 'status':
          cell.value = r.status;
          break;
        case 'description':
          cell.value = r.description;
          break;
        case 'shopifyUrl':
          if (r.shopifyUrl) {
            cell.value = { text: 'فتح الرابط أونلاين', hyperlink: r.shopifyUrl };
            cell.font = { color: { argb: 'FF2563EB' }, underline: true };
          }
          break;
      }
    });

    // إدراج صورة المنتج بصرياً في الخلية
    if (shouldIncludeImages && imageColIdx >= 0 && r.product.imageData) {
      try {
        const imgResult = await getCleanImageBase64(r.product.imageData);
        if (imgResult) {
          const imageId = workbook.addImage({
            base64: imgResult.base64,
            extension: imgResult.extension,
          });
          worksheet.addImage(imageId, {
            tl: { col: imageColIdx + 0.08, row: currentRowIdx - 1 + 0.08 },
            br: { col: imageColIdx + 0.92, row: currentRowIdx - 0.08 },
            editAs: 'oneCell',
          } as any);
        }
      } catch (err) {
        console.warn('Could not embed product image:', r.name, err);
      }
    }

    currentRowIdx++;
  }

  // ==========================================
  // 4. صف الإجماليات الختامي
  // ==========================================
  if (config.includeSummary && rows.length > 0) {
    currentRowIdx++; // سطر فارغ
    const totalRow = worksheet.getRow(currentRowIdx);
    totalRow.height = 24;
    colDefs.forEach((col, idx) => {
      const cell = totalRow.getCell(idx + 1);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      };

      if (col.key === 'index') cell.value = 'الإجمالي';
      if (col.key === 'category') cell.value = `عدد الفئات: ${categoriesCount}`;
      if (col.key === 'name') cell.value = `إجمالي: ${rows.length} منتج`;
      if (col.key === 'discountPercent') cell.value = `متوسط: ${averageDiscountPercent}%`;
      if (col.key === 'stock') {
        cell.value = totalStock;
        cell.numFmt = '#,##0';
      }
    });
  }

  // ==========================================
  // 5. حفظ وتنزيل الملف في المتصفح
  // ==========================================
  const safeFileProjectName = projectName.replace(/[\/\\?%*:|"<>]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `كتالوج_${safeFileProjectName}_${dateStr}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  if (typeof window !== 'undefined') {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  return {
    success: true,
    filename,
    rowCount: rows.length,
  };
}
