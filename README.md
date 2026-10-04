# PrintDrop

PrintDrop is a QR-code print-order dispatch app for local print shops. Customers can submit a print request without creating an account; staff use a protected, live-updating queue to retrieve files and move jobs through Waiting, Printing, Done, and Cancelled.

## Stack and data model

- Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, and Framer Motion
- PostgreSQL with Drizzle ORM (this repository is configured for Drizzle rather than Prisma)
- Private local filesystem storage for development, or a private S3-compatible bucket for production
- Five-second dashboard/status polling, HMAC-signed staff sessions, and an authenticated retention endpoint

`src/db/schema.ts` defines `shops` and `print_jobs`, including the `job_status`, `paper_size`, and `color_type` PostgreSQL enums. `shop_id` is a cascading foreign key, queue numbers are allocated atomically per shop, and `expires_at` is indexed for retention cleanup. `file_url` stores a private storage reference (`local:...` or `s3:...`), not a public URL.

## Local setup

1. Install Node.js 20+ and run PostgreSQL. Create a database (the default local URL is `postgresql://postgres:postgres@127.0.0.1:5432/app_db`).
2. Copy `.env.example` to `.env`, then set `DATABASE_URL`, a strong `ADMIN_PASSWORD`, and a unique `SESSION_SECRET` with at least 32 characters. Set a separate random `CRON_SECRET`. For example, generate secrets with `openssl rand -base64 48`.
3. Install packages with `npm install` if needed.
4. Create/update the database tables with `npx drizzle-kit push`.
5. Start the app with `npm run dev` and open `http://localhost:3000`. The home page provisions the configured starter shop on first visit. The sample customer order page is `/sunbeam-print` (or the slug in `DEFAULT_SHOP_SLUG`).
6. Open `/admin/login` and sign in with `ADMIN_PASSWORD`. The dashboard supports multiple shops; use **Add shop** to create more tenant-isolated order pages.

The staff dashboard is deliberately disabled until both `ADMIN_PASSWORD` and a sufficiently long `SESSION_SECRET` are configured. Staff sessions are HTTP-only, SameSite cookies with a 12-hour expiration. All staff API endpoints and file downloads verify that session.

## File storage

Without `S3_BUCKET`, uploaded files are stored privately outside the web root in the operating system temp directory under `printdrop-uploads`. Set `PRINTDROP_STORAGE_DIR` to choose a persistent private directory for a single-node deployment. Do not mount this directory under `public/` or expose it from a static file server.

For a horizontally scaled/serverless production deployment, configure a private S3-compatible bucket using `S3_BUCKET` and `S3_REGION`; optionally configure `S3_ENDPOINT` for a compatible provider and provide `S3_ACCESS_KEY_ID` plus `S3_SECRET_ACCESS_KEY` (or use the runtime IAM role). The app writes encrypted objects, never exposes bucket URLs, and streams downloads through an authenticated route. Grant the app only the required `PutObject`, `GetObject`, and `DeleteObject` permissions for the upload prefix. Configure bucket lifecycle rules as a second line of defense if your provider supports them.

Uploads accept PDF, DOCX, PNG, JPG, and JPEG files, enforce a 50 MiB maximum, validate extension/MIME and file signatures, and generate storage keys independently from customer filenames. Do not lower proxy/request-body limits below the supported upload size. The app uses Node.js route handlers for file streaming and the cron task.

## Retention schedule

`GET` and `POST /api/cron/purge` remove expired storage objects and then delete their database records. Jobs expire 24 hours after creation. Failed object deletions are logged and left in the database for the next sweep. The endpoint requires `Authorization: Bearer $CRON_SECRET` and returns counts for monitoring.

A Vercel schedule is included in `vercel.json` (hourly at minute 15); configure the same `CRON_SECRET` in the deployment environment. For another scheduler, call the endpoint hourly, for example:

```sh
curl --fail-with-body -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain.example/api/cron/purge
```

Also retain a storage-provider lifecycle policy for the upload prefix when available. The cron route processes up to 250 expired jobs per call; invoke it again if a backlog remains.

## Routes

- `GET /[shopSlug]` — customer upload form
- `GET /[shopSlug]/status/[jobId]` — live customer status page
- `GET /admin/login` and `GET /admin/dashboard` — staff sign-in and queue
- `POST /api/jobs` — validated customer upload and job creation
- `GET /api/jobs/[jobId]` — public-safe status response (no file storage reference)
- `GET /api/jobs/[jobId]/download` — staff-authenticated private file stream
- `GET /api/admin/jobs?shop=[slug]`, `PATCH /api/admin/jobs/[jobId]`, and `/api/admin/shops` — authenticated staff operations
- `GET /api/qr-code?shop=[slug]` — shop-specific SVG QR code
- `GET /api/cron/purge` — authenticated retention sweep
- `GET /api/health` — platform health check

For QR links using the root query form (`/?shop=STORE_ID`), PrintDrop redirects known shop slugs or UUIDs to `/{shopSlug}`. QR codes point directly to the shop path.

## Production checklist

- Use HTTPS and set `NEXT_PUBLIC_APP_URL` to the canonical origin so printed QR codes do not depend on a proxy hostname.
- Use a distinct, high-entropy `SESSION_SECRET`, `CRON_SECRET`, and staff password; never commit `.env`.
- Configure S3-compatible private storage and least-privilege IAM for multi-instance deployments.
- Schedule the purge route and monitor its `failed` count and server logs.
- Set sensible reverse-proxy request size and timeout limits for 50 MiB multipart uploads.
- Add per-shop staff identity/roles, billing, audit logging, and rate limiting before opening a public multi-tenant SaaS.
