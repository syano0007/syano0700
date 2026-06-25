#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Seller IDs by category ──────────────────────────────────────────────────
// 2=Syano Test Store, 4=Ahmad Electronics, 5=Nour Fashion, 6=Beit Al-Nour, 7=Hana Beauty
const SELLERS = {
  Electronics:      [4, 2],
  Fashion:          [5, 2],
  'Home & Living':  [6, 2],
  Beauty:           [7, 2],
  'Sports & Fitness': [2, 4],
  'Toys & Kids':    [5, 6],
  Books:            [6, 2],
  'Food & Grocery': [7, 6],
  Jewelry:          [2, 5],
};

// ─── Pexels image pools by category ──────────────────────────────────────────
const BASE = 'https://images.pexels.com/photos';
const Q = '?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop';
const img = (id) => `${BASE}/${id}/pexels-photo-${id}.jpeg${Q}`;

const IMAGES = {
  Electronics:      [699122,18105,190819,1649771,3394650,1496181,2582937,1714208,3747535,4526401,1474557,3945666,1528360,1779487,1640777].map(img),
  Fashion:          [1536619,2220316,1078958,1152077,1462637,2529148,2220280,1926769,6149284,1651838,3622608,2112651,1124468,2220323,3621240].map(img),
  'Home & Living':  [1648374,1571460,1080721,4397341,4352247,1080700,2635392,3773571,3825517,1400172,2343467,1350789,1839919,1034584,4021992].map(img),
  Beauty:           [3685523,3738379,2533266,3616233,3059609,4041392,3755698,2526105,3621241,2639941,2533092,4397344,965989,2310856,3685524].map(img),
  'Sports & Fitness':[1552236,3912952,1153370,4498480,3076509,3621242,2505026,3823488,2468927,4397345,1552247,1639557,3912953,2317896,3394651].map(img),
  'Toys & Kids':    [3661270,3847042,3847043,3847044,3847045,2253275,3661276,3661277,3661278,3847046].map(img),
  Books:            [1130980,1181671,159711,590493,1181674,1181672,590016,1907785,2908984,1029243].map(img),
  'Food & Grocery': [1640777,1029757,4021992,2142633,1435735,1640780,1640781,1640782,1640783,1640784].map(img),
  Jewelry:          [5442799,1191531,1458457,3266304,2735980,1458458,1458459,1400172,3752813,1458460].map(img),
};

const pickImg = (cat, i) => {
  const pool = IMAGES[cat] || IMAGES.Electronics;
  return pool[i % pool.length];
};

// ─── Price ranges by category (SYP) ──────────────────────────────────────────
const PRICE_RANGE = {
  Electronics:      [50000, 2000000],
  Fashion:          [15000, 250000],
  'Home & Living':  [20000, 800000],
  Beauty:           [8000, 150000],
  'Sports & Fitness': [10000, 300000],
  'Toys & Kids':    [5000, 120000],
  Books:            [3000, 50000],
  'Food & Grocery': [2000, 40000],
  Jewelry:          [30000, 500000],
};

const randPrice = (cat) => {
  const [lo, hi] = PRICE_RANGE[cat];
  return (Math.floor(Math.random() * ((hi - lo) / 1000)) * 1000 + lo).toFixed(2);
};

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Product generation tables ────────────────────────────────────────────────

// ELECTRONICS (1000 products)
const elecBrands = ['سامسونج','آبل','هواوي','شاومي','أوبو','نوكيا','سوني','إل جي','ديل','لينوفو','أسوس','HP','ريلمي','ون بلس','موتورولا','فيفو'];
const elecBrandsEn = ['Samsung','Apple','Huawei','Xiaomi','Oppo','Nokia','Sony','LG','Dell','Lenovo','ASUS','HP','Realme','OnePlus','Motorola','Vivo'];
const phones = [
  ['جالاكسي A54 5G','Galaxy A54 5G'],['جالاكسي S24 Ultra','Galaxy S24 Ultra'],['جالاكسي A34','Galaxy A34'],
  ['جالاكسي S23 FE','Galaxy S23 FE'],['جالاكسي A14','Galaxy A14'],['آيفون 15 برو ماكس','iPhone 15 Pro Max'],
  ['آيفون 15 برو','iPhone 15 Pro'],['آيفون 15','iPhone 15'],['آيفون 14','iPhone 14'],['آيفون 13','iPhone 13'],
  ['P60 برو','P60 Pro'],['نوفا 11','Nova 11'],['ميت 60 برو','Mate 60 Pro'],['ريدمي نوت 13 برو','Redmi Note 13 Pro'],
  ['ريدمي نوت 12','Redmi Note 12'],['مي 14 برو','Mi 14 Pro'],['A78 5G','A78 5G'],['A57','A57'],
  ['A17 Pro','A17 Pro'],['G54 5G','G54 5G'],['G84','G84'],['X90 Pro','X90 Pro'],['X70 Pro','X70 Pro'],
  ['ريلمي 11 برو','Realme 11 Pro'],['ريلمي C55','Realme C55'],['11 برو','11 Pro'],['11T برو','11T Pro'],
];
const storages = ['64GB','128GB','256GB','512GB','1TB'];
const colors = ['أسود','أبيض','رمادي','فضي','ذهبي','أزرق','أخضر','بنفسجي','وردي','تيتانيوم'];
const colorsEn = ['Black','White','Gray','Silver','Gold','Blue','Green','Purple','Pink','Titanium'];

const laptops = [
  ['IdeaPad 3','IdeaPad 3'],['IdeaPad 5','IdeaPad 5'],['ThinkPad E15','ThinkPad E15'],
  ['Pavilion 15','Pavilion 15'],['Victus 16','Victus 16'],['ZenBook 14','ZenBook 14'],
  ['VivoBook 15','VivoBook 15'],['ProBook 450','ProBook 450'],['XPS 15','XPS 15'],
  ['Inspiron 15','Inspiron 15'],['MacBook Air M2','MacBook Air M2'],['MacBook Pro 14','MacBook Pro 14'],
  ['MateBook D16','MateBook D16'],['MateBook X Pro','MateBook X Pro'],['Swift 3','Swift 3'],
  ['Aspire 5','Aspire 5'],['V14 G4','V14 G4'],['LOQ 15','LOQ 15'],['الألعاب G15','Gaming G15'],
];
const cpus = ['كور i3','كور i5','كور i7','كور i9','رايزن 5','رايزن 7','Apple M2','Apple M3'];
const rams = ['8 رام','16 رام','32 رام'];
const ssdSizes = ['256 SSD','512 SSD','1TB SSD'];

