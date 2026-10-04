import { and, eq, gt } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { printJobs, shops } from "@/db/schema";
import OrderStatusTracker from "@/components/order-status-tracker";

export const dynamic = "force-dynamic";

export default async function JobStatusPage({
  params,
}: {
  params: Promise<{ shopSlug: string; jobId: string }>;
}) {
  const { shopSlug, jobId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) notFound();

  const [job] = await db
    .select({
      id: printJobs.id,
      shopSlug: shops.slug,
      shopName: shops.name,
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
    .innerJoin(shops, eq(printJobs.shopId, shops.id))
    .where(and(eq(printJobs.id, jobId), eq(shops.slug, shopSlug), gt(printJobs.expiresAt, new Date())))
    .limit(1);

  if (!job) notFound();
  return <OrderStatusTracker job={{ ...job, createdAt: job.createdAt.toISOString(), expiresAt: job.expiresAt.toISOString() }} />;
}
