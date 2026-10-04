import { and, desc, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { printJobs, shops } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { ensureStarterShop } from "@/lib/shop";
import AdminDashboard from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  await ensureStarterShop();

  const allShops = await db
    .select({ id: shops.id, name: shops.name, slug: shops.slug, createdAt: shops.createdAt })
    .from(shops)
    .orderBy(shops.name);
  const query = await searchParams;
  const requestedSlug = Array.isArray(query.shop) ? query.shop[0] : query.shop;
  const selectedShop = allShops.find((shop) => shop.slug === requestedSlug) ?? allShops[0];
  const initialJobs = selectedShop
    ? await db
        .select({
          id: printJobs.id,
          queueNumber: printJobs.queueNumber,
          customerName: printJobs.customerName,
          fileName: printJobs.fileName,
          fileSize: printJobs.fileSize,
          paperSize: printJobs.paperSize,
          colorType: printJobs.colorType,
          copies: printJobs.copies,
          notes: printJobs.notes,
          status: printJobs.status,
          createdAt: printJobs.createdAt,
          expiresAt: printJobs.expiresAt,
        })
        .from(printJobs)
        .where(and(eq(printJobs.shopId, selectedShop.id), gt(printJobs.expiresAt, new Date())))
        .orderBy(desc(printJobs.createdAt))
        .limit(150)
    : [];

  return (
    <AdminDashboard
      shops={allShops.map((shop) => ({ ...shop, createdAt: shop.createdAt.toISOString() }))}
      selectedSlug={selectedShop?.slug ?? ""}
      initialJobs={initialJobs.map((job) => ({
        ...job,
        createdAt: job.createdAt.toISOString(),
        expiresAt: job.expiresAt.toISOString(),
      }))}
    />
  );
}