const accessories = [
  ['سماعة لاسلكية','Wireless Headphone'],['سماعة بلوتوث','Bluetooth Earbuds'],
  ['ساعة ذكية','Smartwatch'],['شاشة','Monitor'],['كيبورد ميكانيكي','Mechanical Keyboard'],
  ['ماوس لاسلكي','Wireless Mouse'],['راوتر واي فاي','WiFi Router'],['شاحن سريع','Fast Charger'],
  ['كابل شحن','Charging Cable'],['باور بانك','Power Bank'],['طابعة','Printer'],
  ['كاميرا ويب','Webcam'],['ميكروفون','Microphone'],['مكبر صوت بلوتوث','Bluetooth Speaker'],
  ['تابلت','Tablet'],['قارئ إلكتروني','E-Reader'],['جهاز بلايستيشن 5','PlayStation 5'],
  ['جهاز إكس بوكس','Xbox'],['كاميرا رقمية','Digital Camera'],['درون','Drone'],
];
const accSpecs = ['أسود','أبيض','رمادي','أحمر','أزرق'];
const accBrands = ['سوني','لوجيتك','جابرا','بوس','أنكر','سامسونج','آبل','هواوي','شاومي','راذرماستر','هايبرX','ستيلسيريز'];

function* electronicsGen(count) {
  let n = 0;
  const phoneCount = Math.floor(count * 0.35);
  const laptopCount = Math.floor(count * 0.2);
  const accCount = count - phoneCount - laptopCount;

  for (let i = 0; n < phoneCount; i++, n++) {
    const brand = elecBrands[i % elecBrands.length];
    const brandEn = elecBrandsEn[i % elecBrandsEn.length];
    const [modelAr, modelEn] = phones[i % phones.length];
    const storage = storages[Math.floor(i / phones.length) % storages.length];
    const color = colors[Math.floor(i / 5) % colors.length];
    const colorEn = colorsEn[Math.floor(i / 5) % colorsEn.length];
    yield {
      name: `${brandEn} ${modelEn} ${storage} ${colorEn}`,
      name_ar: `${brand} ${modelAr} — ${storage} — ${color}`,
      subcategory: 'Smartphones',
      search_tokens: `هاتف ذكي ${brand} ${modelAr} موبايل جوال ${storage} ${brandEn} smartphone mobile phone android ${modelEn.toLowerCase()}`,
      descAr: `هاتف ${brand} ${modelAr} بسعة تخزينية ${storage} بلون ${color}. يتميز بمعالج قوي وشاشة عالية الدقة وبطارية طويلة الأمد. مثالي للاستخدام اليومي والتصوير الاحترافي. يدعم شبكات 5G وواجهة مستخدم عربية. يأتي مع ضمان سنة.`,
      descEn: `${brandEn} ${modelEn} with ${storage} storage in ${colorEn}. Features high-res display, powerful processor, and long battery life. Supports 5G networks.`,
      price: randPrice('Electronics'),
    };
  }
  for (let i = 0; n < phoneCount + laptopCount; i++, n++) {
    const brand = ['لينوفو','HP','ديل','أسوس','آبل','هواوي','أسر'][i % 7];
    const brandEn = ['Lenovo','HP','Dell','ASUS','Apple','Huawei','Acer'][i % 7];
    const [modelAr, modelEn] = laptops[i % laptops.length];
    const cpu = cpus[i % cpus.length];
    const ram = rams[i % rams.length];
    const ssd = ssdSizes[i % ssdSizes.length];
    yield {
      name: `${brandEn} ${modelEn} ${cpu.replace('كور ','Core ').replace('رايزن ','Ryzen ')} ${ram.replace(' رام',' RAM')} ${ssd}`,
      name_ar: `لابتوب ${brand} ${modelAr} — ${cpu} — ${ram} — ${ssd}`,
      subcategory: 'Laptops',
      search_tokens: `لابتوب حاسوب محمول ${brand} ${modelAr} ${cpu} laptop computer notebook ${brandEn} ${modelEn}`,
      descAr: `لابتوب ${brand} ${modelAr} بمعالج ${cpu} وذاكرة عشوائية ${ram} وقرص صلب ${ssd}. مثالي للعمل والدراسة والألعاب الخفيفة. شاشة 15.6 بوصة Full HD. يعمل بنظام ويندوز 11. يأتي مع حقيبة حمل مجانية.`,
      descEn: `${brandEn} ${modelEn} laptop with ${cpu.replace('كور ','Core ').replace('رايزن ','Ryzen ')} processor, ${ram.replace(' رام',' RAM')}, ${ssd}. 15.6" Full HD display, Windows 11.`,
      price: randPrice('Electronics'),
    };
  }
  for (let i = 0; n < count; i++, n++) {
    const [typeAr, typeEn] = accessories[i % accessories.length];
    const brand = accBrands[Math.floor(i / accessories.length) % accBrands.length];
    const brandEn = ['Sony','Logitech','Jabra','Bose','Anker','Samsung','Apple','Huawei','Xiaomi','Razer','HyperX','SteelSeries'][Math.floor(i / accessories.length) % 12];
    const spec = accSpecs[i % accSpecs.length];
    const specEn = ['Black','White','Gray','Red','Blue'][i % 5];
    yield {
      name: `${brandEn} ${typeEn} ${specEn} ${i % 20 === 0 ? 'Pro' : i % 15 === 0 ? 'Plus' : ''}`.trim(),
      name_ar: `${typeAr} ${brand} — ${spec}`,
      subcategory: typeEn === 'Smartwatch' ? 'Smartwatches' : typeEn.includes('Headphone') || typeEn.includes('Earbuds') ? 'Headphones' : 'Accessories',
      search_tokens: `${typeAr} ${brand} اكسسوار الكترونيات ${typeEn.toLowerCase()} ${brandEn.toLowerCase()} electronics`,
      descAr: `${typeAr} ${brand} بجودة عالية ومتانة ممتازة. ${spec} اللون مع تصميم أنيق وعصري. يوفر أداءً احترافياً ومريحاً للاستخدام اليومي. ضمان سنة كاملة.`,
      descEn: `${brandEn} ${typeEn} in ${specEn}. High quality, durable design. Professional performance for daily use. 1 year warranty.`,
      price: randPrice('Electronics'),
    };
  }
}

