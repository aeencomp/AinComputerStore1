import { db } from "./db";
import { laptopBatteries } from "@shared/schema";
import batteryData from "./battery-seed.json";

async function seed() {
  console.log("Seeding laptop batteries...");
  
  for (const battery of batteryData) {
    try {
      await db.insert(laptopBatteries).values({
        serialNumber: battery.serialNumber,
        partNumber: battery.partNumber,
        brand: battery.brand,
        compatibleLaptops: battery.compatibleLaptops,
        voltage: battery.voltage,
        capacity: battery.capacity,
        cells: battery.cells,
        stockQuantity: battery.stockQuantity,
        minStockLevel: battery.minStockLevel,
        purchasePrice: battery.purchasePrice,
        sellingPrice: battery.sellingPrice,
        supplier: battery.supplier,
        location: battery.location,
        notes: "Seed data imported from internet database"
      }).onConflictDoNothing();
      console.log(`Imported: ${battery.serialNumber} (${battery.brand})`);
    } catch (error) {
      console.error(`Error importing ${battery.serialNumber}:`, error);
    }
  }
  
  console.log("Seeding completed.");
  process.exit(0);
}

seed();
