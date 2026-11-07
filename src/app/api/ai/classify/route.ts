import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/security/server';
import { logger, redact } from '@/lib/security/logger';
import { classifyProductsWithAI, ProductToClassify } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 50 * 1024 * 1024);
    const { products, apiKey, model, existingCategories, preferredCategories } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'يرجى تزويد قائمة المنتجات للتصنيف' },
        { status: 400 }
      );
    }

    const payload: ProductToClassify[] = products.map((p: any) => ({
      id: p.id || String(Math.random()),
      name: p.name || '',
      description: p.originalDescription || p.description || '',
      category: p.category || '',
      internalReference: p.internalReference || '',
      barcode: p.barcode || '',
      imageData: p.imageData || p.image || '',
    }));

    const result = await classifyProductsWithAI(payload, {
      apiKey,
      model,
      existingCategories,
      preferredCategories,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Classify Products API Error:', error);
    return NextResponse.json(
      { error: String(redact(error.message || 'فشل تصنيف المنتجات بالذكاء الاصطناعي')) },
      { status: 500 }
    );
  }
}
