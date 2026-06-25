// @ts-strict-ignore — enterprise search engine with dynamic SQL construction
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { MAIN_CATEGORY_SLUGS } from "../categories";
import { processSearchQuery } from "../utils/searchProcessor";
import { optionalAuth, requireAuth, requireRole } from "../middlewares/auth";
import { searchCache, buildCacheKey, getTTL } from "../services/searchCache";
import { productsCache, productDetailCache, categoriesCache, sellersCache } from "../services/cacheService";

const router: IRouter = Router();

/* ═══════════════════════════════════════════════════════════════════════════
   I-b. IN-MEMORY SYNONYM CACHE  (5 min TTL, populated from search_synonyms)
   ═══════════════════════════════════════════════════════════════════════════ */
interface SynonymCacheState { map: Map<string, string[]>; loadedAt: number; }
let _synonymCache: SynonymCacheState | null = null;
const SYNONYM_TTL_MS = 5 * 60 * 1000;

async function loadSynonymMap(): Promise<Map<string, string[]>> {
  const now = Date.now();
  if (_synonymCache && (now - _synonymCache.loadedAt) < SYNONYM_TTL_MS) return _synonymCache.map;
  try {
    const { rows } = await pool.query<{ term: string; synonym: string; is_bidirectional: boolean }>(
      `SELECT term, synonym, is_bidirectional FROM search_synonyms`,
    );
    const map = new Map<string, string[]>();
    const addEntry = (k: string, v: string) => {
      const nk = normalizeArabic(k.toLowerCase());
      const nv = normalizeArabic(v.toLowerCase());
      if (!map.has(nk)) map.set(nk, []);
      if (!map.get(nk)!.includes(nv)) map.get(nk)!.push(nv);
    };
    for (const row of rows) {
      addEntry(row.term, row.synonym);
      if (row.is_bidirectional) addEntry(row.synonym, row.term);
    }
    _synonymCache = { map, loadedAt: now };
    return map;
  } catch { return new Map(); }
}

async function expandWithSynonyms(tokens: readonly string[]): Promise<{ expanded: string[]; synonymExpanded: boolean }> {
  const synMap = await loadSynonymMap();
  const seen = new Set<string>(tokens);
  const result = [...tokens];
  let synonymExpanded = false;
  for (const tok of tokens) {
    for (const s of (synMap.get(tok) ?? [])) {
      if (!seen.has(s) && result.length < 10) {
        seen.add(s); result.push(s); synonymExpanded = true;
      }
    }
  }
  return { expanded: result, synonymExpanded };
}

/* ═══════════════════════════════════════════════════════════════════════════
   I.  ARABIC NLP — normalizeArabic
   ═══════════════════════════════════════════════════════════════════════════
   Strips diacritics, normalises all common variant letter forms so that
   fuzzy matching is robust regardless of input encoding choice.
   ─────────────────────────────────────────────────────────────────────── */
function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ؤئ]/g, "ء")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
   II. SYRIAN DIALECT & INTENT DICTIONARY
   ═══════════════════════════════════════════════════════════════════════════
   Maps colloquial Syrian Arabic terms → standard DB categories + keywords.
   ─────────────────────────────────────────────────────────────────────── */
const SYRIAN_DIALECT_DICTIONARY: Record<string, { category: string; keywords: string[] }> = {
  // Shoes
  "شنط":     { category: "Fashion", keywords: ["حقائب", "شنطة", "حقيبة يد", "حقيبة ظهر"] },
  "شنطة":    { category: "Fashion", keywords: ["حقائب", "حقيبة يد", "حقيبة كتف"] },
  "بواط":   { category: "Fashion", keywords: ["أحذية", "أحذية رياضية", "بوط", "سناكرز"] },
  "بوط":    { category: "Fashion", keywords: ["أحذية", "أحذية رياضية", "سبور"] },
  "شحاطات": { category: "Fashion", keywords: ["أحذية", "شحاطة", "صنادل", "نعال"] },
  "شحاطة":  { category: "Fashion", keywords: ["أحذية", "شحاطة", "صندل"] },
  "صباط":   { category: "Fashion", keywords: ["أحذية", "أحذية رسمية", "كندرة"] },
  "صبابيط": { category: "Fashion", keywords: ["أحذية", "أحذية رسمية"] },
  "كندرة":  { category: "Fashion", keywords: ["أحذية", "أحذية رسمية", "كعب عالي"] },
  "كنادر":  { category: "Fashion", keywords: ["أحذية", "أحذية رسمية"] },
  "جزمة":   { category: "Fashion", keywords: ["أحذية", "جزمات", "بوط شتوي", "أحذية طويلة"] },
  "جزم":    { category: "Fashion", keywords: ["أحذية", "جزمات"] },
  "بابوج":  { category: "Fashion", keywords: ["أحذية", "خف منزل", "شحاطة بيت"] },
  // Clothing
  "أواعي":   { category: "Fashion", keywords: ["ملابس", "أزياء", "ثياب"] },
  "ثياب":    { category: "Fashion", keywords: ["ملابس", "أزياء"] },
  "لبس":     { category: "Fashion", keywords: ["ملابس", "أزياء"] },
  "هدوم":    { category: "Fashion", keywords: ["ملابس", "ثياب"] },
  "كسوة":    { category: "Fashion", keywords: ["ملابس", "تجهيز العرائس"] },
  "مانطو":   { category: "Fashion", keywords: ["ملابس نسائية", "جاكيت طويل", "بالطو"] },
  "مانطويا": { category: "Fashion", keywords: ["ملابس نسائية", "جاكيتات"] },
  "كنزة":    { category: "Fashion", keywords: ["ملابس", "بلوزة", "سويتر", "تيشيرت"] },
  "تناوير":  { category: "Fashion", keywords: ["ملابس نسائية", "تنورة"] },
  "فستان":   { category: "Fashion", keywords: ["ملابس نسائية", "فساتين", "سهرة"] },
  "فساتين":  { category: "Fashion", keywords: ["ملابس نسائية", "فستان", "سهرة"] },
  "بدلة":    { category: "Fashion", keywords: ["ملابس رجالية", "بدلة رسمية", "سموكن"] },
  "بدل":     { category: "Fashion", keywords: ["ملابس رجالية", "بدلة رسمية"] },
  "تياب":    { category: "Fashion", keywords: ["ملابس", "ثياب", "أزياء"] },
  "دشاديش":  { category: "Fashion", keywords: ["ملابس رجالية", "جلابيات"] },
  "كلابية":  { category: "Fashion", keywords: ["ملابس", "جلابية"] },
  "بجامة":   { category: "Fashion", keywords: ["ملابس نوم", "بيجامات", "ترينغ"] },
  "ترينغ":   { category: "Fashion", keywords: ["ملابس رياضية", "بيجامة سبور"] },
  // Electronics
  "موبايل":   { category: "Electronics", keywords: ["هواتف ذكية", "جوالات", "موبايلات"] },
  "موبايلات": { category: "Electronics", keywords: ["هواتف ذكية", "جوالات", "موبايل"] },
  "موبايلة":  { category: "Electronics", keywords: ["هواتف ذكية", "موبايل"] },
  "جوال":     { category: "Electronics", keywords: ["هواتف ذكية", "موبايل"] },
  "خليوي":    { category: "Electronics", keywords: ["هواتف ذكية", "جوال"] },
  "تليفون":   { category: "Electronics", keywords: ["هواتف ذكية", "موبايلات"] },
  "شاشة":     { category: "Electronics", keywords: ["تلفزيونات", "شاشات ذكية", "TV"] },
  "تلفزيون":  { category: "Electronics", keywords: ["شاشات", "تلفزيونات"] },
  "لابتوب":   { category: "Electronics", keywords: ["كمبيوترات محمولة", "حاسوب", "لاب توب"] },
  "كمبيوتر":  { category: "Electronics", keywords: ["حاسوب", "أجهزة مكتبية", "PC"] },
  "وصلة":     { category: "Electronics", keywords: ["كابلات", "شواحن", "وصلة شحن"] },
  "باوربانك": { category: "Electronics", keywords: ["بنك طاقة", "شاحن سفري"] },
  "سماعات":   { category: "Electronics", keywords: ["سماعات أذن", "هيدفون", "ايربودز"] },
  // Automotive
  "عربيات":   { category: "Automotive", keywords: ["سيارات", "إكسسوارات سيارات", "قطع غيار"] },
  "موتوسيكل": { category: "Sports & Outdoors", keywords: ["دراجات نارية", "موتو", "هيلمت"] },
  "دراجات":   { category: "Sports & Outdoors", keywords: ["دراجة هوائية", "سكيت", "رياضة"] },
  // Home & Kitchen
  "ديكور":    { category: "Home & Kitchen", keywords: ["ديكور منزل", "لوحات", "إكسسوارات ديكور"] },
  "غراض بيت": { category: "Home & Kitchen", keywords: ["أدوات منزلية", "ديكور", "أثاث"] },
  "طناجر":    { category: "Home & Kitchen", keywords: ["أدوات المطبخ", "طنجرة", "قدور طبخ"] },
  "صحون":     { category: "Home & Kitchen", keywords: ["أدوات المطبخ", "أطباق"] },
  "معالق":    { category: "Home & Kitchen", keywords: ["أدوات المطبخ", "ملاعق"] },
  "كاسات":    { category: "Home & Kitchen", keywords: ["أدوات المطبخ", "أكواب"] },
  "حرامات":   { category: "Home & Kitchen", keywords: ["مفروشات", "بطانيات", "لحف"] },
  "برداية":   { category: "Home & Kitchen", keywords: ["ستائر", "برادي"] },
  "برادي":    { category: "Home & Kitchen", keywords: ["ستائر", "مفروشات"] },
  "صوبيا":    { category: "Home & Kitchen", keywords: ["وسائل تدفئة", "مدفأة", "صوبيات"] },
  "نملية":    { category: "Home & Kitchen", keywords: ["خزائن مطبخ", "منظمات"] },
  // Groceries
  "مونة":        { category: "Supermarket & Grocery", keywords: ["أغذية مجففة", "زيت زيتون", "مكدوس", "تموين"] },
  "غراض طبق":   { category: "Supermarket & Grocery", keywords: ["خضروات", "لحوم", "مواد غذائية"] },
  "أكل":         { category: "Supermarket & Grocery", keywords: ["سوبرماركت", "مواد غذائية"] },
  "بزر":         { category: "Supermarket & Grocery", keywords: ["مكسرات", "تسالي"] },
  "سكاكر":       { category: "Supermarket & Grocery", keywords: ["حلويات", "بسكويت", "شوكولا"] },
  // Beauty
  "مكياجات": { category: "Beauty & Personal Care", keywords: ["مكياج", "مستحضرات تجميل"] },
  "حمرة":     { category: "Beauty & Personal Care", keywords: ["أحمر شفاه", "مكياج"] },
  "ريحة":     { category: "Beauty & Personal Care", keywords: ["عطور", "برفيوم"] },
  "عطورات":   { category: "Beauty & Personal Care", keywords: ["عطور", "برفيوم"] },
  "برفانات":  { category: "Beauty & Personal Care", keywords: ["عطور", "برفيوم", "كولونيا"] },
  "برفان":    { category: "Beauty & Personal Care", keywords: ["عطور", "برفيوم"] },
  "كريمات":   { category: "Beauty & Personal Care", keywords: ["كريم", "مرطب", "عناية بالبشرة"] },
  "كريمه":    { category: "Beauty & Personal Care", keywords: ["كريم مرطب", "عناية بالبشرة"] },
};

