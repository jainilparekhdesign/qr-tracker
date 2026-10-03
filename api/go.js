import { put } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { encodeScan } from "./_lib.js";

export default function handler(req, res) {
  const dest = process.env.DEST_URL;
  if (!dest) return res.status(500).send("DEST_URL is not configured");

  const isBot = /bot|crawl|spider|preview|facebookexternalhit|slurp/i.test(req.headers["user-agent"] || "");
  if (!isBot && req.method === "GET") {
    const path = encodeScan(req);
    // Works whether the Blob store was created as public or private.
    const log = (access) => put(path, "", { access, addRandomSuffix: true });
    waitUntil(
      log("public")
        .catch(() => log("private"))
        .catch((e) => console.error("scan log failed", e))
    );
  }

  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, dest);
}
