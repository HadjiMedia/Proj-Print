import { and, desc, eq, gt } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { getDb } from "@/db";
import { printJobs, shops } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Staff sign-in is required." }, { status: 401 });
  }

  const shopSlug = new URL(request.url).searchParams.get("shop");
  if (!shopSlug) return Response.json({ error: "Choose a shop." }, { status: 400 });

  try {
    const db = getDb();
    const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.slug, shopSlug)).limit(1);
    if (!shop) return Response.json({ error: "Shop not found." }, { status: 404 });

    const jobs = await db
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
      .where(and(eq(printJobs.shopId, shop.id), gt(printJobs.expiresAt, new Date())))
      .orderBy(desc(printJobs.createdAt))
      .limit(150);

    return Response.json({ jobs }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("PrintDrop dashboard refresh failed.", error);
    return Response.json({ error: "Unable to refresh the print queue." }, { status: 500 });
  }
}
