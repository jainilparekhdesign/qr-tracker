import { list, del } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";
import { PREFIX, decodeScan } from "./_lib.js";

const safeEq = (a, b) => {
  const x = Buffer.from(a || ""), y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function allScans() {
  const scans = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    for (const b of page.blobs) scans.push(decodeScan(b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return scans.filter((s) => s.ts).sort((a, b) => a.ts - b.ts);
}

const tally = (arr, key) =>
  Object.entries(arr.reduce((m, s) => ((m[key(s)] = (m[key(s)] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);

export default async function handler(req, res) {
  if (!process.env.STATS_KEY || !safeEq(req.query.key, process.env.STATS_KEY)) {
    return res.status(401).send("Unauthorized — add ?key=YOUR_STATS_KEY");
  }
  if (req.method === "POST" && req.query.reset === "1") {
    for (const prefix of [PREFIX, "diag/"]) {
      let cursor;
      do {
        const page = await list({ prefix, limit: 1000, cursor });
        if (page.blobs.length) await del(page.blobs.map((b) => b.url));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    }
    res.setHeader("Location", `/stats?key=${encodeURIComponent(req.query.key)}`);
    return res.status(303).end();
  }
  let scans;
  try {
    scans = await allScans();
  } catch (e) {
    console.error("stats: blob list failed", e);
    return res.status(500).send(`Could not read scan log: ${esc(e.message)}. Check that a Blob store is connected to this project, then redeploy.`);
  }
  const tz = req.query.tz || "America/New_York";
  const dayOf = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: tz });

  const visitors = tally(scans, (s) => s.visitor);
  const unique = visitors.length;
  const repeatVisitors = visitors.filter(([, n]) => n > 1).length;

  // Fill gaps so the chart shows zero days too
  const daily = {};
  if (scans.length) {
    for (let t = scans[0].ts; dayOf(t) <= dayOf(Date.now()); t += 864e5) daily[dayOf(t)] = 0;
    for (const s of scans) daily[dayOf(s.ts)] = (daily[dayOf(s.ts)] || 0) + 1;
  }
  const data = {
    days: Object.keys(daily), counts: Object.values(daily),
    devices: tally(scans, (s) => s.device), os: tally(scans, (s) => s.os),
    places: tally(scans, (s) => (s.city !== "unknown" ? `${s.city}, ${s.country}` : s.country)).slice(0, 15),
  };
  const today = scans.filter((s) => dayOf(s.ts) === dayOf(Date.now())).length;
  const recent = scans.slice(-25).reverse();

  const table = (rows) => rows.length
    ? `<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v}</td><td class="bar"><span style="width:${(v / rows[0][1]) * 100}%"></span></td></tr>`).join("")}</table>`
    : `<p class="muted">No data yet</p>`;

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QR Scan Tracker</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
:root{--bg:#f7f7f5;--card:#fff;--fg:#1a1a1a;--muted:#6b6b6b;--line:#e6e6e3;--accent:#2f6fde}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--card:#1e1e1e;--fg:#eee;--muted:#999;--line:#2e2e2e;--accent:#6d9cff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:0 0 4px}.muted{color:var(--muted)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.kpi b{display:block;font-size:28px;font-variant-numeric:tabular-nums}.kpi span{color:var(--muted);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px}
h2{font-size:14px;margin:0 0 10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:5px 4px;border-bottom:1px solid var(--line)}
td.n{text-align:right;font-variant-numeric:tabular-nums;width:48px}td.bar{width:35%}td.bar span{display:block;height:6px;border-radius:3px;background:var(--accent)}
.scroll{overflow-x:auto}
</style></head><body><main>
<h1>QR Scan Tracker</h1><div class="muted">Destination: ${esc(process.env.DEST_URL || "")}</div>
<div class="kpis">
<div class="card kpi"><b>${scans.length}</b><span>Total scans</span></div>
<div class="card kpi"><b>${unique}</b><span>Unique scanners (est.)</span></div>
<div class="card kpi"><b>${repeatVisitors}</b><span>Repeat scanners</span></div>
<div class="card kpi"><b>${today}</b><span>Scans today</span></div>
</div>
<div class="card"><h2>Scans per day</h2><canvas id="daily" height="90"></canvas></div>
<div class="grid">
<div class="card"><h2>Device</h2>${table(data.devices)}</div>
<div class="card"><h2>Operating system</h2>${table(data.os)}</div>
<div class="card"><h2>Location</h2>${table(data.places)}</div>
</div>
<div class="card" style="margin-top:12px"><h2>Recent scans</h2><div class="scroll"><table>
${recent.map((s) => `<tr><td>${esc(new Date(s.ts).toLocaleString("en-US", { timeZone: tz }))}</td><td>${esc(s.city)}, ${esc(s.country)}</td><td>${esc(s.device)} · ${esc(s.os)}</td></tr>`).join("") || `<tr><td class="muted">No scans yet</td></tr>`}
</table></div></div>
<form method="post" action="/stats?key=${esc(encodeURIComponent(req.query.key))}&reset=1" onsubmit="return confirm('Delete all recorded scans? This cannot be undone.')" style="margin-top:16px">
<button style="background:none;border:1px solid var(--line);color:var(--muted);border-radius:8px;padding:6px 12px;cursor:pointer">Reset all scans</button></form>
<p class="muted" style="font-size:12px">Times in ${esc(tz)}. Unique scanners are estimated from an anonymous salted hash; raw IPs are never stored.</p>
</main><script>
const d=${JSON.stringify({ days: data.days, counts: data.counts })};
const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
new Chart(document.getElementById('daily'),{type:'bar',data:{labels:d.days,datasets:[{data:d.counts,backgroundColor:accent,borderRadius:4}]},
options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}}}});
</script></body></html>`);
}
