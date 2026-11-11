// Открывает поездку по ссылке «поделиться» (только просмотр, без входа).
// Работает с правами сервиса, поэтому сама проверяет токен и отдаёт только одну поездку владельца ссылки.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// Поля, которые не показываем, если владелец выбрал «только план»
const PRIVATE_ITEM_FIELDS = ["bookingRef", "link", "notes"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { token } = await req.json().catch(() => ({}));
    if (typeof token !== "string" || token.length < 20 || token.length > 100) return json({ error: "not_found" }, 404);

    const { data: share } = await admin
      .from("shares")
      .select("user_id, trip_id, include_details, revoked_at")
      .eq("token", token)
      .maybeSingle();
    if (!share || share.revoked_at) return json({ error: "not_found" }, 404);

    const { data: tripRow } = await admin
      .from("records")
      .select("data")
      .eq("user_id", share.user_id)
      .eq("id", share.trip_id)
      .eq("kind", "trip")
      .eq("deleted", false)
      .maybeSingle();
    if (!tripRow) return json({ error: "not_found" }, 404);

    const { data: itemRows } = await admin
      .from("records")
      .select("data")
      .eq("user_id", share.user_id)
      .eq("kind", "item")
      .eq("deleted", false)
      .eq("data->>tripId", share.trip_id);

    const details = share.include_details;
    const items = (itemRows ?? []).map((r) => {
      const it = { ...(r.data as Record<string, unknown>) };
      if (!details) for (const f of PRIVATE_ITEM_FIELDS) it[f] = "";
      return it;
    });

    const trip = { ...(tripRow.data as Record<string, unknown>) };
    if (!details) trip.notes = "";

    // Файлы — только если разрешено; ссылки действуют 2 часа
    let files: { id: string; ownerId: string; name: string; mime: string; size: number; url: string }[] = [];
    if (details && items.length) {
      const ids = items.map((i) => String(i.id));
      const { data: attRows } = await admin
        .from("records")
        .select("id, data")
        .eq("user_id", share.user_id)
        .eq("kind", "attachment")
        .eq("deleted", false)
        .in("data->>ownerId", ids);
      const atts = (attRows ?? []).map((r) => r.data as Record<string, unknown>);
      if (atts.length) {
        const { data: signed } = await admin.storage
          .from("files")
          .createSignedUrls(atts.map((a) => `${share.user_id}/${a.id}`), 60 * 60 * 2);
        files = atts.map((a, i) => ({
          id: String(a.id),
          ownerId: String(a.ownerId),
          name: String(a.name ?? "файл"),
          mime: String(a.mime ?? ""),
          size: Number(a.size ?? 0),
          url: signed?.[i]?.signedUrl ?? "",
        })).filter((f) => f.url);
      }
    }

    const { data: owner } = await admin.auth.admin.getUserById(share.user_id);
    const ownerName = String(owner?.user?.user_metadata?.name ?? "").trim();

    return json({ trip, items, files, details, ownerName });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
