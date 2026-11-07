import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/security/server';
import { logger, redact } from '@/lib/security/logger';
import { batchShortenProductNames } from '@/lib/ai/nameShortener';
import { NameShortenRequest } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await readJsonBody(req, 50 * 1024 * 1024)) as NameShortenRequest;
    const { products, mode, maxWords, apiKey } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'يرجى إرسال قائمة المنتجات المراد اختصار أسمائها' },
        { status: 400 }
      );
    }

    const result = await batchShortenProductNames(products, {
      mode,
      maxWords,
      apiKey,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Shorten Name API Error:', error);
    return NextResponse.json(
      { error: String(redact(error.message || 'فشل اختصار أسماء المنتجات')) },
      { status: 500 }
    );
  }
}
