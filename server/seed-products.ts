import { db } from "./db.js";
import { products } from "@shared/schema";

async function seedProducts() {
  const sampleProducts = [
    {
      nameAr: "لابتوب ألعاب ROG Zephyrus",
      nameEn: "ROG Zephyrus Gaming Laptop",
      descriptionAr: "لابتوب ألعاب قوي بمعالج Intel Core i9 وكرت شاشة RTX 4080",
      descriptionEn: "Powerful gaming laptop with Intel Core i9 processor and RTX 4080 graphics card",
      price: "7999.00",
      oldPrice: "9499.00",
      category: "laptops",
      image: "gaming_laptop_product_photo.png",
      specs: ["معالج Intel Core i9-13900H", "ذاكرة عشوائية 32GB DDR5", "كرت شاشة RTX 4080 8GB", "شاشة 15.6 بوصة 240Hz"],
      badge: "خصم ١٥٪",
      inStock: 1,
    },
    {
      nameAr: "جهاز كمبيوتر مكتبي للألعاب",
      nameEn: "Gaming Desktop PC",
      descriptionAr: "جهاز كمبيوتر مكتبي عالي الأداء بإضاءة RGB",
      descriptionEn: "High-performance desktop computer with RGB lighting",
      price: "5499.00",
      oldPrice: null,
      category: "desktops",
      image: "desktop_pc_tower_photo.png",
      specs: ["معالج AMD Ryzen 9 7900X", "ذاكرة عشوائية 64GB DDR5", "كرت شاشة RTX 4090 24GB", "SSD 2TB NVMe"],
      badge: "جديد",
      inStock: 1,
    },
    {
      nameAr: "شاشة ألعاب منحنية 34 بوصة",
      nameEn: "34-inch Curved Gaming Monitor",
      descriptionAr: "شاشة ألعاب فائقة العرض بتقنية UWQHD",
      descriptionEn: "Ultrawide gaming monitor with UWQHD resolution",
      price: "2299.00",
      oldPrice: "2799.00",
      category: "monitors",
      image: "gaming_monitor_product_photo.png",
      specs: ["دقة 3440x1440 بكسل", "معدل تحديث 165Hz", "زمن استجابة 1ms", "تقنية G-Sync"],
      badge: "خصم ٢٠٪",
      inStock: 1,
    },
    {
      nameAr: "لوحة مفاتيح ميكانيكية RGB",
      nameEn: "RGB Mechanical Keyboard",
      descriptionAr: "لوحة مفاتيح ميكانيكية احترافية للألعاب",
      descriptionEn: "Professional mechanical gaming keyboard",
      price: "449.00",
      oldPrice: null,
      category: "accessories",
      image: "gaming_keyboard_product_photo.png",
      specs: ["مفاتيح Cherry MX Red", "إضاءة RGB قابلة للتخصيص", "إطار معدني متين", "مسند معصم قابل للفصل"],
      badge: null,
      inStock: 1,
    },
    {
      nameAr: "ماوس ألعاب لاسلكي",
      nameEn: "Wireless Gaming Mouse",
      descriptionAr: "ماوس ألعاب عالي الدقة مع إضاءة RGB",
      descriptionEn: "High-precision gaming mouse with RGB lighting",
      price: "299.00",
      oldPrice: "399.00",
      category: "accessories",
      image: "gaming_mouse_product_photo.png",
      specs: ["حساس بصري 25600 DPI", "بطارية تدوم 70 ساعة", "8 أزرار قابلة للبرمجة", "وزن قابل للتعديل"],
      badge: "خصم ٢٥٪",
      inStock: 1,
    },
    {
      nameAr: "سماعة ألعاب احترافية",
      nameEn: "Professional Gaming Headset",
      descriptionAr: "سماعة محيطية 7.1 مع ميكروفون قابل للفصل",
      descriptionEn: "7.1 surround sound headset with detachable microphone",
      price: "549.00",
      oldPrice: null,
      category: "accessories",
      image: "gaming_headset_product_photo.png",
      specs: ["صوت محيطي 7.1", "ميكروفون بإلغاء الضوضاء", "وسائد أذن من الجلد الناعم", "توافق مع جميع المنصات"],
      badge: null,
      inStock: 1,
    },
    {
      nameAr: "لابتوب عمل وإنتاجية",
      nameEn: "Work & Productivity Laptop",
      descriptionAr: "لابتوب خفيف الوزن مثالي للعمل والدراسة",
      descriptionEn: "Lightweight laptop perfect for work and study",
      price: "3299.00",
      oldPrice: null,
      category: "laptops",
      image: "gaming_laptop_product_photo.png",
      specs: ["معالج Intel Core i7-13700H", "ذاكرة عشوائية 16GB", "SSD 512GB", "شاشة 14 بوصة Full HD"],
      badge: null,
      inStock: 1,
    },
    {
      nameAr: "جهاز كمبيوتر مكتبي للمكاتب",
      nameEn: "Office Desktop Computer",
      descriptionAr: "جهاز كمبيوتر مكتبي كامل للاستخدام المكتبي",
      descriptionEn: "Complete desktop computer for office use",
      price: "2499.00",
      oldPrice: null,
      category: "desktops",
      image: "desktop_pc_tower_photo.png",
      specs: ["معالج Intel Core i5-13400", "ذاكرة عشوائية 16GB", "SSD 512GB", "Windows 11 Pro"],
      badge: null,
      inStock: 1,
    },
  ];

  console.log("Seeding products...");
  
  const existing = await db.select().from(products);
  if (existing.length > 0) {
    console.log("Products already exist, skipping seed.");
    return;
  }

  for (const product of sampleProducts) {
    await db.insert(products).values(product);
  }

  console.log(`Seeded ${sampleProducts.length} products successfully!`);
}

seedProducts()
  .then(() => {
    console.log("Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
