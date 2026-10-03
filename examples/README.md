# PermitIntel API examples

Four runnable samples and two MCP client configs. Every one of them was executed against production
on 2026-10-03 and the real output is pasted below, with the key redacted.

```
verify_license.sh         curl. REST contractor profile + the MCP verify_license tool call
search_permits.py         Python 3 + requests. address / contractor / feed modes
search_permits.mjs        Node 18+, built-in fetch, no dependencies. 4 modes
mcp-claude-desktop.json   Claude Desktop config
mcp-cursor.json           Cursor config, direct and npx-bridged forms
```

```bash
export PERMITINTEL_API_KEY=pmit_your_key   # https://permitintel.ai/trial, 14 days, no card
./verify_license.sh CCC1332541
python3 search_permits.py feed 2026-10-02T00:00:00Z
node search_permits.mjs address "4250 Biscayne Blvd"
```

## Read this before you copy a loop

**There is no REST endpoint for license verification.** `/api/v1/verify`, `/api/v1/verify_license`
and `/api/v1/roof` are all 404. `verify_license` and `roof_lookup` are tools on the MCP server at
`https://permitintel.ai/api/mcp`. The nearest REST surface is `GET /v1/contractors/{license}`, which
returns `license_status`, `license_type` and both license dates. Both forms are in
`verify_license.sh`.

**The change feed ends when `meta.next_cursor` is null, and at no other time.** Not on a short page,
not on an empty one. With a `trade` filter the API matches the trade after reading rows, so a bounded
scan window can hand back zero rows with plenty behind it, and `meta.scan_complete` is `false` on
those pages. Stopping early there looks exactly like success.

**Use the feed, not `from`/`to`, for anything scheduled.** The run below makes the case better than
an explanation: a feed of records changed since `2026-10-02` returned permits issued in **1995, 2007
and 2018**. Those are real records arriving from public-records responses and rescrapes. A date-window
poll never sees any of them.

**`disclosure` is not boilerplate.** Counts are a floor of what has been ingested, never a census of
what was filed. Word anything user-facing as "at least N on record".

**The key goes in a header.** `x-api-key` or `Authorization: Bearer`. Not the query string, which
lands in access logs, proxies and error trackers.

---

## Real output, 2026-10-03

### `./verify_license.sh CCC1332541`

```
== REST: GET /v1/contractors/CCC1332541 ==
  license_number       CCC1332541
  business_name        Sky Light Roofing Inc
  license_type         Certified Roofing Contractor
  license_status       Current, Active
  license_effective    2020-04-15
  license_expiration   2028-08-31
  permits on record    4176
  recent sample        10 rows (a sample, never a history)
  disclosure           Activity reflects permit records PermitIntel has ingested and is a flo...

== MCP: tools/call verify_license ==
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"CCC1332541 - Certified Roofing Contractor
Status: Current, Active (currently active)
Expires 2028-08-31 (697 days)
Verified against the DBPR sync of 2026-10-03."}],
"structuredContent":{"license_number":"CCC1332541","status":"Current, Active",
"license_type":"Certified Roofing Contractor","effective_date":"2020-04-15",
"expiration_date":"2028-08-31","qualifier_name":null,"qualifier_license":null,
"verified_at":"2026-10-03","is_active":true,"expires_in_days":697,
"disclosure":"License status reflects PermitIntel's most recent DBPR sync (refreshed daily) and is
provided for B2B verification of a licensed business, not consumer underwriting."}}}
```

### `python3 search_permits.py contractor CCC1332541`

```
  [5 records spent, unmetered left]
query={'mode': 'contractor', 'contractor': 'CCC1332541'}  count=5
  2026-10-02  FL-OSCEOLA-COUNTY         A26-007067              $5,700  SKY LIGHT ROOFING INC    roofing
              13 WEST MARBRISA
  2026-09-29  FL-LAKE-COUNTY            2026091174              $8,500  Sky Light Roofing Inc    roofing
              5010 EL ADOBE DR, LEESBURG 34748
  2026-09-23  FL-SUMTER-COUNTY          RP26-002989            $10,783  Sky Light Roofing Inc    roofing
              922 WREN ST, 32163
  2026-09-23  FL-ORANGE-COUNTY          T26009975                    -  Sky Light Roofing Inc    roofing
              4351 Ilene Ct, Orlando 32806
  2026-09-23  FL-ORANGE-COUNTY          T26010061                    -  Sky Light Roofing Inc    roofing
              7620 Simms Ave, Orlando 32812

Disclosure, and it belongs in whatever you show a user:
  Permit data reflects records PermitIntel has ingested and is not represented as a complete record
  of all permits.
```