// FASHION (1000 products)
const fashionTypes = [
  ['قميص رجالي','Men\'s Shirt','Shirts','ملابس رجالية'],
  ['تيشيرت رجالي','Men\'s T-Shirt','T-Shirts','ملابس رجالية'],
  ['بنطلون جينز رجالي','Men\'s Jeans','Pants','ملابس رجالية'],
  ['بنطلون قماش رجالي','Men\'s Trousers','Pants','ملابس رجالية'],
  ['جاكيت رجالي','Men\'s Jacket','Jackets','ملابس رجالية'],
  ['بلوزة رجالي','Men\'s Hoodie','Hoodies','ملابس رجالية'],
  ['فستان سهرة نسائي','Women\'s Evening Dress','Dresses','ملابس نسائية'],
  ['فستان كاجوال نسائي','Women\'s Casual Dress','Dresses','ملابس نسائية'],
  ['بلوزة نسائية','Women\'s Blouse','Tops','ملابس نسائية'],
  ['تيشيرت نسائي','Women\'s T-Shirt','Tops','ملابس نسائية'],
  ['بنطلون نسائي','Women\'s Pants','Pants','ملابس نسائية'],
  ['تنورة نسائية','Women\'s Skirt','Skirts','ملابس نسائية'],
  ['عباية نسائية','Women\'s Abaya','Abayas','ملابس نسائية'],
  ['حجاب نسائي','Women\'s Hijab','Hijabs','ملابس نسائية'],
  ['حذاء رياضي رجالي','Men\'s Sneakers','Shoes','أحذية'],
  ['حذاء رسمي رجالي','Men\'s Formal Shoes','Shoes','أحذية'],
  ['حذاء نسائي كعب عالي','Women\'s Heels','Shoes','أحذية'],
  ['حذاء رياضي نسائي','Women\'s Sneakers','Shoes','أحذية'],
  ['صندل نسائي','Women\'s Sandals','Shoes','أحذية'],
  ['حقيبة يد نسائية','Women\'s Handbag','Bags','حقائب'],
  ['حقيبة ظهر','Backpack','Bags','حقائب'],
  ['حقيبة سفر','Travel Bag','Bags','حقائب'],
  ['محفظة رجالية','Men\'s Wallet','Accessories','إكسسوارات'],
  ['نظارة شمسية','Sunglasses','Accessories','إكسسوارات'],
  ['ساعة رجالية','Men\'s Watch','Accessories','إكسسوارات'],
  ['ساعة نسائية','Women\'s Watch','Accessories','إكسسوارات'],
  ['حزام جلدي','Leather Belt','Accessories','إكسسوارات'],
  ['وشاح','Scarf','Accessories','إكسسوارات'],
];
const fashColors = ['أبيض','أسود','رمادي','أزرق','كحلي','أخضر','بيج','بني','أحمر','وردي','بنفسجي','كريمي','خردلي','زيتي'];
const fashColorsEn = ['White','Black','Gray','Blue','Navy','Green','Beige','Brown','Red','Pink','Purple','Cream','Mustard','Olive'];
const fashSizes = ['XS','S','M','L','XL','XXL'];
const fashSizesNum = ['36','38','40','42','44','46'];
const fashMaterials = ['قطن','بوليستر','جلد','قطن مزيج','كتان','حرير'];
const fashMaterialsEn = ['Cotton','Polyester','Leather','Cotton Blend','Linen','Silk'];
const fashBrands = ['نايك','أديداس','بوما','ريبوك','زارا','H&M','ليفايز','ووك','بدجيت'];
const fashBrandsEn = ['Nike','Adidas','Puma','Reebok','Zara','H&M','Levi\'s','Wok','Budget'];

function* fashionGen(count) {
  for (let i = 0; i < count; i++) {
    const [typeAr, typeEn, subEn, subAr] = fashionTypes[i % fashionTypes.length];
    const colorAr = fashColors[Math.floor(i / fashionTypes.length) % fashColors.length];
    const colorEn = fashColorsEn[Math.floor(i / fashionTypes.length) % fashColorsEn.length];
    const size = i % 3 === 0 ? fashSizes[i % fashSizes.length] : fashSizesNum[i % fashSizesNum.length];
    const matAr = fashMaterials[i % fashMaterials.length];
    const matEn = fashMaterialsEn[i % fashMaterialsEn.length];
    const brand = fashBrands[Math.floor(i / 30) % fashBrands.length];
    const brandEn = fashBrandsEn[Math.floor(i / 30) % fashBrandsEn.length];
    yield {
      name: `${brandEn} ${typeEn} ${colorEn} ${size} ${matEn}`,
      name_ar: `${typeAr} ${brand} — ${colorAr} — مقاس ${size} — ${matAr}`,
      subcategory: subEn,
      search_tokens: `${typeAr} ${subAr} ملابس موضة ${colorAr} ${matAr} ${brand} ${typeEn.toLowerCase()} fashion clothing ${colorEn.toLowerCase()} ${brandEn.toLowerCase()}`,
      descAr: `${typeAr} من ${brand} بلون ${colorAr} ومقاس ${size} مصنوع من خامة ${matAr} عالية الجودة. تصميم أنيق يناسب المناسبات اليومية. سهل الغسيل والعناية. متوفر بعدة مقاسات وألوان.`,
      descEn: `${brandEn} ${typeEn} in ${colorEn}, size ${size}, made from premium ${matEn}. Elegant design suitable for daily wear. Easy care and machine washable.`,
      price: randPrice('Fashion'),
    };
  }
}

// HOME & LIVING (800 products)
const homeTypes = [
  ['أريكة','Sofa','Furniture'],['كرسي','Chair','Furniture'],['طاولة قهوة','Coffee Table','Furniture'],
  ['طاولة طعام','Dining Table','Furniture'],['خزانة ملابس','Wardrobe','Furniture'],['رف كتب','Bookshelf','Furniture'],
  ['سرير','Bed Frame','Furniture'],['مرتبة','Mattress','Furniture'],['مفرش سرير','Bedsheet Set','Bedding'],
  ['غطاء لحاف','Duvet Cover','Bedding'],['وسادة','Pillow','Bedding'],['بطانية','Blanket','Bedding'],
  ['ستارة','Curtains','Textiles'],['سجادة','Carpet','Textiles'],['مفرش طاولة','Table Runner','Textiles'],
  ['غلاية كهربائية','Electric Kettle','Kitchen'],['مكنسة كهربائية','Vacuum Cleaner','Appliances'],
  ['مكواة','Steam Iron','Appliances'],['مروحة','Fan','Appliances'],['مدفأة كهربائية','Electric Heater','Appliances'],
  ['مكيف صغير','Portable AC','Appliances'],['خلاط كهربائي','Blender','Kitchen'],
  ['قدر ضغط','Pressure Cooker','Kitchen'],['مقلاة تيفال','Non-stick Pan','Kitchen'],
  ['طقم أواني طبخ','Cookware Set','Kitchen'],['فرن كهربائي','Electric Oven','Kitchen'],
  ['مصباح ليلي','Night Lamp','Decor'],['إطار صورة','Photo Frame','Decor'],
  ['لوحة جدارية','Wall Art','Decor'],['مزهرية','Vase','Decor'],
];
const homeColors = ['بيج','رمادي','أبيض','أسود','بني','كريمي','أزرق','زيتي','خردلي'];
const homeColorsEn = ['Beige','Gray','White','Black','Brown','Cream','Blue','Olive','Mustard'];
const homeSizes = ['صغير','وسط','كبير','XL'];
const homeSizesEn = ['Small','Medium','Large','XL'];
const homeMaterials = ['خشب','معدن','قماش','بلاستيك','جلد صناعي','ستانلس ستيل'];
const homeMaterialsEn = ['Wood','Metal','Fabric','Plastic','Faux Leather','Stainless Steel'];

