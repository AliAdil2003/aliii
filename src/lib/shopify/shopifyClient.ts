/**
 * Shopify Admin REST/GraphQL Client for Catalog Studio
 * Handles automated Token Exchange via Client Credentials, product catalog synchronization,
 * and enriching Odoo ERP products with Shopify descriptions and live purchase links.
 */

import { Product, ShopifyConfig } from '@/types';

interface CachedToken {
  token: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;
let productsCache: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache for products

export function getResolvedShopifyConfig(customConfig?: Partial<ShopifyConfig>): Required<ShopifyConfig> {
  // All credentials come from server-side environment variables (.env.local).
  // No secrets are hardcoded in source code.
  const envMyshopify = (process.env.SHOPIFY_MYSHOPIFY_DOMAIN || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();

  const storeDomain = (
    customConfig?.storeDomain ||
    process.env.SHOPIFY_STORE_DOMAIN ||
    ''
  ).replace(/\/+$/, '');

  const myshopifyDomain = (customConfig?.myshopifyDomain || envMyshopify)
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();

  if (myshopifyDomain && !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(myshopifyDomain)) {
    throw new Error('نطاق myshopify غير صالح. يجب أن يكون بالشكل store-name.myshopify.com');
  }

  // Security: never send the stored secret to a different store domain than the one in .env
  const sameStoreAsEnv = !customConfig?.myshopifyDomain || myshopifyDomain === envMyshopify;

  const clientId =
    customConfig?.clientId || (sameStoreAsEnv ? process.env.SHOPIFY_CLIENT_ID : '') || '';

  const clientSecret =
    customConfig?.clientSecret || (sameStoreAsEnv ? process.env.SHOPIFY_CLIENT_SECRET : '') || '';

  const accessToken =
    customConfig?.accessToken || (sameStoreAsEnv ? process.env.SHOPIFY_ACCESS_TOKEN : '') || '';

  return {
    storeDomain,
    myshopifyDomain,
    clientId,
    clientSecret,
    accessToken,
  };
}

/**
 * Automatically retrieves or exchanges Client Credentials for a valid Shopify Access Token
 */
export async function getShopifyAccessToken(config?: Partial<ShopifyConfig>): Promise<string> {
  const resolved = getResolvedShopifyConfig(config);

  // If a manual permanent access token is provided, use it
  if (resolved.accessToken) {
    return resolved.accessToken;
  }

  // Check in-memory cached token (with 60-second safety window)
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return tokenCache.token;
  }

  if (!resolved.clientId || !resolved.clientSecret) {
    throw new Error('بيانات Client ID أو Client Secret لمتجر Shopify غير متوفرة.');
  }

  const tokenUrl = `https://${resolved.myshopifyDomain}/admin/oauth/access_token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: resolved.clientId,
      client_secret: resolved.clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`فشل الحصول على رمز الوصول من شوبيفاي (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('استجابة شوبيفاي لم تحتوي على access_token صالح.');
  }

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 86400;
  tokenCache = {
    token: data.access_token,
    expiresAt: now + expiresIn * 1000,
  };

  return tokenCache.token;
}

/**
 * Clean and normalize Shopify HTML descriptions into human-readable formatted Arabic text
 */
export function cleanShopifyHtmlDescription(html?: string): string {
  if (!html) return '';

  let cleaned = html
    // Replace breaks and list items with clean line breaks
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Remove redundant store price headlines like "سعر بيع الزبون \n 45,000 د.ع"
  cleaned = cleaned
    .replace(/سعر\s*(?:بيع)?\s*(?:الزبون|المفرد|الجملة)?[\s\S]*?(?:د\.ع|دينار|IQD|\$)/gi, '')
    .replace(/•\s*(?:سعر\s*البيع|المفرد|الجملة)[^\n]*/gi, '')
    .replace(/^\s*•\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If cleaning emptied the description, fallback to pure stripped text
  if (!cleaned.trim()) {
    cleaned = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return cleaned;
}

export interface ShopifyMatchedProduct {
  id: number;
  title: string;
  handle: string;
  purchaseUrl: string;
  rawDescription: string;
  cleanDescription: string;
  barcode: string;
  sku: string;
  price: string;
  imageUrl?: string;
}

/**
 * Fetches all active products from the Shopify Store (handling cursor/link pagination)
 */
export async function fetchAllShopifyProducts(
  config?: Partial<ShopifyConfig>,
  forceFresh = false
): Promise<any[]> {
  const now = Date.now();
  if (!forceFresh && productsCache && now - productsCache.timestamp < CACHE_TTL_MS) {
    return productsCache.data;
  }

  const resolved = getResolvedShopifyConfig(config);
  const token = await getShopifyAccessToken(config);
  const allProducts: any[] = [];
  let nextUrl: string | null = `https://${resolved.myshopifyDomain}/admin/api/2024-01/products.json?limit=250&status=active`;

  let pages = 0;
  while (nextUrl && pages < 10) {
    pages++;
    const res: Response = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`خطأ أثناء جلب المنتجات من شوبيفاي (${res.status}): ${err}`);
    }

    const data = await res.json();
    if (data.products && Array.isArray(data.products)) {
      allProducts.push(...data.products);
    }

    // Check pagination Link header
    const linkHeader = res.headers.get('link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = match ? match[1] : null;
    } else {
      nextUrl = null;
    }
  }

  productsCache = {
    data: allProducts,
    timestamp: now,
  };

  return allProducts;
}

/**
 * Builds indexing maps by barcode, sku, and title for O(1) matching
 */
export function buildShopifyIndex(
  shopifyProducts: any[],
  storeDomain: string
): {
  byBarcode: Map<string, ShopifyMatchedProduct>;
  bySku: Map<string, ShopifyMatchedProduct>;
  byTitle: Map<string, ShopifyMatchedProduct>;
} {
  const byBarcode = new Map<string, ShopifyMatchedProduct>();
  const bySku = new Map<string, ShopifyMatchedProduct>();
  const byTitle = new Map<string, ShopifyMatchedProduct>();

  const cleanDomain = storeDomain.replace(/\/+$/, '');

  for (const p of shopifyProducts) {
    const handle = p.handle || '';
    const purchaseUrl = `${cleanDomain}/products/${handle}`;
    const rawDescription = p.body_html || '';
    const cleanDescription = cleanShopifyHtmlDescription(rawDescription);
    const mainImageUrl = p.images && p.images[0]?.src ? p.images[0].src : undefined;

    // Index all variants of the product
    if (p.variants && Array.isArray(p.variants)) {
      for (const v of p.variants) {
        const item: ShopifyMatchedProduct = {
          id: p.id,
          title: p.title,
          handle,
          purchaseUrl: v.id ? `${purchaseUrl}?variant=${v.id}` : purchaseUrl,
          rawDescription,
          cleanDescription,
          barcode: (v.barcode || '').trim(),
          sku: (v.sku || '').trim(),
          price: v.price || '',
          imageUrl: v.image_id
            ? p.images?.find((img: any) => img.id === v.image_id)?.src || mainImageUrl
            : mainImageUrl,
        };

        if (item.barcode) {
          byBarcode.set(item.barcode, item);
          // Also index barcode without leading zeros
          byBarcode.set(item.barcode.replace(/^0+/, ''), item);
        }

        if (item.sku) {
          bySku.set(item.sku.toLowerCase(), item);
        }
      }
    }

    // Index title (normalized)
    if (p.title) {
      const normTitle = p.title.trim().toLowerCase();
      if (!byTitle.has(normTitle)) {
        byTitle.set(normTitle, {
          id: p.id,
          title: p.title,
          handle,
          purchaseUrl,
          rawDescription,
          cleanDescription,
          barcode: '',
          sku: '',
          price: p.variants?.[0]?.price || '',
          imageUrl: mainImageUrl,
        });
      }
    }
  }

  return { byBarcode, bySku, byTitle };
}

/**
 * Merges Odoo products with Shopify marketing descriptions and online purchase URLs
 */
export async function enrichOdooProductsWithShopify(
  odooProducts: Product[],
  config?: Partial<ShopifyConfig>
): Promise<{
  enrichedProducts: Product[];
  matchedCount: number;
  totalCount: number;
}> {
  const resolved = getResolvedShopifyConfig(config);
  const shopifyRaw = await fetchAllShopifyProducts(config);
  const { byBarcode, bySku, byTitle } = buildShopifyIndex(shopifyRaw, resolved.storeDomain);

  let matchedCount = 0;

  const enrichedProducts = odooProducts.map((prod) => {
    const rawBarcode = (prod.barcode || '').trim();
    const rawRef = (prod.internalReference || '').trim().toLowerCase();
    const rawName = (prod.name || '').trim().toLowerCase();

    // 1. Try matching by Barcode
    let match = rawBarcode ? byBarcode.get(rawBarcode) || byBarcode.get(rawBarcode.replace(/^0+/, '')) : undefined;

    // 2. Try matching by SKU / Internal Reference
    if (!match && rawRef) {
      match = bySku.get(rawRef);
    }

    // 3. Try matching by Name
    if (!match && rawName) {
      match = byTitle.get(rawName);
    }

    if (match) {
      matchedCount++;
      const shopifyDesc = match.cleanDescription || match.rawDescription;

      return {
        ...prod,
        shopifyId: match.id,
        shopifyUrl: match.purchaseUrl,
        shopifyHandle: match.handle,
        shopifyDescription: shopifyDesc,
        // The Shopify description completely replaces the Odoo description as the primary description
        originalDescription: shopifyDesc || prod.originalDescription,
        shortenedDescription: '', // Ready to be shortened fresh with Gemini
        customDescription: '',
        activeDescriptionType: 'original' as const,
      };
    }

    return prod;
  });

  return {
    enrichedProducts,
    matchedCount,
    totalCount: odooProducts.length,
  };
}
