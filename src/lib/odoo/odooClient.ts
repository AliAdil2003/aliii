import { logger } from '@/lib/security/logger';
import {
  OdooConfig,
  OdooTestResult,
  OdooProductRaw,
  OdooSyncItem,
  OdooSyncResult,
  OdooSyncUpdate,
  Product,
} from '@/types';
import { cleanInternalRefFromName } from '../excel/parser';
import { assertSafeOutboundUrl } from '@/lib/security/server';

/**
 * Normalizes Odoo Base URL ensuring only the protocol + host (origin), stripping /odoo, /web, etc.
 */
export function normalizeOdooUrl(url: string): string {
  let cleaned = (url || '').trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  try {
    const parsed = new URL(cleaned);
    return parsed.origin; // e.g. "https://e-zone-iraq.odoo.com"
  } catch {
    return cleaned.replace(/\/+$/, '');
  }
}

/**
 * Automatically discovers the exact Odoo database name from the server or URL
 */
export async function discoverOdooDatabase(url: string, requestedDb?: string): Promise<string> {
  const normalized = normalizeOdooUrl(url);
  const cleanedReq = (requestedDb || '').trim();
  const isValidDbIdentifier = cleanedReq && /^[a-zA-Z0-9_\-\.]+$/.test(cleanedReq);

  // 1. Try querying /web/database/list directly from Odoo server
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${normalized}/web/database/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {}, id: 1 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.result && Array.isArray(data.result) && data.result.length > 0) {
      const serverDbs: string[] = data.result;
      if (isValidDbIdentifier && serverDbs.includes(cleanedReq)) {
        return cleanedReq;
      }
      return serverDbs[0]; // e.g. "husamra723-e-zone-main-33171408"
    }
  } catch {}

  // 2. If odoo.com domain and db has Arabic or is invalid, fallback to subdomain
  try {
    const parsed = new URL(normalized);
    if (parsed.hostname.endsWith('.odoo.com')) {
      const subdomain = parsed.hostname.replace('.odoo.com', '');
      if (!isValidDbIdentifier) {
        return subdomain;
      }
    }
  } catch {}

  return cleanedReq || 'odoo';
}

/**
 * Executes a native JSON-RPC call against Odoo's standard /jsonrpc endpoint
 */
export async function callOdooJsonRpc<T = any>(
  url: string,
  service: 'common' | 'object',
  method: string,
  args: any[],
  timeoutMs: number = 20000
): Promise<T> {
  const normalizedUrl = normalizeOdooUrl(url);
  const endpoint = `${normalizedUrl}/jsonrpc`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service,
      method,
      args,
    },
    id: Math.floor(Math.random() * 1000000),
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'CatalogStudio/1.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`خطأ في استجابة خادم Odoo (HTTP ${response.status}: ${response.statusText})`);
    }

    const data = await response.json();

    if (data.error) {
      const errObj = data.error;
      const errMsg =
        errObj.data?.message || errObj.message || errObj.data?.debug || JSON.stringify(errObj);
      throw new Error(`خطأ Odoo API: ${errMsg}`);
    }

    return data.result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بخادم Odoo (Timeout). يرجى التأكد من صحة الرابط وسرعة الاتصال.');
    }
    throw err;
  }
}

// In-memory cache for available fields per Odoo server + database
const odooFieldsCache = new Map<string, string[]>();

/**
 * Dynamically queries available fields on an Odoo model (e.g. product.product)
 */
export async function getOdooModelFields(
  url: string,
  db: string,
  uid: number,
  apiKey: string,
  model: string = 'product.product'
): Promise<string[]> {
  const normalized = normalizeOdooUrl(url);
  const cacheKey = `${normalized}_${db}_${model}`;
  if (odooFieldsCache.has(cacheKey)) {
    return odooFieldsCache.get(cacheKey)!;
  }
  try {
    const res = await callOdooJsonRpc<Record<string, any>>(
      normalized,
      'object',
      'execute_kw',
      [db, uid, apiKey, model, 'fields_get', [], { attributes: ['string', 'type'] }],
      8000
    );
    if (res && typeof res === 'object') {
      const fieldNames = Object.keys(res);
      odooFieldsCache.set(cacheKey, fieldNames);
      return fieldNames;
    }
  } catch {}
  return [];
}