function* homeGen(count) {
  for (let i = 0; i < count; i++) {
    const [typeAr, typeEn, subEn] = homeTypes[i % homeTypes.length];
    const colorAr = homeColors[Math.floor(i / homeTypes.length) % homeColors.length];
    const colorEn = homeColorsEn[Math.floor(i / homeTypes.length) % homeColorsEn.length];
    const sizeAr = homeSizes[i % homeSizes.length];
    const sizeEn = homeSizesEn[i % homeSizesEn.length];
    const matAr = homeMaterials[i % homeMaterials.length];
    const matEn = homeMaterialsEn[i % homeMaterialsEn.length];
    yield {
      name: `${typeEn} ${colorEn} ${sizeEn} ${matEn} Design ${Math.floor(i / homeTypes.length) + 1}`,
      name_ar: `${typeAr} — ${colorAr} — ${sizeAr} — ${matAr} — طراز ${Math.floor(i / homeTypes.length) + 1}`,
      subcategory: subEn,
      search_tokens: `${typeAr} ${subEn.toLowerCase()} منزل ديكور اثاث ${colorAr} ${matAr} home furniture decor ${typeEn.toLowerCase()} ${colorEn.toLowerCase()}`,
      descAr: `${typeAr} بلون ${colorAr} ومقاس ${sizeAr} مصنوع من خامة ${matAr}. تصميم عصري يناسب الديكور الحديث. سهل التركيب ومتين للاستخدام الطويل. مناسب لغرف المعيشة وغرف النوم.`,
      descEn: `${typeEn} in ${colorEn}, ${sizeEn} size, made from ${matEn}. Modern design suitable for contemporary homes. Easy assembly and durable for long-term use.`,
      price: randPrice('Home & Living'),
    };
  }
}

// BEAUTY (700 products)
const beautyTypes = [
  ['كريم مرطب','Moisturizer Cream','Skincare'],['سيروم فيتامين سي','Vitamin C Serum','Skincare'],
  ['واقي شمسي','Sunscreen SPF 50','Skincare'],['تونر منظف','Facial Toner','Skincare'],
  ['ماسك وجه','Face Mask','Skincare'],['كريم حول العيون','Eye Cream','Skincare'],
  ['غسول وجه','Facial Cleanser','Skincare'],['زيت أرغان','Argan Oil','Haircare'],
  ['شامبو','Shampoo','Haircare'],['بلسم شعر','Conditioner','Haircare'],
  ['ماسك شعر','Hair Mask','Haircare'],['سيروم شعر','Hair Serum','Haircare'],
  ['أحمر شفاه','Lipstick','Makeup'],['كحل','Eyeliner','Makeup'],
  ['ريميل','Mascara','Makeup'],['فاونديشن','Foundation','Makeup'],
  ['بلاشر','Blush','Makeup'],['ظلال عيون','Eyeshadow Palette','Makeup'],
  ['عطر رجالي','Men\'s Perfume','Fragrance'],['عطر نسائي','Women\'s Perfume','Fragrance'],
  ['كريم جسم','Body Lotion','Body Care'],['سكراب جسم','Body Scrub','Body Care'],
  ['مزيل عرق','Deodorant','Body Care'],['صابون','Soap Bar','Body Care'],
  ['طلاء أظافر','Nail Polish','Nails'],['مزيل طلاء','Nail Polish Remover','Nails'],
];
const beautyBrands = ['نيفيا','لوريال','جارنييه','أوليه','سيتافيل','لافيب','ديف','سيلشيان','ماكس فاكتور','ريفلون','ماي بيلا','بانتين','هيد أند شولدر'];
const beautyBrandsEn = ['Nivea','L\'Oreal','Garnier','Olay','Cetaphil','La Roche','Dove','Physician\'s','Max Factor','Revlon','Maybelline','Pantene','Head & Shoulders'];
const beautyVariants = ['للبشرة الدهنية','للبشرة الجافة','للبشرة الحساسة','للبشرة المختلطة','للشعر الجاف','للشعر الدهني'];
const beautyVariantsEn = ['Oily Skin','Dry Skin','Sensitive Skin','Combination Skin','Dry Hair','Oily Hair'];

function* beautyGen(count) {
  for (let i = 0; i < count; i++) {
    const [typeAr, typeEn, subEn] = beautyTypes[i % beautyTypes.length];
    const brand = beautyBrands[Math.floor(i / beautyTypes.length) % beautyBrands.length];
    const brandEn = beautyBrandsEn[Math.floor(i / beautyTypes.length) % beautyBrandsEn.length];
    const varAr = beautyVariants[i % beautyVariants.length];
    const varEn = beautyVariantsEn[i % beautyVariantsEn.length];
    const size = ['50ml','100ml','150ml','200ml','250ml'][i % 5];
    yield {
      name: `${brandEn} ${typeEn} ${varEn} ${size}`,
      name_ar: `${typeAr} ${brand} ${varAr} — ${size}`,
      subcategory: subEn,
      search_tokens: `${typeAr} ${subEn.toLowerCase()} جمال عناية ${brand} ${varAr} beauty skincare cosmetics ${typeEn.toLowerCase()} ${brandEn.toLowerCase()}`,
      descAr: `${typeAr} من ${brand} ${varAr} بحجم ${size}. تركيبة متطورة غنية بالمكونات الطبيعية لترطيب وتغذية البشرة. خالٍ من البارابين والمواد الضارة. مناسب للاستخدام اليومي.`,
      descEn: `${brandEn} ${typeEn} for ${varEn}, ${size}. Advanced formula with natural ingredients. Paraben-free and dermatologist tested. Suitable for daily use.`,
      price: randPrice('Beauty'),
    };
  }
}

// SPORTS (600 products)
const sportsTypes = [
  ['حذاء رياضي للجري','Running Shoes','Footwear'],['حذاء كرة قدم','Football Boots','Footwear'],
  ['حذاء كرة سلة','Basketball Shoes','Footwear'],['حذاء تدريب','Training Shoes','Footwear'],
  ['قميص رياضي','Sports Jersey','Clothing'],['شورت رياضي','Sports Shorts','Clothing'],
  ['بدلة رياضية','Tracksuit','Clothing'],['تيشيرت رياضي','Sports T-Shirt','Clothing'],
  ['حصيرة يوغا','Yoga Mat','Equipment'],['دمبل','Dumbbells Set','Equipment'],
  ['حبل تمرين','Jump Rope','Equipment'],['شريط مقاومة','Resistance Bands','Equipment'],
  ['كرة قدم','Football','Equipment'],['كرة سلة','Basketball','Equipment'],
  ['كرة تنس','Tennis Balls','Equipment'],['مضرب تنس','Tennis Racket','Equipment'],
  ['دراجة ثابتة','Exercise Bike','Equipment'],['جهاز تجديف','Rowing Machine','Equipment'],
  ['حقيبة رياضية','Sports Bag','Accessories'],['قارورة مياه رياضية','Sports Water Bottle','Accessories'],
  ['رباط ركبة','Knee Support','Accessories'],['قفاز جيم','Gym Gloves','Accessories'],
  ['حزام ظهر رياضي','Weightlifting Belt','Accessories'],['سماعة رياضية','Sports Earbuds','Accessories'],
  ['ساعة رياضية','Sports Watch','Accessories'],['مقياس ضغط','Blood Pressure Monitor','Health'],
];
const sportsBrands = ['نايك','أديداس','بوما','ريبوك','أندر أرمر','ديكاتلون','سبيدو','ويلسون','هيد','يونكس'];
const sportsBrandsEn = ['Nike','Adidas','Puma','Reebok','Under Armour','Decathlon','Speedo','Wilson','Head','Yonex'];
const sportsColors = ['أسود','أبيض','أزرق','أحمر','أخضر','رمادي','برتقالي'];
const sportsColorsEn = ['Black','White','Blue','Red','Green','Gray','Orange'];
const sportsSizes = ['36','37','38','39','40','41','42','43','44','45','S','M','L','XL','XXL'];

