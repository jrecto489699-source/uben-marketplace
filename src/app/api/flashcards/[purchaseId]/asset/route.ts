import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

// Returns a 1-hour signed URL for one flashcard asset.
//   GET /api/flashcards/{purchaseId}/asset?card=apple&type=thumb
//   GET /api/flashcards/{purchaseId}/asset?card=apple&type=video
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;
  const search = req.nextUrl.searchParams;
  const card = (search.get("card") ?? "").trim();
  const type = (search.get("type") ?? "").trim();

  if (!card || !/^[A-Za-z0-9 _\-]+$/.test(card)) {
    return NextResponse.json({ error: "Bad card name" }, { status: 400 });
  }
  if (type !== "thumb" && type !== "video") {
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

  // Supabase Storage is case-sensitive. Try the common extension
  // variants in turn — the first one that yields a signed URL wins.
  const extensions = type === "video"
    ? ["mp4", "MP4", "Mp4"]
    : ["png", "PNG", "jpg", "JPG", "jpeg", "JPEG", "webp", "WEBP"];

  for (const ext of extensions) {
    const path = `${purchase.product_id}/${card}.${ext}`;
    const { data: signed } = await svc.storage
      .from("flashcard-videos")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signed?.signedUrl) {
      return NextResponse.json({ url: signed.signedUrl });
    }
  }

  // Treat missing as silent / placeholder — the UI handles a null URL.
  return NextResponse.json({ url: null }, { status: 200 });
}
