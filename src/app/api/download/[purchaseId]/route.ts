import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 300;   // 5 minutes
const RATE_LIMIT     = 20;    // max downloads per purchase
const RATE_WINDOW    = 3600;  // per hour (seconds)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;

  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Fetch purchase (service client so we can also update it later) ─────
  const svc = createServiceClient();
  const { data: purchase, error: purchaseError } = await svc
    .from("purchases")
    .select("id, user_id, product_id, download_count")
    .eq("id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ── 3. Ownership check (critical — never skip) ────────────────────────────
  if (purchase.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 4. Rate limit: max 20 downloads per purchase per hour ─────────────────
  const windowStart = new Date(Date.now() - RATE_WINDOW * 1000).toISOString();
  const { count } = await svc
    .from("download_logs")
    .select("*", { count: "exact", head: true })
    .eq("purchase_id", purchaseId)
    .gte("downloaded_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: "Too many downloads. Please wait before trying again." },
      { status: 429 }
    );
  }

  // ── 5. Get pdf_path from products table (never exposed to client) ──────────
  const { data: product, error: productError } = await svc
    .from("products")
    .select("pdf_path, title")
    .eq("id", purchase.product_id)
    .single();

  if (productError || !product?.pdf_path) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // ── 6. Generate signed URL (5-minute TTL, private bucket) ─────────────────
  const { data: signed, error: signedError } = await svc
    .storage
    .from("products")
    .createSignedUrl(product.pdf_path, SIGNED_URL_TTL);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Could not generate download link. Please try again." },
      { status: 500 }
    );
  }

  const filename =
    product.pdf_path.split("/").pop() ||
    `${product.title.replace(/[^a-z0-9]/gi, "_")}.pdf`;

  // ── 7. Log download + update purchase stats ───────────────────────────────
  await Promise.all([
    svc.from("download_logs").insert({ purchase_id: purchaseId, user_id: user.id }),
    svc
      .from("purchases")
      .update({
        download_count: (purchase.download_count ?? 0) + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq("id", purchaseId),
  ]);

  // ── 8. Return signed URL — pdf_path is never included ─────────────────────
  return NextResponse.json({ url: signed.signedUrl, filename });
}
