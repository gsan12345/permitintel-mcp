# PermitIntel MCP server and API examples

PermitIntel.ai is a building permit data API. This repository holds the MCP server details, client
configs, and runnable examples for it. The server itself is hosted; nothing here needs to be deployed.

## MCP server

Remote endpoint: `https://permitintel.ai/api/mcp` (streamable HTTP, protocol 2025-06-18).
Manifest: `https://permitintel.ai/.well-known/mcp.json`. A GET to the endpoint returns 405 by design; POST.

Tools: `verify_license`, `search_permits`, `lookup_contractor`, `roof_lookup`.

`tools/list` needs no key, so you can point a client at it and see the surface before signing up.
Calls need a key. 14-day trial at https://permitintel.ai/trial, no card.

```json
{
  "mcpServers": {
    "permitintel": {
      "type": "http",
      "url": "https://permitintel.ai/api/mcp",
      "headers": { "Authorization": "Bearer pmit_your_key" }
    }
  }
}
```

Ready-made configs: [`examples/mcp-claude-desktop.json`](examples/mcp-claude-desktop.json) and
[`examples/mcp-cursor.json`](examples/mcp-cursor.json).

## What it answers

What permits exist at this address. What has this contractor pulled, where, and how recently. Is
this Florida license active or did it lapse. How old is the roof on this property and what is it made of.

Scope on November 8, 2026: 106,253,273 permit records across all 50 states and Washington, DC,
in 2,682 published jurisdictions. These figures move with every nightly load; the live numbers,
per state and per jurisdiction, are at `GET https://permitintel.ai/api/v1/coverage` (no key needed,
costs 0 records).

Two limits you will hit. Counts are floors: we hold what the permit offices publish, and every
response carries a `disclosure` field, so phrase answers as "at least N on record". License
verification is Florida only; the permit data is national, the DBPR join is not.

## REST API

OpenAPI 3.1 document: [`openapi/permitintel-v1.yaml`](openapi/permitintel-v1.yaml).
Docs: https://permitintel.ai/docs. Runnable curl, Python and Node samples with real output:
[`examples/README.md`](examples/README.md).

## Links

- Website https://permitintel.ai
- Docs https://permitintel.ai/docs#mcp
- Pricing https://permitintel.ai/pricing
- Support records@permitintel.ai

A Contract Advantage LLC product.
