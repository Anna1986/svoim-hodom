// Посредник между приложением и Travelpayouts (данные Авиасейлс).
// Ключ хранится в секретах Supabase и не попадает в браузер.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TOKEN = Deno.env.get("TRAVELPAYOUTS_TOKEN") ?? "";
const MARKER = Deno.env.get("TRAVELPAYOUTS_MARKER") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/* ---------- Справочник городов (кэшируется, пока функция «тёплая») ---------- */

type City = { name: string; country: string };
let cities: Map<string, City> | null = null;

async function loadCities() {
  if (cities) return cities;
  const [cityList, countryList] = await Promise.all([
    fetch("https://api.travelpayouts.com/data/ru/cities.json").then((r) => r.json()),
    fetch("https://api.travelpayouts.com/data/ru/countries.json").then((r) => r.json()),
  ]);
  const countries = new Map<string, string>(
    (countryList as { code: string; name: string | null }[]).map((c) => [c.code, c.name ?? c.code]),
  );
  cities = new Map(
    (cityList as { code: string; name: string | null; country_code: string; name_translations?: { en?: string } }[])
      .map((c) => [c.code, { name: c.name || c.name_translations?.en || c.code, country: countries.get(c.country_code) ?? "" }]),
  );
  return cities;
}

/* ---------- Действия ---------- */

async function places(term: string) {
  const url = new URL("https://autocomplete.travelpayouts.com/places2");
  url.searchParams.set("term", term);
  url.searchParams.set("locale", "ru");
  url.searchParams.append("types[]", "city");
  const res = await fetch(url);
  if (!res.ok) return json({ error: "Поиск городов временно недоступен" }, 502);
  const list = (await res.json()) as { code: string; name: string; country_name: string }[];
  return json({ places: list.slice(0, 8).map((p) => ({ code: p.code, name: p.name, country: p.country_name })) });
}

async function explore(origin: string, month: string, roundtrip: boolean, direct: boolean) {
  if (!TOKEN) return json({ error: "no_token" }, 400);
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.searchParams.set("origin", origin);
  if (month) url.searchParams.set("departure_at", month);
  url.searchParams.set("unique", "true");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("direct", String(direct));
  url.searchParams.set("one_way", String(!roundtrip));
  url.searchParams.set("currency", "rub");
  url.searchParams.set("limit", "40");
  url.searchParams.set("token", TOKEN);

  const [res, dict] = await Promise.all([fetch(url), loadCities().catch(() => new Map<string, City>())]);
  if (res.status === 401 || res.status === 403) return json({ error: "bad_token" }, 400);
  if (!res.ok) return json({ error: `Сервис Авиасейлс ответил ошибкой ${res.status}` }, 502);
  const body = await res.json();

  const items = ((body?.data ?? []) as Record<string, unknown>[]).map((t) => {
    const dest = String(t.destination ?? "");
    const city = dict.get(dest);
    let link = String(t.link ?? "");
    if (link) {
      link = "https://www.aviasales.ru" + link;
      if (MARKER) link += (link.includes("?") ? "&" : "?") + "marker=" + encodeURIComponent(MARKER);
    }
    return {
      destination: dest,
      city: city?.name ?? dest,
      country: city?.country ?? "",
      price: Number(t.price ?? 0),
      departure_at: String(t.departure_at ?? ""),
      return_at: String(t.return_at ?? ""),
      transfers: Number(t.transfers ?? 0),
      return_transfers: Number(t.return_transfers ?? 0),
      airline: String(t.airline ?? ""),
      link,
    };
  });
  return json({ items, origin: dict.get(origin)?.name ?? origin });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "places":
        return await places(String(body.term ?? "").slice(0, 60));
      case "explore":
        return await explore(
          String(body.origin ?? "").toUpperCase().slice(0, 3),
          /^\d{4}-\d{2}$/.test(body.month ?? "") ? body.month : "",
          body.roundtrip !== false,
          body.direct === true,
        );
      case "status":
        return json({ token: Boolean(TOKEN), marker: Boolean(MARKER) });
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
