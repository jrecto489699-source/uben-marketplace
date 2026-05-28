import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600; // 1 hour — long enough for PDF.js to fully load the document

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

  // 3. Generate signed URL for the coloring PDF.
  //    Convention: coloring-pdfs bucket, file named {productId}.pdf
  const pdfPath = `${purchase.product_id}.pdf`;
  const { data: signed, error: signedError } = await svc.storage
    .from("coloring-pdfs")
    .createSignedUrl(pdfPath, SIGNED_URL_TTL);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Coloring PDF not available yet" }, { status: 404 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
