import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/security/server';
import { logger, redact } from '@/lib/security/logger';
import { shortenProductDescription } from '@/lib/ai/shortener';
import { DescriptionShortenRequest } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await readJsonBody(req, 50 * 1024 * 1024)) as DescriptionShortenRequest;
    const { originalDescription, mode, wordLimit, productName } = body;

    if (!originalDescription || !originalDescription.trim()) {
      return NextResponse.json({
        shortenedDescription: '',
        wordCount: 0,
        language: 'ar',
      });
    }

    let targetLimit = wordLimit || 20;
    if (mode === 'very_short') {
      targetLimit = 12;
    } else if (mode === 'short') {
      targetLimit = 20;
    } else if (mode === 'medium') {
      targetLimit = 35;
    }

    const result = await shortenProductDescription({
      originalDescription,
      wordLimit: targetLimit,
      productName,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('AI Shorten API Error:', error);
    return NextResponse.json({ error: String(redact(error.message || 'فشل اختصار الوصف')) }, { status: 500 });
  }
}
