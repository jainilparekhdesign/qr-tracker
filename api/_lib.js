import { createHash } from "node:crypto";

// Each scan is stored as an empty blob whose pathname encodes the data:
// scans/<ms>__<country>__<city>__<device>__<os>__<visitor>.txt
// so the dashboard only needs list() calls, never per-blob fetches.
export const PREFIX = "scans/";
const SEP = "__";

const clean = (s) => (s || "unknown").replace(/[^a-zA-Z0-9 .-]/g, "").slice(0, 40) || "unknown";

export function parseUA(ua = "") {
  let os = "Other";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux|CrOS/i.test(ua)) os = "Linux";
  let device = "Desktop";
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) device = "Tablet";
  else if (/Mobi|iPhone|iPod|Android/i.test(ua)) device = "Mobile";
  return { os, device };
}

export function encodeScan(req) {
  const h = req.headers;
  const ua = h["user-agent"] || "";
  const ip = (h["x-forwarded-for"] || "").split(",")[0].trim();
  const { os, device } = parseUA(ua);
  let city = h["x-vercel-ip-city"] || "";
  try { city = decodeURIComponent(city); } catch {}
  // Anonymous visitor id: salted hash, never stores the raw IP.
  const visitor = createHash("sha256")
    .update(`${process.env.HASH_SALT || "qr"}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 12);
  const parts = [Date.now(), clean(h["x-vercel-ip-country"]), clean(city), device, os, visitor];
  return `${PREFIX}${parts.join(SEP)}.txt`;
}

export function decodeScan(pathname) {
  const name = pathname.slice(PREFIX.length).replace(/(-[A-Za-z0-9]+)?\.txt$/, "");
  const [ts, country, city, device, os, visitor] = name.split(SEP);
  return { ts: Number(ts), country, city, device, os, visitor };
}
