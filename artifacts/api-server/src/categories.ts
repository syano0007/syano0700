/* ─────────────────────────────────────────────────────────────
   Server-side category constants.
   Kept in sync with artifacts/marketplace/src/lib/categories.ts
───────────────────────────────────────────────────────────── */

export const MAIN_CATEGORY_SLUGS: string[] = [
  "Electronics",
  "Fashion",
  "Beauty & Personal Care",
  "Home & Kitchen",
  "Supermarket & Grocery",
  "Sports & Fitness",
  "Automotive",
  "Gaming & Entertainment",
  "Books & Stationery",
  "Pet Supplies",
  "Digital Products",
  "Handmade & Crafts",
  "Jewelry & Luxury",
  "Baby & Kids",
  "Tools & Construction",
  "Garden & Outdoor",
  "Gifts & Events",
];

const SUBCATEGORY_MAP: Record<string, string[]> = {
  "Electronics": [
    "Smartphones","Tablets","Laptops","Desktop PCs","Monitors","Smart Watches",
    "Headphones","Cameras","Printers","PC Components","Networking",
    "Gaming Consoles","Gaming Accessories","Smart Home Devices",
    "Storage Devices","Mobile Accessories","Computer Accessories",
  ],
  "Fashion": [
    "Men's Clothing","Women's Clothing","Kids Clothing","Shoes","Bags",
    "Watches","Jewelry","Sunglasses","Sportswear","Accessories",
  ],
  "Beauty & Personal Care": [
    "Skincare","Haircare","Makeup","Perfumes","Grooming",
    "Beauty Devices","Natural Products","Men's Care",
  ],
  "Home & Kitchen": [
    "Furniture","Home Decor","Lighting","Kitchen Tools","Home Appliances",
    "Bedding","Storage & Organization","Cleaning Supplies",
    "Bathroom Essentials","Carpets & Curtains",
  ],
  "Supermarket & Grocery": [
    "Food","Drinks","Coffee & Tea","Snacks","Organic Products","Spices","Bakery",
  ],
  "Sports & Fitness": [
    "Gym Equipment","Fitness Accessories","Sportswear",
    "Bicycles","Yoga","Outdoor Sports",
  ],
  "Automotive": [
    "Car Accessories","Car Parts","Tires","Oils & Fluids",
    "Audio Systems","Maintenance Tools","Motorcycles","Electric Scooters",
  ],
  "Gaming & Entertainment": [
    "Video Games","Gaming Accessories","Toys","Board Games","Collectibles","LEGO",
  ],
  "Books & Stationery": [
    "Books","Educational Books","Children's Books",
    "Office Supplies","School Supplies","Backpacks",
  ],
  "Pet Supplies": ["Pet Food","Pet Accessories","Pet Toys","Pet Care"],
  "Digital Products": [
    "Gift Cards","Game Codes","Digital Subscriptions",
    "Online Courses","Design Templates","Digital Files",
  ],
  "Handmade & Crafts": [
    "Handmade Products","Art","Candles","Wood Crafts","Resin Art","Embroidery",
  ],
  "Jewelry & Luxury": ["Gold","Silver","Watches","Rings","Necklaces","Bracelets"],
  "Baby & Kids": ["Baby Care","Strollers","Baby Clothing","Toys","Baby Furniture"],
  "Tools & Construction": [
    "Power Tools","Hand Tools","Electrical Supplies",
    "Plumbing","Paint Supplies","Industrial Equipment",
  ],
  "Garden & Outdoor": [
    "Plants","Gardening Tools","Outdoor Furniture","Irrigation","Outdoor Decor",
  ],
  "Gifts & Events": [
    "Gifts","Flowers","Party Supplies","Event Decorations","Wrapping Supplies",
  ],
};

export const isValidCategory = (slug: string): boolean =>
  MAIN_CATEGORY_SLUGS.includes(slug);

export const isValidSubcategory = (category: string, subcategory: string): boolean => {
  const subs = SUBCATEGORY_MAP[category];
  return subs ? subs.includes(subcategory) : false;
};
