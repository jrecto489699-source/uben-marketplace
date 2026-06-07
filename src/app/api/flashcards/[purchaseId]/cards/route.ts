import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Lists every card available for the given purchase. A "card" is any
// .mp4 file in `flashcard-videos/{productId}/`. We strip the
// extension and return the base names — the page pairs each one with
// its matching thumbnail (.png / .jpg) and video via the /asset route.
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

  const folder = `${purchase.product_id}`;
  const { data: files, error: listError } = await svc.storage
    .from("flashcard-videos")
    .list(folder, { limit: 500, sortBy: { column: "name", order: "asc" } });

  if (listError) {
    return NextResponse.json({ error: "Failed to list cards" }, { status: 500 });
  }

  const cards = (files ?? [])
    .map((f) => f.name)
    .filter((name) => name.toLowerCase().endsWith(".mp4"))
    .map((name) => name.replace(/\.mp4$/i, ""));

  return NextResponse.json({ cards });
}
