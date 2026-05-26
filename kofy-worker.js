export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url   = new URL(request.url);
    const path  = url.pathname;
    const token = `Bearer ${env.NOTION_KEY}`;

    // ── READ: query a database ─────────────────────────────────────────
    if (request.method === "POST" && path === "/query") {
      const body = await request.json();
      const res  = await fetch(
        `https://api.notion.com/v1/databases/${body.database_id}/query`,
        {
          method:  "POST",
          headers: notionHeaders(token),
          body:    JSON.stringify({}),
        }
      );
      const text = await res.text();
      return cors(new Response(text, {
        status:  res.status,
        headers: { "Content-Type": "application/json" },
      }));
    }

    // ── CREATE: new page ───────────────────────────────────────────────
    if (request.method === "POST" && path === "/pages") {
      const body = await request.json();
      const res  = await fetch("https://api.notion.com/v1/pages", {
        method:  "POST",
        headers: notionHeaders(token),
        body:    JSON.stringify(body),
      });
      const text = await res.text();
      return cors(new Response(text, {
        status:  res.status,
        headers: { "Content-Type": "application/json" },
      }));
    }

    // ── UPDATE: patch an existing page ─────────────────────────────────
    if (request.method === "PATCH" && path.startsWith("/pages/")) {
      const pageId = path.replace("/pages/", "");
      const body   = await request.json();
      const res    = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method:  "PATCH",
        headers: notionHeaders(token),
        body:    JSON.stringify(body),
      });
      const text = await res.text();
      return cors(new Response(text, {
        status:  res.status,
        headers: { "Content-Type": "application/json" },
      }));
    }

    return new Response("Not found", { status: 404 });
  },
};

function notionHeaders(token) {
  return {
    "Authorization":  token,
    "Notion-Version": "2022-06-28",
    "Content-Type":   "application/json",
  };
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin",  "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(res.body, { status: res.status, headers: h });
}
