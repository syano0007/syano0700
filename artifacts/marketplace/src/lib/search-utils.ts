/**
 * Multilingual search utilities — Arabic ↔ English
 *
 * Architecture:
 *   1. normalizeAr()       — strip diacritics + normalize alef/ya/ta-marbuta
 *   2. stemEn()            — reduce English plurals → singular (keyboards → keyboard)
 *   3. SYNONYM_GROUPS      — bilingual bridge (Arabic ↔ English, domain-specific)
 *   4. expandSearchQuery() — returns up to 4 terms: original + synonyms + stemmed
 *   5. scoreProduct()      — client-side relevance score for final ranking
 *
 * On the backend, /api/search uses pg_trgm word_similarity() for within-script
 * typo tolerance (e.g. "phon" → "phone"). The synonym bridge here handles the
 * cross-script gap that pg_trgm cannot (Arabic query → English product name).
 */

// ─── Arabic normalisation ─────────────────────────────────────────────────────

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;
const TATWEEL           = /\u0640/g;
const ALEF_VARIANTS     = /[\u0622\u0623\u0625\u0671]/g;
const YA_VARIANT        = /\u0649/g;
const TA_MARBUTA        = /\u0629/g;

/** Strip diacritics, normalize alef/ya/ta-marbuta, lowercase */
export function normalizeAr(text: string): string {
  return text
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_VARIANTS, "\u0627")
    .replace(YA_VARIANT, "\u064A")
    .replace(TA_MARBUTA, "\u0647")
    .toLowerCase()
    .trim();
}

export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// ─── English stemmer (rule-based, domain-aware) ───────────────────────────────

const EN_IRREGULARS: Record<string, string> = {
  // Knives / blades
  knives: "knife", daggers: "dagger", blades: "blade", scissors: "scissor",
  // Electronics
  phones: "phone", mobiles: "mobile", smartphones: "smartphone",
  laptops: "laptop", notebooks: "notebook", computers: "computer",
  tablets: "tablet", keyboards: "keyboard", monitors: "monitor",
  cameras: "camera", speakers: "speaker", headphones: "headphone",
  earphones: "earphone", earbuds: "earbud", chargers: "charger",
  cables: "cable", batteries: "battery", printers: "printer", routers: "router",
  watches: "watch", smartwatches: "smartwatch",
  // Clothing
  clothes: "clothing", shirts: "shirt", pants: "pant", dresses: "dress",
  jackets: "jacket", shoes: "shoe", sandals: "sandal", bags: "bag",
  backpacks: "backpack", belts: "belt", sunglasses: "sunglass",
  // Furniture
  chairs: "chair", tables: "table", beds: "bed", sofas: "sofa",
  wardrobes: "wardrobe", shelves: "shelf", curtains: "curtain",
  carpets: "carpet", pillows: "pillow", blankets: "blanket", lamps: "lamp",
  mattresses: "mattress",
  // Kitchen
  fridges: "fridge", ovens: "oven", blenders: "blender", mixers: "mixer",
  kettles: "kettle", fans: "fan", irons: "iron",
  // Tools
  drills: "drill", brushes: "brush", tools: "tool",
  // Toys / games
  toys: "toy", games: "game",
  // Books
  books: "book", pens: "pen", pencils: "pencil", notebooks_: "notebook",
  // Food
  groceries: "grocery", oils: "oil",
};

/**
 * Reduce an English word to a canonical singular form.
 * Returns `null` when the word doesn't need stemming.
 */
function stemEn(word: string): string | null {
  const w = word.toLowerCase();
  if (EN_IRREGULARS[w]) return EN_IRREGULARS[w];

  // -ies → -y  (batteries → battery)
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  // -sses → -ss  (glasses → glass)
  if (w.endsWith("sses")) return w.slice(0, -2);
  // -ches / -shes / -xes → strip -es  (matches → match)
  if (
    (w.endsWith("ches") || w.endsWith("shes") || w.endsWith("xes")) &&
    w.length > 4
  )
    return w.slice(0, -2);
  // -ses / -zes → strip -s  (hoses → hose)
  if ((w.endsWith("ses") || w.endsWith("zes")) && w.length > 4)
    return w.slice(0, -1);
  // generic -s (not -ss)  (phones → phone)
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 4)
    return w.slice(0, -1);

  return null;
}

// ─── Bilingual synonym groups ─────────────────────────────────────────────────

