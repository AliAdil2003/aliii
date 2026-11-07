import * as XLSX from 'xlsx';
import { INITIAL_SAMPLE_PRODUCTS, SAMPLE_BASE64_WEBP } from './sampleProducts';

export function createSampleWorkbook(): Uint8Array {
  const headers = [
    'اسم العرض',
    'وصف المنتج',
    'باركود',
    'الفئة',
    'سعر البيع',
    'سعر بيع الزبون',
    'الكمية في اليد',
    'صورة 512',
    'مرجع داخلي',
    'الوحدة',
  ];

  const rows = INITIAL_SAMPLE_PRODUCTS.map((p, idx) => {
    // Intentionally add a duplicate barcode on the 8th product to test duplicate barcode detection
    const barcode = idx === 7 ? '6977525810152' : p.barcode;
    // Test base64 webp raw data in one row
    const imageVal = idx === 5 ? SAMPLE_BASE64_WEBP : (p.imageData || '');

    return [
      p.name,
      p.originalDescription,
      barcode,
      p.category,
      p.salePrice ?? p.price,
      p.customerPrice ?? p.price,
      p.stock,
      imageVal,
      p.internalReference,
      p.unit || 'قطعة',
    ];
  });

  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة المنتجات');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
}
