import { NextRequest, NextResponse } from 'next/server';
import {
  assertSafeOutboundUrl,
  cleanString,
  errorResponse,
  HttpError,
  readJsonBody,
  updateEnvFile,
} from '@/lib/security/server';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

/**
 * Saves Shopify connection settings into .env.local (server-side only).
 * Requires an authenticated session (enforced in middleware).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 10 * 1024);

    const rawStore = cleanString(body.storeDomain, 300);
    const storeDomain = rawStore ? assertSafeOutboundUrl(rawStore) : '';
    const myshopifyDomain = cleanString(body.myshopifyDomain, 200)
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .toLowerCase();
    const clientId = cleanString(body.clientId, 200);
    const clientSecret = cleanString(body.clientSecret, 300);

    if (myshopifyDomain && !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(myshopifyDomain)) {
      throw new HttpError(400, 'نطاق myshopify غير صالح (مثال: store-name.myshopify.com)');
    }
    if (clientId && !/^[A-Za-z0-9_-]{8,200}$/.test(clientId)) throw new HttpError(400, 'Client ID غير صالح');
    if (clientSecret && !/^[A-Za-z0-9_-]{8,300}$/.test(clientSecret)) throw new HttpError(400, 'Client Secret غير صالح');

    // Changing the store without new credentials would send the old secret to another store
    const envDomain = (process.env.SHOPIFY_MYSHOPIFY_DOMAIN || '').toLowerCase();
    if (myshopifyDomain && envDomain && myshopifyDomain !== envDomain && !clientSecret) {
      throw new HttpError(400, 'عند تغيير المتجر يجب إدخال Client Secret الخاص به');
    }

    updateEnvFile({
      SHOPIFY_STORE_DOMAIN: storeDomain || undefined,
      SHOPIFY_MYSHOPIFY_DOMAIN: myshopifyDomain || undefined,
      SHOPIFY_CLIENT_ID: clientId || undefined,
      SHOPIFY_CLIENT_SECRET: clientSecret || undefined,
    });
    logger.info('Shopify settings updated', { myshopifyDomain, secretChanged: !!clientSecret });

    return NextResponse.json({ success: true, message: 'تم حفظ إعدادات ربط Shopify بنجاح.' });
  } catch (error) {
    return errorResponse(error, 'فشل حفظ إعدادات Shopify', 'shopify/save-config');
  }
}
