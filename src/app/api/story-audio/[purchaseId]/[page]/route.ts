import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

// Maps a page identifier to candidate filenames inside
// `storybook-audio/{productId}/`. Supabase Storage is case-sensitive
// and Windows often uploads .MP3 (the system shows .mp3 but the
// real filename is uppercase), so we try common variants in turn
// and use the first one that returns a signed URL.
//   "cover"     → Cover.mp3 / Cover.MP3 / cover.mp3 / cover.MP3
//   "4", "5"…   → page-4.mp3 / page-4.MP3 / page-4.Mp3
function filenameCandidates(page: string): string[] | null {
  if (page === "cover") {
    return ["Cover.mp3", "Cover.MP3", "cover.mp3", "cover.MP3"];
  }
  if (/^\d+$/.test(page)) {
    return [`page-${page}.mp3`, `page-${page}.MP3`, `page-${page}.Mp3`];
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string; page: string }> }
) {
  const { purchaseId, page } = await params;

  const candidates = filenameCandidates(page);
  if (!candidates) {
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

  for (const filename of candidates) {
    const audioPath = `${purchase.product_id}/${filename}`;
    const { data: signed } = await svc.storage
      .from("storybook-audio")
      .createSignedUrl(audioPath, SIGNED_URL_TTL);
    if (signed?.signedUrl) {
      return NextResponse.json({ url: signed.signedUrl });
    }
  }

  // No audio for this page in any case variant — treat as silent.
  return NextResponse.json({ url: null }, { status: 200 });
}
