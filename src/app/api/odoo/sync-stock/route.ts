import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/security/server';
import { redact } from '@/lib/security/logger';
import { syncOdooStock, getResolvedOdooConfig } from '@/lib/odoo/odooClient';
import { OdooSyncItem } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 50 * 1024 * 1024);
    const {
      items,
      projectId,
      categories,
      autoAddNewProducts = true,
      enrichWithShopify = true,
      config: customConfig,
    } = body as {
      items: OdooSyncItem[];
      projectId?: string;
      categories?: string[];
      autoAddNewProducts?: boolean;
      enrichWithShopify?: boolean;
      config?: any;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'قائمة المنتجات المراد تحديث كمياتها فارغة.' },
        { status: 400 }
      );
    }

    const config = getResolvedOdooConfig(customConfig);

    if (!config.url || !config.db || !config.username || !config.apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'إعدادات ربط Odoo غير مكتملة. يرجى ضبط الرابط وقاعدة البيانات والبريد الإلكتروني ومفتاح API في صفحة الإعدادات.',
        },
        { status: 400 }
      );
    }

    const syncResult = await syncOdooStock(config, items, {
      projectId,
      categories,
      autoAddNewProducts,
      enrichWithShopify,
    });
    return NextResponse.json(syncResult);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: String(redact(err.message || 'حدث خطأ أثناء مزامنة المخزون من Odoo')) },
      { status: 500 }
    );
  }
}