/** All synonyms in one flat list — bidirectional lookup via buildLookups() */
const SYNONYM_GROUPS: string[][] = [
  // ─── Electronics ────────────────────────────────────────────────────────────
  ["phone", "phones", "هاتف", "جوال", "موبايل", "smartphone", "مبايل"],
  ["iphone", "ايفون", "apple phone"],
  ["samsung", "سامسونج", "سامسنج"],
  ["laptop", "laptops", "لابتوب", "نوتبوك", "notebook", "حاسوب محمول"],
  ["computer", "computers", "pc", "حاسوب", "كمبيوتر", "حاسب"],
  ["tablet", "ipad", "تابلت", "ايباد"],
  ["tv", "television", "تلفزيون", "تلفاز", "شاشة تلفزيون", "smart tv"],
  ["monitor", "screen", "شاشة", "مشاشة", "display"],
  ["camera", "cameras", "كاميرا", "تصوير"],
  ["headphones", "earphones", "headset", "سماعات", "سماعة", "earbuds"],
  ["speaker", "speakers", "مكبر", "مكبرات صوت", "بلوتوث سبيكر"],
  ["watch", "watches", "ساعة", "ساعات"],
  ["smartwatch", "smart watch", "ساعة ذكية", "ساعة سمارت"],
  ["charger", "chargers", "شاحن", "شواحن", "كابل شحن"],
  ["cable", "cables", "كابل", "كبل", "wire"],
  ["battery", "batteries", "بطارية", "بطاريات"],
  ["keyboard", "keyboards", "كيبورد", "لوحة مفاتيح"],
  ["mouse", "ماوس", "فارة"],
  ["printer", "printers", "طابعة", "طابعات"],
  ["router", "wifi", "راوتر", "وايفاي", "انترنت"],
  ["power bank", "باور بانك", "شاحن محمول"],
  // ─── Kitchen blades ──────────────────────────────────────────────────────────
  ["knife", "knives", "سكين", "سكاكين", "مدية", "مديه", "سكينة"],
  ["dagger", "blade", "خنجر", "خناجر", "شفرة"],
  ["scissors", "مقص", "مقصات"],
  ["grater", "مبشرة"],
  // ─── Clothing & accessories ───────────────────────────────────────────────
  ["clothes", "clothing", "fashion", "wear", "ملابس", "أزياء", "ازياء"],
  ["shirt", "shirts", "قميص", "قمصان", "تيشرت", "t-shirt"],
  ["pants", "trousers", "jeans", "بنطلون", "بنطال", "جينز"],
  ["dress", "dresses", "فستان", "فساتين"],
  ["jacket", "coat", "جاكيت", "معطف", "جاكت"],
  ["shoes", "footwear", "احذية", "حذاء", "حذيه"],
  ["sandals", "صندل", "صنادل"],
  ["bag", "bags", "handbag", "purse", "حقيبة", "حقائب", "شنطة"],
  ["backpack", "حقيبة ظهر", "ظهر"],
  ["belt", "حزام", "حزامات"],
  ["sunglasses", "نظارات شمسية", "نظارة"],
  // ─── Furniture & home ─────────────────────────────────────────────────────
  ["furniture", "اثاث", "أثاث", "فرنيتشر"],
  ["chair", "chairs", "كرسي", "كراسي"],
  ["table", "tables", "desk", "طاولة", "طاولات", "مكتب"],
  ["bed", "beds", "سرير", "اسرة", "أسرة"],
  ["sofa", "couch", "أريكة", "اريكة", "كنبة", "كنب"],
  ["wardrobe", "cabinet", "closet", "خزانة", "دولاب"],
  ["shelf", "shelves", "رف", "أرفف", "رفوف"],
  ["curtains", "ستائر", "ستارة"],
  ["carpet", "rug", "سجادة", "سجاد"],
  ["mattress", "مرتبة", "فرشة"],
  ["lamp", "light", "مصباح", "إضاءة", "اضاءة"],
  ["pillow", "pillows", "وسادة", "وسائد", "مخدة"],
  ["blanket", "بطانية", "غطاء"],
  // ─── Kitchen & appliances ─────────────────────────────────────────────────
  ["kitchen", "مطبخ"],
  ["refrigerator", "fridge", "ثلاجة", "براد"],
  ["washing machine", "washer", "غسالة", "غسيل"],
  ["air conditioner", "ac", "مكيف", "مكيفات", "تكييف"],
  ["oven", "microwave", "فرن", "ميكرويف", "ميكروويف"],
  ["blender", "mixer", "خلاط", "عجانة", "مضربة"],
  ["coffee", "coffee maker", "قهوة", "ماكينة قهوة"],
  ["kettle", "غلاية", "كتل"],
  ["fan", "مروحة", "مراوح"],
  ["vacuum", "مكنسة", "مكنسة كهربائية"],
  ["iron", "مكواة", "كوي"],
  // ─── Beauty & care ────────────────────────────────────────────────────────
  ["perfume", "fragrance", "cologne", "عطر", "عطور", "بخاخ"],
  ["skincare", "skin care", "عناية بالبشرة", "كريم", "لوشن"],
  ["cosmetics", "beauty", "makeup", "مكياج", "مستحضرات", "تجميل"],
  ["shampoo", "شامبو", "غسول شعر"],
  ["soap", "صابون", "سابون"],
  // ─── Sports & outdoors ────────────────────────────────────────────────────
  ["sports", "fitness", "رياضة", "رياضي"],
  ["gym", "جيم", "نادي رياضي"],
  ["football", "soccer", "كرة قدم", "كرة"],
  ["bicycle", "bike", "دراجة", "دراجات"],
  ["yoga", "يوغا"],
  // ─── Kids & toys ──────────────────────────────────────────────────────────
  ["toy", "toys", "لعبة", "العاب", "ألعاب"],
  ["game", "games", "gaming", "لعبة", "العاب", "جيمنج"],
  ["baby", "infant", "رضيع", "اطفال", "أطفال"],
  // ─── Books & stationery ───────────────────────────────────────────────────
  ["book", "books", "كتاب", "كتب"],
  ["pen", "pencil", "قلم", "اقلام"],
  ["notebook", "دفتر", "دفاتر"],
  // ─── Food & grocery ───────────────────────────────────────────────────────
  ["food", "grocery", "groceries", "طعام", "اكل", "مواد غذائية", "بقالة"],
  ["oil", "زيت", "زيوت"],
  ["rice", "أرز", "ارز"],
  ["sugar", "سكر"],
  ["flour", "طحين", "دقيق"],
  ["pistachio", "pistachios", "فستق", "فستق حلبي"],
  ["nuts", "nut", "مكسرات", "حبوب"],
  ["spice", "spices", "بهارات", "بهار", "توابل"],
  // ─── Vehicles & auto ──────────────────────────────────────────────────────
  ["car", "auto", "vehicle", "سيارة", "سيارات", "عربة"],
  ["motorcycle", "motorbike", "دراجة نارية"],
  // ─── Tools & hardware ─────────────────────────────────────────────────────
  ["tools", "equipment", "hardware", "أدوات", "ادوات", "عدة"],
  ["drill", "مثقاب", "دريل"],
  ["paint", "brush", "دهان", "صبغ", "طلاء"],
  // ─── Handcraft / Damascus ─────────────────────────────────────────────────
  ["damascus", "دمشق", "دمشقي", "حرف يدوية", "handcraft", "handicraft"],
  ["steel", "فولاذ", "حديد", "معدن"],
  ["handmade", "صنع يدوي", "يدوي"],
  ["olive", "زيتون", "زيت زيتون"],
  ["soap bar", "صابون ورد", "غار"],
];

