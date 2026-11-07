import { ColumnMapping } from '@/types';

// Normalized string comparison helper
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s_\-–—]+/g, '')
    .trim();
}

const FIELD_PATTERNS: Record<keyof ColumnMapping, string[]> = {
  productName: [
    'اسمالعرض',
    'اسمالمنتج',
    'اسمالسلعه',
    'الاسم',
    'اسم',
    'عنوانالمنتج',
    'اسمماده',
    'productname',
    'name',
    'itemname',
    'title',
    'producttitle',
  ],
  description: [
    'وصفالمنتج',
    'الوصف',
    'وصف',
    'تفاصيلالمنتج',
    'الشرح',
    'المواصفات',
    'وصفالماده',
    'description',
    'details',
    'productdescription',
    'desc',
    'specification',
  ],
  barcode: [
    'باركود',
    'الباركود',
    'رمزالباركود',
    'كودالمنتج',
    'رقمالباركود',
    'كود',
    'barcode',
    'barcodeno',
    'upc',
    'ean',
    'ean13',
    'code',
  ],
  category: [
    'الفئه',
    'التصنيف',
    'القسم',
    'المجموعه',
    'فئهالمنتج',
    'النوع',
    'category',
    'categories',
    'department',
    'dept',
    'group',
    'type',
  ],
  customerPrice: [
    'سعربيعالزبون',
    'سعرالزبون',
    'سعربيعالمفرد',
    'سعرمفرد',
    'سعرالعميل',
    'سعربيعالعميل',
    'customerprice',
    'retailprice',
  ],
  salePrice: [
    'سعربيع',
    'سعرالبيع',
    'سعربيعالجمله',
    'سعرالجمله',
    'saleprice',
    'sellingprice',
    'standardprice',
    'wholesale',
    'wholesaleprice',
  ],
  price: [
    'سعربيعالزبون',
    'سعرالبيع',
    'السعر',
    'سعربيع',
    'سعربيعالمفرد',
    'سعربيعالجمله',
    'سعرمفرد',
    'سعرمفرق',
    'السعرالنهائي',
    'سعرالمنتج',
    'قيمه',
    'price',
    'retailprice',
    'sellingprice',
    'customerprice',
    'unitprice',
    'cost',
  ],
  stock: [
    'الكميهفياليد',
    'المخزون',
    'الرصيد',
    'الكميه',
    'الكميهالمتوفره',
    'رصيدالمخزن',
    'stock',
    'quantityinhand',
    'qty',
    'quantity',
    'inventory',
    'currentstock',
    'inhand',
  ],
  image: [
    'صوره512',
    'صوره',
    'الصوره',
    'صورهالمنتج',
    'رابطالصوره',
    'صورت',
    'صورةالمنتج',
    'image',
    'photo',
    'picture',
    'imageurl',
    'image512',
    'productimage',
    'base64image',
    'img',
  ],
  internalReference: [
    'مرجعداخلي',
    'المرجع',
    'رمزالمرجع',
    'كودالصنف',
    'رقمالمرجع',
    'الرقمالداخلي',
    'رمزالماده',
    'internalreference',
    'reference',
    'ref',
    'sku',
    'itemcode',
    'partnumber',
    'modelnumber',
  ],
  unit: [
    'الوحده',
    'نوعالوحده',
    'وحدهالقياس',
    'unit',
    'uom',
    'measure',
  ],
  currency: [
    'العمله',
    'رمزالعمله',
    'نوعالعمله',
    'currency',
    'cur',
  ],
  availableQuantity: [
    'الكميهالمتاحه',
    'الكميهالمتبقيه',
    'المتاح',
    'availablequantity',
    'availableqty',
    'available',
  ],
};

export function autoDetectColumns(availableColumns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    productName: '',
    description: '',
    barcode: '',
    category: '',
    customerPrice: '',
    salePrice: '',
    price: '',
    stock: '',
    image: '',
    internalReference: '',
    unit: '',
    currency: '',
    availableQuantity: '',
  };

  const normalizedColumns = availableColumns.map((col) => ({
    original: col,
    normalized: normalize(col),
  }));

  const assignedOriginals = new Set<string>();

  // Helper to find match
  for (const [fieldKey, patterns] of Object.entries(FIELD_PATTERNS) as [keyof ColumnMapping, string[]][]) {
    // 1. Exact pattern matches
    for (const pattern of patterns) {
      const match = normalizedColumns.find(
        (col) => !assignedOriginals.has(col.original) && col.normalized === pattern
      );
      if (match) {
        mapping[fieldKey] = match.original;
        assignedOriginals.add(match.original);
        break;
      }
    }

    // 2. Substring matches if still unassigned
    if (!mapping[fieldKey]) {
      for (const pattern of patterns) {
        const match = normalizedColumns.find(
          (col) =>
            !assignedOriginals.has(col.original) &&
            (col.normalized.includes(pattern) || pattern.includes(col.normalized))
        );
        if (match) {
          mapping[fieldKey] = match.original;
          assignedOriginals.add(match.original);
          break;
        }
      }
    }
  }

  // Fallbacks: ensure price fields are synchronized if only one was present
  if (!mapping.customerPrice && mapping.price) {
    mapping.customerPrice = mapping.price;
  }
  if (!mapping.price && mapping.customerPrice) {
    mapping.price = mapping.customerPrice;
  }
  if (!mapping.price && mapping.salePrice) {
    mapping.price = mapping.salePrice;
  }

  return mapping;
}
