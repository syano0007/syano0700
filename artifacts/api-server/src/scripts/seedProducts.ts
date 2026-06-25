/**
 * SYANO — 25,000 Product Seeder
 * Generates realistic products across 13 categories with English + Arabic names.
 * Inserts in batches of 500. Idempotent: skips if >= 1000 products already exist.
 *
 * Run: pnpm --filter @workspace/api-server seed:products
 */

import { pool } from "@workspace/db";

const TARGET = 25_000;
const BATCH_SIZE = 500;
const SELLER_IDS = [2, 4, 5, 6, 7];

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
}

// ─── Category Data ────────────────────────────────────────────────────────────

const CATEGORIES: CategoryDef[] = [
  {
    name: "Electronics",
    nameAr: "إلكترونيات",
    priceMin: 50_000,
    priceMax: 3_000_000,
    products: [
      { en: "Samsung 65\" 4K QLED Smart TV", ar: "تلفزيون سامسونج 65 بوصة 4K QLED ذكي" },
      { en: "LG OLED 55\" C3 Smart TV", ar: "تلفزيون LG OLED 55 بوصة C3 ذكي" },
      { en: "Sony Bravia XR 65\" 4K TV", ar: "تلفزيون سوني برافيا XR 65 بوصة 4K" },
      { en: "TCL 50\" 4K Roku Smart TV", ar: "تلفزيون TCL 50 بوصة 4K روكو ذكي" },
      { en: "Hisense 55\" ULED 4K Smart TV", ar: "تلفزيون هايسنس 55 بوصة ULED 4K ذكي" },
      { en: "Amazon Fire TV Stick 4K Max", ar: "أمازون فاير تي في ستيك 4K Max" },
      { en: "Google Chromecast with Google TV 4K", ar: "جوجل كروم كاست مع Google TV 4K" },
      { en: "Raspberry Pi 5 Starter Kit", ar: "راسبيري باي 5 طقم مبتدئين" },
      { en: "Arduino Mega 2560 R3 Kit", ar: "أردوينو ميغا 2560 R3 طقم" },
      { en: "Ring Video Doorbell Pro 2", ar: "جرس باب بالفيديو Ring Pro 2" },
      { en: "Philips Hue Smart Bulb Starter Kit", ar: "طقم مصابيح Philips Hue الذكية" },
      { en: "TP-Link Archer AX6000 Wi-Fi 6 Router", ar: "راوتر TP-Link Archer AX6000 Wi-Fi 6" },
      { en: "Netgear Nighthawk AX12 Router", ar: "راوتر Netgear Nighthawk AX12" },
      { en: "Anker 100W USB-C GaN Charger", ar: "شاحن Anker 100W USB-C GaN" },
      { en: "Baseus 65W Fast Charger Block", ar: "شاحن Baseus 65W سريع" },
      { en: "Xiaomi Mi Smart Band 8", ar: "سوار Xiaomi Mi Smart Band 8" },
      { en: "NVIDIA GeForce RTX 4060 Ti 8GB", ar: "كارت شاشة NVIDIA RTX 4060 Ti 8GB" },
      { en: "Western Digital 2TB My Passport Portable SSD", ar: "هارد SSD محمول Western Digital 2TB" },
      { en: "Seagate Backup Plus 4TB External Hard Drive", ar: "هارد خارجي Seagate Backup Plus 4TB" },
      { en: "SanDisk 1TB Extreme Portable SSD", ar: "هارد SSD محمول SanDisk 1TB Extreme" },
    ],
  },
  {
    name: "Mobile Phones",
    nameAr: "هواتف ذكية",
    priceMin: 300_000,
    priceMax: 2_500_000,
    products: [
      { en: "Samsung Galaxy S24 Ultra 256GB Titanium", ar: "سامسونج جالاكسي S24 الترا 256GB تيتانيوم" },
      { en: "Samsung Galaxy S24+ 512GB Violet", ar: "سامسونج جالاكسي S24 بلس 512GB بنفسجي" },
      { en: "Samsung Galaxy A55 5G 128GB", ar: "سامسونج جالاكسي A55 5G 128GB" },
      { en: "Samsung Galaxy Z Flip5 256GB Mint", ar: "سامسونج جالاكسي Z Flip5 256GB أخضر" },
      { en: "Apple iPhone 16 Pro Max 256GB Natural", ar: "أبل آيفون 16 برو ماكس 256GB طبيعي" },
      { en: "Apple iPhone 16 128GB Black", ar: "أبل آيفون 16 128GB أسود" },
      { en: "Apple iPhone 15 Plus 256GB Yellow", ar: "أبل آيفون 15 بلس 256GB أصفر" },
      { en: "Apple iPhone SE 3rd Gen 64GB Midnight", ar: "أبل آيفون SE الجيل الثالث 64GB أسود" },
      { en: "Google Pixel 9 Pro 256GB Obsidian", ar: "جوجل بيكسل 9 برو 256GB أوبسيديان" },
      { en: "Google Pixel 9a 128GB Iris", ar: "جوجل بيكسل 9a 128GB أيريس" },
      { en: "Xiaomi 14 Ultra 512GB White", ar: "شاومي 14 الترا 512GB أبيض" },
      { en: "Xiaomi Redmi Note 13 Pro 256GB", ar: "شاومي ريدمي نوت 13 برو 256GB" },
      { en: "OnePlus 12 256GB Silky Black", ar: "ون بلس 12 256GB أسود ناعم" },
      { en: "OPPO Find X7 Ultra 512GB", ar: "أوبو فايند X7 الترا 512GB" },
      { en: "Huawei Pura 70 Pro 256GB Black", ar: "هواوي بورا 70 برو 256GB أسود" },
      { en: "Vivo X100 Pro 512GB Blue", ar: "فيفو X100 برو 512GB أزرق" },
      { en: "Realme GT 6 256GB Fluid Silver", ar: "ريلمي GT 6 256GB فضي" },
      { en: "Motorola Edge 50 Pro 256GB Black Beauty", ar: "موتورولا إيدج 50 برو 256GB أسود" },
      { en: "Nothing Phone (2a) 256GB Blue", ar: "ناثينج فون 2a 256GB أزرق" },
      { en: "Asus ROG Phone 8 Pro 512GB", ar: "أسوس ROG فون 8 برو 512GB" },
    ],
  },
  {
    name: "Laptops & Computers",
    nameAr: "لابتوب وكمبيوتر",
    priceMin: 700_000,
    priceMax: 4_500_000,
    products: [
      { en: "Apple MacBook Pro 16\" M3 Max 1TB", ar: "ماك بوك برو 16 بوصة M3 Max 1TB" },
      { en: "Apple MacBook Air 15\" M3 256GB", ar: "ماك بوك إير 15 بوصة M3 256GB" },
      { en: "Dell XPS 15 Intel Core Ultra 9 1TB", ar: "ديل XPS 15 إنتل كور الترا 9 1TB" },
      { en: "Dell Inspiron 15 3000 Core i5 512GB", ar: "ديل إنسبايرون 15 3000 كور i5 512GB" },
      { en: "HP Spectre x360 14\" OLED Touch", ar: "HP Spectre x360 14 بوصة OLED لمس" },
      { en: "HP EliteBook 840 G10 Core i7", ar: "HP إليت بوك 840 G10 كور i7" },
      { en: "Lenovo ThinkPad X1 Carbon Gen 12", ar: "لينوفو ثينك باد X1 كاربون الجيل 12" },
      { en: "Lenovo IdeaPad Slim 5 Core i5 16GB", ar: "لينوفو إيديا باد سليم 5 كور i5 16GB" },
      { en: "ASUS ZenBook 14 OLED Ryzen 9", ar: "أسوس زين بوك 14 OLED رايزن 9" },
      { en: "ASUS ROG Zephyrus G16 RTX 4070", ar: "أسوس ROG زيفيروس G16 RTX 4070" },
      { en: "Acer Swift 14 AI Core Ultra 5", ar: "أيسر سويفت 14 AI كور الترا 5" },
      { en: "Acer Predator Helios Neo 16 RTX 4060", ar: "أيسر بريداتور هيليوس نيو 16 RTX 4060" },
      { en: "MSI Prestige 16 AI Evo Core Ultra 7", ar: "MSI بريستيج 16 AI إيفو كور الترا 7" },
      { en: "Razer Blade 18 RTX 4080 2K 240Hz", ar: "رايزر بليد 18 RTX 4080 2K 240Hz" },
      { en: "Microsoft Surface Laptop 6 Sapphire", ar: "مايكروسوفت سيرفيس لابتوب 6 سفاير" },
      { en: "Samsung Galaxy Book4 Pro 360 OLED", ar: "سامسونج جالاكسي بوك 4 برو 360 OLED" },
      { en: "Custom Gaming PC RTX 4070 Super i7", ar: "كمبيوتر ألعاب مخصص RTX 4070 Super i7" },
      { en: "Intel NUC Mini PC Core i9 32GB", ar: "كمبيوتر صغير إنتل NUC كور i9 32GB" },
      { en: "Apple Mac Mini M2 Pro 512GB", ar: "آبل ماك ميني M2 برو 512GB" },
      { en: "HP ProBook 450 G10 Core i5 8GB", ar: "HP برو بوك 450 G10 كور i5 8GB" },
    ],
  },
  {
    name: "Audio & Headphones",
    nameAr: "سماعات وصوتيات",
    priceMin: 30_000,
    priceMax: 1_500_000,
    products: [
      { en: "Sony WH-1000XM5 Wireless Noise Cancelling", ar: "سوني WH-1000XM5 لاسلكية بإلغاء الضوضاء" },
      { en: "Apple AirPods Pro 2nd Generation USB-C", ar: "أبل إيربودز برو الجيل الثاني USB-C" },
      { en: "Bose QuietComfort 45 Wireless", ar: "بوز كويت كمفورت 45 لاسلكية" },
      { en: "Samsung Galaxy Buds3 Pro Noise Cancel", ar: "سامسونج جالاكسي بودز 3 برو بإلغاء ضوضاء" },
      { en: "JBL Charge 5 Portable Bluetooth Speaker", ar: "سماعة JBL Charge 5 محمولة بلوتوث" },
      { en: "JBL Flip 6 Portable Waterproof Speaker", ar: "سماعة JBL Flip 6 محمولة مقاومة للماء" },
      { en: "Marshall Emberton II Bluetooth Speaker", ar: "سماعة مارشال Emberton II بلوتوث" },
      { en: "Sonos Era 300 Spatial Audio Speaker", ar: "سماعة Sonos Era 300 صوت مكاني" },
      { en: "Harman Kardon Aura Studio 4", ar: "هارمان كاردون أورا ستوديو 4" },
      { en: "Sennheiser HD 560S Open-Back Headphones", ar: "سينهايزر HD 560S سماعات مفتوحة" },
      { en: "Audio-Technica ATH-M50xBT2 Wireless", ar: "أوديو تكنيكا ATH-M50xBT2 لاسلكية" },
      { en: "Jabra Elite 10 True Wireless ANC", ar: "جابرا إيليت 10 لاسلكية حقيقية ANC" },
      { en: "Nothing Ear (2) Active Noise Cancel", ar: "ناثينج إير 2 إلغاء ضوضاء نشط" },
      { en: "Shure AONIC 50 Gen 2 Wireless ANC", ar: "شور AONIC 50 الجيل الثاني لاسلكية ANC" },
      { en: "Focal Bathys Hi-Fi ANC Headphones", ar: "فوكال باثيس سماعات Hi-Fi ANC" },
      { en: "Edifier W820NB Plus Wireless ANC", ar: "إديفاير W820NB بلس لاسلكية ANC" },
      { en: "Beats Studio Pro Wireless ANC", ar: "بيتس ستوديو برو لاسلكية ANC" },
      { en: "Anker Soundcore Q45 Wireless ANC", ar: "أنكر ساوندكور Q45 لاسلكية ANC" },
      { en: "Creative Outlier Pro Wireless ANC", ar: "كريتيف أوتلاير برو لاسلكية ANC" },
      { en: "Xiaomi Mi Earphones Basic 3.5mm", ar: "شاومي إيربودز أساسية 3.5 ملم" },
    ],
  },
  {
    name: "Cameras",
    nameAr: "كاميرات",
    priceMin: 400_000,
    priceMax: 5_000_000,
    products: [
      { en: "Sony Alpha A7 IV Mirrorless 33MP Body", ar: "سوني ألفا A7 IV بدون مرآة 33 ميغابيكسل" },
      { en: "Sony ZV-E10 II Mirrorless APS-C Kit", ar: "سوني ZV-E10 II طقم APS-C" },
      { en: "Canon EOS R8 Mirrorless 24.2MP", ar: "كانون EOS R8 بدون مرآة 24.2 ميغابيكسل" },
      { en: "Canon EOS 250D DSLR 24.1MP Kit 18-55", ar: "كانون EOS 250D DSLR 24.1MP طقم 18-55" },
      { en: "Nikon Z8 Mirrorless 45.7MP Body", ar: "نيكون Z8 بدون مرآة 45.7 ميغابيكسل" },
      { en: "Nikon D3500 DSLR 24.2MP Kit 18-55", ar: "نيكون D3500 DSLR 24.2MP طقم 18-55" },
      { en: "Fujifilm X-T5 40.2MP APS-C Body", ar: "فوجيفيلم X-T5 40.2 ميغابيكسل APS-C" },
      { en: "Fujifilm X100VI Compact Camera 40MP", ar: "فوجيفيلم X100VI كاميرا مدمجة 40 ميغابيكسل" },
      { en: "GoPro Hero 13 Black 5.3K Action Cam", ar: "جوبرو هيرو 13 بلاك 5.3K كاميرا أكشن" },
      { en: "DJI Osmo Pocket 3 Creator Combo", ar: "DJI أوسمو بوكيت 3 طقم المبدع" },
      { en: "Insta360 X4 8K 360° Camera", ar: "إنستا360 X4 8K كاميرا 360 درجة" },
      { en: "DJI Mini 4 Pro Drone 4K HDR", ar: "طائرة DJI ميني 4 برو بدون طيار 4K HDR" },
      { en: "Sony FX3 Cinema Camera Full Frame", ar: "سوني FX3 كاميرا سينما فريم كامل" },
      { en: "Blackmagic Pocket Cinema Camera 6K G2", ar: "بلاك ماجيك بوكيت 6K G2 كاميرا سينما" },
      { en: "Panasonic LUMIX S5 IIX 24.2MP", ar: "باناسونيك LUMIX S5 IIX 24.2 ميغابيكسل" },
      { en: "OM System OM-5 Weather-Sealed MFT", ar: "OM System OM-5 مقاومة الطقس MFT" },
      { en: "Ricoh GR IIIx Urban Edition Compact", ar: "ريكو GR IIIx حضري إصدار مدمج" },
      { en: "Sigma 18-50mm f/2.8 DC DN Contemporary", ar: "عدسة سيغما 18-50mm f/2.8 DC DN" },
      { en: "Tamron 17-70mm f/2.8 Di III-A VC RXD", ar: "عدسة تامرون 17-70mm f/2.8 Di III-A" },
      { en: "Manfrotto MVKBFR-LIVE Video Travel Kit", ar: "حامل مانفروتو MVKBFR فيديو سفر" },
    ],
  },
  {
    name: "Men's Clothing",
    nameAr: "ملابس رجالي",
    priceMin: 25_000,
    priceMax: 600_000,
    products: [
      { en: "Slim Fit Oxford Button-Down Shirt White", ar: "قميص أكسفورد أبيض ضيق الياقة" },
      { en: "Classic Chino Pants Beige Stretch", ar: "بنطلون تشينو بيج مطاطي كلاسيكي" },
      { en: "Premium Slim Jeans Dark Indigo Wash", ar: "جينز سليم فاخر غسيل داكن" },
      { en: "Linen Blazer Navy Single Breasted", ar: "بليزر كتان كحلي صف أزرار واحد" },
      { en: "Merino Wool V-Neck Sweater Charcoal", ar: "سويتر ميرينو وول V-نك فحمي" },
      { en: "Polo Ralph Lauren Slim Fit Polo Navy", ar: "بولو رالف لورين سليم فيت كحلي" },
      { en: "Adidas Essentials 3-Stripes Joggers", ar: "سروال رياضي أديداس إيسنشالز 3 خطوط" },
      { en: "Nike Tech Fleece Full-Zip Hoodie", ar: "هودي نايك تك فليس زيبر كامل" },
      { en: "Formal Wedding Suit 3-Piece Navy", ar: "بدلة زفاف رسمية 3 قطع كحلي" },
      { en: "Leather Belt Black Genuine Italian", ar: "حزام جلد أسود إيطالي أصلي" },
      { en: "Crew Neck Plain T-Shirt Pack of 3", ar: "تي شيرت سادة رقبة دائرة 3 قطع" },
      { en: "Cargo Shorts Multi-Pocket Khaki", ar: "شورت كارجو متعدد الجيوب خاكي" },
      { en: "Wool Overcoat Double Breasted Camel", ar: "معطف صوف كاميل مزدوج الصدر" },
      { en: "Leather Jacket Biker Style Black", ar: "جاكيت جلد بايكر أسود" },
      { en: "Denim Jacket Distressed Light Wash", ar: "جاكيت جينز مهترئ غسيل فاتح" },
      { en: "Graphic Tee Oversized Streetwear", ar: "تي شيرت مرسوم أوفرسايز ستريتوير" },
      { en: "Dress Trousers Slim Fit Charcoal Grey", ar: "بنطلون رسمي سليم فيت رمادي فحمي" },
      { en: "Casual Short-Sleeve Linen Shirt Blue", ar: "قميص كتان قصير الأكمام أزرق كاجوال" },
      { en: "Henley Thermal Long Sleeve Burgundy", ar: "هنلي حراري كم طويل عنابي" },
      { en: "Athletic Compression Shorts Running", ar: "شورت ضاغط رياضي للجري" },
    ],
  },
  {
    name: "Women's Clothing",
    nameAr: "ملابس نسائي",
    priceMin: 25_000,
    priceMax: 800_000,
    products: [
      { en: "Floral Maxi Dress Wrap Style Boho", ar: "فستان ماكسي بوهو بطباعة زهور" },
      { en: "Nida Abaya Premium Embroidered Black", ar: "عباية نيدا فاخرة مطرزة سوداء" },
      { en: "Bodycon Midi Dress Satin Emerald", ar: "فستان ميدي ساتان زمردي ضيق" },
      { en: "Wide Leg Trousers High Waist Cream", ar: "بنطلون ساق واسعة خصر عالٍ كريمي" },
      { en: "Silk Blouse Loose Fit Champagne", ar: "بلوزة حرير فضفاضة شمبانيا" },
      { en: "Tailored Blazer Cropped Black", ar: "بليزر مفصل مقصر أسود" },
      { en: "Off-Shoulder Evening Gown Burgundy", ar: "فستان سهرة كتف مكشوف عنابي" },
      { en: "Casual Linen Jumpsuit Sand", ar: "جامب سوت كتان كاجوال رملي" },
      { en: "Knit Turtleneck Sweater Beige", ar: "سويتر تيرتل نك منسوج بيج" },
      { en: "Pleated Midi Skirt Navy A-Line", ar: "تنورة ميدي كحلية A-لاين مطوية" },
      { en: "Denim Mom Jeans High Waist Light Wash", ar: "جينز مام هاي وايست غسيل فاتح" },
      { en: "Floral Chiffon Wrap Blouse Pink", ar: "بلوزة شيفون وراب زهور وردية" },
      { en: "Wool Peacoat Double Breasted Camel", ar: "معطف وول بيكوت مزدوج كاميل" },
      { en: "Puffer Jacket Quilted Burgundy", ar: "جاكيت مبطن بالريش عنابي" },
      { en: "Sports Leggings High Waist 7/8 Length", ar: "تايتس رياضي خصر عالٍ 7/8" },
      { en: "Sports Bra Medium Support Strappy", ar: "حمالة صدر رياضية دعم متوسط" },
      { en: "Lace Trim Cami Top Champagne Satin", ar: "كامي توب بدانتيل شمبانيا ساتان" },
      { en: "Smocked Tiered Maxi Skirt Earthy Tones", ar: "تنورة سمكد طبقات ألوان ترابية" },
      { en: "Co-ord Set Blazer Trousers Cream", ar: "طقم كوورد بليزر وبنطلون كريمي" },
      { en: "Kimono Cardigan Floral Wrap Dusty Rose", ar: "كاردجان كيمونو زهوري وردي" },
    ],
  },
  {
    name: "Shoes & Footwear",
    nameAr: "أحذية وإكسسوارات",
    priceMin: 40_000,
    priceMax: 700_000,
    products: [
      { en: "Nike Air Max 270 React Men's Sneaker", ar: "حذاء نايك إير ماكس 270 ريأكت رجالي" },
      { en: "Adidas Ultraboost 22 Running Shoe", ar: "حذاء أديداس الترابوست 22 للجري" },
      { en: "New Balance 990v6 Made in USA", ar: "حذاء نيو بالانس 990v6 صناعة أمريكا" },
      { en: "Vans Old Skool Classic Canvas Low", ar: "حذاء فانز أولد سكول كانفاس كلاسيك" },
      { en: "Converse Chuck Taylor All Star Hi White", ar: "حذاء كونفيرس تشاك تيلور أبيض" },
      { en: "Jordan 1 Retro High OG University Blue", ar: "حذاء جوردان 1 ريترو هاي أزرق جامعي" },
      { en: "Dr. Martens 1460 8-Eye Leather Boot", ar: "بوت دكتور مارتينز 1460 جلد 8 عيون" },
      { en: "Timberland 6\" Premium Waterproof Boot", ar: "بوت تمبرلاند 6 بوصة مقاوم للماء" },
      { en: "Birkenstock Arizona EVA Sandal", ar: "صندل بيركنستوك أريزونا EVA" },
      { en: "Steve Madden Irenee Block Heel Sandal", ar: "صندل ستيف مادن إيريني كعب بلوك" },
      { en: "Zara Pointed Kitten Heel Mule Cream", ar: "مول هيل كيتن كريمي زارا" },
      { en: "Leather Loafer Penny Style Oxford Tan", ar: "لوفر جلد بيني أوكسفورد أصفر بني" },
      { en: "Chelsea Boot Ankle Suede Black Women", ar: "بوت تشيلسي كاحل سويد أسود نسائي" },
      { en: "Platform Sneaker Chunky Sole White", ar: "سنيكر بلاتفورم نعل سميك أبيض" },
      { en: "Slip-On Moccasin Suede Grey Men", ar: "موكاسين سويد رمادي رجالي للانزلاق" },
      { en: "Ballet Flat Patent Leather Black Women", ar: "باليه فلات جلد لامع أسود نسائي" },
      { en: "Heel Ankle Strap Sandal Nude", ar: "صندل بكعب حزام كاحل لون الجلد" },
      { en: "Athletic Trail Running Shoe Waterproof", ar: "حذاء تريل رياضي مقاوم للماء" },
      { en: "Flip Flop Slide Rubber Pool Sandal", ar: "شبشب ربر للمسبح" },
      { en: "Dress Oxford Cap Toe Lace-Up Black", ar: "أوكسفورد رسمي كاب توو رباط أسود" },
    ],
  },
  {
    name: "Watches & Jewelry",
    nameAr: "ساعات ومجوهرات",
    priceMin: 50_000,
    priceMax: 5_000_000,
    products: [
      { en: "Casio G-Shock GA-2100 Carbon Core Guard", ar: "ساعة كاسيو G-Shock GA-2100 كاربون" },
      { en: "Seiko 5 Sports Automatic Day-Date Black", ar: "ساعة سيكو 5 سبورتس أوتوماتيك سوداء" },
      { en: "Fossil Gen 6 Smartwatch 44mm", ar: "ساعة فوسيل جن 6 ذكية 44 ملم" },
      { en: "Samsung Galaxy Watch 7 44mm Silver", ar: "ساعة سامسونج جالاكسي ووتش 7 44 ملم" },
      { en: "Apple Watch Series 10 GPS 46mm", ar: "ساعة أبل ووتش سيريز 10 GPS 46 ملم" },
      { en: "Tissot PRX Powermatic 80 Steel", ar: "ساعة تيسو PRX باورماتيك 80 ستيل" },
      { en: "Orient Bambino V5 Automatic Leather", ar: "ساعة أورينت بامبينو V5 أوتوماتيك جلد" },
      { en: "Citizen Eco-Drive Weekender Avion", ar: "ساعة سيتيزن إيكو درايف ويكندر" },
      { en: "Timex Expedition Scout TW4B14000", ar: "ساعة تايمكس إكسبيدشن سكاوت" },
      { en: "Swarovski Crystal Tennis Bracelet Silver", ar: "سوار تنس سواروفسكي كريستال فضي" },
      { en: "Gold Plated Chain Necklace 18K Women", ar: "قلادة سلسلة مطلية بالذهب 18 قيراط نسائي" },
      { en: "Sterling Silver Hoop Earrings 30mm", ar: "أقراط هوب فضة إسترلينج 30 ملم" },
      { en: "Pandora Moments Charm Bracelet Rose Gold", ar: "سوار باندورا موومنتس ذهب وردي" },
      { en: "Diamond Solitaire Engagement Ring 0.5ct", ar: "خاتم خطوبة ماسي سوليتير 0.5 قيراط" },
      { en: "Rose Gold Layered Minimalist Necklace Set", ar: "طقم قلادة مينيمالست ذهب وردي متعدد طبقات" },
      { en: "Pearl Drop Earrings Classic 8mm", ar: "أقراط لؤلؤ كلاسيكية 8 ملم" },
      { en: "Men's Chunky Figaro Chain 24\" Silver", ar: "سلسلة فيجارو رجالي فضية 24 بوصة" },
      { en: "Turquoise Beaded Boho Bracelet Stack", ar: "سوار خرز فيروزي بوهو ستاك" },
      { en: "Minimal Geometric Ring Set Gold 5pc", ar: "طقم خواتم هندسية مينيمال ذهبي 5 قطع" },
      { en: "Vintage Brooches Enamel Flower Pin", ar: "بروش خمري مينا زهرة" },
    ],
  },
  {
    name: "Home & Kitchen",
    nameAr: "منزل ومطبخ",
    priceMin: 20_000,
    priceMax: 1_200_000,
    products: [
      { en: "Instant Pot Duo 7-in-1 6Qt Pressure Cooker", ar: "قدر ضغط إنستنت بوت ديو 7 في 1 6 لتر" },
      { en: "Ninja Air Fryer 5.5L Max XL", ar: "إير فراير نينجا 5.5 لتر Max XL" },
      { en: "KitchenAid Artisan Stand Mixer 4.7L", ar: "خلاط طاولة كيتشن إيد أرتيزان 4.7 لتر" },
      { en: "Philips 3000 Series Airfryer XL 6.2L", ar: "إير فراير فيليبس 3000 سيريز XL 6.2 لتر" },
      { en: "Nespresso Vertuo Pop Coffee Machine", ar: "ماكينة نسبريسو فيرتوو بوب للقهوة" },
      { en: "Breville Barista Express Espresso", ar: "ماكينة اسبريسو بريفيل باريستا إكسبريس" },
      { en: "Cuisinart Food Processor 14-Cup", ar: "محضر طعام كويزينارت 14 كوب" },
      { en: "Dyson V15 Detect Cordless Vacuum", ar: "مكنسة دايسون V15 لاسلكية ذكية" },
      { en: "iRobot Roomba j7+ Self-Emptying Robot", ar: "روبوت تنظيف iRobot Roomba j7+ فراغ ذاتي" },
      { en: "Le Creuset 28cm Signature Cast Iron Dutch", ar: "قدر لو كريست 28 سم حديد صب" },
      { en: "OXO Good Grips 12-Piece Knife Block Set", ar: "طقم سكاكين أوكسو 12 قطعة مع حامل" },
      { en: "Silicone Baking Mat Non-Stick 2-Pack", ar: "حصيرة سيليكون للخبز غير لاصقة 2 قطعة" },
      { en: "Bamboo Cutting Board Large Antibacterial", ar: "لوح تقطيع خيزران كبير مضاد للبكتيريا" },
      { en: "Glass Food Storage Containers 18-Piece", ar: "حاويات زجاج لحفظ الطعام 18 قطعة" },
      { en: "Coffee Grinder Burr Electric Conical", ar: "طاحونة قهوة بر كهربائية مخروطية" },
      { en: "Portable Blender Personal 300W USB", ar: "خلاط محمول شخصي 300 واط USB" },
      { en: "Turkish Tea Kettle Electric 3L Stainless", ar: "غلاية شاي تركي كهربائية 3 لتر ستيل" },
      { en: "Rice Cooker Zojirushi 5.5-Cup Fuzzy", ar: "طباخ أرز زوجيروشي 5.5 كوب فوزي" },
      { en: "Toaster Oven with Air Fry Breville", ar: "فرن توستر مع إير فراي بريفيل" },
      { en: "Vegetable Chopper Mandoline Slicer Set", ar: "قاطع خضار ماندولين طقم شرائح" },
    ],
  },
  {
    name: "Furniture",
    nameAr: "أثاث",
    priceMin: 80_000,
    priceMax: 3_000_000,
    products: [
      { en: "Sectional L-Shape Sofa Velvet Dark Green", ar: "أريكة على شكل L مخمل أخضر داكن" },
      { en: "3-Seater Fabric Sofa Cloud Grey Modern", ar: "أريكة 3 مقاعد قماش رمادي سحابي عصري" },
      { en: "Solid Wood Dining Table 6-Seater Walnut", ar: "طاولة طعام خشب صلب 6 أشخاص جوز" },
      { en: "Queen Bed Frame Upholstered Headboard Beige", ar: "هيكل سرير كوين مبطن برأسية بيج" },
      { en: "King Bed Frame Platform Dark Oak", ar: "هيكل سرير كينج بلاتفورم بلوط داكن" },
      { en: "Wardrobe 3-Door Sliding Mirror Oak White", ar: "خزانة 3 أبواب منزلقة بمرآة أوك أبيض" },
      { en: "Bookcase 5-Shelf Floating Wall White", ar: "خزانة كتب 5 رفوف جدارية بيضاء عائمة" },
      { en: "Office Desk L-Shape Corner Study Oak", ar: "مكتب مكتب L شكل زاوية دراسة أوك" },
      { en: "Ergonomic Mesh Office Chair High Back", ar: "كرسي مكتب ارغونوميك شبكة ظهر عالٍ" },
      { en: "Accent Chair Bouclé Cream Rounded", ar: "كرسي أكسنت بوكليه كريمي مدور" },
      { en: "Coffee Table Glass Top Metal Legs Gold", ar: "طاولة قهوة سطح زجاج أرجل معدن ذهبي" },
      { en: "TV Unit Floating LED Lights White", ar: "وحدة تلفزيون عائمة إضاءة LED أبيض" },
      { en: "Sideboard Buffet 3-Door Rattan White", ar: "سايد بورد بوفيه 3 أبواب راتان أبيض" },
      { en: "Nightstand 2-Drawer Bedside Table", ar: "كومودينو 2 درج طاولة جانب سرير" },
      { en: "Bar Stool Counter Height Velvet Swivel", ar: "كرسي بار ارتفاع كاونتر مخمل دوار" },
      { en: "Outdoor Garden Sofa Set Rattan 4pc", ar: "طقم أريكة حديقة راتان 4 قطع" },
      { en: "Kids Study Desk with Bookshelf Pink", ar: "مكتب دراسة أطفال مع رف كتب وردي" },
      { en: "Floating Shelf Set 3-Piece Walnut Wood", ar: "طقم رف عائم 3 قطع خشب جوز" },
      { en: "Entryway Bench with Shoe Storage Oak", ar: "مقعد مدخل مع تخزين أحذية أوك" },
      { en: "Ottoman Storage Pouf Tufted Navy", ar: "أوتومان تخزين بوف مسحوب كحلي" },
    ],
  },
  {
    name: "Beauty & Skincare",
    nameAr: "تجميل وعناية",
    priceMin: 15_000,
    priceMax: 500_000,
    products: [
      { en: "Dior Sauvage Eau de Parfum 100ml Men", ar: "ديور سوفاج أو دو بارفان 100مل رجالي" },
      { en: "Chanel N°5 Eau de Parfum 50ml Women", ar: "شانيل رقم 5 أو دو بارفان 50 مل نسائي" },
      { en: "Tom Ford Black Orchid EDP 100ml", ar: "توم فورد بلاك أوركيد 100 مل" },
      { en: "Viktor&Rolf Flowerbomb 100ml EDP Women", ar: "فيكتور رولف فلاور بومب 100 مل نسائي" },
      { en: "CeraVe Moisturizing Cream 454g Daily", ar: "سيراف كريم مرطب 454 جرام يومي" },
      { en: "The Ordinary Hyaluronic Acid 2%+B5 30ml", ar: "ذا أوردينري حمض هيالورونيك 2%+B5 30مل" },
      { en: "Neutrogena Hydro Boost Water Gel 50ml", ar: "نيوتروجينا هيدرو بوست جل ماء 50 مل" },
      { en: "L'Oréal Revitalift 1.5% Pure Hyaluronic", ar: "لوريال ريفيتاليفت هيالورونيك نقي 1.5%" },
      { en: "Dyson Supersonic Hair Dryer Fuchsia", ar: "مجفف شعر دايسون سوبرسونيك فوشيا" },
      { en: "ghd Platinum+ Smart Styler Straightener", ar: "مسوي شعر ghd بلاتينوم+ ذكي" },
      { en: "Maybelline New York Fit Me Matte Foundation", ar: "كريم أساس مايبلين نيو يورك فيت مي مات" },
      { en: "NYX Butter Gloss Lip Gloss Strawberry", ar: "مرطب شفاه NYX باتر جلوس فراولة" },
      { en: "Charlotte Tilbury Pillow Talk Lipstick", ar: "أحمر شفاه شارلوت تيلبوري بيلو توك" },
      { en: "Vitamin C Face Serum Brightening 30ml", ar: "سيرم فيتامين C مشرق للوجه 30 مل" },
      { en: "Retinol Night Cream Anti-Ageing 50ml", ar: "كريم ريتينول ليلي مضاد للشيخوخة 50 مل" },
      { en: "Sunscreen SPF 50+ Face Fluid 50ml", ar: "واقي شمس SPF 50+ سائل للوجه 50 مل" },
      { en: "Bioderma Micellar Water Sensibio 500ml", ar: "ماء ميسيلار بيوديرما 500 مل" },
      { en: "Eye Cream De-Puffing Caffeine Under Eye", ar: "كريم عيون مزيل انتفاخ بالكافيين" },
      { en: "Argan Oil Hair Mask Deep Conditioning 200ml", ar: "قناع شعر زيت أركان ترطيب عميق 200 مل" },
      { en: "Nail Polish Gel Long Wear Set 12 Colors", ar: "طلاء جل للأظافر طويل الأمد 12 لون" },
    ],
  },
  {
    name: "Sports & Fitness",
    nameAr: "رياضة ولياقة",
    priceMin: 25_000,
    priceMax: 1_500_000,
    products: [
      { en: "Adjustable Dumbbell Set 2.5–25kg Pair", ar: "طقم دمبل قابل للتعديل 2.5-25 كيلو زوج" },
      { en: "Yoga Mat Non-Slip 6mm Thick Purple", ar: "حصيرة يوغا 6 ملم سميكة أرجواني" },
      { en: "Resistance Bands Set 11pc 10–200lbs", ar: "طقم إيلاستيك مقاومة 11 قطعة 10-200 رطل" },
      { en: "Stationary Exercise Bike Magnetic 8-Level", ar: "دراجة ثابتة مغناطيسية 8 مستويات" },
      { en: "Treadmill Folding Electric 1.5HP", ar: "جهاز ووكر جري قابل للطي كهربائي 1.5 حصان" },
      { en: "Pull-Up Bar Doorframe Chin-Up No Screw", ar: "بار سحب دوارم للذقن بدون برغي" },
      { en: "Gym Gloves Weight Lifting Padded XL", ar: "قفازات جيم رفع أثقال مبطنة XL" },
      { en: "Protein Whey Chocolate 5lbs Optimum", ar: "بروتين واي شوكولاتة 5 رطل أوبتيمم" },
      { en: "BCAA Powder Fruit Punch 300g Scivation", ar: "مسحوق BCAA فروت بنش 300 جرام سكيفيشن" },
      { en: "Creatine Monohydrate Powder 500g", ar: "كرياتين مونوهيدرات مسحوق 500 جرام" },
      { en: "Jump Rope Speed Cable Bearing Handle", ar: "حبل قفز سرعة كيبل مع مقبض بيرنج" },
      { en: "Foam Roller Deep Tissue Massage 33cm", ar: "رولر إسفنجي مساج عميق 33 سم" },
      { en: "Battle Rope 15m Heavy Training", ar: "حبل تدريب بالتل روب 15 متر ثقيل" },
      { en: "Kettlebell Cast Iron 16kg Competition", ar: "كيتل بيل حديد صب 16 كيلو تنافسي" },
      { en: "Ab Roller Wheel Core Strengthening", ar: "عجلة تمرين البطن لتقوية العضلات الأساسية" },
      { en: "Swimming Goggles Anti-Fog UV Protection", ar: "نظارة سباحة ضد الضباب وحماية UV" },
      { en: "Boxing Gloves Leather 16oz Training", ar: "قفازات ملاكمة جلد 16 أوز للتدريب" },
      { en: "Cycling Helmet MIPS Road Lightweight", ar: "خوذة دراجة MIPS طرق خفيفة الوزن" },
      { en: "Football Official Match Ball Size 5", ar: "كرة قدم رسمية مباريات مقاس 5" },
      { en: "Basketball Spalding TF-1000 Indoor", ar: "كرة سلة سبالدينج TF-1000 داخلي" },
    ],
  },
];

