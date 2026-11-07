import { NextResponse } from 'next/server';
import { createSampleWorkbook } from '@/lib/sampleData/generateSampleExcel';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const excelBuffer = createSampleWorkbook();

    return new NextResponse(excelBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="moxedo_sample_catalog.xlsx"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
