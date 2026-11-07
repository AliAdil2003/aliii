import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Product } from '@/types';
import { errorResponse, isSafeId, readJsonBody } from '@/lib/security/server';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const PRODUCTS_DIR = path.join(DATA_DIR, 'products');

function ensureProductsDir() {
  if (!fs.existsSync(PRODUCTS_DIR)) {
    fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!isSafeId(id)) {
      return NextResponse.json({ success: false, error: 'معرّف غير صالح' }, { status: 400 });
    }
    ensureProductsDir();
    const filePath = path.join(PRODUCTS_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: true, products: [] });
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const products: Product[] = JSON.parse(raw);
    return NextResponse.json({ success: true, products });
  } catch (err: any) {
    logger.error(`Error reading products for ${params.id}:`, err);
    return errorResponse(err, 'تعذر تنفيذ الطلب', 'projects/products');
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!isSafeId(id)) {
      return NextResponse.json({ success: false, error: 'معرّف غير صالح' }, { status: 400 });
    }
    const body = await readJsonBody(req, 200 * 1024 * 1024); // catalogs with base64 images can be large
    const products: Product[] = Array.isArray(body) ? body : body.products;

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ success: false, error: 'Products array is required' }, { status: 400 });
    }

    ensureProductsDir();
    const filePath = path.join(PRODUCTS_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(products), 'utf8');

    // Also update project product count in projects.json
    const projectsFile = path.join(DATA_DIR, 'projects.json');
    if (fs.existsSync(projectsFile)) {
      try {
        const raw = fs.readFileSync(projectsFile, 'utf8');
        const list = JSON.parse(raw);
        const proj = list.find((p: any) => p.id === id);
        if (proj) {
          proj.productCount = products.length;
          proj.includedProductCount = products.filter((p: any) => p.includedInCatalog).length;
          proj.updatedAt = new Date().toISOString();
          fs.writeFileSync(projectsFile, JSON.stringify(list, null, 2), 'utf8');
        }
      } catch (e) {
        logger.warn('Could not update project product count in projects.json:', e);
      }
    }

    return NextResponse.json({ success: true, count: products.length });
  } catch (err: any) {
    logger.error(`Error saving products for ${params.id}:`, err);
    return errorResponse(err, 'تعذر تنفيذ الطلب', 'projects/products');
  }
}
