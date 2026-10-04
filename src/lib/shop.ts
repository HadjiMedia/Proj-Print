import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shops } from "@/db/schema";
import { slugify } from "@/lib/validation";

export async function ensureStarterShop() {
  const db = getDb();
  const requestedSlug = process.env.DEFAULT_SHOP_SLUG || "sunbeam-print";
  const slug = slugify(requestedSlug) || "sunbeam-print";
  const [existing] = await db.select().from(shops).where(eq(shops.slug, slug)).limit(1);
  if (existing) return existing;

  await db
    .insert(shops)
    .values({
      name: process.env.DEFAULT_SHOP_NAME?.trim() || "Sunbeam Print Co.",
      slug,
    })
    .onConflictDoNothing({ target: shops.slug });

  const [shop] = await db.select().from(shops).where(eq(shops.slug, slug)).limit(1);
  if (!shop) throw new Error("Unable to initialize the starter print shop.");
  return shop;
}