function* sportsGen(count) {
  for (let i = 0; i < count; i++) {
    const [typeAr, typeEn, subEn] = sportsTypes[i % sportsTypes.length];
    const brand = sportsBrands[Math.floor(i / sportsTypes.length) % sportsBrands.length];
    const brandEn = sportsBrandsEn[Math.floor(i / sportsTypes.length) % sportsBrandsEn.length];
    const colorAr = sportsColors[i % sportsColors.length];
    const colorEn = sportsColorsEn[i % sportsColorsEn.length];
    const size = sportsSizes[i % sportsSizes.length];
    yield {
      name: `${brandEn} ${typeEn} ${colorEn} Size ${size}`,
      name_ar: `${typeAr} ${brand} — ${colorAr} — مقاس ${size}`,
      subcategory: subEn,
      search_tokens: `${typeAr} رياضة لياقة ${brand} ${colorAr} sports fitness ${typeEn.toLowerCase()} ${brandEn.toLowerCase()} ${colorEn.toLowerCase()}`,
      descAr: `${typeAr} من ${brand} بلون ${colorAr} ومقاس ${size}. مصمم للرياضيين المحترفين والهواة. خامات عالية الجودة تتحمل الاستخدام المكثف. مناسب لممارسة الرياضة في الهواء الطلق والصالات.`,
      descEn: `${brandEn} ${typeEn} in ${colorEn}, size ${size}. Designed for professional and amateur athletes. High-quality materials for intensive use. Suitable for outdoor and gym workouts.`,
      price: randPrice('Sports & Fitness'),
    };
  }
}

// TOYS (400 products)
const toysTypes = [
  ['ليغو','LEGO Building Blocks','Building Toys'],['سيارة تحكم عن بعد','Remote Control Car','RC Toys'],
  ['دمية باربي','Barbie Doll','Dolls'],['دمية ذكورية','Action Figure','Figures'],
  ['لعبة طاولة','Board Game','Board Games'],['أحجية تركيب','Puzzle','Puzzles'],
  ['دب أفخم','Teddy Bear','Plush Toys'],['مطبخ العاب','Play Kitchen','Pretend Play'],
  ['أدوات رسم أطفال','Children\'s Art Set','Art & Craft'],['لعبة تعليمية','Educational Toy','Educational'],
  ['كرة أطفال','Children\'s Ball','Outdoor Toys'],['مسدس ماء','Water Gun','Outdoor Toys'],
  ['دراجة أطفال','Children\'s Bicycle','Outdoor Toys'],['حوض رمل','Sand Pit','Outdoor Toys'],
  ['ألعاب فيديو أطفال','Children\'s Gaming Device','Electronic Toys'],['هاتف لعبة','Toy Phone','Electronic Toys'],
  ['مجموعة علوم','Science Kit','Educational'],['خيمة أطفال','Children\'s Tent','Outdoor Toys'],
  ['عروسة قماش','Fabric Doll','Dolls'],['قطار خشبي','Wooden Train Set','Building Toys'],
];
const toysAgeGroups = ['3-5 سنوات','6-8 سنوات','9-12 سنوات','2-4 سنوات','8-12 سنوات'];
const toysAgeGroupsEn = ['Ages 3-5','Ages 6-8','Ages 9-12','Ages 2-4','Ages 8-12'];
const toysColors = ['أحمر','أزرق','أخضر','أصفر','وردي','برتقالي'];
const toysColorsEn = ['Red','Blue','Green','Yellow','Pink','Orange'];
const toysBrands = ['ليغو','هاسبرو','ماتيل','فيشر برايس','ستيب 2','بلاي دوه'];
const toysBrandsEn = ['LEGO','Hasbro','Mattel','Fisher-Price','Step2','Play-Doh'];

function* toysGen(count) {
  for (let i = 0; i < count; i++) {
    const [typeAr, typeEn, subEn] = toysTypes[i % toysTypes.length];
    const brand = toysBrands[Math.floor(i / toysTypes.length) % toysBrands.length];
    const brandEn = toysBrandsEn[Math.floor(i / toysTypes.length) % toysBrandsEn.length];
    const ageAr = toysAgeGroups[i % toysAgeGroups.length];
    const ageEn = toysAgeGroupsEn[i % toysAgeGroupsEn.length];
    const colorAr = toysColors[i % toysColors.length];
    const colorEn = toysColorsEn[i % toysColorsEn.length];
    yield {
      name: `${brandEn} ${typeEn} ${colorEn} ${ageEn}`,
      name_ar: `${typeAr} ${brand} — ${colorAr} — ${ageAr}`,
      subcategory: subEn,
      search_tokens: `${typeAr} ألعاب أطفال ${brand} ${ageAr} toys kids children ${typeEn.toLowerCase()} ${brandEn.toLowerCase()} ${ageEn.toLowerCase()}`,
      descAr: `${typeAr} من ${brand} بلون ${colorAr} مناسب للأطفال ${ageAr}. مصنوع من مواد آمنة وغير سامة. يعزز الإبداع والتفكير المنطقي. يأتي مع دليل الاستخدام. حاصل على شهادة السلامة الأوروبية.`,
      descEn: `${brandEn} ${typeEn} in ${colorEn}, suitable for children ${ageEn}. Made from safe, non-toxic materials. Encourages creativity and logical thinking. Includes instruction guide. CE safety certified.`,
      price: randPrice('Toys & Kids'),
    };
  }
}

