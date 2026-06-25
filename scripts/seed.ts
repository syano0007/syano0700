/**
 * SYANO Marketplace — Comprehensive Seed Script
 * Run: cd /home/runner/workspace && npx tsx --tsconfig artifacts/api-server/tsconfig.json scripts/seed.ts
 */

import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const P = (id: number, w = 800, h = 600): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;

/** Convert a JS string array to a PostgreSQL array literal e.g. '{"a","b"}' */
const pgTextArr = (arr: string[]): string =>
  `{${arr.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;

// Execute a raw SQL statement and return the rows array
async function exec(query: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  const result = await db.execute(query) as unknown;
  // drizzle pg returns { rows: [...] } or directly an array
  if (result && typeof result === "object" && "rows" in (result as object)) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return [];
}

async function run(): Promise<void> {
  console.log("🌱 Starting SYANO seed...\n");

  const PASSWORD_HASH = await bcrypt.hash("00Amer00", 12);

  // ── 1. SELLERS ──────────────────────────────────────────────────────────────
  console.log("Creating seller accounts...");

  const sellers = [
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
      description: "Premium electronics and smart devices. Official distributor of top brands in Syria.",
      descriptionAr: "إلكترونيات متميزة وأجهزة ذكية. موزع رسمي لأفضل العلامات التجارية في سوريا.",
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
      description: "Trendy fashion for men and women. Latest styles from local and international designers.",
      descriptionAr: "أزياء عصرية للرجال والنساء. أحدث تصاميم المصممين المحليين والدوليين.",
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
      description: "Beautiful home decor and furniture. Transform your home with our curated collection.",
      descriptionAr: "ديكور منزلي وأثاث جميل. حوّل منزلك مع مجموعتنا المختارة بعناية.",
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
      description: "Premium perfumes, cosmetics and skincare. Your destination for authentic beauty.",
      descriptionAr: "عطور وتجميل وعناية بالبشرة. وجهتك للجمال الأصيل.",
      logo: P(3059609, 200, 200),
      banner: P(3059609, 1200, 400),
      accent: "#7c3aed",
    },
  ];

  const sellerIds: number[] = [];
  for (const s of sellers) {
    // Check existing
    const existing = await exec(sql`SELECT id FROM users WHERE email = ${s.email} LIMIT 1`);
    let uid: number;
    if (existing.length > 0) {
      uid = existing[0]!.id as number;
      console.log(`  ↩ Seller exists: ${s.storeName} (id=${uid})`);
    } else {
      const rows = await exec(sql`
        INSERT INTO users (email, name, phone, password_hash, role, is_verified, account_status, verification_level, trust_score)
        VALUES (${s.email}, ${s.name}, ${s.phone}, ${PASSWORD_HASH}, 'seller', true, 'active', 'basic', ${Math.floor(Math.random() * 30) + 60})
        RETURNING id
      `);
      uid = rows[0]!.id as number;
      console.log(`  ✓ Seller created: ${s.storeName} (id=${uid})`);
    }
    sellerIds.push(uid);

    // Seller application
    const appExists = await exec(sql`SELECT id FROM seller_applications WHERE user_id = ${uid} AND status = 'approved' LIMIT 1`);
    if (appExists.length === 0) {
      const catArr = pgTextArr(s.categories);
      await exec(sql`
        INSERT INTO seller_applications
          (user_id, store_name, store_name_ar, phone, contact_phone, city, category, categories,
           description, description_ar, store_slug, store_logo, store_banner, accent_color,
           status, reviewed_at, reviewed_by_id,
           shipping_policy, return_policy, warranty_policy)
        VALUES (
          ${uid}, ${s.storeName}, ${s.storeNameAr}, ${s.phone}, ${s.phone}, ${s.city},
          ${s.category}, ${catArr}::text[], ${s.description}, ${s.descriptionAr},
          ${s.slug}, ${s.logo}, ${s.banner}, ${s.accent},
          'approved', NOW(), 1,
          'Free shipping on orders over 50,000 ل.س. Delivery within 3 to 5 business days.',
          'Returns accepted within 14 days of delivery for unused items in original packaging.',
          '1 year warranty on electronics. 3 months on accessories.'
        )
      `);
    }
  }

  // ── 2. CUSTOMERS ────────────────────────────────────────────────────────────
  console.log("\nCreating customer accounts...");

  const customers = [
    { email: "mohammed@syano.test", name: "Mohammed Al-Masri", phone: "0922200001" },
    { email: "sara@syano.test",     name: "Sara Khalil",       phone: "0922200002" },
    { email: "omar@syano.test",     name: "Omar Haddad",       phone: "0922200003" },
    { email: "layla@syano.test",    name: "Layla Nasser",      phone: "0922200004" },
  ];

  const customerIds: number[] = [];
  for (const c of customers) {
    const existing = await exec(sql`SELECT id FROM users WHERE email = ${c.email} LIMIT 1`);
    let uid: number;
    if (existing.length > 0) {
      uid = existing[0]!.id as number;
    } else {
      const rows = await exec(sql`
        INSERT INTO users (email, name, phone, password_hash, role, is_verified, account_status)
        VALUES (${c.email}, ${c.name}, ${c.phone}, ${PASSWORD_HASH}, 'customer', false, 'active')
        RETURNING id
      `);
      uid = rows[0]!.id as number;
    }
    customerIds.push(uid);
    console.log(`  ✓ Customer: ${c.name} (id=${uid})`);
  }

  // ── 3. PRODUCTS ─────────────────────────────────────────────────────────────
  console.log("\nCreating products...");

  interface ProductSpec {
    si: number;        // seller index
    name: string;
    nameAr: string;
    desc: string;
    price: number;
    disc?: number;     // discount_percent
    cat: string;
    sub?: string;
    stock: number;
    img: number;       // pexels id
    extra?: number[];  // extra pexels ids
    featured?: boolean;
    sales?: number;
    daysAgo?: number;
  }

  const productSpecs: ProductSpec[] = [
    // ── ELECTRONICS (seller 0: Ahmad Electronics) ─────────────────────────
    { si:0, name:"Sony WH-1000XM5 Wireless Headphones", nameAr:"سماعات سوني WH-1000XM5 اللاسلكية",
      desc:"Industry-leading noise cancellation with 30-hour battery life. Crystal-clear audio for music and calls.",
      price:185000, disc:20, cat:"Electronics", sub:"Headphones", stock:24,
      img:1649771, extra:[3587477,3394650], featured:true, sales:142, daysAgo:45 },

    { si:0, name:"Samsung Galaxy S24 Ultra 256GB", nameAr:"سامسونج جالاكسي S24 ألترا 256 جيجا",
      desc:"200MP camera, S-Pen included, 6.8\" Dynamic AMOLED display. The ultimate Android flagship.",
      price:890000, disc:8, cat:"Electronics", sub:"Smartphones", stock:15,
      img:699122, extra:[5632399], featured:true, sales:89, daysAgo:20 },

    { si:0, name:"Apple MacBook Pro 14\" M3 Pro", nameAr:"آبل ماك بوك برو 14 إنش M3 برو",
      desc:"Apple M3 Pro chip, 18-hour battery, Liquid Retina XDR display. Built for professionals.",
      price:1450000, cat:"Electronics", sub:"Laptops", stock:8,
      img:18105, extra:[1181244], featured:false, sales:31, daysAgo:10 },

    { si:0, name:"Apple Watch Series 9 GPS 45mm", nameAr:"ساعة آبل سيريز 9 GPS 45 مم",
      desc:"Advanced health monitoring, crash detection, Double Tap gesture. 18-hour battery.",
      price:420000, disc:15, cat:"Electronics", sub:"Smartwatches", stock:19,
      img:190819, extra:[1407305], featured:true, sales:76, daysAgo:30 },

    { si:0, name:"Sony Alpha A7 IV Mirrorless Camera", nameAr:"كاميرا سوني ألفا A7 IV بدون مرآة",
      desc:"33MP full-frame sensor, 4K 60fps video, real-time eye tracking AF.",
      price:1250000, disc:10, cat:"Electronics", sub:"Cameras", stock:6,
      img:1444416, extra:[225157], featured:false, sales:18, daysAgo:15 },

    { si:0, name:"Apple AirPods Pro 3rd Generation", nameAr:"آبل إيربودز برو الجيل الثالث",
      desc:"Active noise cancellation, adaptive audio, H2 chip, 6-hour listening time. Sweat resistant.",
      price:295000, disc:18, cat:"Electronics", sub:"Earbuds", stock:42,
      img:3587477, extra:[1649771], featured:true, sales:203, daysAgo:60 },

    { si:0, name:"iPad Pro 12.9\" M2 Wi-Fi 256GB", nameAr:"آيباد برو 12.9 إنش M2 واي فاي 256 جيجا",
      desc:"M2 chip, Liquid Retina XDR display, ProMotion 120Hz, Face ID. For creative professionals.",
      price:920000, cat:"Electronics", sub:"Tablets", stock:11,
      img:577585, extra:[1181244], featured:false, sales:27, daysAgo:8 },

    { si:0, name:"JBL Charge 5 Portable Bluetooth Speaker", nameAr:"سماعة JBL Charge 5 بلوتوث محمولة",
      desc:"Powerful sound with deep bass, IP67 waterproof, 20-hour playtime. Built-in power bank.",
      price:145000, disc:25, cat:"Electronics", sub:"Speakers", stock:33,
      img:3945683, extra:[3394650], featured:false, sales:118, daysAgo:90 },

    { si:0, name:"Samsung 65\" 4K QLED Smart TV", nameAr:"تلفزيون سامسونج 65 بوصة QLED 4K ذكي",
      desc:"Quantum Dot technology, 4K AI upscaling, HDR10+, built-in Alexa. 120Hz refresh rate.",
      price:1850000, disc:8, cat:"Electronics", sub:"TVs", stock:4,
      img:5632399, extra:[1649771], featured:true, sales:5, daysAgo:3 },

    // ── FASHION (seller 1: Nour Fashion) ──────────────────────────────────
    { si:1, name:"Floral Maxi Dress — Summer 2025 Collection", nameAr:"فستان ماكسي بالزهور — كوليكشن صيف 2025",
      desc:"Lightweight chiffon with vibrant floral print. Perfect for outings, beach, or casual events.",
      price:65000, disc:30, cat:"Fashion", sub:"Women's Dresses", stock:58,
      img:1926769, extra:[1536619,1152077], featured:true, sales:267, daysAgo:14 },

    { si:1, name:"Premium Leather Jacket — Men's Classic Biker", nameAr:"جاكيت جلد فاخر للرجال — كلاسيك بايكر",
      desc:"Genuine leather jacket with quilted lining. Classic biker style with zip pockets.",
      price:175000, disc:15, cat:"Fashion", sub:"Men's Outerwear", stock:22,
      img:2529148, extra:[1152077], featured:true, sales:94, daysAgo:25 },

    { si:1, name:"Nike Air Max 270 Sneakers", nameAr:"حذاء نايك إير ماكس 270",
      desc:"Iconic Air Max sole for all-day comfort. Breathable mesh upper. Available sizes 38–46.",
      price:135000, disc:20, cat:"Fashion", sub:"Sneakers", stock:45,
      img:1040945, extra:[2048584], featured:true, sales:312, daysAgo:50 },

    { si:1, name:"Designer Genuine Leather Handbag", nameAr:"حقيبة يد جلد حقيقي مصمم",
      desc:"Premium genuine leather with gold hardware. Spacious interior with multiple compartments.",
      price:245000, cat:"Fashion", sub:"Bags & Purses", stock:14,
      img:1152077, extra:[2905238], featured:false, sales:41, daysAgo:12 },

    { si:1, name:"Men's Slim-Fit Chino Pants", nameAr:"بنطلون شينو سليم فيت للرجال",
      desc:"Stretch cotton chinos for all-day comfort. Available in navy, khaki, and olive. Machine washable.",
      price:45000, disc:35, cat:"Fashion", sub:"Men's Pants", stock:86,
      img:1536619, extra:[1152077], featured:false, sales:189, daysAgo:20 },

    { si:1, name:"Women's Stiletto Heels — Party Collection", nameAr:"حذاء كعب عالٍ للسيدات — كوليكشن حفلات",
      desc:"Elegant stiletto heels with ankle strap. Cushioned insole. Black, nude, and red.",
      price:78000, disc:22, cat:"Fashion", sub:"Women's Shoes", stock:31,
      img:2529148, extra:[1926769], featured:false, sales:73, daysAgo:18 },

    { si:1, name:"Nida Fabric Abaya — Classic Black", nameAr:"عباءة قماش نيدا — أسود كلاسيك",
      desc:"Classic cut abaya in premium nida fabric. Front zipper, side pockets. Navy and dark green available.",
      price:55000, cat:"Fashion", sub:"Abayas", stock:95,
      img:1926769, extra:[1536619], featured:false, sales:3, daysAgo:2 },

    // ── HOME & LIVING (seller 2: Beit Al-Nour) ────────────────────────────
    { si:2, name:"Modern Scandinavian 3-Seater Sofa", nameAr:"أريكة سكاندينافية عصرية ثلاثية المقاعد",
      desc:"Durable fabric upholstery, solid wood legs, removable covers. Available in 5 colors.",
      price:680000, disc:12, cat:"Home & Living", sub:"Furniture", stock:7,
      img:1643383, extra:[1279107,276528], featured:true, sales:23, daysAgo:30 },

    { si:2, name:"Bamboo Floor Lamp — Nordic Style 165cm", nameAr:"مصباح أرضي بامبو نوردك 165 سم",
      desc:"Natural bamboo frame with linen shade. Warm LED light included. Perfect for living rooms.",
      price:95000, disc:20, cat:"Home & Living", sub:"Lighting", stock:28,
      img:1279107, extra:[1643383], featured:false, sales:67, daysAgo:22 },

    { si:2, name:"Premium Ceramic Dinner Set — 24 Pieces", nameAr:"طقم عشاء سيراميك ممتاز — 24 قطعة",
      desc:"White ceramic with gold rim. 6 dinner plates, 6 salad plates, 6 bowls, 6 cups. Microwave safe.",
      price:125000, disc:28, cat:"Home & Living", sub:"Kitchen & Dining", stock:19,
      img:243757, extra:[1643383], featured:true, sales:45, daysAgo:40 },

    { si:2, name:"Persian-Style Area Rug 200×300 cm", nameAr:"سجادة على الطراز الفارسي 200×300 سم",
      desc:"Machine-woven geometric patterns in burgundy and gold. Non-slip backing. Easy to clean.",
      price:345000, disc:15, cat:"Home & Living", sub:"Rugs & Carpets", stock:12,
      img:1571458, extra:[276528], featured:false, sales:34, daysAgo:15 },

    { si:2, name:"Abstract Canvas Wall Art Set — 3 Pieces", nameAr:"طقم لوحات جدارية تجريدية — 3 قطع",
      desc:"Modern abstract art on premium canvas. 3 coordinated prints. Ready to hang.",
      price:68000, disc:40, cat:"Home & Living", sub:"Wall Decor", stock:41,
      img:1643383, extra:[1279107], featured:true, sales:88, daysAgo:7 },

    { si:2, name:"Stainless Steel Cookware Set — 8 Pieces", nameAr:"طقم أواني طبخ ستانلس ستيل — 8 قطع",
      desc:"Heavy-duty 18/10 stainless steel, tri-ply construction. Oven safe to 260°C. Dishwasher safe.",
      price:195000, disc:17, cat:"Home & Living", sub:"Kitchen & Dining", stock:16,
      img:1438761, extra:[243757], featured:false, sales:52, daysAgo:35 },

    { si:2, name:"Memory Foam Orthopedic Pillow", nameAr:"وسادة إسفنج ذاكرة علاجية",
      desc:"Ergonomic cervical support with cooling gel cover. Medium firmness. Hypoallergenic. Washable cover.",
      price:42000, disc:30, cat:"Home & Living", sub:"Bedding", stock:67,
      img:1571458, featured:false, sales:134, daysAgo:5 },

    // ── BEAUTY (seller 3: Hana Beauty) ────────────────────────────────────
    { si:3, name:"Dior Sauvage Eau de Parfum 100ml", nameAr:"عطر ديور سوفاج أو دو بارفان 100 مل",
      desc:"Iconic raw freshness with noble salted woody base. Top notes of bergamot and spice.",
      price:285000, disc:10, cat:"Beauty", sub:"Men's Perfumes", stock:38,
      img:3059609, extra:[965989], featured:true, sales:198, daysAgo:45 },

    { si:3, name:"Chanel N°5 Eau de Parfum 50ml", nameAr:"عطر شانيل No.5 أو دو بارفان 50 مل",
      desc:"The world's most iconic fragrance. Floral-aldehyde with jasmine, rose, sandalwood base.",
      price:320000, disc:8, cat:"Beauty", sub:"Women's Perfumes", stock:22,
      img:965989, extra:[3059609], featured:false, sales:87, daysAgo:30 },

    { si:3, name:"La Mer Moisturizing Cream 60ml", nameAr:"كريم لا مير المرطب 60 مل",
      desc:"Miracle Broth luxury skincare. Visibly restores youthful radiance. Dermatologist tested.",
      price:195000, cat:"Beauty", sub:"Skincare", stock:15,
      img:1115128, extra:[965989], featured:true, sales:44, daysAgo:20 },

    { si:3, name:"Urban Decay Naked Eyeshadow Palette", nameAr:"باليت ظل عيون أربان ديكاي نيكيد",
      desc:"12 neutral shades matte to shimmer. Highly pigmented, long-lasting. Day and evening looks.",
      price:78000, disc:25, cat:"Beauty", sub:"Makeup", stock:53,
      img:3373716, extra:[1115128,965989], featured:true, sales:221, daysAgo:60 },

    { si:3, name:"Charlotte Tilbury Matte Revolution Lipstick", nameAr:"أحمر شفاه شارلوت تيلبري ماتي",
      desc:"High-impact matte finish. 12-hour lasting formula with jojoba and vitamin E. Non-drying.",
      price:42000, disc:20, cat:"Beauty", sub:"Makeup", stock:74,
      img:1115128, extra:[3373716], featured:false, sales:156, daysAgo:10 },

    { si:3, name:"Dyson Supersonic Hair Dryer", nameAr:"مجفف شعر دايسون سوبرسونيك",
      desc:"Intelligent heat control prevents extreme damage. 5 magnetic attachments included.",
      price:485000, disc:12, cat:"Beauty", sub:"Hair Care", stock:9,
      img:3059609, featured:false, sales:29, daysAgo:8 },

    { si:3, name:"Tom Ford Tobacco Vanille EDP 50ml", nameAr:"عطر توم فورد توباكو فانيل 50 مل",
      desc:"Warm, spicy, addictive. Tobacco, vanilla, tonka bean. Statement fragrance for colder weather.",
      price:375000, cat:"Beauty", sub:"Men's Perfumes", stock:12,
      img:965989, extra:[3059609], featured:true, sales:4, daysAgo:1 },

    // ── SPORTS & FITNESS ──────────────────────────────────────────────────
    { si:0, name:"Bowflex SelectTech Adjustable Dumbbells 5–32kg", nameAr:"دمبل بولفليكس قابل للتعديل 5-32 كيلو",
      desc:"Replaces 15 dumbbells in one. Quick-select dial. Compact for home gyms.",
      price:235000, disc:20, cat:"Sports & Fitness", sub:"Weights & Strength", stock:13,
      img:3775549, extra:[1552252], featured:true, sales:77, daysAgo:25 },

    { si:0, name:"Premium Non-Slip Yoga Mat 6mm Thick", nameAr:"حصيرة يوغا بريميوم مضادة للانزلاق 6 مم",
      desc:"Eco-friendly natural rubber, alignment lines, superior grip. Includes carrying strap.",
      price:35000, disc:30, cat:"Sports & Fitness", sub:"Yoga & Pilates", stock:89,
      img:1552252, extra:[3775549], featured:false, sales:245, daysAgo:40 },

    { si:1, name:"Adidas Ultraboost 22 Running Shoes", nameAr:"حذاء أديداس أولترابوست 22 للجري",
      desc:"Responsive Boost midsole, Primeknit+ upper, Continental rubber outsole. Certified sustainable.",
      price:158000, disc:18, cat:"Sports & Fitness", sub:"Running", stock:27,
      img:2048584, extra:[1040945], featured:false, sales:134, daysAgo:35 },

    { si:1, name:"Resistance Bands Set — 5 Levels 5–100 lbs", nameAr:"طقم أربطة مقاومة — 5 مستويات",
      desc:"Latex-free, odor-free. For stretching, strength training and physical therapy.",
      price:18000, disc:40, cat:"Sports & Fitness", sub:"Fitness Accessories", stock:120,
      img:3775549, featured:false, sales:378, daysAgo:50 },

    // ── JEWELRY & WATCHES ─────────────────────────────────────────────────
    { si:3, name:"Rolex Submariner Style Watch — Swiss Movement", nameAr:"ساعة رولكس سابمارينر — حركة سويسرية",
      desc:"High-grade Swiss movement, sapphire crystal glass, stainless steel case. Water resistant 300m.",
      price:142000, cat:"Jewelry", sub:"Watches", stock:8,
      img:1407305, extra:[190819,248077], featured:true, sales:19, daysAgo:15 },

    { si:3, name:"18K Gold Diamond Pendant Necklace", nameAr:"قلادة ذهب عيار 18 بالماس",
      desc:"0.5 carat total diamond weight, 18K yellow gold chain, 45cm. Certificate of authenticity included.",
      price:580000, disc:5, cat:"Jewelry", sub:"Necklaces", stock:5,
      img:248077, extra:[1413420], featured:false, sales:7, daysAgo:20 },

    { si:3, name:"Sterling Silver Emerald Ring — Handcrafted", nameAr:"خاتم فضة بالزمرد — صنع يدوي",
      desc:"Sterling silver 925 with genuine emerald stone. Handcrafted by Syrian artisans. Sizes 6–9.",
      price:68000, disc:22, cat:"Jewelry", sub:"Rings", stock:16,
      img:1413420, extra:[248077], featured:false, sales:34, daysAgo:18 },

    { si:3, name:"Freshwater Pearl Bracelet — Classic White", nameAr:"سوار لؤلؤ طبيعي — أبيض كلاسيك",
      desc:"Genuine freshwater pearls, 7mm diameter, 14K gold clasp, 19cm length. Elegant gift box.",
      price:95000, disc:15, cat:"Jewelry", sub:"Bracelets", stock:21,
      img:248077, extra:[1407305], featured:false, sales:28, daysAgo:12 },

    // ── BOOKS ─────────────────────────────────────────────────────────────
    { si:2, name:"Atomic Habits — Arabic Edition", nameAr:"العادات الذرية — الطبعة العربية",
      desc:"James Clear's international bestseller. Tiny changes, remarkable results. Arabic translation.",
      price:12000, disc:20, cat:"Books", sub:"Self Development", stock:150,
      img:1907785, featured:false, sales:421, daysAgo:90 },

    { si:2, name:"Think & Grow Rich — Arabic Edition", nameAr:"فكّر وازدد ثراءً — الطبعة العربية",
      desc:"Napoleon Hill's classic on the philosophy of personal achievement and success.",
      price:9500, disc:15, cat:"Books", sub:"Business", stock:120,
      img:1907785, featured:false, sales:287, daysAgo:120 },

    // ── FOOD & SPECIALTY ──────────────────────────────────────────────────
    { si:2, name:"Premium Syrian Olive Oil Extra Virgin 1L", nameAr:"زيت زيتون سوري ممتاز بكر ممتاز 1 لتر",
      desc:"Cold-pressed from Idlib mountain olives. Rich polyphenol content. Certified organic. Harvest 2024.",
      price:28000, cat:"Food & Grocery", sub:"Oils & Condiments", stock:200,
      img:1029757, featured:false, sales:534, daysAgo:25 },

    { si:2, name:"Damascus Rose Water — Pure Distilled 500ml", nameAr:"ماء ورد دمشق — مقطر نقي 500 مل",
      desc:"100% pure Damascus rose water. Skincare, cooking, desserts, aromatherapy. No preservatives.",
      price:15000, cat:"Food & Grocery", sub:"Specialty", stock:300,
      img:3059609, featured:false, sales:312, daysAgo:30 },
  ];

  const productIds: number[] = [];
  const existingProds = await exec(sql`SELECT id FROM products ORDER BY id ASC`);
  if (existingProds.length >= productSpecs.length) {
    console.log(`  ↩ ${existingProds.length} products already exist — skipping product creation`);
    existingProds.forEach((r) => productIds.push(r.id as number));
  } else {
    for (const p of productSpecs) {
      const sellerId = sellerIds[p.si]!;
      const mainImg = P(p.img, 800, 600);
      const allImgs = [mainImg, ...(p.extra ?? []).map((id) => P(id, 800, 600))];
      const createdAt = new Date(Date.now() - (p.daysAgo ?? 30) * 86400_000).toISOString();
      const searchTok = `${p.name} ${p.nameAr} ${p.cat} ${p.sub ?? ""}`.toLowerCase();

      const imgArr = pgTextArr(allImgs);
      const rows = await exec(sql`
        INSERT INTO products
          (seller_id, name, name_ar, description, price, discount_percent, category, subcategory,
           stock, image_url, image_urls, featured, sales_count, created_at, search_tokens)
        VALUES (
          ${sellerId}, ${p.name}, ${p.nameAr}, ${p.desc},
          ${p.price}, ${p.disc ?? null}, ${p.cat}, ${p.sub ?? null},
          ${p.stock}, ${mainImg}, ${imgArr}::text[], ${p.featured ?? false},
          ${p.sales ?? 0}, ${createdAt}, ${searchTok}
        ) RETURNING id
      `);
      const pid = rows[0]!.id as number;
      productIds.push(pid);
      console.log(`  ✓ #${pid} ${p.name.substring(0, 50)}`);
    }
  }

  // ── 4. ORDERS ───────────────────────────────────────────────────────────────
  console.log("\nCreating orders...");

  const statuses = ["delivered","delivered","delivered","delivered","shipped","processing","confirmed","pending","cancelled"];
  const cities = ["Damascus","Aleppo","Homs","Latakia"];
  const addrs  = [
    "شارع الثورة، حي الميدان، دمشق",
    "حي الأزهرية، طريق الميدان، حلب",
    "شارع الجلاء، حمص",
    "حي الزاهرة، اللاذقية",
  ];

  const zoneRows = await exec(sql`SELECT id FROM delivery_zones ORDER BY id LIMIT 12`);
  const zoneIds = zoneRows.map((r) => r.id as number);

  const orderIds: number[] = [];
  for (let i = 0; i < 14; i++) {
    const customerId = customerIds[i % customerIds.length]!;
    const status = statuses[i % statuses.length]!;
    const pi = (i * 3) % productIds.length;
    const p = productSpecs[pi]!;
    const productId = productIds[pi]!;
    const sellerId = sellerIds[p.si]!;
    const qty = (i % 3) + 1;
    const unitPrice = p.price * (1 - (p.disc ?? 0) / 100);
    const deliveryFee = 5000 + (i % 6) * 2000;
    const total = Math.round(unitPrice * qty + deliveryFee);
    const zoneId = zoneIds.length > 0 ? zoneIds[i % zoneIds.length]! : null;
    const createdAt = new Date(Date.now() - (10 + i * 4) * 86400_000).toISOString();

    const oRows = await exec(sql`
      INSERT INTO orders (customer_id, total, status, shipping_address, city, delivery_fee, zone_id, created_at, updated_at)
      VALUES (${customerId}, ${total}, ${status}::order_status, ${addrs[i % 4]}, ${cities[i % 4]},
              ${deliveryFee}, ${zoneId}, ${createdAt}, ${createdAt})
      RETURNING id
    `);
    const oid = oRows[0]!.id as number;
    orderIds.push(oid);

    await exec(sql`
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, seller_id)
      VALUES (${oid}, ${productId}, ${p.name}, ${qty}, ${unitPrice}, ${sellerId})
    `);
    await exec(sql`
      INSERT INTO order_status_history (order_id, to_status, created_at)
      VALUES (${oid}, ${status}, ${createdAt})
    `);
    console.log(`  ✓ Order #${oid}: ${p.name.substring(0, 35)} × ${qty} → ${status}`);
  }

  // ── 5. PRODUCT REVIEWS ──────────────────────────────────────────────────────
  console.log("\nCreating product reviews...");

  const reviewPool: [string, number][] = [
    ["Great product, exactly as described! Fast delivery.", 5],
    ["Very good quality, I am happy with my purchase.", 4],
    ["Decent product but packaging was a bit damaged.", 3],
    ["Excellent! Exceeded my expectations. Will buy again.", 5],
    ["Good value for money. Would recommend to friends.", 4],
    ["The product is OK, nothing special. Average quality.", 3],
    ["Amazing quality! Looks exactly like the pictures.", 5],
    ["Fast shipping and good product. Seller is responsive.", 4],
    ["Product as expected. Good seller, professional.", 4],
    ["Incredible quality for the price. Very satisfied!", 5],
    ["Exactly what I was looking for. Thank you!", 5],
    ["A bit expensive but the quality justifies the price.", 4],
  ];

  let reviewCount = 0;
  // Each customer reviews several products (skip if unique constraint violated)
  for (let i = 0; i < 40; i++) {
    const pid = productIds[i % productIds.length]!;
    const uid = customerIds[Math.floor(i / productIds.length) % customerIds.length]!;
    const [comment, rating] = reviewPool[i % reviewPool.length]!;
    try {
      await exec(sql`
        INSERT INTO reviews (product_id, user_id, rating, comment, created_at)
        VALUES (${pid}, ${uid}, ${rating}, ${comment}, NOW() - INTERVAL '${sql.raw(String(i + 1))} days')
        ON CONFLICT (product_id, user_id) DO NOTHING
      `);
      reviewCount++;
    } catch { /* skip */ }
  }
  console.log(`  ✓ ${reviewCount} product reviews`);

  // ── 6. SELLER REVIEWS ──────────────────────────────────────────────────────
  console.log("\nCreating seller reviews...");

  const sellerReviews = [
    { si:0, ci:0, comm:5, ship:5, prof:5, text:"Excellent seller! Fast shipping and authentic products." },
    { si:0, ci:1, comm:4, ship:5, prof:4, text:"Good experience. Product was exactly as described." },
    { si:1, ci:0, comm:5, ship:4, prof:5, text:"Beautiful fashion items! Great quality and fast delivery." },
    { si:1, ci:2, comm:4, ship:4, prof:4, text:"Nice clothing, true to size. Happy with purchase." },
    { si:2, ci:1, comm:5, ship:5, prof:5, text:"Beit Al-Nour has the best home decor! Highly recommend." },
    { si:2, ci:3, comm:4, ship:5, prof:4, text:"Good quality furniture. Delivery was on time." },
    { si:3, ci:2, comm:5, ship:5, prof:5, text:"Authentic perfumes! Dior Sauvage smells amazing." },
    { si:3, ci:0, comm:5, ship:4, prof:5, text:"Hana Beauty has top-quality products." },
  ];
  let srCount = 0;
  for (const r of sellerReviews) {
    const sellerId = sellerIds[r.si]!;
    const customerId = customerIds[r.ci]!;
    const oid = orderIds[r.si % orderIds.length] ?? null;
    try {
      await exec(sql`
        INSERT INTO seller_reviews (seller_id, customer_id, order_id, communication_rating, shipping_rating, professionalism_rating, comment)
        VALUES (${sellerId}, ${customerId}, ${oid}, ${r.comm}, ${r.ship}, ${r.prof}, ${r.text})
        ON CONFLICT (seller_id, customer_id) DO NOTHING
      `);
      srCount++;
    } catch { /* skip */ }
  }
  console.log(`  ✓ ${srCount} seller reviews`);

  // ── 7. WISHLISTS ────────────────────────────────────────────────────────────
  console.log("\nCreating wishlist items...");

  const wishlistPairs = [[0,0],[0,3],[0,8],[1,1],[1,9],[2,4],[2,10],[3,2],[3,7],[3,11],[0,15],[1,20]];
  let wCount = 0;
  for (const [ci, pi] of wishlistPairs) {
    const uid = customerIds[ci! % customerIds.length]!;
    const pid = productIds[pi! % productIds.length]!;
    try {
      await exec(sql`INSERT INTO wishlists (user_id, product_id) VALUES (${uid}, ${pid}) ON CONFLICT DO NOTHING`);
      wCount++;
    } catch { /* skip */ }
  }
  console.log(`  ✓ ${wCount} wishlist items`);

  // ── 8. STORE FOLLOWS ────────────────────────────────────────────────────────
  console.log("\nCreating store follows...");

  const followPairs = [[0,0],[0,1],[1,0],[1,2],[2,1],[2,3],[3,0],[3,2]];
  let fCount = 0;
  for (const [ci, si] of followPairs) {
    const fid = customerIds[ci! % customerIds.length]!;
    const sid = sellerIds[si! % sellerIds.length]!;
    try {
      await exec(sql`INSERT INTO store_follows (follower_id, seller_id) VALUES (${fid}, ${sid}) ON CONFLICT DO NOTHING`);
      fCount++;
    } catch { /* skip */ }
  }
  console.log(`  ✓ ${fCount} store follows`);

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  const [pCount]   = await exec(sql`SELECT COUNT(*)::int cnt FROM products`);
  const [rCount]   = await exec(sql`SELECT COUNT(*)::int cnt FROM reviews`);
  const [oCount]   = await exec(sql`SELECT COUNT(*)::int cnt FROM orders`);
  const [deals]    = await exec(sql`SELECT COUNT(*)::int cnt FROM products WHERE discount_percent >= 15`);
  const [newArr]   = await exec(sql`SELECT COUNT(*)::int cnt FROM products WHERE created_at > NOW() - INTERVAL '7 days'`);
  const [bestSell] = await exec(sql`SELECT COUNT(*)::int cnt FROM products WHERE sales_count >= 50`);
  const cats       = await exec(sql`SELECT DISTINCT category FROM products ORDER BY category`);

  console.log(`
╔══════════════════════════════════════════════════════╗
║           SYANO SEED COMPLETE ✅                    ║
╠══════════════════════════════════════════════════════╣
║  Sellers (stores):       ${String(sellerIds.length).padEnd(24)} ║
║  Customers:              ${String(customerIds.length).padEnd(24)} ║
║  Total products:         ${String(pCount!.cnt).padEnd(24)} ║
║  Total orders:           ${String(oCount!.cnt).padEnd(24)} ║
║  Product reviews:        ${String(rCount!.cnt).padEnd(24)} ║
║  Wishlist items:         ${String(wCount).padEnd(24)} ║
║  Store follows:          ${String(fCount).padEnd(24)} ║
╠══════════════════════════════════════════════════════╣
║  🔥 Hot Deals (≥15% off): ${String(deals!.cnt).padEnd(23)} ║
║  ⭐ Best Sellers (≥50):   ${String(bestSell!.cnt).padEnd(23)} ║
║  🆕 New Arrivals (≤7d):   ${String(newArr!.cnt).padEnd(23)} ║
╠══════════════════════════════════════════════════════╣
║  Categories seeded:                                  ║
${cats.map((c) => `║    • ${String(c.category).padEnd(47)}║`).join("\n")}
╚══════════════════════════════════════════════════════╝
`);
}

run().catch((e: unknown) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
