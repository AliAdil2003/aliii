import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/security/session';
import { rateLimit } from '@/lib/security/rateLimit';

/**
 * Central security gate for the whole app:
 *  1. Security headers on every response
 *  2. CORS: only origins listed in ALLOWED_ORIGINS (plus same-origin)
 *  3. CSRF: state-changing API requests must come from an allowed origin
 *  4. Rate limiting per IP (stricter for login, AI and PDF endpoints)
 *  5. Authentication: every page and API requires a valid session cookie,
 *     except the login page and the public customer-order share page.
 */

// Pages that do not require login
const PUBLIC_PAGES = [/^\/login\/?$/, /^\/order\/[^/]+\/?$/];

// APIs that do not require login (used by the public customer order page)
const PUBLIC_APIS: { method: string; re: RegExp }[] = [
  { method: 'POST', re: /^\/api\/auth\/login\/?$/ },
  { method: 'POST', re: /^\/api\/auth\/logout\/?$/ },
  { method: 'GET', re: /^\/api\/auth\/me\/?$/ },
  { method: 'GET', re: /^\/api\/projects\/[A-Za-z0-9_-]+\/?$/ },
  { method: 'GET', re: /^\/api\/projects\/[A-Za-z0-9_-]+\/products\/?$/ },
  { method: 'POST', re: /^\/api\/customer-order\/(pdf|export)\/?$/ },
];

// [limit, windowMs] per IP
function limitFor(pathname: string): [number, number, string] {
  if (pathname.startsWith('/api/auth/login')) return [10, 15 * 60_000, 'login'];
  if (pathname.startsWith('/api/customer-order')) return [20, 60_000, 'order'];
  if (pathname.startsWith('/api/pdf') || pathname.startsWith('/api/purchase-order')) return [20, 60_000, 'pdf'];
  if (pathname.startsWith('/api/ai')) return [60, 60_000, 'ai'];
  return [300, 60_000, 'api'];
}

function getAllowedOrigins(req: NextRequest): string[] {
  const list = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  list.push(req.nextUrl.origin);
  return list;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.ip ||
    'unknown'
  );
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  return res;
}

function applyCors(req: NextRequest, res: NextResponse, allowed: string[]): NextResponse {
  const origin = req.headers.get('origin');
  if (origin && allowed.includes(origin.replace(/\/+$/, ''))) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

function json(status: number, error: string): NextResponse {
  return applySecurityHeaders(NextResponse.json({ success: false, error, message: error }, { status }));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();
  const isApi = pathname.startsWith('/api/');

  if (isApi) {
    const allowed = getAllowedOrigins(req);
    const origin = req.headers.get('origin');

    // CORS preflight
    if (method === 'OPTIONS') {
      const res = new NextResponse(null, { status: origin && allowed.includes(origin) ? 204 : 403 });
      return applySecurityHeaders(applyCors(req, res, allowed));
    }

    // CSRF / foreign origin protection for state-changing requests
    if (!['GET', 'HEAD'].includes(method) && origin && !allowed.includes(origin.replace(/\/+$/, ''))) {
      return json(403, 'مصدر الطلب غير مسموح به');
    }

    // Rate limiting
    const [limit, windowMs, bucket] = limitFor(pathname);
    const rl = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
    if (!rl.allowed) {
      const res = json(429, 'عدد الطلبات كبير جداً، يرجى المحاولة بعد قليل');
      res.headers.set('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
      return res;
    }

    // Authentication
    const isPublic = PUBLIC_APIS.some((p) => p.method === method && p.re.test(pathname));
    if (!isPublic) {
      const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
      if (!session) return json(401, 'يجب تسجيل الدخول للوصول إلى هذه الخدمة');
    }

    return applySecurityHeaders(applyCors(req, NextResponse.next(), allowed));
  }

  // Pages
  const isPublicPage = PUBLIC_PAGES.some((re) => re.test(pathname));
  if (!isPublicPage) {
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      return NextResponse.redirect(url);
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  // Run on everything except Next.js internals and static files in /public
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)$).*)'],
};
