import { put } from "@vercel/blob";
import { encodeScan } from "./_lib.js";

export default async function handler(req, res) {
  const dest = process.env.DEST_URL;
  if (!dest) return res.status(500).send("DEST_URL is not configured");

  const isBot = /bot|crawl|spider|preview|facebookexternalhit|slurp/i.test(req.headers["user-agent"] || "");
  if (!isBot && req.method === "GET") {
    // Log before redirecting: Blob auth (OIDC) isn't available once the response has ended.
    // Logging never blocks the redirect: failures are swallowed and capped at 1.5s.
    await Promise.race([
      put(encodeScan(req), "", { access: "public", addRandomSuffix: true }).catch((e) =>
        console.error("scan log failed", e)
      ),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  }

  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, dest);
}
