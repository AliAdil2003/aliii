/**
 * Server-only security helpers for API route handlers.
 * NEVER import this file from a 'use client' component.
 */
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { logger, redact } from './logger';

/* ------------------------------------------------------------------ */
/* Input validation                                                    */
/* ------------------------------------------------------------------ */

/** Project IDs look like `proj_1792069816668`. Prevents path traversal. */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function isSafeId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_ID_RE.test(id);
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Parse a JSON request body with a size limit (default 5 MB).
 * Large catalogs with base64 images can raise the limit per route.
 */
export async function readJsonBody<T = any>(req: NextRequest, maxBytes = 5 * 1024 * 1024): Promise<T> {
  const declared = Number(req.headers.get('content-length') || '0');
  if (declared && declared > maxBytes) {
    throw new HttpError(413, 'حجم الطلب أكبر من الحد المسموح');
  }
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new HttpError(413, 'حجم الطلب أكبر من الحد المسموح');
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'صيغة JSON غير صالحة');
  }
}

/** Trim a string and enforce a max length; returns '' for non-strings. */
export function cleanString(v: unknown, maxLen = 500): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, maxLen);
}

/** Escape text before inserting it into HTML (used for PDF rendering). */
export function escapeHtml(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow image sources that are inline data URIs or public http(s) URLs. */
export function safeImageSrc(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
  try {
    const u = new URL(s);
    if ((u.protocol === 'https:' || u.protocol === 'http:') && !isPrivateHost(u.hostname)) {
      return escapeHtml(u.toString());
    }
  } catch {}
  return '';
}

/** Mask a secret for display: `abc123...wxyz`. Never return the full value. */
export function maskSecret(v?: string | null): string {
  if (!v) return '';
  if (v.length <= 10) return '••••••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/* SSRF protection                                                     */
/* ------------------------------------------------------------------ */

export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '0.0.0.0' || h === '::' || h === '::1') return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  if (h.includes(':') && (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80'))) return true;
  return false;
}

/** Validates an outbound URL supplied by a user (https only, no private hosts). */
export function assertSafeOutboundUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    throw new HttpError(400, 'رابط غير صالح');
  }
  if (u.protocol !== 'https:') throw new HttpError(400, 'يجب أن يبدأ الرابط بـ https://');
  if (isPrivateHost(u.hostname)) throw new HttpError(400, 'لا يُسمح بالاتصال بعناوين داخلية');
  return u.origin;
}

/**
 * Hardens a Puppeteer page so rendered HTML cannot reach the local
 * filesystem or internal network (blocks file://, localhost and private IPs).
 * JavaScript is disabled because the templates are pure HTML/CSS.
 */
export async function hardenPuppeteerPage(page: any): Promise<void> {
  await page.setJavaScriptEnabled(false).catch(() => {});
  await page.setRequestInterception(true);
  page.on('request', (request: any) => {
    const url: string = request.url();
    if (url.startsWith('data:') || url === 'about:blank') return request.continue();
    try {
      const u = new URL(url);
      if ((u.protocol === 'https:' || u.protocol === 'http:') && !isPrivateHost(u.hostname)) {
        return request.continue();
      }
    } catch {}
    logger.warn('Blocked PDF renderer request', { url: url.slice(0, 120) });
    return request.abort();
  });
}

/* ------------------------------------------------------------------ */
/* Safe .env.local writer                                              */
/* ------------------------------------------------------------------ */

const ENV_NAME_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

/**
 * Updates variables inside .env.local (server-side only).
 * Values are stripped of newlines / quotes to prevent env-injection.
 */
export function updateEnvFile(vars: Record<string, string | undefined>): void {
  const envPath = path.join(process.cwd(), '.env.local');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  for (const [name, rawVal] of Object.entries(vars)) {
    if (rawVal === undefined || rawVal === '') continue;
    if (!ENV_NAME_RE.test(name)) throw new HttpError(400, `Invalid env name: ${name}`);
    const val = String(rawVal).replace(/[\r\n\0]/g, '').replace(/["`]/g, '').trim().slice(0, 1000);
    if (!val) continue;
    process.env[name] = val;
    const re = new RegExp(`^${name}=.*$`, 'm');
    if (re.test(content)) content = content.replace(re, () => `${name}=${val}`);
    else content += `${content.endsWith('\n') || !content ? '' : '\n'}${name}=${val}\n`;
  }

  fs.writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(envPath, 0o600);
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Error responses                                                     */
/* ------------------------------------------------------------------ */

/** Converts any thrown error into a safe JSON response (no stack / secrets). */
export function errorResponse(err: unknown, fallbackMessage = 'حدث خطأ في الخادم', context = 'API'): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ success: false, error: err.message, message: err.message }, { status: err.status });
  }
  logger.error(`${context} error`, err);
  // Error messages are shown to the (authenticated) user but always redacted of secrets
  const raw = (err as any)?.message ? String((err as any).message).slice(0, 300) : fallbackMessage;
  const message = String(redact(raw));
  return NextResponse.json({ success: false, error: message, message }, { status: 500 });
}

/** Prevents spreadsheet formula injection (=, +, -, @) in exported Excel cells. */
export function safeCell(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