// BOOKS (300 products)
const booksData = [
  ['رواية الأيام لطه حسين','The Days by Taha Hussein','Arabic Literature',4500],
  ['رواية أولاد حارتنا','Children of the Alley by Naguib Mahfouz','Arabic Literature',5000],
  ['كتاب العادات الذرية','Atomic Habits','Self Development',12000],
  ['رواية ملك الخواتم','Lord of the Rings','Fantasy',15000],
  ['كيف تؤثر في الناس','How to Win Friends','Self Development',10000],
  ['فن اللامبالاة','The Subtle Art of Not Giving Up','Self Development',11000],
  ['كتاب البرمجة بالبايثون','Learn Python Programming','Technology',18000],
  ['رواية نجيب محفوظ','Naguib Mahfouz Collected Works','Arabic Literature',35000],
  ['كتاب تطوير الذات','Personal Development Guide','Self Development',8000],
  ['رواية الجريمة والعقاب','Crime and Punishment','World Literature',13000],
  ['تعلم الجافاسكريبت','Learn JavaScript','Technology',20000],
  ['كتاب التاريخ السوري','History of Syria','History',14000],
  ['رواية بائعة الكبريت','The Little Match Girl','Children',4000],
  ['كتاب الطبخ السوري','Syrian Cuisine Cookbook','Cooking',16000],
  ['مجلة علمية أطفال','Science Magazine for Kids','Children',3500],
  ['قصص ألف ليلة وليلة','Arabian Nights','Arabic Literature',22000],
  ['كتاب اللغة العربية','Arabic Language Grammar','Education',9000],
  ['رواية موبي ديك','Moby Dick','World Literature',12500],
  ['كتاب الفيزياء الحديثة','Modern Physics','Science',25000],
  ['دليل المستثمر الذكي','The Intelligent Investor','Business',19000],
  ['قاموس عربي إنجليزي','Arabic-English Dictionary','Reference',7000],
  ['كتاب الرياضيات للجامعة','University Mathematics','Education',30000],
  ['رواية بائعة الوردة','The Rose Seller Novel','Arabic Literature',6000],
  ['تعلم تصميم الجرافيك','Learn Graphic Design','Technology',22000],
  ['كتاب الصحة والتغذية','Health and Nutrition Guide','Health',11000],
  ['رواية الأمير الصغير','The Little Prince','World Literature',5500],
  ['قصص الأنبياء','Stories of the Prophets','Religion',8500],
  ['كتاب الاقتصاد','Introduction to Economics','Business',28000],
  ['رواية روميو وجولييت','Romeo and Juliet','World Literature',6500],
  ['تعلم اللغة الإنجليزية','Learn English Language','Education',13000],
];
const stationeryTypes = [
  ['مفكرة يومية','Daily Planner'],['دفتر رسم','Sketchbook'],['طقم أقلام فاخر','Premium Pen Set'],
  ['ملفات تنظيم','Folder Organizer Set'],['لوح كتابة ذكي','Smart Writing Board'],
  ['أقلام تلوين','Colored Pencils Set'],['حقيبة مدرسية','School Backpack'],
  ['مقص وأدوات','Scissors & Tools Set'],['دفتر ملاحظات','Notebook Set'],
  ['أختام ديكور','Decorative Stamps Set'],['ورق طباعة','Printing Paper Ream'],
  ['أقلام مؤشر','Highlighter Set'],['لاصق وشريط لاصق','Adhesive & Tape Set'],
  ['منظم مكتب','Desk Organizer'],['ساعة مكتبية','Desk Clock'],
];
const statBrands = ['فيكس-الفا','بيك','ستابيلو','رودلر','دياري','أوبتيما'];
const statBrandsEn = ['Faber-Castell','BIC','Stabilo','Rhodia','Diary','Optima'];

function* booksGen(count) {
  const novelCount = Math.floor(count * 0.5);
  const statCount = count - novelCount;
  let n = 0;

  for (let i = 0; n < novelCount; i++, n++) {
    const book = booksData[i % booksData.length];
    const edition = Math.floor(i / booksData.length) + 1;
    yield {
      name: `${book[1]} ${edition > 1 ? `- Edition ${edition}` : ''}`.trim(),
      name_ar: `${book[0]} ${edition > 1 ? `- الطبعة ${edition}` : ''}`.trim(),
      subcategory: book[2],
      search_tokens: `${book[0]} كتاب قراءة أدب ${book[2].toLowerCase()} book reading literature ${book[1].toLowerCase()}`,
      descAr: `${book[0]} - ${edition > 1 ? `الطبعة ${edition}` : 'الطبعة الأولى'}. كتاب رائع يتناول موضوعات عميقة ومثيرة للاهتمام. مناسب للقراء من جميع الأعمار. طباعة عالية الجودة وتجليد متين. من أفضل الكتب المترجمة في مكتبتنا.`,
      descEn: `${book[1]} - ${edition > 1 ? `Edition ${edition}` : 'First Edition'}. A captivating read covering deep and interesting topics. Suitable for readers of all ages. High quality printing and durable binding.`,
      price: (book[3] * (1 + (i % 5) * 0.1)).toFixed(2),
    };
  }
  for (let i = 0; n < count; i++, n++) {
    const [typeAr, typeEn] = stationeryTypes[i % stationeryTypes.length];
    const brand = statBrands[Math.floor(i / stationeryTypes.length) % statBrands.length];
    const brandEn = statBrandsEn[Math.floor(i / stationeryTypes.length) % statBrandsEn.length];
    const colorAr = ['أزرق','أحمر','أسود','متعدد الألوان','رمادي'][i % 5];
    const colorEn = ['Blue','Red','Black','Multicolor','Gray'][i % 5];
    yield {
      name: `${brandEn} ${typeEn} ${colorEn} Pack ${i % 3 === 0 ? '3' : i % 2 === 0 ? '2' : '1'}`,
      name_ar: `${typeAr} ${brand} — ${colorAr}`,
      subcategory: 'Stationery',
      search_tokens: `${typeAr} قرطاسية مكتب مدرسة ${brand} stationery office school ${typeEn.toLowerCase()} ${brandEn.toLowerCase()}`,
      descAr: `${typeAr} من ${brand} بلون ${colorAr}. جودة عالية للاستخدام المكتبي والمدرسي. تصميم عملي وأنيق يناسب جميع الأعمار. يأتي في عبوة مناسبة للهدايا.`,
      descEn: `${brandEn} ${typeEn} in ${colorEn}. High quality for office and school use. Practical and elegant design suitable for all ages. Comes in gift-ready packaging.`,
      price: randPrice('Books'),
    };
  }
}

