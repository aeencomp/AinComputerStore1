import { db } from "./db";
import { sql } from "drizzle-orm";

/** Current wall-clock time in Asia/Baghdad for naive DB timestamp columns. */
export async function baghdadNow(): Promise<Date> {
  const result = await db.execute<{ now: Date }>(sql`select timezone('Asia/Baghdad', now()) as now`);
  const row = (result.rows ?? result)[0] as { now: Date };
  return new Date(row.now);
}
