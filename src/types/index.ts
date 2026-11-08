export type ActiveDescriptionType = 'original' | 'shortened' | 'custom';
export type ActiveNameType = 'original' | 'shortened' | 'custom';

export type ImageStatus = 'valid' | 'invalid' | 'missing';

export interface Product {
  id: string;
  projectId: string;
  name: string;
  originalName?: string;
  shortenedName?: string;
  customName?: string;
  activeNameType?: ActiveNameType;
  originalDescription: string;
  shortenedDescription: string;
  customDescription?: string;
  activeDescriptionType: ActiveDescriptionType;
  barcode: string;
  price: number | string; // سعر بيع الزبون الأساسي
  salePrice?: number | string; // سعر البيع
  customerPrice?: number | string; // سعر بيع الزبون
  discount?: number; // قيمة الخصم
  discountPercentage?: number; // نسبة الخصم المئوية
  stock: number;
  category: string;
  internalReference: string;
  unit?: string;
  currency?: string;
  availableQuantity?: number;
  odooId?: number; // معرف المنتج في نظام Odoo للمزامنة المباشرة
  shopifyId?: string | number; // معرف المنتج في متجر Shopify
  shopifyUrl?: string; // رابط شراء المنتج أونلاين على متجر Shopify
  shopifyHandle?: string; // معرّف الرابط اللطيف للمنتج (handle)
  shopifyDescription?: string; // وصف المنتج المستورد من متجر Shopify
  imageId?: string;
  imageData?: string; // Base64 data URI or remote/local URL
  imageStatus: ImageStatus;
  imageError?: string;
  includedInCatalog: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnMapping {
  productName: string;
  description: string;
  barcode: string;
  category: string;
  salePrice: string; // عمود سعر البيع
  customerPrice: string; // عمود سعر بيع الزبون
  price: string; // للتوافق العكسي
  stock: string;
  image: string;
  internalReference: string;
  unit: string;
  currency: string;
  availableQuantity: string;
}

export type StockFilterMode =
  | 'all'
  | 'zero'
  | 'less_than_5'
  | 'less_than_or_equal_5'
  | 'greater_than_0'
  | 'greater_than_5'
  | 'custom';

export interface StockFilterConfig {
  mode: StockFilterMode;
  min?: number;
  max?: number;
}

export type PageSize = 'A4' | 'A3' | 'A5' | 'letter' | 'legal' | 'custom';
export type Orientation = 'portrait' | 'landscape';

export interface Margins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PageSettings {
  size: PageSize;
  width?: number; // mm
  height?: number; // mm
  orientation: Orientation;
  margins: Margins;
  bleed?: number; // mm
  cropMarks?: boolean;
}

export interface TableColumnConfig {
  id: string;
  key: keyof Product | 'custom' | 'actions';
  label: string;
  width: number; // percentage (e.g. 20 for 20%)
  visible: boolean;
  alignment: 'right' | 'center' | 'left';
  order: number;
}

export interface TableBorders {
  outerWidth: number;
  outerColor: string;
  innerWidth: number;
  innerColor: string;
  horizontalWidth: number;
  horizontalColor: string;
  verticalWidth: number;
  verticalColor: string;
}

export interface TableSettings {
  columns: TableColumnConfig[];
  rowHeight: number; // in px
  minRowHeight?: number;
  maxRowHeight?: number;
  borders: TableBorders;
  cellPadding: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  verticalAlignment: 'top' | 'middle' | 'bottom';
  headerBackground: string;
  headerTextColor: string;
  alternateRowBackground?: string;
}

export interface FontConfig {
  fontFamily: 'Cairo' | 'Tajawal' | 'Noto Sans Arabic' | 'Inter' | 'Arial' | 'Helvetica';
  fontSize: number; // pt or px
  fontWeight: '300' | '400' | '500' | '600' | '700' | '800';
  lineHeight: number;
  letterSpacing: number;
  color: string;
  alignment: 'right' | 'center' | 'left';
}

export interface TypographySettings {
  productName: FontConfig;
  description: FontConfig;
  price: FontConfig;
  barcode: FontConfig;
  category: FontConfig;
  internalReference: FontConfig;
  tableHeader: FontConfig;
  headerText: FontConfig;
  footerText: FontConfig;
}

export interface ImageSettings {
  width: number; // px or %
  height: number; // px
  maxWidth?: number;
  maxHeight?: number;
  fitMode: 'contain' | 'cover' | 'fill';
  horizontalAlignment: 'right' | 'center' | 'left';
  verticalAlignment: 'top' | 'middle' | 'bottom';
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  background: string;
}

export interface PriceSettings {
  currency: string;
  currencyPosition: 'prefix' | 'suffix';
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  alignment: 'right' | 'center' | 'left';
  showDecimals: boolean;
}

export interface BarcodeSettings {
  showBarcode: boolean;
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  color: string;
  alignment: 'right' | 'center' | 'left';
  displayFormat: 'text' | 'barcode';
}

export interface HeaderSettings {
  enabled: boolean;
  type?: 'image' | 'text' | 'both'; // نمط الهيدر: صورة بانر، نص، أو كلاهما
  bannerImage?: string; // صورة الهيدر (Base64 data URI أو رابط صورة)
  bannerHeight?: number; // ارتفاع صورة الهيدر بالبكسل
  bannerFit?: 'contain' | 'cover' | 'fill'; // ملاءمة الصورة
  bannerBorderRadius?: number; // تدوير حواف صورة الهيدر
  showOnFirstPageOnly?: boolean; // إظهار في بداية الملف (الصفحة الأولى فقط) أو كل الصفحات
  height: number;
  logoUrl?: string;
  logoSize: number;
  companyName?: string;
  catalogTitle?: string;
  showDate: boolean;
  showPageNumber: boolean;
  customText?: string;
  background: string;
  textColor: string;
  borderBottom: boolean;
  alignment: 'right' | 'center' | 'left';
}

export interface FooterSettings {
  enabled: boolean;
  type?: 'image' | 'text' | 'both'; // نمط الفوتر: صورة بانر، نص، أو كلاهما
  bannerImage?: string; // صورة الفوتر (Base64 data URI أو رابط صورة)
  bannerHeight?: number; // ارتفاع صورة الفوتر بالبكسل
  bannerFit?: 'contain' | 'cover' | 'fill'; // ملاءمة الصورة
  bannerBorderRadius?: number; // تدوير حواف صورة الفوتر
  showOnLastPageOnly?: boolean; // إظهار في نهاية الملف (الصفحة الأخيرة فقط) أو كل الصفحات
  background?: string;
  height: number;
  showPageNumber: boolean;
  customText?: string;
  borderTop: boolean;
  textColor: string;
  alignment: 'right' | 'center' | 'left';
}

export type CatalogLayoutType = 'table' | 'cards' | 'two_column' | 'three_column' | 'custom';

export interface CategoryGroupingSettings {
  enabled: boolean; // تفعيل التصنيف والترتيب حسب فئة المنتج
  categoryOrder: string[]; // الترتيب التسلسلي للفئات: مثلاً ['شواحن', 'كيبلات', 'بور بانك']
  showHeader: boolean; // إظهار شريط/ترويسة بارزة لكل فئة في الجدول والبطاقات
  headerBackground?: string; // لون خلفية شريط الفئة
  headerTextColor?: string; // لون نص شريط الفئة
  headerFontSize?: number; // حجم خط عنوان الفئة (pt)
  showProductCount?: boolean; // إظهار عدد منتجات كل فئة
  pageBreakPerCategory?: boolean; // بدء كل فئة في صفحة جديدة
}

export interface CatalogTemplate {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  layoutType: CatalogLayoutType;
  page: PageSettings;
  table: TableSettings;
  typography: TypographySettings;
  image: ImageSettings;
  price: PriceSettings;
  barcode: BarcodeSettings;
  header: HeaderSettings;
  footer: FooterSettings;
  categoryGrouping?: CategoryGroupingSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  templateId?: string;
  template: CatalogTemplate;
  stockFilter: StockFilterConfig;
  defaultCurrency: string;
  currencyPosition: 'prefix' | 'suffix';
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  fileName?: string;
  fileSize?: number;
  rowCount: number;
  columnCount: number;
  detectedColumns: string[];
  columnMapping: ColumnMapping;
  settings: ProjectSettings;
  productCount?: number;
  includedProductCount?: number;
  createdAt: string;
  updatedAt: string;
  type?: 'catalog' | 'purchase_order';
  purchaseOrderData?: PurchaseOrder;
}

export interface SavedPurchaseOrderTemplate {
  id: string;
  name: string;
  description?: string;
  design: PurchaseOrderTableDesign;
  createdAt: string;
  isDefault?: boolean;
}

export interface ExportHistoryItem {
  id: string;
  projectId: string;
  filename: string;
  date: string;
  productCount: number;
  templateName: string;
  fileSize: number;
  downloadUrl?: string;
}

export interface PDFExportOptions {
  filename: string;
  pageSize: PageSize;
  orientation: Orientation;
  quality: 'standard' | 'high' | 'print_300dpi';
  imageQuality: number;
  includeHeader: boolean;
  includeFooter: boolean;
  pageNumbers: boolean;
  bleed: number;
  cropMarks: boolean;
  safeMargins: boolean;
  exportMode?: 'exact_studio_preview' | 'continuous_flow' | 'single_long_page'; // وضع التصدير: مطابق لمعاينة الاستوديو 1:1، أو تدفقي، أو صفحة واحدة طويلة ممتدة
  exportFormat?: 'pdf' | 'png_image'; // صيغة التصدير: PDF أو صورة عالية الدقة PNG
  pageIndex?: number; // رقم الصفحة المراد تصديرها (أو undefined لكافة الصفحات)
}

export interface DescriptionShortenRequest {
  productId?: string;
  originalDescription: string;
  mode: 'very_short' | 'short' | 'medium' | 'custom';
  wordLimit: number;
  productName?: string;
}

export interface DescriptionShortenResponse {
  shortenedDescription: string;
  wordCount: number;
  language: 'ar' | 'en' | 'mixed';
}

export type NameShortenMode = 'very_short' | 'short' | 'medium' | 'custom';

export interface NameShortenItem {
  id: string;
  originalName: string;
  shortenedName: string;
  reductionPercent: number;
  wordCount: number;
  reason?: string;
}

export interface NameShortenRequest {
  products: {
    id: string;
    name: string;
    category?: string;
    internalReference?: string;
  }[];
  mode?: NameShortenMode;
  maxWords?: number;
  apiKey?: string;
}

export interface NameShortenResponse {
  results: NameShortenItem[];
  source: 'gemini' | 'heuristic';
  modelUsed: string;
}

// ==========================================
// Odoo ERP Integration Types
// ==========================================

export interface OdooConfig {
  url: string;
  db: string;
  username: string;
  apiKey: string;
  salePriceField?: string; // عمود سعر البيع (الجملة) - افتراضياً lst_price
  customerPriceField?: string; // عمود سعر بيع الزبون - افتراضياً customer_sale_price
}

export interface OdooTestResult {
  success: boolean;
  message: string;
  uid?: number;
  serverVersion?: string;
  database?: string;
  companyName?: string;
  userName?: string;
  totalProducts?: number;
  latencyMs?: number;
  detectedCustomerPriceField?: string;
  detectedSalePriceField?: string;
}

export interface OdooProductRaw {
  id: number;
  name: string;
  display_name?: string;
  default_code?: string | false;
  barcode?: string | false;
  lst_price?: number;
  list_price?: number;
  customer_sale_price?: number; // سعر بيع الزبون في Odoo
  qty_available?: number;
  categ_id?: [number, string] | false;
  description_sale?: string | false;
  description?: string | false;
  image_1920?: string | false;
  image_512?: string | false;
  uom_id?: [number, string] | false;
  currency_id?: [number, string] | false;
  active?: boolean;
  [key: string]: any;
}

export interface OdooSyncItem {
  id: string; // Product id in Catalog Studio
  odooId?: number;
  internalReference?: string;
  barcode?: string;
  category?: string;
}

export interface OdooSyncUpdate {
  id: string; // Product id in Catalog Studio
  odooId?: number;
  stock: number;
  customerPrice: number;
  salePrice?: number;
  productName?: string;
  internalReference?: string;
}

export interface OdooSyncResult {
  success: boolean;
  updatedCount: number;
  unmatchedCount: number;
  newCount?: number;
  newProducts?: Product[];
  updates: OdooSyncUpdate[];
  message?: string;
}

// ==========================================
// Purchase Order / Supplier Order Types (طلبية المورد)
// ==========================================

export interface PurchaseOrderItem {
  id: string;
  productName: string;
  barcode: string;
  category: string;
  internalReference: string;
  imageData?: string;
  imageStatus: ImageStatus;
  currentStock: number;
  customerPrice: number | string;
  salePrice?: number | string;
  requestedQuantity: number;
  notes?: string;
  selected: boolean;
  odooId?: number;
  shopifyId?: string | number;
  shopifyUrl?: string;
  shopifyDescription?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierName: string;
  fileName: string;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
  totalItems: number;
  totalSelectedItems: number;
  totalRequestedQuantity: number;
  design?: PurchaseOrderTableDesign;
}

export type PurchaseOrderColumnKey =
  | 'index'
  | 'image'
  | 'productName'
  | 'barcode'
  | 'requestedQuantity'
  | 'category'
  | 'internalReference'
  | 'currentStock'
  | 'customerPrice'
  | 'notes';

export interface PurchaseOrderColumnConfig {
  id: string;
  key: PurchaseOrderColumnKey;
  label: string;
  width: number; // percentage
  visible: boolean;
  alignment: 'right' | 'center' | 'left';
  order: number;
}

export interface PurchaseOrderTableDesign {
  columns: PurchaseOrderColumnConfig[];
  headerBackground: string;
  headerTextColor: string;
  alternateRowBackground: string;
  borderColor: string;
  fontSize: 'small' | 'medium' | 'large';
  rowPadding: 'compact' | 'normal' | 'relaxed';
  imageSize: 'small' | 'medium' | 'large';
  imageFit: 'contain' | 'cover';
  highlightQuantity: boolean;
  pageSize: 'A4' | 'single_long_page';
  orientation: 'portrait' | 'landscape';
  companyName: string;
  companySubtitle: string;
  companyLogo?: string;
  orderTitle: string;
  showSummaryCards: boolean;
  footerNotes: string;
}

// ==========================================
// Shopify Integration Types (متجر شوبيفاي)
// ==========================================
export interface ShopifyConfig {
  storeDomain?: string;
  myshopifyDomain?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

export interface ShopifyTestResult {
  tested: boolean;
  success: boolean;
  message: string;
  storeDomain?: string;
  myshopifyDomain?: string;
  productCount?: number;
  latencyMs?: number;
}

// ==========================================
// Customer Order / Client Order Sheet Types (طلبية الزبون التفاعلية)
// ==========================================

export interface CustomerOrderCustomerInfo {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface CustomerOrderItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  barcode?: string;
  internalReference?: string;
  imageData?: string;
  retailPrice: number; // سعر البيع المفرد
  formattedRetailPrice: string;
  wholesalePrice: number; // سعر الجملة
  formattedWholesalePrice: string;
  appliedPriceType?: 'wholesale' | 'retail'; // نوع السعر المطبق في الحساب
  unitPrice: number; // السعر النهائي المعتمد للقطعة
  formattedUnitPrice: string;
  requestedQuantity: number;
  subtotal: number;
  formattedSubtotal: string;
}

export interface CustomerOrderPayload {
  projectId: string;
  catalogTitle: string;
  pricingTier?: 'wholesale' | 'retail'; // نوع التسعير المعتمد للطلبية: جملة أو مفرد
  customerInfo: CustomerOrderCustomerInfo;
  items: CustomerOrderItem[];
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  currency: string;
  createdAt?: string;
}

export type CatalogDiscountMode = 'auto' | 'fixed_percent' | 'fixed_amount' | 'per_category';

export interface CatalogExcelExportColumns {
  index: boolean;
  image?: boolean;
  category: boolean;
  name: boolean;
  barcode: boolean;
  internalReference: boolean;
  originalPrice: boolean;
  discountPercent: boolean;
  discountAmount: boolean;
  finalPrice: boolean;
  salePrice: boolean;
  stock: boolean;
  unit: boolean;
  status: boolean;
  description: boolean;
  shopifyUrl: boolean;
}

export interface CatalogExcelExportConfig {
  projectName?: string;
  currency?: string;
  includeSummary?: boolean;
  includeImages?: boolean;
  scope: 'all' | 'included' | 'selected';
  selectedIds?: string[];
  excludeOutOfStock: boolean;
  sortByCategory: boolean;
  selectedCategories?: string[];
  discountMode: CatalogDiscountMode;
  fixedDiscountPercent: number;
  fixedDiscountAmount: number;
  categoryDiscounts: Record<string, number>;
  columns: CatalogExcelExportColumns;
}


