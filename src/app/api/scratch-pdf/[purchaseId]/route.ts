import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;

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

  // Convention: scratch-pdfs bucket, file named {productId}.pdf
  const { data: signed, error: signedError } = await svc.storage
    .from("scratch-pdfs")
    .createSignedUrl(`${purchase.product_id}.pdf`, SIGNED_URL_TTL);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Scratch PDF not available yet" }, { status: 404 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
