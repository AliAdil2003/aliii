import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, maskSecret, readJsonBody } from '@/lib/security/server';
import { testOdooConnection, getResolvedOdooConfig } from '@/lib/odoo/odooClient';

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 10 * 1024);
    const config = getResolvedOdooConfig(body);

    if (!config.url) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال رابط خادم Odoo (مثال: https://company.odoo.com)' },
        { status: 400 }
      );
    }
    if (!config.db) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال اسم قاعدة بيانات Odoo' },
        { status: 400 }
      );
    }
    if (!config.username) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال البريد الإلكتروني أو اسم المستخدم لحساب Odoo' },
        { status: 400 }
      );
    }
    if (!config.apiKey) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال مفتاح API الخاص بـ Odoo' },
        { status: 400 }
      );
    }

    const result = await testOdooConnection(config);
    return NextResponse.json(result);
  } catch (err: any) {
    return errorResponse(err, 'حدث خطأ أثناء فحص اتصال Odoo', 'odoo/test-connection');
  }
}

export async function GET() {
  const config = getResolvedOdooConfig();
  // Only non-secret info + a masked key are returned to the browser
  const hasConfig = Boolean(config.url && config.db && config.username && config.apiKey);

  return NextResponse.json({
    configured: hasConfig,
    url: config.url || '',
    db: config.db || '',
    username: config.username || '',
    maskedApiKey: maskSecret(config.apiKey),
    salePriceField: config.salePriceField || 'lst_price',
    customerPriceField: config.customerPriceField || 'customer_sale_price',
  });
}