interface CategoryDef {
  name: string;
  nameAr: string;
  priceMin: number;
  priceMax: number;
  products: { en: string; ar: string }[];
}

// ─── Arabic descriptions per category ────────────────────────────────────────

const DESCRIPTIONS: Record<string, string[]> = {
  "Electronics": [
    "جهاز إلكتروني فائق الجودة بتقنية حديثة ومتطورة. يوفر أداءً استثنائياً ومتانة عالية تناسب الاستخدام اليومي. مثالي للمنزل والمكتب مع ضمان رسمي.",
    "منتج إلكتروني مميز من الدرجة الأولى مع أحدث المواصفات التقنية. صُمِّم للمستخدمين المحترفين الذين يقدرون الجودة والأداء العالي.",
    "تقنية عالمية متقدمة في تصميم أنيق وعملي. يدمج بين الكفاءة والجمال ليمنحك تجربة استخدام لا مثيل لها في فئته السعرية.",
  ],
  "Mobile Phones": [
    "هاتف ذكي قوي بمعالج سريع وكاميرا احترافية تلتقط كل التفاصيل بدقة عالية. بطارية طويلة الأمد مع شحن سريع تجعله رفيق يومك المثالي.",
    "موبايل بمواصفات استثنائية وشاشة مبهرة بألوان حيوية. نظام التشغيل الأحدث مع ذاكرة داخلية واسعة لحفظ كل ذكرياتك.",
    "أحدث الهواتف الذكية بكاميرا متعددة العدسات وذكاء اصطناعي متكامل. مقاوم للماء والغبار مع تصميم فاخر يعكس شخصيتك.",
  ],
  "Laptops & Computers": [
    "لابتوب احترافي بمعالج فائق السرعة وذاكرة وصول عشوائي كبيرة لأداء مهام متعددة بسلاسة. مثالي للعمل والدراسة والترفيه.",
    "حاسوب محمول بشاشة واضحة عالية الدقة وبطارية تدوم طوال اليوم. يدعم أعباء العمل الثقيلة من تصميم وبرمجة وتحرير فيديو.",
    "جهاز كمبيوتر قوي للمحترفين والمبدعين. مع بطاقة رسومات متقدمة ومعالج من الجيل الأحدث، تجربة لا مثيل لها.",
  ],
  "Audio & Headphones": [
    "سماعات عالية الجودة بصوت نقي وعميق مع تقنية إلغاء الضوضاء النشطة. مريحة للارتداء ساعات طويلة مع عزل صوتي رائع.",
    "تجربة صوتية استثنائية بجهير قوي وصوت متوازن. مثالية للموسيقى والألعاب والمكالمات مع اتصال بلوتوث مستقر.",
    "سماعة لاسلكية فاخرة بصوت احترافي وتصميم مريح. بطارية تدوم 30+ ساعة مع حقيبة حمل أنيقة.",
  ],
  "Cameras": [
    "كاميرا احترافية بدقة صورة فائقة وسرعة تصوير عالية. مثالية للمصورين المحترفين والهواة الراغبين في الارتقاء بمستواهم.",
    "كاميرا ديجيتال بتقنية متطورة ومنظومة تثبيت صورة قوية. تلتقط اللحظات الحية بألوان طبيعية ودقة عالية.",
    "جهاز تصوير احترافي بعدسة قابلة للتبديل وشاشة تعمل باللمس. مناسب للتصوير في الظروف الصعبة مع غلاف مقاوم للماء.",
  ],
  "Men's Clothing": [
    "قطعة ملابس رجالية راقية من أفضل الأقمشة وبخياطة محكمة تمنحك إطلالة متميزة في كل مناسبة. سهل العناية ويحافظ على شكله بعد الغسيل.",
    "ملابس رجالية فاخرة بقصة عصرية مريحة. تناسب المناسبات الرسمية والكاجوال مع ضمان الجودة العالية.",
    "تصميم أنيق وعملي بقماش مريح يناسب مختلف درجات الحرارة. المثالي للرجل العصري الذي يهتم بمظهره.",
  ],
  "Women's Clothing": [
    "ملابس نسائية أنيقة من أرقى الأقمشة بتصميم عصري يناسب مختلف المناسبات. تبرز الأنوثة بأسلوب راقٍ ومميز.",
    "قطعة ملابس نسائية فاخرة بخياطة دقيقة وألوان جذابة. مريحة للارتداء وتناسب المرأة العصرية في كل أوقات اليوم.",
    "تصميم مستوحى من أحدث صيحات الموضة العالمية بلمسة شرقية أصيلة. قماش ناعم وخفيف مثالي لمختلف المناسبات.",
  ],
  "Shoes & Footwear": [
    "حذاء عالي الجودة بنعل مريح ومادة متينة تضمن الراحة طوال اليوم. تصميم عصري يناسب الاستخدام اليومي والمناسبات.",
    "حذاء أنيق بجلد طبيعي فاخر يوفر راحة استثنائية. مصمم لتحمل الاستخدام اليومي مع الحفاظ على المظهر الأنيق.",
    "أحذية مريحة بتقنية تامورتيشن متطورة تحمي قدمك وتمنحك الراحة الكاملة. مناسبة للمشي الطويل والاستخدام الرياضي.",
  ],
  "Watches & Jewelry": [
    "ساعة أنيقة بتصميم فاخر ودقة عالية. تجمع بين الجمال والوظيفة مع آلية موثوقة وزجاج مقاوم للخدش.",
    "مجوهرات راقية من أفضل المعادن والأحجار الكريمة. تصميم خالد يناسب جميع المناسبات ويضيف لمسة من الأناقة.",
    "قطعة مجوهرات استثنائية بتصميم فريد ومواد عالية الجودة. هدية مثالية لمن تحب في المناسبات الخاصة.",
  ],
  "Home & Kitchen": [
    "جهاز مطبخ عصري بتقنية متطورة يوفر وقتك ويسهل طهي وجباتك المفضلة. تصميم أنيق يضيف جمالاً لمطبخك.",
    "أدوات منزلية عالية الجودة من مواد آمنة ومعتمدة. مريحة الاستخدام وسهلة التنظيف، المثالية لكل بيت.",
    "منتج منزلي متعدد الاستخدامات بتصميم ذكي يوفر المساحة ويزيد كفاءة عملك في المطبخ.",
  ],
  "Furniture": [
    "أثاث فاخر من أجود أنواع الخشب والمواد عالية الجودة. تصميم عصري يضفي على منزلك طابعاً أنيقاً ومريحاً.",
    "قطعة أثاث راقية بخياطة متقنة وأقمشة ناعمة. مريحة ومتينة تصمد لسنوات طويلة مع الحفاظ على شكلها الأنيق.",
    "أثاث عملي وأنيق يجمع بين الجمال والوظيفة. سهل التركيب مع تعليمات واضحة ويناسب مختلف أذواق الديكور.",
  ],
  "Beauty & Skincare": [
    "منتج تجميل فاخر بمكونات طبيعية عالية الجودة. يمنح بشرتك النضارة والإشراقة ويحمي من علامات التقدم في السن.",
    "عطر رائع بتركيبة مميزة تدوم طويلاً وتلفت الأنظار. مستوحى من أفخر المكونات الطبيعية من حول العالم.",
    "مستحضر تجميل طبيعي آمن وفعّال مختبر ومعتمد. يناسب جميع أنواع البشرة ويمنحك نتائج ملحوظة من الأسبوع الأول.",
  ],
  "Sports & Fitness": [
    "معدات رياضية احترافية من أفضل المواد لتدريب فعّال وآمن. مصممة لتحمل الاستخدام المكثف وتحقيق أهدافك الرياضية.",
    "أدوات لياقة بدنية متطورة تساعدك على تحقيق أهدافك الرياضية بسرعة. مريحة الاستخدام للمبتدئين والمحترفين على حد سواء.",
    "معدات رياضة عالية الجودة بتصميم ارغونوميكي مريح. مثالية للاستخدام المنزلي وفي الصالات الرياضية.",
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProduct(cat: CategoryDef, variant: number, sellerIds: number[]) {
  const base = cat.products[variant % cat.products.length]!;
  // Add a variant suffix every time we cycle through all base names
  const cycle = Math.floor(variant / cat.products.length);
  const suffixes = [
    "", " Pro", " Plus", " Max", " Lite", " SE", " 2024", " 2025", " Edition", " V2",
    " II", " Premium", " Select", " Ultra", " X", " Mini", " Classic", " Sport", " Air", " Neo",
  ];
  const suffix = cycle > 0 ? (suffixes[cycle % suffixes.length] ?? "") : "";

  const name = base.en + suffix;
  const nameAr = base.ar + (suffix ? " " + suffix : "");
  const price = rnd(cat.priceMin, cat.priceMax);
  const discount = Math.random() < 0.25 ? rnd(5, 40) : null;
  const stock = rnd(0, 200);
  const sellerId = pick(sellerIds);
  const imageSlug = slug(name + "-" + variant);
  const imageUrl = `https://picsum.photos/seed/${imageSlug}/400/400`;
  const desc = pick(DESCRIPTIONS[cat.name] ?? DESCRIPTIONS["Electronics"]!);
  const tokens = [name, nameAr, cat.name, cat.nameAr].join(" ").toLowerCase();

  return { name, nameAr, desc, price, discount, stock, sellerId, imageUrl, cat: cat.name, tokens };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { rows: countRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM products`,
  );
  const existing = parseInt(countRows[0]?.c ?? "0", 10);

  if (existing >= 1000) {
    console.log(`[seed] Already have ${existing} products — skipping. Delete products first if you want to re-seed.`);
    await pool.end();
    return;
  }

  console.log(`[seed] Starting: ${existing} existing products. Target: ${TARGET}`);

  // Verify sellers exist
  const { rows: sellerRows } = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE role='seller' ORDER BY id`,
  );
  const sellerIds = sellerRows.map((r) => r.id);
  if (sellerIds.length === 0) {
    console.error("[seed] No sellers found — cannot seed products. Start the API server first.");
    await pool.end();
    return;
  }
  console.log(`[seed] Found ${sellerIds.length} sellers: [${sellerIds.join(", ")}]`);

  // Build product list
  const perCat = Math.ceil(TARGET / CATEGORIES.length);
  const allProducts: ReturnType<typeof makeProduct>[] = [];

  for (const cat of CATEGORIES) {
    for (let i = 0; i < perCat; i++) {
      allProducts.push(makeProduct(cat, i, sellerIds));
    }
  }

  // Shuffle
  for (let i = allProducts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allProducts[i], allProducts[j]] = [allProducts[j]!, allProducts[i]!];
  }

  const toInsert = allProducts.slice(0, TARGET - existing);
  console.log(`[seed] Will insert ${toInsert.length} products in batches of ${BATCH_SIZE}`);

  let inserted = 0;
  let failed = 0;
  const start = Date.now();

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);

    const values: string[] = [];
    const params: (string | number | null)[] = [];
    let pIdx = 1;

    for (const p of batch) {
      values.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`,
      );
      params.push(
        p.sellerId, p.name, p.nameAr, p.desc,
        p.price, p.discount, p.cat, p.stock,
        p.imageUrl, p.tokens,
      );
    }

    const sql = `
      INSERT INTO products
        (seller_id, name, name_ar, description, price, discount_percent, category, stock, image_url, search_tokens)
      VALUES ${values.join(", ")}
    `;

    try {
      await pool.query(sql, params);
      inserted += batch.length;
    } catch (err) {
      console.error(`[seed] Batch ${i}–${i + BATCH_SIZE} failed:`, (err as Error).message.slice(0, 200));
      failed += batch.length;
    }

    if (inserted % 2500 === 0 || i + BATCH_SIZE >= toInsert.length) {
      const pct = ((inserted / toInsert.length) * 100).toFixed(1);
      console.log(`[seed] Seeded ${inserted}/${toInsert.length} (${pct}%) — failed: ${failed}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[seed] Done in ${elapsed}s — inserted: ${inserted}, failed: ${failed}`);

  const { rows: final } = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM products`);
  console.log(`[seed] Total products in DB: ${final[0]?.c}`);

  await pool.end();
}

main().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
