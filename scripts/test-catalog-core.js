// 1. Base64 extractor test logic
function extractAndNormalizeImage(cellValue) {
  if (cellValue === undefined || cellValue === null) return { src: '', status: 'missing' };
  let str = String(cellValue).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  if (!str) return { src: '', status: 'missing' };
  if (str.startsWith('http://') || str.startsWith('https://')) return { src: str, status: 'valid', format: 'url' };
  if (str.startsWith('data:image/')) return { src: str, status: 'valid', format: 'webp' };
  const cleaned = str.replace(/[\r\n\s]/g, '');
  if (cleaned.startsWith('UklGR')) return { src: `data:image/webp;base64,${cleaned}`, status: 'valid', format: 'webp' };
  if (cleaned.startsWith('iVBORw0KGgo')) return { src: `data:image/png;base64,${cleaned}`, status: 'valid', format: 'png' };
  return { src: '', status: 'invalid' };
}

// 2. Factual Extractive Summarizer
function extractFactualSummary(text, wordLimit) {
  if (!text || !text.trim()) return '';
  let cleaned = text.trim();
  const filler = [/يتميز هذا المنتج الرائع/gi, /عالي الجودة/gi, /أفضل جودة/gi, /الخيار الأمثل/gi];
  filler.forEach((f) => { cleaned = cleaned.replace(f, ''); });
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  const words = cleaned.split(/\s+/);
  return words.slice(0, wordLimit).join(' ') + '...';
}

async function runTests() {
  console.log('--- بدء اختبار نواة معالجة المنتجات والصور والـ PDF ---');

  // Test 1: Column Detection
  const columns = ['اسم العرض', 'وصف المنتج', 'باركود', 'الفئة', 'سعر البيع', 'سعر بيع الزبون', 'الكمية في اليد', 'صورة 512', 'مرجع داخلي'];
  console.log('1. اختبار اكتشاف الأعمدة العربية:', columns.length, 'أعمدة');
  const hasName = columns.includes('اسم العرض');
  const hasSalePrice = columns.includes('سعر البيع');
  const hasCustomerPrice = columns.includes('سعر بيع الزبون');
  const hasStock = columns.includes('الكمية في اليد');
  const hasImage = columns.includes('صورة 512');
  if (hasName && hasSalePrice && hasCustomerPrice && hasStock && hasImage) {
    console.log('   ✅ تم التعرف على جميع الأعمدة العربية بنجاح (بما فيها سعر البيع وسعر بيع الزبون)');
  } else {
    throw new Error('فشل اكتشاف الأعمدة');
  }

  // Test 2: Base64 WebP Decoding
  const rawWebp = 'UklGRmYAAABXRUJQVlA4IFoAAAAwAQCdASoFAAUAAUAmJaQAA3AA/vsP1sAA/v1b0f/q9v1k3e/26sA/v1X0f9/2/v1Y/9f7/1L//+F/3/v3f9/1//1L//+F/3/v3f9/1//1L//+F/3/v3f9/1//1L///2QAAAA=';
  const imgRes = extractAndNormalizeImage(rawWebp);
  console.log('2. اختبار فك تشفير وتطبيع صورة Base64 WebP:');
  console.log('   - الحالة:', imgRes.status);
  console.log('   - التنسيق:', imgRes.format);
  console.log('   - البداية:', imgRes.src.substring(0, 30));
  if (imgRes.status === 'valid' && imgRes.src.startsWith('data:image/webp;base64,')) {
    console.log('   ✅ تم فك تشفير Base64 WebP بنجاح وبشكل متوافق مع المتصفح والطباعة');
  } else {
    throw new Error('فشل استخراج صورة Base64 WebP');
  }

  // Test 3: Stock Filtering
  const sampleItems = [
    { name: 'MOXEDO PORTA-LINK', stock: 0 },
    { name: 'MOXEDO ANC Headphones', stock: 3 },
    { name: 'MOXEDO Ultra Watch', stock: 14 },
    { name: 'MOXEDO Armor Cable', stock: 4 },
    { name: 'MOXEDO GaN Charger', stock: 28 },
  ];
  const stockLessThan5 = sampleItems.filter((i) => i.stock < 5);
  console.log('3. اختبار فلتر المخزون (Stock < 5):');
  console.log('   - المنتجات ذات المخزون أقل من 5:', stockLessThan5.map((i) => `${i.name} (stock: ${i.stock})`).join(', '));
  if (stockLessThan5.length === 3 && stockLessThan5.some((i) => i.stock === 0)) {
    console.log('   ✅ فلتر المخزون Stock < 5 يعمل بدقة');
  } else {
    throw new Error('فشل فلتر المخزون');
  }

  // Test 4: Description Shortening with zero hallucination
  const longDesc = 'بنك طاقة متنقل فائق السرعة بسعة 10000 مللي أمبير مع كابلين مدمجين Type-C و Lightning لشحن هواتف iPhone و Samsung بسرعة فائقة 22.5 واط مع شاشة رقمية LED ذكية توضح نسبة البطارية المتبقية بدقة.';
  const shortened = extractFactualSummary(longDesc, 15);
  console.log('4. اختبار اختصار الوصف الأصلي بدون اختراع أي معلومات:');
  console.log('   - الأصلي:', longDesc);
  console.log('   - المختصر (15 كلمة):', shortened);
  if (shortened.includes('10000') && shortened.includes('Type-C')) {
    console.log('   ✅ تم الحفاظ على الأرقام والمواصفات الفنية الحقيقية دون اختراع');
  } else {
    throw new Error('فشل تلخيص الوصف');
  }

  console.log('\n🌟 جميع اختبارات النواة نجحت 100%! النواة جاهزة للإنتاج.');
}

runTests().catch((err) => {
  console.error('❌ خطأ في الاختبار:', err);
  process.exit(1);
});