/* Intent modifiers: detected in query to adjust sort/filter strategy */
const INTENT_MODIFIERS = {
  cheap:   ["رخيص", "لقطة", "ببلاش", "على قد الايد", "اقتصادي", "حرق", "تنزيلات", "عروض", "كسر", "cheap", "budget", "affordable", "discount", "sale", "offer", "bargain"],
  premium: ["غالي", "فخم", "فاخر", "اصلي", "نخب اول", "ماركة", "براند", "ملوكي", "ممتاز", "وكالة", "premium", "luxury", "branded", "original", "authentic", "high-end", "professional"],
  used:    ["مستعمل", "شغال", "نضيف", "نص عمر", "بحالة الوكالة", "used", "second hand"],
  rating:  ["أفضل تقييم", "الأعلى تقييم", "موثوق", "مضمون", "مجرب", "أنصح به", "ينصح", "أكثر مبيعاً", "الأكثر طلباً", "best rated", "top rated", "top reviewed", "recommended", "trusted", "most popular", "bestseller"],
  newest:  ["جديد", "أحدث", "اخر اصدار", "حديث", "latest", "newest", "just arrived", "new arrival", "2025", "2026"],
  on_sale: ["عرض", "عروض", "تخفيض", "تخفيضات", "خصم", "خصومات", "سعر مخفض", "تنزيل", "مخفض", "sale", "discount", "offer", "deal", "promotion", "reduced", "clearance"],
  gift:    ["هدية", "هدايا", "مناسبة", "عيد", "اهداء", "كادو", "هدية لـ", "gift", "present", "birthday", "occasion", "surprise"],
} as const;

type IntentModifier = keyof typeof INTENT_MODIFIERS;

/* ═══════════════════════════════════════════════════════════════════════════
   III. INTENT PARSING PIPELINE
   ═══════════════════════════════════════════════════════════════════════════ */
interface ParsedIntent {
  modifiers: IntentModifier[];
  mappedCategory: string | null;
  expandedTerms: string[];
  baseTokens: string[];
  expandedQuery: string;
  detectedOnSale: boolean;
  detectedGift: boolean;
  categoryBrowseSlug: string | null;
}

/* Normalized dict key lookup — handles taa-marbouta/alef variants in keys */
const DIALECT_NORM_MAP: Map<string, { category: string; keywords: string[] }> = new Map(
  Object.entries(SYRIAN_DIALECT_DICTIONARY).map(([k, v]) => [normalizeArabic(k), v])
);

function parseIntent(rawQuery: string): ParsedIntent {
  const norm = normalizeArabic(rawQuery);
  const tokens = norm.split(/\s+/).filter(Boolean);

  const modifiers: IntentModifier[] = [];
  for (const [mod, words] of Object.entries(INTENT_MODIFIERS) as [IntentModifier, readonly string[]][]) {
    const normWords = words.map(normalizeArabic);
    /* Check single tokens AND multi-word phrases (e.g. "أفضل تقييم", "best rated") */
    const hit =
      tokens.some(t => normWords.includes(t)) ||
      normWords.some(w => w.includes(" ") && norm.includes(w));
    if (hit) modifiers.push(mod);
  }

  let mappedCategory: string | null = null;
  const expandedTerms: string[] = [];
  const dialectTokens = new Set<string>();

  for (const token of tokens) {
    /* Lookup via normalized key so taa-marbouta and alef variants always resolve */
    const entry = DIALECT_NORM_MAP.get(token);
    if (entry) {
      if (!mappedCategory) mappedCategory = entry.category;
      expandedTerms.push(...entry.keywords);
      dialectTokens.add(token);
    }
  }

  for (const [key, entry] of Object.entries(SYRIAN_DIALECT_DICTIONARY)) {
    if (key.includes(" ") && norm.includes(normalizeArabic(key))) {
      if (!mappedCategory) mappedCategory = entry.category;
      expandedTerms.push(...entry.keywords);
    }
  }

  const baseTokens = tokens.filter(t => !dialectTokens.has(t));
  const expandedQuery = [...new Set([...baseTokens, ...expandedTerms])].join(" ");

  const detectedOnSale = modifiers.includes("on_sale");
  const detectedGift   = modifiers.includes("gift");

  // Category browse detection — query is ONLY a category name (no other tokens)
  let categoryBrowseSlug: string | null = null;
  if (tokens.length <= 2 && expandedTerms.length === 0) {
    for (const [slug, labels] of Object.entries(CATEGORY_LABELS)) {
      if (
        norm === normalizeArabic(labels.en.toLowerCase()) ||
        norm === normalizeArabic(labels.ar)
      ) {
        categoryBrowseSlug = slug;
        break;
      }
    }
  }

  return { modifiers, mappedCategory, expandedTerms, baseTokens, expandedQuery, detectedOnSale, detectedGift, categoryBrowseSlug };
}

/* ═══════════════════════════════════════════════════════════════════════════
   IV. CATEGORY LABELS (EN + AR) — for /suggestions endpoint
   ═══════════════════════════════════════════════════════════════════════════ */
const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  "Electronics":            { en: "Electronics",            ar: "إلكترونيات" },
  "Fashion":                { en: "Fashion",                ar: "أزياء وموضة" },
  "Beauty & Personal Care": { en: "Beauty & Personal Care", ar: "جمال وعناية" },
  "Home & Kitchen":         { en: "Home & Kitchen",         ar: "منزل ومطبخ" },
  "Supermarket & Grocery":  { en: "Supermarket & Grocery",  ar: "بقالة وسوبرماركت" },
  "Sports & Fitness":       { en: "Sports & Fitness",       ar: "رياضة ولياقة" },
  "Automotive":             { en: "Automotive",             ar: "سيارات ومركبات" },
  "Gaming & Entertainment": { en: "Gaming & Entertainment", ar: "ألعاب وترفيه" },
  "Books & Stationery":     { en: "Books & Stationery",     ar: "كتب وقرطاسية" },
  "Pet Supplies":           { en: "Pet Supplies",           ar: "مستلزمات حيوانات" },
  "Digital Products":       { en: "Digital Products",       ar: "منتجات رقمية" },
  "Handmade & Crafts":      { en: "Handmade & Crafts",      ar: "مصنوعات يدوية" },
  "Jewelry & Luxury":       { en: "Jewelry & Luxury",       ar: "مجوهرات وكماليات" },
  "Baby & Kids":            { en: "Baby & Kids",            ar: "أطفال ورضع" },
  "Tools & Construction":   { en: "Tools & Construction",   ar: "أدوات وبناء" },
  "Garden & Outdoor":       { en: "Garden & Outdoor",       ar: "حديقة وخارجي" },
  "Gifts & Events":         { en: "Gifts & Events",         ar: "هدايا ومناسبات" },
};

/* ═══════════════════════════════════════════════════════════════════════════
   V.  UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */
function computeFinalPrice(price: number, discountPercent: number | null): number {
  if (!discountPercent || discountPercent <= 0) return price;
  return parseFloat((price * (1 - discountPercent / 100)).toFixed(2));
}

function trackQuery(rawTerm: string): void {
  const q = rawTerm.trim().toLowerCase().slice(0, 120);
  if (q.length < 2) return;
  pool.query(
    `INSERT INTO search_queries (query, count, last_searched)
     VALUES ($1, 1, NOW())
     ON CONFLICT (query) DO UPDATE
       SET count         = search_queries.count + 1,
           last_searched = NOW()`,
    [q],
  ).catch(() => {});
}

