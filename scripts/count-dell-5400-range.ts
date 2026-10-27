import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { laptops, repairTickets } from "@shared/schema";
import { and, gte, lt, sql, or, ilike } from "drizzle-orm";

async function runQuery(label: string, connectionString: string) {
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  const year = 2026;
  const start = new Date(`${year}-09-11T00:00:00+03:00`);
  const end = new Date(`${year}-10-28T00:00:00+03:00`);

  console.log(`\n========== ${label} ==========`);

  const dell5400Where = and(
    gte(repairTickets.createdAt, start),
    lt(repairTickets.createdAt, end),
    ilike(repairTickets.deviceBrand, "%dell%"),
    ilike(repairTickets.deviceModel, "%5400%"),
  );

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(repairTickets)
    .where(dell5400Where);

  const rows = await db
    .select({
      ticketNumber: repairTickets.ticketNumber,
      deviceBrand: repairTickets.deviceBrand,
      deviceModel: repairTickets.deviceModel,
      status: repairTickets.status,
      createdAt: repairTickets.createdAt,
    })
    .from(repairTickets)
    .where(dell5400Where)
    .orderBy(repairTickets.createdAt);

  console.log(
    `Dell 5400 repair intakes: ${c} (created ${year}-09-11 through ${year}-10-27, Asia/Baghdad)`,
  );
  if (rows.length) {
    for (const r of rows) {
      console.log(
        `  ${r.ticketNumber}\t${r.deviceBrand} ${r.deviceModel}\t${r.status}\t${r.createdAt?.toISOString?.() ?? r.createdAt}`,
      );
    }
  }

  const allTimeRows = await db
    .select({
      ticketNumber: repairTickets.ticketNumber,
      deviceModel: repairTickets.deviceModel,
      createdAt: repairTickets.createdAt,
    })
    .from(repairTickets)
    .where(
      and(
        ilike(repairTickets.deviceBrand, "%dell%"),
        ilike(repairTickets.deviceModel, "%5400%"),
      ),
    )
    .orderBy(repairTickets.createdAt);
  if (allTimeRows.length) {
    console.log("\nAll-time Dell 5400 tickets (for reference):");
    for (const r of allTimeRows) {
      console.log(`  ${r.ticketNumber}\t${r.deviceModel}\t${r.createdAt}`);
    }
  }

  const modelVariants = await db
    .select({
      deviceModel: repairTickets.deviceModel,
      c: sql<number>`count(*)::int`,
    })
    .from(repairTickets)
    .where(
      and(
        gte(repairTickets.createdAt, start),
        lt(repairTickets.createdAt, end),
        ilike(repairTickets.deviceBrand, "%dell%"),
        or(
          ilike(repairTickets.deviceModel, "%540%"),
          ilike(repairTickets.deviceModel, "%54 00%"),
        ),
      ),
    )
    .groupBy(repairTickets.deviceModel)
    .orderBy(sql`count(*) desc`);

  if (modelVariants.length) {
    console.log("\nDell models matching 540* in same range:");
    for (const v of modelVariants) {
      console.log(`  ${v.c}\t${v.deviceModel}`);
    }
  }

  const allTimeDell5400 = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(repairTickets)
    .where(
      and(
        ilike(repairTickets.deviceBrand, "%dell%"),
        ilike(repairTickets.deviceModel, "%5400%"),
      ),
    );
  console.log(`All-time Dell 5400 repair intakes: ${allTimeDell5400[0]?.c ?? 0}`);

  const span = await db
    .select({
      min: sql<string>`min(${repairTickets.createdAt})`,
      max: sql<string>`max(${repairTickets.createdAt})`,
      total: sql<number>`count(*)::int`,
    })
    .from(repairTickets);
  console.log("repair_tickets DB span:", span[0]);

  try {
    const laptopWhere = and(
      gte(laptops.createdAt, start),
      lt(laptops.createdAt, end),
      ilike(laptops.brand, "%dell%"),
      ilike(laptops.model, "%5400%"),
    );
    const laptopCount = await db
      .select({
        c: sql<number>`count(*)::int`,
        qty: sql<number>`coalesce(sum(${laptops.stockQuantity}),0)::int`,
      })
      .from(laptops)
      .where(laptopWhere);
    console.log(
      `Laptops inventory rows (Dell 5400, created in range): ${laptopCount[0]?.c ?? 0} rows, stock sum ${laptopCount[0]?.qty ?? 0}`,
    );
  } catch {
    /* laptops table may be missing on older DB snapshots */
  }

  await pool.end();
}

async function main() {
  if (process.env.DATABASE_URL) {
    await runQuery("DATABASE_URL", process.env.DATABASE_URL);
  }
  if (process.env.REMOTE_DATABASE_URL) {
    await runQuery("REMOTE_DATABASE_URL", process.env.REMOTE_DATABASE_URL);
  } else {
    console.log("\n(REMOTE_DATABASE_URL not set — production counts need Neon URL in .env)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
