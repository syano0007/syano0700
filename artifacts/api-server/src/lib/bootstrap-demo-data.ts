/**
 * bootstrapDemoMarketplaceData()
 *
 * Self-healing demo data for SYANO.
 * Runs automatically on every server startup — AFTER migrations and account bootstraps.
 *
 * IDEMPOTENT: If products already exist (COUNT >= 42) the function exits immediately.
 * Nothing is duplicated on normal restarts.
 *
 * Creates:
 *   4 sellers  → seller_applications (approved)
 *   4 customers
 *   42 products with real Pexels images
 *   15 orders  → order_items + order_status_history
 *   40 product reviews
 *   8  seller reviews
 *   12 wishlist items
 *   8  store follows
 */

import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { logger } from "./logger";

// ── helpers ──────────────────────────────────────────────────────────────────

const P = (id: number, w = 800, h = 600) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;

// Convert JS string array to PostgreSQL array literal: {"a","b","c"}
const pgArr = (arr: string[]): string =>
  `{${arr.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

// ── seller definitions ────────────────────────────────────────────────────────

const SELLERS = [
  {
    email: "ahmad.electronics@syano.test",
    name: "Ahmad Al-Masri",
    phone: "0911100001",
    storeName: "Ahmad Electronics",
    storeNameAr: "أحمد للإلكترونيات",
    slug: "ahmad-electronics",
    city: "Damascus",
    category: "Electronics",
    categories: ["Electronics", "Accessories"],
    description:
      "Premium electronics and smart devices. Official distributor of top brands in Syria.",
    descriptionAr:
      "إلكترونيات متميزة وأجهزة ذكية. موزع رسمي لأفضل العلامات التجارية في سوريا.",
    logo: P(1649771, 200, 200),
    banner: P(1649771, 1200, 400),
    accent: "#2563eb",
  },
  {
    email: "nour.fashion@syano.test",
    name: "Nour Khalil",
    phone: "0911100002",
    storeName: "Nour Fashion",
    storeNameAr: "نور للأزياء",
    slug: "nour-fashion",
    city: "Aleppo",
    category: "Fashion",
    categories: ["Fashion", "Accessories"],
    description:
      "Trendy fashion for men and women. Latest styles from local and international designers.",
    descriptionAr:
      "أزياء عصرية للرجال والنساء. أحدث تصاميم المصممين المحليين والدوليين.",
    logo: P(1926769, 200, 200),
    banner: P(1926769, 1200, 400),
    accent: "#db2777",
  },
  {
    email: "beit.nour@syano.test",
    name: "Rami Haddad",
    phone: "0911100003",
    storeName: "Beit Al-Nour",
    storeNameAr: "بيت النور",
    slug: "beit-al-nour",
    city: "Homs",
    category: "Home & Living",
    categories: ["Home & Living", "Furniture"],
    description:
      "Beautiful home decor and furniture. Transform your home with our curated collection.",
    descriptionAr:
      "ديكور منزلي وأثاث جميل. حوّل منزلك مع مجموعتنا المختارة بعناية.",
    logo: P(1571458, 200, 200),
    banner: P(1571458, 1200, 400),
    accent: "#92400e",
  },
  {
    email: "hana.beauty@syano.test",
    name: "Hana Mahmoud",
    phone: "0911100004",
    storeName: "Hana Beauty",
    storeNameAr: "هناء للجمال",
    slug: "hana-beauty",
    city: "Latakia",
    category: "Beauty",
    categories: ["Beauty", "Perfumes"],
    description:
      "Premium perfumes, cosmetics and skincare. Your destination for authentic beauty.",
    descriptionAr: "عطور وتجميل وعناية بالبشرة. وجهتك للجمال الأصيل.",
    logo: P(3059609, 200, 200),
    banner: P(3059609, 1200, 400),
    accent: "#7c3aed",
  },
] as const;

// ── customer definitions ──────────────────────────────────────────────────────

const CUSTOMERS = [
  { email: "mohammed@syano.test", name: "Mohammed Al-Masri", phone: "0922200001" },
  { email: "sara@syano.test", name: "Sara Khalil", phone: "0922200002" },
  { email: "omar@syano.test", name: "Omar Haddad", phone: "0922200003" },
  { email: "layla@syano.test", name: "Layla Nasser", phone: "0922200004" },
] as const;

// ── product definitions ───────────────────────────────────────────────────────

interface ProductSpec {
  si: number;        // seller index (0-3)
  name: string;
  nameAr: string;
  desc: string;
  price: number;
  disc?: number;     // discount_percent
  cat: string;
  sub?: string;
  stock: number;
  img: number;       // primary pexels photo id
  extra?: number[];  // additional pexels ids for image_urls
  featured?: boolean;
  sales?: number;
  ago?: number;      // created daysAgo
}

const PRODUCTS: ProductSpec[] = [
  // ── ELECTRONICS (seller 0: Ahmad Electronics) ─────────────────────────────
  { si:0, name:"Sony WH-1000XM5 Wireless Headphones", nameAr:"سماعات سوني WH-1000XM5 اللاسلكية",
    desc:"Industry-leading noise cancellation with 30-hour battery life. Crystal-clear audio for music and calls.",
    price:185000, disc:20, cat:"Electronics", sub:"Headphones", stock:24,
    img:1649771, extra:[3587477,3394650], featured:true, sales:142, ago:45 },

  { si:0, name:"Samsung Galaxy S24 Ultra 256GB", nameAr:"سامسونج جالاكسي S24 ألترا 256 جيجا",
    desc:"200MP camera, S-Pen included, 6.8\" Dynamic AMOLED display. The ultimate Android flagship.",
    price:890000, disc:8, cat:"Electronics", sub:"Smartphones", stock:15,
    img:699122, featured:true, sales:89, ago:20 },

  { si:0, name:"Apple MacBook Pro 14\" M3 Pro", nameAr:"آبل ماك بوك برو 14 إنش M3 برو",
    desc:"Apple M3 Pro chip, 18-hour battery, Liquid Retina XDR display. Built for professionals.",
    price:1450000, cat:"Electronics", sub:"Laptops", stock:8,
    img:18105, extra:[1181244], sales:31, ago:10 },

  { si:0, name:"Apple Watch Series 9 GPS 45mm", nameAr:"ساعة آبل سيريز 9 GPS 45 مم",
    desc:"Advanced health monitoring, crash detection, Double Tap gesture. 18-hour battery.",
    price:420000, disc:15, cat:"Electronics", sub:"Smartwatches", stock:19,
    img:190819, extra:[1407305], featured:true, sales:76, ago:30 },

  { si:0, name:"Sony Alpha A7 IV Mirrorless Camera", nameAr:"كاميرا سوني ألفا A7 IV بدون مرآة",
    desc:"33MP full-frame sensor, 4K 60fps video, real-time eye tracking AF.",
    price:1250000, disc:10, cat:"Electronics", sub:"Cameras", stock:6,
    img:1444416, extra:[225157], sales:18, ago:15 },

  { si:0, name:"Apple AirPods Pro 3rd Generation", nameAr:"آبل إيربودز برو الجيل الثالث",
    desc:"Active noise cancellation, adaptive audio, H2 chip, 6-hour listening time. Sweat resistant.",
    price:295000, disc:18, cat:"Electronics", sub:"Earbuds", stock:42,
    img:3587477, featured:true, sales:203, ago:60 },

  { si:0, name:"iPad Pro 12.9\" M2 Wi-Fi 256GB", nameAr:"آيباد برو 12.9 إنش M2 واي فاي 256 جيجا",
    desc:"M2 chip, Liquid Retina XDR display, ProMotion 120Hz, Face ID. For creative professionals.",
    price:920000, cat:"Electronics", sub:"Tablets", stock:11,
    img:577585, extra:[1181244], sales:27, ago:8 },

  { si:0, name:"JBL Charge 5 Portable Bluetooth Speaker", nameAr:"سماعة JBL Charge 5 بلوتوث محمولة",
    desc:"Powerful sound with deep bass, IP67 waterproof, 20-hour playtime. Built-in power bank.",
    price:145000, disc:25, cat:"Electronics", sub:"Speakers", stock:33,
    img:3945683, extra:[3394650], sales:118, ago:90 },

  { si:0, name:"Samsung 65\" 4K QLED Smart TV", nameAr:"تلفزيون سامسونج 65 بوصة QLED 4K ذكي",
    desc:"Quantum Dot technology, 4K AI upscaling, HDR10+, built-in Alexa. 120Hz refresh rate.",
    price:1850000, disc:8, cat:"Electronics", sub:"TVs", stock:4,
    img:1201996, extra:[5082660], featured:true, sales:5, ago:3 },

  // ── FASHION (seller 1: Nour Fashion) ──────────────────────────────────────
  { si:1, name:"Floral Maxi Dress — Summer 2025 Collection", nameAr:"فستان ماكسي بالزهور — كوليكشن صيف 2025",
    desc:"Lightweight chiffon with vibrant floral print. Perfect for outings, beach, or casual events.",
    price:65000, disc:30, cat:"Fashion", sub:"Women's Dresses", stock:58,
    img:1926769, extra:[1536619,1152077], featured:true, sales:267, ago:14 },

  { si:1, name:"Premium Leather Jacket — Men's Classic Biker", nameAr:"جاكيت جلد فاخر للرجال — كلاسيك بايكر",
    desc:"Genuine leather jacket with quilted lining. Classic biker style with zip pockets.",
    price:175000, disc:15, cat:"Fashion", sub:"Men's Outerwear", stock:22,
    img:2529148, featured:true, sales:94, ago:25 },

  { si:1, name:"Nike Air Max 270 Sneakers", nameAr:"حذاء نايك إير ماكس 270",
    desc:"Iconic Air Max sole for all-day comfort. Breathable mesh upper. Available sizes 38–46.",
    price:135000, disc:20, cat:"Fashion", sub:"Sneakers", stock:45,
    img:1040945, extra:[2048584], featured:true, sales:312, ago:50 },

  { si:1, name:"Designer Genuine Leather Handbag", nameAr:"حقيبة يد جلد حقيقي مصمم",
    desc:"Premium genuine leather with gold hardware. Spacious interior with multiple compartments.",
    price:245000, cat:"Fashion", sub:"Bags & Purses", stock:14,
    img:1152077, extra:[2905238], sales:41, ago:12 },

  { si:1, name:"Men's Slim-Fit Chino Pants", nameAr:"بنطلون شينو سليم فيت للرجال",
    desc:"Stretch cotton chinos for all-day comfort. Available in navy, khaki, and olive. Machine washable.",
    price:45000, disc:35, cat:"Fashion", sub:"Men's Pants", stock:86,
    img:2220280, extra:[996329], sales:189, ago:20 },

  { si:1, name:"Women's Stiletto Heels — Party Collection", nameAr:"حذاء كعب عالٍ للسيدات — كوليكشن حفلات",
    desc:"Elegant stiletto heels with ankle strap. Cushioned insole. Black, nude, and red.",
    price:78000, disc:22, cat:"Fashion", sub:"Women's Shoes", stock:31,
    img:1619651, extra:[2213005], sales:73, ago:18 },

  { si:1, name:"Nida Fabric Abaya — Classic Black", nameAr:"عباءة قماش نيدا — أسود كلاسيك",
    desc:"Classic cut abaya in premium nida fabric. Front zipper, side pockets. Navy and dark green available.",
    price:55000, cat:"Fashion", sub:"Abayas", stock:95,
    img:6149284, extra:[8090091], sales:3, ago:2 },

  // ── HOME & LIVING (seller 2: Beit Al-Nour) ────────────────────────────────
  { si:2, name:"Modern Scandinavian 3-Seater Sofa", nameAr:"أريكة سكاندينافية عصرية ثلاثية المقاعد",
    desc:"Durable fabric upholstery, solid wood legs, removable covers. Available in 5 colors.",
    price:680000, disc:12, cat:"Home & Living", sub:"Furniture", stock:7,
    img:1643383, extra:[1279107,276528], featured:true, sales:23, ago:30 },

  { si:2, name:"Bamboo Floor Lamp — Nordic Style 165cm", nameAr:"مصباح أرضي بامبو نوردك 165 سم",
    desc:"Natural bamboo frame with linen shade. Warm LED light included. Perfect for living rooms.",
    price:95000, disc:20, cat:"Home & Living", sub:"Lighting", stock:28,
    img:1279107, extra:[1643383], sales:67, ago:22 },

  { si:2, name:"Premium Ceramic Dinner Set — 24 Pieces", nameAr:"طقم عشاء سيراميك ممتاز — 24 قطعة",
    desc:"White ceramic with gold rim. 6 dinner plates, 6 salad plates, 6 bowls, 6 cups. Microwave safe.",
    price:125000, disc:28, cat:"Home & Living", sub:"Kitchen & Dining", stock:19,
    img:243757, extra:[1643383], featured:true, sales:45, ago:40 },

  { si:2, name:"Persian-Style Area Rug 200×300 cm", nameAr:"سجادة على الطراز الفارسي 200×300 سم",
    desc:"Machine-woven geometric patterns in burgundy and gold. Non-slip backing. Easy to clean.",
    price:345000, disc:15, cat:"Home & Living", sub:"Rugs & Carpets", stock:12,
    img:1571458, extra:[276528], sales:34, ago:15 },

  { si:2, name:"Abstract Canvas Wall Art Set — 3 Pieces", nameAr:"طقم لوحات جدارية تجريدية — 3 قطع",
    desc:"Modern abstract art on premium canvas. 3 coordinated prints. Ready to hang.",
    price:68000, disc:40, cat:"Home & Living", sub:"Wall Decor", stock:41,
    img:1839919, extra:[3246603], featured:true, sales:88, ago:7 },

  { si:2, name:"Stainless Steel Cookware Set — 8 Pieces", nameAr:"طقم أواني طبخ ستانلس ستيل — 8 قطع",
    desc:"Heavy-duty 18/10 stainless steel, tri-ply construction. Oven safe to 260°C. Dishwasher safe.",
    price:195000, disc:17, cat:"Home & Living", sub:"Kitchen & Dining", stock:16,
    img:1438761, extra:[243757], sales:52, ago:35 },

  { si:2, name:"Memory Foam Orthopedic Pillow", nameAr:"وسادة إسفنج ذاكرة علاجية",
    desc:"Ergonomic cervical support with cooling gel cover. Medium firmness. Hypoallergenic. Washable cover.",
    price:42000, disc:30, cat:"Home & Living", sub:"Bedding", stock:67,
    img:1034584, extra:[3952234], sales:134, ago:5 },

  // ── BEAUTY (seller 3: Hana Beauty) ────────────────────────────────────────
  { si:3, name:"Dior Sauvage Eau de Parfum 100ml", nameAr:"عطر ديور سوفاج أو دو بارفان 100 مل",
    desc:"Iconic raw freshness with noble salted woody base. Top notes of bergamot and spice.",
    price:285000, disc:10, cat:"Beauty", sub:"Men's Perfumes", stock:38,
    img:3059609, extra:[965989], featured:true, sales:198, ago:45 },

  { si:3, name:"Chanel N°5 Eau de Parfum 50ml", nameAr:"عطر شانيل No.5 أو دو بارفان 50 مل",
    desc:"The world's most iconic fragrance. Floral-aldehyde with jasmine, rose, sandalwood base.",
    price:320000, disc:8, cat:"Beauty", sub:"Women's Perfumes", stock:22,
    img:965989, extra:[3059609], sales:87, ago:30 },

  { si:3, name:"La Mer Moisturizing Cream 60ml", nameAr:"كريم لا مير المرطب 60 مل",
    desc:"Miracle Broth luxury skincare. Visibly restores youthful radiance. Dermatologist tested.",
    price:195000, cat:"Beauty", sub:"Skincare", stock:15,
    img:1115128, extra:[965989], featured:true, sales:44, ago:20 },

  { si:3, name:"Urban Decay Naked Eyeshadow Palette", nameAr:"باليت ظل عيون أربان ديكاي نيكيد",
    desc:"12 neutral shades matte to shimmer. Highly pigmented, long-lasting. Day and evening looks.",
    price:78000, disc:25, cat:"Beauty", sub:"Makeup", stock:53,
    img:3373716, extra:[1115128,965989], featured:true, sales:221, ago:60 },

  { si:3, name:"Charlotte Tilbury Matte Revolution Lipstick", nameAr:"أحمر شفاه شارلوت تيلبري ماتي",
    desc:"High-impact matte finish. 12-hour lasting formula with jojoba and vitamin E. Non-drying.",
    price:42000, disc:20, cat:"Beauty", sub:"Makeup", stock:74,
    img:2533266, extra:[3373725], sales:156, ago:10 },

  { si:3, name:"Dyson Supersonic Hair Dryer", nameAr:"مجفف شعر دايسون سوبرسونيك",
    desc:"Intelligent heat control prevents extreme damage. 5 magnetic attachments included.",
    price:485000, disc:12, cat:"Beauty", sub:"Hair Care", stock:9,
    img:3993449, extra:[5069441], sales:29, ago:8 },

  { si:3, name:"Tom Ford Tobacco Vanille EDP 50ml", nameAr:"عطر توم فورد توباكو فانيل 50 مل",
    desc:"Warm, spicy, addictive. Tobacco, vanilla, tonka bean. Statement fragrance for colder weather.",
    price:375000, cat:"Beauty", sub:"Men's Perfumes", stock:12,
    img:965989, extra:[3059609], featured:true, sales:4, ago:1 },

  // ── SPORTS & FITNESS ──────────────────────────────────────────────────────
  { si:0, name:"Bowflex SelectTech Adjustable Dumbbells 5–32kg", nameAr:"دمبل بولفليكس قابل للتعديل 5-32 كيلو",
    desc:"Replaces 15 dumbbells in one. Quick-select dial. Compact for home gyms.",
    price:235000, disc:20, cat:"Sports & Fitness", sub:"Weights & Strength", stock:13,
    img:3775549, extra:[1552252], featured:true, sales:77, ago:25 },

  { si:0, name:"Premium Non-Slip Yoga Mat 6mm Thick", nameAr:"حصيرة يوغا بريميوم مضادة للانزلاق 6 مم",
    desc:"Eco-friendly natural rubber, alignment lines, superior grip. Includes carrying strap.",
    price:35000, disc:30, cat:"Sports & Fitness", sub:"Yoga & Pilates", stock:89,
    img:1552252, extra:[3775549], sales:245, ago:40 },

  { si:1, name:"Adidas Ultraboost 22 Running Shoes", nameAr:"حذاء أديداس أولترابوست 22 للجري",
    desc:"Responsive Boost midsole, Primeknit+ upper, Continental rubber outsole. Certified sustainable.",
    price:158000, disc:18, cat:"Sports & Fitness", sub:"Running", stock:27,
    img:2048584, extra:[1040945], sales:134, ago:35 },

  { si:1, name:"Resistance Bands Set — 5 Levels 5–100 lbs", nameAr:"طقم أربطة مقاومة — 5 مستويات",
    desc:"Latex-free, odor-free. For stretching, strength training and physical therapy.",
    price:18000, disc:40, cat:"Sports & Fitness", sub:"Fitness Accessories", stock:120,
    img:4498480, extra:[5638567], sales:378, ago:50 },

  // ── JEWELRY & WATCHES ─────────────────────────────────────────────────────
  { si:3, name:"Rolex Submariner Style Watch — Swiss Movement", nameAr:"ساعة رولكس سابمارينر — حركة سويسرية",
    desc:"High-grade Swiss movement, sapphire crystal glass, stainless steel case. Water resistant 300m.",
    price:142000, cat:"Jewelry", sub:"Watches", stock:8,
    img:1407305, extra:[190819,248077], featured:true, sales:19, ago:15 },

  { si:3, name:"18K Gold Diamond Pendant Necklace", nameAr:"قلادة ذهب عيار 18 بالماس",
    desc:"0.5 carat total diamond weight, 18K yellow gold chain, 45cm. Certificate of authenticity included.",
    price:580000, disc:5, cat:"Jewelry", sub:"Necklaces", stock:5,
    img:248077, extra:[1413420], sales:7, ago:20 },

  { si:3, name:"Sterling Silver Emerald Ring — Handcrafted", nameAr:"خاتم فضة بالزمرد — صنع يدوي",
    desc:"Sterling silver 925 with genuine emerald stone. Handcrafted by Syrian artisans. Sizes 6–9.",
    price:68000, disc:22, cat:"Jewelry", sub:"Rings", stock:16,
    img:1413420, extra:[248077], sales:34, ago:18 },

  { si:3, name:"Freshwater Pearl Bracelet — Classic White", nameAr:"سوار لؤلؤ طبيعي — أبيض كلاسيك",
    desc:"Genuine freshwater pearls, 7mm diameter, 14K gold clasp, 19cm length. Elegant gift box.",
    price:95000, disc:15, cat:"Jewelry", sub:"Bracelets", stock:21,
    img:5442799, extra:[3490348], sales:28, ago:12 },

  // ── BOOKS ─────────────────────────────────────────────────────────────────
  { si:2, name:"Atomic Habits — Arabic Edition", nameAr:"العادات الذرية — الطبعة العربية",
    desc:"James Clear's international bestseller. Tiny changes, remarkable results. Arabic translation.",
    price:12000, disc:20, cat:"Books", sub:"Self Development", stock:150,
    img:1907785, sales:421, ago:90 },

  { si:2, name:"Think & Grow Rich — Arabic Edition", nameAr:"فكّر وازدد ثراءً — الطبعة العربية",
    desc:"Napoleon Hill's classic on the philosophy of personal achievement and success.",
    price:9500, disc:15, cat:"Books", sub:"Business", stock:120,
    img:2908984, extra:[1370295], sales:287, ago:120 },

  // ── FOOD & SPECIALTY ──────────────────────────────────────────────────────
  { si:2, name:"Premium Syrian Olive Oil Extra Virgin 1L", nameAr:"زيت زيتون سوري ممتاز بكر ممتاز 1 لتر",
    desc:"Cold-pressed from Idlib mountain olives. Rich polyphenol content. Certified organic. Harvest 2024.",
    price:28000, cat:"Food & Grocery", sub:"Oils & Condiments", stock:200,
    img:1029757, sales:534, ago:25 },

  { si:2, name:"Damascus Rose Water — Pure Distilled 500ml", nameAr:"ماء ورد دمشق — مقطر نقي 500 مل",
    desc:"100% pure Damascus rose water. Skincare, cooking, desserts, aromatherapy. No preservatives.",
    price:15000, cat:"Food & Grocery", sub:"Specialty", stock:300,
    img:4021992, extra:[3764578], sales:312, ago:30 },
];

// ── main bootstrap function ───────────────────────────────────────────────────

export async function bootstrapDemoMarketplaceData(): Promise<void> {
  const client = await pool.connect();
  try {
    // ── Idempotency guard ─────────────────────────────────────────────────────
    const { rows: countRows } = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM products`
    );
    const existingCount = parseInt(countRows[0]?.n ?? "0", 10);
    if (existingCount >= PRODUCTS.length) {
      logger.info(
        { products: existingCount },
        "Demo marketplace data already present — skipping bootstrap"
      );
      return;
    }

    logger.info("Bootstrapping demo marketplace data (fresh database)...");

    const PASSWORD_HASH = await bcrypt.hash("00Amer00", 12);

    // ── 1. Sellers + seller applications ─────────────────────────────────────
    const sellerIds: number[] = [];
    for (const s of SELLERS) {
      // Upsert user
      const userRes = await client.query<{ id: number }>(
        `INSERT INTO users
           (email, name, phone, password_hash, role, is_verified, account_status,
            verification_level, trust_score)
         VALUES ($1,$2,$3,$4,'seller',true,'active','basic',$5)
         ON CONFLICT (email) DO UPDATE SET role='seller'
         RETURNING id`,
        [s.email, s.name, s.phone, PASSWORD_HASH, Math.floor(Math.random() * 30) + 60]
      );
      const uid = userRes.rows[0]!.id;
      sellerIds.push(uid);

      // Approved seller application
      await client.query(
        `INSERT INTO seller_applications
           (user_id, store_name, store_name_ar, phone, contact_phone, city, category,
            categories, description, description_ar, store_slug, store_logo, store_banner,
            accent_color, status, reviewed_at, reviewed_by_id,
            shipping_policy, return_policy, warranty_policy)
         SELECT $1,$2,$3,$4,$4,$5,$6,$7::text[],$8,$9,$10,$11,$12,$13,
                 'approved',NOW(),1,
                 'Free shipping on orders over 50,000 ل.س. Delivery within 3–5 business days.',
                 'Returns accepted within 14 days of delivery for unused items in original packaging.',
                 '1 year warranty on electronics. 3 months on accessories.'
         WHERE NOT EXISTS (SELECT 1 FROM seller_applications WHERE user_id = $1)`,
        [
          uid, s.storeName, s.storeNameAr, s.phone, s.city, s.category,
          pgArr(s.categories as unknown as string[]),
          s.description, s.descriptionAr, s.slug, s.logo, s.banner, s.accent,
        ]
      );
    }
    logger.info({ count: sellerIds.length }, "Demo sellers bootstrapped");

    // ── 2. Customers ──────────────────────────────────────────────────────────
    const customerIds: number[] = [];
    for (const c of CUSTOMERS) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO users (email, name, phone, password_hash, role, is_verified, account_status)
         VALUES ($1,$2,$3,$4,'customer',false,'active')
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
         RETURNING id`,
        [c.email, c.name, c.phone, PASSWORD_HASH]
      );
      customerIds.push(res.rows[0]!.id);
    }
    logger.info({ count: customerIds.length }, "Demo customers bootstrapped");

    // ── 3. Products ───────────────────────────────────────────────────────────
    const productIds: number[] = [];
    for (const p of PRODUCTS) {
      const sellerId = sellerIds[p.si]!;
      const mainImg = P(p.img, 800, 600);
      const allImgs = [mainImg, ...(p.extra ?? []).map((id) => P(id, 800, 600))];
      const imgUrlsLiteral = pgArr(allImgs);
      const createdAt = daysAgo(p.ago ?? 30).toISOString();
      const searchTok = `${p.name} ${p.nameAr} ${p.cat} ${p.sub ?? ""}`.toLowerCase();

      const res = await client.query<{ id: number }>(
        `INSERT INTO products
           (seller_id, name, name_ar, description, price, discount_percent, category,
            subcategory, stock, image_url, image_urls, featured, sales_count,
            created_at, search_tokens)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[],$12,$13,$14,$15)
         RETURNING id`,
        [
          sellerId, p.name, p.nameAr, p.desc, p.price, p.disc ?? null,
          p.cat, p.sub ?? null, p.stock, mainImg, imgUrlsLiteral,
          p.featured ?? false, p.sales ?? 0, createdAt, searchTok,
        ]
      );
      productIds.push(res.rows[0]!.id);
    }
    logger.info({ count: productIds.length }, "Demo products bootstrapped");

    // ── 4. Orders + order items + status history ──────────────────────────────
    const statuses = [
      "delivered","delivered","delivered","delivered",
      "shipped","processing","confirmed","pending","cancelled",
    ];
    const cities = ["Damascus","Aleppo","Homs","Latakia"];
    const addrs = [
      "شارع الثورة، حي الميدان، دمشق",
      "حي الأزهرية، طريق الميدان، حلب",
      "شارع الجلاء، حمص",
      "حي الزاهرة، اللاذقية",
    ];

    // Get a few zone ids for realistic orders
    const zoneRes = await client.query<{ id: number }>(
      `SELECT id FROM delivery_zones ORDER BY id LIMIT 12`
    );
    const zoneIds = zoneRes.rows.map((r) => r.id);

    const orderIds: number[] = [];
    const ORDER_COUNT = 14;
    for (let i = 0; i < ORDER_COUNT; i++) {
      const customerId = customerIds[i % customerIds.length]!;
      const status = statuses[i % statuses.length]!;
      const pi = (i * 3) % productIds.length;
      const productId = productIds[pi]!;
      const p = PRODUCTS[pi]!;
      const sellerId = sellerIds[p.si]!;
      const qty = (i % 3) + 1;
      const unitPrice = p.price;
      const deliveryFee = 1500;
      const total = unitPrice * qty + deliveryFee;
      const zoneId = zoneIds[i % zoneIds.length] ?? null;
      const createdAt = daysAgo(ORDER_COUNT - i).toISOString();

      const orderRes = await client.query<{ id: number }>(
        `INSERT INTO orders
           (customer_id, status, total, delivery_fee, zone_id,
            city, shipping_address, created_at, updated_at)
         VALUES ($1,$2::order_status,$3,$4,$5,$6,$7,$8,$8)
         RETURNING id`,
        [
          customerId, status, total, deliveryFee, zoneId,
          cities[i % cities.length], addrs[i % addrs.length], createdAt,
        ]
      );
      const oid = orderRes.rows[0]!.id;
      orderIds.push(oid);

      await client.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, quantity, unit_price, seller_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [oid, productId, p.name, qty, unitPrice, sellerId]
      );

      await client.query(
        `INSERT INTO order_status_history (order_id, to_status, created_at)
         VALUES ($1,$2,$3)`,
        [oid, status, createdAt]
      );
    }
    logger.info({ count: orderIds.length }, "Demo orders bootstrapped");

    // ── 5. Product reviews ────────────────────────────────────────────────────
    const reviewTexts = [
      { en: "Excellent product, exactly as described!", ar: "منتج ممتاز، بالضبط كما هو موصوف!" },
      { en: "Very good quality, fast delivery.", ar: "جودة جيدة جداً، توصيل سريع." },
      { en: "Happy with my purchase, will buy again.", ar: "سعيد بمشتراي، سأشتري مرة أخرى." },
      { en: "Great value for the price.", ar: "قيمة رائعة مقابل السعر." },
      { en: "Product is as shown in pictures.", ar: "المنتج كما هو في الصور." },
      { en: "Good packaging, arrived safely.", ar: "تغليف جيد، وصل بأمان." },
      { en: "Highly recommend this seller.", ar: "أنصح بهذا البائع." },
      { en: "Perfect gift idea, very pleased.", ar: "فكرة هدية مثالية، راضٍ جداً." },
    ];
    const ratings = [5, 5, 4, 5, 4, 3, 5, 4];
    let reviewCount = 0;
    for (let i = 0; i < Math.min(40, productIds.length); i++) {
      const pid = productIds[i]!;
      const customerId = customerIds[i % customerIds.length]!;
      const rt = reviewTexts[i % reviewTexts.length]!;
      const rating = ratings[i % ratings.length]!;
      const createdAt = daysAgo(Math.floor(Math.random() * 30) + 1).toISOString();
      await client.query(
        `INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [pid, customerId, rating, rt.ar, createdAt]
      );
      reviewCount++;
    }
    logger.info({ count: reviewCount }, "Demo product reviews bootstrapped");

    // ── 6. Seller reviews ─────────────────────────────────────────────────────
    const sellerReviewTexts = [
      "متجر ممتاز! تعامل سريع وشحن في الوقت المحدد.",
      "بائع موثوق، المنتجات أصلية 100%.",
      "خدمة عملاء رائعة، سأتعامل مجدداً.",
      "تجربة شراء رائعة، التغليف محترف.",
      "سعر مناسب وجودة عالية.",
      "توصيل سريع جداً، شكراً للمتجر.",
      "منتجات فاخرة بأسعار معقولة.",
      "أنصح الجميع بالتعامل مع هذا المتجر.",
    ];
    let sReviewCount = 0;
    for (let i = 0; i < SELLERS.length * 2; i++) {
      const sellerId = sellerIds[i % sellerIds.length]!;
      const customerId = customerIds[(i + 1) % customerIds.length]!;
      const rating = 4 + (i % 2);
      const createdAt = daysAgo(i * 4 + 2).toISOString();
      await client.query(
        `INSERT INTO seller_reviews
           (seller_id, customer_id, communication_rating, shipping_rating, professionalism_rating, comment, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (seller_id, customer_id) DO NOTHING`,
        [sellerId, customerId, rating, rating, rating, sellerReviewTexts[i % sellerReviewTexts.length], createdAt]
      );
      sReviewCount++;
    }
    logger.info({ count: sReviewCount }, "Demo seller reviews bootstrapped");

    // ── 7. Wishlist items ─────────────────────────────────────────────────────
    const wishlistPairs = [
      [0, 0],[0, 3],[0, 9],[1, 1],[1, 24],[1, 35],
      [2, 12],[2, 18],[3, 0],[3, 6],[3, 30],[3, 36],
    ];
    let wlCount = 0;
    for (const [ci, pi] of wishlistPairs) {
      const userId = customerIds[ci!]!;
      const productId = productIds[pi!]!;
      if (!userId || !productId) continue;
      await client.query(
        `INSERT INTO wishlists (user_id, product_id)
         VALUES ($1,$2)
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, productId]
      );
      wlCount++;
    }
    logger.info({ count: wlCount }, "Demo wishlist items bootstrapped");

    // ── 8. Store follows ──────────────────────────────────────────────────────
    // store_follows table uses seller_id = user_id of the seller (not seller_applications.id)
    let followCount = 0;
    for (let i = 0; i < 8; i++) {
      const followerId = customerIds[i % customerIds.length]!;
      const sellerId = sellerIds[i % sellerIds.length]!;
      try {
        await client.query(
          `INSERT INTO store_follows (follower_id, seller_id, created_at)
           VALUES ($1,$2,NOW())
           ON CONFLICT DO NOTHING`,
          [followerId, sellerId]
        );
        followCount++;
      } catch {
        // store_follows table may have a different schema — non-fatal
      }
    }
    logger.info({ count: followCount }, "Demo store follows bootstrapped");

    logger.info(
      {
        sellers: sellerIds.length,
        customers: customerIds.length,
        products: productIds.length,
        orders: orderIds.length,
      },
      "✅ Demo marketplace bootstrap complete"
    );
  } catch (err) {
    // Non-fatal — log and allow server to start without demo data
    logger.error({ err }, "Demo marketplace bootstrap failed (non-fatal)");
  } finally {
    client.release();
  }
}
