import "dotenv/config";
import { syncPrices, syncDesktopPrices } from "../server/price-sync";

async function main() {
  console.log("=== Laptop sync ===");
  const laptop = await syncPrices();
  console.log(JSON.stringify(laptop, null, 2));

  console.log("\n=== Desktop sync ===");
  const desktop = await syncDesktopPrices();
  console.log(JSON.stringify(desktop, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
