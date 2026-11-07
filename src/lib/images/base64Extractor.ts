import { ImageStatus } from '@/types';

export interface ProcessedImage {
  src: string;
  status: ImageStatus;
  error?: string;
  format?: 'webp' | 'png' | 'jpeg' | 'url' | 'svg' | 'unknown';
}

/**
 * Checks and normalizes raw Excel/CSV cell value into a valid browser image source
 */
export function extractAndNormalizeImage(cellValue: unknown): ProcessedImage {
  if (cellValue === undefined || cellValue === null) {
    return { src: '', status: 'missing' };
  }

  let str = String(cellValue).trim();

  // Strip wrapping quotes if any
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  if (!str) {
    return { src: '', status: 'missing' };
  }

  // 1. Direct Web URLs
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('blob:')) {
    return {
      src: str,
      status: 'valid',
      format: 'url',
    };
  }

  // 2. Pre-formatted Data URI
  if (str.startsWith('data:image/')) {
    // Check if it has base64 data
    const commaIndex = str.indexOf(',');
    if (commaIndex !== -1 && commaIndex < str.length - 1) {
      const mime = str.substring(5, str.indexOf(';'));
      let format: ProcessedImage['format'] = 'unknown';
      if (mime.includes('webp')) format = 'webp';
      else if (mime.includes('png')) format = 'png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) format = 'jpeg';
      else if (mime.includes('svg')) format = 'svg';

      return {
        src: str,
        status: 'valid',
        format,
      };
    } else {
      return {
        src: '',
        status: 'invalid',
        error: 'بيانات Base64 غير مكتملة أو تالفة',
      };
    }
  }

  // 3. Raw Base64 string without data URI scheme
  // Remove whitespace and newlines from messy cell exports
  const cleaned = str.replace(/[\r\n\s]/g, '');

  // Magic bytes / common base64 image headers
  if (cleaned.startsWith('UklGR')) {
    // WebP signature ("RIFF")
    return {
      src: `data:image/webp;base64,${cleaned}`,
      status: 'valid',
      format: 'webp',
    };
  }

  if (cleaned.startsWith('iVBORw0KGgo')) {
    // PNG signature
    return {
      src: `data:image/png;base64,${cleaned}`,
      status: 'valid',
      format: 'png',
    };
  }

  if (cleaned.startsWith('/9j/')) {
    // JPEG signature
    return {
      src: `data:image/jpeg;base64,${cleaned}`,
      status: 'valid',
      format: 'jpeg',
    };
  }

  if (cleaned.startsWith('R0lGOD')) {
    // GIF signature
    return {
      src: `data:image/gif;base64,${cleaned}`,
      status: 'valid',
      format: 'png',
    };
  }

  if (cleaned.startsWith('PHN2Zy') || cleaned.startsWith('PD94bWw')) {
    // SVG signature
    return {
      src: `data:image/svg+xml;base64,${cleaned}`,
      status: 'valid',
      format: 'svg',
    };
  }

  // Sample first 200 characters to safely test base64 without regex stack overflow
  const sample = cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(sample) && cleaned.length > 60;
  if (isBase64) {
    return {
      src: `data:image/webp;base64,${cleaned}`,
      status: 'valid',
      format: 'webp',
    };
  }

  // If none matched, mark as invalid image
  return {
    src: '',
    status: 'invalid',
    error: `تنسيق صورة غير مدعوم: "${str.substring(0, 30)}..."`,
  };
}
