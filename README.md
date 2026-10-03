# QR Tracker

A tiny Vercel app that powers a trackable QR code. The QR points to `/go`, which logs the scan and redirects to the destination survey.

- **`/go`** — logs each scan (time, device, OS, city/country, anonymous visitor hash) and 302-redirects to `DEST_URL`. Link-preview bots are ignored.
- **`/stats?key=STATS_KEY`** — private dashboard: total scans, unique/repeat scanners, scans per day, device, OS, location, recent scans. Optional `&tz=America/Chicago`.

Raw IPs are never stored; unique scanners are estimated from a salted SHA-256 hash.

## Setup

Environment variables (Production):

| Name | Purpose |
| --- | --- |
| `DEST_URL` | Where scans are sent (change any time; no need to reprint the QR) |
| `STATS_KEY` | Secret key for the stats page |
| `HASH_SALT` | Random salt for anonymous visitor IDs |
| `BLOB_READ_WRITE_TOKEN` | Added automatically when you connect a Vercel Blob store (access: Public) |

Deploy with `./deploy.sh`, or import this repo in Vercel and add the variables above.
