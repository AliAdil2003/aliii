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

const FIELD_RE = /^[a-z_][a-z0-9_]{0,63}$/;

/**
 * Saves Odoo connection settings into .env.local (server-side only).
 * Requires an authenticated session (enforced in middleware).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 10 * 1024);

    const rawUrl = cleanString(body.url, 300);
    const url = rawUrl ? assertSafeOutboundUrl(rawUrl) : '';
    const db = cleanString(body.db, 120);
    const username = cleanString(body.username, 200);
    const apiKey = cleanString(body.apiKey, 300);
    const salePriceField = cleanString(body.salePriceField, 64);
    const customerPriceField = cleanString(body.customerPriceField, 64);

    if (salePriceField && !FIELD_RE.test(salePriceField)) throw new HttpError(400, 'اسم حقل سعر البيع غير صالح');
    if (customerPriceField && !FIELD_RE.test(customerPriceField)) throw new HttpError(400, 'اسم حقل سعر الزبون غير صالح');

    // Changing the server URL without re-entering the key would send the old key to a new server
    const envUrl = process.env.ODOO_URL || '';
    if (url && envUrl && url !== envUrl.replace(/\/+$/, '') && !apiKey) {
      throw new HttpError(400, 'عند تغيير رابط خادم Odoo يجب إدخال مفتاح API الخاص به');
    }

    updateEnvFile({
      ODOO_URL: url || undefined,
      ODOO_DB: db || undefined,
      ODOO_USERNAME: username || undefined,
      ODOO_API_KEY: apiKey || undefined,
      ODOO_SALE_PRICE_FIELD: salePriceField || undefined,
      ODOO_CUSTOMER_PRICE_FIELD: customerPriceField || undefined,
    });
    logger.info('Odoo settings updated', { url, db, keyChanged: !!apiKey });

    return NextResponse.json({ success: true, message: 'تم حفظ إعدادات ربط Odoo ERP بنجاح.' });
  } catch (error) {
    return errorResponse(error, 'فشل حفظ إعدادات Odoo', 'odoo/save-config');
  }
}
