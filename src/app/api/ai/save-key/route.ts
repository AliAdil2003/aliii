import { NextRequest, NextResponse } from 'next/server';
import { cleanString, errorResponse, HttpError, readJsonBody, updateEnvFile } from '@/lib/security/server';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

/**
 * Saves the Gemini API key / model into .env.local on the server.
 * Requires an authenticated session (enforced in middleware).
 * The key is never returned to the browser.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 10 * 1024);
    const apiKey = cleanString(body.apiKey, 300);
    const model = cleanString(body.model, 80);

    if (apiKey && !/^[A-Za-z0-9._-]{20,300}$/.test(apiKey)) {
      throw new HttpError(400, 'صيغة مفتاح Gemini غير صالحة');
    }
    if (model && !/^[A-Za-z0-9._-]{3,80}$/.test(model)) {
      throw new HttpError(400, 'اسم النموذج غير صالح');
    }

    updateEnvFile({
      GEMINI_API_KEY: apiKey || undefined,
      GEMINI_MODEL: model || undefined,
    });
    logger.info('Gemini settings updated', { keyChanged: !!apiKey, model: model || undefined });

    return NextResponse.json({
      success: true,
      message: 'تم حفظ إعدادات ونموذج Gemini وتفعيلها بنجاح.',
      hasKey: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    });
  } catch (error) {
    return errorResponse(error, 'فشل حفظ الإعدادات', 'ai/save-key');
  }
}