/**
 * Maps Odoo product prices according to business rules:
 * 1. Odoo "سعر البيع" (Sales Price: lst_price / list_price) -> Catalog Studio "سعر البيع (الجملة)" (salePrice)
 * 2. Odoo "سعر بيع الزبون" (Customer Sale Price: customer_sale_price / custom field) -> Catalog Studio "سعر بيع الزبون" (customerPrice)
 * 3. Strictly NEVER use standard_price (Cost / التكلفة).
 */
export function extractOdooPrices(
  raw: Record<string, any>,
  config?: { customCustomerPriceField?: string; customSalePriceField?: string }
): {
  customerPrice: number;
  salePrice: number;
} {
  // 1. Odoo "سعر البيع" (Sales Price -> سعر البيع للجملة)
  let salePrice = 0;
  if (config?.customSalePriceField && typeof raw[config.customSalePriceField] === 'number') {
    salePrice = raw[config.customSalePriceField];
  } else if (typeof raw.lst_price === 'number') {
    salePrice = raw.lst_price;
  } else if (typeof raw.list_price === 'number') {
    salePrice = raw.list_price;
  }

  // 2. Odoo "سعر بيع الزبون" (Customer Sale Price -> سعر بيع الزبون)
  let customerPrice = 0;
  if (config?.customCustomerPriceField && typeof raw[config.customCustomerPriceField] === 'number') {
    customerPrice = raw[config.customCustomerPriceField];
  } else {
    // Check known customer price fields in Odoo
    const candidateCustomerFields = [
      'customer_sale_price',
      'x_customer_price',
      'x_studio_customer_price',
      'x_retail_price',
      'x_customer_sale_price',
      'retail_price',
      'customer_price',
    ];
    for (const f of candidateCustomerFields) {
      if (typeof raw[f] === 'number' && raw[f] > 0) {
        customerPrice = raw[f];
        break;
      }
    }
  }

  // Fallback rules:
  // - If customerPrice is > 0, keep it. If 0 or missing, fallback to salePrice (wholesale price).
  // - If salePrice is > 0, keep it. If 0, fallback to customerPrice.
  // - CRITICAL: NEVER use standard_price (Cost / التكلفة).
  const finalCustomerPrice = customerPrice > 0 ? customerPrice : (salePrice > 0 ? salePrice : 0);
  const finalSalePrice = salePrice > 0 ? salePrice : (customerPrice > 0 ? customerPrice : 0);

  return {
    customerPrice: finalCustomerPrice,
    salePrice: finalSalePrice,
  };
}

/**
 * Authenticates with Odoo using standard credentials & API key, returning user ID (uid)
 */
export async function authenticateOdoo(
  config: OdooConfig
): Promise<{ uid: number; serverVersion?: string; database: string; effectiveUsername: string }> {
  if (!config.url || !config.url.trim()) {
    throw new Error('رابط خادم Odoo مطلوب.');
  }
  if (!config.username || !config.username.trim()) {
    throw new Error('اسم المستخدم أو البريد الإلكتروني لحساب Odoo مطلوب.');
  }
  if (!config.apiKey || !config.apiKey.trim()) {
    throw new Error('مفتاح API الخاص بـ Odoo مطلوب.');
  }

  const normalizedUrl = normalizeOdooUrl(config.url);
  // Auto-discover exact database name from Odoo server or fallback to subdomain
  const effectiveDb = await discoverOdooDatabase(normalizedUrl, config.db);

  const primaryUser = config.username.trim();
  // Candidate logins to try: primary provided username, and company/system account
  const candidateUsers = [primaryUser];
  if (primaryUser !== 'المنطقة التقنية') {
    candidateUsers.push('المنطقة التقنية');
  }

  let uid: any = null;
  let successfulUsername = primaryUser;

  for (const userCandidate of candidateUsers) {
    try {
      const res = await callOdooJsonRpc(
        normalizedUrl,
        'common',
        'authenticate',
        [effectiveDb, userCandidate, config.apiKey.trim(), {}]
      );
      if (typeof res === 'number') {
        uid = res;
        successfulUsername = userCandidate;
        break;
      }
    } catch {}

    // Fallback to "login"
    try {
      const res = await callOdooJsonRpc(
        normalizedUrl,
        'common',
        'login',
        [effectiveDb, userCandidate, config.apiKey.trim()]
      );
      if (typeof res === 'number') {
        uid = res;
        successfulUsername = userCandidate;
        break;
      }
    } catch {}
  }

  if (!uid || typeof uid !== 'number') {
    throw new Error(
      `فشل التحقق من البريد أو مفتاح API في Odoo (قاعدة البيانات: ${effectiveDb}). يرجى التأكد من أن اسم المستخدم هو "${primaryUser}" ومفتاح الـ API صحيح.`
    );
  }

  // Get server version info
  let serverVersion: string | undefined;
  try {
    const versionInfo = await callOdooJsonRpc(normalizedUrl, 'common', 'version', []);
    if (versionInfo && versionInfo.server_version) {
      serverVersion = versionInfo.server_version;
    }
  } catch {}

  return { uid, serverVersion, database: effectiveDb, effectiveUsername: successfulUsername };
}

