import "dotenv/config";
import { desc } from "drizzle-orm";

import { db } from "../server/db";
import { salesShifts } from "../shared/schema";

async function main() {
  const rows = await db.select().from(salesShifts).orderBy(desc(salesShifts.startTime));
  const active = rows.filter((r) => String(r.status).toLowerCase() === "active");

  const byUser = new Map<string, number>();
  for (const r of active) {
    byUser.set(r.salesUserId, (byUser.get(r.salesUserId) ?? 0) + 1);
  }

  const dup = [...byUser.entries()].filter(([, c]) => c > 1);

  console.log("total shifts:", rows.length);
  console.log("active shifts:", active.length);
  console.log("users with >1 active:", dup.length);
  console.log("duplicates:", dup);

  if (dup.length > 0) {
    const sampleUser = dup[0][0];
    const sample = active.filter((r) => r.salesUserId === sampleUser).slice(0, 10);
    console.log("sample active shifts for user:", sampleUser);
    for (const s of sample) {
      console.log({
        id: s.id,
        status: s.status,
        startTime: s.startTime,
        endTime: s.endTime,
        createdAt: s.createdAt,
        salesUserName: s.salesUserName,
      });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

