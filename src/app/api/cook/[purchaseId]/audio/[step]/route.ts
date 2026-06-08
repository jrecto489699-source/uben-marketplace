import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

// Step ids from the cook page: e.g. "tap-strawberries", "drag-banana",
// "tap-milk", "drag-yogurt", "tap-blend", "pour-cups". Upload MP3s
// to `cook-audio/{productId}/{step}.mp3` and they'll play when the
// kid hits the matching step.
const ALLOWED_STEPS = new Set([
  "tap-strawberries",
  "drag-banana",
  "tap-milk",
  "drag-yogurt",
  "tap-blend",
  "pour-cups",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string; step: string }> }
) {
  const { purchaseId, step } = await params;

  if (!ALLOWED_STEPS.has(step)) {
    return NextResponse.json({ error: "Bad step" }, { status: 400 });
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

  // Case-insensitive extension fallback — Supabase Storage is
  // case-sensitive and Windows uploads sometimes land as .MP3.
  const extensions = ["mp3", "MP3", "Mp3"];
  for (const ext of extensions) {
    const path = `${purchase.product_id}/${step}.${ext}`;
    const { data: signed } = await svc.storage
      .from("cook-audio")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signed?.signedUrl) {
      return NextResponse.json({ url: signed.signedUrl });
    }
  }

  // No audio uploaded for this step — silent, not an error.
  return NextResponse.json({ url: null }, { status: 200 });
}
