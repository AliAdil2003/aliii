import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ColumnMapping, Product } from '@/types';
import { extractAndNormalizeImage } from '../images/base64Extractor';

export interface RawParseResult {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  rows: Record<string, any>[];
}

export interface DuplicateBarcodeGroup {
  barcode: string;
  indices: number[];
  productNames: string[];
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV file from a File or Buffer
 */
export async function parseCatalogFile(file: File): Promise<RawParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return parseCsvFile(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file);
  } else {
    throw new Error('صيغة الملف غير مدعومة. يرجى رفع ملف Excel (.xlsx, .xls) أو CSV.');
  }
}

function parseCsvFile(file: File): Promise<RawParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      complete: (results) => {
        const headers = (results.meta.fields || []).filter((h) => h && h.trim().length > 0);
        const rows = results.data.filter((row) => {
          return Object.values(row).some((val) => val !== null && val !== undefined && String(val).trim() !== '');
        });

        resolve({
          fileName: file.name,
          fileSize: file.size,
          rowCount: rows.length,
          columnCount: headers.length,
          headers,
          rows,
        });
      },
      error: (error) => {
        reject(new Error(`خطأ في قراءة ملف CSV: ${error.message}`));
      },
    });
  });
}

async function parseExcelFile(file: File): Promise<RawParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('ملف Excel لا يحتوي على أي ورقة عمل.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  // Parse into raw json
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as any[][];

  if (!rawRows || rawRows.length === 0) {
    throw new Error('ملف Excel فارغ.');
  }

  // First row is headers
  const rawHeaders = (rawRows[0] || []).map((h: any) => String(h || '').trim());
  const headers = rawHeaders.filter((h: string) => h.length > 0);

  // Remaining rows
  const dataRows: Record<string, any>[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const rowValues = rawRows[i] || [];
    const isRowEmpty = rowValues.every(
      (val: any) => val === null || val === undefined || String(val).trim() === ''
    );
    if (isRowEmpty) continue;

    const rowObj: Record<string, any> = {};
    rawHeaders.forEach((header: string, colIdx: number) => {
      if (header) {
        rowObj[header] = rowValues[colIdx] !== undefined ? rowValues[colIdx] : '';
      }
    });
    dataRows.push(rowObj);
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    rowCount: dataRows.length,
    columnCount: headers.length,
    headers,
    rows: dataRows,
  };
}

/**
 * Strips internal reference and ERP codes from product name so names stay clean in catalog
 */
