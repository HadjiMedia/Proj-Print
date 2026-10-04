import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { shops } from "@/db/schema";
import CustomerOrderForm from "@/components/customer-order-form";

export const dynamic = "force-dynamic";

export default async function ShopOrderPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const db = getDb();
  const [shop] = await db
    .select({ id: shops.id, name: shops.name, slug: shops.slug })
    .from(shops)
    .where(eq(shops.slug, shopSlug))
    .limit(1);

  if (!shop) notFound();
  return <CustomerOrderForm shop={shop} />;
}
