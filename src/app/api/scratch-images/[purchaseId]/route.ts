import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

// Pages are stored as image pairs in scratch-images bucket:
//   {productId}/scratch/1.png   ← black & white (the layer shown initially)
//   {productId}/reveal/1.png    ← rainbow colored version (shown when scratched)
//   {productId}/scratch/2.png
//   {productId}/reveal/2.png
//   …
//
// Page count = number of files in the scratch folder. Pages are paired by
// matching filename across the scratch/ and reveal/ folders.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;

  // 1. Authenticate
  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Verify purchase ownership
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

  const productId = purchase.product_id;
  const isImage = (name: string) => /\.(png|jpg|jpeg|webp)$/i.test(name);

  // 3. List both folders
  const [scratchList, revealList] = await Promise.all([
    svc.storage.from("scratch-images").list(`${productId}/scratch`, {
      sortBy: { column: "name", order: "asc" },
    }),
    svc.storage.from("scratch-images").list(`${productId}/reveal`, {
      sortBy: { column: "name", order: "asc" },
    }),
  ]);

  const scratchFiles = (scratchList.data ?? []).filter(f => isImage(f.name));
  const revealFiles  = (revealList.data ?? []).filter(f => isImage(f.name));

  if (scratchFiles.length === 0 || revealFiles.length === 0) {
    return NextResponse.json({ error: "Scratch pages not available yet" }, { status: 404 });
  }

  // 4. Pair files by name. Only keep pages that exist in BOTH folders.
  const revealByName = new Map(revealFiles.map(f => [f.name, f]));
  const pairedNames = scratchFiles
    .filter(f => revealByName.has(f.name))
    .map(f => f.name);

  if (pairedNames.length === 0) {
    return NextResponse.json(
      { error: "Scratch and reveal folders contain no matching pages" },
      { status: 404 }
    );
  }

  // 5. Generate signed URLs for each pair
  const pages = await Promise.all(
    pairedNames.map(async (name) => {
      const [scratchSigned, revealSigned] = await Promise.all([
        svc.storage.from("scratch-images").createSignedUrl(`${productId}/scratch/${name}`, SIGNED_URL_TTL),
        svc.storage.from("scratch-images").createSignedUrl(`${productId}/reveal/${name}`,  SIGNED_URL_TTL),
      ]);
      return {
        scratch: scratchSigned.data?.signedUrl ?? null,
        reveal:  revealSigned.data?.signedUrl  ?? null,
      };
    })
  );

  const validPages = pages.filter(p => p.scratch && p.reveal) as { scratch: string; reveal: string }[];
  if (validPages.length === 0) {
    return NextResponse.json({ error: "Could not generate image URLs" }, { status: 500 });
  }

  return NextResponse.json({ pages: validPages, total: validPages.length });
}
