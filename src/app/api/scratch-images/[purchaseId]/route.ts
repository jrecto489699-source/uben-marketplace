import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

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

  // 3. List all images in scratch-images/{productId}/
  // Upload images named: 1.png, 2.png, 3.png … in a folder named after the product ID
  const folder = `${purchase.product_id}`;
  const { data: files, error: listError } = await svc.storage
    .from("scratch-images")
    .list(folder, { sortBy: { column: "name", order: "asc" } });

  if (listError || !files || files.length === 0) {
    return NextResponse.json({ error: "No scratch images found yet" }, { status: 404 });
  }

  // 4. Generate signed URLs for each image
  const imageFiles = files.filter(f => f.name.match(/\.(png|jpg|jpeg|webp)$/i));
  if (imageFiles.length === 0) {
    return NextResponse.json({ error: "No scratch images found yet" }, { status: 404 });
  }

  const urls = await Promise.all(
    imageFiles.map(async (file) => {
      const { data: signed } = await svc.storage
        .from("scratch-images")
        .createSignedUrl(`${folder}/${file.name}`, SIGNED_URL_TTL);
      return signed?.signedUrl ?? null;
    })
  );

  const validUrls = urls.filter(Boolean) as string[];
  if (validUrls.length === 0) {
    return NextResponse.json({ error: "Could not generate image URLs" }, { status: 500 });
  }

  return NextResponse.json({ urls: validUrls, total: validUrls.length });
}
