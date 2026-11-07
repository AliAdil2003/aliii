import { NextRequest, NextResponse } from 'next/server';
import { testGeminiConnection, AVAILABLE_GEMINI_MODELS, getPreferredGeminiModel } from '@/lib/ai/gemini';
import { logger, redact } from '@/lib/security/logger';
import { maskSecret, readJsonBody } from '@/lib/security/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
    const maskedKey = hasKey ? maskSecret(process.env.GEMINI_API_KEY) : '';
    const currentModel = getPreferredGeminiModel();

    return NextResponse.json({
      hasKey,
      maskedKey,
      currentModel,
      availableModels: AVAILABLE_GEMINI_MODELS,
    });
  } catch (error: any) {
    return NextResponse.json({ hasKey: false, error: 'تعذر قراءة الإعدادات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 10 * 1024);
    const { apiKey, model } = body;

    const result = await testGeminiConnection(apiKey, model);
    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Test Gemini Connection Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `خطأ في الخادم: ${redact(error.message || 'فشل الاتصال')}`,
        model: 'none',
      },
      { status: 500 }
    );
  }
}