// FOOD (200 products)
const foodTypes = [
  ['زيت زيتون سوري بكر ممتاز','Syrian Extra Virgin Olive Oil','Oils & Condiments',25000],
  ['عسل طبيعي سدر','Natural Sidr Honey','Honey',45000],
  ['شاي أخضر صيني','Chinese Green Tea','Tea & Coffee',8000],
  ['قهوة عربية محمصة','Roasted Arabic Coffee','Tea & Coffee',15000],
  ['بهارات سبع أعشاب','Seven Herbs Spice Blend','Spices',7000],
  ['مكسرات مشكلة فاخرة','Mixed Premium Nuts','Snacks',30000],
  ['تمر مجدول سعودي','Medjool Saudi Dates','Dates',35000],
  ['ورد جوري دمشقي مجفف','Damascus Dried Rosebuds','Herbal',12000],
  ['ملح البحر الميت','Dead Sea Salt','Specialty',9000],
  ['دبس الرمان السوري','Syrian Pomegranate Molasses','Condiments',11000],
  ['زعتر سوري أصلي','Authentic Syrian Zaatar','Spices',8000],
  ['سمنة بلدية','Traditional Ghee','Dairy',28000],
  ['شوكولاته فاخرة داكنة','Premium Dark Chocolate','Sweets',14000],
  ['عصير رمان طبيعي','Natural Pomegranate Juice','Beverages',10000],
  ['حلوى شرقية مشكلة','Assorted Oriental Sweets','Sweets',22000],
  ['كيك منزلي حلب','Aleppo Homemade Cake','Bakery',18000],
  ['معجون الطحينية','Tahini Paste','Condiments',13000],
  ['ماء ورد دمشقي','Damascus Rose Water','Beverages',6000],
  ['كيسة قمح بلدي','Whole Wheat Flour','Grains',5000],
  ['عدس أحمر سوري','Syrian Red Lentils','Legumes',4000],
];

function* foodGen(count) {
  for (let i = 0; i < count; i++) {
    const food = foodTypes[i % foodTypes.length];
    const weight = ['250g','500g','1kg','2kg','3 عبوات','5 عبوات'][i % 6];
    const weightEn = ['250g','500g','1kg','2kg','3-Pack','5-Pack'][i % 6];
    yield {
      name: `${food[1]} ${weightEn} Premium Quality`,
      name_ar: `${food[0]} — ${weight} — جودة ممتازة`,
      subcategory: food[2],
      search_tokens: `${food[0]} طعام اكل بقالة غذاء ${food[2].toLowerCase()} food grocery ${food[1].toLowerCase()}`,
      descAr: `${food[0]} بوزن ${weight} من أعلى درجات الجودة. منتج طبيعي 100% خالٍ من المواد الحافظة الصناعية. تم اختياره بعناية من أفضل المصادر السورية. مناسب للاستهلاك اليومي وكهدية.`,
      descEn: `${food[1]}, ${weightEn}. 100% natural product free from artificial preservatives. Carefully selected from the finest Syrian sources. Suitable for daily consumption and as a gift.`,
      price: (food[3] * (1 + (i % 8) * 0.05)).toFixed(2),
    };
  }
}

// JEWELRY (remaining to reach 5000)
const jewelryTypes = [
  ['سلسلة ذهب','Gold Necklace','Necklaces'],['خاتم فضة','Silver Ring','Rings'],
  ['سوار ذهب','Gold Bracelet','Bracelets'],['حلق لؤلؤ','Pearl Earrings','Earrings'],
  ['قلادة فيروز','Turquoise Pendant','Necklaces'],['خاتم ألماس اصطناعي','Diamond-Cut Ring','Rings'],
  ['سوار فضة','Silver Bracelet','Bracelets'],['حلق ذهب','Gold Earrings','Earrings'],
  ['سلسلة فضة','Silver Chain','Necklaces'],['طقم مجوهرات','Jewelry Set','Sets'],
];
const jewelryMaterials = ['ذهب 18 قيراط','فضة 925','ذهب مطلي','فضة مطلية','اكريليك فاخر'];
const jewelryMaterialsEn = ['18K Gold','925 Silver','Gold Plated','Silver Plated','Premium Acrylic'];

function* jewelryGen(count) {
  for (let i = 0; i < count; i++) {
    const [typeAr, typeEn, subEn] = jewelryTypes[i % jewelryTypes.length];
    const matAr = jewelryMaterials[i % jewelryMaterials.length];
    const matEn = jewelryMaterialsEn[i % jewelryMaterialsEn.length];
    const styleNum = Math.floor(i / jewelryTypes.length) + 1;
    yield {
      name: `${typeEn} ${matEn} Style ${styleNum}`,
      name_ar: `${typeAr} — ${matAr} — طراز ${styleNum}`,
      subcategory: subEn,
      search_tokens: `${typeAr} مجوهرات ذهب فضة ${matAr} jewelry gold silver ${typeEn.toLowerCase()} ${subEn.toLowerCase()}`,
      descAr: `${typeAr} من ${matAr} بتصميم راقٍ وأنيق. مناسب للمناسبات الخاصة والاستخدام اليومي. مصنوع بدقة عالية ويأتي في علبة هدايا فاخرة. ضمان جودة المصنعية.`,
      descEn: `${typeEn} in ${matEn}. Elegant design suitable for special occasions and daily wear. Crafted with precision and comes in a luxury gift box. Quality craftsmanship guaranteed.`,
      price: randPrice('Jewelry'),
    };
  }
}

// ─── MAIN SEED FUNCTION ───────────────────────────────────────────────────────
const TARGETS = {
  'Electronics':      1000,
  'Fashion':          1000,
  'Home & Living':    800,
  'Beauty':           700,
  'Sports & Fitness': 600,
  'Toys & Kids':      400,
  'Books':            300,
  'Food & Grocery':   200,
};
// Total = 5000. Jewelry handled separately to fill up to exact 5000 if needed.

