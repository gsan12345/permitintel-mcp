#!/usr/bin/env bash
# Verify a Florida contractor license with PermitIntel.
#
# ⚠️ READ THIS FIRST, it is the thing that trips people up.
# There is NO REST endpoint for license verification. /api/v1/verify,
# /api/v1/verify_license and /api/v1/roof are all 404. `verify_license` is a tool
# on the MCP server at https://permitintel.ai/api/mcp, and the nearest REST
# surface is the contractor profile below, which returns license_status,
# license_type and the effective and expiration dates.
#
# Both forms are shown. Pick whichever matches what you are building.
#
#   export PERMITINTEL_API_KEY=pmit_your_key
#   ./verify_license.sh CCC1332541
#
# Get a key: https://permitintel.ai/trial (14 days, no card).
set -euo pipefail

LICENSE="${1:-CCC1332541}"
: "${PERMITINTEL_API_KEY:?Set PERMITINTEL_API_KEY to your pmit_ key}"

echo "== REST: GET /v1/contractors/${LICENSE} =="
# The key goes in a header, never in the URL: a URL ends up in access logs,
# shell history and error trackers.
curl -sS "https://permitintel.ai/api/v1/contractors/${LICENSE}" \
  -H "x-api-key: ${PERMITINTEL_API_KEY}" \
  | python3 -c '
import json, sys
d = json.load(sys.stdin)
c = d["contractor"]
for k in ("license_number", "business_name", "license_type", "license_status",
          "license_effective", "license_expiration"):
    print("  %-20s %s" % (k, c.get(k)))
print("  %-20s %s" % ("permits on record", c["activity"]["permit_count"]))
print("  %-20s %d rows (a sample, never a history)"
      % ("recent sample", len(d.get("recent_permits") or [])))
print("  %-20s %s" % ("disclosure", d["disclosure"][:70] + "..."))
'

echo
echo "== MCP: tools/call verify_license =="
# The MCP server speaks JSON-RPC over POST. A GET returns 405 by design, so if
# you see a 405, that is the method, not an outage. Accept must allow
# text/event-stream: the transport is streamable-http.
curl -sS -X POST https://permitintel.ai/api/mcp \
  -H "Authorization: Bearer ${PERMITINTEL_API_KEY}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",
       \"params\":{\"name\":\"verify_license\",\"arguments\":{\"license\":\"${LICENSE}\"}}}"
echo
