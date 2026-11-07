/**
 * Minimal server logger.
 *  - Level is controlled by LOG_LEVEL in .env (debug | info | warn | error | silent)
 *  - Secrets (API keys, tokens, passwords) are redacted before printing.
 */

type Level = 'debug' | 'info' | 'warn' | 'error' | 'silent';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function currentLevel(): Level {
  const lvl = (process.env.LOG_LEVEL || 'info').toLowerCase() as Level;
  return lvl in ORDER ? lvl : 'info';
}

const SECRET_KEY_RE = /(api[_-]?key|secret|token|password|authorization|cookie|client_secret|access_token)/i;
const SECRET_VALUE_RES: RegExp[] = [
  /shpss_[A-Za-z0-9]+/g, // Shopify client secret
  /shpat_[A-Za-z0-9]+/g, // Shopify access token
  /AIza[0-9A-Za-z_-]{20,}/g, // Google API key
  /AQ\.[A-Za-z0-9_-]{20,}/g, // Google (new style) key
  /([?&]key=)[^&\s"']+/g, // ?key=... in URLs
];

function redactString(s: string): string {
  let out = s;
  for (const re of SECRET_VALUE_RES) {
    out = out.replace(re, (m, p1) => (typeof p1 === 'string' && m.startsWith(p1) ? `${p1}[REDACTED]` : '[REDACTED]'));
  }
  // Also redact any env secret values that might appear verbatim
  for (const name of ['GEMINI_API_KEY', 'ODOO_API_KEY', 'SHOPIFY_CLIENT_SECRET', 'SHOPIFY_ACCESS_TOKEN', 'APPWRITE_API_KEY', 'SESSION_SECRET', 'ADMIN_PASSWORD']) {
    const v = process.env[name];
    if (v && v.length >= 8) out = out.split(v).join('[REDACTED]');
  }
  return out;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[…]';
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function log(level: Exclude<Level, 'silent'>, msg: string, meta?: unknown) {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${redactString(msg)}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) fn(line, redact(meta));
  else fn(line);
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
};
