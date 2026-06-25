/* ════════════════════════════════════════════════════════════════════════════
   SYANO — Search Processor  (src/utils/searchProcessor.ts)
   Production-grade bilingual NLP pipeline for Arabic/English e-commerce.

   ┌─────────────────────────────────────────────────────────────────────────┐
   │  FULL SEARCH PIPELINE SEQUENCE                                          │
   │  (Steps applied before the DB query)                                   │
   │                                                                         │
   │  1.  Validate & sanitize query (injection removal, length truncation)  │
   │  2.  Detect language per token (Arabic / Latin / numeric)              │
   │  3.  Apply Arabic normalization to Arabic tokens                       │
   │      (diacritics, alef variants, taa marbouta, eastern digits)         │
   │  4.  Apply English normalization to Latin tokens (lowercase, stems)    │
   │  5.  Strip Syrian stop words — ONLY when residual query is non-empty   │
   │  6.  Look up synonyms (in-memory cache first, DB fallback, 5 min TTL) │
   │  7.  Detect intent (detectIntent — pure JS, no DB, < 1 ms)            │
   │  8.  Apply brand boost if known brand detected in query                │
   │  9.  Handle numeric tokens (price context / year / model number)      │
   │  10. Build FTS query — mixed-language-aware OR tsquery                 │
   │  11. Execute DB query with multi-signal ranking (text/quality/pop/…)  │
   │  12. Apply seller diversity post-processing                            │
   │  13. Return results with intent + synonym + ranking metadata           │
   └─────────────────────────────────────────────────────────────────────────┘

   TypeScript strict mode — 0 any typings — microsecond-level overhead.
   ════════════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC INTERFACE CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

export interface ProcessedSearchPayload {
  /** The raw, unmodified input string. */
  readonly originalQuery: string;
  /** The fully normalized, cleaned query string before tokenization. */
  readonly normalizedQuery: string;
  /** Dominant character-set language detected in the input. */
  readonly primaryLanguage: "ar" | "en";
  /**
   * Tokens after normalization, stopword removal, and sticky-token
   * decomposition — before cross-language expansion.
   */
  readonly baseTokens: readonly string[];
  /**
   * Base tokens PLUS all cross-language synonyms, transliterations,
   * and equivalents injected by the bidirectional bridge.
   */
  readonly expandedTokens: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface StemRule {
  readonly suffix: string;
  readonly replacement: string;
  /** Minimum word length required to apply this rule. */
  readonly minLength: number;
}

