import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/security/server';
import { logger, redact } from '@/lib/security/logger';
import { reorderProductsWithAI, ProductToReorder } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 50 * 1024 * 1024);
    const { products, apiKey, model } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'يرجى تزويد قائمة المنتجات للترتيب' },
        { status: 400 }
      );
    }

    const payload: ProductToReorder[] = products.map((p: any) => ({
      id: String(p.id),
      name: String(p.name || ''),
      category: p.category ? String(p.category) : '',
      internalReference: p.internalReference ? String(p.internalReference) : '',
      price: p.price ?? p.salePrice ?? p.customerPrice,
      stock: p.stock ?? p.currentStock,
    }));

    const result = await reorderProductsWithAI(payload, { apiKey, model });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('AI Reorder Products API Error:', error);
    return NextResponse.json(
      { error: String(redact(error.message || 'فشل الترتيب الذكي للمنتجات')) },
      { status: 500 }
    );
  }
}
