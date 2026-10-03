#!/usr/bin/env node
/**
 * Search building permits with the PermitIntel REST API (Node 18+, built-in fetch).
 *
 *   export PERMITINTEL_API_KEY=pmit_your_key
 *   node search_permits.mjs address "4250 Biscayne Blvd"
 *   node search_permits.mjs contractor CCC1332541
 *   node search_permits.mjs feed 2026-10-02T00:00:00Z
 *   node search_permits.mjs license CCC1332541     # license status, REST form
 *
 * No dependencies. Get a key at https://permitintel.ai/trial (14 days, no card).
 *
 * The feed loop below is the part worth copying. It stops on
 * `meta.next_cursor === null` and on nothing else: not on a short page, and not
 * on an empty one. With a `trade` filter the API matches the trade after reading
 * the rows, so a bounded scan window can return zero rows with plenty behind it.
 * Breaking there looks like success and quietly under-collects.
 */
const BASE = 'https://permitintel.ai/api/v1';
const KEY = process.env.PERMITINTEL_API_KEY;
if (!KEY) {
  console.error('Set PERMITINTEL_API_KEY to your pmit_ key.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, params) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, {
      // Header, not a query parameter. A key in a URL ends up in logs.
      headers: { 'x-api-key': KEY, accept: 'application/json' },
    });

    if (res.status === 429) {
      const wait = Number.parseInt(res.headers.get('retry-after') ?? '30', 10);
      console.error(`  rate limited, waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }

    const body = await res.json().catch(() => null);

    if (res.status === 402) {
      // Allowance spent. Nothing is billed past it and retrying is pointless.
      console.error(`Allowance spent: ${body?.message}`);
      process.exit(1);
    }
    if (!res.ok) {
      // Flat error envelope: { error, message, param? }. The message names the fix.
      console.error(`HTTP ${res.status} ${body?.error}: ${body?.message}`);
      process.exit(1);
    }

    console.error(
      `  [${res.headers.get('x-records-request') ?? '?'} records spent, ` +
      `${res.headers.get('x-records-remaining') ?? 'unmetered'} left]`,
    );
    return body;
  }
  console.error('Still rate limited after 4 attempts.');
  return process.exit(1);
}

const money = (v) => (v ? `$${v.toLocaleString('en-US')}` : '-');

function show(rows) {
  for (const p of rows) {
    const site = p.site ?? {};
    const con = p.contractor ?? {};
    console.log(
      `  ${p.issue_date ?? '----------'}  ` +
      `${(p.jurisdiction ?? '').slice(0, 24).padEnd(24)}  ` +
      `${(p.permit_number ?? '').slice(0, 16).padEnd(16)}  ` +
      `${money(p.value_usd).padStart(12)}  ` +
      `${(con.name ?? con.business_name ?? '-').slice(0, 28).padEnd(28)}  ` +
      `${(p.tags ?? []).join(',') || '-'}`,
    );
    if (site.address) {
      console.log(`${' '.repeat(14)}${site.address}, ${site.city ?? ''} ${site.zip ?? ''}`);
    }
  }
}

const mode = process.argv[2] ?? 'contractor';
const arg = process.argv[3] ?? 'CCC1332541';

if (mode === 'address' || mode === 'contractor') {
  const d = await call('/permits', { [mode]: arg, limit: 5 });
  console.log(`query=${JSON.stringify(d.query)}  count=${d.count}`);
  show(d.permits);
  console.log(`\n${d.disclosure}`);
} else if (mode === 'feed') {
  let cursor = null;
  let page = 0;
  let total = 0;
  for (;;) {
    const params = { updated_since: arg, limit: 5 };
    if (cursor) params.cursor = cursor;
    const d = await call('/permits', params);
    page += 1;
    total += d.count;
    console.log(`page ${page}: ${d.count} rows (scan_complete=${d.meta?.scan_complete})`);
    show(d.permits);

    cursor = d.meta?.next_cursor ?? null;
    if (cursor === null) { console.log('feed drained: next_cursor is null'); break; }
    if (page >= 3) { console.log(`stopping this demo after 3 pages; cursor still live, ${total} rows`); break; }
  }
} else if (mode === 'license') {
  // There is NO REST verify endpoint. /api/v1/verify, /verify_license and /roof
  // are all 404. verify_license is an MCP tool; this is the REST equivalent.
  const d = await call(`/contractors/${encodeURIComponent(arg)}`, {});
  const c = d.contractor;
  for (const k of ['license_number', 'business_name', 'license_type', 'license_status',
    'license_effective', 'license_expiration']) {
    console.log(`  ${k.padEnd(20)} ${c[k]}`);
  }
  console.log(`  ${'permits on record'.padEnd(20)} ${c.activity.permit_count}`);
  console.log(`  ${'links.permits'.padEnd(20)} ${d.links?.permits}`);
  console.log(`\n${d.disclosure}`);
} else {
  console.error('mode must be address, contractor, feed or license');
  process.exit(1);
}
