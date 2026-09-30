const CLOUD_JSON_URL = "https://superjsonblob.com/api/jsonBlob/add881a9-8cf5-4c54-bd0b-9f25c5d74c18";
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

function validState(state) {
  return state && Array.isArray(state.inventory) && Array.isArray(state.sales) && Array.isArray(state.entries) && Array.isArray(state.users);
}

export default async function handler(request) {
  if (request.method === "GET") {
    const response = await fetch(`${CLOUD_JSON_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return reply({ error: "Shared JSON unavailable" }, 502);
    return new Response(await response.text(), { status: 200, headers });
  }

  if (request.method === "PUT") {
    const state = await request.json().catch(() => null);
    if (!validState(state)) return reply({ error: "Invalid state payload" }, 400);
    const response = await fetch(CLOUD_JSON_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!response.ok) return reply({ error: "Shared JSON write failed" }, 502);
    return reply({ ok: true, updatedAt: state.sharedUpdatedAt });
  }

  return reply({ error: "Method not allowed" }, 405);
}