interface BridgeEntry {
  readonly terms: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-COMPILED REGEX CONSTANTS  (avoid runtime re-compilation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arabic diacritics / Tashkeel:
 *   U+064B–U+065F — Fatha, Damma, Kasra, Sukun, Shadda, all Tanween variants,
 *                    Hamza Above/Below, and extended diacritic marks.
 *   U+0670       — Arabic Letter Superscript Alef
 *   U+06D6–U+06DC, U+06DF–U+06E4, U+06E7–U+06E8, U+06EA–U+06ED — Quranic marks
 */
const RE_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;

/** Arabic elongation / Tatweel / Kashida (U+0640). */
const RE_TATWEEL = /\u0640/g;

/** Alef variants: أ (U+0623), إ (U+0625), آ (U+0622), ٱ (U+0671). */
const RE_ALEF_VARIANTS = /[\u0623\u0625\u0622\u0671]/g;

/** Taa Marbouta (ة U+0629). */
const RE_TAA_MARBOUTA = /\u0629/g;

/** Alef Maqsoura (ى U+0649). */
const RE_ALEF_MAQSOURA = /\u0649/g;

/** Hamza-bearing letters: Waw with Hamza (ؤ U+0624), Yaa with Hamza (ئ U+0626). */
const RE_COMPLEX_HAMZA = /[\u0624\u0626]/g;

/** Eastern Arabic-Indic numerals (U+0660–U+0669). */
const RE_EASTERN_DIGITS = /[\u0660-\u0669]/g;

/** Collapse multiple consecutive whitespace characters into one. */
const RE_MULTI_SPACE = /\s{2,}/g;

/** Tokenize on any whitespace boundary. */
const RE_WHITESPACE = /\s+/g;

/**
 * Sanitization: remove HTML/script injection fragments.
 * Targets: HTML tags, javascript: URIs, inline event handlers, eval, alert.
 */
const RE_INJECTION = /<[^>]*>|javascript:|on\w+\s*=|script|eval\(|alert\(/gi;

/**
 * English cleaning: strip everything except a–z, 0–9, spaces,
 * and the full Arabic Unicode block (U+0600–U+06FF) so Arabic
 * tokens are preserved during the English normalization pass.
 */
const RE_ENGLISH_CLEAN = /[^a-z0-9\s\u0600-\u06FF]/g;

/** Pure-digit guard — prevent numeric tokens from being s-stemmed. */
const RE_DIGITS_ONLY = /^\d+$/;

// ─────────────────────────────────────────────────────────────────────────────
// EASTERN NUMERAL LOOKUP TABLE  (O(1) character substitution)
// ─────────────────────────────────────────────────────────────────────────────

const EASTERN_DIGIT_MAP: Readonly<Record<string, string>> = {
  "\u0660": "0", "\u0661": "1", "\u0662": "2", "\u0663": "3", "\u0664": "4",
  "\u0665": "5", "\u0666": "6", "\u0667": "7", "\u0668": "8", "\u0669": "9",
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. ARABIC NORMALIZATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ultra-precise Arabic text normalizer.
 *
 * Executes the following transformations in strict sequence:
 *   1. Strip all Tashkeel / diacritics.
 *   2. Strip Tatweel / Kashida elongation character.
 *   3. Normalize Alef variants (أ إ آ ٱ) → bare Alef (ا).
 *   4. Normalize Taa Marbouta (ة) → Haa (ه).
 *   5. Normalize Alef Maqsoura (ى) → Yaa (ي).
 *   6. Normalize complex Hamza patterns (ؤ ئ) → bare Hamza (ء).
 *   7. Convert Eastern Arabic numerals → Western Arabic numerals.
 */
export function normalizeArabicText(text: string): string {
  return text
    .replace(RE_DIACRITICS,    "")
    .replace(RE_TATWEEL,       "")
    .replace(RE_ALEF_VARIANTS, "\u0627")   // → ا
    .replace(RE_TAA_MARBOUTA,  "\u0647")   // → ه
    .replace(RE_ALEF_MAQSOURA, "\u064A")   // → ي
    .replace(RE_COMPLEX_HAMZA, "\u0621")   // → ء
    .replace(RE_EASTERN_DIGITS, (d) => EASTERN_DIGIT_MAP[d] ?? d);
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-FREQUENCY E-COMMERCE VOCABULARY  (for sticky-token decomposition)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw vocabulary entries before normalization.
 * Variants (e.g., سماعة / سماعه) are both listed so that callers who pass
 * pre-normalized tokens still get reliable matches.
 */
const STICKY_VOCAB_RAW: readonly string[] = [
  "سماعة", "سماعه", "بلوتوث", "شاحن",  "سريع",
  "بوط",   "بواط",  "رجالي",  "رجالية", "فستان",
  "سهرة",  "موبايل", "جوال",  "ايفون",  "تلفزيون",
  "شاشة",  "ماركة",  "أصلي",  "اصلي",   "رخيص",
];

/**
 * Normalized vocabulary set — each entry has been passed through
 * normalizeArabicText so matching against already-normalized tokens is exact.
 */
const STICKY_VOCAB_NORMALIZED: ReadonlySet<string> =
  new Set(STICKY_VOCAB_RAW.map(normalizeArabicText));

// ─────────────────────────────────────────────────────────────────────────────
// BILINGUAL STOPWORD SETS
// ─────────────────────────────────────────────────────────────────────────────

const ARABIC_STOPWORDS: ReadonlySet<string> = new Set([
  "في", "من", "على", "مع", "الى", "عن", "ب", "ل", "و", "ال",
  "هذا", "هذه", "او", "ثم",
  // Syrian dialect stop words — stripped only when residual query stays non-empty
  "بدي", "بدو", "بدها", "بدنا", "بدكم", "بدهم",
  "شو", "شوف", "كيف", "وين", "ليش", "امتي",
  "بس", "يعني", "هلق", "هون", "هناك", "هاد", "هاي", "هدا",
]);

const ENGLISH_STOPWORDS: ReadonlySet<string> = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with",
  "in",  "on", "at", "to",  "from", "by", "of",
]);

/**
 * One-letter Arabic prefix conjunctions / prepositions that users routinely
 * write directly concatenated onto the following word (e.g., "وموبايل").
 * Each entry is a single Arabic character.
 */
const ARABIC_PREFIX_CONJUNCTIONS: readonly string[] = ["و", "ف", "ب", "ل", "ك"];

// ─────────────────────────────────────────────────────────────────────────────
// BIDIRECTIONAL CROSS-LANGUAGE BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

const CROSS_LANGUAGE_BRIDGE: readonly BridgeEntry[] = [
  { terms: ["iphone",   "ايفون"] },
  { terms: ["samsung",  "سامسونج"] },
  { terms: ["laptop",   "لابتوب", "كمبيوتر"] },
  { terms: ["shoes",    "sneakers", "احذية", "أحذية", "بوط", "بواط", "كندرة"] },
  { terms: ["makeup",   "cosmetics", "مكياج", "مكياجات"] },
  { terms: ["perfume",  "عطور", "عطورات", "ريحة"] },
  { terms: ["charger",  "شاحن", "شواحن"] },
];

/**
 * Build a flat lookup: normalizedToken → all sibling expansions (normalized).
 * Both Arabic and English terms are normalized for consistent matching
 * against the post-normalization token stream.
 */
function buildBridgeIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const entry of CROSS_LANGUAGE_BRIDGE) {
    const normalizedTerms = entry.terms.map((t) => normalizeArabicText(t.toLowerCase()));

    for (let i = 0; i < normalizedTerms.length; i++) {
      const key = normalizedTerms[i] as string;
      const siblings = normalizedTerms.filter((_, j) => j !== i);
      // Merge with any previously registered siblings for this key
      const existing = index.get(key);
      if (existing) {
        for (const s of siblings) {
          if (!existing.includes(s)) existing.push(s);
        }
      } else {
        index.set(key, [...siblings]);
      }
    }
  }

  return index;
}

const BRIDGE_INDEX: ReadonlyMap<string, readonly string[]> = buildBridgeIndex();

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH STEM RULES
// ─────────────────────────────────────────────────────────────────────────────

const STEM_RULES: readonly StemRule[] = [
  { suffix: "shoes",   replacement: "shoe",   minLength: 5 },
  { suffix: "phones",  replacement: "phone",  minLength: 6 },
  { suffix: "laptops", replacement: "laptop", minLength: 7 },
  { suffix: "shirts",  replacement: "shirt",  minLength: 6 },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. ENGLISH NORMALIZATION & STEMMER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies English-specific normalization to the full query string:
 *   1. Lowercase the entire stream.
 *   2. Strip non-alphanumeric punctuation (preserves Arabic range + spaces).
 *   3. Per-token: apply specific e-commerce suffix stem rules.
 *   4. Per-token: apply general trailing-s removal for words longer than 3 chars.
 *
 * Arabic tokens pass through unchanged — the character-class regex explicitly
 * preserves U+0600–U+06FF.
 */
export function normalizeEnglishText(text: string): string {
  const cleaned = text.toLowerCase().replace(RE_ENGLISH_CLEAN, " ");

  const stemmed = cleaned
    .split(RE_WHITESPACE)
    .filter((t) => t.length > 0)
    .map((word): string => {
      // Specific rules first (more precise, higher priority)
      for (const rule of STEM_RULES) {
        if (word.endsWith(rule.suffix) && word.length >= rule.minLength) {
          return word.slice(0, word.length - rule.suffix.length) + rule.replacement;
        }
      }
      // General trailing-s removal (words > 3 chars, non-pure-digit)
      if (word.length > 3 && word.endsWith("s") && !RE_DIGITS_ONLY.test(word)) {
        return word.slice(0, -1);
      }
      return word;
    });

  return stemmed.join(" ").replace(RE_MULTI_SPACE, " ").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BILINGUAL STOPWORDS CLEANER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters a token array by:
 *   1. Removing exact Arabic and English stopword matches.
 *   2. Stripping one-letter Arabic prefix conjunctions attached to a token
 *      (e.g., "وموبايل" → "موبايل") and re-testing the remainder.
 */
export function stripStopwords(tokens: readonly string[]): string[] {
  const result: string[] = [];

  for (const token of tokens) {
    // Exact stopword match
    if (ARABIC_STOPWORDS.has(token) || ENGLISH_STOPWORDS.has(token)) continue;

    // Guard: never strip a prefix from tokens that are themselves recognized
    // vocabulary entries or bridge keys — e.g. "بواط" (boots) must not lose
    // its "ب" and become the meaningless fragment "واط".
    const isKnownWord =
      STICKY_VOCAB_NORMALIZED.has(token) || BRIDGE_INDEX.has(token);

    // Attempt prefix conjunction stripping (at most one prefix per token)
    let candidate = token;
    if (!isKnownWord) {
      for (const prefix of ARABIC_PREFIX_CONJUNCTIONS) {
        if (
          candidate.startsWith(prefix) &&
          candidate.length > prefix.length + 1 // remainder must be ≥ 2 chars
        ) {
          candidate = candidate.slice(prefix.length);
          break;
        }
      }
    }

    // Re-validate the stripped candidate
    if (ARABIC_STOPWORDS.has(candidate) || ENGLISH_STOPWORDS.has(candidate)) continue;
    if (candidate.length > 0) result.push(candidate);
  }

  // Safety guard: if ALL tokens were stopwords, preserve the original query
  // to avoid an empty FTS input (e.g. user types only "بدي" or "شو").
  return result.length > 0 ? result : [...tokens];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HIGH-FREQUENCY STICKY TOKEN RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves compound tokens that users created by omitting a space between two
 * high-frequency e-commerce nouns/adjectives.
 *
 * Algorithm (per token):
 *   - Skip tokens ≤ 6 chars or already present in the vocabulary (no need to split).
 *   - Sliding-window scan: for each split-point i in [1, len-1], check whether
 *     left-slice AND right-slice are both present in the normalized vocabulary.
 *   - On first successful decomposition, emit both sub-tokens and stop.
 *   - If no decomposition found, emit the original token unchanged.
 *
 * Complexity: O(n × V) where n = token length, V = vocabulary size.
 */
export function splitStickyTokens(tokens: readonly string[]): string[] {
  const result: string[] = [];

  for (const token of tokens) {
    if (token.length <= 6 || STICKY_VOCAB_NORMALIZED.has(token)) {
      result.push(token);
      continue;
    }

    let decomposed = false;
    for (let i = 1; i < token.length && !decomposed; i++) {
      const left  = token.slice(0, i);
      const right = token.slice(i);
      if (STICKY_VOCAB_NORMALIZED.has(left) && STICKY_VOCAB_NORMALIZED.has(right)) {
        result.push(left, right);
        decomposed = true;
      }
    }

    if (!decomposed) result.push(token);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. BIDIRECTIONAL CROSS-LANGUAGE BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expands a token array by injecting cross-language synonyms and
 * transliterations for any token that appears as a key in the bridge index.
 *
 * Guarantees:
 *   - Each expansion is added at most once (deduplication via Set).
 *   - The original token order is preserved; expansions are appended.
 *   - Operates on already-normalized tokens — the bridge index keys are
 *     pre-normalized to the same form.
 */
export function crossLanguageBridge(tokens: readonly string[]): string[] {
  const seen = new Set<string>(tokens);
  const expanded: string[] = [...tokens];

  for (const token of tokens) {
    const siblings = BRIDGE_INDEX.get(token);
    if (!siblings) continue;
    for (const sibling of siblings) {
      if (!seen.has(sibling)) {
        seen.add(sibling);
        expanded.push(sibling);
      }
    }
  }

  return expanded;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE INTERNALS — sanitizer + language detector
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeRaw(raw: string): string {
  return raw
    .replace(RE_INJECTION,   " ")
    .replace(RE_MULTI_SPACE, " ")
    .trim();
}

/**
 * Counts Arabic-script and Latin-script characters to determine which
 * language dominates the query.  Ties resolve to Arabic.
 */
function detectPrimaryLanguage(text: string): "ar" | "en" {
  let arabic  = 0;
  let english = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0600 && cp <= 0x06FF) {
      arabic++;
    } else if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A)) {
      english++;
    }
  }

  return arabic >= english ? "ar" : "en";
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER UNIFIED PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `processSearchQuery` — entry-point for the full NLP pipeline.
 *
 * Steps:
 *   1. Trim, sanitize (injection removal), collapse duplicate spaces.
 *   2. Detect primaryLanguage via Arabic vs English character counts.
 *   3. Run `normalizeArabicText` (diacritics, Alef, numerals, …).
 *   4. Run `normalizeEnglishText` (lowercase, clean punct, stem suffixes).
 *   5. Tokenize on whitespace boundaries.
 *   6. `stripStopwords` (exact + Arabic prefix conjunctions).
 *   7. `splitStickyTokens` (decompose concatenated compound tokens).
 *   8. `crossLanguageBridge` (inject cross-language synonym expansions).
 *
 * @param rawQuery  - Untrusted raw search input from the user.
 * @returns         - Fully structured `ProcessedSearchPayload`.
 */
export function processSearchQuery(rawQuery: string): ProcessedSearchPayload {
  // Step 1 — sanitize
  const sanitized = sanitizeRaw(rawQuery.trim());

  // Step 2 — detect language (on sanitized, pre-normalization input)
  const primaryLanguage = detectPrimaryLanguage(sanitized);

  // Step 3 & 4 — normalize Arabic, then normalize English
  const afterArabic  = normalizeArabicText(sanitized);
  const normalizedQuery = normalizeEnglishText(afterArabic)
    .replace(RE_MULTI_SPACE, " ")
    .trim();

  // Step 5 — tokenize
  const rawTokens = normalizedQuery.split(RE_WHITESPACE).filter((t) => t.length > 0);

  // Step 6 — stopword removal (including prefix conjunction stripping)
  const afterStopwords = stripStopwords(rawTokens);

  // Step 7 — sticky token decomposition
  const baseTokens = splitStickyTokens(afterStopwords);

  // Step 8 — cross-language expansion
  const expandedTokens = crossLanguageBridge(baseTokens);

  return {
    originalQuery:  rawQuery,
    normalizedQuery,
    primaryLanguage,
    baseTokens,
    expandedTokens,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████████████████████████████████████████████████████████████
//   SELF-CONTAINED VERIFICATION SUITE
//   Proves the full pipeline handles complex colloquial mixed inputs.
//
//   Invoke: testSearchProcessor()
//   Or run standalone: npx ts-node src/utils/searchProcessor.ts
// ██████████████████████████████████████████████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

interface TestAssertion {
  readonly label: string;
  readonly check: (result: ProcessedSearchPayload) => boolean;
}

interface TestCase {
  readonly description: string;
  readonly input: string;
  readonly assertions: readonly TestAssertion[];
}

const TEST_SUITE: readonly TestCase[] = [
  // ── Primary parity test (spec-mandated) ─────────────────────────────────
  {
    description: "Complex colloquial Arabic: sticky token, Eastern numeral, prefix conjunction, cross-language",
    input: "بواط سبور وموبايل ايفون شاحنسريع ١٥",
    assertions: [
      {
        label: "Eastern numeral ١٥ → 15 in normalizedQuery",
        check: (r) => r.normalizedQuery.includes("15"),
      },
      {
        label: '"شاحنسريع" decomposed into separate tokens "شاحن" and "سريع"',
        check: (r) => r.baseTokens.includes("شاحن") && r.baseTokens.includes("سريع"),
      },
      {
        label: '"و" prefix stripped from "وموبايل" → "موبايل" present, "وموبايل" absent',
        check: (r) =>
          r.baseTokens.includes("موبايل") &&
          !r.baseTokens.some((t) => t === "وموبايل"),
      },
      {
        label: '"ايفون" expanded to include "iphone" via bridge',
        check: (r) => r.expandedTokens.includes("iphone"),
      },
      {
        label: '"بواط" expanded to include "shoes" via bridge',
        check: (r) => r.expandedTokens.includes("shoes"),
      },
      {
        label: '"شاحن" (from sticky split) expands to "charger" and "شواحن"',
        check: (r) =>
          r.expandedTokens.includes("charger") &&
          r.expandedTokens.includes("شواحن"),
      },
      {
        label: "Primary language detected as Arabic",
        check: (r) => r.primaryLanguage === "ar",
      },
    ],
  },

  // ── Tashkeel & Taa Marbouta normalization ───────────────────────────────
  {
    description: "Arabic diacritics and Taa Marbouta normalization",
    input: "سَمَّاعَةٌ بِلُوتُوثَ",
    assertions: [
      {
        label: "All Tashkeel codepoints stripped from normalizedQuery",
        check: (r) => !/[\u064B-\u065F\u0670]/.test(r.normalizedQuery),
      },
      {
        label: "Taa Marbouta (ة) → Haa (ه): 'سماعة' becomes 'سماعه'",
        check: (r) =>
          r.normalizedQuery.includes("سماعه") &&
          !r.normalizedQuery.includes("سماعة"),
      },
    ],
  },

  // ── Alef variants ────────────────────────────────────────────────────────
  {
    description: "Alef variant normalization (أ إ آ ٱ → ا)",
    input: "أحذية إلكترونيات آيباد",
    assertions: [
      {
        label: "No Alef variant characters remain after normalization",
        check: (r) => !/[\u0623\u0625\u0622\u0671]/.test(r.normalizedQuery),
      },
      {
        label: '"أحذية" becomes "احذيه" (Alef + Taa Marbouta both normalized)',
        check: (r) => r.normalizedQuery.includes("احذيه"),
      },
    ],
  },

  // ── English stemming & stopwords ─────────────────────────────────────────
  {
    description: "English stemming and bilateral stopword removal",
    input: "the best laptops and phones for gaming",
    assertions: [
      {
        label: "English stopwords 'the', 'and', 'for' removed from baseTokens",
        check: (r) =>
          !r.baseTokens.includes("the") &&
          !r.baseTokens.includes("and") &&
          !r.baseTokens.includes("for"),
      },
      {
        label: '"laptops" stemmed to "laptop" in baseTokens',
        check: (r) => r.baseTokens.includes("laptop"),
      },
      {
        label: '"phones" stemmed to "phone" in baseTokens',
        check: (r) => r.baseTokens.includes("phone"),
      },
      {
        label: '"laptop" bridge-expanded to "لابتوب" and "كمبيوتر"',
        check: (r) =>
          r.expandedTokens.includes("لابتوب") &&
          r.expandedTokens.includes("كمبيوتر"),
      },
      {
        label: "Primary language detected as English",
        check: (r) => r.primaryLanguage === "en",
      },
    ],
  },

  // ── Cross-language bridge — charger ──────────────────────────────────────
  {
    description: "Cross-language bridge expansion from English: charger",
    input: "charger fast",
    assertions: [
      {
        label: '"charger" expands to "شاحن" and "شواحن" in expandedTokens',
        check: (r) =>
          r.expandedTokens.includes("شاحن") &&
          r.expandedTokens.includes("شواحن"),
      },
      {
        label: '"fast" general-s rule does NOT corrupt non-s-ending words',
        check: (r) => r.baseTokens.includes("fast"),
      },
    ],
  },

  // ── Sticky token decomposition — smaaha + bluetooth ──────────────────────
  {
    description: 'Sticky token: "سماعهبلوتوث" → ["سماعه", "بلوتوث"]',
    input: "سماعهبلوتوث",
    assertions: [
      {
        label: '"سماعهبلوتوث" split into "سماعه" and "بلوتوث"',
        check: (r) =>
          r.baseTokens.includes("سماعه") &&
          r.baseTokens.includes("بلوتوث"),
      },
      {
        label: "Original compound token absent from baseTokens",
        check: (r) => !r.baseTokens.includes("سماعهبلوتوث"),
      },
    ],
  },

  // ── Injection sanitization ───────────────────────────────────────────────
  {
    description: "XSS / injection sanitization",
    input: "<script>alert('xss')</script> ايفون",
    assertions: [
      {
        label: "HTML/script tags removed from normalizedQuery",
        check: (r) =>
          !r.normalizedQuery.includes("<") &&
          !r.normalizedQuery.includes("script"),
      },
      {
        label: '"ايفون" still correctly processed and expanded after sanitization',
        check: (r) => r.expandedTokens.includes("iphone"),
      },
    ],
  },

  // ── Arabic Yaa / Hamza normalization ─────────────────────────────────────
  {
    description: "Yaa (ى) and complex Hamza (ؤ ئ) normalization",
    input: "مؤسسة رئيسية مدى",
    assertions: [
      {
        label: "ؤ → ء: no Waw-with-Hamza in normalizedQuery",
        check: (r) => !r.normalizedQuery.includes("ؤ"),
      },
      {
        label: "ئ → ء: no Yaa-with-Hamza in normalizedQuery",
        check: (r) => !r.normalizedQuery.includes("ئ"),
      },
      {
        label: "ى (Alef Maqsoura) → ي: no Alef Maqsoura in normalizedQuery",
        check: (r) => !r.normalizedQuery.includes("ى"),
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION  (pure JS, no DB, < 1 ms)
// ─────────────────────────────────────────────────────────────────────────────

export interface DetectedIntentResult {
  readonly intent: string | null;
  readonly confidence: number;
  readonly modifiers: Readonly<Record<string, boolean>>;
  readonly detectedIntents: readonly string[];
}

const INTENT_TRIGGERS: Readonly<Record<string, { ar: readonly string[]; en: readonly string[] }>> = {
  price_low: {
    ar: ["رخيص", "رخيصة", "رخيصه", "بسعر مناسب", "بسعر رخيص", "ارخص", "اقل سعر", "اوفر", "اقتصادي", "مو غالي", "مش غالي", "ما غالي", "بسيط", "بزبون", "لقطة", "لقطه", "ببلاش", "على قد الايد", "حرق"],
    en: ["cheap", "affordable", "budget", "low price", "inexpensive", "economical", "value"],
  },
  price_high: {
    ar: ["غالي", "فاخر", "فاخرة", "بريميوم", "احسن جودة", "احسن جوده", "فخم", "راقي", "نخب اول", "ماركة", "ماركه", "براند", "ملوكي", "ممتاز", "وكالة", "وكاله"],
    en: ["expensive", "premium", "luxury", "high-end", "quality", "best"],
  },
  new_arrivals: {
    ar: ["جديد", "جديدة", "جديده", "وصل حديثا", "اخر وصول", "احدث", "وصل هلق", "طازج", "حديث"],
    en: ["new", "latest", "just arrived", "recent", "newest"],
  },
  on_sale: {
    ar: ["عرض", "عروض", "تخفيض", "تخفيضات", "خصم", "خصومات", "سعر مخفض", "تنزيل", "مخفض", "ارخص سعر"],
    en: ["sale", "discount", "offer", "deal", "promotion", "reduced", "clearance"],
  },
  gift: {
    ar: ["هدية", "هديه", "هدايا", "مناسبة", "مناسبه", "عيد", "اهداء", "هدية لـ", "هديه لامي", "هديه لزوجتي", "هديه للاطفال", "كاده", "كادو"],
    en: ["gift", "present", "for her", "for him", "for kids", "birthday", "occasion", "surprise"],
  },
} as const;

/**
 * detectIntent — classify user intent from a query (no DB access required).
 *
 * Returns all detected intents, a primary intent, and a confidence score.
 * The normalizedQuery is passed through Arabic normalization before matching
 * so taa marbouta / alef variants are handled transparently.
 */
export function detectIntent(query: string, _language?: "ar" | "en" | "mixed"): DetectedIntentResult {
  const norm = normalizeArabicText(query.toLowerCase());
  const tokens = norm.split(/\s+/).filter(Boolean);

  const detectedIntents: string[] = [];
  const modifiers: Record<string, boolean> = {};

  for (const [intentName, triggers] of Object.entries(INTENT_TRIGGERS)) {
    const allTriggers = [
      ...triggers.ar.map(t => normalizeArabicText(t.toLowerCase())),
      ...triggers.en.map(t => t.toLowerCase()),
    ];
    const hit =
      tokens.some(tok => allTriggers.some(tr => !tr.includes(" ") && tr === tok)) ||
      allTriggers.some(tr => tr.includes(" ") && norm.includes(tr));

    if (hit) {
      detectedIntents.push(intentName);
      modifiers[intentName] = true;
    }
  }

  const primaryIntent = detectedIntents[0] ?? null;
  let confidence = 0;
  if (primaryIntent !== null) {
    const triggers = INTENT_TRIGGERS[primaryIntent];
    const normTriggers = [
      ...triggers.ar.map(t => normalizeArabicText(t.toLowerCase())),
      ...triggers.en.map(t => t.toLowerCase()),
    ];
    const exactHit = tokens.some(tok => normTriggers.some(tr => !tr.includes(" ") && tr === tok));
    confidence = exactHit ? 1.0 : 0.7;
  }

  return { intent: primaryIntent, confidence, modifiers, detectedIntents };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────

export function testSearchProcessor(): void {
  const C = {
    reset:  "\x1b[0m",
    bold:   "\x1b[1m",
    dim:    "\x1b[2m",
    green:  "\x1b[32m",
    red:    "\x1b[31m",
    yellow: "\x1b[33m",
    cyan:   "\x1b[36m",
    white:  "\x1b[37m",
  };

  const HR      = "═".repeat(72);
  const HR_THIN = "─".repeat(72);

  console.log(`\n${C.bold}${HR}${C.reset}`);
  console.log(`${C.bold}  SYANO Search Processor — Verification Suite${C.reset}`);
  console.log(`${C.bold}${HR}${C.reset}\n`);

  let passed = 0;
  let failed = 0;

  for (const tc of TEST_SUITE) {
    const result = processSearchQuery(tc.input);

    console.log(`${C.cyan}${C.bold}▶ ${tc.description}${C.reset}`);
    console.log(`${C.dim}  Input:          "${tc.input}"${C.reset}`);
    console.log(`${C.dim}  Normalized:     "${result.normalizedQuery}"${C.reset}`);
    console.log(`${C.dim}  Language:       ${result.primaryLanguage}${C.reset}`);
    console.log(`${C.dim}  Base tokens:    [${result.baseTokens.join(", ")}]${C.reset}`);
    console.log(`${C.dim}  Expanded:       [${result.expandedTokens.join(", ")}]${C.reset}`);

    for (const assertion of tc.assertions) {
      const ok = assertion.check(result);
      if (ok) {
        console.log(`  ${C.green}✓${C.reset} ${assertion.label}`);
        passed++;
      } else {
        console.log(`  ${C.red}✗${C.reset} ${C.yellow}FAILED${C.reset}: ${assertion.label}`);
        failed++;
      }
    }
    console.log();
  }

  const total    = passed + failed;
  const allGood  = failed === 0;
  const statusFg = allGood ? C.green : C.red;
  const statusTx = allGood ? "ALL TESTS PASSED" : `${failed} FAILED`;

  console.log(`${C.bold}${HR_THIN}${C.reset}`);
  console.log(
    `${C.bold}Results: ${statusFg}${statusTx}${C.reset}${C.bold} — ${passed}/${total} assertions passed${C.reset}`,
  );
  console.log(`${C.bold}${HR}${C.reset}\n`);

  if (!allGood) process.exitCode = 1;
}

// Auto-run when executed directly (ts-node / node --experimental-strip-types)
// Works with both CommonJS (require.main) and ESM (import.meta.url check is
// done via the CommonJS bridge so ts-node picks it up correctly).
const _isMain = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require.main === module;
  } catch {
    return false;
  }
})();

if (_isMain) testSearchProcessor();
