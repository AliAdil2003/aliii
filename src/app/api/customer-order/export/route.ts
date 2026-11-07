import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { CustomerOrderPayload } from '@/types';
import { sanitizeOrderPayload } from '@/lib/security/orderPayload';
import { HttpError, readJsonBody, safeCell } from '@/lib/security/server';
import { logger } from '@/lib/security/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Public endpoint: validate + bound every field (no HTML escaping needed for Excel)
    const raw = await readJsonBody(req, 10 * 1024 * 1024);
    const payload: CustomerOrderPayload = sanitizeOrderPayload(raw, { escape: false });

    const wb = XLSX.utils.book_new();

    const titleRow = [`طلبية زبون: ${payload.customerInfo?.name || 'عميل'}`];
    const dateRow = [`التاريخ: ${new Date().toLocaleDateString('ar-IQ')}`];
    const contactRow = [
      `رقم الهاتف: ${payload.customerInfo?.phone || '-'}`,
      `العنوان: ${payload.customerInfo?.address || '-'}`,
    ];
    const summaryRow = [
      `عدد الأصناف: ${payload.totalItems}`,
      `إجمالي القطع: ${payload.totalQuantity}`,
      `المبلغ الإجمالي: ${payload.totalAmount.toLocaleString()} ${payload.currency}`,
    ];
    const emptyRow: string[] = [];

    const headers = [
      '#',
      'اسم المنتج',
      'الوصف',
      'الفئة',
      'المرجع الداخلي',
      'الباركود',
      'سعر البيع المفرد',
      'سعر الجملة',
      'الكمية المطلوبة',
      'المجموع',
    ];

    const dataRows = payload.items.map((item, idx) => [
      idx + 1,
      item.name,
      item.description || '',
      item.category || '',
      item.internalReference || '',
      item.barcode || '',
      item.retailPrice || item.unitPrice,
      item.wholesalePrice || item.unitPrice,
      item.requestedQuantity,
      item.subtotal,
    ]);

    const totalRow = [
      'الإجمالي',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      payload.totalQuantity,
      payload.totalAmount,
    ];

    const sheetData = [
      titleRow,
      dateRow,
      contactRow,
      summaryRow,
      emptyRow,
      headers,
      ...dataRows,
      emptyRow,
      totalRow,
    ];

    // Prevent formula injection (cells starting with = + - @)
    const safeData = sheetData.map((row) => (row as unknown[]).map((c) => safeCell(c)));
    const ws = XLSX.utils.aoa_to_sheet(safeData);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },
      { wch: 35 },
      { wch: 35 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'طلبية الزبون');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Order_${Date.now()}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Customer Order Excel Export Error:', error);
    return NextResponse.json({ error: 'فشل تصدير ملف Excel' }, { status: 500 });
  }
}