/**
 * Build lookup maps from the synonym groups.
 * Every normalised term maps to all other terms in its group.
 */
function buildLookups(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = group.map(normalizeAr);
    for (let i = 0; i < normalizedGroup.length; i++) {
      if (!map.has(normalizedGroup[i])) map.set(normalizedGroup[i], new Set());
      const synonyms = map.get(normalizedGroup[i])!;
      for (let j = 0; j < group.length; j++) {
        if (i !== j) synonyms.add(group[j]);
      }
    }
  }
  return map;
}

const SYNONYM_MAP = buildLookups();

/**
 * Expand a raw user query into up to 4 search terms (original + translations).
 * The original query is always first.
 *
 * Strategy:
 *   1. Exact normalised match in synonym map
 *   2. Substring / partial match in synonym map
 *   3. English stem → repeat synonym lookup (e.g. "knives" → "knife" → synonyms)
 */
export function expandSearchQuery(rawQuery: string): string[] {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const normalizedQ = normalizeAr(q);
  const terms = new Set<string>([q]);

  // 1. Exact synonym match
  const exact = SYNONYM_MAP.get(normalizedQ);
  if (exact) exact.forEach((s) => terms.add(s));

  // 2. Substring / partial match
  if (terms.size < 5) {
    for (const [key, synonyms] of SYNONYM_MAP.entries()) {
      if (key === normalizedQ) continue;
      if (key.includes(normalizedQ) || normalizedQ.includes(key)) {
        synonyms.forEach((s) => terms.add(s));
        if (terms.size >= 5) break;
      }
    }
  }

  // 3. English stemming — handles "knives" → "knife" → Arabic synonyms
  if (terms.size < 5 && !isArabic(q)) {
    const stemmed = stemEn(normalizedQ);
    if (stemmed && stemmed !== normalizedQ) {
      terms.add(stemmed);
      const stemSyns = SYNONYM_MAP.get(stemmed);
      if (stemSyns) stemSyns.forEach((s) => terms.add(s));
    }
  }

  return Array.from(terms).slice(0, 4);
}

/**
 * Score a product for relevance to a search query (client-side tie-breaking).
 * Higher = more relevant. Used after the backend pg_trgm score.
 */
export function scoreProduct(
  product: { name: string; description?: string | null; category?: string | null },
  rawQuery: string
): number {
  const q = normalizeAr(rawQuery);
  const name = normalizeAr(product.name);
  const desc = normalizeAr(product.description ?? "");
  const cat  = normalizeAr(product.category ?? "");

  if (name === q)         return 100;
  if (name.startsWith(q)) return 90;
  if (name.includes(q))   return 80;
  if (cat.includes(q))    return 60;
  if (desc.includes(q))   return 40;

  // Also score against expanded terms (cross-language)
  const expanded = expandSearchQuery(rawQuery).slice(1);
  for (const term of expanded) {
    const t = normalizeAr(term);
    if (name.includes(t)) return 70;
    if (cat.includes(t))  return 50;
  }

  // English stemmed form
  if (!isArabic(rawQuery)) {
    const stemmed = stemEn(q);
    if (stemmed && name.includes(stemmed)) return 75;
  }

  return 0;
}
