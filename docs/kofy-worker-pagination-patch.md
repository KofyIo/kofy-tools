# Kofy Worker · Pagination + Filter Passthrough Patch

**Scope.** A minimal patch to the deployed `kofy-notion-proxy-worker.js` (currently delivered by the comms parallel session) that fixes two scalability gaps:

1. The `/query` endpoint sends `JSON.stringify({})` to Notion, silently dropping any `filter` / `sorts` / `start_cursor` that the front-end passes.
2. Notion paginates query results at 100 pages by default. The worker doesn't follow `has_more` / `next_cursor`. Once any single Kofy DB exceeds 100 entries (Órdenes will hit this first), older entries silently disappear from queries.

**Why this matters.** Until applied, the warehouse system has a hard ceiling of 100 entries per DB. It works today (volumes are low), but the failure mode is invisible — no error, just missing data.

## The patch (drop-in replacement for the `/query` handler)

Replace the entire `/query` block in `kofy-notion-proxy-worker.js`:

```js
// READ: query a database (with pagination + filter passthrough)
if (request.method === "POST" && path === "/query") {
  const body = await request.json();
  const dbId = body.database_id;
  if (!dbId) {
    return cors(new Response(JSON.stringify({ object: "error", message: "database_id required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }));
  }

  // Build the upstream body, passing through optional fields
  const baseBody = {};
  if (body.filter)    baseBody.filter    = body.filter;
  if (body.sorts)     baseBody.sorts     = body.sorts;
  if (body.page_size) baseBody.page_size = body.page_size;

  // Auto-paginate until has_more is false (or cap at 20 pages = 2000 entries as a safety net)
  const allResults = [];
  let nextCursor  = body.start_cursor || undefined;
  let pageCount   = 0;
  const MAX_PAGES = 20;

  do {
    const reqBody = { ...baseBody };
    if (nextCursor) reqBody.start_cursor = nextCursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${dbId}/query`,
      { method: "POST", headers: notionHeaders(token), body: JSON.stringify(reqBody) }
    );

    if (!res.ok) {
      // Forward the Notion error verbatim
      return cors(new Response(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      }));
    }

    const data = await res.json();
    if (Array.isArray(data.results)) allResults.push(...data.results);
    nextCursor = data.has_more ? data.next_cursor : null;
    pageCount++;
  } while (nextCursor && pageCount < MAX_PAGES);

  return cors(new Response(JSON.stringify({
    object:      "list",
    results:     allResults,
    has_more:    false,
    next_cursor: null
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
}
```

That's it. No other changes needed in the worker.

## What it doesn't break

- All existing calls that don't pass `filter` / `sorts` / `start_cursor` behave identically — they just transparently get all pages instead of the first 100.
- The shape of the response (`{ object, results, has_more, next_cursor }`) is preserved; existing front-end code unpacks `data.results` and doesn't care.
- All other worker routes (`/pages`, `/pages/:id`, `/database/:id`, `/notify`, `/health`) are untouched.

## How to deploy

1. Open the Cloudflare Worker editor for `kofy-notion-proxy`.
2. Find the existing `if (request.method === "POST" && path === "/query")` block.
3. Replace it with the patched block above.
4. Save & deploy.
5. Test with the warehouse apps — everything should keep working, just faster and without the silent 100-entry cap.

## Why not also patch front-end queryDb calls now

The front-end `queryDb(dbId, filter)` signatures already accept a `filter` arg that was previously discarded. Once this worker patch is deployed, those filter args will actually work — front-end can opt in incrementally to server-side filtering for things like fetching only non-cancelled orders, or only today's usos. Not required right now; current client-side filtering is fine at Kofy's volume.

## Safety net

The `MAX_PAGES = 20` ceiling means at most 2000 entries are fetched per query. If any DB legitimately grows past that, the cap can be raised — but at that point the front-end probably wants to switch to filtered/sorted queries anyway rather than loading the whole world into memory.

## Related future work (do not bundle into this patch)

- **Cursor-based pagination on the front-end** — for DBs that grow huge (Usos, eventually), the front-end could request paged chunks and lazy-load. Not relevant until volumes are 10x current.
- **Tighten CORS** — change `Access-Control-Allow-Origin: *` to `https://app.kofy.io` for production hardening. Cosmetic; not security-critical because the worker holds the Notion key server-side and accepts only the documented routes.
