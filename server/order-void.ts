import { db } from "./db";
import { storage } from "./storage";
import {
  orders,
  laptops,
  desktops,
  keyboards,
  lcds,
  laptopBatteries,
  acAdapters,
  inStoreProducts,
} from "@shared/schema";
import type { Order } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { mirrorLegacyStockFromUnified } from "./instore-unified";
import { syncLaptopBatteryById, syncAcAdapterById } from "./battery-instore-sync";

function parseOrderItem(rawItem: unknown): Record<string, unknown> | null {
  try {
    const item = typeof rawItem === "string" ? JSON.parse(rawItem) : rawItem;
    return item && typeof item === "object" ? (item as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Restore inventory for a POS or online order (reverse of sale). */
export async function restoreOrderInventory(
  order: Pick<Order, "orderNumber" | "orderType" | "items">,
  reason: string,
): Promise<void> {
  if (!order.items?.length) return;

  const isPosOrder = order.orderType === "walk-in" || order.orderType === "in-store";
  const isOnlineOrder = order.orderType === "online";
  if (!isPosOrder && !isOnlineOrder) return;

  for (const rawItem of order.items) {
    const item = parseOrderItem(rawItem);
    if (!item) continue;

    const qty = parseInt(String(item.quantity ?? "1"), 10) || 1;
    const productIdStr = item.productId ? String(item.productId) : "";
    const numericProductId = productIdStr && !Number.isNaN(parseInt(productIdStr, 10))
      ? parseInt(productIdStr.replace(/^inst-/, ""), 10)
      : null;
    const inferredSource =
      (item.productSource as string | undefined)
      || (item.batteryId ? "battery" : null)
      || (item.adapterId ? "adapter" : null)
      || (item.keyboardId ? "keyboard" : null)
      || (item.lcdId ? "lcd" : null)
      || (item.laptopId ? "laptop" : null)
      || (item.desktopId ? "desktop" : null)
      || (productIdStr.startsWith("bat-") ? "battery" : null)
      || (productIdStr.startsWith("ada-") ? "adapter" : null)
      || (productIdStr.startsWith("kbd-") ? "keyboard" : null)
      || (productIdStr.startsWith("lcd-") ? "lcd" : null)
      || (productIdStr.startsWith("lap-") ? "laptop" : null)
      || (productIdStr.startsWith("des-") ? "desktop" : null)
      || (productIdStr.startsWith("inst-") ? "instore" : null)
      || (numericProductId !== null ? "instore" : null);

    try {
      if (inferredSource === "battery" && (item.batteryId || productIdStr.startsWith("bat-"))) {
        const targetId = String(item.batteryId || productIdStr.replace(/^bat-/, ""));
        await db.update(laptopBatteries)
          .set({ stockQuantity: sql`stock_quantity + ${qty}` })
          .where(eq(laptopBatteries.id, targetId));
        await syncLaptopBatteryById(targetId);
      } else if (inferredSource === "adapter" && (item.adapterId || productIdStr.startsWith("ada-"))) {
        const targetId = String(item.adapterId || productIdStr.replace(/^ada-/, ""));
        await db.update(acAdapters)
          .set({ stockQuantity: sql`stock_quantity + ${qty}` })
          .where(eq(acAdapters.id, targetId));
        await syncAcAdapterById(targetId);
      } else if (inferredSource === "keyboard" && (item.keyboardId || productIdStr.startsWith("kbd-"))) {
        const targetId = String(item.keyboardId || productIdStr.replace(/^kbd-/, ""));
        await db.update(keyboards)
          .set({ stockQuantity: sql`stock_quantity + ${qty}`, updatedAt: new Date() })
          .where(eq(keyboards.id, targetId));
      } else if (inferredSource === "lcd" && (item.lcdId || productIdStr.startsWith("lcd-"))) {
        const targetId = String(item.lcdId || productIdStr.replace(/^lcd-/, ""));
        await db.update(lcds)
          .set({ stockQuantity: sql`stock_quantity + ${qty}`, updatedAt: new Date() })
          .where(eq(lcds.id, targetId));
      } else if (inferredSource === "laptop" && (item.laptopId || productIdStr.startsWith("lap-"))) {
        const targetId = String(item.laptopId || productIdStr.replace(/^lap-/, ""));
        await db.update(laptops)
          .set({ stockQuantity: sql`stock_quantity + ${qty}`, updatedAt: new Date() })
          .where(eq(laptops.id, targetId));
      } else if (inferredSource === "desktop" && (item.desktopId || productIdStr.startsWith("des-"))) {
        const targetId = String(item.desktopId || productIdStr.replace(/^des-/, ""));
        await db.update(desktops)
          .set({ stockQuantity: sql`stock_quantity + ${qty}`, updatedAt: new Date() })
          .where(eq(desktops.id, targetId));
      } else if (inferredSource === "instore" && numericProductId !== null) {
        await storage.adjustInStoreProductStock(numericProductId, qty);
        const [product] = await db
          .select()
          .from(inStoreProducts)
          .where(eq(inStoreProducts.id, numericProductId))
          .limit(1);
        if (product) await mirrorLegacyStockFromUnified(product);
      } else if (item.productId && Number.isNaN(parseInt(String(item.productId), 10))) {
        await storage.adjustProductStock(
          String(item.productId),
          qty,
          undefined,
          reason,
          order.orderNumber,
        );
      }
    } catch (itemErr) {
      console.error(`Failed to restore stock for item in order ${order.orderNumber}:`, itemErr);
    }
  }
}

export async function voidOrder(
  orderId: string,
  voidedBy: string,
  voidReason?: string,
): Promise<Order | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  if (order.status === "voided") {
    throw new Error("الطلب ملغى مسبقاً");
  }

  await restoreOrderInventory(order, `Void order ${order.orderNumber}`);

  const [updated] = await db
    .update(orders)
    .set({
      status: "voided",
      voidedAt: new Date(),
      voidedBy,
      voidReason: voidReason?.trim() || null,
    })
    .where(eq(orders.id, orderId))
    .returning();

  return updated ?? null;
}
