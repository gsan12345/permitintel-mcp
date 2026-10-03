#!/usr/bin/env python3
"""Search building permits with the PermitIntel REST API (Python, requests).

    pip install requests
    export PERMITINTEL_API_KEY=pmit_your_key
    python3 search_permits.py address "4250 Biscayne Blvd"
    python3 search_permits.py contractor CCC1332541
    python3 search_permits.py feed 2026-10-02T00:00:00Z

Get a key at https://permitintel.ai/trial (14 days, no card).

Two things this sample exists to demonstrate, because they are what people get
wrong:

1. The feed terminates on `meta.next_cursor is None` and on NOTHING ELSE. Not on
   a short page, and not on an empty one. With a `trade` filter the API matches
   the trade after reading the rows, so a bounded scan window can legitimately
   return zero rows with more behind it (`meta.scan_complete` is False on those).
   Stopping early there looks exactly like success and silently under-collects.

2. `disclosure` is not boilerplate. Permit counts are a FLOOR of what has been
   ingested, never a census of what was filed, so a number you show a user has
   to be worded "at least N on record".
"""
from __future__ import annotations

import os
import sys
import time

import requests

BASE = "https://permitintel.ai/api/v1"
KEY = os.environ.get("PERMITINTEL_API_KEY", "")
if not KEY:
    sys.exit("Set PERMITINTEL_API_KEY to your pmit_ key.")

# The key travels in a header. Never put it in the query string: URLs end up in
# access logs, proxies and error trackers.
SESSION = requests.Session()
SESSION.headers.update({
    "x-api-key": KEY,
    "accept": "application/json",
    "user-agent": "permitintel-example/1.0",
})


def call(params: dict) -> dict:
    """One GET, with the two retryable failures handled and the rest surfaced."""
    for attempt in range(4):
        r = SESSION.get(f"{BASE}/permits", params=params, timeout=60)

        if r.status_code == 429:
            # Burst limit. Retry-After is in seconds.
            wait = int(r.headers.get("retry-after", 30))
            print(f"  rate limited, waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue

        if r.status_code == 402:
            # Monthly record allowance spent. Nothing is billed past it, so
            # retrying is pointless. /v1/usage still answers and says when it clears.
            body = r.json()
            sys.exit(f"Allowance spent: {body.get('message')}")

        if not r.ok:
            # Errors are flat: {"error": "...", "message": "...", "param"?: "..."}.
            # Print the API's own message; it usually names the fix.
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            sys.exit(f"HTTP {r.status_code} {body.get('error')}: {body.get('message')}")

        print(f"  [{r.headers.get('x-records-request', '?')} records spent, "
              f"{r.headers.get('x-records-remaining', 'unmetered')} left]", file=sys.stderr)
        return r.json()

    sys.exit("Still rate limited after 4 attempts.")


def show(rows: list[dict]) -> None:
    for p in rows:
        site = p.get("site") or {}
        con = p.get("contractor") or {}
        value = p.get("value_usd")
        print(
            f"  {p.get('issue_date') or '----------'}  "
            f"{(p.get('jurisdiction') or '')[:24]:24s}  "
            f"{(p.get('permit_number') or '')[:16]:16s}  "
            f"{('$' + format(value, ',')) if value else '-':>12s}  "
            f"{(con.get('name') or con.get('business_name') or '-')[:28]:28s}  "
            f"{','.join(p.get('tags') or []) or '-'}"
        )
        if site.get("address"):
            print(f"{'':14s}{site['address']}, {site.get('city') or ''} {site.get('zip') or ''}")


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "contractor"
    arg = sys.argv[2] if len(sys.argv) > 2 else "CCC1332541"

    if mode == "address":
        d = call({"address": arg, "limit": 5})
        print(f"query={d['query']}  count={d['count']}")
        show(d["permits"])

    elif mode == "contractor":
        d = call({"contractor": arg, "limit": 5})
        print(f"query={d['query']}  count={d['count']}")
        show(d["permits"])

    elif mode == "feed":
        cursor, page, total = None, 0, 0
        while True:
            params = {"updated_since": arg, "limit": 5}
            if cursor:
                params["cursor"] = cursor
            d = call(params)
            page += 1
            total += d["count"]
            print(f"page {page}: {d['count']} rows "
                  f"(scan_complete={(d.get('meta') or {}).get('scan_complete')})")
            show(d["permits"])

            cursor = (d.get("meta") or {}).get("next_cursor")
            # The ONLY terminator. Never break on a short or empty page.
            if cursor is None:
                print("feed drained: next_cursor is null")
                break
            if page >= 3:
                print(f"stopping this demo after 3 pages; cursor is still live, "
                      f"{total} rows so far")
                break
    else:
        sys.exit("mode must be address, contractor or feed")

    print("\nDisclosure, and it belongs in whatever you show a user:")
    print(f"  {call({'contractor': 'CCC1332541', 'limit': 1})['disclosure']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
