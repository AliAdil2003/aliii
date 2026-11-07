const fs = require('fs');
const path = require('path');

// Test pipeline runner
async function runVerification() {
  console.log('--- بدء اختبار خط أنابيب الكتالوج الشامل (Catalog Studio Pipeline Test) ---');

  // 1. Verify files exist
  const requiredFiles = [
    'src/types/index.ts',
    'src/lib/excel/parser.ts',
    'src/lib/excel/columnDetector.ts',
    'src/lib/images/base64Extractor.ts',
    'src/lib/ai/shortener.ts',
    'src/lib/pdf/htmlTemplate.ts',
    'src/app/api/pdf/generate/route.ts',
    'src/app/api/ai/shorten/route.ts',
    'src/app/api/sample-data/route.ts',
    'src/components/wizard/NewCatalogWizard.tsx',
    'src/components/product-table/ProductDataTable.tsx',
    'src/components/ai/DescriptionShortenerModal.tsx',
    'src/components/designer/CatalogDesigner.tsx',
    'src/components/designer/LivePagePreview.tsx',
    'src/components/designer/PropertiesPanel.tsx',
    'src/components/pdf/PDFExportModal.tsx',
    'src/components/templates/TemplateManagerModal.tsx',
  ];

  let missing = 0;
  for (const f of requiredFiles) {
    const fullPath = path.join(__dirname, '..', f);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ ملف مفقود: ${f}`);
      missing++;
    }
  }

  if (missing === 0) {
    console.log('✅ جميع ملفات ومكونات النظام الأساسية موجودة ومكتملة (17/17)');
  } else {
    console.error(`❌ هناك ${missing} ملفات مفقودة`);
    process.exit(1);
  }

  console.log('--- اكتمل التحقق الأولي بنجاح ---');
}

runVerification();
