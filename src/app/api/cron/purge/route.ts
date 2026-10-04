import { createHash, timingSafeEqual } from "node:crypto";
import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { printJobs } from "@/db/schema";
import { deletePrintFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stop well before Vercel Hobby's 60-second limit, leaving time to return a response.
const BATCH_SIZE = 50;
const WORK_BUDGET_MS = 40_000;
const OBJECT_DELETE_TIMEOUT_MS = 8_000;
const noStore = { "Cache-Control": "no-store" };

function cronAuthorized(request: Request): boolean {
  const configured = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!configured || !match) return false;

  // Never trust x-vercel-cron alone: callers can set arbitrary HTTP headers.
  // Vercel Cron and GitHub Actions must both send the configured Bearer secret.
  const expected = createHash("sha256").update(configured).digest();
  const supplied = createHash("sha256").update(match[1]).digest();
  return timingSafeEqual(expected, supplied);
}

export async function GET(request: Request) {
  return purgeExpiredJobs(request);
}

export async function POST(request: Request) {
  return purgeExpiredJobs(request);
}

async function purgeExpiredJobs(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503, headers: noStore });
  }
  if (!cronAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers: noStore });
  }

  const deadline = Date.now() + WORK_BUDGET_MS;
  try {
    const expired = await db
      .select({ id: printJobs.id, fileUrl: printJobs.fileUrl })
      .from(printJobs)
      .where(lt(printJobs.expiresAt, new Date()))
      .orderBy(asc(printJobs.expiresAt))
      .limit(BATCH_SIZE);

    let purged = 0;
    const failures: string[] = [];
    let processed = 0;
    for (const job of expired) {
      if (Date.now() >= deadline) break;
      processed += 1;
      try {
        // Delete the object first. If deletion fails, keep the record for a retry.
        await deletePrintFile(job.fileUrl, AbortSignal.timeout(OBJECT_DELETE_TIMEOUT_MS));
        const deleted = await db
          .delete(printJobs)
          .where(and(eq(printJobs.id, job.id), lt(printJobs.expiresAt, new Date())))
          .returning({ id: printJobs.id });
        if (deleted.length) purged += 1;
      } catch (error) {
        console.error(`PrintDrop retention cleanup failed for job ${job.id}.`, error);
        failures.push(job.id);
      }
    }

    // If the batch filled up or time ran out, the next scheduled run continues.
    const morePossible = expired.length === BATCH_SIZE || processed < expired.length;
    return Response.json(
      { ok: failures.length === 0, checked: processed, purged, failed: failures.length, morePossible },
      { status: failures.length ? 503 : 200, headers: noStore },
    );
  } catch (error) {
    console.error("PrintDrop retention sweep failed.", error);
    return Response.json({ error: "Unable to complete the retention sweep." }, { status: 500, headers: noStore });
  }
}
