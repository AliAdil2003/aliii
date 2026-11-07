import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Project } from '@/types';
import { errorResponse, isSafeId, readJsonBody } from '@/lib/security/server';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readProjects(): Project[] {
  ensureDataDir();
  if (!fs.existsSync(PROJECTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('Error reading projects.json:', err);
    return [];
  }
}

function writeProjects(projects: Project[]) {
  ensureDataDir();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8');
}

export async function GET() {
  try {
    const projects = readProjects();
    return NextResponse.json({ success: true, projects });
  } catch (err: any) {
    return errorResponse(err, 'تعذر تنفيذ الطلب', 'projects');
  }
}

export async function POST(req: NextRequest) {
  try {
    const project: Project = await readJsonBody(req, 5 * 1024 * 1024);
    if (!project || !isSafeId(project.id)) {
      return NextResponse.json({ success: false, error: 'Project ID is required' }, { status: 400 });
    }

    const projects = readProjects();
    const index = projects.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      projects[index] = { ...project, updatedAt: new Date().toISOString() };
    } else {
      projects.unshift({
        ...project,
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    writeProjects(projects);
    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    logger.error('Save project error:', err);
    return errorResponse(err, 'تعذر تنفيذ الطلب', 'projects');
  }
}
