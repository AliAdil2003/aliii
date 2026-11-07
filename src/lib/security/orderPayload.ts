/**
 * Validates and sanitizes a public customer-order payload.
 * The customer order page is public, so every field is treated as untrusted:
 *  - text is length-limited and HTML-escaped (prevents HTML injection in the PDF renderer)
 *  - numbers are coerced and bounded
 *  - images must be data: URIs or public http(s) URLs
 */
import { CustomerOrderPayload, CustomerOrderItem } from '@/types';
import { HttpError, escapeHtml, safeImageSrc } from './server';

const MAX_ITEMS = 2000;

function num(v: unknown, max = 1e12): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function text(v: unknown, maxLen: number, escape: boolean): string {
  if (v === null || v === undefined) return '';
  const s = String(v).slice(0, maxLen);
  return escape ? escapeHtml(s) : s;
}

export function sanitizeOrderPayload(raw: any, opts: { escape: boolean }): CustomerOrderPayload {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items) || raw.items.length === 0) {
    throw new HttpError(400, 'سلة الطلب فارغة، يرجى اختيار منتج واحد على الأقل');
  }
  if (raw.items.length > MAX_ITEMS) {
    throw new HttpError(400, `عدد المواد في الطلب يتجاوز الحد المسموح (${MAX_ITEMS})`);
  }
  const e = opts.escape;

  const items: CustomerOrderItem[] = raw.items.map((it: any) => ({
    id: text(it?.id, 100, e),
    name: text(it?.name, 300, e),
    description: text(it?.description, 1000, e),
    category: text(it?.category, 120, e),
    barcode: text(it?.barcode, 80, e),
    internalReference: text(it?.internalReference, 80, e),
    imageData: e ? safeImageSrc(it?.imageData) : '',
    retailPrice: num(it?.retailPrice),
    formattedRetailPrice: text(it?.formattedRetailPrice, 40, e),
    wholesalePrice: num(it?.wholesalePrice),
    formattedWholesalePrice: text(it?.formattedWholesalePrice, 40, e),
    appliedPriceType: it?.appliedPriceType === 'retail' ? 'retail' : 'wholesale',
    unitPrice: num(it?.unitPrice),
    formattedUnitPrice: text(it?.formattedUnitPrice, 40, e),
    requestedQuantity: Math.floor(num(it?.requestedQuantity, 1e7)),
    subtotal: num(it?.subtotal),
    formattedSubtotal: text(it?.formattedSubtotal, 40, e),
  }));

  const ci = raw.customerInfo || {};
  return {
    projectId: text(raw.projectId, 80, e),
    catalogTitle: text(raw.catalogTitle, 200, e),
    pricingTier: raw.pricingTier === 'retail' ? 'retail' : 'wholesale',
    customerInfo: {
      name: text(ci.name, 120, e),
      phone: text(ci.phone, 40, e),
      address: text(ci.address, 300, e),
      notes: text(ci.notes, 1000, e),
    },
    items,
    totalItems: Math.floor(num(raw.totalItems, 1e7)),
    totalQuantity: Math.floor(num(raw.totalQuantity, 1e9)),
    totalAmount: num(raw.totalAmount),
    currency: text(raw.currency, 12, e),
    createdAt: typeof raw.createdAt === 'string' && !isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : undefined,
  };
}