function makeParamBuilder() {
  const params: unknown[] = [];
  return {
    add(val: unknown): string { params.push(val); return `$${params.length}`; },
    get values(): unknown[] { return params; },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   VI.  NLP HELPERS — tsquery construction
   ═══════════════════════════════════════════════════════════════════════════
   Converts an array of NLP-pipeline tokens into a valid PostgreSQL tsquery
   string for the 'simple' dictionary.

   Rules:
     • Strip everything except Unicode letters, digits — prevents tsquery
       syntax injection and ensures 'simple' dictionary accepts each lexeme.
     • Cap at 30 terms to keep query complexity bounded.
     • Return null when the cleaned list is empty (triggers trigram-only mode).
   ─────────────────────────────────────────────────────────────────────── */

/**
 * Build an OR tsquery string: "term1 | term2 | term3"
 * Used for the broad expanded-token match (any synonym fires).
 */
function buildOrTsQuery(tokens: readonly string[]): string | null {
  const lexemes = tokens
    .map(t => t.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase())
    .filter(t => t.length > 1);
  if (lexemes.length === 0) return null;
  return [...new Set(lexemes)].slice(0, 30).join(" | ");
}

/**
 * Build an AND tsquery string: "term1 & term2"
 * Used for the precision boost — products matching ALL base tokens rank higher.
 */
function buildAndTsQuery(tokens: readonly string[]): string | null {
  const lexemes = tokens
    .map(t => t.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase())
    .filter(t => t.length > 1);
  if (lexemes.length === 0) return null;
  return [...new Set(lexemes)].slice(0, 10).join(" & ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 1 — GET /api/search
   ═══════════════════════════════════════════════════════════════════════════
   Legacy search endpoint — dialect-enhanced LIKE + trigram scoring.
   ─────────────────────────────────────────────────────────────────────── */
router.get("/search", async (req, res): Promise<void> => {
  const raw = String(req.query.q ?? "").trim();
  if (raw.length < 2) { res.json([]); return; }

  const rawLimit = parseInt(String(req.query.limit ?? "10"), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? rawLimit : 10;

  const intent = parseIntent(raw);
  const term = normalizeArabic(raw);
  const likePattern = `%${term}%`;
  const expandedLike = `%${normalizeArabic(intent.expandedQuery)}%`;

  trackQuery(raw);

  const pb = makeParamBuilder();
  const pTerm        = pb.add(term);
  const pLike        = pb.add(likePattern);
  const pExpanded    = pb.add(intent.expandedQuery);
  const pExpandedLike= pb.add(expandedLike);
  const pMappedCat   = pb.add(intent.mappedCategory?.toLowerCase() ?? null);
  const pLimit       = pb.add(limit);

  const { rows } = await pool.query(
    `WITH scored AS (
      SELECT
        p.id, p.seller_id,
        u.name  AS seller_name,
        p.name, p.description,
        p.price::text,
        p.discount_percent::text,
        p.category, p.subcategory, p.stock,
        p.image_url, p.featured, p.name_ar, p.created_at,
        GREATEST(
          CASE WHEN ${pMappedCat}::text IS NOT NULL
               AND lower(p.category) = ${pMappedCat}::text THEN 1.00 ELSE 0 END,
          CASE WHEN lower(p.name) = ${pTerm}             THEN 0.95 ELSE 0 END,
          CASE WHEN lower(p.name) LIKE ${pTerm} || '%'   THEN 0.90 ELSE 0 END,
          CASE WHEN lower(p.name) LIKE ${pLike}          THEN 0.80 ELSE 0 END,
          word_similarity(${pTerm}, lower(p.name))                    * 0.75,
          CASE WHEN lower(COALESCE(p.name_ar,'')) LIKE ${pLike}
                                                          THEN 0.80 ELSE 0 END,
          word_similarity(${pTerm}, lower(COALESCE(p.name_ar,'')))    * 0.75,
          CASE WHEN lower(COALESCE(p.search_tokens,'')) LIKE ${pExpandedLike}
                                                          THEN 0.55 ELSE 0 END,
          word_similarity(${pExpanded}, lower(COALESCE(p.search_tokens,''))) * 0.50,
          CASE WHEN lower(p.description) LIKE ${pLike}   THEN 0.30 ELSE 0 END,
          word_similarity(${pTerm}, lower(p.description))             * 0.20
        ) AS score
      FROM products p
      INNER JOIN users u ON u.id = p.seller_id
      WHERE p.stock > 0
        AND (
          lower(p.name)                          LIKE ${pLike}
          OR lower(COALESCE(p.name_ar,''))        LIKE ${pLike}
          OR lower(COALESCE(p.search_tokens,''))  LIKE ${pExpandedLike}
          OR lower(p.description)                 LIKE ${pLike}
          OR (${pMappedCat}::text IS NOT NULL AND lower(p.category) = ${pMappedCat}::text)
          OR word_similarity(${pTerm}, lower(p.name)) > 0.20
          OR word_similarity(${pTerm}, lower(COALESCE(p.name_ar,''))) > 0.20
        )
    )
    SELECT * FROM scored WHERE score > 0
    ORDER BY score DESC
    LIMIT ${pLimit}`,
    pb.values,
  );

  const result = rows.map((r: any) => ({
    id: r.id,
    sellerId: r.seller_id,
    sellerName: r.seller_name ?? "Unknown",
    name: r.name,
    description: r.description,
    price: parseFloat(r.price),
    discountPercent: r.discount_percent ? parseFloat(r.discount_percent) : null,
    finalPrice: computeFinalPrice(parseFloat(r.price), r.discount_percent ? parseFloat(r.discount_percent) : null),
    category: r.category,
    subcategory: r.subcategory ?? null,
    stock: r.stock,
    imageUrl: r.image_url ?? null,
    featured: r.featured,
    nameAr: r.name_ar ?? null,
    createdAt: r.created_at.toISOString(),
    score: Math.round(r.score * 100) / 100,
  }));

  res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
  res.json(result);
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 2 — GET /api/search/suggestions
   ═══════════════════════════════════════════════════════════════════════════
   Step 4 — Autocomplete Engine.
   Returns: { suggestions[], categories[], stores[], trending[], processingTimeMs }
   Suggestion items carry optional `type` ('intent'|'product'|'subcategory')
   and `meta` (e.g. "price_asc", "rating", product count hint).
   ─────────────────────────────────────────────────────────────────────── */

/** Fire-and-forget: log query to `query_logs` for autocomplete analytics */
function logToQueryLogs(rawTerm: string, lang: string): void {
  const q = rawTerm.trim().slice(0, 120);
  if (q.length < 2) return;
  pool.query(
    `INSERT INTO query_logs (query, lang) VALUES ($1, $2)`,
    [q, lang === "en" ? "en" : "ar"],
  ).catch(() => {});
}

/** Fire-and-forget: update query_logs row with result_count + fallback_level after search */
function updateQueryLog(id: number, resultCount: number, fallbackLevel: number | null): void {
  pool.query(
    `UPDATE query_logs SET result_count = $2, fallback_level = $3 WHERE id = $1`,
    [id, resultCount, fallbackLevel],
  ).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEMANTIC SEARCH LAYER — vector similarity via pgvector + multilingual-e5-small
   ───────────────────────────────────────────────────────────────────────────
   Architecture:
     • Embedding service (FastAPI on port 8001) provides query/passage vectors
     • Products are embedded at creation time + backfilled at startup
     • pgvector cosine distance used for nearest-neighbour retrieval
     • Runs in parallel with the FTS pipeline; results merged via RRF
     • Gracefully degrades to FTS-only when embedding service / pgvector unavailable
   ═══════════════════════════════════════════════════════════════════════════ */

let _embeddingServiceAvailable = false;
let _pgvectorAvailable         = false;

const EMBEDDING_SERVICE_URL = process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8001";
const EMBEDDING_TIMEOUT_MS  = 2000;

interface SemanticResult { id: number; score: number; }

async function _probeEmbeddingService(): Promise<boolean> {
  if (!process.env["EMBEDDING_SERVICE_URL"]) return false;
  try {
    const resp = await fetch(`${EMBEDDING_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
    });
    return resp.ok;
  } catch { return false; }
}

async function _probePgvector(): Promise<boolean> {
  try { await pool.query(`SELECT NULL::vector(1)`); return true; } catch { return false; }
}

// Startup probe + periodic re-probe every 60 s
(async () => {
  _pgvectorAvailable         = await _probePgvector();
  _embeddingServiceAvailable = await _probeEmbeddingService();
  console.log(`[search] pgvector=${_pgvectorAvailable} embedding_service=${_embeddingServiceAvailable}`);
  setInterval(async () => {
    _embeddingServiceAvailable = await _probeEmbeddingService();
  }, 60_000);
})();

/** Fetch a query embedding from the embedding service (2-second hard timeout). */
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  if (!_embeddingServiceAvailable || !process.env["EMBEDDING_SERVICE_URL"]) return null;
  try {
    const resp = await fetch(`${EMBEDDING_SERVICE_URL}/embed/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: query }),
      signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { embedding?: number[] };
    return data.embedding ?? null;
  } catch { return null; }
}

/** cosine nearest-neighbour search using pgvector's <=> operator. */
async function semanticSearch(embedding: number[], topK: number): Promise<SemanticResult[]> {
  if (!_pgvectorAvailable) return [];
  try {
    const { rows } = await pool.query<{ id: number; score: number }>(
      `SELECT p.id, (1.0 - (p.embedding <=> $1::vector))::float AS score
       FROM products p
       INNER JOIN users u ON u.id = p.seller_id AND u.account_status = 'active'
       INNER JOIN seller_applications sa ON sa.user_id = p.seller_id AND sa.status = 'approved'
       WHERE p.embedding IS NOT NULL AND p.stock > 0
       ORDER BY p.embedding <=> $1::vector
       LIMIT $2`,
      [`[${embedding.join(",")}]`, topK],
    );
    return rows;
  } catch { return []; }
}

/**
 * Reciprocal Rank Fusion — merges two ranked lists into a unified ordering.
 * k=60 is the standard constant (Cormack et al. 2009).
 * ftsWeight + semanticWeight should sum to 1.0.
 */
function reciprocalRankFusion<T extends { id: number }>(
  ftsResults:      T[],
  semanticResults: SemanticResult[],
  ftsWeight      = 0.65,
  semanticWeight = 0.35,
  k              = 60,
): { id: number; rrfScore: number; fromSemantic: boolean }[] {
  const scores      = new Map<number, number>();
  const fromSemSet  = new Set<number>();

  ftsResults.forEach((item, rank) => {
    scores.set(item.id, (scores.get(item.id) ?? 0) + ftsWeight * (1 / (k + rank + 1)));
  });
  semanticResults.forEach((item, rank) => {
    scores.set(item.id, (scores.get(item.id) ?? 0) + semanticWeight * (1 / (k + rank + 1)));
    fromSemSet.add(item.id);
  });

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, rrfScore]) => ({ id, rrfScore, fromSemantic: fromSemSet.has(id) }));
}

/** Async: insert into query_logs and return the new row id (or null on failure/timeout) */
async function logToQueryLogsGetId(rawTerm: string, lang: string): Promise<number | null> {
  const q = rawTerm.trim().slice(0, 120);
  if (q.length < 2) return null;
  try {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO query_logs (query, lang) VALUES ($1, $2) RETURNING id`,
      [q, lang === "en" ? "en" : "ar"],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

router.get("/search/suggestions", async (req, res): Promise<void> => {
  const t0   = Date.now();
  const raw  = String(req.query.q ?? "").trim();
  const lang = String(req.query.lang ?? "ar");
  const term = normalizeArabic(raw);
  const likePattern = `%${term}%`;

  const trendingPromise = pool.query<{ query: string; count: number }>(
    `SELECT query, count FROM search_queries ORDER BY count DESC, last_searched DESC LIMIT 6`,
  );

  if (raw.length < 2) {
    const trending = await trendingPromise;
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json({ suggestions: [], categories: [], stores: [], trending: trending.rows, processingTimeMs: Date.now() - t0 });
    return;
  }

  const intent = parseIntent(raw);
  const expandedLike = `%${normalizeArabic(intent.expandedQuery)}%`;

  // Log to both analytics tables; query_logs insert runs concurrently with product queries
  trackQuery(raw);
  const logIdPromise = logToQueryLogsGetId(raw, lang);

  const [productNamesRes, storesRes, trendingRes] = await Promise.all([
    pool.query<{ name: string; name_ar: string | null; category: string; subcategory: string | null }>(
      `SELECT DISTINCT p.name, p.name_ar, p.category, p.subcategory
       FROM products p
       WHERE p.stock > 0
         AND (
           lower(p.name)                          LIKE $1
           OR lower(COALESCE(p.name_ar,''))        LIKE $1
           OR lower(COALESCE(p.search_tokens,''))  LIKE $2
           OR lower(p.category)                    LIKE $1
           OR lower(COALESCE(p.subcategory,''))     LIKE $1
           OR ($3::text IS NOT NULL AND lower(p.category) = $3::text)
           OR word_similarity($4, lower(p.name))  > 0.25
         )
       LIMIT 24`,
      [likePattern, expandedLike, intent.mappedCategory?.toLowerCase() ?? null, term],
    ),
    pool.query<{ user_id: number; store_name: string | null; store_slug: string | null; store_logo: string | null; city: string | null }>(
      `SELECT sa.user_id, sa.store_name, sa.store_slug, sa.store_logo, sa.city
       FROM seller_applications sa
       WHERE sa.status = 'approved'
         AND sa.store_name IS NOT NULL
         AND lower(COALESCE(sa.store_name,'')) LIKE $1
       ORDER BY lower(sa.store_name) ASC LIMIT 3`,
      [likePattern],
    ),
    trendingPromise,
  ]);

  const seen = new Set<string>();
  const suggestions: { text: string; textAr: string | null; type?: string; meta?: string }[] = [];

  function addSuggestion(text: string, textAr: string | null, type?: string, meta?: string) {
    if (suggestions.length >= 7) return;
    const key    = normalizeArabic(textAr ?? text).slice(0, 50);
    const engKey = text.toLowerCase().slice(0, 50);
    if (seen.has(key) || seen.has(engKey)) return;
    seen.add(key); seen.add(engKey);
    suggestions.push({ text, textAr, type, meta });
  }

  /* ── Intent suggestions (cheap / premium / rating / newest) ─────────── */
  if (intent.modifiers.includes("cheap")) {
    const catAr = intent.mappedCategory ? (CATEGORY_LABELS[intent.mappedCategory]?.ar ?? intent.mappedCategory) : "المنتجات";
    const catEn = intent.mappedCategory ? (CATEGORY_LABELS[intent.mappedCategory]?.en ?? intent.mappedCategory) : "products";
    addSuggestion(`cheapest ${catEn}`, `أرخص ${catAr} سعراً`, "intent", "price_asc");
  }
  if (intent.modifiers.includes("premium")) {
    const catAr = intent.mappedCategory ? (CATEGORY_LABELS[intent.mappedCategory]?.ar ?? intent.mappedCategory) : "المنتجات";
    const catEn = intent.mappedCategory ? (CATEGORY_LABELS[intent.mappedCategory]?.en ?? intent.mappedCategory) : "products";
    addSuggestion(`top rated ${catEn}`, `أفضل ${catAr} جودةً`, "intent", "rating");
  }
  if (intent.modifiers.includes("rating") && !intent.modifiers.includes("premium")) {
    const catAr = intent.mappedCategory ? (CATEGORY_LABELS[intent.mappedCategory]?.ar ?? intent.mappedCategory) : "المنتجات";
    const catEn = intent.mappedCategory ? (CATEGORY_LABELS[intent.mappedCategory]?.en ?? intent.mappedCategory) : "products";
    addSuggestion(`best rated ${catEn}`, `أعلى ${catAr} تقييماً`, "intent", "rating");
  }
  if (intent.modifiers.includes("newest")) {
    const catAr = intent.mappedCategory ? (CATEGORY_LABELS[intent.mappedCategory]?.ar ?? intent.mappedCategory) : "المنتجات";
    const catEn = intent.mappedCategory ? (CATEGORY_LABELS[intent.mappedCategory]?.en ?? intent.mappedCategory) : "products";
    addSuggestion(`newest ${catEn}`, `أحدث ${catAr}`, "intent", "newest");
  }

  /* ── Dialect-expanded keyword suggestions ───────────────────────────── */
  if (intent.expandedTerms.length > 0) {
    for (const kw of intent.expandedTerms.slice(0, 3)) addSuggestion(kw, null, "product");
  }

  /* ── Product name matches ───────────────────────────────────────────── */
  for (const row of productNamesRes.rows) {
    const arName = row.name_ar ?? null;
    const enName = row.name;
    if (arName) {
      const normAr = normalizeArabic(arName);
      if (normAr.includes(term)) { addSuggestion(enName, arName, "product"); continue; }
    }
    if (enName.toLowerCase().includes(raw.toLowerCase())) addSuggestion(enName, arName, "product");
  }

  /* ── Subcategory fallback with product count hint ───────────────────── */
  if (suggestions.length < 5) {
    const subcatCounts: Record<string, number> = {};
    for (const row of productNamesRes.rows) {
      if (row.subcategory) subcatCounts[row.subcategory] = (subcatCounts[row.subcategory] ?? 0) + 1;
    }
    Object.entries(subcatCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([sc, cnt]) => addSuggestion(
        `${raw} ${sc}`,
        null,
        "subcategory",
        `${cnt} ${cnt === 1 ? "product" : "products"}`,
      ));
  }

  const normRaw    = normalizeArabic(raw);
  const priorityCat = intent.mappedCategory;
  const categories = [
    ...MAIN_CATEGORY_SLUGS.filter(s => s === priorityCat),
    ...MAIN_CATEGORY_SLUGS.filter(s => s !== priorityCat && (
      s.toLowerCase().includes(raw.toLowerCase()) ||
      (CATEGORY_LABELS[s]?.en ?? "").toLowerCase().includes(raw.toLowerCase()) ||
      normalizeArabic(CATEGORY_LABELS[s]?.ar ?? "").includes(normRaw)
    )),
  ]
    .slice(0, 4)
    .map(slug => ({
      slug,
      labelEn: CATEGORY_LABELS[slug]?.en ?? slug,
      labelAr: CATEGORY_LABELS[slug]?.ar ?? slug,
    }));

  const stores = storesRes.rows.map(r => ({
    userId:    r.user_id,
    storeName: r.store_name ?? "",
    storeSlug: r.store_slug ?? null,
    storeLogo: r.store_logo ?? null,
    city:      r.city ?? null,
  }));

  const searchLogId = await logIdPromise;

  res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
  res.json({ suggestions, categories, stores, trending: trendingRes.rows, processingTimeMs: Date.now() - t0, searchLogId: searchLogId ?? null });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 3 — GET /api/search/results  (NLP + FTS + trigram hybrid engine)
   ═══════════════════════════════════════════════════════════════════════════

   ARCHITECTURE — three complementary scoring layers applied per product:

   ┌─────────────────────────────────────────────────────────────────────────┐
   │ Layer 1 — PostgreSQL Full-Text Search  (ts_rank_cd × 0.65)             │
   │   • processSearchQuery() produces NLP-expanded tokens                  │
   │   • Syrian dialect dictionary adds further keyword expansions           │
   │   • All terms merged into an OR tsquery against fts_vector             │
   │     (fts_vector is a weighted tsvector: A=name, B=category,            │
   │      C=search_tokens, D=description — maintained by a DB trigger)      │
   │   • ts_rank_cd with normalization flag 32 (÷ doc length)               │
   │                                                                         │
   │ Layer 2 — AND precision boost  (+0.20 when ALL base tokens match)      │
   │   • Rewards products mentioning every base concept from the query      │
   │                                                                         │
   │ Layer 3 — pg_trgm trigram similarity  (word_similarity × 0.55)        │
   │   • Fuzzy / typo-tolerant fallback for novel or mis-spelled terms      │
   │   • Also activates for queries whose tokens produce no FTS hits        │
   │   • Uses GIN trigram indexes → sub-millisecond                         │
   │                                                                         │
   │ final_score = GREATEST(                                                 │
   │   fts_score * 0.65 + and_boost + trgm_score * 0.25 + cat_score,       │
   │   trgm_score * 0.45,   ← pure-trigram floor for typos                 │
   │   cat_score            ← category-intent floor for dialect queries     │
   │ )                                                                       │
   └─────────────────────────────────────────────────────────────────────────┘

   SELLER GATE: INNER JOIN users (account_status='active') AND
                INNER JOIN seller_applications (status='approved')

   INTENT MODIFIERS:
     cheap   → ORDER BY final_price ASC
     premium → ORDER BY avg_rating DESC
     used    → WHERE search_tokens/name LIKE '%مستعمل%' OR '%used%'

   PAGINATION: COUNT(*) OVER() returns total across all matched rows.

   Query params:
     q          Search query (required, min 2 chars)
     page       Page number, default 1
     limit      Per-page count, default 20 (max 50)
     category   Filter to exact category slug
     priceMin   Minimum price (SYP)
     priceMax   Maximum price (SYP)
     sortBy     relevance | price_asc | price_desc | newest | rating
   ─────────────────────────────────────────────────────────────────────── */
router.get("/search/results", optionalAuth, async (req, res): Promise<void> => {
  /* ── 1. Early-exit guard ───────────────────────────────────────────── */
  const raw = String(req.query.q ?? "").trim();
  if (raw.length < 2) {
    res.json({
      results: [], total: 0, page: 1, limit: 20, totalPages: 0,
      intent: { modifiers: [], mappedCategory: null, expandedTerms: [] },
    });
    return;
  }

  /* ── 2. Pagination & filter params ─────────────────────────────────── */
  const rawPage  = parseInt(String(req.query.page  ?? "1"),  10);
  const rawLimit = parseInt(String(req.query.limit ?? "20"), 10);
  const page   = Number.isFinite(rawPage)  && rawPage  >= 1             ? rawPage  : 1;
  const limit  = Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 50 ? rawLimit : 20;
  const offset = (page - 1) * limit;

  const filterCategory  = req.query.category  ? String(req.query.category)  : null;
  const filterDiscount  = req.query.hasDiscount === "true";
  const filterPriceMin  = req.query.priceMin  ? parseFloat(String(req.query.priceMin))  : null;
  const filterPriceMax  = req.query.priceMax  ? parseFloat(String(req.query.priceMax))  : null;
  const sortBy          = String(req.query.sortBy ?? "relevance");

  const _rawMinRating   = req.query.minRating ? parseFloat(String(req.query.minRating)) : null;
  const filterMinRating = _rawMinRating !== null && !isNaN(_rawMinRating) && _rawMinRating >= 0 && _rawMinRating <= 5 ? _rawMinRating : null;
  const _rawStoreId     = req.query.storeId   ? parseInt(String(req.query.storeId), 10)  : null;
  const filterStoreId   = _rawStoreId !== null && !isNaN(_rawStoreId) && _rawStoreId > 0 ? _rawStoreId : null;
  // filterInStock: p.stock > 0 is always applied, but accept param for API completeness

  /* Debug ranking breakdown — admin-only when ?debug=ranking is present */
  const debugRanking = req.query.debug === "ranking" && (req as any).user?.role === "admin";
  /* include_out_of_stock — admin/seller only: stock_score=1.0 for all (no OOS penalty) */
  const includeOOS = req.query.include_out_of_stock === "true" &&
    ["admin", "seller"].includes((req as any).user?.role ?? "");

  /* ── 2.5. Cache check ──────────────────────────────────────────────────
   * Build cache key from all discriminating query params.  Debug=ranking
   * requests are never cached (they expose internal scoring details).
   * normalizeArabic is a cheap pure function — safe to call here.
   * ────────────────────────────────────────────────────────────────────── */
  const cacheKey = debugRanking ? null : buildCacheKey({
    normalizedQuery: normalizeArabic(raw),
    sortBy,
    category:    filterCategory,
    priceMin:    filterPriceMin,
    priceMax:    filterPriceMax,
    page,
    limit,
    inStock:     false,
    hasDiscount: filterDiscount,
    storeId:     filterStoreId,
    minRating:   filterMinRating,
  });
  if (cacheKey) {
    const cached = searchCache.get(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
  }

  /* ── 3. Dual NLP pipeline ───────────────────────────────────────────── */

  // 3a. Dialect dictionary — intent modifiers + dialect category + expanded keywords
  const intent = parseIntent(raw);

  // 3b. NLP pipeline — Arabic normalization, sticky tokens, cross-language bridge
  const nlp = processSearchQuery(raw);

  // 3c. Synonym expansion — in-memory cache (5 min TTL), max 10 total expanded terms
  const { expanded: synExpandedTokens, synonymExpanded } = await expandWithSynonyms(nlp.expandedTokens);

  /* ── 4. Merge all expansion sources ────────────────────────────────── */
  // Union of: NLP expanded tokens + synonym expansions + dialect keywords + raw normalized term
  const term = normalizeArabic(raw);   // kept for trigram scoring

  const allExpandedTokens: string[] = [
    ...synExpandedTokens,
    ...intent.expandedTerms.map(t => normalizeArabic(t)),
    term,
  ];

  // Build PostgreSQL tsquery strings
  const tsqExpanded = buildOrTsQuery(allExpandedTokens);   // broad OR match
  const tsqBase     = buildAndTsQuery(nlp.baseTokens);     // precision AND boost

  /* ── 5. Intent modifier overrides ──────────────────────────────────── */
  const effectiveSort =
    intent.modifiers.includes("cheap")   ? "price_asc" :
    intent.modifiers.includes("premium") ? "rating"    :
    intent.modifiers.includes("rating")  ? "rating"    :
    intent.modifiers.includes("newest")  ? "newest"    :
    sortBy;

  trackQuery(raw);

  /* ── 5.5. Start semantic search concurrently — runs in parallel with FTS ─
   * getQueryEmbedding has a hard 2-second timeout so it never delays FTS.
   * Promise resolves to [] immediately when embedding service / pgvector
   * are unavailable, making this branch zero-cost in FTS-only mode.
   * ────────────────────────────────────────────────────────────────────── */
  const semanticPromise: Promise<SemanticResult[]> =
    (_embeddingServiceAvailable && _pgvectorAvailable && raw.length >= 4)
      ? getQueryEmbedding(raw).then((emb) => emb ? semanticSearch(emb, limit * 3) : [])
      : Promise.resolve([]);

  /* Log to query_logs concurrently — race caps at 50 ms so it never delays search response */
  const langDetect = /[\u0600-\u06FF]/.test(raw) ? "ar" : "en";
  const logInsertPromise = logToQueryLogsGetId(raw, langDetect);
  const logTimeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 50));

  /* ── 6. Parameterised query builder ─────────────────────────────────── */
  const pb = makeParamBuilder();

  // tsquery params (nullable — triggers trigram-only fallback if null)
  const pTsqExpanded  = pb.add(tsqExpanded);    // used in FTS @@ and ts_rank_cd
  const pTsqBase      = pb.add(tsqBase);        // used in AND precision boost
  // Trigram params
  const pTerm         = pb.add(term);
  const pLike         = pb.add(`%${term}%`);
  // Dialect category param
  const pMappedCat    = pb.add(intent.mappedCategory?.toLowerCase() ?? null);
  // include_out_of_stock override: when true stock_score=1.0 for all (admin/seller audit mode)
  const pIncludeOOS   = pb.add(includeOOS);

  /* Optional extra WHERE filters */
  const extraWhere: string[] = [];

  if (intent.modifiers.includes("used")) {
    extraWhere.push(`(
      lower(COALESCE(p.search_tokens,'')) LIKE '%مستعمل%'
      OR lower(p.name) LIKE '%used%'
      OR lower(COALESCE(p.name_ar,'')) LIKE '%مستعمل%'
    )`);
  }
  // on_sale intent → auto-filter to discounted products (unless user already passed hasDiscount)
  if (intent.detectedOnSale && !filterDiscount) {
    extraWhere.push(`p.discount_percent IS NOT NULL AND p.discount_percent > 0`);
  }
  // category_browse intent → auto-apply category filter (unless user already filtered by category)
  if (intent.categoryBrowseSlug && !filterCategory) {
    extraWhere.push(`lower(p.category) = ${pb.add(intent.categoryBrowseSlug.toLowerCase())}`);
  }
  if (filterCategory) {
    extraWhere.push(`lower(p.category) = ${pb.add(filterCategory.toLowerCase())}`);
  }
  if (filterPriceMin !== null && !isNaN(filterPriceMin)) {
    extraWhere.push(`p.price::numeric >= ${pb.add(filterPriceMin)}`);
  }
  if (filterPriceMax !== null && !isNaN(filterPriceMax)) {
    extraWhere.push(`p.price::numeric <= ${pb.add(filterPriceMax)}`);
  }
  if (filterStoreId !== null) {
    extraWhere.push(`p.seller_id = ${pb.add(filterStoreId)}`);
  }
  if (filterDiscount) {
    extraWhere.push(`p.discount_percent IS NOT NULL AND p.discount_percent > 0`);
  }
  if (filterMinRating !== null && filterMinRating > 0) {
    // subquery per candidate — acceptable since candidate set is already narrow
    extraWhere.push(`COALESCE((SELECT AVG(rating)::numeric(3,1) FROM reviews WHERE product_id = p.id), 0) >= ${pb.add(filterMinRating)}`);
  }

  const extraWhereSQL = extraWhere.length > 0 ? `AND ${extraWhere.join(" AND ")}` : "";

  /* ── filterMeta parallel query (price range before extra filters) ──── */
  const metaPb = makeParamBuilder();
  const pMetaTsqExpanded = metaPb.add(tsqExpanded);
  const pMetaTerm        = metaPb.add(term);
  const pMetaLike        = metaPb.add(`%${term}%`);
  const pMetaMappedCat   = metaPb.add(intent.mappedCategory?.toLowerCase() ?? null);
  const filterMetaPromise = pool.query<{ price_min: string; price_max: string; total_unfiltered: string }>(
    `SELECT
       COALESCE(MIN(p.price::numeric), 0) AS price_min,
       COALESCE(MAX(p.price::numeric), 0) AS price_max,
       COUNT(*)::int AS total_unfiltered
     FROM products p
     CROSS JOIN (
       SELECT CASE WHEN ${pMetaTsqExpanded}::text IS NOT NULL
         THEN to_tsquery('simple', ${pMetaTsqExpanded}::text)
         ELSE NULL END AS expanded_q
     ) ts
     INNER JOIN users u  ON u.id = p.seller_id AND u.account_status = 'active'
     INNER JOIN seller_applications sa ON sa.user_id = p.seller_id AND sa.status = 'approved'
     WHERE p.stock > 0
       AND (
         (ts.expanded_q IS NOT NULL AND p.fts_vector IS NOT NULL AND p.fts_vector @@ ts.expanded_q)
         OR word_similarity(${pMetaTerm}, lower(p.name))                   > 0.14
         OR word_similarity(${pMetaTerm}, lower(COALESCE(p.name_ar, '')))  > 0.14
         OR lower(p.name)                    LIKE ${pMetaLike}
         OR lower(COALESCE(p.name_ar, ''))   LIKE ${pMetaLike}
         OR (${pMetaMappedCat}::text IS NOT NULL AND lower(p.category) = ${pMetaMappedCat}::text)
       )`,
    metaPb.values,
  );

  /* ── "Did you mean?" — cheap trigram query runs in parallel ──────────── */
  const dymPb = makeParamBuilder();
  const pDymTerm = dymPb.add(term);
  const pDymRaw  = dymPb.add(raw.toLowerCase());
  const didYouMeanPromise = pool.query<{ suggestion: string; sim: number }>(
    `SELECT suggestion, sim FROM (
       (SELECT query AS suggestion,
               word_similarity(${pDymTerm}, lower(query)) AS sim
        FROM search_queries
        WHERE word_similarity(${pDymTerm}, lower(query)) > 0.28
          AND lower(query) != ${pDymRaw}
        ORDER BY sim DESC LIMIT 1)
       UNION ALL
       (SELECT name AS suggestion,
               GREATEST(
                 word_similarity(${pDymTerm}, lower(name)),
                 word_similarity(${pDymTerm}, lower(COALESCE(name_ar, '')))
               ) AS sim
        FROM products
        WHERE GREATEST(
                word_similarity(${pDymTerm}, lower(name)),
                word_similarity(${pDymTerm}, lower(COALESCE(name_ar, '')))
              ) > 0.28
          AND lower(name) != ${pDymRaw}
        ORDER BY 2 DESC LIMIT 1)
     ) dym
     ORDER BY sim DESC LIMIT 1`,
    dymPb.values,
  );

  /* ORDER BY — aliases resolved through the CTE chain */
  const orderBySQL =
    effectiveSort === "price_asc"  ? "final_price ASC,  final_score DESC" :
    effectiveSort === "price_desc" ? "final_price DESC, final_score DESC" :
    effectiveSort === "newest"     ? "p_created_at DESC"                  :
    effectiveSort === "rating"     ? "avg_rating DESC, final_score DESC"  :
    /* relevance */                  "final_score DESC, p_featured DESC";

  const pLimit  = pb.add(limit);
  const pOffset = pb.add(offset);

  /* ── 7. Core SQL — multi-signal ranking (parallel with filterMeta + DYM)
   *
   * ════════════════════════════════════════════════════════════════════════
   * RANKING FORMULA — weighted multi-signal score
   * ────────────────────────────────────────────────────────────────────────
   * Signal          Weight  DB columns
   * ─────────────── ──────  ──────────────────────────────────────────────
   * Text Relevance    40%   fts_vector, name, name_ar (FTS+trigram)
   * Quality           25%   reviews.avg_rating, reviews.count
   * Popularity        20%   products.sales_count, products.view_count
   * Freshness         10%   products.created_at
   * Availability       5%   products.stock  (as multiplier, not additive)
   * ─────────────── ──────
   * Featured Boost  +0.15  products.featured  (additive, capped at 1.0)
   * New Arrival     +0.10  created_at ≤7 days + 0 sales + 0 reviews (add.)
   *
   * base_score = 0.40·text + 0.25·quality + 0.20·popularity + 0.10·freshness
   * final_score = LEAST(1.0, base_score × availability_mult
   *                          + featured_boost + new_arrival_boost)
   *
   * All signals normalized to [0,1]. Log-normalization prevents one product
   * with huge sales/reviews from dominating. Global max values computed once
   * in global_stats CTE — no N+1 queries.
   * Seller trust boost skipped: verification column absent from schema.
   * ════════════════════════════════════════════════════════════════════════ */
  const [{ rows }, metaResult, dymResult] = await Promise.all([pool.query(
    `
    /* ── Pre-compute tsquery objects exactly once ─────────────────────────── */
    WITH ts_params AS (
      SELECT
        CASE WHEN ${pTsqExpanded}::text IS NOT NULL
          THEN to_tsquery('simple', ${pTsqExpanded}::text)
          ELSE NULL
        END AS expanded_q,
        CASE WHEN ${pTsqBase}::text IS NOT NULL
          THEN to_tsquery('simple', ${pTsqBase}::text)
          ELSE NULL
        END AS base_q
    ),

    /* ── Aggregate reviews once — single pass, no per-row subquery ────────── */
    rev_agg AS (
      SELECT
        product_id,
        AVG(rating)::float   AS avg_rating,
        COUNT(*)::integer     AS review_count
      FROM reviews
      GROUP BY product_id
    ),

    /* ── Candidate scan + text scoring ────────────────────────────────────── */
    candidate AS (
      SELECT
        p.id,
        p.seller_id,
        p.name,
        p.name_ar,
        p.description,
        p.price::numeric                                                   AS raw_price,
        p.discount_percent::numeric                                        AS raw_discount,
        p.price::numeric * (1.0 - COALESCE(p.discount_percent::numeric, 0) / 100.0)
                                                                           AS final_price,
        p.category,
        p.subcategory,
        p.stock,
        p.image_url,
        p.image_urls,
        p.featured                                                         AS p_featured,
        p.created_at                                                       AS p_created_at,
        sa.store_name,
        sa.store_slug,
        sa.store_logo,
        u.name                                                             AS seller_name,
        /* Review signals — pre-aggregated, no N+1 */
        COALESCE(ra.avg_rating,   0.0)::float AS avg_rating,
        COALESCE(ra.review_count, 0)::integer  AS review_count,

        /* ── Layer 1: Full-text search ──────────────────────────────────── */
        CASE
          WHEN tsp.expanded_q IS NOT NULL
            AND p.fts_vector IS NOT NULL
            AND p.fts_vector @@ tsp.expanded_q
          THEN ts_rank_cd(p.fts_vector, tsp.expanded_q, 32)
          ELSE 0.0
        END                                                                AS fts_score,

        /* ── Layer 2: AND precision boost ───────────────────────────────── */
        CASE
          WHEN tsp.base_q IS NOT NULL
            AND p.fts_vector IS NOT NULL
            AND p.fts_vector @@ tsp.base_q
          THEN 0.20
          ELSE 0.0
        END                                                                AS and_boost,

        /* ── Layer 3: Trigram similarity ────────────────────────────────── */
        GREATEST(
          word_similarity(${pTerm}, lower(p.name)),
          word_similarity(${pTerm}, lower(COALESCE(p.name_ar, ''))),
          similarity(${pTerm},      lower(p.name))               * 0.85,
          similarity(${pTerm},      lower(COALESCE(p.name_ar,''))) * 0.85
        )                                                                  AS trgm_score,

        /* ── Category intent ────────────────────────────────────────────── */
        CASE
          WHEN ${pMappedCat}::text IS NOT NULL
            AND lower(p.category) = ${pMappedCat}::text
          THEN 0.80
          ELSE 0.0
        END                                                                AS cat_score

      FROM products p
      CROSS JOIN ts_params tsp
      INNER JOIN users u
        ON  u.id = p.seller_id
        AND u.account_status = 'active'
      INNER JOIN seller_applications sa
        ON  sa.user_id = p.seller_id
        AND sa.status  = 'approved'
      LEFT JOIN rev_agg ra ON ra.product_id = p.id
      WHERE (
          (tsp.expanded_q IS NOT NULL AND p.fts_vector IS NOT NULL
            AND p.fts_vector @@ tsp.expanded_q)
          OR word_similarity(${pTerm}, lower(p.name))                  > 0.14
          OR word_similarity(${pTerm}, lower(COALESCE(p.name_ar, ''))) > 0.14
          OR lower(p.name)                     LIKE ${pLike}
          OR lower(COALESCE(p.name_ar, ''))    LIKE ${pLike}
          OR (${pMappedCat}::text IS NOT NULL
              AND lower(p.category) = ${pMappedCat}::text)
        )
        ${extraWhereSQL}
    ),

    /* ── Per-signal score computation ────────────────────────────────────── */
    scored AS (
      SELECT *,

        /* Text relevance (55%) — three-layer: FTS + AND precision boost + trigram */
        GREATEST(
          fts_score * 0.65 + and_boost + trgm_score * 0.25 + cat_score * 0.10,
          trgm_score * 0.45,
          cat_score
        ) AS text_score,

        /* Quality (20%) — rating×0.6 + volume×0.4, capped at 50 reviews to
           prevent high-review sellers monopolising results */
        (
          COALESCE(avg_rating, 0.0) / 5.0 * 0.6
          + LEAST(COALESCE(review_count::float, 0.0), 50.0) / 50.0 * 0.4
        ) AS quality_score,

        /* Freshness (10%) — linear decay to 0 over 90 days */
        GREATEST(0.0,
          1.0 - EXTRACT(EPOCH FROM (NOW() - p_created_at)) / (86400.0 * 90.0)
        ) AS freshness_score,

        /* Seller score (8%) — TODO: no trust_level column yet; constant 0.5
           Replace with CASE sa.trust_level WHEN 'gold' THEN 1.0 ... when added */
        0.5::float AS seller_score,

        /* Stock score (7%) — OOS products now appear in results but rank lower;
           admin/seller include_out_of_stock override sets all to 1.0 (audit mode) */
        CASE
          WHEN ${pIncludeOOS}::boolean THEN 1.0
          WHEN stock > 10 THEN 1.0
          WHEN stock > 0  THEN 0.6
          ELSE 0.0
        END AS stock_score,

        /* Featured boost — additive +0.15 */
        CASE WHEN p_featured THEN 0.15 ELSE 0.0 END AS featured_boost,

        /* New arrival boost — additive +0.10 for brand-new unreviewed listings */
        CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 86400.0 <= 7
           AND review_count = 0
          THEN 0.10
          ELSE 0.0
        END AS new_arrival_boost

      FROM candidate
    ),

    /* ── Combine all signals into final_score ────────────────────────────── */
    scored_final AS (
      SELECT *,
        LEAST(1.0,
          text_score      * 0.55
          + quality_score * 0.20
          + freshness_score * 0.10
          + seller_score  * 0.08
          + stock_score   * 0.07
          + featured_boost
          + new_arrival_boost
        ) AS final_score
      FROM scored
    ),

    /* ── Score gate + window-count for pagination ────────────────────────── */
    paged AS (
      SELECT *, COUNT(*) OVER() AS total_count
      FROM scored_final
      WHERE final_score > 0.02
    )

    SELECT
      pg.*,
      EXISTS(
        SELECT 1 FROM product_variants pv WHERE pv.product_id = pg.id LIMIT 1
      ) AS has_variants
    FROM paged pg
    ORDER BY ${orderBySQL}
    LIMIT ${pLimit} OFFSET ${pOffset}
    `,
    pb.values,
  ), filterMetaPromise, didYouMeanPromise]);

  /* ── 8. Pagination metadata ─────────────────────────────────────────── */
  const total = rows.length > 0 ? parseInt(String(rows[0].total_count), 10) : 0;

  /* ── 9. Response mapper ─────────────────────────────────────────────── */
  interface MappedProduct {
    id: number; name: string; nameAr: string | null;
    price: number; discountPercent: number | null; finalPrice: number;
    category: string; subcategory: string | null;
    stock: number; imageUrl: string | null; imageUrls: string[];
    featured: boolean; isBestDeal: boolean; hasVariants: boolean;
    averageRating: number; reviewCount: number;
    seller: { id: number; name: string; storeName: string | null; storeSlug: string | null; storeLogo: string | null };
    createdAt: string; score: number;
    rankingBreakdown?: {
      textScore: number; qualityScore: number;
      freshnessScore: number; sellerScore: number; stockScore: number;
      featuredBoost: number; newArrivalBoost: number; finalScore: number;
    };
  }

  const mapped: MappedProduct[] = rows.map((r: any) => {
    const base: MappedProduct = {
      id:              r.id,
      name:            r.name,
      nameAr:          r.name_ar      ?? null,
      price:           parseFloat(r.raw_price),
      discountPercent: r.raw_discount  ? parseFloat(r.raw_discount) : null,
      finalPrice:      parseFloat(r.final_price),
      category:        r.category,
      subcategory:     r.subcategory  ?? null,
      stock:           r.stock,
      imageUrl:        r.image_url    ?? null,
      imageUrls:       (r.image_urls  ?? []) as string[],
      featured:        r.p_featured,
      isBestDeal:      r.raw_discount ? parseFloat(r.raw_discount) >= 20 : false,
      hasVariants:     !!r.has_variants,
      averageRating:   parseFloat(r.avg_rating),
      reviewCount:     parseInt(String(r.review_count), 10),
      seller: {
        id:        r.seller_id,
        name:      r.seller_name  ?? "Unknown",
        storeName: r.store_name   ?? null,
        storeSlug: r.store_slug   ?? null,
        storeLogo: r.store_logo   ?? null,
      },
      createdAt: r.p_created_at instanceof Date
        ? r.p_created_at.toISOString()
        : String(r.p_created_at),
      score: Math.round(parseFloat(r.final_score) * 1000) / 1000,
    };
    /* Debug breakdown — only exposed to admins via ?debug=ranking */
    if (debugRanking) {
      base.rankingBreakdown = {
        textScore:      Math.round(parseFloat(r.text_score)       * 1000) / 1000,
        qualityScore:   Math.round(parseFloat(r.quality_score)    * 1000) / 1000,
        freshnessScore: Math.round(parseFloat(r.freshness_score)  * 1000) / 1000,
        sellerScore:    Math.round(parseFloat(r.seller_score)     * 1000) / 1000,
        stockScore:     Math.round(parseFloat(r.stock_score)      * 1000) / 1000,
        featuredBoost:  parseFloat(r.featured_boost),
        newArrivalBoost: parseFloat(r.new_arrival_boost),
        finalScore:     Math.round(parseFloat(r.final_score)      * 1000) / 1000,
      };
    }
    return base;
  });

  /* ── 10. Seller diversity — max 3 results per seller in first 20 ─────── */
  function applySellerDiversity(list: MappedProduct[]): MappedProduct[] {
    const counts = new Map<number, number>();
    const top: MappedProduct[]      = [];
    const overflow: MappedProduct[] = [];
    for (const p of list.slice(0, 20)) {
      const c = counts.get(p.seller.id) ?? 0;
      if (c < 3) { top.push(p); counts.set(p.seller.id, c + 1); }
      else overflow.push(p);
    }
    /* Fill empty top-20 slots with the next best products from other sellers */
    const topIds = new Set(top.map(p => p.id));
    for (const p of list.slice(20)) {
      if (top.length >= 20) break;
      const c = counts.get(p.seller.id) ?? 0;
      if (c < 3 && !topIds.has(p.id)) {
        top.push(p); counts.set(p.seller.id, c + 1); topIds.add(p.id);
      }
    }
    const usedIds = new Set(top.map(p => p.id));
    const tail = [...overflow, ...list.slice(20)].filter(p => !usedIds.has(p.id));
    return [...top, ...tail];
  }

  /* ── 10.3. Semantic RRF — await the concurrent semantic promise and merge ─
   * semanticPromise was started before the FTS query so it runs in parallel.
   * When semantic search is unavailable it resolves to [] at zero cost.
   * RRF reorders the existing FTS results; products that appear in both
   * pipelines are promoted; purely-FTS results retain relative FTS order.
   * ─────────────────────────────────────────────────────────────────────── */
  const semanticResults: SemanticResult[] = await semanticPromise;
  let searchMode: "hybrid" | "fts_only" = "fts_only";
  let semanticResultCount = 0;
  let rrfMapped = mapped;

  if (semanticResults.length > 0 && mapped.length > 0) {
    const rrfOrdered = reciprocalRankFusion(mapped, semanticResults);
    const rrfIdxMap  = new Map(rrfOrdered.map((r, i) => [r.id, i]));
    rrfMapped = [...mapped].sort(
      (a, b) => (rrfIdxMap.get(a.id) ?? 9999) - (rrfIdxMap.get(b.id) ?? 9999),
    );
    searchMode         = "hybrid";
    semanticResultCount = semanticResults.filter((r) => rrfIdxMap.has(r.id)).length;
  } else if (semanticResults.length > 0 && mapped.length === 0) {
    // FTS returned nothing — use pure semantic results so queries like
    // "laptop gaming" that don't match keywords still get relevant products.
    const semIds = semanticResults.slice(0, limit * 2).map((r) => r.id);
    if (semIds.length > 0) {
      try {
        const { rows: semRows } = await pool.query<any>(
          `SELECT
             p.id, p.seller_id, p.name, p.name_ar,
             p.price::numeric AS raw_price,
             p.discount_percent::numeric AS raw_discount,
             p.price::numeric * (1.0 - COALESCE(p.discount_percent::numeric, 0) / 100.0) AS final_price,
             p.category, p.subcategory, p.stock, p.image_url, p.image_urls, p.featured, p.created_at,
             sa.store_name, sa.store_slug, sa.store_logo, u.name AS seller_name,
             COALESCE(ra2.avg_rating, 0.0)::float AS avg_rating,
             COALESCE(ra2.review_count, 0)::int   AS review_count,
             EXISTS(SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id LIMIT 1) AS has_variants
           FROM products p
           INNER JOIN users u ON u.id = p.seller_id AND u.account_status = 'active'
           INNER JOIN seller_applications sa ON sa.user_id = p.seller_id AND sa.status = 'approved'
           LEFT JOIN (SELECT product_id, AVG(rating)::float AS avg_rating, COUNT(*)::int AS review_count
                      FROM reviews GROUP BY product_id) ra2 ON ra2.product_id = p.id
           WHERE p.id = ANY($1) AND p.stock > 0`,
          [semIds],
        );
        if (semRows.length > 0) {
          const idxMap = new Map(semIds.map((id, i) => [id, i]));
          rrfMapped = semRows
            .map((r: any) => ({
              id:              r.id,
              name:            r.name,
              nameAr:          r.name_ar    ?? null,
              price:           parseFloat(r.raw_price),
              discountPercent: r.raw_discount ? parseFloat(r.raw_discount) : null,
              finalPrice:      parseFloat(r.final_price),
              category:        r.category,
              subcategory:     r.subcategory ?? null,
              stock:           r.stock,
              imageUrl:        r.image_url   ?? null,
              imageUrls:       (r.image_urls ?? []) as string[],
              featured:        !!r.featured,
              isBestDeal:      r.raw_discount ? parseFloat(r.raw_discount) >= 20 : false,
              hasVariants:     !!r.has_variants,
              averageRating:   parseFloat(r.avg_rating   ?? "0"),
              reviewCount:     parseInt(String(r.review_count ?? "0"), 10),
              seller: {
                id:        r.seller_id,
                name:      r.seller_name  ?? "Unknown",
                storeName: r.store_name   ?? null,
                storeSlug: r.store_slug   ?? null,
                storeLogo: r.store_logo   ?? null,
              },
              createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
              score: semanticResults.find((s) => s.id === r.id)?.score ?? 0,
            } as MappedProduct))
            .sort((a, b) => (idxMap.get(a.id) ?? 9999) - (idxMap.get(b.id) ?? 9999));
          searchMode          = "hybrid";
          semanticResultCount = rrfMapped.length;
        }
      } catch { /* semantic fallback failed — leave rrfMapped empty */ }
    }
  }

  const results = total > 20 ? applySellerDiversity(rrfMapped) : rrfMapped;

  /* ── 10.5. Smart fallback chain — 4 levels when main query returns 0 ── */
  type FallbackMeta = {
    level: number;
    originalQuery?: string;
    relaxedQuery?: string;
    matchType?: string;
    inferredCategory?: string;
    reason?: string;
  };

  let fallbackResults: MappedProduct[] = [];
  let fallbackMeta: FallbackMeta | null = null;

  if (total === 0 && raw.length >= 2) {
    /* Shared SELECT/FROM fragments for all fallback queries */
    const FB_SEL = `
      p.id, p.seller_id, p.name, p.name_ar,
      p.price::numeric AS raw_price,
      p.discount_percent::numeric AS raw_discount,
      p.price::numeric * (1.0 - COALESCE(p.discount_percent::numeric, 0) / 100.0) AS final_price,
      p.category, p.subcategory, p.stock, p.image_url, p.image_urls, p.featured, p.created_at,
      sa.store_name, sa.store_slug, sa.store_logo, u.name AS seller_name,
      COALESCE(ra2.avg_rating, 0.0)::float AS avg_rating,
      COALESCE(ra2.review_count, 0)::int   AS review_count,
      EXISTS(SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id LIMIT 1) AS has_variants
    `;
    const FB_FROM = `
      FROM products p
      INNER JOIN users u ON u.id = p.seller_id AND u.account_status = 'active'
      INNER JOIN seller_applications sa ON sa.user_id = p.seller_id AND sa.status = 'approved'
      LEFT JOIN (SELECT product_id, AVG(rating)::float AS avg_rating, COUNT(*)::int AS review_count
                 FROM reviews GROUP BY product_id) ra2 ON ra2.product_id = p.id
    `;
    const mapFbRow = (r: any): MappedProduct => ({
      id:              r.id,
      name:            r.name,
      nameAr:          r.name_ar    ?? null,
      price:           parseFloat(r.raw_price),
      discountPercent: r.raw_discount ? parseFloat(r.raw_discount) : null,
      finalPrice:      parseFloat(r.final_price),
      category:        r.category,
      subcategory:     r.subcategory ?? null,
      stock:           r.stock,
      imageUrl:        r.image_url   ?? null,
      imageUrls:       (r.image_urls ?? []) as string[],
      featured:        !!r.featured,
      isBestDeal:      r.raw_discount ? parseFloat(r.raw_discount) >= 20 : false,
      hasVariants:     !!r.has_variants,
      averageRating:   parseFloat(r.avg_rating   ?? "0"),
      reviewCount:     parseInt(String(r.review_count ?? "0"), 10),
      seller: {
        id:        r.seller_id,
        name:      r.seller_name  ?? "Unknown",
        storeName: r.store_name   ?? null,
        storeSlug: r.store_slug   ?? null,
        storeLogo: r.store_logo   ?? null,
      },
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
      score: 0,
    });

    /* Level 1 — Relaxed FTS: remove shortest token, re-run */
    if (!fallbackMeta && nlp.baseTokens.length >= 2) {
      const sorted = [...nlp.baseTokens].sort((a, b) => a.length - b.length);
      const relaxedTokens = nlp.baseTokens.filter(t => t !== sorted[0]);
      const relaxedTsq = buildOrTsQuery([...relaxedTokens, normalizeArabic(relaxedTokens.join(" "))]);
      if (relaxedTsq) {
        const rb1 = makeParamBuilder();
        const pR1 = rb1.add(relaxedTsq);
        try {
          const { rows: fb1 } = await pool.query<any>(
            `SELECT ${FB_SEL} ${FB_FROM}
             WHERE p.stock > 0
               AND p.fts_vector IS NOT NULL
               AND p.fts_vector @@ to_tsquery('simple', ${pR1})
             ORDER BY ts_rank_cd(p.fts_vector, to_tsquery('simple', ${pR1})) DESC
             LIMIT 12`,
            rb1.values,
          );
          if (fb1.length > 0) {
            fallbackResults = fb1.map(mapFbRow);
            fallbackMeta = { level: 1, originalQuery: raw, relaxedQuery: relaxedTokens.join(" ") };
          }
        } catch { /* try next level */ }
      }
    }

    /* Level 2 — Trigram fuzzy (similarity > 0.25 on product titles) */
    if (!fallbackMeta) {
      const rb2 = makeParamBuilder();
      const pF2 = rb2.add(term);
      try {
        const { rows: fb2 } = await pool.query<any>(
          `SELECT ${FB_SEL} ${FB_FROM}
           WHERE p.stock > 0
             AND (
               similarity(${pF2}, lower(p.name)) > 0.25
               OR similarity(${pF2}, lower(COALESCE(p.name_ar, ''))) > 0.25
             )
           ORDER BY GREATEST(
             similarity(${pF2}, lower(p.name)),
             similarity(${pF2}, lower(COALESCE(p.name_ar, '')))
           ) DESC
           LIMIT 12`,
          rb2.values,
        );
        if (fb2.length > 0) {
          fallbackResults = fb2.map(mapFbRow);
          fallbackMeta = { level: 2, matchType: "fuzzy_trigram" };
        }
      } catch { /* try next level */ }
    }

    /* Level 3 — Category inference: route to inferred category top products */
    if (!fallbackMeta && intent.mappedCategory) {
      const rb3 = makeParamBuilder();
      const pCat3 = rb3.add(intent.mappedCategory.toLowerCase());
      try {
        const { rows: fb3 } = await pool.query<any>(
          `SELECT ${FB_SEL} ${FB_FROM}
           WHERE p.stock > 0
             AND lower(p.category) = ${pCat3}
           ORDER BY (
             COALESCE(ra2.avg_rating, 0.0) / 5.0 * 0.6
             + GREATEST(0.0, 1.0 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (86400.0 * 90.0)) * 0.4
           ) DESC
           LIMIT 12`,
          rb3.values,
        );
        if (fb3.length > 0) {
          fallbackResults = fb3.map(mapFbRow);
          fallbackMeta = { level: 3, inferredCategory: intent.mappedCategory };
        }
      } catch { /* try next level */ }
    }

    /* Level 4 — Trending: featured or well-rated recent products globally */
    if (!fallbackMeta) {
      try {
        const { rows: fb4 } = await pool.query<any>(
          `SELECT ${FB_SEL} ${FB_FROM}
           WHERE p.stock > 0
             AND (p.featured = true OR ra2.review_count >= 3)
           ORDER BY (
             COALESCE(ra2.avg_rating, 0.0) / 5.0 * 0.6
             + GREATEST(0.0, 1.0 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / (86400.0 * 90.0)) * 0.4
           ) DESC
           LIMIT 12`,
          [],
        );
        fallbackResults = fb4.map(mapFbRow);
        fallbackMeta = { level: 4, reason: "no_match_found" };
      } catch { /* fallback gracefully to empty */ }
    }
  }

  /* ── 11. "Did you mean?" — surface only when 0 main results ─────────── */
  const didYouMean: string | null =
    total === 0 && dymResult.rows.length > 0
      ? dymResult.rows[0].suggestion
      : null;

  /* Capture the query_logs id if insert finished within the 50 ms window */
  const searchLogId: number | null = await Promise.race([logInsertPromise, logTimeoutPromise]);

  const finalResults = total > 0 ? results : fallbackResults;
  const finalTotal   = total > 0 ? total   : fallbackResults.length;

  /* Update query_logs with result_count + fallback_level (fire-and-forget) */
  if (searchLogId !== null) {
    updateQueryLog(searchLogId, finalTotal, fallbackMeta?.level ?? null);
  }

  const metaRow = metaResult.rows[0];

  // Compute primary detected intent for the frontend intent pill
  const detectedIntent: string | null =
    intent.categoryBrowseSlug          ? "category_browse" :
    intent.detectedOnSale              ? "on_sale"         :
    intent.detectedGift                ? "gift"            :
    intent.modifiers.includes("cheap")   ? "price_low"    :
    intent.modifiers.includes("premium") ? "price_high"   :
    intent.modifiers.includes("newest")  ? "new_arrivals" :
    null;

  const responsePayload = {
    results:    finalResults,
    total:      finalTotal,
    page,
    limit,
    totalPages: Math.ceil((total > 0 ? total : finalResults.length) / limit),
    searchLogId: searchLogId ?? null,
    didYouMean,
    detectedIntent,
    synonymExpanded,
    fallback: fallbackMeta,
    searchMode,
    semanticResultCount,
    filterMeta: {
      priceRange: {
        min: parseFloat(metaRow?.price_min ?? "0"),
        max: parseFloat(metaRow?.price_max ?? "0"),
      },
      totalUnfiltered: parseInt(String(metaRow?.total_unfiltered ?? "0"), 10),
      appliedFilters: {
        minPrice:   filterPriceMin,
        maxPrice:   filterPriceMax,
        minRating:  filterMinRating,
        category:   filterCategory,
        storeId:    filterStoreId,
        inStock:    req.query.inStock === "true",
        onSale:     filterDiscount,
      },
    },
    intent: {
      modifiers:        intent.modifiers,
      mappedCategory:   intent.mappedCategory,
      expandedTerms:    intent.expandedTerms,
      nlpBaseTokens:    nlp.baseTokens,
      nlpExpandedCount: nlp.expandedTokens.length,
      primaryLanguage:  nlp.primaryLanguage,
      categoryBrowseSlug: intent.categoryBrowseSlug,
    },
  };

  /* Write to in-memory LRU cache before responding.
   * TTL varies: sale/new-arrival queries get 1 min, L4 fallbacks 10 min,
   * everything else 5 min.  Debug=ranking results are never cached. */
  if (cacheKey) {
    const ttl = getTTL(detectedIntent, fallbackMeta?.level ?? null);
    searchCache.set(cacheKey, responsePayload, ttl, raw);
  }

  res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
  res.setHeader("X-Cache", "MISS");
  res.json(responsePayload);
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 4 — GET /api/search/trending
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/search/trending", async (_req, res): Promise<void> => {
  const { rows } = await pool.query<{ query: string; count: number }>(
    `SELECT query, count FROM search_queries ORDER BY count DESC LIMIT 12`,
  );
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  res.json(rows.map(r => ({ query: r.query, count: r.count })));
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 5 — POST /api/search/click  (CTR logging — marks query_logs row as clicked)
   ═══════════════════════════════════════════════════════════════════════════ */
router.post("/search/click", async (req, res): Promise<void> => {
  const body = req.body as { searchLogId?: unknown };
  const rawId = body.searchLogId;
  if (typeof rawId !== "number" || !Number.isInteger(rawId) || rawId <= 0) {
    res.status(400).json({ error: "searchLogId must be a positive integer" });
    return;
  }
  try {
    const result = await pool.query(
      `UPDATE query_logs SET clicked = true WHERE id = $1 AND clicked = false`,
      [rawId],
    );
    res.json({ success: (result.rowCount ?? 0) > 0 });
  } catch (error) {
    console.error("[search-click]", error);
    res.status(500).json({ success: false });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 6 — POST /api/search/track-click
   ═══════════════════════════════════════════════════════════════════════════ */
router.post("/search/track-click", async (req, res): Promise<void> => {
  const { term } = req.body as { term?: string };
  if (term && typeof term === "string" && term.trim().length >= 2) trackQuery(term.trim());
  res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 7 — GET /api/search/filter-options
   Returns categories + stores with productCounts for the filter sidebar.
   Scoped to products matching query `q` if provided.
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/search/filter-options", async (req, res): Promise<void> => {
  const t0 = Date.now();
  const raw = req.query.q ? String(req.query.q).trim() : null;
  const hasQ = raw !== null && raw.length >= 2;
  const likeParam = hasQ ? `%${normalizeArabic(raw!)}%` : null;

  const [catResult, storeResult, priceResult] = await Promise.all([
    // Categories with product count
    pool.query<{ category: string; product_count: string }>(
      `SELECT p.category, COUNT(DISTINCT p.id)::int AS product_count
       FROM products p
       INNER JOIN users u  ON u.id = p.seller_id AND u.account_status = 'active'
       INNER JOIN seller_applications sa ON sa.user_id = p.seller_id AND sa.status = 'approved'
       WHERE p.stock > 0
         AND ($1::text IS NULL
              OR lower(p.name)                   LIKE $1
              OR lower(COALESCE(p.name_ar, ''))  LIKE $1
              OR lower(p.category)               LIKE $1)
       GROUP BY p.category
       HAVING COUNT(DISTINCT p.id) > 0
       ORDER BY product_count DESC`,
      [likeParam],
    ),
    // Stores with product count
    pool.query<{ store_id: string; store_name: string | null; store_name_ar: string | null; store_slug: string | null; product_count: string }>(
      `SELECT sa.user_id::text AS store_id,
              sa.store_name, sa.store_name_ar, sa.store_slug,
              COUNT(DISTINCT p.id)::int AS product_count
       FROM seller_applications sa
       INNER JOIN products p ON p.seller_id = sa.user_id
       INNER JOIN users u    ON u.id = sa.user_id AND u.account_status = 'active'
       WHERE sa.status = 'approved' AND p.stock > 0
         AND ($1::text IS NULL
              OR lower(p.name)                  LIKE $1
              OR lower(COALESCE(p.name_ar,''))  LIKE $1)
       GROUP BY sa.user_id, sa.store_name, sa.store_name_ar, sa.store_slug
       HAVING COUNT(DISTINCT p.id) > 0
       ORDER BY product_count DESC
       LIMIT 30`,
      [likeParam],
    ),
    // Price range across matching products
    pool.query<{ price_min: string; price_max: string }>(
      `SELECT COALESCE(MIN(p.price::numeric), 0) AS price_min,
              COALESCE(MAX(p.price::numeric), 0) AS price_max
       FROM products p
       INNER JOIN users u  ON u.id = p.seller_id AND u.account_status = 'active'
       INNER JOIN seller_applications sa ON sa.user_id = p.seller_id AND sa.status = 'approved'
       WHERE p.stock > 0
         AND ($1::text IS NULL
              OR lower(p.name)                  LIKE $1
              OR lower(COALESCE(p.name_ar,''))  LIKE $1)`,
      [likeParam],
    ),
  ]);

  const categories = catResult.rows.map((r) => {
    const slug = r.category;
    const labels = CATEGORY_LABELS[slug] ?? { en: slug, ar: slug };
    return {
      slug,
      nameEn: labels.en,
      nameAr: labels.ar,
      productCount: parseInt(String(r.product_count), 10),
    };
  });

  const stores = storeResult.rows.map((r) => ({
    id: parseInt(String(r.store_id), 10),
    nameEn: r.store_name   ?? "",
    nameAr: r.store_name_ar ?? r.store_name ?? "",
    slug:   r.store_slug   ?? "",
    productCount: parseInt(String(r.product_count), 10),
  }));

  const priceRow = priceResult.rows[0];

  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.json({
    categories,
    stores,
    priceRange: {
      min: parseFloat(priceRow?.price_min ?? "0"),
      max: parseFloat(priceRow?.price_max ?? "0"),
    },
    processingTimeMs: Date.now() - t0,
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 8 — GET /api/search/related
   Returns queries from query_logs that share words with `q`.
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/search/related", async (req, res): Promise<void> => {
  const t0 = Date.now();
  const raw = String(req.query.q ?? "").trim();
  const limit = Math.min(parseInt(String(req.query.limit ?? "6"), 10) || 6, 10);

  if (raw.length < 2) {
    res.json({ related: [], processingTimeMs: 0 });
    return;
  }

  const norm = normalizeArabic(raw.toLowerCase());
  // Split into individual words for overlap matching
  const words = norm.split(/\s+/).filter((w) => w.length >= 2);

  // Build a LIKE condition for each word
  let rows: { query: string; count: number }[] = [];
  if (words.length > 0) {
    const wordConditions = words.map((w) => `lower(query) LIKE '%${w.replace(/'/g, "''")}%'`).join(" OR ");
    const { rows: related } = await pool.query<{ query: string; count: number }>(
      `SELECT query, SUM(count)::int AS count
       FROM search_queries
       WHERE (${wordConditions})
         AND lower(query) != lower($1)
       GROUP BY query
       ORDER BY count DESC
       LIMIT $2`,
      [raw, limit],
    );
    rows = related;
  }

  // Fallback: if < 3 results, supplement with top trending (excluding q)
  if (rows.length < 3) {
    const { rows: trending } = await pool.query<{ query: string; count: number }>(
      `SELECT query, count
       FROM search_queries
       WHERE lower(query) != lower($1)
       ORDER BY count DESC
       LIMIT $2`,
      [raw, limit - rows.length],
    );
    const existingQueries = new Set(rows.map((r) => r.query));
    for (const tr of trending) {
      if (!existingQueries.has(tr.query)) rows.push(tr);
      if (rows.length >= limit) break;
    }
  }

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  res.json({ related: rows, processingTimeMs: Date.now() - t0 });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 9 — GET /api/search/suggestions/popular
   Returns top popular queries for empty-state recovery UI.
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/search/suggestions/popular", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "6"), 10) || 6, 20);
  const { rows } = await pool.query<{ query: string; count: number }>(
    `SELECT query, count FROM search_queries ORDER BY count DESC LIMIT $1`,
    [limit],
  );
  res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
  res.json(rows.map(r => ({ query: r.query, count: Number(r.count) })));
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 10 — POST /api/admin/search/reindex
   Admin: triggers full fts_vector backfill for all products.
   ═══════════════════════════════════════════════════════════════════════════ */
router.post("/admin/search/reindex", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  if ((req as any).user?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  try {
    const result = await pool.query(`
      UPDATE products
      SET fts_vector =
        setweight(to_tsvector('simple', coalesce(name, '')),          'A') ||
        setweight(to_tsvector('simple', coalesce(name_ar, '')),       'A') ||
        setweight(to_tsvector('simple', coalesce(category, '')),      'B') ||
        setweight(to_tsvector('simple', coalesce(subcategory, '')),   'B') ||
        setweight(to_tsvector('simple', coalesce(search_tokens, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(description, '')),   'C')
    `);
    searchCache.invalidate();
    res.json({ ok: true, updatedCount: result.rowCount ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Reindex failed", detail: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 11.5 — GET /api/admin/search/cache
   Admin: returns in-memory LRU search cache statistics.
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/admin/search/cache", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  if ((req as any).user?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const stats = searchCache.getStats();
  const topQueries = searchCache.getTopQueries(10);
  res.json({
    cache: {
      ...stats,
      embeddingServiceAvailable: _embeddingServiceAvailable,
      pgvectorAvailable:         _pgvectorAvailable,
    },
    topCachedQueries: topQueries,
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 11.6 — DELETE /api/admin/search/cache
   Admin: flush the entire in-memory search cache.
   ═══════════════════════════════════════════════════════════════════════════ */
router.delete("/admin/search/cache", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  if ((req as any).user?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  searchCache.invalidate();
  res.json({ ok: true, message: "Search cache flushed" });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 12 — GET /api/admin/search/health
   Admin: returns search index health stats.
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/admin/search/health", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  if ((req as any).user?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const [indexStats, queryStats, zeroResultStats] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int           AS total_products,
        COUNT(fts_vector)::int  AS indexed_products,
        COUNT(*) FILTER (WHERE fts_vector IS NULL)::int AS null_fts,
        COUNT(*) FILTER (WHERE stock > 0)::int          AS in_stock_count,
        COUNT(*) FILTER (WHERE stock = 0)::int          AS out_of_stock_count
      FROM products p
      INNER JOIN users u ON u.id = p.seller_id AND u.account_status = 'active'
      INNER JOIN seller_applications sa ON sa.user_id = p.seller_id AND sa.status = 'approved'
    `),
    pool.query(`
      SELECT
        COUNT(*)::int                                           AS total_queries,
        COUNT(*) FILTER (WHERE result_count = 0)::int          AS zero_result_queries,
        COUNT(*) FILTER (WHERE fallback_level IS NOT NULL)::int AS fallback_queries,
        COUNT(*) FILTER (WHERE fallback_level = 1)::int         AS fallback_l1,
        COUNT(*) FILTER (WHERE fallback_level = 2)::int         AS fallback_l2,
        COUNT(*) FILTER (WHERE fallback_level = 3)::int         AS fallback_l3,
        COUNT(*) FILTER (WHERE fallback_level = 4)::int         AS fallback_l4,
        ROUND(AVG(result_count) FILTER (WHERE result_count > 0), 1) AS avg_results
      FROM query_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
    `),
    pool.query(`
      SELECT query, COUNT(*)::int AS freq
      FROM query_logs
      WHERE result_count = 0
        AND fallback_level = 4
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY query
      ORDER BY freq DESC
      LIMIT 20
    `),
  ]);
  res.json({
    index:        indexStats.rows[0],
    queryLogs7d:  queryStats.rows[0],
    topNoResults: zeroResultStats.rows,
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 12.5 — GET /api/admin/search/cache-stats (alias for /admin/search/cache)
   Admin: alias endpoint so both /cache and /cache-stats work.
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/admin/search/cache-stats", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const stats = searchCache.getStats();
  const topQueries = searchCache.getTopQueries(10);
  res.json({
    cache: {
      ...stats,
      embeddingServiceAvailable: _embeddingServiceAvailable,
      pgvectorAvailable:         _pgvectorAvailable,
    },
    topCachedQueries: topQueries,
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE 12.6 — GET /api/admin/cache-stats
   STEP 4.7: Aggregated stats for all in-process LRU caches.
   ═══════════════════════════════════════════════════════════════════════════ */
router.get("/admin/cache-stats", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const searchStats = searchCache.getStats();
  res.json({
    products:      productsCache.stats(),
    productDetail: productDetailCache.stats(),
    categories:    categoriesCache.stats(),
    sellers:       sellersCache.stats(),
    search: {
      size:             searchStats.size,
      maxSize:          searchStats.maxSize,
      hits:             searchStats.totalHits,
      misses:           searchStats.totalMisses,
      hitRate:          searchStats.hitRate,
      evictions:        searchStats.totalEvictions,
    },
  });
});

export default router;
