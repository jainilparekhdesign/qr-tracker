#!/bin/zsh
# Deploys the QR tracker to your Vercel account. Run from this folder.
set -e
cd "$(dirname "$0")"
npx vercel@latest link --yes --project qr-tracker
printf '%s' 'https://jefferson.co1.qualtrics.com/jfe/form/SV_7UKEVcLVQQy4bem' | npx vercel@latest env add DEST_URL production --force
printf '%s' "$(node -p "require('./.secrets.json').STATS_KEY")" | npx vercel@latest env add STATS_KEY production --sensitive --force
printf '%s' "$(node -p "require('./.secrets.json').HASH_SALT")" | npx vercel@latest env add HASH_SALT production --sensitive --force
echo
echo ">>> Now create the Blob store: Vercel dashboard → qr-tracker → Storage → Create → Blob"
echo ">>> (access: Public), connect it to Production, then press Enter here."
read
npx vercel@latest deploy --prod
