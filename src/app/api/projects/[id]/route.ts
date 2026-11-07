import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Project } from '@/types';
import { errorResponse, isSafeId } from '@/lib/security/server';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const PRODUCTS_DIR = path.join(DATA_DIR, 'products');

function readProjects(): Project[] {
  if (!fs.existsSync(PROJECTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeProjects(projects: Project[]) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8');
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
    const projects = readProjects();
    const project = projects.find((p) => p.id === id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    return errorResponse(err, 'تعذر تنفيذ الطلب', 'projects/[id]');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!isSafeId(id)) {
      return NextResponse.json({ success: false, error: 'معرّف غير صالح' }, { status: 400 });
    }
    const projects = readProjects();
    const filtered = projects.filter((p) => p.id !== id);
    writeProjects(filtered);

    // Also delete product file if exists
    const prodFile = path.join(PRODUCTS_DIR, `${id}.json`);
    if (fs.existsSync(prodFile)) {
      try {
        fs.unlinkSync(prodFile);
      } catch (e) {
        logger.warn('Error deleting product file:', e);
      }
    }

    return NextResponse.json({ success: true, message: 'Project deleted' });
  } catch (err: any) {
    return errorResponse(err, 'تعذر تنفيذ الطلب', 'projects/[id]');
  }
}
