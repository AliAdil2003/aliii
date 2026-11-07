import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/security/server';
import { logger, redact } from '@/lib/security/logger';
import { fetchOdooProducts, fetchOdooCategories, getResolvedOdooConfig } from '@/lib/odoo/odooClient';
import { enrichOdooProductsWithShopify } from '@/lib/shopify/shopifyClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 50 * 1024 * 1024);
    const {
      config: customConfig,
      projectId,
      limit,
      offset,
      search,
      categoryId,
      onlyWithStock,
      includeImages,
      loadCategories,
      enrichWithShopify = true,
    } = body;

    const config = getResolvedOdooConfig(customConfig);

    if (!config.url || !config.db || !config.username || !config.apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'إعدادات ربط Odoo غير مكتملة. يرجى ضبط الرابط، قاعدة البيانات، المستخدم، ومفتاح الـ API في صفحة الإعدادات.',
        },
        { status: 400 }
      );
    }

    // Optional: Load categories list if requested
    let categories: any[] = [];
    if (loadCategories) {
      try {
        categories = await fetchOdooCategories(config);
      } catch (catErr: any) {
        logger.error('Failed to load Odoo categories:', catErr?.message || catErr);
      }

      // If caller only needs the categories list, return immediately for maximum speed
      if (body.categoriesOnly || limit === 0) {
        return NextResponse.json({
          success: true,
          categories,
          products: [],
          totalCount: 0,
        });
      }
    }

    const { products, totalCount } = await fetchOdooProducts(config, {
      projectId,
      limit: limit ?? 250,
      offset: offset ?? 0,
      search,
      categoryId,
      onlyWithStock: onlyWithStock ?? false,
      includeImages: includeImages ?? true,
    });

    let finalProducts = products;
    let shopifyMatchedCount = 0;

    // Automatically enrich products with marketing description & purchase link from Shopify
    if (enrichWithShopify && products.length > 0) {
      try {
        const enriched = await enrichOdooProductsWithShopify(products);
        finalProducts = enriched.enrichedProducts;
        shopifyMatchedCount = enriched.matchedCount;
      } catch (shopifyErr: any) {
        logger.warn('Shopify auto-enrich skipped or error:', shopifyErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      products: finalProducts,
      totalCount,
      categories,
      count: finalProducts.length,
      shopifyMatchedCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: String(redact(err.message || 'حدث خطأ أثناء جلب المنتجات من Odoo')) },
      { status: 500 }
    );
  }
}
