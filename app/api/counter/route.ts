import { getAdminSession } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/httpSafety";

// Counter customization now submits through the shared artwork order endpoint.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    return Response.json({ error: "Every product requires customization. Refresh the counter and save a design before submitting." }, { status: 410 });
  } catch { return Response.json({ error: "Invalid counter request." }, { status: 400 }); }
}