export function cleanInternalRefFromName(name: string, internalRef?: string): string {
  if (!name) return '';
  try {
    let cleaned = name.trim();

    // If explicit internalRef exists, strip it out of name (with or without brackets)
    if (internalRef && internalRef.trim().length > 1) {
      const refStr = internalRef.trim();
      const escaped = refStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const refRegexes = [
          new RegExp(`\\[\\s*${escaped}\\s*\\]`, 'gi'),
          new RegExp(`\\(\\s*${escaped}\\s*\\)`, 'gi'),
          new RegExp(`(?:^|\\s)[-–—|:]?\\s*${escaped}(?:\\s|$)`, 'gi'),
        ];
        refRegexes.forEach((r) => {
          cleaned = cleaned.replace(r, ' ');
        });
      } catch {
        cleaned = cleaned.split(refStr).join(' ');
      }
    }

    // Remove common ERP prefixes like [REF-123] at start of name: e.g. [MOX-CH-65W]
    cleaned = cleaned.replace(/^\[[A-Za-z0-9_\-\.\/]+\]\s*/g, '');
    // Remove common ERP suffixes like [REF-123] at end of name
    cleaned = cleaned.replace(/\s*\[[A-Za-z0-9_\-\.\/]+\]$/g, '');

    // Remove common internal reference labels like "مرجع: XYZ", "كود: XYZ", "REF: XYZ", "SKU: XYZ"
    cleaned = cleaned.replace(/(?:^|\s)(?:مرجع|كود|رمز|ref|sku|item\s*code|internal\s*ref)[:\s\-#]*[A-Za-z0-9\-_.]+/gi, ' ');

    return cleaned.replace(/\s+/g, ' ').trim() || name.trim();
  } catch {
    return name ? name.trim() : '';
  }
}

/**
 * Maps raw Excel rows into typed Product entities
 */
export function mapRowsToProducts(
  rawRows: Record<string, any>[],
  mapping: ColumnMapping,
  projectId: string
): Product[] {
  return rawRows.map((row, index) => {
    const internalRef = String(row[mapping.internalReference] || '').trim();
    const rawName = String(row[mapping.productName] || `منتج #${index + 1}`).trim();
    const name = cleanInternalRefFromName(rawName, internalRef);
    const originalDesc = String(row[mapping.description] || '').trim();
    const barcodeRaw = String(row[mapping.barcode] || '').trim();
    const category = String(row[mapping.category] || 'عام').trim();
    const unit = mapping.unit ? String(row[mapping.unit] || '').trim() : undefined;
    const currency = mapping.currency ? String(row[mapping.currency] || '').trim() : undefined;

    // Helper to parse price values safely
    const parsePriceValue = (val: any): number | string | undefined => {
      if (val === undefined || val === null || String(val).trim() === '') return undefined;
      const clean = String(val).replace(/[^0-9.-]/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? String(val).trim() : num;
    };

    const customerPriceVal = mapping.customerPrice ? parsePriceValue(row[mapping.customerPrice]) : undefined;
    const salePriceVal = mapping.salePrice ? parsePriceValue(row[mapping.salePrice]) : undefined;
    const generalPriceVal = mapping.price ? parsePriceValue(row[mapping.price]) : undefined;

    const resolvedCustomerPrice = customerPriceVal !== undefined ? customerPriceVal : (generalPriceVal ?? 0);
    const resolvedSalePrice = salePriceVal !== undefined ? salePriceVal : resolvedCustomerPrice;
    const resolvedPrice = generalPriceVal !== undefined ? generalPriceVal : resolvedCustomerPrice;

    // Parse stock safely
    let stock = 0;
    const stockRaw = row[mapping.stock];
    if (stockRaw !== undefined && stockRaw !== null) {
      const cleanStock = String(stockRaw).replace(/[^0-9.-]/g, '');
      const num = parseInt(cleanStock, 10);
      stock = isNaN(num) ? 0 : num;
    }

    // Extract image (handles Base64, WebP, PNG, URLs, missing, error reporting)
    const rawImage = mapping.image ? row[mapping.image] : undefined;
    const processedImage = extractAndNormalizeImage(rawImage);

    // Initial shortened description (fallback to original or concise version)
    const shortenedDesc = originalDesc.length > 150 ? originalDesc.substring(0, 140) + '...' : originalDesc;

    return {
      id: `prod_${projectId}_${index + 1}_${Date.now()}`,
      projectId,
      name,
      originalName: name,
      shortenedName: '',
      activeNameType: 'original',
      originalDescription: originalDesc,
      shortenedDescription: shortenedDesc,
      activeDescriptionType: 'original',
      barcode: barcodeRaw,
      price: resolvedPrice,
      salePrice: resolvedSalePrice,
      customerPrice: resolvedCustomerPrice,
      stock,
      category,
      internalReference: internalRef,
      unit,
      currency,
      imageData: processedImage.src,
      imageStatus: processedImage.status,
      imageError: processedImage.error,
      includedInCatalog: true,
      order: index + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Detects duplicate barcodes across products
 */
export function detectDuplicateBarcodes(products: Product[]): DuplicateBarcodeGroup[] {
  const barcodeMap = new Map<string, { indices: number[]; productNames: string[] }>();

  products.forEach((p, idx) => {
    const code = (p.barcode || '').trim();
    if (!code) return; // skip empty barcodes for duplicate check

    if (!barcodeMap.has(code)) {
      barcodeMap.set(code, { indices: [idx], productNames: [p.name] });
    } else {
      const existing = barcodeMap.get(code)!;
      existing.indices.push(idx);
      existing.productNames.push(p.name);
    }
  });

  const duplicates: DuplicateBarcodeGroup[] = [];
  barcodeMap.forEach((val, code) => {
    if (val.indices.length > 1) {
      duplicates.push({
        barcode: code,
        indices: val.indices,
        productNames: val.productNames,
      });
    }
  });

  return duplicates;
}