async function main() {
  const client = await pool.connect();
  try {
    console.log('🌱 SYANO — 5000 Product Seed Starting...\n');

    // Check existing count
    const { rows: [{ count: existing }] } = await client.query('SELECT COUNT(*) as count FROM products');
    console.log(`📦 Existing products: ${existing}`);
    if (parseInt(existing) >= 5000) {
      console.log('✅ Already have 5000+ products — skipping seed.');
      return;
    }

    // Get seller IDs by approved applications
    const { rows: sellers } = await client.query(`
      SELECT u.id, sa.store_name FROM users u
      JOIN seller_applications sa ON sa.user_id = u.id
      WHERE sa.status = 'approved' ORDER BY u.id
    `);
    console.log(`👤 Sellers available: ${sellers.map(s => `${s.id} (${s.store_name})`).join(', ')}\n`);

    const sellerIds = sellers.map(s => s.id);
    if (sellerIds.length === 0) throw new Error('No approved sellers found!');

    const getSellerForCat = (cat, idx) => {
      const pool = SELLERS[cat] || sellerIds;
      const available = pool.filter(id => sellerIds.includes(id));
      if (available.length === 0) return sellerIds[idx % sellerIds.length];
      return available[idx % available.length];
    };

    let totalInserted = 0;

    const GENERATORS = {
      'Electronics':      electronicsGen,
      'Fashion':          fashionGen,
      'Home & Living':    homeGen,
      'Beauty':           beautyGen,
      'Sports & Fitness': sportsGen,
      'Toys & Kids':      toysGen,
      'Books':            booksGen,
      'Food & Grocery':   foodGen,
    };

    for (const [cat, targetCount] of Object.entries(TARGETS)) {
      console.log(`\n📂 Seeding ${cat} (${targetCount} products)...`);
      const gen = GENERATORS[cat](targetCount);
      const BATCH = 100;
      let catInserted = 0;
      let batch = [];
      let genIdx = 0;

      for (const product of gen) {
        const sellerId = getSellerForCat(cat, genIdx++);
        const daysAgo = rand(0, 180);
        const created = new Date(Date.now() - daysAgo * 86400000).toISOString();
        const hasDiscount = Math.random() < 0.15;
        const discount = hasDiscount ? rand(5, 50) : null;
        const stock = Math.random() < 0.2 ? 0 : rand(1, 200);
        const isFeatured = catInserted < 15 && Math.random() < 0.3;
        const primaryImg = pickImg(cat, genIdx);
        const secondImg = pickImg(cat, genIdx + 3);

        batch.push({
          seller_id: sellerId,
          name: product.name,
          name_ar: product.name_ar,
          description: product.descEn,
          description_ar: product.descAr,
          price: product.price,
          discount_percent: discount,
          category: cat,
          subcategory: product.subcategory || null,
          stock,
          image_url: primaryImg,
          image_urls: [primaryImg, secondImg],
          search_tokens: product.search_tokens,
          featured: isFeatured,
          created_at: created,
          view_count: rand(0, 5000),
          sales_count: rand(0, 500),
        });

        if (batch.length >= BATCH) {
          const inserted = await insertBatch(client, batch);
          catInserted += inserted;
          totalInserted += inserted;
          batch = [];
          if (catInserted % 500 === 0 || catInserted === targetCount) {
            console.log(`  ✓ Inserted ${catInserted}/${targetCount} ${cat} products (total: ${totalInserted})`);
          }
        }
      }

      // Flush remaining
      if (batch.length > 0) {
        const inserted = await insertBatch(client, batch);
        catInserted += inserted;
        totalInserted += inserted;
      }
      console.log(`  ✅ ${cat} complete: ${catInserted} inserted`);
    }

    // ─── FTS Rebuild ──────────────────────────────────────────────────────────
    console.log('\n🔧 Rebuilding FTS vectors for all products...');
    const { rows: [{ count: nullFts }] } = await client.query(`
      SELECT COUNT(*) as count FROM products WHERE fts_vector IS NULL
    `);
    console.log(`  Products with NULL fts_vector: ${nullFts}`);

    if (parseInt(nullFts) > 0) {
      const { rowCount: rebuilt } = await client.query(`
        UPDATE products
        SET fts_vector =
          setweight(to_tsvector('simple', coalesce(name, '')),          'A') ||
          setweight(to_tsvector('simple', coalesce(name_ar, '')),       'A') ||
          setweight(to_tsvector('simple', coalesce(category, '')),      'B') ||
          setweight(to_tsvector('simple', coalesce(subcategory, '')),   'B') ||
          setweight(to_tsvector('simple', coalesce(search_tokens, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(description, '')),   'C')
        WHERE fts_vector IS NULL
      `);
      console.log(`  ✅ FTS vectors rebuilt for ${rebuilt} products`);
    }

    // Verify
    const { rows: [{ count: stillNull }] } = await client.query(
      'SELECT COUNT(*) as count FROM products WHERE fts_vector IS NULL'
    );
    console.log(`  FTS NULL remaining: ${stillNull} (must be 0)`);

    // ─── Final stats ──────────────────────────────────────────────────────────
    const { rows: stats } = await client.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE discount_percent > 0)        AS with_discount,
        COUNT(*) FILTER (WHERE stock = 0)                   AS out_of_stock,
        COUNT(*) FILTER (WHERE featured = true)             AS featured,
        COUNT(*) FILTER (WHERE image_url IS NOT NULL)       AS with_image,
        COUNT(*) FILTER (WHERE fts_vector IS NOT NULL)      AS with_fts
      FROM products
    `);
    const s = stats[0];
    console.log('\n═══════════════════════════════════════════════════');
    console.log('SEED RESULTS:');
    console.log(`  Total products:      ${s.total}`);
    console.log(`  Newly inserted:      ${totalInserted}`);
    console.log(`  With discount:       ${s.with_discount}`);
    console.log(`  Out of stock:        ${s.out_of_stock}`);
    console.log(`  Featured:            ${s.featured}`);
    console.log(`  With image:          ${s.with_image}`);
    console.log(`  FTS vectors:         ${s.with_fts}`);
    console.log('═══════════════════════════════════════════════════\n');

  } finally {
    client.release();
    await pool.end();
  }
}

async function insertBatch(client, batch) {
  if (batch.length === 0) return 0;

  const cols = ['seller_id','name','name_ar','description','price','discount_percent',
                'category','subcategory','stock','image_url','image_urls',
                'search_tokens','featured','created_at','view_count','sales_count'];

  const values = [];
  const params = [];
  let p = 1;

  for (const row of batch) {
    const rowParams = cols.map(col => {
      const v = row[col] ?? null;
      params.push(col === 'image_urls' && Array.isArray(v) ? v : v);
      return `$${p++}`;
    });
    // Cast image_urls to text[]
    const rowParamsCopy = [...rowParams];
    // image_urls is at index 10 (0-based)
    const imageUrlsIdx = cols.indexOf('image_urls');
    rowParamsCopy[imageUrlsIdx] = `$${p - cols.length + imageUrlsIdx}::text[]`;
    values.push(`(${rowParamsCopy.join(',')})`);
  }

  // Rebuild properly with explicit cast
  const values2 = [];
  const params2 = [];
  let p2 = 1;
  for (const row of batch) {
    const rowParts = [];
    for (const col of cols) {
      if (col === 'image_urls') {
        const arr = Array.isArray(row[col]) ? row[col] : [];
        params2.push(arr);
        rowParts.push(`$${p2++}::text[]`);
      } else {
        params2.push(row[col] ?? null);
        rowParts.push(`$${p2++}`);
      }
    }
    values2.push(`(${rowParts.join(',')})`);
  }

  const sql = `
    INSERT INTO products (${cols.join(',')})
    VALUES ${values2.join(',')}
    ON CONFLICT DO NOTHING
  `;

  try {
    const result = await client.query(sql, params2);
    return result.rowCount;
  } catch (err) {
    console.error('Batch insert error:', err.message);
    // Try inserting one by one for diagnostics
    let inserted = 0;
    for (const row of batch) {
      try {
        const singleParams = cols.map(col => col === 'image_urls' ? (Array.isArray(row[col]) ? row[col] : []) : (row[col] ?? null));
        const singleValues = cols.map((col, i) => col === 'image_urls' ? `$${i+1}::text[]` : `$${i+1}`);
        await client.query(
          `INSERT INTO products (${cols.join(',')}) VALUES (${singleValues.join(',')}) ON CONFLICT DO NOTHING`,
          singleParams
        );
        inserted++;
      } catch (e2) {
        // skip
      }
    }
    return inserted;
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
