import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

// Returns a 1-hour signed URL for one animal asset.
//   GET /api/identify/{purchaseId}/asset?animal=dog&type=image
//   GET /api/identify/{purchaseId}/asset?animal=dog&type=audio
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;
  const search = req.nextUrl.searchParams;
  const animal = (search.get("animal") ?? "").trim();
  const type   = (search.get("type")   ?? "").trim();

  if (!animal || !/^[A-Za-z0-9 _\-]+$/.test(animal)) {
    return NextResponse.json({ error: "Bad animal name" }, { status: 400 });
  }
  if (type !== "image" && type !== "audio") {
    return NextResponse.json({ error: "Bad asset type" }, { status: 400 });
  }

  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data: purchase, error: purchaseError } = await svc
    .from("purchases")
    .select("id, user_id, product_id")
    .eq("id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }
  if (purchase.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filename = type === "image" ? `${animal}.png` : `${animal}.mp3`;
  const path = `${purchase.product_id}/${filename}`;

  const { data: signed, error: signedError } = await svc.storage
    .from("identification-assets")
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (signedError || !signed?.signedUrl) {
    // Treat missing as silent / placeholder — the UI handles a null URL.
    return NextResponse.json({ url: null }, { status: 200 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