/**
 * Tests connection with Odoo and retrieves company info, product count, and detected price fields
 */
export async function testOdooConnection(config: OdooConfig): Promise<OdooTestResult> {
  const startTime = Date.now();
  try {
    const normalizedUrl = normalizeOdooUrl(config.url);
    const { uid, serverVersion, database: effectiveDb, effectiveUsername } = await authenticateOdoo(config);
    const latencyMs = Date.now() - startTime;

    // Fetch user details & company name
    let userName: string | undefined = effectiveUsername;
    let companyName: string | undefined;
    try {
      const userRecords = await callOdooJsonRpc<any[]>(
        normalizedUrl,
        'object',
        'execute_kw',
        [
          effectiveDb,
          uid,
          config.apiKey.trim(),
          'res.users',
          'read',
          [[uid]],
          { fields: ['name', 'company_id'] },
        ]
      );
      if (userRecords && userRecords.length > 0) {
        userName = userRecords[0].name;
        if (Array.isArray(userRecords[0].company_id)) {
          companyName = userRecords[0].company_id[1];
        }
      }
    } catch {}

    // Count available active products in warehouse
    let totalProducts = 0;
    try {
      totalProducts = await callOdooJsonRpc<number>(
        normalizedUrl,
        'object',
        'execute_kw',
        [
          effectiveDb,
          uid,
          config.apiKey.trim(),
          'product.product',
          'search_count',
          [[['active', '=', true]]],
        ]
      );
    } catch {}

    // Detect available price fields on product.product
    let detectedCustomerPriceField: string | undefined;
    let detectedSalePriceField: string | undefined;
    try {
      const availableFields = await getOdooModelFields(normalizedUrl, effectiveDb, uid, config.apiKey.trim());
      if (availableFields.includes('customer_sale_price')) {
        detectedCustomerPriceField = 'customer_sale_price (سعر بيع الزبون)';
      } else if (availableFields.includes('x_customer_price')) {
        detectedCustomerPriceField = 'x_customer_price';
      } else if (availableFields.includes('x_studio_customer_price')) {
        detectedCustomerPriceField = 'x_studio_customer_price';
      }

      if (availableFields.includes('lst_price')) {
        detectedSalePriceField = 'lst_price (سعر البيع / الجملة)';
      } else if (availableFields.includes('list_price')) {
        detectedSalePriceField = 'list_price';
      }
    } catch {}

    return {
      success: true,
      message: 'تم الاتصال بخادم Odoo بنجاح!',
      uid,
      serverVersion,
      database: effectiveDb,
      userName,
      companyName,
      totalProducts,
      latencyMs,
      detectedCustomerPriceField,
      detectedSalePriceField,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'تعذر الاتصال بـ Odoo.',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Fetches products from Odoo directly and formats them into Catalog Studio Product items
 */
export async function fetchOdooProducts(
  config: OdooConfig,
  options?: {
    projectId?: string;
    limit?: number;
    offset?: number;
    search?: string;
    categoryId?: number;
    onlyWithStock?: boolean;
    includeImages?: boolean;
  }
): Promise<{ products: Product[]; totalCount: number }> {
  const normalizedUrl = normalizeOdooUrl(config.url);
  const { uid, database: effectiveDb } = await authenticateOdoo(config);
  const projectId = options?.projectId || 'odoo_catalog';
  const limit = options?.limit ?? 200;
  const offset = options?.offset ?? 0;
  const includeImages = options?.includeImages ?? true;

  // Build Odoo domain
  const domain: any[] = [['active', '=', true]];

  if (options?.onlyWithStock) {
    domain.push(['qty_available', '>', 0]);
  }

  if (options?.categoryId) {
    domain.push(['categ_id', '=', options.categoryId]);
  }

  if (options?.search && options.search.trim()) {
    const q = options.search.trim();
    domain.push('|', '|', ['name', 'ilike', q], ['default_code', 'ilike', q], ['barcode', 'ilike', q]);
  }

  // Count total matching
  const totalCount = await callOdooJsonRpc<number>(
    normalizedUrl,
    'object',
    'execute_kw',
    [effectiveDb, uid, config.apiKey.trim(), 'product.product', 'search_count', [domain]]
  );

  // Dynamically inspect available fields from Odoo to avoid ValueError
  const availableFields = await getOdooModelFields(normalizedUrl, effectiveDb, uid, config.apiKey.trim());

  // Candidate fields to retrieve - strictly excluding standard_price (Cost / التكلفة)
  const candidateFields = [
    'id',
    'name',
    'display_name',
    'default_code',
    'barcode',
    'lst_price',
    'list_price',
    'customer_sale_price',
    'x_customer_price',
    'x_studio_customer_price',
    'x_retail_price',
    'retail_price',
    'customer_price',
    'qty_available',
    'categ_id',
    'description_sale',
    'description',
    'uom_id',
    'currency_id',
  ];

  if (config.customerPriceField && !candidateFields.includes(config.customerPriceField)) {
    candidateFields.push(config.customerPriceField);
  }
  if (config.salePriceField && !candidateFields.includes(config.salePriceField)) {
    candidateFields.push(config.salePriceField);
  }
  if (includeImages) {
    candidateFields.push('image_512', 'image_1920');
  }

  // Filter requested fields to ONLY those that actually exist in this Odoo instance
  // Strictly NEVER include standard_price (التكلفة)
  const fields = availableFields.length > 0
    ? candidateFields.filter((f) => availableFields.includes(f) && f !== 'standard_price')
    : candidateFields.filter((f) => f !== 'standard_price');

  const rawProducts = await callOdooJsonRpc<OdooProductRaw[]>(
    normalizedUrl,
    'object',
    'execute_kw',
    [
      effectiveDb,
      uid,
      config.apiKey.trim(),
      'product.product',
      'search_read',
      [domain],
      {
        fields,
        limit,
        offset,
        order: 'categ_id asc, name asc',
      },
    ]
  );

  const now = new Date().toISOString();
  const products: Product[] = (rawProducts || []).map((raw, index) => {
    const internalRef = raw.default_code && typeof raw.default_code === 'string' ? raw.default_code.trim() : '';
    const rawName = raw.name || `منتج Odoo #${raw.id}`;
    // Strip internal reference from name so it remains clean
    const cleanedName = cleanInternalRefFromName(rawName, internalRef);

    const barcode = raw.barcode && typeof raw.barcode === 'string' ? raw.barcode.trim() : '';
    
    // Extract prices accurately according to business rules:
    // Odoo "سعر البيع" (lst_price) -> سعر البيع (الجملة)
    // Odoo "سعر بيع الزبون" (customer_sale_price) -> سعر بيع الزبون
    // Strictly NO standard_price (Cost / التكلفة)
    const { customerPrice, salePrice } = extractOdooPrices(raw, {
      customCustomerPriceField: config.customerPriceField,
      customSalePriceField: config.salePriceField,
    });

    const stock = Math.max(0, Math.round(raw.qty_available || 0));

    let category = 'عام';
    if (Array.isArray(raw.categ_id) && raw.categ_id.length > 1) {
      category = String(raw.categ_id[1]).trim();
    }

    const desc = (raw.description_sale || raw.description || '').trim();
    const shortenedDesc = desc.length > 150 ? desc.substring(0, 140) + '...' : desc;

    // Handle Odoo Base64 image
    let imageData = '';
    let imageStatus: 'valid' | 'missing' = 'missing';

    const rawImg = raw.image_512 || raw.image_1920;
    if (rawImg && typeof rawImg === 'string' && rawImg.trim().length > 10) {
      imageData = rawImg.startsWith('data:') ? rawImg : `data:image/png;base64,${rawImg}`;
      imageStatus = 'valid';
    }

    let unit = undefined;
    if (Array.isArray(raw.uom_id) && raw.uom_id.length > 1) {
      unit = String(raw.uom_id[1]);
    }

    return {
      id: `prod_odoo_${raw.id}_${Date.now()}_${index}`,
      projectId,
      odooId: raw.id,
      name: cleanedName,
      originalName: cleanedName,
      shortenedName: '',
      activeNameType: 'original',
      originalDescription: desc,
      shortenedDescription: shortenedDesc,
      activeDescriptionType: 'original',
      barcode,
      price: customerPrice,
      customerPrice,
      salePrice,
      stock,
      availableQuantity: raw.qty_available || 0,
      category,
      internalReference: internalRef,
      unit,
      imageData,
      imageStatus,
      includedInCatalog: true,
      order: index + 1,
      createdAt: now,
      updatedAt: now,
    };
  });

  return { products, totalCount };
}

/**
 * Synchronizes live stock quantities and prices from Odoo for an existing list of catalog products,
 * AND automatically imports and appends any newly added products from Odoo matching the project's brand/categories.
 */
export async function syncOdooStock(
  config: OdooConfig,
  items: OdooSyncItem[],
  options?: {
    projectId?: string;
    autoAddNewProducts?: boolean;
    categories?: string[];
    enrichWithShopify?: boolean;
    includeImages?: boolean;
  }
): Promise<OdooSyncResult> {
  const autoAdd = options?.autoAddNewProducts ?? true;
  const projectId = options?.projectId || 'odoo_catalog';

  if (!items || items.length === 0) {
    if (!autoAdd) {
      return {
        success: true,
        updatedCount: 0,
        unmatchedCount: 0,
        newCount: 0,
        newProducts: [],
        updates: [],
        message: 'لا توجد منتجات محددة للمزامنة.',
      };
    }
  }

  const normalizedUrl = normalizeOdooUrl(config.url);
  const { uid, database: effectiveDb } = await authenticateOdoo(config);

  const odooIds: number[] = [];
  const defaultCodes: string[] = [];
  const barcodes: string[] = [];

  const itemMapByOdooId = new Map<number, OdooSyncItem>();
  const itemMapByCode = new Map<string, OdooSyncItem>();
  const itemMapByBarcode = new Map<string, OdooSyncItem>();

  (items || []).forEach((item) => {
    if (item.odooId) {
      odooIds.push(item.odooId);
      itemMapByOdooId.set(item.odooId, item);
    }
    if (item.internalReference && item.internalReference.trim()) {
      const code = item.internalReference.trim();
      defaultCodes.push(code);
      itemMapByCode.set(code, item);
    }
    if (item.barcode && item.barcode.trim()) {
      const b = item.barcode.trim();
      barcodes.push(b);
      itemMapByBarcode.set(b, item);
    }
  });

  // Resolve project categories to discover new products in Odoo for the same brands
  const projectCategories = (
    options?.categories ||
    (items || []).map((i) => i.category).filter(Boolean) as string[]
  ).filter((c) => c && c !== 'عام');
  const uniqueCatNames = Array.from(new Set(projectCategories));

  let catIds: number[] = [];
  if (autoAdd && uniqueCatNames.length > 0) {
    try {
      const catRecords = await callOdooJsonRpc<any[]>(
        normalizedUrl,
        'object',
        'execute_kw',
        [
          effectiveDb,
          uid,
          config.apiKey.trim(),
          'product.category',
          'search_read',
          [[['name', 'in', uniqueCatNames]]],
          { fields: ['id', 'name'] },
        ]
      );
      if (catRecords && Array.isArray(catRecords)) {
        catIds = catRecords.map((c) => c.id);
      }
    } catch (e) {
      logger.warn('Failed to resolve category IDs in Odoo:', e);
    }
  }

  // Build conditions matching existing items OR brand categories
  const conditions: any[] = [];
  if (catIds.length > 0) {
    conditions.push(['categ_id', 'in', catIds]);
  }
  if (odooIds.length > 0) {
    conditions.push(['id', 'in', odooIds]);
  }
  if (defaultCodes.length > 0) {
    conditions.push(['default_code', 'in', defaultCodes]);
  }
  if (barcodes.length > 0) {
    conditions.push(['barcode', 'in', barcodes]);
  }

  // If no specific conditions and autoAdd is enabled, query active products
  if (conditions.length === 0) {
    if (autoAdd) {
      conditions.push(['active', '=', true]);
    } else {
      return {
        success: true,
        updatedCount: 0,
        unmatchedCount: items.length,
        newCount: 0,
        newProducts: [],
        updates: [],
        message: 'لم يتم العثور على معرفات Odoo أو مراجع داخلية أو باركودات لمطابقتها.',
      };
    }
  }

  // Construct standard prefix OR domain in Odoo syntax: ['|', '|', c1, c2, c3]
  let domain: any[];
  if (conditions.length === 1) {
    domain = [conditions[0]];
  } else {
    domain = [];
    for (let i = 0; i < conditions.length - 1; i++) {
      domain.push('|');
    }
    for (const cond of conditions) {
      domain.push(cond);
    }
  }

  // Dynamically inspect available fields
  const availableFields = await getOdooModelFields(normalizedUrl, effectiveDb, uid, config.apiKey.trim());

  const candidateSyncFields = [
    'id',
    'name',
    'default_code',
    'barcode',
    'lst_price',
    'list_price',
    'customer_sale_price',
    'x_customer_price',
    'x_studio_customer_price',
    'x_retail_price',
    'retail_price',
    'customer_price',
    'qty_available',
    'categ_id',
    'description_sale',
    'description',
    'uom_id',
    'image_512',
    'image_1920',
  ];

  if (config.customerPriceField && !candidateSyncFields.includes(config.customerPriceField)) {
    candidateSyncFields.push(config.customerPriceField);
  }
  if (config.salePriceField && !candidateSyncFields.includes(config.salePriceField)) {
    candidateSyncFields.push(config.salePriceField);
  }

  const fields = availableFields.length > 0
    ? candidateSyncFields.filter((f) => availableFields.includes(f) && f !== 'standard_price')
    : candidateSyncFields.filter((f) => f !== 'standard_price');

  const odooRecords = await callOdooJsonRpc<OdooProductRaw[]>(
    normalizedUrl,
    'object',
    'execute_kw',
    [
      effectiveDb,
      uid,
      config.apiKey.trim(),
      'product.product',
      'search_read',
      [domain],
      {
        fields,
        limit: 1000,
        order: 'categ_id asc, name asc',
      },
    ]
  );

  const updates: OdooSyncUpdate[] = [];
  const matchedCatalogIds = new Set<string>();
  let newProducts: Product[] = [];
  const now = new Date().toISOString();

  (odooRecords || []).forEach((rec) => {
    let matchedItem: OdooSyncItem | undefined;

    // Match priority: 1. odooId, 2. default_code, 3. barcode
    if (itemMapByOdooId.has(rec.id)) {
      matchedItem = itemMapByOdooId.get(rec.id);
    } else if (rec.default_code && itemMapByCode.has(rec.default_code.trim())) {
      matchedItem = itemMapByCode.get(rec.default_code.trim());
    } else if (rec.barcode && itemMapByBarcode.has(rec.barcode.trim())) {
      matchedItem = itemMapByBarcode.get(rec.barcode.trim());
    }

    const stock = Math.max(0, Math.round(rec.qty_available || 0));
    const { customerPrice, salePrice } = extractOdooPrices(rec, {
      customCustomerPriceField: config.customerPriceField,
      customSalePriceField: config.salePriceField,
    });

    if (matchedItem) {
      if (!matchedCatalogIds.has(matchedItem.id)) {
        matchedCatalogIds.add(matchedItem.id);
        updates.push({
          id: matchedItem.id,
          odooId: rec.id,
          stock,
          customerPrice,
          salePrice,
          internalReference: rec.default_code ? String(rec.default_code).trim() : undefined,
        });
      }
    } else if (autoAdd) {
      // BRAND NEW PRODUCT ADDED IN ODOO!
      const rawName = rec.name || `منتج Odoo #${rec.id}`;
      const internalRef = rec.default_code && typeof rec.default_code === 'string' ? rec.default_code.trim() : '';
      const cleanedName = cleanInternalRefFromName(rawName, internalRef);
      const barcode = rec.barcode && typeof rec.barcode === 'string' ? rec.barcode.trim() : '';

      let category = 'عام';
      if (Array.isArray(rec.categ_id) && rec.categ_id.length > 1) {
        category = String(rec.categ_id[1]).trim();
      }

      const desc = (rec.description_sale || rec.description || '').trim();
      const shortenedDesc = desc.length > 150 ? desc.substring(0, 140) + '...' : desc;

      let imageData = '';
      let imageStatus: 'valid' | 'missing' = 'missing';
      const rawImg = rec.image_512 || rec.image_1920;
      if (rawImg && typeof rawImg === 'string' && rawImg.trim().length > 10) {
        imageData = rawImg.startsWith('data:') ? rawImg : `data:image/png;base64,${rawImg}`;
        imageStatus = 'valid';
      }

      newProducts.push({
        id: `prod_odoo_${rec.id}_${Date.now()}_${newProducts.length}`,
        projectId,
        odooId: rec.id,
        name: cleanedName,
        originalName: cleanedName,
        shortenedName: '',
        activeNameType: 'original',
        originalDescription: desc,
        shortenedDescription: shortenedDesc,
        activeDescriptionType: 'original',
        barcode,
        price: customerPrice,
        customerPrice,
        salePrice,
        stock,
        availableQuantity: stock,
        category,
        internalReference: internalRef || '',
        imageData,
        imageStatus,
        includedInCatalog: true,
        order: (items?.length || 0) + newProducts.length + 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  // Automatically enrich newly added Odoo products with Shopify marketing descriptions & purchase links
  if (options?.enrichWithShopify !== false && newProducts.length > 0) {
    try {
      const { enrichOdooProductsWithShopify } = await import('@/lib/shopify/shopifyClient');
      const enriched = await enrichOdooProductsWithShopify(newProducts);
      newProducts = enriched.enrichedProducts;
    } catch (err) {
      logger.warn('Shopify enrichment for new Odoo products:', err);
    }
  }

  let message = `تمت مزامنة وتحديث كميات وأسعار ${updates.length} منتج مباشرة من مخزن Odoo بنجاح!`;
  if (newProducts.length > 0) {
    message = `تم تحديث ${updates.length} منتج، وإضافة ${newProducts.length} منتج جديد تم العثور عليه في Odoo إلى الملف تلقائياً!`;
  }

  return {
    success: true,
    updatedCount: updates.length,
    unmatchedCount: (items?.length || 0) - updates.length,
    newCount: newProducts.length,
    newProducts,
    updates,
    message,
  };
}

/**
 * Retrieves Odoo product categories
 */
export async function fetchOdooCategories(
  config: OdooConfig
): Promise<{ id: number; name: string; displayName: string }[]> {
  const normalizedUrl = normalizeOdooUrl(config.url);
  const { uid, database: effectiveDb } = await authenticateOdoo(config);
  const records = await callOdooJsonRpc<any[]>(
    normalizedUrl,
    'object',
    'execute_kw',
    [
      effectiveDb,
      uid,
      config.apiKey.trim(),
      'product.category',
      'search_read',
      [[]],
      { fields: ['id', 'name', 'display_name'] },
    ]
  );

  return (records || []).map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.display_name || r.name,
  }));
}

/**
 * Resolves Odoo configuration from parameters or environment variables
 */
export function getResolvedOdooConfig(customConfig?: Partial<OdooConfig>): OdooConfig {
  // All credentials come from server-side environment variables (.env.local).
  const envUrl = (process.env.ODOO_URL || '').trim();
  const originOf = (u: string) => {
    try {
      return new URL(u.startsWith('http') ? u : `https://${u}`).origin.toLowerCase();
    } catch {
      return '';
    }
  };

  let url = envUrl;
  if (customConfig?.url && customConfig.url.trim()) {
    // A user-supplied URL must be a public https address (prevents SSRF)
    url = assertSafeOutboundUrl(customConfig.url.trim());
  }

  // Security: never send the stored API key to a server other than ODOO_URL
  const sameServerAsEnv = !customConfig?.url || originOf(url) === originOf(envUrl);

  return {
    url,
    db: customConfig?.db || process.env.ODOO_DB || '',
    username: customConfig?.username || process.env.ODOO_USERNAME || '',
    apiKey: customConfig?.apiKey || (sameServerAsEnv ? process.env.ODOO_API_KEY : '') || '',
    salePriceField: customConfig?.salePriceField || process.env.ODOO_SALE_PRICE_FIELD || 'lst_price',
    customerPriceField: customConfig?.customerPriceField || process.env.ODOO_CUSTOMER_PRICE_FIELD || 'customer_sale_price',
  };
}
