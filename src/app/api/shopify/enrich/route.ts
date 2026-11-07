import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/security/server';
import { logger, redact } from '@/lib/security/logger';
import { enrichOdooProductsWithShopify } from '@/lib/shopify/shopifyClient';
import { Product } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 50 * 1024 * 1024);
    const { products } = body as { products: Product[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, message: 'مصفوفة المنتجات مطلوبة لإتمام عملية الدمج' },
        { status: 400 }
      );
    }

    const { enrichedProducts, matchedCount, totalCount } = await enrichOdooProductsWithShopify(products);

    return NextResponse.json({
      success: true,
      enrichedProducts,
      matchedCount,
      totalCount,
      message: `تم دمج الأوصاف وروابط الشراء من متجر Shopify لـ ${matchedCount} من أصل ${totalCount} منتج.`,
    });
  } catch (err: any) {
    logger.error('Shopify enrich error:', err);
    return NextResponse.json(
      {
        success: false,
        message: String(redact(err.message || 'حدث خطأ أثناء دمج بيانات شوبيفاي مع منتجات أودو')),
      },
      { status: 500 }
    );
  }
}
