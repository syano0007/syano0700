/* ─────────────────────────────────────────────────────────────
   SYANO — Centralized Marketplace Category System
   Single source of truth for all categories/subcategories.
   Sellers CANNOT create custom categories; they choose from
   this predefined list only.
───────────────────────────────────────────────────────────── */

export interface Subcategory {
  slug: string;
  en: string;
  ar: string;
}

export interface AttributeOption {
  value: string;
  en: string;
  ar: string;
}

export interface CategoryAttribute {
  key: string;
  en: string;
  ar: string;
  type: "text" | "select";
  options?: AttributeOption[];
}

export interface Category {
  slug: string;
  en: string;
  ar: string;
  icon: string;       // Lucide icon name
  iconBg: string;     // Tailwind background class for icon bubble
  iconColor: string;  // Tailwind text class for icon
  subcategories: Subcategory[];
  attributes: CategoryAttribute[];
}

export const CATEGORIES: Category[] = [
  {
    slug: "Electronics",
    en: "Electronics",
    ar: "الإلكترونيات",
    icon: "Cpu",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    subcategories: [
      { slug: "Smartphones",         en: "Smartphones",         ar: "الهواتف الذكية" },
      { slug: "Tablets",             en: "Tablets",             ar: "الأجهزة اللوحية" },
      { slug: "Laptops",             en: "Laptops",             ar: "أجهزة الحاسوب المحمول" },
      { slug: "Desktop PCs",         en: "Desktop PCs",         ar: "الكمبيوتر المكتبي" },
      { slug: "Monitors",            en: "Monitors",            ar: "الشاشات" },
      { slug: "Smart Watches",       en: "Smart Watches",       ar: "الساعات الذكية" },
      { slug: "Headphones",          en: "Headphones",          ar: "سماعات الرأس" },
      { slug: "Cameras",             en: "Cameras",             ar: "الكاميرات" },
      { slug: "Printers",            en: "Printers",            ar: "الطابعات" },
      { slug: "PC Components",       en: "PC Components",       ar: "مكونات الحاسوب" },
      { slug: "Networking",          en: "Networking",          ar: "أجهزة الشبكات" },
      { slug: "Gaming Consoles",     en: "Gaming Consoles",     ar: "أجهزة الألعاب" },
      { slug: "Gaming Accessories",  en: "Gaming Accessories",  ar: "إكسسوارات الألعاب" },
      { slug: "Smart Home Devices",  en: "Smart Home Devices",  ar: "أجهزة المنزل الذكي" },
      { slug: "Storage Devices",     en: "Storage Devices",     ar: "أجهزة التخزين" },
      { slug: "Mobile Accessories",  en: "Mobile Accessories",  ar: "إكسسوارات الجوال" },
      { slug: "Computer Accessories",en: "Computer Accessories",ar: "إكسسوارات الكمبيوتر" },
    ],
    attributes: [
      { key: "brand",   en: "Brand",   ar: "العلامة التجارية", type: "text" },
      { key: "storage", en: "Storage", ar: "التخزين", type: "select", options: [
        { value: "32GB",  en: "32 GB",  ar: "32 جيجابايت" },
        { value: "64GB",  en: "64 GB",  ar: "64 جيجابايت" },
        { value: "128GB", en: "128 GB", ar: "128 جيجابايت" },
        { value: "256GB", en: "256 GB", ar: "256 جيجابايت" },
        { value: "512GB", en: "512 GB", ar: "512 جيجابايت" },
        { value: "1TB",   en: "1 TB",   ar: "1 تيرابايت" },
      ]},
      { key: "color", en: "Color", ar: "اللون", type: "text" },
    ],
  },
  {
    slug: "Fashion",
    en: "Fashion",
    ar: "الموضة والأزياء",
    icon: "Shirt",
    iconBg: "bg-violet-100 dark:bg-violet-900/40",
    iconColor: "text-violet-600 dark:text-violet-400",
    subcategories: [
      { slug: "Men's Clothing",   en: "Men's Clothing",   ar: "ملابس رجالية" },
      { slug: "Women's Clothing", en: "Women's Clothing", ar: "ملابس نسائية" },
      { slug: "Kids Clothing",    en: "Kids Clothing",    ar: "ملابس أطفال" },
      { slug: "Shoes",            en: "Shoes",            ar: "الأحذية" },
      { slug: "Bags",             en: "Bags",             ar: "الحقائب" },
      { slug: "Watches",          en: "Watches",          ar: "الساعات" },
      { slug: "Jewelry",          en: "Jewelry",          ar: "المجوهرات" },
      { slug: "Sunglasses",       en: "Sunglasses",       ar: "النظارات الشمسية" },
      { slug: "Sportswear",       en: "Sportswear",       ar: "الملابس الرياضية" },
      { slug: "Accessories",      en: "Accessories",      ar: "الإكسسوارات" },
    ],
    attributes: [
      { key: "size", en: "Size", ar: "المقاس", type: "select", options: [
        { value: "XS",  en: "XS",  ar: "XS" },
        { value: "S",   en: "S",   ar: "S" },
        { value: "M",   en: "M",   ar: "M" },
        { value: "L",   en: "L",   ar: "L" },
        { value: "XL",  en: "XL",  ar: "XL" },
        { value: "XXL", en: "XXL", ar: "XXL" },
      ]},
      { key: "material", en: "Material", ar: "المادة",   type: "text" },
      { key: "gender",   en: "Gender",   ar: "الجنس",    type: "select", options: [
        { value: "Men",    en: "Men",    ar: "رجالي" },
        { value: "Women",  en: "Women",  ar: "نسائي" },
        { value: "Unisex", en: "Unisex", ar: "للجنسين" },
        { value: "Kids",   en: "Kids",   ar: "أطفال" },
      ]},
      { key: "color", en: "Color", ar: "اللون", type: "text" },
    ],
  },
  {
    slug: "Beauty & Personal Care",
    en: "Beauty & Personal Care",
    ar: "الجمال والعناية الشخصية",
    icon: "Sparkles",
    iconBg: "bg-rose-100 dark:bg-rose-900/40",
    iconColor: "text-rose-600 dark:text-rose-400",
    subcategories: [
      { slug: "Skincare",       en: "Skincare",       ar: "العناية بالبشرة" },
      { slug: "Haircare",       en: "Haircare",       ar: "العناية بالشعر" },
      { slug: "Makeup",         en: "Makeup",         ar: "مستحضرات التجميل" },
      { slug: "Perfumes",       en: "Perfumes",       ar: "العطور" },
      { slug: "Grooming",       en: "Grooming",       ar: "الحلاقة والعناية" },
      { slug: "Beauty Devices", en: "Beauty Devices", ar: "أجهزة التجميل" },
      { slug: "Natural Products",en: "Natural Products",ar: "المنتجات الطبيعية" },
      { slug: "Men's Care",     en: "Men's Care",     ar: "عناية الرجل" },
    ],
    attributes: [
      { key: "skin_type", en: "Skin Type", ar: "نوع البشرة", type: "select", options: [
        { value: "Oily",        en: "Oily",        ar: "دهنية" },
        { value: "Dry",         en: "Dry",         ar: "جافة" },
        { value: "Combination", en: "Combination", ar: "مختلطة" },
        { value: "Sensitive",   en: "Sensitive",   ar: "حساسة" },
        { value: "All Types",   en: "All Types",   ar: "جميع الأنواع" },
      ]},
      { key: "volume",    en: "Volume / Size", ar: "الحجم", type: "text" },
      { key: "fragrance", en: "Fragrance",     ar: "العطر", type: "text" },
    ],
  },
  {
    slug: "Home & Kitchen",
    en: "Home & Kitchen",
    ar: "المنزل والمطبخ",
    icon: "Home",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    subcategories: [
      { slug: "Furniture",            en: "Furniture",            ar: "الأثاث" },
      { slug: "Home Decor",           en: "Home Decor",           ar: "الديكور المنزلي" },
      { slug: "Lighting",             en: "Lighting",             ar: "الإضاءة" },
      { slug: "Kitchen Tools",        en: "Kitchen Tools",        ar: "أدوات المطبخ" },
      { slug: "Home Appliances",      en: "Home Appliances",      ar: "الأجهزة المنزلية" },
      { slug: "Bedding",              en: "Bedding",              ar: "الأفرشة والمفارش" },
      { slug: "Storage & Organization",en: "Storage & Organization",ar: "التخزين والتنظيم" },
      { slug: "Cleaning Supplies",    en: "Cleaning Supplies",    ar: "مستلزمات التنظيف" },
      { slug: "Bathroom Essentials",  en: "Bathroom Essentials",  ar: "مستلزمات الحمام" },
      { slug: "Carpets & Curtains",   en: "Carpets & Curtains",   ar: "السجاد والستائر" },
    ],
    attributes: [
      { key: "material", en: "Material", ar: "المادة",  type: "text" },
      { key: "color",    en: "Color",    ar: "اللون",   type: "text" },
      { key: "dimensions",en: "Dimensions",ar: "الأبعاد",type: "text" },
    ],
  },
  {
    slug: "Supermarket & Grocery",
    en: "Supermarket & Grocery",
    ar: "السوبرماركت والبقالة",
    icon: "ShoppingBasket",
    iconBg: "bg-green-100 dark:bg-green-900/40",
    iconColor: "text-green-600 dark:text-green-400",
    subcategories: [
      { slug: "Food",             en: "Food",             ar: "الطعام" },
      { slug: "Drinks",           en: "Drinks",           ar: "المشروبات" },
      { slug: "Coffee & Tea",     en: "Coffee & Tea",     ar: "القهوة والشاي" },
      { slug: "Snacks",           en: "Snacks",           ar: "الوجبات الخفيفة" },
      { slug: "Organic Products", en: "Organic Products", ar: "المنتجات العضوية" },
      { slug: "Spices",           en: "Spices",           ar: "التوابل والبهارات" },
      { slug: "Bakery",           en: "Bakery",           ar: "المخبوزات" },
    ],
    attributes: [
      { key: "weight",      en: "Weight / Volume", ar: "الوزن / الحجم", type: "text" },
      { key: "ingredients", en: "Ingredients",     ar: "المكونات",       type: "text" },
    ],
  },
  {
    slug: "Sports & Fitness",
    en: "Sports & Fitness",
    ar: "الرياضة واللياقة",
    icon: "Dumbbell",
    iconBg: "bg-orange-100 dark:bg-orange-900/40",
    iconColor: "text-orange-600 dark:text-orange-400",
    subcategories: [
      { slug: "Gym Equipment",      en: "Gym Equipment",      ar: "معدات الجيم" },
      { slug: "Fitness Accessories",en: "Fitness Accessories", ar: "إكسسوارات اللياقة" },
      { slug: "Sportswear",         en: "Sportswear",         ar: "الملابس الرياضية" },
      { slug: "Bicycles",           en: "Bicycles",           ar: "الدراجات الهوائية" },
      { slug: "Yoga",               en: "Yoga",               ar: "اليوغا" },
      { slug: "Outdoor Sports",     en: "Outdoor Sports",     ar: "الرياضات الخارجية" },
    ],
    attributes: [
      { key: "weight_capacity", en: "Weight Capacity", ar: "الحمل الأقصى", type: "text" },
      { key: "size",            en: "Size",            ar: "المقاس",        type: "text" },
      { key: "color",           en: "Color",           ar: "اللون",         type: "text" },
    ],
  },
  {
    slug: "Automotive",
    en: "Automotive",
    ar: "السيارات والمركبات",
    icon: "Car",
    iconBg: "bg-slate-100 dark:bg-slate-800/60",
    iconColor: "text-slate-600 dark:text-slate-400",
    subcategories: [
      { slug: "Car Accessories",  en: "Car Accessories",  ar: "إكسسوارات السيارة" },
      { slug: "Car Parts",        en: "Car Parts",        ar: "قطع غيار السيارات" },
      { slug: "Tires",            en: "Tires",            ar: "الإطارات" },
      { slug: "Oils & Fluids",    en: "Oils & Fluids",    ar: "الزيوت والسوائل" },
      { slug: "Audio Systems",    en: "Audio Systems",    ar: "أنظمة الصوت" },
      { slug: "Maintenance Tools",en: "Maintenance Tools",ar: "أدوات الصيانة" },
      { slug: "Motorcycles",      en: "Motorcycles",      ar: "الدراجات النارية" },
      { slug: "Electric Scooters",en: "Electric Scooters",ar: "السكوترات الكهربائية" },
    ],
    attributes: [
      { key: "brand",       en: "Brand",       ar: "العلامة التجارية", type: "text" },
      { key: "car_model",   en: "Compatible Car Model", ar: "موديل السيارة المتوافق", type: "text" },
    ],
  },
  {
    slug: "Gaming & Entertainment",
    en: "Gaming & Entertainment",
    ar: "الألعاب والترفيه",
    icon: "Gamepad2",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    subcategories: [
      { slug: "Video Games",       en: "Video Games",       ar: "ألعاب الفيديو" },
      { slug: "Gaming Accessories",en: "Gaming Accessories",ar: "إكسسوارات الألعاب" },
      { slug: "Toys",              en: "Toys",              ar: "الألعاب" },
      { slug: "Board Games",       en: "Board Games",       ar: "ألعاب الطاولة" },
      { slug: "Collectibles",      en: "Collectibles",      ar: "المقتنيات" },
      { slug: "LEGO",              en: "LEGO",              ar: "ليغو" },
    ],
    attributes: [
      { key: "platform", en: "Platform", ar: "المنصة", type: "select", options: [
        { value: "PC",          en: "PC",          ar: "كمبيوتر" },
        { value: "PlayStation", en: "PlayStation", ar: "بلايستيشن" },
        { value: "Xbox",        en: "Xbox",        ar: "إكس بوكس" },
        { value: "Nintendo",    en: "Nintendo Switch", ar: "نينتندو سويتش" },
        { value: "Mobile",      en: "Mobile",      ar: "الجوال" },
      ]},
      { key: "age_group", en: "Age Group", ar: "الفئة العمرية", type: "text" },
    ],
  },
  {
    slug: "Books & Stationery",
    en: "Books & Stationery",
    ar: "الكتب والقرطاسية",
    icon: "BookOpen",
    iconBg: "bg-teal-100 dark:bg-teal-900/40",
    iconColor: "text-teal-600 dark:text-teal-400",
    subcategories: [
      { slug: "Books",           en: "Books",           ar: "الكتب" },
      { slug: "Educational Books",en: "Educational Books",ar: "الكتب التعليمية" },
      { slug: "Children's Books",en: "Children's Books", ar: "كتب الأطفال" },
      { slug: "Office Supplies", en: "Office Supplies",  ar: "مستلزمات المكتب" },
      { slug: "School Supplies", en: "School Supplies",  ar: "مستلزمات المدرسة" },
      { slug: "Backpacks",       en: "Backpacks",        ar: "الحقائب المدرسية" },
    ],
    attributes: [
      { key: "author",   en: "Author",   ar: "المؤلف",   type: "text" },
      { key: "language", en: "Language", ar: "اللغة",    type: "text" },
      { key: "pages",    en: "Pages",    ar: "عدد الصفحات", type: "text" },
    ],
  },
  {
    slug: "Pet Supplies",
    en: "Pet Supplies",
    ar: "مستلزمات الحيوانات الأليفة",
    icon: "PawPrint",
    iconBg: "bg-pink-100 dark:bg-pink-900/40",
    iconColor: "text-pink-500 dark:text-pink-400",
    subcategories: [
      { slug: "Pet Food",        en: "Pet Food",        ar: "طعام الحيوانات" },
      { slug: "Pet Accessories", en: "Pet Accessories", ar: "إكسسوارات الحيوانات" },
      { slug: "Pet Toys",        en: "Pet Toys",        ar: "ألعاب الحيوانات" },
      { slug: "Pet Care",        en: "Pet Care",        ar: "رعاية الحيوانات" },
    ],
    attributes: [
      { key: "pet_type", en: "Pet Type", ar: "نوع الحيوان", type: "select", options: [
        { value: "Dog",   en: "Dog",   ar: "كلب" },
        { value: "Cat",   en: "Cat",   ar: "قطة" },
        { value: "Bird",  en: "Bird",  ar: "طائر" },
        { value: "Fish",  en: "Fish",  ar: "سمكة" },
        { value: "Other", en: "Other", ar: "أخرى" },
      ]},
      { key: "weight", en: "Weight / Size", ar: "الوزن / الحجم", type: "text" },
    ],
  },
  {
    slug: "Digital Products",
    en: "Digital Products",
    ar: "المنتجات الرقمية",
    icon: "Download",
    iconBg: "bg-sky-100 dark:bg-sky-900/40",
    iconColor: "text-sky-600 dark:text-sky-400",
    subcategories: [
      { slug: "Gift Cards",           en: "Gift Cards",           ar: "بطاقات الهدايا" },
      { slug: "Game Codes",           en: "Game Codes",           ar: "أكواد الألعاب" },
      { slug: "Digital Subscriptions",en: "Digital Subscriptions",ar: "الاشتراكات الرقمية" },
      { slug: "Online Courses",       en: "Online Courses",       ar: "الدورات الإلكترونية" },
      { slug: "Design Templates",     en: "Design Templates",     ar: "قوالب التصميم" },
      { slug: "Digital Files",        en: "Digital Files",        ar: "الملفات الرقمية" },
    ],
    attributes: [
      { key: "format",   en: "Format",   ar: "الصيغة",    type: "text" },
      { key: "platform", en: "Platform", ar: "المنصة",    type: "text" },
    ],
  },
  {
    slug: "Handmade & Crafts",
    en: "Handmade & Crafts",
    ar: "الحرف اليدوية والصناعات",
    icon: "Palette",
    iconBg: "bg-yellow-100 dark:bg-yellow-900/40",
    iconColor: "text-yellow-600 dark:text-yellow-500",
    subcategories: [
      { slug: "Handmade Products", en: "Handmade Products", ar: "منتجات يدوية" },
      { slug: "Art",               en: "Art",               ar: "الفن" },
      { slug: "Candles",           en: "Candles",           ar: "الشموع" },
      { slug: "Wood Crafts",       en: "Wood Crafts",       ar: "الأعمال الخشبية" },
      { slug: "Resin Art",         en: "Resin Art",         ar: "فن الراتنج" },
      { slug: "Embroidery",        en: "Embroidery",        ar: "التطريز" },
    ],
    attributes: [
      { key: "material",    en: "Material",    ar: "المادة",    type: "text" },
      { key: "dimensions",  en: "Dimensions",  ar: "الأبعاد",   type: "text" },
      { key: "customizable",en: "Customizable",ar: "قابل للتخصيص", type: "select", options: [
        { value: "Yes", en: "Yes", ar: "نعم" },
        { value: "No",  en: "No",  ar: "لا" },
      ]},
    ],
  },
  {
    slug: "Jewelry & Luxury",
    en: "Jewelry & Luxury",
    ar: "المجوهرات والفاخرة",
    icon: "Gem",
    iconBg: "bg-yellow-50 dark:bg-yellow-900/30",
    iconColor: "text-yellow-500 dark:text-yellow-400",
    subcategories: [
      { slug: "Gold",       en: "Gold",       ar: "الذهب" },
      { slug: "Silver",     en: "Silver",     ar: "الفضة" },
      { slug: "Watches",    en: "Watches",    ar: "الساعات" },
      { slug: "Rings",      en: "Rings",      ar: "الخواتم" },
      { slug: "Necklaces",  en: "Necklaces",  ar: "القلائد" },
      { slug: "Bracelets",  en: "Bracelets",  ar: "الأساور" },
    ],
    attributes: [
      { key: "metal",  en: "Metal Type", ar: "نوع المعدن", type: "select", options: [
        { value: "Gold",   en: "Gold",      ar: "ذهب" },
        { value: "Silver", en: "Silver",    ar: "فضة" },
        { value: "Rose Gold",en: "Rose Gold",ar: "ذهب وردي" },
        { value: "Platinum",en: "Platinum", ar: "بلاتين" },
        { value: "Other",  en: "Other",     ar: "أخرى" },
      ]},
      { key: "carat",  en: "Carat",       ar: "القيراط",    type: "text" },
      { key: "weight", en: "Weight (g)",  ar: "الوزن (غ)",  type: "text" },
    ],
  },
  {
    slug: "Baby & Kids",
    en: "Baby & Kids",
    ar: "الأطفال والرضع",
    icon: "Baby",
    iconBg: "bg-lime-100 dark:bg-lime-900/40",
    iconColor: "text-lime-600 dark:text-lime-500",
    subcategories: [
      { slug: "Baby Care",     en: "Baby Care",     ar: "رعاية الطفل" },
      { slug: "Strollers",     en: "Strollers",     ar: "عربات الأطفال" },
      { slug: "Baby Clothing", en: "Baby Clothing", ar: "ملابس الأطفال" },
      { slug: "Toys",          en: "Toys",          ar: "الألعاب" },
      { slug: "Baby Furniture",en: "Baby Furniture",ar: "أثاث الأطفال" },
    ],
    attributes: [
      { key: "age_group", en: "Age Group", ar: "الفئة العمرية", type: "select", options: [
        { value: "0-6 months",  en: "0-6 months",  ar: "0-6 أشهر" },
        { value: "6-12 months", en: "6-12 months", ar: "6-12 شهر" },
        { value: "1-3 years",   en: "1-3 years",   ar: "1-3 سنوات" },
        { value: "3-6 years",   en: "3-6 years",   ar: "3-6 سنوات" },
        { value: "6+ years",    en: "6+ years",    ar: "6 سنوات فأكثر" },
      ]},
      { key: "safety_certified", en: "Safety Certified", ar: "معتمد للسلامة", type: "select", options: [
        { value: "Yes", en: "Yes", ar: "نعم" },
        { value: "No",  en: "No",  ar: "لا" },
      ]},
    ],
  },
  {
    slug: "Tools & Construction",
    en: "Tools & Construction",
    ar: "العدد والبناء",
    icon: "Wrench",
    iconBg: "bg-stone-100 dark:bg-stone-800/60",
    iconColor: "text-stone-600 dark:text-stone-400",
    subcategories: [
      { slug: "Power Tools",         en: "Power Tools",         ar: "الأدوات الكهربائية" },
      { slug: "Hand Tools",          en: "Hand Tools",          ar: "الأدوات اليدوية" },
      { slug: "Electrical Supplies", en: "Electrical Supplies", ar: "المستلزمات الكهربائية" },
      { slug: "Plumbing",            en: "Plumbing",            ar: "السباكة" },
      { slug: "Paint Supplies",      en: "Paint Supplies",      ar: "مستلزمات الدهان" },
      { slug: "Industrial Equipment",en: "Industrial Equipment",ar: "المعدات الصناعية" },
    ],
    attributes: [
      { key: "brand",    en: "Brand",    ar: "العلامة التجارية", type: "text" },
      { key: "power",    en: "Power (W)",ar: "الطاقة (واط)",     type: "text" },
      { key: "material", en: "Material", ar: "المادة",           type: "text" },
    ],
  },
  {
    slug: "Garden & Outdoor",
    en: "Garden & Outdoor",
    ar: "الحديقة والخارج",
    icon: "TreePine",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconColor: "text-emerald-600 dark:text-emerald-500",
    subcategories: [
      { slug: "Plants",           en: "Plants",           ar: "النباتات" },
      { slug: "Gardening Tools",  en: "Gardening Tools",  ar: "أدوات البستنة" },
      { slug: "Outdoor Furniture",en: "Outdoor Furniture",ar: "أثاث خارجي" },
      { slug: "Irrigation",       en: "Irrigation",       ar: "الري" },
      { slug: "Outdoor Decor",    en: "Outdoor Decor",    ar: "الديكور الخارجي" },
    ],
    attributes: [
      { key: "plant_type", en: "Plant Type",   ar: "نوع النبات",  type: "text" },
      { key: "indoor_outdoor",en: "Indoor/Outdoor",ar: "داخلي/خارجي", type: "select", options: [
        { value: "Indoor",  en: "Indoor",  ar: "داخلي" },
        { value: "Outdoor", en: "Outdoor", ar: "خارجي" },
        { value: "Both",    en: "Both",    ar: "كلاهما" },
      ]},
    ],
  },
  {
    slug: "Gifts & Events",
    en: "Gifts & Events",
    ar: "الهدايا والمناسبات",
    icon: "Gift",
    iconBg: "bg-purple-100 dark:bg-purple-900/40",
    iconColor: "text-purple-600 dark:text-purple-400",
    subcategories: [
      { slug: "Gifts",           en: "Gifts",           ar: "الهدايا" },
      { slug: "Flowers",         en: "Flowers",         ar: "الزهور" },
      { slug: "Party Supplies",  en: "Party Supplies",  ar: "مستلزمات الحفلات" },
      { slug: "Event Decorations",en: "Event Decorations",ar: "زينة المناسبات" },
      { slug: "Wrapping Supplies",en: "Wrapping Supplies",ar: "مستلزمات التغليف" },
    ],
    attributes: [
      { key: "occasion", en: "Occasion", ar: "المناسبة", type: "text" },
      { key: "color",    en: "Color",    ar: "اللون",    type: "text" },
    ],
  },
];

/* ── Helpers ────────────────────────────────────────────────── */

/** All valid main category slugs */
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

/** Find a category by slug */
export const findCategory = (slug: string): Category | undefined =>
  CATEGORIES.find((c) => c.slug === slug);

/** Get localized category label */
export const getCategoryLabel = (slug: string, lang: string): string => {
  const cat = findCategory(slug);
  if (!cat) return slug;
  return lang === "ar" ? cat.ar : cat.en;
};

/** Get localized subcategory label */
export const getSubcategoryLabel = (catSlug: string, subSlug: string, lang: string): string => {
  const cat = findCategory(catSlug);
  if (!cat) return subSlug;
  const sub = cat.subcategories.find((s) => s.slug === subSlug);
  if (!sub) return subSlug;
  return lang === "ar" ? sub.ar : sub.en;
};
