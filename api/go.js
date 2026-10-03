import { put } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { encodeScan } from "./_lib.js";

export default function handler(req, res) {
  const dest = process.env.DEST_URL;
  if (!dest) return res.status(500).send("DEST_URL is not configured");

  const isBot = /bot|crawl|spider|preview|facebookexternalhit|slurp/i.test(req.headers["user-agent"] || "");
  if (!isBot && req.method === "GET") {
    waitUntil(
      put(encodeScan(req), "", { access: "public", addRandomSuffix: true }).catch((e) =>
        console.error("scan log failed", e)
      )
    );
  }

  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, dest);
}
