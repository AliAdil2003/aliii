import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/security/server';
import { redact } from '@/lib/security/logger';
import {
  getResolvedShopifyConfig,
  getShopifyAccessToken,
  fetchAllShopifyProducts,
} from '@/lib/shopify/shopifyClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const start = Date.now();
  try {
    const config = getResolvedShopifyConfig();

    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json({
        tested: true,
        success: false,
        message: 'بيانات الربط مع متجر Shopify غير مهيأة بعد.',
        configured: false,
      });
    }

    // Attempt token retrieval and product count
    const token = await getShopifyAccessToken();
    const products = await fetchAllShopifyProducts(undefined, false);

    const latencyMs = Date.now() - start;

    return NextResponse.json({
      tested: true,
      success: true,
      configured: true,
      message: `تم الاتصال بنجاح بمتجر Shopify (${config.storeDomain})`,
      storeDomain: config.storeDomain,
      myshopifyDomain: config.myshopifyDomain,
      productCount: products.length,
      latencyMs,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        tested: true,
        success: false,
        configured: false,
        message: String(redact(err.message || 'فشل الاتصال بمتجر Shopify')),
        latencyMs: Date.now() - start,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await readJsonBody(req, 10 * 1024);
    const { storeDomain, myshopifyDomain, clientId, clientSecret, accessToken } = body;

    const customConfig = {
      storeDomain,
      myshopifyDomain,
      clientId,
      clientSecret,
      accessToken,
    };

    const resolved = getResolvedShopifyConfig(customConfig);
    const token = await getShopifyAccessToken(customConfig);
    const products = await fetchAllShopifyProducts(customConfig, true);

    const latencyMs = Date.now() - start;

    return NextResponse.json({
      tested: true,
      success: true,
      message: `تم التحقق بنجاح! متجر Shopify متصل (${products.length} منتج متاح).`,
      storeDomain: resolved.storeDomain,
      myshopifyDomain: resolved.myshopifyDomain,
      productCount: products.length,
      latencyMs,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        tested: true,
        success: false,
        message: String(redact(err.message || 'تعذر الاتصال بـ Shopify بالبيانات المدخلة')),
        latencyMs: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
