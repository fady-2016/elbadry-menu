/* =====================================================
   config.js — إعدادات المحل (غيّر ما تريد من هنا)
   ===================================================== */
const CONFIG = {
  // اسم المحل (يظهر في الهيدر وعنوان الصفحة وأعلى الفاتورة)
  shopName: "حلويات البدري",

  // رقم واتساب الكاشير بالصيغة الدولية بدون صفرين في أوله
  phone: "201114642261",

  // رابط موقع المحل على خرائط جوجل (افتح المحل على Google Maps ← مشاركة ← نسخ الرابط). اتركه فارغًا لإخفاء الزر
  shopMapUrl: "https://www.google.com/maps/search/?api=1&query=31.4463393,31.6819026",

  // إحداثيات المحل: يبدأ منها المسار في رسالة التوصيل (اتركها null ليبدأ المسار من موقع من يفتح الرابط)
  shopLocation: { lat: 31.4463393, lng: 31.6819026 },

  // رابط الـ CSV المنشور من جوجل شيت (لو تُرك فارغًا تُستخدم data.js)
  sheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKX8xqrwamDQhNa1T-wXsvGQGqP4hCoqCqMyXGNXhDYbje6cQFkBxWSxH9DSGH88_ibrS2xZLG_DR/pub?gid=10679720&single=true&output=csv",

  // الأقسام التي أسعارها بالكيلو (في بيانات data.js فقط؛ في الشيت تُحدَّد الوحدة بعمود "الوحدة")
  kgSections: ["كنافة", "ملبن", "قمرية وجوزية", "حلويات شرقية", "مشبك", "هريسة", "بسبوسة", "بغاشة", "بقلاوة"],

  // أصناف تُباع بالقطعة حتى لو كانت في قسم بالكيلو (يبدأ اسمها بإحدى هذه الكلمات)
  pieceNames: /^(علبة|قرص|تورتة|ترت|مكرونة)/,

  // أماكن صور الأصناف (ملفات داخل مجلد images)
  images: {
    rolls: "images/rolls.jpg", nests: "images/nests.jpg", slices: "images/slices.jpg", squares: "images/squares.jpg",
    qamar: "images/qamar.jpg", malban: "images/malban.jpg", red: "images/red.jpg", mshabak: "images/mshabak.jpg",
    sweets: "images/sweets.jpg", cookies: "images/cookies.jpg", harisa: "images/harisa.jpg",
    basbousa: "images/basbousa.jpg", baklava: "images/baklava.jpg"
  },

  // أي صورة تظهر لأي صنف: تُطبَّق أول قاعدة تنطبق من الأعلى للأسفل
  // section = اسم القسم ، match = كلمات في اسم الصنف (اختياري) ، image = اسم الصورة من images أعلاه
  imageRules: [
    { section: "كنافة", match: /لف/, image: "rolls" },
    { section: "كنافة", match: /أساور/, image: "slices" },
    { section: "كنافة", match: /ميكس|نوجا|شيكولاتة|كاجو|مدلعة|تمر/, image: "squares" },
    { section: "كنافة", image: "nests" },
    { section: "حلويات شرقية", match: /لديدة/, image: "red" },
    { section: "حلويات شرقية", match: /بسيمة|كعب|لينزا|رموش/, image: "cookies" },
    { section: "حلويات شرقية", image: "sweets" },
    { section: "ملبن", image: "malban" },
    { section: "قمرية وجوزية", image: "qamar" },
    { section: "مشبك", image: "mshabak" },
    { section: "هريسة", image: "harisa" },
    { section: "بسبوسة", image: "basbousa" },
    { section: "بغاشة", image: "baklava" },
    { section: "بقلاوة", image: "baklava" },
    { section: "علب مشكل", image: "baklava" }
  ]
};
