import * as XLSX from 'xlsx';
import {
  Product,
  CatalogExcelExportConfig,
  CatalogDiscountMode,
  CatalogExcelExportColumns,
} from '@/types';

export const DEFAULT_EXCEL_COLUMNS: CatalogExcelExportColumns = {
  index: true,
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
 * إنشاء ملف الإكسل وحفظه
 */
export function exportCatalogToExcel(
  products: Product[],
  config: CatalogExcelExportConfig
): {
  success: boolean;
  filename: string;
  rowCount: number;
} {
  const currency = config.currency || 'د.ع';
  const projectName = config.projectName || 'كتالوج المنتجات';
  const cols = config.columns;

  const {
    rows,
    totalStock,
    totalOriginalValue,
    totalFinalValue,
    totalDiscountAmount,
    averageDiscountPercent,
    categoriesCount,
  } = prepareCatalogExportData(products, config);

  const sheetData: (string | number)[][] = [];

  // ==========================================
  // 1. ترويسة معلومات الكتالوج والملخص
  // ==========================================
  if (config.includeSummary) {
    sheetData.push([`كتالوج المنتجات: ${projectName}`]);
    sheetData.push([
      `تاريخ الإصدار: ${new Date().toLocaleDateString('ar-IQ')} ${new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}`,
      '',
      `العملة المعتمدة: ${currency}`,
      '',
      `نوع احتساب الخصم: ${
        config.discountMode === 'auto'
          ? 'تلقائي (سعر الزبون - سعر البيع)'
          : config.discountMode === 'fixed_percent'
          ? `نسبة موحدة (${config.fixedDiscountPercent}%)`
          : config.discountMode === 'fixed_amount'
          ? `مبلغ ثابت (${config.fixedDiscountAmount.toLocaleString('en-US')} ${currency})`
          : 'مخصص حسب الفئة'
      }`,
    ]);

    sheetData.push([
      `إجمالي الأصناف: ${rows.length}`,
      '',
      `عدد الفئات: ${categoriesCount}`,
      '',
      `إجمالي المخزون: ${totalStock.toLocaleString('en-US')}`,
      '',
      `متوسط الخصم: ${averageDiscountPercent}%`,
    ]);

    sheetData.push([]); // سطر فارغ فاصل
  }

  // ==========================================
  // 2. عناوين أعمدة الجدول
  // ==========================================
  const headers: string[] = [];

  if (cols.index) headers.push('#');
  if (cols.category) headers.push('فئة المنتج'); // فئة المنتج واضحة وبارزة
  if (cols.name) headers.push('اسم المنتج');
  if (cols.barcode) headers.push('الباركود');
  if (cols.internalReference) headers.push('المرجع الداخلي (SKU)');
  if (cols.originalPrice) headers.push(`السعر قبل الخصم (${currency})`);
  if (cols.discountPercent) headers.push('نسبة الخصم %');
  if (cols.discountAmount) headers.push(`مبلغ الخصم (${currency})`);
  if (cols.finalPrice) headers.push(`السعر بعد الخصم (${currency})`);
  if (cols.salePrice) headers.push(`سعر الجملة (${currency})`);
  if (cols.stock) headers.push('المخزون المتوفر');
  if (cols.unit) headers.push('الوحدة');
  if (cols.status) headers.push('الحالة في الكتالوج');
  if (cols.description) headers.push('الوصف');
  if (cols.shopifyUrl) headers.push('رابط الشراء أونلاين');

  sheetData.push(headers);

  // ==========================================
  // 3. صفوف بيانات المنتجات
  // ==========================================
  rows.forEach((r) => {
    const rowValues: (string | number)[] = [];

    if (cols.index) rowValues.push(r.index);
    if (cols.category) rowValues.push(sanitizeCellValue(r.category));
    if (cols.name) rowValues.push(sanitizeCellValue(r.name));
    if (cols.barcode) rowValues.push(sanitizeCellValue(r.barcode));
    if (cols.internalReference) rowValues.push(sanitizeCellValue(r.internalReference));
    if (cols.originalPrice) rowValues.push(r.originalPrice);
    if (cols.discountPercent) rowValues.push(`${r.discountPercent}%`);
    if (cols.discountAmount) rowValues.push(r.discountAmount);
    if (cols.finalPrice) rowValues.push(r.finalPrice);
    if (cols.salePrice) rowValues.push(r.salePrice);
    if (cols.stock) rowValues.push(r.stock);
    if (cols.unit) rowValues.push(sanitizeCellValue(r.unit));
    if (cols.status) rowValues.push(r.status);
    if (cols.description) rowValues.push(sanitizeCellValue(r.description));
    if (cols.shopifyUrl) rowValues.push(sanitizeCellValue(r.shopifyUrl));

    sheetData.push(rowValues);
  });

  // ==========================================
  // 4. صف الإجماليات الختامي
  // ==========================================
  if (config.includeSummary && rows.length > 0) {
    sheetData.push([]); // سطر فارغ

    const totalRow: (string | number)[] = [];
    if (cols.index) totalRow.push('الإجمالي');
    if (cols.category) totalRow.push(`عدد الفئات: ${categoriesCount}`);
    if (cols.name) totalRow.push(`إجمالي: ${rows.length} منتج`);
    if (cols.barcode) totalRow.push('');
    if (cols.internalReference) totalRow.push('');
    if (cols.originalPrice) totalRow.push('');
    if (cols.discountPercent) totalRow.push(`متوسط: ${averageDiscountPercent}%`);
    if (cols.discountAmount) totalRow.push('');
    if (cols.finalPrice) totalRow.push('');
    if (cols.salePrice) totalRow.push('');
    if (cols.stock) totalRow.push(totalStock);
    if (cols.unit) totalRow.push('');
    if (cols.status) totalRow.push('');
    if (cols.description) totalRow.push('');
    if (cols.shopifyUrl) totalRow.push('');

    sheetData.push(totalRow);
  }

  // ==========================================
  // 5. إنشاء الورقة والمصنف وضبط القياسات
  // ==========================================
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // تفعيل الاتجاه من اليمين إلى اليسار (RTL) للغة العربية في Excel
  ws['!views'] = [{ RTL: true }];

  // حساب العرض التلقائي لكل عمود بحيث لا تقتطع النصوص
  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    // فحص عينات من الصفوف لتحديد العرض المناسب
    sheetData.slice(config.includeSummary ? 4 : 0).forEach((row) => {
      const cell = row[colIdx];
      if (cell !== undefined && cell !== null) {
        const strLen = String(cell).length;
        if (strLen > maxLen) maxLen = strLen;
      }
    });
    // إضافة هوامش مريحة
    return { wch: Math.min(65, Math.max(maxLen + 4, 10)) };
  });

  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  const safeSheetName = projectName.slice(0, 31).replace(/[:\\\/?*\[\]]/g, '_') || 'الكتالوج';
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  // اسم الملف النظيف
  const safeFileProjectName = projectName.replace(/[\/\\?%*:|"<>]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `كتالوج_${safeFileProjectName}_${dateStr}.xlsx`;

  // تنفيذ التنزيل
  XLSX.writeFile(wb, filename);

  return {
    success: true,
    filename,
    rowCount: rows.length,
  };
}
