import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, safeEqual, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/security/session';
import { cleanString, errorResponse, readJsonBody } from '@/lib/security/server';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

/**
 * Server-side login. Credentials are checked against ADMIN_EMAIL / ADMIN_PASSWORD
 * stored in .env.local (never sent to the browser). On success an httpOnly,
 * signed session cookie is issued.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 10 * 1024);
    const email = cleanString(body.email, 200).toLowerCase();
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';

    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '';

    if (!adminEmail || adminPassword.length < 8) {
      logger.error('Login is not configured: set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in .env.local');
      return NextResponse.json(
        { success: false, error: 'تسجيل الدخول غير مهيأ على الخادم. راجع ملف .env.local' },
        { status: 503 }
      );
    }

    // Evaluate both comparisons to keep timing constant
    const okEmail = safeEqual(email, adminEmail);
    const okPass = safeEqual(password, adminPassword);
    if (!okEmail || !okPass) {
      logger.warn('Failed login attempt', { email, ip: req.headers.get('x-forwarded-for') || req.ip });
      return NextResponse.json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    const name = process.env.ADMIN_NAME || email.split('@')[0] || 'Admin';
    const token = await createSessionToken(email, name);

    const res = NextResponse.json({ success: true, user: { id: 'admin', name, email } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    logger.info('User logged in', { email });
    return res;
  } catch (err) {
    return errorResponse(err, 'فشل تسجيل الدخول', 'auth/login');
  }
}
