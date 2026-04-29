# Kofy Tools

Internal production tools for the Kofy team.

## Live URLs
- Calendar: https://megaonish.github.io/kofy-tools/kofy-calendario-mayo-v5.html
- Form: https://megaonish.github.io/kofy-tools/kofy-notion-form.html
- Reader: https://megaonish.github.io/kofy-tools/kofy-notion-reader.html

## Infrastructure
- **Cloudflare Worker (proxy):** https://kofy-notion-proxy.delicate-surf-529c.workers.dev
- **Notion Database ID:** 3509b62600a080468cbedcaa3b6e4bc6
- **Notion Integration:** Kofy Forms (connected to the database above)

## How it works
The HTML files call the Cloudflare Worker, which forwards requests 
to the Notion API using the NOTION_KEY secret stored in the Worker settings.
No API keys live in the HTML files.

## If the Worker ever breaks
1. Go to dash.cloudflare.com → Workers & Pages → kofy-notion-proxy
2. Check that NOTION_KEY is still set under Settings → Variables and Secrets
3. Redeploy the worker code from /kofy-worker.js in this repo

## Adding a new team member
Share the GitHub Pages URL. No login needed.# kofy-tools
