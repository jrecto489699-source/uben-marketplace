import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

// Maps a page identifier to the filename inside `storybook-audio/{productId}/`.
//   "cover"     → "Cover.mp3"
//   "4", "5"…   → "page-4.mp3", "page-5.mp3"…
function filenameForPage(page: string): string | null {
  if (page === "cover") return "Cover.mp3";
  if (/^\d+$/.test(page)) return `page-${page}.mp3`;
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string; page: string }> }
) {
  const { purchaseId, page } = await params;

  const filename = filenameForPage(page);
  if (!filename) {
    return NextResponse.json({ error: "Bad page identifier" }, { status: 400 });
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

  const audioPath = `${purchase.product_id}/${filename}`;
  const { data: signed, error: signedError } = await svc.storage
    .from("storybook-audio")
    .createSignedUrl(audioPath, SIGNED_URL_TTL);

  if (signedError || !signed?.signedUrl) {
    // No audio for this page — treat as silent, not an error.
    return NextResponse.json({ url: null }, { status: 200 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