### `python3 search_permits.py feed 2026-10-02T00:00:00Z`

Trimmed to the rows that make the point. Note the issue dates against a feed cursor of 2026-10-02:

```
page 3: 5 rows (scan_complete=True)
  2007-05-31  NC-WAKE-RALEIGH           185951-162658-PL             -  PEARCE PUMP & PLUMBING   plumbing
              5061 LANGLEY CIR, Raleigh
  ----------  FL-PALM_BEACH-BOCA_RATON  BPC-2025-02007         $98,000  Nik's Roofing LLC        roofing
              1171 NW 15th Ave, Boca Raton 33486
  ----------  FL-POLK-COUNTY            BLD-H-135949            $4,100  -                        hvac
              475 N GOLDENROD CIR, 475, AUBURNDALE 33823
  1995-07-13  FL-VOLUSIA-ORMOND_BEACH   95-00005702             $2,500  -                        roofing
              155 WARWICK AVE, ORMOND BEACH 32174
  2018-05-31  FL-BROWARD-SUNRISE        2018-90000581-00            $1  -                        -
              0 WESTON RD Unit ROW 00430, SUNRISE 33326
stopping this demo after 3 pages; cursor is still live, 15 rows so far
```

Two rows have no issue date at all. The source published none, and the API serves `null` rather than
inventing one.

### `node search_permits.mjs address "4250 Biscayne Blvd"`

```
  [5 records spent, unmetered left]
query={"mode":"address","address":"4250 Biscayne Blvd"}  count=5
  2026-08-28  FL-MIAMI_DADE-MIAMI_CITY  BD26020333001MA0       $10,000  ARS/RESCUE ROOTER          hvac
              4250 BISCAYNE BLVD, Miami 33137
  2026-07-30  FL-MIAMI_DADE-MIAMI_CITY  BD24025948001P00       $10,000  2 BROS PLUMBING LLC        general
              4250 BISCAYNE BLVD # 1501, Miami 33137
  2026-07-24  FL-MIAMI_DADE-MIAMI_CITY  BD24025948001E00        $4,200  NODAL CONSTRUCTION & ELEC  general
              4250 BISCAYNE BLVD # 1501, Miami 33137
  2026-03-31  FL-MIAMI_DADE-MIAMI_CITY  BD24025948001B00       $36,000  HABITAT GROUP INC          general
              4250 BISCAYNE BLVD, Miami 33137
  2025-11-05  FL-MIAMI_DADE-COUNTYWIDE  2026007939             $34,000  CONTEC SOUTH FLORIDA LLC   -
              4250 BISCAYNE BLVD           1501, MIAMI 33137
```

One address, two jurisdictions (`MIAMI_CITY` and `COUNTYWIDE`). That is normal and not a duplicate:
city and county both issue permits for the same building.

### `node search_permits.mjs license CCC1332541`

```
  license_number       CCC1332541
  business_name        Sky Light Roofing Inc
  license_type         Certified Roofing Contractor
  license_status       Current, Active
  license_effective    2020-04-15
  license_expiration   2028-08-31
  permits on record    4176
  links.permits        /v1/permits?contractor=CCC1332541&limit=100
```

### MCP handshake

`POST https://permitintel.ai/api/mcp` with `initialize`:

```json
{"jsonrpc":"2.0","id":1,"result":{
  "protocolVersion":"2025-06-18",
  "capabilities":{"tools":{"listChanged":false}},
  "serverInfo":{"name":"permitintel","title":"PermitIntel","version":"1.0.0"}}}
```

`tools/list` (works without a key, so a client can read the surface before signing up):

```
['verify_license', 'search_permits', 'lookup_contractor', 'roof_lookup']
```

A `GET` on `/api/mcp` returns **405 by design**. If a connectivity test reports 405, something
issued a GET; the server is fine.
